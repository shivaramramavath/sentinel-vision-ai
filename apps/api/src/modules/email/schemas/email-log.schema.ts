import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EmailLogDocument = EmailLog & Document;

@Schema({ timestamps: true })
export class EmailLog {
  @Prop({ required: true, index: true })
  templateId: string;

  @Prop({ required: true, index: true })
  recipientHash: string; // SHA-256 of lowercase recipient email

  @Prop({ unique: true, sparse: true, index: true })
  idempotencyKey?: string;

  @Prop({ required: true, enum: ['queued', 'sent', 'failed', 'dead_letter'], default: 'queued', index: true })
  status: string;

  @Prop()
  messageId?: string;

  @Prop({ default: 1 })
  attempts: number;

  @Prop()
  errorCode?: string;

  @Prop()
  lastError?: string;

  @Prop()
  sentAt?: Date;
}

export const EmailLogSchema = SchemaFactory.createForClass(EmailLog);
EmailLogSchema.index({ createdAt: -1 });
