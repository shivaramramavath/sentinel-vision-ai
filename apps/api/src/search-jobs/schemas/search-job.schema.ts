import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SearchJobStatus =
  | 'queued'
  | 'planning'
  | 'running'
  | 'aggregating'
  | 'awaiting_review'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

export type SearchJobDocument = SearchJob & Document;

@Schema({ collection: 'search_jobs', timestamps: true })
export class SearchJob {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  caseId: string;

  @Prop({ required: true })
  caseTitle: string;

  @Prop({ required: true })
  referencePhotoUrl: string;

  @Prop({
    required: true,
    enum: [
      'queued',
      'planning',
      'running',
      'aggregating',
      'awaiting_review',
      'completed',
      'failed',
      'cancelled',
      'paused',
    ],
    default: 'queued',
  })
  status: SearchJobStatus;

  @Prop({ default: 0, min: 0, max: 100 })
  progressPercent: number;

  @Prop({ default: 0 })
  candidatesFound: number;

  @Prop({ default: 124 })
  cameraScopeCount: number;

  @Prop({ default: 24 })
  timeRangeHours: number;

  @Prop({ default: 0.7 })
  minConfidence: number;

  @Prop({ default: 0 })
  totalShards: number;

  @Prop({ default: 0 })
  completedShards: number;

  @Prop({ default: 0 })
  etaSeconds: number;

  @Prop({ default: () => new Date().toISOString() })
  startedAt: string;

  @Prop({ default: null })
  completedAt: string;

  @Prop({ default: false })
  seed?: boolean;

  @Prop({ default: '' })
  seedKey?: string;
}

export const SearchJobSchema = SchemaFactory.createForClass(SearchJob);

SearchJobSchema.index({ status: 1, createdAt: -1 });
SearchJobSchema.index({ caseId: 1 });
