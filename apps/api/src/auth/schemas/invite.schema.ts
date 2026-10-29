import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type InviteDocument = Invite & Document;

@Schema({ collection: 'invites', timestamps: true })
export class Invite {
  @Prop({ required: true, unique: true, index: true })
  codeHash: string; // SHA-256 of invite code

  @Prop({ required: true, default: 'viewer' })
  role: string;

  @Prop({ type: [String], default: [] })
  teams: string[];

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: 1 })
  maxUses: number;

  @Prop({ default: 0 })
  usedCount: number;

  @Prop({ default: false })
  autoApprove: boolean;

  @Prop()
  createdBy?: string;
}

export const InviteSchema = SchemaFactory.createForClass(Invite);
