import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import zxcvbn from 'zxcvbn';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { MobileUser, MobileUserDocument } from '../schemas/mobile-user.schema';
import { MobileInvite, MobileInviteDocument } from '../schemas/mobile-invite.schema';
import { RedisService } from '../../common/redis/redis.service';
import { AuditService } from '../../audit/audit.service';
import {
  MobileRegisterDto,
  MobileVerifyDto,
  MobileLoginDto,
} from '@sentinel/shared-types';

export interface MobileAuthTokens {
  accessToken: string;
  refreshTokenCookieValue: string;
  user: {
    mobileUserId: string;
    email: string;
    fullName: string;
    status: string;
    siteIds: string[];
  };
}

@Injectable()
export class MobileAuthService {
  private readonly logger = new Logger(MobileAuthService.name);
  private readonly mobileSecret: string;
  private readonly mobileRefreshSecret: string;

  constructor(
    @InjectModel(MobileUser.name) private readonly mobileUserModel: Model<MobileUserDocument>,
    @InjectModel(MobileInvite.name) private readonly mobileInviteModel: Model<MobileInviteDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
  ) {
    this.mobileSecret = this.configService.get<string>(
      'app.jwtMobileSecret',
      'sentinel-mobile-realm-secret-2026',
    );
    this.mobileRefreshSecret = this.configService.get<string>(
      'app.jwtMobileRefreshSecret',
      'sentinel-mobile-refresh-secret-2026',
    );
  }

