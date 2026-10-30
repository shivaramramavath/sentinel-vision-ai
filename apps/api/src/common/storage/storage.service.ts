import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import { StorageProvider, UploadInput } from './storage-provider.interface';
import { CloudinaryStorageProvider } from './providers/cloudinary-storage.provider';
import { MinioStorageProvider } from './providers/minio-storage.provider';
import { MediaAsset, MediaAssetDocument } from './schemas/media-asset.schema';
import { AuditService } from '../../audit/audit.service';
import { validateMimeType, normalizeImage, computeSha256 } from './utils/image-normalizer.util';
import { ProviderUsage, SignedUrlOptions } from '@sentinel/shared-types';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly activeProvider: StorageProvider;
  private readonly maxImageMb: number;
  private readonly maxVideoMb: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly cloudinaryProvider: CloudinaryStorageProvider,
    private readonly minioProvider: MinioStorageProvider,
    @InjectModel(MediaAsset.name) private readonly assetModel: Model<MediaAssetDocument>,
    private readonly auditService: AuditService,
  ) {
    const driver = this.configService.get<string>('app.storageDriver', 'cloudinary');
    if (driver === 'minio') {
      this.activeProvider = this.minioProvider;
      this.logger.log('Active storage driver selected: MinIO (Offline dev & tests)');
    } else {
      this.activeProvider = this.cloudinaryProvider;
      this.logger.log('Active storage driver selected: Cloudinary (Authenticated cloud delivery)');
    }

    this.maxImageMb = this.configService.get<number>('app.cloudinaryMaxImageMb', 25);
    this.maxVideoMb = this.configService.get<number>('app.cloudinaryMaxVideoMb', 100);
  }

  get provider(): StorageProvider {
    return this.activeProvider;
  }

  /**
   * Upload an asset through the storage abstraction with normalization, EXIF stripping, and SHA-256 verification.
   */
  async upload(input: UploadInput): Promise<MediaAssetDocument> {
    validateMimeType(input.kind, input.mimeType);

    let processedBuffer = input.buffer;
    let finalMimeType = input.mimeType;
    let calculatedSha256 = input.sha256;
    let width: number | undefined;
    let height: number | undefined;

    // Process image kinds through sharp normalization
    const isImageKind = ['reference', 'crop', 'frame', 'avatar'].includes(input.kind);

    if (isImageKind && processedBuffer) {
      if (processedBuffer.length > this.maxImageMb * 1024 * 1024) {
        throw new BadRequestException(`Image exceeds maximum allowed size of ${this.maxImageMb}MB`);
      }

      const normalized = await normalizeImage(processedBuffer, input.mimeType);
      processedBuffer = normalized.buffer;
      finalMimeType = normalized.mimeType;
      calculatedSha256 = normalized.sha256;
      width = normalized.width;
      height = normalized.height;
    } else if (processedBuffer) {
      if (input.kind === 'clip' && processedBuffer.length > this.maxVideoMb * 1024 * 1024) {
        throw new BadRequestException(`Video clip exceeds maximum allowed size of ${this.maxVideoMb}MB`);
      }
      calculatedSha256 = computeSha256(processedBuffer);
    }

    const providerAsset = await this.activeProvider.upload({
      ...input,
      buffer: processedBuffer,
      mimeType: finalMimeType,
      sha256: calculatedSha256,
    });

    if (width) providerAsset.width = width;
    if (height) providerAsset.height = height;

    // Persist MediaAsset document in MongoDB
    const doc = await this.assetModel.findOneAndUpdate(
      { publicId: providerAsset.publicId },
      { $set: providerAsset },
      { upsert: true, new: true },
    );

    await this.auditService.recordLog({
      action: 'MEDIA_ASSET_UPLOADED',
      correlationId: randomUUID(),
      actor: {
        userId: input.uploadedBy || 'system',
        email: 'system@sentinel.internal',
        role: 'system',
      },
      entity: {
        type: 'media_asset',
        id: doc.assetId,
      },
      metadata: {
        publicId: doc.publicId,
        provider: doc.provider,
        kind: input.kind,
        sha256: doc.sha256,
        bytes: doc.bytes,
      },
    });

    return doc;
  }

  /**
   * Generates short-lived, authenticated signed delivery URLs with mandatory audit log recording.
   */
  async getSignedUrl(
    assetIdOrPublicId: string,
    opts: SignedUrlOptions = { purpose: 'view' },
    actor?: { userId?: string; email?: string; role?: string },
  ): Promise<{ url: string; expiresAt: Date; asset: MediaAssetDocument }> {
    const asset = await this.findAsset(assetIdOrPublicId);
    if (!asset) {
      throw new NotFoundException(`Media asset '${assetIdOrPublicId}' not found`);
    }

    if (asset.status === 'deleted') {
      throw new ForbiddenException(`Asset '${asset.publicId}' has been deleted`);
    }

    const provider = asset.provider === 'minio' ? this.minioProvider : this.cloudinaryProvider;
    const { url, expiresAt } = await provider.getSignedUrl(asset, opts);

    // Audit every issuance of an evidence or reference signed URL
    if (['reference', 'crop', 'frame', 'clip'].includes(asset.context?.kind || '')) {
      await this.auditService.recordLog({
        action: 'MEDIA_SIGNED_URL_ISSUED',
        correlationId: randomUUID(),
        actor: {
          userId: actor?.userId || 'system',
          email: actor?.email || 'viewer@sentinel.gov',
          role: actor?.role || 'viewer',
        },
        entity: {
          type: 'media_asset',
          id: asset.assetId,
        },
        metadata: {
          publicId: asset.publicId,
          purpose: opts.purpose,
          expiresAt: expiresAt.toISOString(),
          caseId: asset.context?.caseId,
        },
      });
    }

    return { url, expiresAt, asset };
  }

  /**
   * Retrieves original uncompressed stream for AI feature extraction or hash verification.
   */
  async getOriginalStream(assetIdOrPublicId: string): Promise<{ stream: Readable; asset: MediaAssetDocument }> {
    const asset = await this.findAsset(assetIdOrPublicId);
    if (!asset) {
      throw new NotFoundException(`Media asset '${assetIdOrPublicId}' not found`);
    }

    const provider = asset.provider === 'minio' ? this.minioProvider : this.cloudinaryProvider;
    const stream = await provider.getOriginalStream(asset);

    return { stream, asset };
  }

  /**
   * Soft-deletes asset and removes it from Cloudinary / MinIO if not under legal hold.
   */
  async delete(assetIdOrPublicId: string, actor?: { userId?: string; email?: string }): Promise<void> {
    const asset = await this.findAsset(assetIdOrPublicId);
    if (!asset) {
      throw new NotFoundException(`Media asset '${assetIdOrPublicId}' not found`);
    }

    if (asset.legalHold) {
      throw new ForbiddenException(`Asset '${asset.publicId}' is under active statutory legal hold`);
    }

    const provider = asset.provider === 'minio' ? this.minioProvider : this.cloudinaryProvider;
    await provider.delete(asset);

    asset.status = 'deleted';
    asset.deletedAt = new Date();
    await asset.save();

    await this.auditService.recordLog({
      action: 'MEDIA_ASSET_DELETED',
      correlationId: randomUUID(),
      actor: {
        userId: actor?.userId || 'system',
        email: actor?.email || 'system@sentinel.internal',
        role: 'investigator',
      },
      entity: {
        type: 'media_asset',
        id: asset.assetId,
      },
      metadata: { publicId: asset.publicId },
    });
  }

  async usage(): Promise<ProviderUsage> {
    return this.activeProvider.usage();
  }

  async findAsset(assetIdOrPublicId: string): Promise<MediaAssetDocument | null> {
    return this.assetModel.findOne({
      $or: [
        { assetId: assetIdOrPublicId },
        { publicId: assetIdOrPublicId },
        { sha256: assetIdOrPublicId },
      ],
    });
  }

  // --- Backwards Compatibility Helpers for camera recording segments ---

  async uploadFile(bucket: string, objectName: string, buffer: Buffer, contentType: string): Promise<string> {
    const recordingDriver = this.configService.get<string>('app.recordingDriver', 'minio');
    if (recordingDriver === 'minio') {
      const asset = await this.minioProvider.upload({
        buffer,
        kind: 'frame',
        entityId: objectName.replace(/[^a-zA-Z0-9_-]/g, '_'),
        mimeType: contentType,
        context: { bucket },
      });
      const { url } = await this.minioProvider.getSignedUrl(asset, { purpose: 'view' });
      return url;
    }

    // Default upload
    const asset = await this.upload({
      buffer,
      kind: 'frame',
      entityId: objectName.replace(/[^a-zA-Z0-9_-]/g, '_'),
      mimeType: contentType,
    });
    const { url } = await this.getSignedUrl(asset.assetId, { purpose: 'view' });
    return url;
  }

  async getPresignedUrl(bucket: string, objectName: string, expirySec = 24 * 3600): Promise<string> {
    const asset = await this.findAsset(objectName);
    if (asset) {
      const { url } = await this.getSignedUrl(asset.assetId, { purpose: 'view', ttlSeconds: expirySec });
      return url;
    }
    return `http://localhost:${this.configService.get<number>('app.port', 3001)}/uploads/${bucket}/${objectName}`;
  }

  async getPresignedUploadUrl(bucket: string, objectName: string, expirySec = 300): Promise<string> {
    return `http://localhost:${this.configService.get<number>('app.port', 3001)}/uploads/${bucket}/${objectName}`;
  }

  async deleteObject(bucket: string, objectName: string): Promise<boolean> {
    try {
      await this.delete(objectName);
      return true;
    } catch {
      return false;
    }
  }
}
