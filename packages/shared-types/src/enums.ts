import { Role } from './rbac';
/**
 * Embedding kind — face and Re-ID are strictly separate feature spaces.
 * NEVER concatenate or mix these two kinds.
 */
export const EmbeddingKind = {
  FACE: 'face',
  REID: 'reid',
} as const;
export type EmbeddingKind = (typeof EmbeddingKind)[keyof typeof EmbeddingKind];

export const CaseStatus = {
  ACTIVE: 'active',
  CLOSED: 'closed',
  SUSPENDED: 'suspended',
} as const;
export type CaseStatus = (typeof CaseStatus)[keyof typeof CaseStatus];

export const SightingStatus = {
  PENDING_REVIEW: 'pending_review',
  CONFIRMED_SIGHTING: 'confirmed_sighting',
  REJECTED: 'rejected',
} as const;
export type SightingStatus = (typeof SightingStatus)[keyof typeof SightingStatus];

/**
 * Confidence is expressed as an ordinal band — never as a raw percentage.
 * UI must display "Possible match" and the band, never a numeric score.
 */
export const ConfidenceBand = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;
export type ConfidenceBand = (typeof ConfidenceBand)[keyof typeof ConfidenceBand];

export const CameraStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ERROR: 'error',
} as const;
export type CameraStatus = (typeof CameraStatus)[keyof typeof CameraStatus];

export const AlertStatus = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
} as const;
export type AlertStatus = (typeof AlertStatus)[keyof typeof AlertStatus];

export const UserRole = {
  SUPER_ADMIN: 'super_admin',
  INVESTIGATOR: 'investigator',
  REVIEWER: 'reviewer',
  VIEWER: 'viewer',
  MOBILE_OPERATOR: 'mobile_operator',
  ADMIN: 'super_admin',
  OPERATOR: 'investigator',
  ANALYST: 'reviewer',
} as const;
export type UserRole = Role;

export const Sex = {
  MALE: 'male',
  FEMALE: 'female',
  UNKNOWN: 'unknown',
} as const;
export type Sex = (typeof Sex)[keyof typeof Sex];
