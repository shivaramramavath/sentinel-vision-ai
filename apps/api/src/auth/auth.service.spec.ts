jest.mock('otplib', () => ({
  generateSecret: jest.fn().mockReturnValue('JBSWY3DPEHPK3PXP'),
  generateURI: jest.fn().mockReturnValue('otpauth://totp/Sentinel:test@example.com?secret=JBSWY3DPEHPK3PXP'),
  verifySync: jest.fn().mockReturnValue({ valid: true }),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ForbiddenException, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { User } from '../users/schemas/user.schema';
import { AuthIdentity } from './schemas/auth-identity.schema';
import { Session } from './schemas/session.schema';
import { AuthToken } from './schemas/auth-token.schema';
import { Invite } from './schemas/invite.schema';
import { RedisService } from '../common/redis/redis.service';
import { EmailService } from '../modules/email/email.service';
import { AuditService } from '../audit/audit.service';

describe('AuthService', () => {
  let authService: AuthService;

  const mockUser: any = {
    _id: 'user_123',
    email: 'sarah.vance@sentinel.gov',
    passwordHash: '',
    fullName: 'Insp. Sarah Vance',
    badgeNumber: 'INV-4821',
    role: 'investigator',
    status: 'active',
    failedLoginCount: 0,
    mfa: { enabled: false, recoveryCodesHashed: [] },
    save: jest.fn().mockResolvedValue(true),
  };

  const sessionsStore = new Map<string, any>();
  const redisStore = new Map<string, string>();

  beforeEach(async () => {
    sessionsStore.clear();
    redisStore.clear();
    mockUser.active = true;
    mockUser.status = 'active';
    mockUser.failedLoginCount = 0;
    mockUser.lockedUntil = undefined;
    mockUser.mfa = { enabled: false, recoveryCodesHashed: [] };

    mockUser.passwordHash = await argon2.hash('Investigator@2026', {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
    });

    const mockUserModel = {
      findOne: jest.fn().mockImplementation((query: any) => {
        if (query.email === mockUser.email) return Promise.resolve(mockUser);
        if (query._id === mockUser._id) return Promise.resolve(mockUser);
        return Promise.resolve(null);
      }),
      findById: jest.fn().mockImplementation((id: string) => {
        if (id === mockUser._id) return Promise.resolve(mockUser);
        return Promise.resolve(null);
      }),
      create: jest.fn().mockImplementation((doc: any) => Promise.resolve({ ...doc, _id: 'new_user_123', save: jest.fn() })),
    };

    const mockSessionModel = {
      create: jest.fn().mockImplementation((doc: any) => {
        const id = 'sess_' + Math.random().toString(36).substring(2, 9);
        const item = {
          ...doc,
          _id: id,
          createdAt: new Date(),
          save: jest.fn().mockResolvedValue(true),
        };
        sessionsStore.set(id, item);
        return Promise.resolve(item);
      }),
      findById: jest.fn().mockImplementation((id: string) => {
        return Promise.resolve(sessionsStore.get(id) || null);
      }),
      findOne: jest.fn().mockImplementation((query: any) => {
        if (query._id) return Promise.resolve(sessionsStore.get(query._id) || null);
        return Promise.resolve(null);
      }),
      updateOne: jest.fn().mockImplementation((query: any, update: any) => {
        const item = sessionsStore.get(query._id);
        if (item) {
          if (update.$set) Object.assign(item, update.$set);
          return Promise.resolve({ matchedCount: 1, modifiedCount: 1 });
        }
        return Promise.resolve({ matchedCount: 0, modifiedCount: 0 });
      }),
      updateMany: jest.fn().mockImplementation((query: any, update: any) => {
        for (const [id, item] of sessionsStore.entries()) {
          if (
            (query.refreshTokenFamilyId && item.refreshTokenFamilyId === query.refreshTokenFamilyId) ||
            (query.userId && item.userId === query.userId)
          ) {
            if (update.$set) Object.assign(item, update.$set);
          }
        }
        return Promise.resolve({ modifiedCount: 1 });
      }),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(Array.from(sessionsStore.values())),
        }),
      }),
    };

    const mockTokenModel = {
      create: jest.fn().mockResolvedValue({}),
      findOne: jest.fn().mockResolvedValue(null),
      deleteOne: jest.fn().mockResolvedValue({}),
    };

    const mockInviteModel = {
      findOne: jest.fn().mockResolvedValue(null),
      updateOne: jest.fn().mockResolvedValue({}),
    };

    const mockIdentityModel = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockResolvedValue([]),
      deleteOne: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: getModelToken(AuthIdentity.name), useValue: mockIdentityModel },
        { provide: getModelToken(Session.name), useValue: mockSessionModel },
        { provide: getModelToken(AuthToken.name), useValue: mockTokenModel },
        { provide: getModelToken(Invite.name), useValue: mockInviteModel },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('jwt_access_token_mock'),
            verifyAsync: jest.fn().mockResolvedValue({ sub: mockUser._id, role: mockUser.role }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, defaultVal: any) => defaultVal),
          },
        },
        {
          provide: RedisService,
          useValue: {
            set: jest.fn().mockImplementation((key: string, val: string) => {
              redisStore.set(key, val);
              return Promise.resolve();
            }),
            get: jest.fn().mockImplementation((key: string) => {
              return Promise.resolve(redisStore.get(key) || null);
            }),
            del: jest.fn().mockImplementation((key: string) => {
              redisStore.delete(key);
              return Promise.resolve();
            }),
          },
        },
        {
          provide: EmailService,
          useValue: {
            enqueue: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: AuditService,
          useValue: {
            recordLog: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('Password Hashing & Verification', () => {
    it('should hash a password using argon2 and successfully verify it', async () => {
      const plain = 'StrongPassphrase#2026';
      const hash = await authService.hashPassword(plain);
      expect(hash).toContain('$argon2');

      const isMatch = await authService.verifyPassword(hash, plain);
      expect(isMatch).toBe(true);

      const isFalse = await authService.verifyPassword(hash, 'WrongPassword');
      expect(isFalse).toBe(false);
    });
  });

  describe('Login Flow', () => {
    it('should login with valid credentials and return access token and refresh cookie value', async () => {
      const res = await authService.login('sarah.vance@sentinel.gov', 'Investigator@2026');
      expect(res.accessToken).toBe('jwt_access_token_mock');
      expect(res.user?.email).toBe('sarah.vance@sentinel.gov');
      expect(res.refreshTokenCookieValue).toContain('.');
    });

    it('should reject invalid password with UnauthorizedException', async () => {
      await expect(
        authService.login('sarah.vance@sentinel.gov', 'WrongPassword'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should lock account after 5 consecutive failures', async () => {
      for (let i = 0; i < 5; i++) {
        await authService.login('sarah.vance@sentinel.gov', 'WrongPass').catch(() => null);
      }
      expect(mockUser.lockedUntil).toBeDefined();

      await expect(
        authService.login('sarah.vance@sentinel.gov', 'Investigator@2026'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Refresh Token Rotation & Reuse Detection (Family Revocation)', () => {
    it('should rotate refresh token and issue new pair when valid', async () => {
      const loginRes = await authService.login('sarah.vance@sentinel.gov', 'Investigator@2026');
      const initialCookie = loginRes.refreshTokenCookieValue!;

      const refreshRes = await authService.refreshSession(initialCookie);
      expect(refreshRes.accessToken).toBe('jwt_access_token_mock');
      expect(refreshRes.newRefreshTokenCookieValue).not.toBe(initialCookie);

      // Verify the new token can be refreshed again
      const secondRefresh = await authService.refreshSession(refreshRes.newRefreshTokenCookieValue);
      expect(secondRefresh.accessToken).toBe('jwt_access_token_mock');
    });

    it('should detect token reuse, revoke the ENTIRE family, and reject request', async () => {
      const loginRes = await authService.login('sarah.vance@sentinel.gov', 'Investigator@2026');
      const oldCookie = loginRes.refreshTokenCookieValue!;

      // Legitimate client rotates the token
      const refreshRes = await authService.refreshSession(oldCookie);
      expect(refreshRes.newRefreshTokenCookieValue).toBeDefined();

      // Attacker attempts to replay the OLD cookie!
      await expect(authService.refreshSession(oldCookie)).rejects.toThrow(
        /security violation/i,
      );

      // Verify entire family is revoked: even legitimate client's latest token is now rejected
      await expect(
        authService.refreshSession(refreshRes.newRefreshTokenCookieValue),
      ).rejects.toThrow(/security violation/i);
    });
  });

  describe('getCurrentUserProfile', () => {
    it('should return database-backed profile for authenticated user without exposing secrets', async () => {
      const profile = await authService.getCurrentUserProfile('user_123');

      expect(profile).toBeDefined();
      expect(profile.id).toBe('user_123');
      expect(profile.email).toBe('sarah.vance@sentinel.gov');
      expect(profile.fullName).toBe('Insp. Sarah Vance');
      expect(profile.badgeNumber).toBe('INV-4821');
      expect(profile.role).toBe('investigator');
      expect(profile.status).toBe('active');

      // Crucial security check: Ensure secrets are not returned
      expect((profile as any).passwordHash).toBeUndefined();
      expect((profile as any).mfa?.secretEnc).toBeUndefined();
      expect((profile as any).mfa?.recoveryCodesHashed).toBeUndefined();
    });

    it('should throw NotFoundException if user record does not exist in database', async () => {
      await expect(authService.getCurrentUserProfile('nonexistent_user')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user account is suspended or rejected', async () => {
      mockUser.status = 'suspended';
      await expect(authService.getCurrentUserProfile('user_123')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
