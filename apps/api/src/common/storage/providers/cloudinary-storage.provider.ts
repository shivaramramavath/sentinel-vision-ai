import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable, PassThrough } from 'stream';
import http from 'http';
import https from 'https';
import { StorageProvider, UploadInput } from '../storage-provider.interface';
import { MediaAsset } from '../schemas/media-asset.schema';
import { ProviderUsage, SignedUrlOptions } from '@sentinel/shared-types';

@Injectable()
export class CloudinaryStorageProvider implements StorageProvider {
  readonly name = 'cloudinary';
  private readonly logger = new Logger(CloudinaryStorageProvider.name);
  private readonly rootFolder: string;
  private readonly defaultTtlSeconds: number;
  private isConfigured = false;

  constructor(private readonly configService: ConfigService) {
    const cloudName = this.configService.get<string>('app.cloudinaryCloudName');
    const apiKey = this.configService.get<string>('app.cloudinaryApiKey');
    const apiSecret = this.configService.get<string>('app.cloudinaryApiSecret');
    const cloudinaryUrl = this.configService.get<string>('app.cloudinaryUrl');

    this.rootFolder = (
      this.configService.get<string>('app.cloudinaryRootFolder') || 'sentinel/dev'
    ).replace(/^\/+|\/+$/g, '');

    this.defaultTtlSeconds = this.configService.get<number>(
      'app.cloudinarySignedUrlTtlSeconds',
      300,
    );

    if (cloudinaryUrl) {
      cloudinary.config({ url: cloudinaryUrl, secure: true });
      this.isConfigured = true;
      this.logger.log(`Cloudinary storage configured via CLOUDINARY_URL (Root: ${this.rootFolder})`);
    } else if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      this.isConfigured = true;
      this.logger.log(`Cloudinary storage configured for cloud '${cloudName}' (Root: ${this.rootFolder})`);
    } else {
      this.logger.warn('Cloudinary credentials missing or placeholders; running in offline mock/emulated mode.');
    }
  }

  buildPublicId(input: UploadInput): { folder: string; publicId: string; resourceType: 'image' | 'video' | 'raw' } {
    let subPath = '';
    let resourceType: 'image' | 'video' | 'raw' = 'image';

    const caseId = input.caseId || input.context?.caseId || 'unassigned';

    switch (input.kind) {
      case 'reference':
        subPath = `cases/${caseId}/references`;
        resourceType = 'image';
        break;
      case 'crop':
        subPath = `cases/${caseId}/crops`;
        resourceType = 'image';
        break;
      case 'frame':
        subPath = `cases/${caseId}/evidence`;
        resourceType = 'image';
        break;
      case 'clip':
        subPath = `cases/${caseId}/clips`;
        resourceType = 'video';
        break;
      case 'report':
        subPath = 'reports';
        resourceType = 'raw';
        break;
      case 'avatar':
        subPath = 'avatars';
        resourceType = 'image';
        break;
      case 'export':
        subPath = 'exports';
        resourceType = 'raw';
        break;
      default:
        subPath = 'misc';
        resourceType = 'image';
    }

    const folder = `${this.rootFolder}/${subPath}`;
    const publicId = `${folder}/${input.entityId}`;

    return { folder, publicId, resourceType };
  }

  async upload(input: UploadInput): Promise<MediaAsset> {
    const { folder, publicId, resourceType } = this.buildPublicId(input);

    const tags = ['sentinel', `type:${input.kind}`];
    if (input.caseId || input.context?.caseId) {
      tags.push(`case:${input.caseId || input.context?.caseId}`);
    }
    if (input.legalHold) {
      tags.push('hold');
    }
    if (input.tags?.length) {
      tags.push(...input.tags);
    }

    const contextData: Record<string, string> = {
      kind: input.kind,
      sha256: input.sha256 || '',
      entityId: input.entityId,
    };
    if (input.caseId) contextData.caseId = input.caseId;
    if (input.context?.cameraId) contextData.cameraId = input.context.cameraId;
    if (input.context?.capturedAt) contextData.capturedAt = input.context.capturedAt;

    // Buffer preparation
    let bufferToUpload: Buffer;
    if (input.buffer) {
      bufferToUpload = input.buffer;
    } else if (input.stream) {
      bufferToUpload = await this.streamToBuffer(input.stream);
    } else {
      throw new Error('No buffer or stream provided for media upload');
    }

    let uploadResult: UploadApiResponse;

    if (this.isConfigured) {
      uploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            public_id: publicId,
            resource_type: resourceType,
            type: 'authenticated', // Strict authenticated delivery
            overwrite: false,
            unique_filename: false,
            tags,
            context: contextData,
            invalidate: true,
          },
          (error, result) => {
            if (error || !result) {
              reject(error || new Error('Cloudinary upload returned empty response'));
            } else {
              resolve(result);
            }
          },
        );

        uploadStream.end(bufferToUpload);
      });
    } else {
      // Offline fallback mock response for testing/dev without external cloud
      uploadResult = {
        public_id: publicId,
        version: 1,
        format: input.mimeType.split('/')[1] || 'jpg',
        bytes: bufferToUpload.length,
        resource_type: resourceType,
        type: 'authenticated',
        created_at: new Date().toISOString(),
        tags,
        etag: `mock_etag_${Date.now()}`,
        secure_url: `https://res.cloudinary.com/sentinel/image/authenticated/${publicId}`,
        url: `http://res.cloudinary.com/sentinel/image/authenticated/${publicId}`,
      } as any;
    }

    const asset: MediaAsset = {
      assetId: input.entityId,
      provider: 'cloudinary',
      publicId: uploadResult.public_id,
      resourceType,
      deliveryType: 'authenticated',
      version: uploadResult.version,
      format: uploadResult.format || input.mimeType.split('/')[1] || 'bin',
      bytes: uploadResult.bytes || bufferToUpload.length,
      width: uploadResult.width,
      height: uploadResult.height,
      durationSec: uploadResult.duration,
      sha256: input.sha256 || '',
      etag: uploadResult.etag,
      folder,
      tags,
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
    const ttl = opts.ttlSeconds || this.defaultTtlSeconds;
    const expiresAt = new Date(Date.now() + ttl * 1000);
    const expiresAtSec = Math.floor(expiresAt.getTime() / 1000);

    let transformation: string | undefined = undefined;

    // Apply named display transformation mapping
    if (opts.purpose === 'thumbnail') {
      transformation = opts.transform || 'c_fill,w_256,h_256,g_auto,f_auto,q_auto';
    } else if (opts.purpose === 'view') {
      if (asset.resourceType === 'image') {
        transformation = opts.transform || 'w_1600,c_limit,f_auto,q_auto';
      } else if (asset.resourceType === 'video') {
        transformation = opts.transform || 'vc_h264,q_auto,f_mp4';
      }
    } else if (opts.purpose === 'download' || opts.purpose === 'inference') {
      // AI Inference and Official Evidence Download ALWAYS deliver original uncompressed bytes
      transformation = undefined;
    }

    let url: string;

    if (this.isConfigured) {
      if (opts.purpose === 'download') {
        url = cloudinary.utils.private_download_url(asset.publicId, asset.format, {
          resource_type: asset.resourceType,
          type: 'authenticated',
          expires_at: expiresAtSec,
        });
      } else {
        url = cloudinary.url(asset.publicId, {
          resource_type: asset.resourceType,
          type: 'authenticated',
          sign_url: true,
          secure: true,
          version: asset.version,
          transformation: transformation ? [{ raw_transformation: transformation }] : undefined,
          expires_at: expiresAtSec,
        });
      }
    } else {
      url = `https://res.cloudinary.com/mock-cloud/${asset.resourceType}/authenticated/${asset.publicId}?sig=mock_sig&exp=${expiresAtSec}`;
    }

    return { url, expiresAt };
  }

  async getOriginalStream(asset: MediaAsset): Promise<Readable> {
    const { url } = await this.getSignedUrl(asset, { purpose: 'inference', ttlSeconds: 120 });

    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      client
        .get(url, (res) => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Failed to download original asset stream: HTTP ${res.statusCode}`));
          } else {
            resolve(res);
          }
        })
        .on('error', (err) => reject(err));
    });
  }

  async delete(asset: MediaAsset): Promise<void> {
    if (asset.legalHold) {
      throw new ForbiddenException(`Cannot delete asset ${asset.publicId}: asset is protected by active statutory legal hold`);
    }

    if (this.isConfigured) {
      await cloudinary.uploader.destroy(asset.publicId, {
        resource_type: asset.resourceType,
        type: 'authenticated',
        invalidate: true,
      });
    }
  }

  async usage(): Promise<ProviderUsage> {
    if (!this.isConfigured) {
      return {
        provider: 'cloudinary',
        plan: 'offline_development',
        storage: { usedBytes: 0, limitBytes: 25 * 1024 * 1024 * 1024 },
        bandwidth: { usedBytes: 0, limitBytes: 25 * 1024 * 1024 * 1024 },
        objectsCount: 0,
      };
    }

    try {
      const result = await cloudinary.api.usage();
      return {
        provider: 'cloudinary',
        plan: result.plan || 'Free / Advanced',
        credits: result.credits
          ? {
              used: result.credits.usage,
              limit: result.credits.limit,
              usedPercent: result.credits.used_percent,
            }
          : undefined,
        storage: {
          usedBytes: result.storage?.usage || 0,
          limitBytes: result.storage?.limit,
        },
        bandwidth: {
          usedBytes: result.bandwidth?.usage || 0,
          limitBytes: result.bandwidth?.limit,
        },
        objectsCount: result.objects?.usage || 0,
      };
    } catch (err: any) {
      this.logger.warn(`Could not query Cloudinary usage API: ${err.message}`);
      return {
        provider: 'cloudinary',
        storage: { usedBytes: 0 },
      };
    }
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
