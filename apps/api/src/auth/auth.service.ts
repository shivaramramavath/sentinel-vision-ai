import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as argon2 from 'argon2';
import { generateSecret, generateURI, verifySync } from 'otplib';
import * as QRCode from 'qrcode';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { AuthIdentity, AuthIdentityDocument } from './schemas/auth-identity.schema';
import { Session, SessionDocument } from './schemas/session.schema';
import { AuthToken, AuthTokenDocument } from './schemas/auth-token.schema';
import { Invite, InviteDocument } from './schemas/invite.schema';
import { RedisService } from '../common/redis/redis.service';
import { EmailService } from '../modules/email/email.service';
import { AuditService } from '../audit/audit.service';
import { validatePasswordPolicy } from './utils/password-policy.util';
import { RegisterDto } from './dto/register.dto';
import { CreateInviteDto, UpdateProfileDto } from './dto/auth-requests.dto';

export interface AuthTokens {
  accessToken: string;
  refreshTokenCookieValue: string;
  mustChangePassword?: boolean;
  mfaEnrollmentRequired?: boolean;
  user: {
    id: string;
    email: string;
    name?: string;
    fullName: string;
    role: UserRole;
    badgeNumber: string;
    department?: string;
    avatarUrl?: string;
    status: string;
    mfaEnabled: boolean;
    mustChangePassword?: boolean;
    mfaEnrollmentRequired?: boolean;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(AuthIdentity.name) private readonly identityModel: Model<AuthIdentityDocument>,
    @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(AuthToken.name) private readonly tokenModel: Model<AuthTokenDocument>,
    @InjectModel(Invite.name) private readonly inviteModel: Model<InviteDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService,
  ) {}

