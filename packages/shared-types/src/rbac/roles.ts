/**
 * Canonical Role definitions for Sentinel Vision AI.
 * SINGLE SOURCE OF TRUTH — do not redefine or hardcode role strings elsewhere.
 */

export const ROLE_KEYS = [
  'super_admin',
  'investigator',
  'reviewer',
  'viewer',
  'mobile_operator',
] as const;

export type Role = (typeof ROLE_KEYS)[number];

export type RoleRealm = 'staff' | 'mobile';
export type MfaPolicy = 'required' | 'optional' | 'adaptive';

export interface RoleMetadata {
  key: Role;
  label: string;
  realm: RoleRealm;
  landing: string;
  description: string;
  mfaPolicy: MfaPolicy;
  maxSessions: number;
  idleTimeoutMinutes: number;
  absoluteTimeoutHours: number;
}

export type RoleMeta = RoleMetadata;

export const ROLE_META: Record<Role, RoleMetadata> = {
  super_admin: {
    key: 'super_admin',
    label: 'Super Admin',
    realm: 'staff',
    landing: '/dashboard',
    description: 'System administration, security oversight, audit reviews and global policy configuration.',
    mfaPolicy: 'required',
    maxSessions: 3,
    idleTimeoutMinutes: 15,
    absoluteTimeoutHours: 12,
  },
  investigator: {
    key: 'investigator',
    label: 'Investigator',
    realm: 'staff',
    landing: '/dashboard',
    description: 'Active case management, AI multimodal search, sighting decisions and full evidence custody handling.',
    mfaPolicy: 'required',
    maxSessions: 5,
    idleTimeoutMinutes: 30,
    absoluteTimeoutHours: 24,
  },
  reviewer: {
    key: 'reviewer',
    label: 'Reviewer',
    realm: 'staff',
    landing: '/review',
    description: 'Sighting candidate verification, assigned dossier inspection, and read-only case evidence review.',
    mfaPolicy: 'required',
    maxSessions: 3,
    idleTimeoutMinutes: 30,
    absoluteTimeoutHours: 24,
  },
  viewer: {
    key: 'viewer',
    label: 'Viewer',
    realm: 'staff',
    landing: '/cases',
    description: 'Read-only stakeholder access to non-restricted dossiers, approved reports and confirmed journey hops.',
    mfaPolicy: 'optional',
    maxSessions: 2,
    idleTimeoutMinutes: 60,
    absoluteTimeoutHours: 24,
  },
  mobile_operator: {
    key: 'mobile_operator',
    label: 'Mobile Operator',
    realm: 'mobile',
    landing: '/m/stream',
    description: 'Dedicated field operator authorized strictly for mobile device registration and video ingestion streaming.',
    mfaPolicy: 'required',
    maxSessions: 1,
    idleTimeoutMinutes: 120,
    absoluteTimeoutHours: 720,
  },
};

/**
 * Legacy role mappings to canonical modern role keys.
 * Used for database migrations, backward-compatibility lookups, and session normalization.
 */
export const LEGACY_ROLE_MAP: Record<string, Role> = {
  // Canonical keys
  super_admin: 'super_admin',
  investigator: 'investigator',
  reviewer: 'reviewer',
  viewer: 'viewer',
  mobile_operator: 'mobile_operator',

  // Title-case legacy
  'Super Admin': 'super_admin',
  Investigator: 'investigator',
  Reviewer: 'reviewer',
  Viewer: 'viewer',
  'Mobile Operator': 'mobile_operator',

  // Legacy single-word synonyms
  admin: 'super_admin',
  supervisor: 'reviewer',
  operator: 'mobile_operator',
  analyst: 'investigator',

  // Case-insensitive variants
  ADMIN: 'super_admin',
  SUPERVISOR: 'reviewer',
  INVESTIGATOR: 'investigator',
  OPERATOR: 'mobile_operator',
  REVIEWER: 'reviewer',
  ANALYST: 'investigator',
  VIEWER: 'viewer',
  MOBILE_OPERATOR: 'mobile_operator',
};

/**
 * Normalizes any legacy, title-cased, or synonym role string into the canonical Role key.
 * Defaults to 'viewer' for unrecognized or empty inputs.
 */
export function normalizeRole(value: unknown): Role {
  if (typeof value !== 'string') return 'viewer';
  const trimmed = value.trim();
  if (LEGACY_ROLE_MAP[trimmed]) {
    return LEGACY_ROLE_MAP[trimmed];
  }
  const normalizedKey = trimmed.toLowerCase().replace(/[\s-]+/g, '_');
  if (LEGACY_ROLE_MAP[normalizedKey]) {
    return LEGACY_ROLE_MAP[normalizedKey];
  }
  return 'viewer';
}

/**
 * Returns human-readable label for a role.
 */
export function roleLabel(role: Role | string): string {
  const canonical = normalizeRole(role);
  return ROLE_META[canonical]?.label || canonical;
}

/**
 * Check whether a role belongs to the staff realm.
 */
export function isStaffRole(role: Role | string): boolean {
  return ROLE_META[normalizeRole(role)]?.realm === 'staff';
}

/**
 * Check whether a role belongs to the mobile realm.
 */
export function isMobileRole(role: Role | string): boolean {
  return ROLE_META[normalizeRole(role)]?.realm === 'mobile';
}
