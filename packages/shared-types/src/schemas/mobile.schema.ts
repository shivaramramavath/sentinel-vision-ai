import { z } from 'zod';

export type MobileUserStatus =
  | 'pending_verification'
  | 'pending_approval'
  | 'active'
  | 'suspended'
  | 'rejected';

export type MobileDeviceStatus = 'pending_approval' | 'approved' | 'revoked';

export type MfaMethod = 'totp' | 'sms' | 'email';

export interface MobileUserConsent {
  acceptedAt: string;
  termsVersion: string;
  ip: string;
  userAgent: string;
}

export interface MobileUserMfa {
  enabled: boolean;
  method: MfaMethod;
}

export interface MobileUser {
  mobileUserId: string;
  fullName: string;
  email: string;
  phoneE164?: string;
  passwordHash: string;
  emailVerifiedAt?: string;
  phoneVerifiedAt?: string;
  organizationIds?: string[];
  siteIds: string[];
  status: MobileUserStatus;
  invitedByInviteId?: string;
  consent: MobileUserConsent;
  failedLoginCount: number;
  lockedUntil?: string;
  mfa: MobileUserMfa;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface MobileDevice {
  deviceId: string;
  mobileUserId: string;
  cameraId: string;
  label: string;
  platform: string;
  browser: string;
  deviceKeyHash: string;
  status: MobileDeviceStatus;
  approvedBy?: string;
  approvedAt?: string;
  lastSeenAt?: string;
  defaultFacing: 'environment' | 'user';
  shareGps: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface StreamSessionStats {
  avgBitrateKbps: number;
  avgRttMs: number;
  reconnects: number;
  minBattery: number;
}

export interface StreamSession {
  sessionId: string;
  deviceId: string;
  cameraId: string;
  mobileUserId: string;
  startedAt: string;
  endedAt?: string;
  endReason?: string;
  publishTokenJti: string;
  nodeId: string;
  stats: StreamSessionStats;
  gpsTrackRef?: string;
}

export interface MobileInvite {
  inviteId: string;
  codeHash: string;
  code?: string;
  siteId: string;
  createdBy: string;
  expiresAt: string;
  maxUses: number;
  usedCount: number;
  autoApprove: boolean;
  allowedEmailDomains?: string[];
  revokedAt?: string;
  createdAt: string;
}

// ================= DTOs =================

export const MobileRegisterSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  password: z.string().min(10, 'Password must be at least 10 characters'),
  inviteCode: z.string().optional(),
  consentAccepted: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the surveillance and streaming consent' }),
  }),
  captchaToken: z.string().optional(),
});

export type MobileRegisterDto = z.infer<typeof MobileRegisterSchema>;

export const MobileVerifySchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

export type MobileVerifyDto = z.infer<typeof MobileVerifySchema>;

export const MobileLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  otp: z.string().optional(),
});

export type MobileLoginDto = z.infer<typeof MobileLoginSchema>;

export const MobileResendOtpSchema = z.object({
  email: z.string().email(),
});

export type MobileResendOtpDto = z.infer<typeof MobileResendOtpSchema>;

export const MobileAddDeviceSchema = z.object({
  label: z.string().min(1, 'Device label is required'),
  platform: z.string().default('unknown'),
  browser: z.string().default('unknown'),
  defaultFacing: z.enum(['environment', 'user']).default('environment'),
  shareGps: z.boolean().default(false),
  consentConfirmed: z.literal(true, {
    errorMap: () => ({ message: 'Consent confirmation is required for camera streaming' }),
  }),
});

export type MobileAddDeviceDto = z.infer<typeof MobileAddDeviceSchema>;

export const SessionHeartbeatSchema = z.object({
  battery: z.number().min(0).max(100),
  charging: z.boolean().default(false),
  networkType: z.string().default('wifi'),
  rttMs: z.number().default(0),
  bitrateKbps: z.number().default(0),
  fps: z.number().default(0),
  gps: z
    .object({
      lat: z.number(),
      lng: z.number(),
      accuracyM: z.number(),
      speed: z.number().optional(),
      heading: z.number().optional(),
      ts: z.string(),
    })
    .optional(),
});

export type SessionHeartbeatDto = z.infer<typeof SessionHeartbeatSchema>;

export const AdminCreateInviteSchema = z.object({
  siteId: z.string().min(1, 'Site ID is required'),
  expiresInHours: z.number().min(1).max(720).default(72),
  maxUses: z.number().min(1).default(10),
  autoApprove: z.boolean().default(false),
  allowedEmailDomains: z.array(z.string()).optional(),
});

export type AdminCreateInviteDto = z.infer<typeof AdminCreateInviteSchema>;
