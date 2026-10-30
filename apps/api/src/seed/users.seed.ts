import * as argon2 from 'argon2';
import { Model } from 'mongoose';
import { UserDocument } from '../users/schemas/user.schema';
import { MobileUserDocument } from '../mobile/schemas/mobile-user.schema';
import { MobileDeviceDocument } from '../mobile/schemas/mobile-device.schema';

export async function seedUsers(
  userModel: Model<UserDocument>,
  mobileUserModel: Model<MobileUserDocument>,
  mobileDeviceModel: Model<MobileDeviceDocument>,
  options: { reset?: boolean } = {},
) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Safety check: Seeding database is strictly forbidden in production environment.');
  }

  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD || 'Sentinel@2026';
  const hashedPassword = await argon2.hash(defaultPassword, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
  });

  const now = new Date();

  const usersToSeed = [
    // 1x Super Admin
    {
      seedKey: 'usr_001',
      email: 'admin@sentinel.local',
      passwordHash: hashedPassword,
      fullName: 'Chief Director Robert Vance',
      badgeNumber: 'SVT-001',
      role: 'super_admin',
      status: 'active',
      active: true,
      emailVerifiedAt: now,
      department: 'Directorate of Command & Intelligence',
      mfa: { enabled: false, recoveryCodesHashed: [] },
      mustChangePassword: false,
      mfaEnrollmentRequired: false,
      seed: true,
    },
    // 2x Investigator
    {
      seedKey: 'usr_002',
      email: 'sarah.vance@sentinel.local',
      passwordHash: hashedPassword,
      fullName: 'Insp. Sarah Vance',
      badgeNumber: 'INV-4821',
      role: 'investigator',
      status: 'active',
      active: true,
      emailVerifiedAt: now,
      department: 'Special Missing Persons Division',
      mfa: { enabled: false, recoveryCodesHashed: [] },
      mustChangePassword: false,
      mfaEnrollmentRequired: false,
      seed: true,
    },
    {
      seedKey: 'usr_007',
      email: 'm.brody@sentinel.local',
      passwordHash: hashedPassword,
      fullName: 'Det. Marcus Brody',
      badgeNumber: 'MB-1184',
      role: 'investigator',
      status: 'active',
      active: true,
      emailVerifiedAt: now,
      department: 'Surveillance Review Team',
      mfa: { enabled: false, recoveryCodesHashed: [] },
      mustChangePassword: false,
      mfaEnrollmentRequired: false,
      seed: true,
    },
    // 2x Reviewer
    {
      seedKey: 'usr_003',
      email: 'marcus.chen@sentinel.local',
      passwordHash: hashedPassword,
      fullName: 'Officer Marcus Chen',
      badgeNumber: 'REV-9204',
      role: 'reviewer',
      status: 'active',
      active: true,
      emailVerifiedAt: now,
      department: 'Biometric Verification Unit',
      mfa: { enabled: false, recoveryCodesHashed: [] },
      mustChangePassword: false,
      mfaEnrollmentRequired: false,
      seed: true,
    },
    {
      seedKey: 'usr_008',
      email: 'e.rostova@sentinel.local',
      passwordHash: hashedPassword,
      fullName: 'Analyst Elena Rostova',
      badgeNumber: 'ER-8821',
      role: 'reviewer',
      status: 'active',
      active: true,
      emailVerifiedAt: now,
      department: 'Biometric Vector Forensics',
      mfa: { enabled: false, recoveryCodesHashed: [] },
      mustChangePassword: false,
      mfaEnrollmentRequired: false,
      seed: true,
    },
    // 1x Viewer
    {
      seedKey: 'usr_004',
      email: 'viewer@sentinel.local',
      passwordHash: hashedPassword,
      fullName: 'Auditor James Kelly',
      badgeNumber: 'AUD-1002',
      role: 'viewer',
      status: 'active',
      active: true,
      emailVerifiedAt: now,
      department: 'Judicial Oversight & Ethics Office',
      mfa: { enabled: false, recoveryCodesHashed: [] },
      mustChangePassword: false,
      mfaEnrollmentRequired: false,
      seed: true,
    },
    // Edge case test accounts
    {
      seedKey: 'usr_005',
      email: 'pending.officer@sentinel.local',
      passwordHash: hashedPassword,
      fullName: 'Candidate Officer Maya Lin',
      badgeNumber: 'CND-8901',
      role: 'viewer',
      status: 'pending_approval',
      active: true,
      emailVerifiedAt: now,
      department: 'Transit Security Division',
      mfa: { enabled: false, recoveryCodesHashed: [] },
      mustChangePassword: false,
      mfaEnrollmentRequired: false,
      seed: true,
    },
    {
      seedKey: 'usr_006',
      email: 'suspended.officer@sentinel.local',
      passwordHash: hashedPassword,
      fullName: 'Former Officer Kyle Hayes',
      badgeNumber: 'SUS-4091',
      role: 'viewer',
      status: 'suspended',
      active: false,
      emailVerifiedAt: now,
      department: 'Special Operations (Revoked)',
      mfa: { enabled: false, recoveryCodesHashed: [] },
      mustChangePassword: false,
      mfaEnrollmentRequired: false,
      seed: true,
    },
  ];

  if (options.reset) {
    await userModel.deleteMany({ seed: true });
    await mobileUserModel.deleteMany({ seed: true });
    await mobileDeviceModel.deleteMany({ seed: true });
  }

  const seededEmails: string[] = [];

  for (const u of usersToSeed) {
    await userModel.findOneAndUpdate(
      { $or: [{ seedKey: u.seedKey }, { email: u.email }] },
      { $set: u },
      { upsert: true, new: true },
    );
    seededEmails.push(u.email);
  }

  // 1x Active Mobile Operator with 1 approved streaming device
  const activeMobUser = await mobileUserModel.findOneAndUpdate(
    { mobileUserId: 'mob_user_active' },
    {
      $set: {
        mobileUserId: 'mob_user_active',
        fullName: 'Officer Alex Rivera (Patrol)',
        email: 'operator.live@sentinel.local',
        phoneE164: '+15550192834',
        passwordHash: hashedPassword,
        status: 'active',
        consent: {
          acceptedAt: now,
          termsVersion: '1.0',
          ip: '127.0.0.1',
          userAgent: 'SentinelSeeder/2.1',
        },
        seed: true,
        seedKey: 'mob_user_active',
      },
    },
    { upsert: true, new: true },
  );
  seededEmails.push('operator.live@sentinel.local');

  // Seed Mobile Device for operator
  await mobileDeviceModel.findOneAndUpdate(
    { deviceId: 'mob_dev_01' },
    {
      $set: {
        deviceId: 'mob_dev_01',
        mobileUserId: activeMobUser.mobileUserId,
        cameraId: 'CAM-099',
        label: 'Field Bodycam Unit #4',
        platform: 'Android 14 / Pixel 8 Pro',
        browser: 'Chrome Mobile 128',
        deviceKeyHash: 'sha256_mock_device_key_hash_01',
        status: 'approved',
        seed: true,
        seedKey: 'mob_dev_01',
      },
    },
    { upsert: true, new: true },
  );

  return { seededEmails, count: usersToSeed.length + 1 };
}
