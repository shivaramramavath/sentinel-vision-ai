import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  Role,
  Permission,
  ROLE_KEYS,
  ROLE_META,
  ROLE_PERMISSIONS,
  normalizeRole,
  getPermissionsForRole,
  roleHasPermission,
} from '@sentinel/shared-types';
import { User, UserDocument } from '../users/schemas/user.schema';
import { RedisService } from '../common/redis/redis.service';
import { PolicyService } from './services/policy.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly redisService: RedisService,
    private readonly policyService: PolicyService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Return effective permissions for a user including active break-glass overrides.
   */
  async getUserEffectivePermissions(
    userId: string,
    rawRole: string,
  ): Promise<{
    role: Role;
    permissions: Permission[];
    isBreakGlass: boolean;
    expiresAt?: string;
  }> {
    const role = normalizeRole(rawRole);
    const basePermissions = [...getPermissionsForRole(role)];

    const breakGlass = await this.policyService.getActiveBreakGlassSession(userId);
    if (breakGlass.active) {
      // In emergency break-glass, temporary investigator permissions are granted
      const elevatedPermissions = getPermissionsForRole('investigator');
      const merged = Array.from(new Set([...basePermissions, ...elevatedPermissions]));
      return {
        role,
        permissions: merged,
        isBreakGlass: true,
        expiresAt: breakGlass.expiresAt,
      };
    }

    return {
      role,
      permissions: basePermissions,
      isBreakGlass: false,
    };
  }

  /**
   * Check if a set of user permissions satisfies a required permission.
   * Handles exact match and resource wildcard (e.g. 'cases:*' satisfies 'cases:read').
   */
  hasPermission(userPermissions: readonly Permission[], required: Permission): boolean {
    if (userPermissions.includes(required)) {
      return true;
    }

    const [resource] = required.split(':');
    const wildcard = `${resource}:*` as any;
    if (userPermissions.includes(wildcard)) {
      return true;
    }

    return false;
  }

  /**
   * Bump user permVersion in Redis to invalidate their active token / session.
   * Downstream requests with older permVersion will receive 401 TOKEN_STALE.
   */
  async bumpUserPermVersion(userId: string): Promise<number> {
    const key = `user:permVersion:${userId}`;
    let newVersion = 1;
    if (this.redisService.isHealthy()) {
      newVersion = await this.redisService.incr(key);
      await this.redisService.publish('rbac:permVersion:changed', JSON.stringify({ userId, permVersion: newVersion }));
    }
    return newVersion;
  }

  /**
   * Change a user's role.
   * Requires step-up and 4-eyes approval if promoting to super_admin.
   */
  async assignUserRole(
    actor: { id: string; email: string; role: Role },
    targetUserId: string,
    newRoleInput: string,
    reason: string,
    fourEyesApproverId?: string,
  ): Promise<{ message: string; user: { id: string; email: string; role: Role } }> {
    const newRole = normalizeRole(newRoleInput);

    const targetUser = await this.userModel.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundException(`User with ID ${targetUserId} not found`);
    }

    const oldRole = normalizeRole(targetUser.role);
    if (oldRole === newRole) {
      return {
        message: `User is already assigned to role ${newRole}`,
        user: { id: String(targetUser._id), email: targetUser.email, role: newRole },
      };
    }

    // Four-eyes rule for promoting to super_admin
    if (newRole === 'super_admin') {
      if (!fourEyesApproverId) {
        throw new ForbiddenException(
          'Four-eyes approval required: promoting an account to super_admin requires a second authorized approver ID.',
        );
      }

      const approver = await this.userModel.findById(fourEyesApproverId);
      if (!approver) {
        throw new BadRequestException('Four-eyes approver user record not found.');
      }

      const fourEyesCheck = this.policyService.validateFourEyes(
        'promote_to_super_admin',
        actor.id,
        String(approver._id),
        normalizeRole(approver.role),
      );

      if (!fourEyesCheck.valid) {
        throw new ForbiddenException(fourEyesCheck.reason);
      }
    }

    // Apply role change
    targetUser.role = newRole;
    await targetUser.save();

    // Bump permVersion so the user's active session is flagged TOKEN_STALE
    await this.bumpUserPermVersion(targetUserId);

    // Audit log
    await this.auditService.recordLog({
      actor: { userId: actor.id, email: actor.email, role: actor.role },
      action: 'user.role.assigned',
      entity: { type: 'User', id: targetUserId },
      correlationId: 'assign-role',
      metadata: {
        oldRole,
        newRole,
        reason,
        fourEyesApproverId: fourEyesApproverId || null,
      },
    });

    this.logger.log(
      `Role updated for user ${targetUser.email} (${targetUserId}) from ${oldRole} to ${newRole} by ${actor.email}`,
    );

    return {
      message: `User role successfully updated to ${newRole}`,
      user: { id: String(targetUser._id), email: targetUser.email, role: newRole },
    };
  }

  /**
   * Issue a step-up token valid for 5 minutes.
   */
  async issueStepUpToken(userId: string, sessionId?: string): Promise<{ stepUpToken: string; expiresIn: number }> {
    const secret =
      this.configService.get<string>('auth.jwtAccessSecret') ||
      this.configService.get<string>('app.jwtAccessSecret') ||
      'dev-secret-step-up';

    const expiresIn = 300; // 5 minutes

    const stepUpToken = await this.jwtService.signAsync(
      {
        sub: userId,
        purpose: 'step-up',
        sessionId,
      },
      {
        secret,
        expiresIn: `${expiresIn}s`,
      },
    );

    if (sessionId && this.redisService.isHealthy()) {
      const redisKey = `stepup:session:${userId}:${sessionId}`;
      await this.redisService.set(redisKey, 'valid', expiresIn);
    }

    return { stepUpToken, expiresIn };
  }

  /**
   * Validate a step-up token or active session.
   */
  async validateStepUp(userId: string, sessionId?: string, headerToken?: string): Promise<boolean> {
    // 1. Check Redis session step-up key if available
    if (sessionId && this.redisService.isHealthy()) {
      const redisKey = `stepup:session:${userId}:${sessionId}`;
      const valid = await this.redisService.get(redisKey);
      if (valid === 'valid') {
        return true;
      }
    }

    // 2. Check header JWT token
    if (headerToken) {
      try {
        const cleanToken = headerToken.replace(/^Bearer\s+/i, '');
        const secret =
          this.configService.get<string>('auth.jwtAccessSecret') ||
          this.configService.get<string>('app.jwtAccessSecret') ||
          'dev-secret-step-up';

        const payload = await this.jwtService.verifyAsync(cleanToken, { secret });
        if (payload.purpose === 'step-up' && payload.sub === userId) {
          return true;
        }
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Return metadata for all roles.
   */
  getRolesMeta() {
    return ROLE_KEYS.map((key) => ({
      ...ROLE_META[key],
      permissions: ROLE_PERMISSIONS[key],
    }));
  }

  /**
   * Return full role-permissions matrix.
   */
  getRoleMatrix() {
    return {
      roles: ROLE_KEYS,
      matrix: ROLE_PERMISSIONS,
      metadata: ROLE_META,
    };
  }
}
