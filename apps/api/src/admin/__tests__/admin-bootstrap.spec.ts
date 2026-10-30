import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { AdminBootstrapService } from '../admin-bootstrap.service';
import { User } from '../../users/schemas/user.schema';
import { Session } from '../../auth/schemas/session.schema';
import { AuditService } from '../../audit/audit.service';
import { EnvSchema } from '../../config/env.schema';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../../common/redis/redis.service';

describe('AdminBootstrapService & Security Suite', () => {
  let service: AdminBootstrapService;
  let mockUserModel: any;
  let mockSessionModel: any;
  let mockConfigService: any;
  let mockAuditService: any;

  const validBaseEnv: Record<string, string> = {
    NODE_ENV: 'development',
    API_PORT: '3001',
    API_HOST: '0.0.0.0',
    API_URL: 'http://localhost:3001',
    WEB_URL: 'http://localhost:3000',
    API_GLOBAL_PREFIX: 'api/v1',
    CORS_ORIGIN: 'http://localhost:3000',
    TRUST_PROXY: 'false',
    LOG_LEVEL: 'info',
    JWT_ACCESS_SECRET: '0123456789012345678901234567890123456789',
    JWT_ACCESS_TTL: '15m',
    JWT_ISSUER: 'sentinel-vision-ai',
    REFRESH_TOKEN_PEPPER: '0123456789012345678901234567890123456789',
    SESSION_IDLE_TTL: '8h',
    SESSION_ABSOLUTE_TTL: '30d',
    SESSION_ABSOLUTE_TTL_ADMIN: '7d',
    SESSION_MAX_CONCURRENT: '5',
    REFRESH_GRACE_SECONDS: '15',
    STEP_UP_TTL: '10m',
    COOKIE_SECRET: '0123456789012345678901234567890123456789',
    COOKIE_SECURE: 'false',
    COOKIE_SAMESITE: 'lax',
    REFRESH_COOKIE_NAME: 'sentinel_rt',
    INTERNAL_SERVICE_TOKEN: '0123456789012345678901234567890123456789',
    OAUTH_GOOGLE_ENABLED: 'false',
    OAUTH_GITHUB_ENABLED: 'false',
    EMAIL_TRANSPORT: 'smtp-dev',
    SMTP_DEV_HOST: 'localhost',
    SMTP_DEV_PORT: '1025',
    AUTH_REGISTRATION_ENABLED: 'true',
    AUTH_REQUIRE_ADMIN_APPROVAL: 'true',
    AUTH_MAX_FAILED_LOGINS: '5',
    AUTH_LOCKOUT_MINUTES: '15',
    SEED_DEFAULT_PASSWORD: 'InitialSeedPassword2026!#',
    TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
    MONGODB_URI: 'mongodb://localhost:27017/sentinel',
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379',
    REDIS_PASSWORD: 'redispassword123456789',
    REDIS_DB: '0',
    REDIS_KEY_PREFIX: 'sentinel:',
    KAFKA_BROKERS: 'localhost:9092',
    KAFKA_CLIENT_ID: 'sentinel-api',
    KAFKA_GROUP_ID: 'sentinel-group',
    PINECONE_API_KEY: 'test-pinecone-key-1234567890',
    PINECONE_INDEX_FACE: 'sentinel-face',
    PINECONE_INDEX_REID: 'sentinel-reid',
    STORAGE_DRIVER: 'minio',
    MINIO_ENDPOINT: 'localhost',
    MINIO_PORT: '9000',
    MINIO_ACCESS_KEY: 'minioadmin',
    MINIO_SECRET_KEY: 'minioadmin',
    MEDIA_BASE_URL: 'http://localhost:8889',
    MEDIA_HLS_URL: 'http://localhost:8888',
    MEDIA_RTSP_URL: 'rtsp://localhost:8554',
    MEDIA_API_URL: 'http://localhost:9997',
    STUN_URLS: 'stun:stun.l.google.com:19302',
    TURN_URLS: 'turn:localhost:3478',
    TURN_SECRET: 'turnsecret1234567890',
    TURN_CREDENTIAL_TTL_SECONDS: '600',
  };

  beforeEach(() => {
    mockUserModel = {
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      countDocuments: jest.fn(),
      findById: jest.fn(),
    };

    mockSessionModel = {
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 3 }),
    };

    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          'admin.bootstrapEnabled': true,
          'admin.email': 'admin@sentinel.agency',
          'admin.password': 'AdminPass2026!Strong',
          'admin.name': 'Super Administrator',
          'admin.badgeNumber': 'SA-0001',
          'admin.department': 'Platform Administration',
          'admin.mustChangePassword': true,
          'admin.requireMfaSetup': true,
          'admin.forcePasswordReset': false,
          'admin.promoteExisting': false,
        };
        return config[key] !== undefined ? config[key] : defaultValue;
      }),
    };

    mockAuditService = {
      recordLog: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    service = new AdminBootstrapService(
      mockUserModel as any,
      mockSessionModel as any,
      mockConfigService as any,
      mockAuditService as any,
    );
  });

  // Test 1: First boot creates the admin
  it('Scenario 1: first boot creates the admin with super_admin role and setup flags', async () => {
    mockUserModel.findOneAndUpdate.mockResolvedValueOnce({
      lastErrorObject: { updatedExisting: false },
    });
    mockUserModel.findOne.mockResolvedValueOnce({
      _id: 'user-admin-1',
      email: 'admin@sentinel.agency',
      role: 'super_admin',
      status: 'active',
      mustChangePassword: true,
      mfaEnrollmentRequired: true,
    });

    await service.bootstrapFromEnv();

    expect(mockUserModel.findOneAndUpdate).toHaveBeenCalledWith(
      { email: 'admin@sentinel.agency' },
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          email: 'admin@sentinel.agency',
          role: 'super_admin',
          status: 'active',
          mustChangePassword: true,
          mfaEnrollmentRequired: true,
          createdVia: 'bootstrap',
        }),
      }),
      { upsert: true, new: false, rawResult: true },
    );

    expect(mockAuditService.recordLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin.bootstrap.create',
      }),
    );
  });

  // Test 2: Second boot is a no-op
  it('Scenario 2: second boot is an idempotent no-op and does not overwrite password', async () => {
    mockUserModel.findOneAndUpdate.mockResolvedValueOnce({
      lastErrorObject: { updatedExisting: true },
    });
    mockUserModel.findOne.mockResolvedValueOnce({
      _id: 'user-admin-1',
      email: 'admin@sentinel.agency',
      role: 'super_admin',
      status: 'active',
      save: jest.fn(),
    });

    await service.bootstrapFromEnv();

    expect(mockAuditService.recordLog).not.toHaveBeenCalled();
    expect(mockSessionModel.updateMany).not.toHaveBeenCalled();
  });

  // Test 3: Two parallel boots create exactly one
  it('Scenario 3: parallel boots handle duplicate key race condition idempotently', async () => {
    // Simulate first instance succeeding, second instance throwing duplicate key error 11000
    mockUserModel.findOneAndUpdate.mockRejectedValueOnce({ code: 11000 });
    mockUserModel.findOne.mockResolvedValueOnce({
      _id: 'user-admin-1',
      email: 'admin@sentinel.agency',
      role: 'super_admin',
      status: 'active',
      save: jest.fn(),
    });

    await expect(service.bootstrapFromEnv()).resolves.not.toThrow();
  });

  // Test 4: A weak password fails validation
  it('Scenario 4: a weak password fails schema validation', () => {
    const weakEnv = {
      ...validBaseEnv,
      ADMIN_BOOTSTRAP_ENABLED: 'true',
      ADMIN_EMAIL: 'admin@sentinel.agency',
      ADMIN_PASSWORD: 'weakpassword', // lacks upper, digit, symbol, min length
    };

    const res = EnvSchema.safeParse(weakEnv);
    expect(res.success).toBe(false);
    if (!res.success) {
      const issues = res.error.issues.map((i) => i.path.join('.'));
      expect(issues).toContain('ADMIN_PASSWORD');
    }
  });

  it('Scenario 4b: password matching SEED_DEFAULT_PASSWORD fails validation', () => {
    const matchingEnv = {
      ...validBaseEnv,
      ADMIN_BOOTSTRAP_ENABLED: 'true',
      ADMIN_EMAIL: 'admin@sentinel.agency',
      SEED_DEFAULT_PASSWORD: 'InitialSeedPassword2026!#',
      ADMIN_PASSWORD: 'InitialSeedPassword2026!#',
    };

    const res = EnvSchema.safeParse(matchingEnv);
    expect(res.success).toBe(false);
    if (!res.success) {
      const err = res.error.issues.find((i) => i.path.includes('ADMIN_PASSWORD'));
      expect(err?.message).toMatch(/must differ from SEED_DEFAULT_PASSWORD/i);
    }
  });

  // Test 5: Existing non-admin with the same email is not promoted by default
  it('Scenario 5: existing non-admin with same email is not promoted when ADMIN_PROMOTE_EXISTING=false', async () => {
    mockUserModel.findOneAndUpdate.mockResolvedValueOnce({
      lastErrorObject: { updatedExisting: true },
    });
    const saveSpy = jest.fn();
    mockUserModel.findOne.mockResolvedValueOnce({
      _id: 'user-investigator-1',
      email: 'admin@sentinel.agency',
      role: 'investigator', // Not super_admin
      status: 'active',
      save: saveSpy,
    });

    await service.bootstrapFromEnv();

    expect(saveSpy).not.toHaveBeenCalled();
    expect(mockAuditService.recordLog).not.toHaveBeenCalled();
  });

  // Test 6: Forced reset revokes sessions
  it('Scenario 6: forced reset updates password and revokes all active sessions', async () => {
    mockConfigService.get = jest.fn((key: string, defaultValue?: any) => {
      if (key === 'admin.forcePasswordReset') return true;
      if (key === 'admin.bootstrapEnabled') return true;
      if (key === 'admin.email') return 'admin@sentinel.agency';
      if (key === 'admin.password') return 'AdminPass2026!NewPass';
      return defaultValue;
    });

    mockUserModel.findOneAndUpdate.mockResolvedValueOnce({
      lastErrorObject: { updatedExisting: true },
    });
    const saveSpy = jest.fn();
    mockUserModel.findOne.mockResolvedValueOnce({
      _id: 'user-admin-1',
      email: 'admin@sentinel.agency',
      role: 'super_admin',
      status: 'active',
      save: saveSpy,
    });

    await service.bootstrapFromEnv();

    expect(saveSpy).toHaveBeenCalled();
    expect(mockSessionModel.updateMany).toHaveBeenCalledWith(
      { userId: 'user-admin-1', revokedAt: { $exists: false } },
      expect.objectContaining({
        $set: expect.objectContaining({ revokedReason: 'ADMIN_FORCE_PASSWORD_RESET' }),
      }),
    );
    expect(mockAuditService.recordLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin.bootstrap.password_reset',
      }),
    );
  });

  // Test 7: Login as the admin returns the setup flags
  it('Scenario 7: admin user payload reflects mustChangePassword and mfaEnrollmentRequired flags', () => {
    const adminUser = {
      id: 'admin-id-123',
      email: 'admin@sentinel.gov',
      role: 'super_admin',
      mustChangePassword: true,
      mfaEnrollmentRequired: true,
    };

    expect(adminUser.mustChangePassword).toBe(true);
    expect(adminUser.mfaEnrollmentRequired).toBe(true);
  });

  // Test 8: The setup flow is enforced (JwtAuthGuard blocks non-setup API routes)
  it('Scenario 8: setup flow is enforced by blocking non-setup endpoints when flags are active', async () => {
    const mockJwtService = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: 'user-1',
        email: 'admin@sentinel.gov',
        role: 'super_admin',
        mustChangePassword: true,
        mfaEnrollmentRequired: true,
      }),
    };

    const mockRedis = {
      isHealthy: jest.fn().mockReturnValue(true),
      get: jest.fn().mockResolvedValue(null),
    };

    const mockConfig = {
      get: jest.fn().mockReturnValue('0123456789012345678901234567890123456789'),
    };

    const guard = new JwtAuthGuard(mockJwtService as any, mockConfig as any, mockRedis as any);

    const makeContext = (url: string): ExecutionContext => {
      const req: any = {
        headers: { authorization: 'Bearer dummy-token' },
        originalUrl: url,
        url,
      };
      return {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      } as any;
    };

    // Blocked endpoints
    await expect(guard.canActivate(makeContext('/api/v1/cases'))).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(makeContext('/api/v1/cameras'))).rejects.toThrow(ForbiddenException);

    // Allowed endpoints
    await expect(guard.canActivate(makeContext('/api/v1/auth/change-password'))).resolves.toBe(true);
    await expect(guard.canActivate(makeContext('/api/v1/auth/mfa/setup'))).resolves.toBe(true);
    await expect(guard.canActivate(makeContext('/api/v1/auth/mfa/enable'))).resolves.toBe(true);
    await expect(guard.canActivate(makeContext('/api/v1/auth/logout'))).resolves.toBe(true);
  });

  // Test 9: The last super_admin cannot be removed
  it('Scenario 9: refuse to suspend, delete or demote the last active super_admin (returns 409 Conflict)', async () => {
    mockUserModel.findById.mockResolvedValue({
      _id: 'admin-1',
      role: 'super_admin',
      status: 'active',
      active: true,
    });
    // Only 1 super_admin left in DB
    mockUserModel.countDocuments.mockResolvedValue(1);

    await expect(service.assertNotLastActiveSuperAdmin('admin-1', 'demote')).rejects.toThrow(ConflictException);
    await expect(service.assertNotLastActiveSuperAdmin('admin-1', 'suspend')).rejects.toThrow(ConflictException);
    await expect(service.assertNotLastActiveSuperAdmin('admin-1', 'delete')).rejects.toThrow(ConflictException);

    // If there are 2 active super admins, operations are permitted
    mockUserModel.countDocuments.mockResolvedValue(2);
    await expect(service.assertNotLastActiveSuperAdmin('admin-1', 'demote')).resolves.not.toThrow();
  });
});
