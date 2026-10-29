import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ReferenceSetDocument = ReferenceSet & Document;

@Schema({ _id: false })
export class ReferenceSetItem {
  @Prop({ required: true })
  referenceId: string;

  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  uri: string;

  @Prop({ default: false })
  isPrimary: boolean;

  @Prop({ default: 0.95 })
  consistencyScore?: number;

  @Prop({ default: 'front' })
  poseBin?: string;
}

@Schema({ _id: false })
export class ReadinessBreakdown {
  @Prop({ default: 0 })
  c_face_front: number;

  @Prop({ default: 0 })
  c_face_angles: number;

  @Prop({ default: 0 })
  c_body: number;

  @Prop({ default: 0 })
  c_body_views: number;

  @Prop({ default: 0 })
  c_clothing: number;

  @Prop({ default: 0 })
  c_recency: number;

  @Prop({ default: 0 })
  c_consistency: number;
}

@Schema({ _id: false })
export class ReadinessWeights {
  @Prop({ default: 0.2 })
  w_face_front: number;

  @Prop({ default: 0.2 })
  w_face_angles: number;

  @Prop({ default: 0.2 })
  w_body: number;

  @Prop({ default: 0.1 })
  w_body_views: number;

  @Prop({ default: 0.15 })
  w_clothing: number;

  @Prop({ default: 0.1 })
  w_recency: number;

  @Prop({ default: 0.05 })
  w_consistency: number;
}

@Schema({ collection: 'reference_sets', timestamps: true })
export class ReferenceSet {
  @Prop({ required: true, index: true })
  caseId: string;

  @Prop({ required: true, index: true })
  personId: string;

  @Prop({ required: true, default: 1 })
  version: number;

  @Prop({ type: [ReferenceSetItem], default: [] })
  references: ReferenceSetItem[];

  @Prop({ default: 0 })
  readinessScore: number;

  @Prop({ type: ReadinessBreakdown, default: () => ({}) })
  readinessBreakdown: ReadinessBreakdown;

  @Prop({ type: ReadinessWeights, default: () => ({}) })
  weights: ReadinessWeights;

  @Prop({ type: [String], default: [] })
  recommendations: string[];

  @Prop({ required: true })
  pineconeNamespace: string;

  @Prop({ default: null })
  syncedAt?: string;
}

export const ReferenceSetSchema = SchemaFactory.createForClass(ReferenceSet);

ReferenceSetSchema.index({ caseId: 1, version: -1 });
ReferenceSetSchema.index({ personId: 1, version: -1 });
