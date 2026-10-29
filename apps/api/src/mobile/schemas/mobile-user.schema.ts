import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { MobileUserStatus, MfaMethod } from '@sentinel/shared-types';

export type MobileUserDocument = MobileUser & Document;

@Schema({ _id: false })
export class MobileUserConsent {
  @Prop({ required: true, default: () => new Date() })
  acceptedAt: Date;

  @Prop({ required: true, default: '1.0' })
  termsVersion: string;

  @Prop({ default: '' })
  ip: string;

  @Prop({ default: '' })
  userAgent: string;
}

@Schema({ _id: false })
export class MobileUserMfa {
  @Prop({ default: false })
  enabled: boolean;

  @Prop({ type: String, enum: ['totp', 'sms', 'email'], default: 'email' })
  method: MfaMethod;
}

@Schema({ collection: 'mobile_users', timestamps: true })
export class MobileUser {
  @Prop({ required: true, unique: true, index: true })
  mobileUserId: string;

  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({ trim: true })
  phoneE164?: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop()
  emailVerifiedAt?: Date;

  @Prop()
  phoneVerifiedAt?: Date;

  @Prop({ type: [String], default: [] })
  siteIds: string[];

  @Prop({
    type: String,
    enum: ['pending_verification', 'pending_approval', 'active', 'suspended', 'rejected'],
    default: 'pending_verification',
    index: true,
  })
  status: MobileUserStatus;

  @Prop({ index: true })
  invitedByInviteId?: string;

  @Prop({ type: MobileUserConsent, required: true })
  consent: MobileUserConsent;

  @Prop({ default: 0 })
  failedLoginCount: number;

  @Prop()
  lockedUntil?: Date;

  @Prop({ type: MobileUserMfa, default: () => ({ enabled: false, method: 'email' }) })
  mfa: MobileUserMfa;

  @Prop()
  lastLoginAt?: Date;
}

export const MobileUserSchema = SchemaFactory.createForClass(MobileUser);
