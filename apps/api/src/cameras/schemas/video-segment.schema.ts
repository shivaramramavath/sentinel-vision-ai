import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VideoSegmentDocument = VideoSegment & Document;

export type StorageTier = 'hot' | 'warm' | 'evidence';

@Schema({ timestamps: true, collection: 'video_segments' })
export class VideoSegment {
  @Prop({ required: true, index: true })
  cameraId: string;

  @Prop({ default: 'site_primary', index: true })
  siteId: string;

  @Prop({ required: true, index: true })
  startTs: Date;

  @Prop({ required: true })
  endTs: Date;

  @Prop({ required: true })
  durationSec: number;

  @Prop({ required: true })
  uri: string;

  @Prop({ required: false })
  thumbnailUri?: string;

  @Prop({ default: 0 })
  sizeBytes: number;

  @Prop({ default: 'h264' })
  codec: string;

  @Prop({ default: false })
  hasGap: boolean;

  @Prop({ default: 0.0 })
  motionScore: number;

  @Prop({ required: true })
  checksum: string; // SHA-256

  @Prop({ default: 'hot', enum: ['hot', 'warm', 'evidence'], index: true })
  tier: StorageTier;

  @Prop({ required: false, index: true })
  caseId?: string;

  @Prop({ required: false, index: true })
  sightingId?: string;

  @Prop({ required: false })
  legalHoldNote?: string;
}

export const VideoSegmentSchema = SchemaFactory.createForClass(VideoSegment);

// Compound indexes for high-throughput range lookups and retention pruning
VideoSegmentSchema.index({ cameraId: 1, startTs: 1 });
VideoSegmentSchema.index({ tier: 1, startTs: 1 });
