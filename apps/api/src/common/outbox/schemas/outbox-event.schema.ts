import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OutboxEventDocument = OutboxEvent & Document;

export type OutboxStatus = 'pending' | 'published' | 'failed';

@Schema({ collection: 'outbox_events', timestamps: true })
export class OutboxEvent {
  @Prop({ required: true, unique: true })
  eventId: string;

  @Prop({ required: true })
  topic: string;

  @Prop({ required: false, default: '' })
  partitionKey: string;

  @Prop({ type: Object, required: true })
  payload: Record<string, any>;

  @Prop({
    required: true,
    enum: ['pending', 'published', 'failed'],
    default: 'pending',
  })
  status: OutboxStatus;

  @Prop({ default: 0 })
  retryCount: number;

  @Prop({ default: null })
  lastError: string;

  @Prop({ default: null })
  publishedAt: Date;
}

export const OutboxEventSchema = SchemaFactory.createForClass(OutboxEvent);

OutboxEventSchema.index({ status: 1, createdAt: 1 });
OutboxEventSchema.index({ topic: 1 });
