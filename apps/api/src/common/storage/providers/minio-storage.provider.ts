import { Injectable, Logger, OnModuleInit, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { StorageProvider, UploadInput } from '../storage-provider.interface';
import { MediaAsset } from '../schemas/media-asset.schema';
import { ProviderUsage, SignedUrlOptions } from '@sentinel/shared-types';

@Injectable()
export class MinioStorageProvider implements StorageProvider, OnModuleInit {
  readonly name = 'minio';
  private readonly logger = new Logger(MinioStorageProvider.name);
  private minioClient: Minio.Client | null = null;
  private isMinioAvailable = false;
  private readonly fallbackStoragePath = path.resolve(process.cwd(), 'uploads');
  private readonly defaultBucket: string;

  constructor(private readonly configService: ConfigService) {
    this.defaultBucket = this.configService.get<string>('app.minioBucketPhotos', 'sentinel-media');
  }

  async onModuleInit(): Promise<void> {
    if (!fs.existsSync(this.fallbackStoragePath)) {
      fs.mkdirSync(this.fallbackStoragePath, { recursive: true });
    }

    const endpoint = this.configService.get<string>('app.minioEndpoint', 'localhost');
    const port = this.configService.get<number>('app.minioPort', 9000);
    const useSSL = this.configService.get<boolean>('app.minioUseSsl', false);
    const accessKey = this.configService.get<string>('app.minioAccessKey', 'minioadmin');
    const secretKey = this.configService.get<string>('app.minioSecretKey', 'minioadmin');

    try {
      this.minioClient = new Minio.Client({
        endPoint: endpoint,
        port,
        useSSL,
        accessKey,
        secretKey,
      });

      const exists = await this.minioClient.bucketExists(this.defaultBucket).catch(() => false);
      if (!exists && this.minioClient) {
        await this.minioClient.makeBucket(this.defaultBucket, 'us-east-1').catch(() => null);
      }
      this.isMinioAvailable = true;
      this.logger.log(`MinIO storage connected at ${endpoint}:${port} (Bucket: ${this.defaultBucket})`);
    } catch (err: any) {
      this.logger.warn(`MinIO unavailable (${err.message}). Using local storage fallback at ${this.fallbackStoragePath}`);
      this.isMinioAvailable = false;
    }
  }

  async upload(input: UploadInput): Promise<MediaAsset> {
    let buffer: Buffer;
    if (input.buffer) {
      buffer = input.buffer;
    } else if (input.stream) {
      buffer = await this.streamToBuffer(input.stream);
    } else {
      throw new Error('No buffer provided for MinIO upload');
    }

    const caseId = input.caseId || input.context?.caseId || 'unassigned';
    const folder = `cases/${caseId}/${input.kind}`;
    const objectName = `${folder}/${input.entityId}`;
    let resourceType: 'image' | 'video' | 'raw' = 'image';
    if (input.kind === 'clip') resourceType = 'video';
    else if (input.kind === 'report' || input.kind === 'export') resourceType = 'raw';

    if (this.isMinioAvailable && this.minioClient) {
      try {
        await this.minioClient.putObject(this.defaultBucket, objectName, buffer, buffer.length, {
          'Content-Type': input.mimeType,
          'x-amz-meta-sha256': input.sha256 || '',
        });
      } catch (err: any) {
        this.logger.warn(`MinIO putObject failed: ${err.message}. Using disk fallback.`);
        this.saveLocal(objectName, buffer);
      }
    } else {
      this.saveLocal(objectName, buffer);
    }

    const asset: MediaAsset = {
      assetId: input.entityId,
      provider: 'minio',
      publicId: objectName,
      resourceType,
      deliveryType: 'authenticated',
      version: 1,
      format: input.mimeType.split('/')[1] || 'bin',
      bytes: buffer.length,
      sha256: input.sha256 || '',
      folder,
      tags: input.tags || [],
      context: {
        caseId: input.caseId,
        cameraId: input.context?.cameraId,
        capturedAt: input.context?.capturedAt,
        entityId: input.entityId,
        kind: input.kind,
      },
      status: 'ready',
      uploadedBy: input.uploadedBy,
      uploadedAt: new Date(),
      legalHold: !!input.legalHold,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return asset;
  }

  async getSignedUrl(
    asset: MediaAsset,
    opts: SignedUrlOptions,
  ): Promise<{ url: string; expiresAt: Date }> {
    const ttlSeconds = opts.ttlSeconds || 300;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    if (this.isMinioAvailable && this.minioClient) {
      try {
        const url = await this.minioClient.presignedGetObject(this.defaultBucket, asset.publicId, ttlSeconds);
        return { url, expiresAt };
      } catch (err: any) {
        this.logger.warn(`MinIO presigned URL error: ${err.message}`);
      }
    }

    const apiPort = this.configService.get<number>('app.port', 3001);
    const url = `http://localhost:${apiPort}/uploads/${asset.publicId}`;
    return { url, expiresAt };
  }

  async getOriginalStream(asset: MediaAsset): Promise<Readable> {
    if (this.isMinioAvailable && this.minioClient) {
      return (await this.minioClient.getObject(this.defaultBucket, asset.publicId)) as Readable;
    }

    const localPath = path.join(this.fallbackStoragePath, asset.publicId);
    if (fs.existsSync(localPath)) {
      return fs.createReadStream(localPath);
    }

    throw new Error(`Asset not found in MinIO or local storage: ${asset.publicId}`);
  }

  async delete(asset: MediaAsset): Promise<void> {
    if (asset.legalHold) {
      throw new ForbiddenException(`Asset ${asset.publicId} is protected by active statutory legal hold`);
    }

    if (this.isMinioAvailable && this.minioClient) {
      await this.minioClient.removeObject(this.defaultBucket, asset.publicId).catch(() => null);
    }

    const localPath = path.join(this.fallbackStoragePath, asset.publicId);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
  }

  async usage(): Promise<ProviderUsage> {
    return {
      provider: 'minio',
      plan: 'self_hosted_s3',
      storage: { usedBytes: 0 },
    };
  }

  private saveLocal(objectName: string, buffer: Buffer): void {
    const dest = path.join(this.fallbackStoragePath, objectName);
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dest, buffer);
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}
