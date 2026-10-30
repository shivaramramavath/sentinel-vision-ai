import { registerAs } from '@nestjs/config';
import { parseDurationToSeconds } from './env.schema';

export const authConfig = registerAs('auth', () => ({
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? '',
  jwtAccessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  jwtAccessTtlSeconds: parseDurationToSeconds(process.env.JWT_ACCESS_TTL ?? '15m'),
  jwtIssuer: process.env.JWT_ISSUER ?? 'sentinel-vision-ai',
  jwtAudienceWeb: process.env.JWT_AUDIENCE_WEB ?? 'web',
  jwtAudienceMobile: process.env.JWT_AUDIENCE_MOBILE ?? 'mobile',
  refreshTokenPepper: process.env.REFRESH_TOKEN_PEPPER ?? '',
  sessionIdleTtl: process.env.SESSION_IDLE_TTL ?? '8h',
  sessionIdleTtlSeconds: parseDurationToSeconds(process.env.SESSION_IDLE_TTL ?? '8h'),
  sessionAbsoluteTtl: process.env.SESSION_ABSOLUTE_TTL ?? '30d',
  sessionAbsoluteTtlSeconds: parseDurationToSeconds(process.env.SESSION_ABSOLUTE_TTL ?? '30d'),
  sessionAbsoluteTtlAdmin: process.env.SESSION_ABSOLUTE_TTL_ADMIN ?? '7d',
  sessionAbsoluteTtlAdminSeconds: parseDurationToSeconds(process.env.SESSION_ABSOLUTE_TTL_ADMIN ?? '7d'),
  sessionMaxConcurrent: parseInt(process.env.SESSION_MAX_CONCURRENT ?? '5', 10),
  refreshGraceSeconds: parseInt(process.env.REFRESH_GRACE_SECONDS ?? '15', 10),
  stepUpTtl: process.env.STEP_UP_TTL ?? '10m',
  stepUpTtlSeconds: parseDurationToSeconds(process.env.STEP_UP_TTL ?? '10m'),
  cookieSecret: process.env.COOKIE_SECRET ?? '',
  cookieDomain: process.env.COOKIE_DOMAIN ?? '',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  cookieSameSite: (process.env.COOKIE_SAMESITE ?? 'lax') as 'lax' | 'strict' | 'none',
  refreshCookieName: process.env.REFRESH_COOKIE_NAME ?? 'sentinel_rt',
  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN ?? '',
  registrationEnabled: process.env.AUTH_REGISTRATION_ENABLED !== 'false',
  requireAdminApproval: process.env.AUTH_REQUIRE_ADMIN_APPROVAL !== 'false',
  allowedEmailDomains: (process.env.AUTH_ALLOWED_EMAIL_DOMAINS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  maxFailedLogins: parseInt(process.env.AUTH_MAX_FAILED_LOGINS ?? '5', 10),
  lockoutMinutes: parseInt(process.env.AUTH_LOCKOUT_MINUTES ?? '15', 10),
  seedDefaultPassword: process.env.SEED_DEFAULT_PASSWORD ?? '',
  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY ?? '',
}));
