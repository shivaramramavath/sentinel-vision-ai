import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Session, SessionDocument } from '../auth/schemas/session.schema';
import { AuditService } from '../audit/audit.service';

export interface CreateAdminParams {
  email: string;
  password: string;
  name?: string;
  badgeNumber?: string;
  department?: string;
  mustChangePassword?: boolean;
  mfaEnrollmentRequired?: boolean;
}

export interface ResetAdminPasswordParams {
  email: string;
  newPassword: string;
  actorEmail?: string;
}

@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const isEnabled =
      this.configService.get<boolean>('admin.bootstrapEnabled') ??
      process.env.ADMIN_BOOTSTRAP_ENABLED === 'true';

    if (!isEnabled) {
      this.logger.log('Admin bootstrap disabled via configuration');
      return;
    }

    await this.bootstrapFromEnv();
  }

  /**
   * Idempotently provision the bootstrap Super Admin using environment variables.
   */
  async bootstrapFromEnv(): Promise<void> {
    const email = (
      this.configService.get<string>('admin.email') ||
      process.env.ADMIN_EMAIL ||
      ''
    )
      .trim()
      .toLowerCase();

    const password =
      this.configService.get<string>('admin.password') ||
      process.env.ADMIN_PASSWORD ||
      '';

    if (!email || !password) {
      this.logger.warn('Admin bootstrap enabled but ADMIN_EMAIL or ADMIN_PASSWORD is empty; skipping.');
      return;
    }

    const domain = email.includes('@') ? email.split('@')[1] : 'unknown';
    this.logger.log(`Executing admin bootstrap check for domain @${domain}...`);

    const name =
      this.configService.get<string>('admin.name') ||
      process.env.ADMIN_NAME ||
      'System Administrator';

    const badgeNumber =
      this.configService.get<string>('admin.badgeNumber') ||
      process.env.ADMIN_BADGE_NUMBER ||
      'SA-0001';

    const department =
      this.configService.get<string>('admin.department') ||
      process.env.ADMIN_DEPARTMENT ||
      'Platform Administration';

    const mustChangePassword =
      this.configService.get<boolean>('admin.mustChangePassword') ??
      process.env.ADMIN_MUST_CHANGE_PASSWORD !== 'false';

    const mfaEnrollmentRequired =
      this.configService.get<boolean>('admin.requireMfaSetup') ??
      process.env.ADMIN_REQUIRE_MFA_SETUP !== 'false';

    const forcePasswordReset =
      this.configService.get<boolean>('admin.forcePasswordReset') ??
      process.env.ADMIN_FORCE_PASSWORD_RESET === 'true';

    const promoteExisting =
      this.configService.get<boolean>('admin.promoteExisting') ??
      process.env.ADMIN_PROMOTE_EXISTING === 'true';

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
    });

    const now = new Date();

    // Atomic insert-if-absent using unique email index and $setOnInsert
    try {
      const res: any = await this.userModel.findOneAndUpdate(
        { email },
        {
          $setOnInsert: {
            email,
            passwordHash,
            fullName: name,
            badgeNumber,
            department,
            role: 'super_admin',
            status: 'active',
            active: true,
            emailVerifiedAt: now,
            mustChangePassword,
            mfaEnrollmentRequired,
            createdVia: 'bootstrap',
            failedLoginCount: 0,
            mfa: { enabled: false, recoveryCodesHashed: [] },
          },
        },
        { upsert: true, new: false, rawResult: true },
      );

      const wasInserted = res?.lastErrorObject
        ? !res.lastErrorObject.updatedExisting
        : (!res || (res.value === null && !res._id));

      if (wasInserted) {
        const createdUser = await this.userModel.findOne({ email });
        const actorId = String(createdUser?._id || 'bootstrap');

        await this.auditService.recordLog({
          actor: { userId: actorId, email: `bootstrap@${domain}`, role: 'super_admin' },
          action: 'admin.bootstrap.create',
          entity: { type: 'User', id: actorId },
          correlationId: 'admin-bootstrap-create',
          metadata: { domain, role: 'super_admin', createdVia: 'bootstrap' },
        });

        this.logger.log(`Bootstrap super_admin created successfully for domain @${domain}.`);
        return;
      }
    } catch (err: any) {
      if (err.code !== 11000) {
        throw err;
      }
      // Duplicate key error 11000 from race condition: already inserted by another worker
    }

    // Existing user found
    const existingUser = await this.userModel.findOne({ email });
    if (!existingUser) return;

    const isSuperAdmin =
      existingUser.role === 'super_admin' || existingUser.role === 'Super Admin';

    if (!isSuperAdmin) {
      if (!promoteExisting) {
        this.logger.warn(
          `Account for domain @${domain} exists with role '${existingUser.role}'. ADMIN_PROMOTE_EXISTING is false; skipping promotion.`,
        );
        return;
      }

      // Promote existing user to super_admin
      const prevRole = existingUser.role;
      existingUser.role = 'super_admin';
      existingUser.status = 'active';
      existingUser.active = true;
      if (!existingUser.passwordHash) {
        existingUser.passwordHash = passwordHash;
      }
      existingUser.mustChangePassword = mustChangePassword;
      existingUser.mfaEnrollmentRequired = mfaEnrollmentRequired;
      if (!existingUser.badgeNumber) existingUser.badgeNumber = badgeNumber;
      if (!existingUser.department) existingUser.department = department;
      await existingUser.save();

      await this.auditService.recordLog({
        actor: { userId: String(existingUser._id), email: `bootstrap@${domain}`, role: 'super_admin' },
        action: 'admin.bootstrap.promote',
        entity: { type: 'User', id: String(existingUser._id) },
        correlationId: 'admin-bootstrap-promote',
        metadata: { domain, previousRole: prevRole, promotedTo: 'super_admin' },
      });

      this.logger.log(`Existing user for domain @${domain} promoted to super_admin.`);
      return;
    }

    // User is already a Super Admin: only overwrite password if ADMIN_FORCE_PASSWORD_RESET=true
    if (forcePasswordReset) {
      existingUser.passwordHash = passwordHash;
      existingUser.mustChangePassword = true;
      await existingUser.save();

      // Revoke all existing sessions
      const revokedResult = await this.sessionModel.updateMany(
        { userId: existingUser._id, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date(), revokedReason: 'ADMIN_FORCE_PASSWORD_RESET' } },
      );

      await this.auditService.recordLog({
        actor: { userId: String(existingUser._id), email: `bootstrap@${domain}`, role: 'super_admin' },
        action: 'admin.bootstrap.password_reset',
        entity: { type: 'User', id: String(existingUser._id) },
        correlationId: 'admin-bootstrap-force-reset',
        metadata: { domain, sessionsRevokedCount: revokedResult.modifiedCount },
      });

      this.logger.log(
        `Forced password reset and revoked ${revokedResult.modifiedCount} sessions for super_admin on domain @${domain}.`,
      );
    } else {
      this.logger.log(`Super admin already exists for domain @${domain}; idempotent no-op.`);
    }
  }

  /**
   * CLI helper: Create a super_admin account.
   */
  async createAdmin(params: CreateAdminParams): Promise<UserDocument> {
    const email = params.email.trim().toLowerCase();
    const domain = email.includes('@') ? email.split('@')[1] : 'unknown';

    const existing = await this.userModel.findOne({ email });
    if (existing) {
      throw new ConflictException(`User with email domain @${domain} already exists.`);
    }

    const passwordHash = await argon2.hash(params.password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
    });

    const user = new this.userModel({
      email,
      fullName: params.name || 'System Administrator',
      passwordHash,
      badgeNumber: params.badgeNumber || 'SA-0001',
      department: params.department || 'Platform Administration',
      role: 'super_admin',
      status: 'active',
      active: true,
      emailVerifiedAt: new Date(),
      mustChangePassword: params.mustChangePassword ?? true,
      mfaEnrollmentRequired: params.mfaEnrollmentRequired ?? true,
      createdVia: 'bootstrap',
      failedLoginCount: 0,
      mfa: { enabled: false, recoveryCodesHashed: [] },
    });

    const saved = await user.save();

    await this.auditService.recordLog({
      actor: { userId: String(saved._id), email: `cli@${domain}`, role: 'super_admin' },
      action: 'admin.bootstrap.create',
      entity: { type: 'User', id: String(saved._id) },
      correlationId: 'cli-admin-create',
      metadata: { domain, source: 'cli' },
    });

    this.logger.log(`CLI: Created super_admin user for domain @${domain}.`);
    return saved;
  }

  /**
   * CLI helper: Reset an admin password and revoke sessions.
   */
  async resetAdminPassword(params: ResetAdminPasswordParams): Promise<void> {
    const email = params.email.trim().toLowerCase();
    const domain = email.includes('@') ? email.split('@')[1] : 'unknown';

    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new NotFoundException(`No account found for domain @${domain}.`);
    }

    const isSuperAdmin = user.role === 'super_admin' || user.role === 'Super Admin';
    if (!isSuperAdmin) {
      throw new BadRequestException(`User is not a Super Admin account.`);
    }

    const passwordHash = await argon2.hash(params.newPassword, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
    });

    user.passwordHash = passwordHash;
    user.mustChangePassword = true;
    await user.save();

    const revokedResult = await this.sessionModel.updateMany(
      { userId: user._id, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date(), revokedReason: 'CLI_ADMIN_PASSWORD_RESET' } },
    );

    await this.auditService.recordLog({
      actor: { userId: String(user._id), email: `cli@${domain}`, role: 'super_admin' },
      action: 'admin.bootstrap.password_reset',
      entity: { type: 'User', id: String(user._id) },
      correlationId: 'cli-admin-reset-password',
      metadata: { domain, sessionsRevokedCount: revokedResult.modifiedCount, source: 'cli' },
    });

    this.logger.log(`CLI: Reset password and revoked sessions for domain @${domain}.`);
  }

  /**
   * Safety guard: Refuse to suspend, delete or demote the last active super_admin (returns 409).
   */
  async assertNotLastActiveSuperAdmin(userId: string, action: 'suspend' | 'delete' | 'demote'): Promise<void> {
    const targetUser = await this.userModel.findById(userId);
    if (!targetUser) return;

    const isSuperAdmin =
      targetUser.role === 'super_admin' || targetUser.role === 'Super Admin';
    const isActive = targetUser.status === 'active' && targetUser.active !== false;

    if (isSuperAdmin && isActive) {
      const activeSuperAdminCount = await this.userModel.countDocuments({
        role: { $in: ['super_admin', 'Super Admin'] },
        status: 'active',
        active: { $ne: false },
      });

      if (activeSuperAdminCount <= 1) {
        throw new ConflictException(
          `Cannot ${action} the last active Super Admin account. Operation refused to prevent administrative lockout.`,
        );
      }
    }
  }
}
