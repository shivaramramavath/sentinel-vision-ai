import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VerificationLabelDocument = VerificationLabel & Document;

@Schema({ collection: 'verification_labels', timestamps: true })
export class VerificationLabel {
  @Prop({ required: true, index: true })
  sightingId: string;

  @Prop({ required: true, index: true })
  caseId: string;

  @Prop({ required: true, enum: ['confirmed', 'rejected'] })
  label: 'confirmed' | 'rejected';

  @Prop({ required: true })
  reviewerId: string;

  @Prop({ default: '' })
  notes: string;

  @Prop({ type: Object, default: {} })
  features: Record<string, any>;

  @Prop({ default: 'sentinel-fusion-v1.0.0' })
  modelVersion: string;

  @Prop({ default: () => new Date().toISOString() })
  recordedAt: string;
}

export const VerificationLabelSchema = SchemaFactory.createForClass(VerificationLabel);