  private hashTokenSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  private hashIp(ip?: string): string {
    if (!ip) return '';
    return createHash('sha256').update(ip).digest('hex').substring(0, 16);
  }

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
    });
  }

  async verifyPassword(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  /**
   * Register a new operator / user account.
   */
  async register(dto: RegisterDto, correlationId = 'reg'): Promise<{ message: string; requiresVerification: boolean }> {
    const registrationEnabled = this.configService.get<boolean>('app.authRegistrationEnabled', true);
    if (!registrationEnabled) {
      throw new ForbiddenException('User registration is currently disabled by security policy.');
    }

    validatePasswordPolicy(dto.password, [dto.name, dto.email]);

    const email = dto.email.trim().toLowerCase();
    const allowedDomains = this.configService.get<string[]>('app.authAllowedEmailDomains') || [];
    if (allowedDomains.length > 0) {
      const domain = email.split('@')[1];
      if (!allowedDomains.includes(domain)) {
        throw new BadRequestException(`Email domain @${domain} is not authorized for registration.`);
      }
    }

    // Check existing
    const existing = await this.userModel.findOne({ email });
    if (existing) {
      // Generic response to prevent account enumeration
      return {
        message: 'If the credentials are valid, a verification link has been dispatched.',
        requiresVerification: true,
      };
    }

    let targetRole: UserRole = 'viewer';
    let autoApprove = false;

    // Check Invite
    if (dto.inviteCode) {
      const inviteHash = this.hashTokenSecret(dto.inviteCode.trim());
      const invite = await this.inviteModel.findOne({
        codeHash: inviteHash,
        expiresAt: { $gt: new Date() },
      });
      if (invite && invite.usedCount < invite.maxUses) {
        targetRole = invite.role as UserRole;
        autoApprove = invite.autoApprove;
        await this.inviteModel.updateOne({ _id: invite._id }, { $inc: { usedCount: 1 } });
      }
    }

    const passwordHash = await this.hashPassword(dto.password);
    const user = await this.userModel.create({
      email,
      fullName: dto.name,
      passwordHash,
      role: targetRole,
      status: 'pending_verification',
      createdVia: dto.inviteCode ? 'invite' : 'password',
      active: true,
    });

    // Generate single-use verification token (valid 24h)
    const plainToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashTokenSecret(plainToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.tokenModel.create({
      userId: user._id,
      tokenHash,
      purpose: 'verify_email',
      expiresAt,
    });

    // Enqueue verification email via BullMQ
    const webUrl = this.configService.get<string>('app.webUrl', 'http://localhost:3000');
    const verifyUrl = `${webUrl}/verify-email?token=${plainToken}`;

    await this.emailService.enqueue('verifyEmail', {
      name: user.fullName,
      email: user.email,
      verifyUrl,
      token: plainToken,
      expiresHours: 24,
    });

    await this.auditService.recordLog({
      actor: { userId: String(user._id), email: user.email, role: user.role },
      action: 'USER_REGISTERED',
      entity: { type: 'User', id: String(user._id) },
      correlationId,
      metadata: { createdVia: user.createdVia, targetRole },
    });

    return {
      message: 'Account registered successfully. Please verify your email to continue.',
      requiresVerification: true,
    };
  }

  /**
   * Verify email address using token.
   */
  async verifyEmail(plainToken: string, correlationId = 'verify'): Promise<{ status: string; message: string }> {
    const tokenHash = this.hashTokenSecret(plainToken.trim());
    const tokenDoc = await this.tokenModel.findOne({
      tokenHash,
      purpose: 'verify_email',
      usedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    });

    if (!tokenDoc) {
      throw new BadRequestException('Verification link is invalid or has expired.');
    }

    tokenDoc.usedAt = new Date();
    await tokenDoc.save();

    const user = await this.userModel.findById(tokenDoc.userId);
    if (!user) {
      throw new NotFoundException('Associated user account was not found.');
    }

    user.emailVerifiedAt = new Date();

    const requireApproval = this.configService.get<boolean>('app.authRequireAdminApproval', true);
    if (requireApproval && user.createdVia !== 'invite') {
      user.status = 'pending_approval';
      await user.save();

      // Enqueue welcomePendingApproval email
      await this.emailService.enqueue('welcomePendingApproval', {
        name: user.fullName,
        email: user.email,
      });

      await this.auditService.recordLog({
        actor: { userId: String(user._id), email: user.email, role: user.role },
        action: 'EMAIL_VERIFIED_PENDING_APPROVAL',
        entity: { type: 'User', id: String(user._id) },
        correlationId,
      });

      return {
        status: 'pending_approval',
        message: 'Your email has been verified. Your account is pending administrative authorization.',
      };
    }

    user.status = 'active';
    await user.save();

    await this.auditService.recordLog({
      actor: { userId: String(user._id), email: user.email, role: user.role },
      action: 'EMAIL_VERIFIED_ACTIVE',
      entity: { type: 'User', id: String(user._id) },
      correlationId,
    });

    return {
      status: 'active',
      message: 'Your email has been verified successfully. You may now sign in.',
    };
  }

  /**
   * Resend email verification link.
   */
  async resendVerification(email: string): Promise<{ message: string }> {
    const targetEmail = email.trim().toLowerCase();
    const user = await this.userModel.findOne({ email: targetEmail, status: 'pending_verification' });

    if (user) {
      // Invalidate existing tokens
      await this.tokenModel.deleteMany({ userId: user._id, purpose: 'verify_email' });

      const plainToken = randomBytes(32).toString('hex');
      const tokenHash = this.hashTokenSecret(plainToken);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await this.tokenModel.create({
        userId: user._id,
        tokenHash,
        purpose: 'verify_email',
        expiresAt,
      });

      const webUrl = this.configService.get<string>('app.webUrl', 'http://localhost:3000');
      const verifyUrl = `${webUrl}/verify-email?token=${plainToken}`;

      await this.emailService.enqueue('verifyEmail', {
        name: user.fullName,
        email: user.email,
        verifyUrl,
        token: plainToken,
        expiresHours: 24,
      });
    }

    return { message: 'If your account is pending verification, a new verification link has been dispatched.' };
  }

  /**
   * User login with password & optional TOTP MFA.
   */
  async login(
    email: string,
    pass: string,
    mfaCode?: string,
    meta?: { userAgent?: string; ip?: string; correlationId?: string },
  ): Promise<AuthTokens & { mfaRequired?: boolean }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userModel.findOne({ email: normalizedEmail });

    // Dummy hash for constant-time comparison in case user is missing
    const dummyHash = '$argon2id$v=19$m=65536,t=3,p=4$ZHVtbXlzYWx0MTIzNDU2Nw$DummyHashForTimingMitigationOnly';
    const hashToVerify = user?.passwordHash || dummyHash;

    const passwordValid = await this.verifyPassword(hashToVerify, pass);

    if (!user || !user.passwordHash || !passwordValid) {
      if (user) {
        user.failedLoginCount = (user.failedLoginCount || 0) + 1;
        if (user.failedLoginCount >= 5) {
          user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15m lockout
          this.logger.warn(`Account locked due to 5 consecutive failed logins: ${normalizedEmail}`);
        }
        await user.save();
      }
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new ForbiddenException(`Account is temporarily locked. Try again in ${remainingMinutes} minute(s).`);
    }

    // Status checks
    if (user.status === 'pending_verification') {
      throw new ForbiddenException('Account email address is not verified. Please verify your email.');
    }
    if (user.status === 'pending_approval') {
      throw new ForbiddenException('Account is verified and currently awaiting administrative approval.');
    }
    if (user.status === 'suspended') {
      throw new ForbiddenException('Account has been suspended by system administration.');
    }
    if (user.status === 'rejected') {
      throw new ForbiddenException('Account registration request was declined.');
    }
    if (!user.active || user.status !== 'active') {
      throw new UnauthorizedException('Account is not active.');
    }

    // MFA TOTP Check
    if (user.mfa?.enabled) {
      if (!mfaCode) {
        return {
          accessToken: '',
          refreshTokenCookieValue: '',
          mfaRequired: true,
          user: {
            id: String(user._id),
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            badgeNumber: user.badgeNumber,
            status: user.status,
            mfaEnabled: true,
          },
        };
      }

      const isValidTotp = user.mfa.secretEnc
        ? verifySync({ token: mfaCode.trim(), secret: user.mfa.secretEnc }).valid
        : false;

      let recoveryUsed = false;
      if (!isValidTotp && user.mfa.recoveryCodesHashed?.length > 0) {
        const hashedInput = this.hashTokenSecret(mfaCode.trim());
        const codeIndex = user.mfa.recoveryCodesHashed.indexOf(hashedInput);
        if (codeIndex !== -1) {
          user.mfa.recoveryCodesHashed.splice(codeIndex, 1);
          recoveryUsed = true;
          this.logger.log(`User ${user.email} logged in using a single-use recovery code`);
        }
      }

      if (!isValidTotp && !recoveryUsed) {
        throw new UnauthorizedException('Invalid two-factor authentication code or recovery code.');
      }
    }

    // Reset failed login count
    user.failedLoginCount = 0;
    user.lockedUntil = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    // Session Management & Device Tracking
    const userAgent = meta?.userAgent || 'Unknown Device';
    const ipHash = this.hashIp(meta?.ip);
    const deviceLabel = this.parseDeviceLabel(userAgent);

    // Check if new device / IP to enqueue newLoginAlert
    const previousSession = await this.sessionModel.findOne({
      userId: user._id,
      revokedAt: { $exists: false },
      $or: [{ deviceLabel }, { ipHash }],
    });

    if (!previousSession) {
      const webUrl = this.configService.get<string>('app.webUrl', 'http://localhost:3000');
      await this.emailService.enqueue('newLoginAlert', {
        name: user.fullName,
        email: user.email,
        deviceLabel,
        location: 'Local / Transit Network',
        ip: meta?.ip || '127.0.0.1',
        time: new Date().toISOString(),
        secureAccountUrl: `${webUrl}/settings/security?action=lock`,
      });
    }

    // Limit active sessions per user (max 10)
    const activeSessions = await this.sessionModel
      .find({ userId: user._id, revokedAt: { $exists: false } })
      .sort({ createdAt: 1 });

    if (activeSessions.length >= 10) {
      const oldest = activeSessions[0];
      oldest.revokedAt = new Date();
      oldest.revokedReason = 'MAX_SESSION_LIMIT_EXCEEDED';
      await oldest.save();
    }

    // Create new session & token family
    const familyId = randomUUID();
    const tokenSecret = randomBytes(32).toString('hex');
    const tokenHash = this.hashTokenSecret(tokenSecret);

    const session = await this.sessionModel.create({
      userId: user._id,
      refreshTokenFamilyId: familyId,
      currentTokenHash: tokenHash,
      userAgent,
      ipHash,
      deviceLabel,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    // Sign JWT access token (15m TTL)
    const jti = randomUUID();
    const accessToken = await this.signAccessToken(user, String(session._id), jti);

    await this.auditService.recordLog({
      actor: { userId: String(user._id), email: user.email, role: user.role },
      action: 'LOGIN_SUCCESS',
      entity: { type: 'User', id: String(user._id) },
      ipAddress: meta?.ip,
      userAgent,
      correlationId: meta?.correlationId || 'auth-login',
      metadata: { sessionId: String(session._id), deviceLabel },
    });

    return {
      accessToken,
      refreshTokenCookieValue: `${session._id}.${tokenSecret}`,
      mustChangePassword: Boolean(user.mustChangePassword),
      mfaEnrollmentRequired: Boolean(user.mfaEnrollmentRequired),
      user: {
        id: String(user._id),
        email: user.email,
        name: user.fullName || '',
        fullName: user.fullName,
        role: user.role,
        badgeNumber: user.badgeNumber || '',
        department: user.department || '',
        avatarUrl: user.avatarUrl || '',
        status: user.status,
        mfaEnabled: user.mfa?.enabled || false,
        mustChangePassword: Boolean(user.mustChangePassword),
        mfaEnrollmentRequired: Boolean(user.mfaEnrollmentRequired),
      },
    };
  }

  /**
   * Silent refresh with token family rotation and reuse detection.
   */
  async refreshSession(cookieValue?: string, correlationId = 'refresh'): Promise<{
    accessToken: string;
    newRefreshTokenCookieValue: string;
    user: AuthTokens['user'];
  }> {
    if (!cookieValue || !cookieValue.includes('.')) {
      throw new UnauthorizedException('Missing or malformed refresh token cookie');
    }

    const [sessionId, presentedSecret] = cookieValue.split('.');
    const session = await this.sessionModel.findById(sessionId);

    if (!session) {
      throw new UnauthorizedException('Session expired or not found');
    }

    const presentedHash = this.hashTokenSecret(presentedSecret);

    // REUSE DETECTION: If session is already revoked or presented hash does not match current hash:
    if (session.revokedAt || session.currentTokenHash !== presentedHash) {
      this.logger.error(
        `SECURITY VIOLATION: Refresh token reuse detected! Revoking family [${session.refreshTokenFamilyId}]`,
      );

      // 1. Revoke entire family
      await this.sessionModel.updateMany(
        { refreshTokenFamilyId: session.refreshTokenFamilyId },
        {
          $set: {
            revokedAt: new Date(),
            revokedReason: 'TOKEN_REUSE_DETECTED',
          },
        },
      );

      // 2. Alert user via securityAlert template
      const user = await this.userModel.findById(session.userId);
      if (user) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();

        const webUrl = this.configService.get<string>('app.webUrl', 'http://localhost:3000');
        await this.emailService.enqueue('securityAlert', {
          name: user.fullName,
          email: user.email,
          reason: 'Previously rotated refresh token was presented (family compromise detected)',
          incidentTime: new Date().toISOString(),
          accountLocked: true,
          unlockUrl: `${webUrl}/login?action=verify_identity`,
        });
      }

      await this.auditService.recordLog({
        actor: { userId: String(session.userId), email: user?.email || 'unknown', role: user?.role || 'viewer' },
        action: 'REFRESH_TOKEN_REUSE_DETECTED',
        entity: { type: 'Session', id: String(session._id) },
        correlationId,
        metadata: { familyId: session.refreshTokenFamilyId },
      });

      throw new UnauthorizedException('Session terminated due to security violation');
    }

    // Session is valid; rotate token secret
    const newSecret = randomBytes(32).toString('hex');
    const newHash = this.hashTokenSecret(newSecret);

    session.currentTokenHash = newHash;
    session.lastUsedAt = new Date();
    await session.save();

    const user = await this.userModel.findById(session.userId);
    if (!user || user.status !== 'active') {
      session.revokedAt = new Date();
      session.revokedReason = 'USER_INACTIVE';
      await session.save();
      throw new UnauthorizedException('User account is no longer active');
    }

    const jti = randomUUID();
    const accessToken = await this.signAccessToken(user, String(session._id), jti);

    return {
      accessToken,
      newRefreshTokenCookieValue: `${session._id}.${newSecret}`,
      user: {
        id: String(user._id),
        email: user.email,
        name: user.fullName || '',
        fullName: user.fullName,
        role: user.role,
        badgeNumber: user.badgeNumber || '',
        department: user.department || '',
        avatarUrl: user.avatarUrl || '',
        status: user.status,
        mfaEnabled: user.mfa?.enabled || false,
        mustChangePassword: Boolean(user.mustChangePassword),
        mfaEnrollmentRequired: Boolean(user.mfaEnrollmentRequired),
      },
    };
  }

  /**
   * Log out of current session and denylist access token JTI in Redis.
   */
  async logout(cookieValue?: string, currentJti?: string): Promise<void> {
    if (cookieValue && cookieValue.includes('.')) {
      const [sessionId] = cookieValue.split('.');
      await this.sessionModel.findByIdAndUpdate(sessionId, {
        $set: { revokedAt: new Date(), revokedReason: 'USER_LOGOUT' },
      });
    }

    if (currentJti) {
      // Denylist token for 15 minutes (access token TTL)
      await this.redisService.set(`denylist:jti:${currentJti}`, 'revoked', 15 * 60);
    }
  }

  /**
   * Log out of all devices for the current user.
   */
  async logoutAll(userId: string, currentJti?: string): Promise<void> {
    await this.sessionModel.updateMany(
      { userId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date(), revokedReason: 'LOGOUT_ALL_DEVICES' } },
    );

    if (currentJti) {
      await this.redisService.set(`denylist:jti:${currentJti}`, 'revoked', 15 * 60);
    }
  }

  /**
   * Password reset request (always returns 202).
   */
  async forgotPassword(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userModel.findOne({ email: normalizedEmail, status: 'active' });

    if (user) {
      // Invalidate existing reset tokens
      await this.tokenModel.deleteMany({ userId: user._id, purpose: 'password_reset' });

      const plainToken = randomBytes(32).toString('hex');
      const tokenHash = this.hashTokenSecret(plainToken);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 mins

      await this.tokenModel.create({
        userId: user._id,
        tokenHash,
        purpose: 'password_reset',
        expiresAt,
      });

      const webUrl = this.configService.get<string>('app.webUrl', 'http://localhost:3000');
      const resetUrl = `${webUrl}/reset-password?token=${plainToken}`;

      await this.emailService.enqueue('passwordReset', {
        name: user.fullName,
        email: user.email,
        resetUrl,
        token: plainToken,
        expiresMinutes: 30,
      });
    }
  }

  /**
   * Complete password reset.
   */
  async resetPassword(plainToken: string, newPass: string): Promise<void> {
    validatePasswordPolicy(newPass);

    const tokenHash = this.hashTokenSecret(plainToken.trim());
    const tokenDoc = await this.tokenModel.findOne({
      tokenHash,
      purpose: 'password_reset',
      usedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    });

    if (!tokenDoc) {
      throw new BadRequestException('Password reset link is invalid or has expired.');
    }

    tokenDoc.usedAt = new Date();
    await tokenDoc.save();

    const user = await this.userModel.findById(tokenDoc.userId);
    if (!user) {
      throw new NotFoundException('User account was not found.');
    }

    user.passwordHash = await this.hashPassword(newPass);
    user.lockedUntil = undefined;
    user.failedLoginCount = 0;
    await user.save();

    // Revoke all existing sessions
    await this.sessionModel.updateMany(
      { userId: user._id, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date(), revokedReason: 'PASSWORD_RESET' } },
    );

    const webUrl = this.configService.get<string>('app.webUrl', 'http://localhost:3000');
    await this.emailService.enqueue('passwordChanged', {
      name: user.fullName,
      email: user.email,
      changedAt: new Date().toUTCString(),
      loginUrl: `${webUrl}/login`,
    });
  }

  /**
   * Change password for logged-in user.
   */
  async changePassword(userId: string, currentPass: string, newPass: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user || !user.passwordHash) {
      throw new NotFoundException('User account not found.');
    }

    const valid = await this.verifyPassword(user.passwordHash, currentPass);
    if (!valid) {
      throw new BadRequestException('Current password does not match.');
    }

    validatePasswordPolicy(newPass, [user.fullName, user.email]);

    user.passwordHash = await this.hashPassword(newPass);
    user.mustChangePassword = false;
    await user.save();

    await this.auditService.recordLog({
      actor: { userId: String(user._id), email: user.email, role: user.role },
      action: 'user.password.change',
      entity: { type: 'User', id: String(user._id) },
      correlationId: 'change-password',
    });

    const webUrl = this.configService.get<string>('app.webUrl', 'http://localhost:3000');
    await this.emailService.enqueue('passwordChanged', {
      name: user.fullName,
      email: user.email,
      changedAt: new Date().toUTCString(),
      loginUrl: `${webUrl}/login`,
    });
  }

  /**
   * Backend-initiated OAuth redirect handler (Google / GitHub).
   */
  async handleOAuthCallback(profile: {
    provider: 'google' | 'github';
    providerUserId: string;
    email: string;
    emailVerified: boolean;
    name: string;
    avatarUrl?: string;
  }): Promise<{ status: 'ok' | 'pending' | 'error'; sessionCookie?: string }> {
    if (!profile.emailVerified) {
      throw new UnauthorizedException('OAuth provider email is not verified.');
    }

    const email = profile.email.toLowerCase().trim();

    // 1. Check if identity already exists
    let identity = await this.identityModel.findOne({
      provider: profile.provider,
      providerUserId: profile.providerUserId,
    });

    let user: UserDocument | null = null;

    if (identity) {
      user = await this.userModel.findById(identity.userId);
    } else {
      // 2. Check if user with same verified email exists
      user = await this.userModel.findOne({ email });

      if (user) {
        // STRICT ACCOUNT LINKING RULE: Never link onto an unverified account (prevents takeover)
        if (!user.emailVerifiedAt) {
          throw new UnauthorizedException(
            'An unverified account with this email already exists. Please verify your email via the confirmation link first before connecting OAuth.',
          );
        }

        // Link identity
        identity = await this.identityModel.create({
          userId: user._id,
          provider: profile.provider,
          providerUserId: profile.providerUserId,
          email,
          emailVerified: true,
        });
      } else {
        // 3. Create new user via OAuth
        const requireApproval = this.configService.get<boolean>('app.authRequireAdminApproval', true);
        const userStatus = requireApproval ? 'pending_approval' : 'active';

        user = await this.userModel.create({
          email,
          fullName: profile.name,
          avatarUrl: profile.avatarUrl,
          role: 'viewer',
          status: userStatus,
          emailVerifiedAt: new Date(),
          createdVia: profile.provider,
          active: true,
        });

        identity = await this.identityModel.create({
          userId: user._id,
          provider: profile.provider,
          providerUserId: profile.providerUserId,
          email,
          emailVerified: true,
        });

        if (requireApproval) {
          await this.emailService.enqueue('welcomePendingApproval', {
            name: user.fullName,
            email: user.email,
          });
        }
      }
    }

    if (!user) {
      throw new UnauthorizedException('Authentication failed.');
    }

    if (user.status === 'pending_approval') {
      return { status: 'pending' };
    }

    if (user.status !== 'active') {
      return { status: 'error' };
    }

    // Create session & refresh cookie
    const familyId = randomUUID();
    const tokenSecret = randomBytes(32).toString('hex');
    const tokenHash = this.hashTokenSecret(tokenSecret);

    const session = await this.sessionModel.create({
      userId: user._id,
      refreshTokenFamilyId: familyId,
      currentTokenHash: tokenHash,
      userAgent: `OAuth-${profile.provider}`,
      deviceLabel: `Social Login (${profile.provider.toUpperCase()})`,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    return {
      status: 'ok',
      sessionCookie: `${session._id}.${tokenSecret}`,
    };
  }

  /**
   * TOTP MFA Setup (returns secret & QR code data URI).
   */
  async setupMfa(userId: string): Promise<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const secret = generateSecret();
    const appName = this.configService.get<string>('app.name', 'Sentinel Vision AI');
    const otpauthUrl = generateURI({ secret, label: user.email, issuer: appName });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Save temporary secret
    user.mfa = user.mfa || { enabled: false, recoveryCodesHashed: [] };
    user.mfa.secretEnc = secret;
    await user.save();

    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  /**
   * Verify TOTP code and enable MFA; generates 8 recovery codes.
   */
  async enableMfa(userId: string, code: string): Promise<{ recoveryCodes: string[] }> {
    const user = await this.userModel.findById(userId);
    if (!user || !user.mfa?.secretEnc) {
      throw new BadRequestException('MFA setup has not been initiated.');
    }

    const isValid = verifySync({ token: code.trim(), secret: user.mfa.secretEnc }).valid;
    if (!isValid) {
      throw new BadRequestException('Invalid two-factor authentication code.');
    }

    // Generate 8 backup recovery codes
    const plainCodes: string[] = [];
    const hashedCodes: string[] = [];

    for (let i = 0; i < 8; i++) {
      const codePart1 = randomBytes(3).toString('hex').toUpperCase();
      const codePart2 = randomBytes(3).toString('hex').toUpperCase();
      const plainCode = `${codePart1}-${codePart2}`;
      plainCodes.push(plainCode);
      hashedCodes.push(this.hashTokenSecret(plainCode));
    }

    user.mfa.enabled = true;
    user.mfa.recoveryCodesHashed = hashedCodes;
    user.mfaEnrollmentRequired = false;
    await user.save();

    await this.auditService.recordLog({
      actor: { userId: String(user._id), email: user.email, role: user.role },
      action: 'user.mfa.enroll',
      entity: { type: 'User', id: String(user._id) },
      correlationId: 'enable-mfa',
    });

    return { recoveryCodes: plainCodes };
  }

  /**
   * Disable TOTP MFA.
   */
  async disableMfa(userId: string, code: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user || !user.mfa?.enabled) {
      throw new BadRequestException('MFA is not enabled.');
    }

    const isValid = user.mfa.secretEnc
      ? verifySync({ token: code.trim(), secret: user.mfa.secretEnc }).valid
      : false;

    if (!isValid) {
      throw new BadRequestException('Invalid confirmation code.');
    }

    user.mfa.enabled = false;
    user.mfa.secretEnc = undefined;
    user.mfa.recoveryCodesHashed = [];
    await user.save();
  }

  /**
   * Linked Social Identities.
   */
  async getIdentities(userId: string): Promise<AuthIdentityDocument[]> {
    return this.identityModel.find({ userId });
  }

  async unlinkIdentity(userId: string, provider: 'google' | 'github'): Promise<void> {
    const user = await this.userModel.findById(userId);
    const identities = await this.identityModel.find({ userId });

    // Check if user has a password or other provider
    if (!user?.passwordHash && identities.length <= 1) {
      throw new BadRequestException('Cannot unlink your only sign-in method. Set a password first.');
    }

    await this.identityModel.deleteOne({ userId, provider });
  }

  /**
   * List active sessions for user.
   */
  async getSessions(userId: string, currentSessionId?: string): Promise<any[]> {
    const sessions = await this.sessionModel
      .find({ userId, revokedAt: { $exists: false } })
      .sort({ lastUsedAt: -1 });

    return sessions.map((s) => ({
      id: String(s._id),
      deviceLabel: s.deviceLabel,
      userAgent: s.userAgent,
      lastUsedAt: s.lastUsedAt,
      createdAt: s.createdAt,
      isCurrent: currentSessionId ? String(s._id) === currentSessionId : false,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.sessionModel.updateOne(
      { _id: sessionId, userId },
      { $set: { revokedAt: new Date(), revokedReason: 'USER_REVOKED' } },
    );
  }

  /**
   * Admin Operations.
   */
  async approveUser(userId: string, role: string, actor: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    user.status = 'active';
    user.role = role as UserRole;
    await user.save();

    const webUrl = this.configService.get<string>('app.webUrl', 'http://localhost:3000');
    await this.emailService.enqueue('accountApproved', {
      name: user.fullName,
      email: user.email,
      role: user.role,
      loginUrl: `${webUrl}/login`,
    });
  }

  async rejectUser(userId: string, reason?: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    user.status = 'rejected';
    await user.save();

    await this.emailService.enqueue('accountRejected', {
      name: user.fullName,
      email: user.email,
      reason,
    });
  }

  async suspendUser(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { status: 'suspended' });
    await this.sessionModel.updateMany({ userId }, { $set: { revokedAt: new Date(), revokedReason: 'ADMIN_SUSPENDED' } });
  }

  async reactivateUser(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { status: 'active' });
  }

  async resetUserMfa(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      $set: { 'mfa.enabled': false, 'mfa.secretEnc': undefined, 'mfa.recoveryCodesHashed': [] },
    });
  }

  async createInvite(dto: CreateInviteDto, creatorEmail?: string): Promise<{ inviteCode: string; inviteUrl: string }> {
    const plainCode = `INV-${randomBytes(4).toString('hex').toUpperCase()}`;
    const codeHash = this.hashTokenSecret(plainCode);
    const expiresDays = dto.expiresInDays ?? 7;
    const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);

    await this.inviteModel.create({
      codeHash,
      role: dto.role,
      teams: dto.teams || [],
      expiresAt,
      maxUses: dto.maxUses ?? 1,
      usedCount: 0,
      autoApprove: dto.autoApprove ?? false,
      createdBy: creatorEmail,
    });

    const webUrl = this.configService.get<string>('app.webUrl', 'http://localhost:3000');
    return {
      inviteCode: plainCode,
      inviteUrl: `${webUrl}/register?invite=${plainCode}`,
    };
  }

  /**
   * Fetch real database-backed profile for the verified authenticated user.
   * Strips all internal secrets, password hashes, and MFA secrets.
   */
  async getCurrentUserProfile(userId: string) {
    const q: any = this.userModel.findById(userId);
    const user = typeof q?.exec === 'function' ? await q.exec() : await q;
    if (!user) {
      throw new NotFoundException('User record not found in database');
    }
    if (user.status === 'suspended' || user.status === 'rejected') {
      throw new ForbiddenException(`Account is ${user.status}`);
    }

    return {
      id: String(user._id),
      email: user.email,
      name: user.fullName || '',
      fullName: user.fullName || '',
      role: user.role,
      badgeNumber: user.badgeNumber || '',
      department: user.department || '',
      status: user.status,
      avatarUrl: user.avatarUrl || '',
      mfaEnabled: user.mfa?.enabled || false,
      mustChangePassword: Boolean(user.mustChangePassword),
      mfaEnrollmentRequired: Boolean(user.mfaEnrollmentRequired),
      createdVia: user.createdVia,
      createdAt: (user as any).createdAt ? (user as any).createdAt.toISOString() : undefined,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    };
  }

  /**
   * Update the profile details of the verified authenticated user in MongoDB.
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const q: any = this.userModel.findById(userId);
    const user = typeof q?.exec === 'function' ? await q.exec() : await q;
    if (!user) {
      throw new NotFoundException('User record not found in database');
    }

    if (dto.fullName !== undefined) {
      user.fullName = dto.fullName.trim();
    }
    if (dto.avatarUrl !== undefined) {
      user.avatarUrl = dto.avatarUrl.trim();
    }
    await user.save();

    await this.auditService.recordLog({
      actor: { userId: String(user._id), email: user.email, role: user.role },
      action: 'user.profile.update',
      entity: { type: 'User', id: String(user._id) },
      correlationId: 'update-profile',
    });

    return this.getCurrentUserProfile(userId);
  }

  // --- Helper Methods ---

  private async signAccessToken(user: UserDocument, sessionId: string, jti: string): Promise<string> {
    const secret =
      this.configService.get<string>('auth.jwtAccessSecret') ||
      this.configService.get<string>('app.jwtAccessSecret') ||
      this.configService.get<string>('app.jwtSecret') ||
      'dev-secret-change-in-production';
    const expiresIn =
      this.configService.get<string>('auth.jwtAccessTtl') ||
      this.configService.get<string>('app.jwtAccessExpiresIn', '15m');

    let permVersion = 0;
    if (this.redisService && typeof this.redisService.isHealthy === 'function' && this.redisService.isHealthy()) {
      const v = await this.redisService.get(`user:permVersion:${user._id}`);
      if (v) permVersion = parseInt(v, 10);
    }

    return this.jwtService.signAsync(
      {
        sub: String(user._id),
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        badgeNumber: user.badgeNumber,
        sessionId,
        permVersion,
        aud: 'web',
        mustChangePassword: Boolean(user.mustChangePassword),
        mfaEnrollmentRequired: Boolean(user.mfaEnrollmentRequired),
      },
      {
        secret,
        expiresIn,
        jwtid: jti,
      },
    );
  }

  /**
   * Step-up re-authentication using password or TOTP MFA code.
   * Returns a stepUpToken and caches the elevation in Redis for 5 minutes (300s).
   */
  async stepUp(
    userId: string,
    sessionId?: string,
    password?: string,
    mfaCode?: string,
  ): Promise<{ stepUpToken: string; expiresIn: number }> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    let verified = false;

    if (mfaCode && user.mfa?.secretEnc) {
      const isValid = verifySync({ token: mfaCode.trim(), secret: user.mfa.secretEnc }).valid;
      if (isValid) {
        verified = true;
      }
    }

    if (!verified && password && user.passwordHash) {
      const isPasswordValid = await this.verifyPassword(user.passwordHash, password);
      if (isPasswordValid) {
        verified = true;
      }
    }

    if (!verified) {
      throw new UnauthorizedException('Invalid security credentials for step-up elevation.');
    }

    const secret =
      this.configService.get<string>('auth.jwtAccessSecret') ||
      this.configService.get<string>('app.jwtAccessSecret') ||
      'dev-secret-change-in-production';
    const expiresIn = 300; // 5 minutes

    const stepUpToken = await this.jwtService.signAsync(
      {
        sub: String(user._id),
        sessionId,
        purpose: 'step-up',
      },
      {
        secret,
        expiresIn: `${expiresIn}s`,
      },
    );

    if (sessionId && this.redisService.isHealthy()) {
      const redisKey = `stepup:session:${user._id}:${sessionId}`;
      await this.redisService.set(redisKey, 'valid', expiresIn);
    }

    await this.auditService.recordLog({
      actor: { userId: String(user._id), email: user.email, role: user.role },
      action: 'user.auth.step_up',
      entity: { type: 'User', id: String(user._id) },
      correlationId: 'step-up',
    });

    return { stepUpToken, expiresIn };
  }

  private parseDeviceLabel(userAgent: string): string {
    if (/iphone|ipad|ipod/i.test(userAgent)) return 'iOS Device';
    if (/android/i.test(userAgent)) return 'Android Device';
    if (/macintosh|mac os x/i.test(userAgent)) return 'macOS Workstation';
    if (/windows nt/i.test(userAgent)) return 'Windows Workstation';
    if (/linux/i.test(userAgent)) return 'Linux Workstation';
    return 'Web Browser Session';
  }
}
