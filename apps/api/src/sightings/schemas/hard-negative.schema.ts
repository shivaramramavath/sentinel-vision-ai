import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type HardNegativeDocument = HardNegative & Document;

@Schema({ collection: 'hard_negatives', timestamps: true })
export class HardNegative {
  @Prop({ required: true, unique: true })
  id: string; // e.g. 'neg_001'

  @Prop({ required: true, index: true })
  caseId: string;

  @Prop({ required: true, index: true })
  sightingId: string;

  @Prop({ required: true })
  cropUrl: string;

  @Prop({ type: [Number], default: [] })
  embeddingReid?: number[];

  @Prop({ type: [Number], default: [] })
  embeddingFace?: number[];

  @Prop({ required: true, default: 'different_person' })
  rejectReasonCode: string;

  @Prop({ required: true })
  rejectedBy: string;

  @Prop({ required: true })
  rejectedAt: string;

  @Prop({ required: true, default: 'v1.0' })
  model_version: string;
}

export const HardNegativeSchema = SchemaFactory.createForClass(HardNegative);
HardNegativeSchema.index({ caseId: 1, rejectedAt: -1 });