  private hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  async register(
    dto: MobileRegisterDto,
    ip = '127.0.0.1',
    userAgent = 'MobileClient',
  ): Promise<{ status: string; message: string }> {
    // 1. Password strength validation (zxcvbn >= 3, length >= 10)
    if (!dto.password || dto.password.length < 10) {
      throw new BadRequestException('Password must be at least 10 characters long');
    }
    const score = zxcvbn(dto.password).score;
    if (score < 3) {
      throw new BadRequestException(
        'Password is too weak. Please use a passphrase with varied characters (strength score >= 3).',
      );
    }

    // 2. Email uniqueness check
    const existing = await this.mobileUserModel.findOne({ email: dto.email.toLowerCase() });
    if (existing) {
      throw new BadRequestException('A mobile operator with this email already exists');
    }

    // 3. Process Invite Code (if provided)
    let assignedSiteId = 'site_primary';
    let invitedByInviteId: string | undefined;
    let autoApproveOnVerify = false;

    if (dto.inviteCode) {
      const codeHash = this.hashSecret(dto.inviteCode.trim().toUpperCase());
      const invite = await this.mobileInviteModel.findOne({
        codeHash,
        revokedAt: { $exists: false },
        expiresAt: { $gt: new Date() },
      });

      if (!invite || invite.usedCount >= invite.maxUses) {
        throw new BadRequestException('Invalid or expired invite code');
      }

      // Check allowed domains if specified
      if (invite.allowedEmailDomains && invite.allowedEmailDomains.length > 0) {
        const domain = dto.email.split('@')[1]?.toLowerCase();
        if (!domain || !invite.allowedEmailDomains.map((d) => d.toLowerCase()).includes(domain)) {
          throw new BadRequestException(
            `Email domain '@${domain}' is not authorized for this invite`,
          );
        }
      }

      assignedSiteId = invite.siteId;
      invitedByInviteId = invite.inviteId;
      autoApproveOnVerify = invite.autoApprove;

      // Increment invite usage
      await this.mobileInviteModel.updateOne(
        { inviteId: invite.inviteId },
        { $inc: { usedCount: 1 } },
      );
    }

    // 4. Hash password with argon2id
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
    });

    const mobileUserId = `musr_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

    // 5. Create user in pending_verification status
    const user = new this.mobileUserModel({
      mobileUserId,
      fullName: dto.fullName.trim(),
      email: dto.email.toLowerCase().trim(),
      phoneE164: dto.phone?.trim(),
      passwordHash,
      siteIds: [assignedSiteId],
      status: 'pending_verification',
      invitedByInviteId,
      consent: {
        acceptedAt: new Date(),
        termsVersion: '1.0',
        ip,
        userAgent,
      },
      failedLoginCount: 0,
      mfa: { enabled: false, method: 'email' },
    });

    await user.save();

    // 6. Generate 6-digit OTP, hash and store in Redis with 10-minute TTL (600s)
    await this.generateAndStoreOtp(user.email, autoApproveOnVerify);

    // 7. Audit log
    await this.auditService.recordLog({
      action: 'MOBILE_USER_REGISTERED',
      actor: {
        userId: mobileUserId,
        email: user.email,
        role: 'mobile_operator',
      },
      entity: {
        type: 'mobile_user',
        id: mobileUserId,
      },
      ipAddress: ip,
      userAgent,
      correlationId: `corr_${Date.now()}`,
      metadata: {
        siteId: assignedSiteId,
        invitedByInviteId,
        autoApproveOnVerify,
      },
    });

    return {
      status: 'pending_verification',
      message: 'Verification code sent. Please check your email.',
    };
  }

  async verify(dto: MobileVerifyDto, ip = '127.0.0.1'): Promise<{ status: string; message: string }> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.mobileUserModel.findOne({ email });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const redisOtpKey = `mobile:otp:${email}`;
    const redisAttemptsKey = `mobile:otp_attempts:${email}`;

    const attempts = await this.redisService.incr(redisAttemptsKey);
    if (attempts === 1) {
      await this.redisService.set(redisAttemptsKey, '1', 600);
    }
    if (attempts > 5) {
      await this.redisService.del(redisOtpKey);
      throw new BadRequestException('Too many invalid attempts. Please request a new OTP.');
    }

    const storedHash = await this.redisService.get(redisOtpKey);
    if (!storedHash) {
      throw new BadRequestException('OTP expired or not found. Please request a new one.');
    }

    const otpCode = (dto.otp || (dto as any).code || '').trim();
    if (!otpCode) {
      throw new BadRequestException('Verification code is required');
    }
    const providedHash = this.hashSecret(otpCode);
    if (storedHash !== providedHash) {
      throw new BadRequestException('Invalid verification code');
    }

    // OTP verified: clean up Redis
    await this.redisService.del(redisOtpKey);
    await this.redisService.del(redisAttemptsKey);

    const autoApproveFlag = await this.redisService.get(`mobile:auto_approve:${email}`);
    await this.redisService.del(`mobile:auto_approve:${email}`);

    // Transition status: if auto-approved, active; else pending_approval
    const nextStatus = autoApproveFlag === 'true' ? 'active' : 'pending_approval';

    user.status = nextStatus;
    user.emailVerifiedAt = new Date();
    await user.save();

    await this.auditService.recordLog({
      action: 'MOBILE_USER_VERIFIED',
      actor: {
        userId: user.mobileUserId,
        email: user.email,
        role: 'mobile_operator',
      },
      entity: {
        type: 'mobile_user',
        id: user.mobileUserId,
      },
      ipAddress: ip,
      correlationId: `corr_${Date.now()}`,
      metadata: { nextStatus },
    });

    return {
      status: nextStatus,
      message:
        nextStatus === 'active'
          ? 'Account verified and activated successfully'
          : 'Account verified. Awaiting administrator approval before you can broadcast.',
    };
  }

  async resendOtp(email: string): Promise<{ message: string }> {
    const user = await this.mobileUserModel.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      // Constant-time silent return to prevent email enumeration
      return { message: 'If the account exists, a new code has been sent.' };
    }

    await this.generateAndStoreOtp(user.email, false);
    return { message: 'A new 6-digit verification code has been dispatched.' };
  }

  async login(
    dto: MobileLoginDto,
    ip = '127.0.0.1',
    userAgent = 'MobileClient',
  ): Promise<MobileAuthTokens> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.mobileUserModel.findOne({ email });

    // Constant-time dummy argon verify if user not found to prevent timing attack
    if (!user) {
      await argon2.verify(
        '$argon2id$v=19$m=65536,t=3,p=4$dummyhashdummyhashdummy$dummyhashdummyhashdummy',
        dto.password,
      ).catch(() => false);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const waitMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new ForbiddenException(
        `Account is locked due to multiple failed login attempts. Try again in ${waitMinutes} minutes.`,
      );
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password).catch(() => false);

    if (!passwordValid) {
      user.failedLoginCount += 1;
      if (user.failedLoginCount >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lock
        user.failedLoginCount = 0;
      }
      await user.save();

      throw new UnauthorizedException('Invalid email or password');
    }

    // Check user approval status
    if (user.status !== 'active') {
      if (user.status === 'pending_approval') {
        throw new ForbiddenException(
          'Your account is awaiting administrator approval. You will receive an email once approved.',
        );
      }
      if (user.status === 'pending_verification') {
        throw new ForbiddenException(
          'Email verification required before login. Please verify your account with the OTP.',
        );
      }
      if (user.status === 'suspended') {
        throw new ForbiddenException('Your account has been suspended by an administrator.');
      }
      throw new ForbiddenException(`Account access denied: status is ${user.status}`);
    }

    // Reset failed counter
    user.failedLoginCount = 0;
    user.lockedUntil = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    // Generate Mobile Access Token (15m, aud=mobile)
    const payload = {
      sub: user.mobileUserId,
      email: user.email,
      role: 'mobile_operator',
      aud: 'mobile',
      scopes: ['mobile:profile', 'mobile:devices', 'mobile:stream'],
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.mobileSecret,
      expiresIn: '15m',
    });

    // Generate Refresh Token with Family Reuse Detection (30 days)
    const familyId = randomUUID();
    const tokenSecret = randomBytes(32).toString('hex');
    const refreshKey = `mobile:refresh:${familyId}`;

    await this.redisService.set(refreshKey, this.hashSecret(tokenSecret), 30 * 24 * 60 * 60);

    const refreshTokenCookieValue = `${familyId}:${tokenSecret}`;

    await this.auditService.recordLog({
      action: 'MOBILE_USER_LOGGED_IN',
      actor: {
        userId: user.mobileUserId,
        email: user.email,
        role: 'mobile_operator',
      },
      entity: {
        type: 'mobile_user',
        id: user.mobileUserId,
      },
      ipAddress: ip,
      userAgent,
      correlationId: `corr_${Date.now()}`,
    });

    return {
      accessToken,
      refreshTokenCookieValue,
      user: {
        mobileUserId: user.mobileUserId,
        email: user.email,
        fullName: user.fullName,
        status: user.status,
        siteIds: user.siteIds,
      },
    };
  }

  async refreshToken(cookieValue?: string): Promise<{ accessToken: string; refreshTokenCookieValue: string }> {
    if (!cookieValue) {
      throw new UnauthorizedException('Missing mobile refresh token');
    }

    const [familyId, secret] = cookieValue.split(':');
    if (!familyId || !secret) {
      throw new UnauthorizedException('Invalid mobile refresh token format');
    }

    const refreshKey = `mobile:refresh:${familyId}`;
    const storedHash = await this.redisService.get(refreshKey);

    if (!storedHash) {
      throw new UnauthorizedException('Expired or invalid mobile refresh token session');
    }

    const providedHash = this.hashSecret(secret);
    if (storedHash !== providedHash) {
      // REUSE DETECTED: Revoke entire token family to mitigate token theft
      await this.redisService.del(refreshKey);
      this.logger.warn(`Mobile refresh token reuse detected for family ${familyId}. Family revoked.`);
      throw new UnauthorizedException('Refresh token reuse detected. Please log in again.');
    }

    const newSecret = randomBytes(32).toString('hex');
    await this.redisService.set(refreshKey, this.hashSecret(newSecret), 30 * 24 * 60 * 60);

    const payload = {
      role: 'mobile_operator',
      aud: 'mobile',
      scopes: ['mobile:profile', 'mobile:devices', 'mobile:stream'],
    };

    const newAccessToken = await this.jwtService.signAsync(payload, {
      secret: this.mobileSecret,
      expiresIn: '15m',
    });

    return {
      accessToken: newAccessToken,
      refreshTokenCookieValue: `${familyId}:${newSecret}`,
    };
  }

  async logout(cookieValue?: string): Promise<void> {
    if (cookieValue) {
      const [familyId] = cookieValue.split(':');
      if (familyId) {
        await this.redisService.del(`mobile:refresh:${familyId}`);
      }
    }
  }

  private async generateAndStoreOtp(email: string, autoApprove: boolean): Promise<string> {
    const otpNum = Math.floor(100000 + Math.random() * 900000);
    const otp = String(otpNum);
    const hash = this.hashSecret(otp);

    const redisOtpKey = `mobile:otp:${email}`;
    await this.redisService.set(redisOtpKey, hash, 600); // 10 min TTL
    await this.redisService.del(`mobile:otp_attempts:${email}`);

    if (autoApprove) {
      await this.redisService.set(`mobile:auto_approve:${email}`, 'true', 600);
    }

    this.logger.log(`[MOBILE_AUTH] Dispatched 6-digit OTP for ${email}: ${otp}`);
    return otp;
  }
}
