import { registerAs } from '@nestjs/config';

export const adminConfig = registerAs('admin', () => ({
  bootstrapEnabled: process.env.ADMIN_BOOTSTRAP_ENABLED === 'true',
  name: process.env.ADMIN_NAME ?? 'System Administrator',
  email: (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase(),
  password: process.env.ADMIN_PASSWORD ?? '',
  badgeNumber: process.env.ADMIN_BADGE_NUMBER ?? 'SA-0001',
  department: process.env.ADMIN_DEPARTMENT ?? 'Platform Administration',
  mustChangePassword: process.env.ADMIN_MUST_CHANGE_PASSWORD !== 'false',
  requireMfaSetup: process.env.ADMIN_REQUIRE_MFA_SETUP !== 'false',
  forcePasswordReset: process.env.ADMIN_FORCE_PASSWORD_RESET === 'true',
  promoteExisting: process.env.ADMIN_PROMOTE_EXISTING === 'true',
}));
