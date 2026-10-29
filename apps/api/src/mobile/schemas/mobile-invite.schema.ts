import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MobileInviteDocument = MobileInvite & Document;

@Schema({ collection: 'mobile_invites', timestamps: true })
export class MobileInvite {
  @Prop({ required: true, unique: true, index: true })
  inviteId: string;

  @Prop({ required: true, unique: true, index: true })
  codeHash: string;

  @Prop({ required: true, index: true })
  siteId: string;

  @Prop({ required: true })
  createdBy: string;

  @Prop({ required: true, index: true })
  expiresAt: Date;

  @Prop({ default: 10 })
  maxUses: number;

  @Prop({ default: 0 })
  usedCount: number;

  @Prop({ default: false })
  autoApprove: boolean;

  @Prop({ type: [String], default: [] })
  allowedEmailDomains: string[];

  @Prop({ index: true })
  revokedAt?: Date;
}

export const MobileInviteSchema = SchemaFactory.createForClass(MobileInvite);
