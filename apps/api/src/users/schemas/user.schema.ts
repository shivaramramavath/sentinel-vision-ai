import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserRole =
  | 'super_admin'
  | 'investigator'
  | 'reviewer'
  | 'viewer'
  | 'mobile_operator'
  | 'Super Admin'
  | 'Investigator'
  | 'Reviewer'
  | 'Viewer';

export type UserStatus =
  | 'pending_verification'
  | 'pending_approval'
  | 'active'
  | 'suspended'
  | 'rejected';

export type UserCreatedVia = 'password' | 'google' | 'github' | 'invite';

export type UserDocument = User & Document;

@Schema({ _id: false })
export class MfaConfig {
  @Prop({ default: false })
  enabled: boolean;

  @Prop()
  secretEnc?: string;

  @Prop({ type: [String], default: [] })
  recoveryCodesHashed: string[];
}

@Schema({ collection: 'users', timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: false })
  passwordHash?: string; // Optional for pure social OAuth logins

  @Prop({ required: true })
  fullName: string;

  @Prop()
  avatarUrl?: string;

  @Prop({ default: '' })
  badgeNumber: string;

  @Prop({ default: '' })
  department: string;

  @Prop({
    required: true,
    enum: [
      'super_admin',
      'investigator',
      'reviewer',
      'viewer',
      'mobile_operator',
      'Super Admin',
      'Investigator',
      'Reviewer',
      'Viewer',
    ],
    default: 'viewer',
  })
  role: UserRole;

  @Prop({
    required: true,
    enum: ['pending_verification', 'pending_approval', 'active', 'suspended', 'rejected'],
    default: 'pending_verification',
  })
  status: UserStatus;

  @Prop({ type: MfaConfig, default: () => ({ enabled: false, recoveryCodesHashed: [] }) })
  mfa: MfaConfig;

  @Prop({ default: 0 })
  failedLoginCount: number;

  @Prop()
  lockedUntil?: Date;

  @Prop()
  lastLoginAt?: Date;

  @Prop()
  emailVerifiedAt?: Date;

  @Prop({
    required: true,
    enum: ['password', 'google', 'github', 'invite'],
    default: 'password',
  })
  createdVia: UserCreatedVia;

  @Prop({ default: true })
  active: boolean;

  @Prop({ default: false })
  seed?: boolean;

  @Prop({ default: '' })
  seedKey?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes
UserSchema.index({ status: 1 });
UserSchema.index({ role: 1 });
