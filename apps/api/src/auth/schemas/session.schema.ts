import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type SessionDocument = Session & Document;

@Schema({ collection: 'sessions', timestamps: true })
export class Session {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'User', index: true })
  userId: string;

  @Prop({ required: true, index: true })
  refreshTokenFamilyId: string;

  @Prop({ required: true })
  currentTokenHash: string; // SHA-256 of active refresh token secret

  @Prop({ default: 'Unknown' })
  userAgent: string;

  @Prop({ default: '' })
  ipHash: string; // SHA-256 of IP for privacy-preserving geographic correlation

  @Prop({ default: 'Standard Workstation' })
  deviceLabel: string;

  @Prop({ default: () => new Date() })
  lastUsedAt: Date;

  createdAt: Date;
  updatedAt: Date;

  @Prop({ required: true, index: true })
  expiresAt: Date;

  @Prop()
  revokedAt?: Date;

  @Prop()
  revokedReason?: string;
}

export const SessionSchema = SchemaFactory.createForClass(Session);
SessionSchema.index({ userId: 1, revokedAt: 1 });
