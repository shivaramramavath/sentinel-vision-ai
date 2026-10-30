import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { MediaAssetKind } from '@sentinel/shared-types';

export type MediaAssetDocument = MediaAsset & Document;

@Schema({ collection: 'media_assets', timestamps: true })
export class MediaAsset {
  @Prop({ required: true, default: () => new Types.ObjectId().toString(), index: true })
  assetId: string;

  @Prop({ required: true, enum: ['cloudinary', 'minio', 'local'], default: 'cloudinary' })
  provider: 'cloudinary' | 'minio' | 'local';

  @Prop({ required: true, index: true })
  publicId: string;

  @Prop({ required: true, enum: ['image', 'video', 'raw'], default: 'image' })
  resourceType: 'image' | 'video' | 'raw';

  @Prop({ required: true, enum: ['authenticated', 'private', 'upload'], default: 'authenticated' })
  deliveryType: 'authenticated' | 'private' | 'upload';

  @Prop({ type: Number })
  version?: number;

  @Prop({ required: true })
  format: string;

  @Prop({ required: true, type: Number })
  bytes: number;

  @Prop({ type: Number })
  width?: number;

  @Prop({ type: Number })
  height?: number;

  @Prop({ type: Number })
  durationSec?: number;

  @Prop({ required: true, index: true })
  sha256: string;

  @Prop()
  etag?: string;

  @Prop({ required: true, index: true })
  folder: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: Object, default: {} })
  context?: {
    caseId?: string;
    cameraId?: string;
    capturedAt?: string;
    entityId?: string;
    kind?: MediaAssetKind;
  };

  @Prop({ required: true, enum: ['pending', 'ready', 'failed', 'deleted'], default: 'ready', index: true })
  status: 'pending' | 'ready' | 'failed' | 'deleted';

  @Prop()
  uploadedBy?: string;

  @Prop({ default: () => new Date() })
  uploadedAt: Date;

  @Prop({ default: false, index: true })
  legalHold: boolean;

  @Prop()
  deletedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const MediaAssetSchema = SchemaFactory.createForClass(MediaAsset);
MediaAssetSchema.index({ publicId: 1, provider: 1 }, { unique: true });
MediaAssetSchema.index({ 'context.caseId': 1, status: 1 });
