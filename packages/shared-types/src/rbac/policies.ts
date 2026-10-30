import { Role } from './roles';
import { Permission } from './permissions';

/**
 * ABAC Policy & Context Definitions for Sentinel Vision AI.
 */

export type ClearanceLevel = 'standard' | 'confidential' | 'restricted' | 'top_secret';
export type ClassificationLevel = 'standard' | 'confidential' | 'restricted' | 'top_secret';

const CLEARANCE_RANK: Record<string, number> = {
  standard: 1,
  confidential: 2,
  restricted: 3,
  top_secret: 4,
};

export function isClearanceSufficient(userClearance: string, requiredClassification: string): boolean {
  const userRank = CLEARANCE_RANK[userClearance] || 1;
  const targetRank = CLEARANCE_RANK[requiredClassification] || 1;
  return userRank >= targetRank;
}

export type RedactionLevel = 'none' | 'masked_pii' | 'metadata_only' | 'full';

export interface AbacUserContext {
  id: string;
  role: Role;
  email: string;
  team?: string;
  department?: string;
  badgeNumber?: string;
  clearanceLevel?: 'standard' | 'confidential' | 'restricted' | 'top_secret';
  assignedCaseIds?: string[];
  stepUpVerifiedAt?: Date | null;
  breakGlassActive?: boolean;
}

export interface AbacResourceContext {
  resourceType: 'case' | 'sighting' | 'evidence' | 'report' | 'camera' | 'threshold' | 'user';
  id: string;
  creatorId?: string;
  assignedOfficerId?: string;
  assignedOfficerIds?: string[];
  accessList?: string[];
  siteId?: string;
  isRestricted?: boolean;
  isMinor?: boolean;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  generatorId?: string;
  targetUserId?: string;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  code?: 'PERMISSION_DENIED' | 'FOUR_EYES_VIOLATION' | 'STEP_UP_REQUIRED' | 'BREAK_GLASS_AVAILABLE' | 'SCOPE_RESTRICTED';
  reason?: string;
  redactionLevel?: RedactionLevel;
}

/**
 * Check four-eyes rules:
 */
export const FourEyesPolicies = {
  /**
   * User cannot be the sole decider on a Critical case they registered.
   */
  canDecideSighting(user: AbacUserContext, sightingCase?: AbacResourceContext): PolicyEvaluationResult {
    if (sightingCase?.priority === 'critical' && sightingCase.creatorId && sightingCase.creatorId === user.id) {
      return {
        allowed: false,
        code: 'FOUR_EYES_VIOLATION',
        reason: 'Four-eyes policy: You registered this critical case and cannot be the sole verifying adjudicator.',
      };
    }
    return { allowed: true };
  },

  /**
   * Report approver must differ from report generator.
   */
  canApproveReport(user: AbacUserContext, report?: AbacResourceContext): PolicyEvaluationResult {
    if (report?.generatorId && report.generatorId === user.id) {
      return {
        allowed: false,
        code: 'FOUR_EYES_VIOLATION',
        reason: 'Four-eyes policy: The officer approving a dossier report cannot be the same officer who generated it.',
      };
    }
    return { allowed: true };
  },

  /**
   * Nobody approves or changes their own role or administrative clearance.
   */
  canModifyUserRole(actor: AbacUserContext, targetUserId: string): PolicyEvaluationResult {
    if (actor.id === targetUserId) {
      return {
        allowed: false,
        code: 'FOUR_EYES_VIOLATION',
        reason: 'Self-authorization forbidden: You cannot modify your own administrative role.',
      };
    }
    return { allowed: true };
  },

  /**
   * Super Admin grants strictly require second admin approval confirmation.
   */
  requiresDualAdminForSuperAdminPromotion(
    targetNewRole: Role,
    secondAdminApproved: boolean,
  ): PolicyEvaluationResult {
    if (targetNewRole === 'super_admin' && !secondAdminApproved) {
      return {
        allowed: false,
        code: 'FOUR_EYES_VIOLATION',
        reason: 'Dual-administrator policy: Granting Super Admin credentials strictly requires confirmation from a second active administrator.',
      };
    }
    return { allowed: true };
  },

  /**
   * Live threshold activation requires dual administrator authorization.
   */
  canActivateThreshold(actor: AbacUserContext, proposedByAdminId?: string): PolicyEvaluationResult {
    if (proposedByAdminId && proposedByAdminId === actor.id) {
      return {
        allowed: false,
        code: 'FOUR_EYES_VIOLATION',
        reason: 'Dual-administrator policy: You proposed this threshold modification. A second administrator must review and activate it.',
      };
    }
    return { allowed: true };
  },
};

/**
 * Determine data redaction level by role and context.
 */
export function getRedactionLevel(role: Role, isMinor = false, isRestricted = false): RedactionLevel {
  if (role === 'viewer') {
    return 'masked_pii';
  }
  if (role === 'reviewer') {
    return isRestricted ? 'masked_pii' : 'none';
  }
  if (role === 'super_admin') {
    // Super admins have oversight without raw operational PII by default unless break-glass
    return isMinor || isRestricted ? 'masked_pii' : 'none';
  }
  return 'none';
}

/**
 * Step-up authentication configuration
 */
export const STEP_UP_REQUIRED_ACTIONS: Permission[] = [
  'evidence:export',
  'evidence:legal_hold',
  'roles:manage',
  'users:manage',
  'thresholds:approve',
  'retention:manage',
  'apikeys:manage',
];

export function isStepUpAction(permission: Permission): boolean {
  return STEP_UP_REQUIRED_ACTIONS.includes(permission);
}

/**
 * Break-Glass Emergency Access Specification
 */
export interface BreakGlassSession {
  sessionId: string;
  userId: string;
  targetResourceId: string;
  reason: string;
  justificationNotes: string;
  activatedAt: Date;
  expiresAt: Date;
  supervisorsNotified: string[];
}
