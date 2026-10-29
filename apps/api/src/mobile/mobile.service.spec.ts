import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { MobileAuthService } from './services/mobile-auth.service';
import { MobileDevicesService } from './services/mobile-devices.service';
import { MobileAdminService } from './services/mobile-admin.service';
import { MobileUser } from './schemas/mobile-user.schema';
import { MobileDevice } from './schemas/mobile-device.schema';
import { StreamSession } from './schemas/stream-session.schema';
import { MobileInvite } from './schemas/mobile-invite.schema';
import { Camera } from '../cameras/schemas/camera.schema';
import { RedisService } from '../common/redis/redis.service';
import { KafkaService } from '../common/kafka/kafka.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { AuditService } from '../audit/audit.service';

describe('Mobile Operator Auth, Device & Fleet Ingestion Tests', () => {
  let authService: MobileAuthService;
  let devicesService: MobileDevicesService;
  let adminService: MobileAdminService;

  const mockUsersList: any[] = [];
  const mockDevicesList: any[] = [];
  const mockSessionsList: any[] = [];
  const mockInvitesList: any[] = [];
  const mockCamerasList: any[] = [];

  class MockDoc {
    [key: string]: any;
    constructor(data: any) {
      Object.assign(this, data);
    }
    async save() {
      return this;
    }
    get(key: string) {
      return this[key] || new Date().toISOString();
    }
  }

  function createMockModel(list: any[]) {
    return class {
      [key: string]: any;
      constructor(data: any) {
        Object.assign(this, data);
      }
      async save() {
        const doc = new MockDoc(this);
        list.push(doc);
        return doc;
      }
      static async findOne(query: any) {
        if (query.email) {
          return list.find((u) => u.email === query.email) || null;
        }
        if (query.mobileUserId) {
          return list.find((u) => u.mobileUserId === query.mobileUserId) || null;
        }
        if (query.deviceId) {
          return list.find((d) => d.deviceId === query.deviceId) || null;
        }
        if (query.sessionId) {
          return list.find((s) => s.sessionId === query.sessionId) || null;
        }
        if (query.codeHash) {
          return list.find((i) => i.codeHash === query.codeHash) || null;
        }
        if (query.inviteId) {
          return list.find((i) => i.inviteId === query.inviteId) || null;
        }
        return list[0] || null;
      }
      static find(query: any = {}) {
        return {
          sort: () => list.filter((item) => !query.status || item.status === query.status),
        };
      }
      static async updateOne(query: any, update: any) {
        return { modifiedCount: 1 };
      }
      static async updateMany() {
        return { modifiedCount: 1 };
      }
    };
  }

  const MockUserModel = createMockModel(mockUsersList);
  const MockDeviceModel = createMockModel(mockDevicesList);
  const MockSessionModel = createMockModel(mockSessionsList);
  const MockInviteModel = createMockModel(mockInvitesList);
  const MockCameraModel = createMockModel(mockCamerasList);

  const mockRedisMap = new Map<string, string>();
  const mockRedisService = {
    get: jest.fn(async (key: string) => mockRedisMap.get(key) || null),
    set: jest.fn(async (key: string, val: string) => {
      mockRedisMap.set(key, val);
    }),
    del: jest.fn(async (key: string) => {
      mockRedisMap.delete(key);
    }),
    incr: jest.fn(async (key: string) => {
      const current = parseInt(mockRedisMap.get(key) || '0', 10);
      mockRedisMap.set(key, String(current + 1));
      return current + 1;
    }),
  };

  const mockAuditService = {
    recordLog: jest.fn(async () => ({})),
  };

  const mockJwtService = {
    signAsync: jest.fn(async (payload: any) => `jwt_token_${payload.sub || payload.role}`),
    verifyAsync: jest.fn(async (token: string) => {
      if (token.includes('invalid')) throw new Error('Invalid token');
      return { sub: 'musr_123', aud: 'mobile', role: 'mobile_operator' };
    }),
  };

  const mockNotificationsGateway = {
    broadcastCameraStatus: jest.fn(),
  };

  beforeEach(async () => {
    mockUsersList.length = 0;
    mockDevicesList.length = 0;
    mockSessionsList.length = 0;
    mockInvitesList.length = 0;
    mockCamerasList.length = 0;
    mockRedisMap.clear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MobileAuthService,
        MobileDevicesService,
        MobileAdminService,
        { provide: getModelToken(MobileUser.name), useValue: MockUserModel },
        { provide: getModelToken(MobileDevice.name), useValue: MockDeviceModel },
        { provide: getModelToken(StreamSession.name), useValue: MockSessionModel },
        { provide: getModelToken(MobileInvite.name), useValue: MockInviteModel },
        { provide: getModelToken(Camera.name), useValue: MockCameraModel },
        { provide: JwtService, useValue: mockJwtService },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback: any) => fallback,
          },
        },
        { provide: RedisService, useValue: mockRedisService },
        { provide: KafkaService, useValue: { publishEvent: jest.fn() } },
        { provide: NotificationsGateway, useValue: mockNotificationsGateway },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    authService = module.get<MobileAuthService>(MobileAuthService);
    devicesService = module.get<MobileDevicesService>(MobileDevicesService);
    adminService = module.get<MobileAdminService>(MobileAdminService);
  });

  describe('1. Mobile Registration & Password Strength', () => {
    it('rejects passwords shorter than 10 characters', async () => {
      await expect(
        authService.register({
          fullName: 'Officer Chen',
          email: 'chen@police.gov',
          password: 'short',
          consentAccepted: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects trivial / weak passwords (zxcvbn < 3)', async () => {
      await expect(
        authService.register({
          fullName: 'Officer Chen',
          email: 'chen@police.gov',
          password: 'password12345678', // common dictionary pattern
          consentAccepted: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('successfully registers valid mobile user with status pending_verification and stores 6-digit OTP in Redis', async () => {
      const res = await authService.register({
        fullName: 'Officer Sarah Connor',
        email: 'sarah.connor@sentinel.org',
        password: 'K9#Cyber!Guardian2026',
        consentAccepted: true,
      });

      expect(res.status).toBe('pending_verification');
      expect(mockUsersList.length).toBe(1);
      expect(mockUsersList[0].status).toBe('pending_verification');
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'mobile:otp:sarah.connor@sentinel.org',
        expect.any(String),
        600,
      );
    });
  });

  describe('2. OTP Verification & Status Transition', () => {
    it('transitions user to pending_approval when verified without autoApprove invite', async () => {
      await authService.register({
        fullName: 'Officer Sarah Connor',
        email: 'sarah@sentinel.org',
        password: 'K9#Cyber!Guardian2026',
        consentAccepted: true,
      });

      const storedHash = mockRedisMap.get('mobile:otp:sarah@sentinel.org');
      expect(storedHash).toBeDefined();

      // Call verify with matching hash (simulate matching OTP)
      authService['hashSecret'] = jest.fn(() => storedHash!);

      const verifyRes = await authService.verify({
        email: 'sarah@sentinel.org',
        otp: '123456',
      });

      expect(verifyRes.status).toBe('pending_approval');
      expect(mockUsersList[0].status).toBe('pending_approval');
    });

    it('locks out OTP verification after 5 failed attempts', async () => {
      await authService.register({
        fullName: 'Officer Sarah Connor',
        email: 'sarah2@sentinel.org',
        password: 'K9#Cyber!Guardian2026',
        consentAccepted: true,
      });

      const storedHash = mockRedisMap.get('mobile:otp:sarah2@sentinel.org');
      expect(storedHash).toBeDefined();

      // Force incorrect OTP hash
      authService['hashSecret'] = jest.fn(() => 'wrong_hash');

      for (let i = 0; i < 5; i++) {
        await expect(
          authService.verify({ email: 'sarah2@sentinel.org', otp: '000000' }),
        ).rejects.toThrow('Invalid verification code');
      }

      await expect(
        authService.verify({ email: 'sarah2@sentinel.org', otp: '000000' }),
      ).rejects.toThrow(/Too many invalid attempts/);
    });
  });

  describe('3. Login Restrictions & Security Realm', () => {
    it('blocks login for users in pending_approval with clear informative message', async () => {
      const user = new MockDoc({
        mobileUserId: 'musr_pending',
        fullName: 'Pending Officer',
        email: 'pending@sentinel.org',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummy$dummy',
        status: 'pending_approval',
      });
      mockUsersList.push(user);

      const argon2 = require('argon2');
      jest.spyOn(argon2, 'verify').mockResolvedValueOnce(true);

      await expect(
        authService.login({
          email: 'pending@sentinel.org',
          password: 'StrongPassword123!',
        }),
      ).rejects.toThrow(/awaiting administrator approval/);
    });

    it('locks account for 15 minutes after 5 consecutive failed passwords', async () => {
      const user = new MockDoc({
        mobileUserId: 'musr_active',
        fullName: 'Active Officer',
        email: 'active@sentinel.org',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummy$dummy',
        status: 'active',
        failedLoginCount: 0,
      });
      mockUsersList.push(user);

      const argon2 = require('argon2');
      jest.spyOn(argon2, 'verify').mockResolvedValue(false);

      for (let i = 0; i < 5; i++) {
        await expect(
          authService.login({ email: 'active@sentinel.org', password: 'wrong' }),
        ).rejects.toThrow(UnauthorizedException);
      }

      expect(user.lockedUntil).toBeDefined();
    });
  });

  describe('4. Device Onboarding & WHIP Streaming Session', () => {
    it('registers mobile device, generates one-time deviceKey, and creates Camera record', async () => {
      const user = new MockDoc({
        mobileUserId: 'musr_op1',
        fullName: 'Officer John',
        email: 'john@sentinel.org',
        status: 'active',
        siteIds: ['site_central'],
      });
      mockUsersList.push(user);

      const dev = await devicesService.addDevice('musr_op1', {
        label: 'iPhone 15 Pro Bodycam',
        platform: 'iOS',
        browser: 'Safari',
        defaultFacing: 'environment',
        shareGps: true,
        consentConfirmed: true,
      });

      expect(dev.deviceId).toMatch(/^mdev_/);
      expect(dev.cameraId).toMatch(/^cam_mob_/);
      expect(dev.deviceKey).toBeDefined();
      expect(dev.status).toBe('approved');
      expect(mockCamerasList.length).toBe(1);
    });

    it('starts WHIP streaming session with 5-minute publish token and coturn credentials', async () => {
      const user = new MockDoc({
        mobileUserId: 'musr_op2',
        fullName: 'Officer Jane',
        email: 'jane@sentinel.org',
        status: 'active',
        siteIds: ['site_central'],
      });
      mockUsersList.push(user);

      const dev = new MockDoc({
        deviceId: 'mdev_test1',
        mobileUserId: 'musr_op2',
        cameraId: 'cam_mob_test1',
        status: 'approved',
        label: 'Pixel 8 Patrol',
      });
      mockDevicesList.push(dev);

      const session = await devicesService.startSession('musr_op2', 'mdev_test1');

      expect(session.sessionId).toMatch(/^msess_/);
      expect(session.whipUrl).toContain('cam/cam_mob_test1/whip');
      expect(session.publishToken).toBeDefined();
      expect(session.iceServers.length).toBeGreaterThan(0);
      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringContaining('mobile:publish_jti:'),
        'cam_mob_test1',
        300,
      );
    });
  });

  describe('5. Admin Fleet & Invite Operations', () => {
    it('creates shareable invite code with site mapping and expiration', async () => {
      const invite = await adminService.createInvite({
        siteId: 'site_north',
        expiresInHours: 48,
        maxUses: 25,
        autoApprove: true,
      });

      expect(invite.inviteCode).toMatch(/^SENT-/);
      expect(invite.registrationUrl).toContain(`/m/register?invite=${invite.inviteCode}`);
      expect(invite.siteId).toBe('site_north');
      expect(mockInvitesList.length).toBe(1);
    });

    it('allows admin to approve pending mobile operator registration', async () => {
      const user = new MockDoc({
        mobileUserId: 'musr_pending2',
        fullName: 'Officer Pending',
        email: 'pending2@sentinel.org',
        status: 'pending_approval',
      });
      mockUsersList.push(user);

      const approved = await adminService.updateUserStatus('musr_pending2', 'approve');
      expect(approved.status).toBe('active');
    });
  });
});
