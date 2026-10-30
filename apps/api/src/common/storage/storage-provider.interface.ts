import { Readable } from 'stream';
import { MediaAssetKind, ProviderUsage, SignedUrlOptions } from '@sentinel/shared-types';
import { MediaAsset } from './schemas/media-asset.schema';

export interface UploadInput {
  buffer?: Buffer;
  stream?: Readable;
  filePath?: string;
  kind: MediaAssetKind;
  caseId?: string;
  entityId: string;
  mimeType: string;
  sha256?: string;
  uploadedBy?: string;
  context?: {
    caseId?: string;
    cameraId?: string;
    capturedAt?: string;
    [key: string]: any;
  };
  tags?: string[];
  legalHold?: boolean;
}

export interface StorageProvider {
  readonly name: 'cloudinary' | 'minio' | 'local';

  upload(input: UploadInput): Promise<MediaAsset>;

  getSignedUrl(
    asset: MediaAsset,
    opts: SignedUrlOptions,
  ): Promise<{ url: string; expiresAt: Date }>;

  getOriginalStream(asset: MediaAsset): Promise<Readable>;

  delete(asset: MediaAsset): Promise<void>;

  usage(): Promise<ProviderUsage>;
}
