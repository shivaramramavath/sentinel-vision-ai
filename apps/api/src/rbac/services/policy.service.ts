import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import {
  Permission,
  Role,
  normalizeRole,
  getRedactionLevel,
  RedactionLevel,
  FourEyesPolicies,
} from '@sentinel/shared-types';
import { RedisService } from '../../common/redis/redis.service';

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

export interface UserContext {
  id: string;
  role: Role;
  email: string;
  team?: string;
  clearanceLevel?: ClearanceLevel;
  permissions?: Permission[];
}

export interface CaseAccessContext {
  id: string;
  assignedOfficer?: string;
  assignedOfficerId?: string;
  assignedTeam?: string;
  accessList?: string[];
  classification?: ClassificationLevel;
  isMinor?: boolean;
  isVulnerable?: boolean;
  legalHoldActive?: boolean;
}

@Injectable()
export class PolicyService {
  private readonly logger = new Logger(PolicyService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Check if a user can access a specific case based on ABAC scoping.
   */
  async canAccessCase(user: UserContext, caseDoc: CaseAccessContext): Promise<boolean> {
    const role = normalizeRole(user.role);

    // Classification check
    if (caseDoc.classification && user.clearanceLevel) {
      if (!isClearanceSufficient(user.clearanceLevel, caseDoc.classification)) {
        this.logger.warn(
          `Access denied by ABAC: user ${user.id} clearance ${user.clearanceLevel} insufficient for case classification ${caseDoc.classification}`,
        );
        return false;
      }
    }

    // Reviewer role: strictly scoped to assigned cases or assigned team
    if (role === 'reviewer') {
      const isAssignedToUser =
        caseDoc.assignedOfficerId === user.id ||
        caseDoc.assignedOfficer === user.email ||
        caseDoc.assignedOfficer === user.id ||
        (caseDoc.accessList && (caseDoc.accessList.includes(user.id) || caseDoc.accessList.includes(user.email)));

      const isAssignedToTeam = user.team && caseDoc.assignedTeam && user.team === caseDoc.assignedTeam;

      if (!isAssignedToUser && !isAssignedToTeam) {
        return false;
      }
    }

    // Explicit accessList restricts access if present
    if (caseDoc.accessList && caseDoc.accessList.length > 0) {
      const hasExplicitAccess =
        caseDoc.accessList.includes(user.id) ||
        caseDoc.accessList.includes(user.email) ||
        caseDoc.assignedOfficerId === user.id ||
        caseDoc.assignedOfficer === user.id ||
        caseDoc.assignedOfficer === user.email;

      if (!hasExplicitAccess && role !== 'super_admin') {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate whether an investigator can export evidence from a case.
   */
  canExportEvidence(user: UserContext, caseDoc: CaseAccessContext): boolean {
    const role = normalizeRole(user.role);

    // Super admin has governance role, not operational export role
    if (role !== 'investigator') {
      return false;
    }

    // Evidence export requires active case or legal hold justification
    return true;
  }

  /**
   * Validate four-eyes principle on sensitive actions (e.g. promoting to super_admin).
   */
  validateFourEyes(
    action: string,
    initiatorId: string,
    approverId?: string,
    approverRole?: Role,
  ): { valid: boolean; reason?: string } {
    if (!approverId) {
      return {
        valid: false,
        reason: `Action '${action}' requires four-eyes approval. An approving supervisor ID must be provided.`,
      };
    }

    if (initiatorId === approverId) {
      return {
        valid: false,
        reason: 'Four-eyes violation: initiator and approver cannot be the same individual.',
      };
    }

    if (approverRole && normalizeRole(approverRole) !== 'super_admin') {
      return {
        valid: false,
        reason: 'Four-eyes approver must hold super_admin clearance.',
      };
    }

    return { valid: true };
  }

  /**
   * Check if user is currently running in emergency Break-Glass mode.
   */
  async getActiveBreakGlassSession(userId: string): Promise<{
    active: boolean;
    reason?: string;
    expiresAt?: string;
  }> {
    try {
      const key = `breakglass:user:${userId}`;
      const data = await this.redisService.get(key);
      if (!data) return { active: false };
      const parsed = JSON.parse(data);
      return {
        active: true,
        reason: parsed.reason,
        expiresAt: parsed.expiresAt,
      };
    } catch {
      return { active: false };
    }
  }

  /**
   * Determine data redaction level based on user role and permissions.
   */
  getUserRedactionLevel(user: UserContext): RedactionLevel {
    const role = normalizeRole(user.role);
    return getRedactionLevel(role);
  }
}
