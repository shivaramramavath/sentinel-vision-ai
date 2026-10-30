import { z } from 'zod';

/**
 * Helper to parse human-readable durations ('15m', '8h', '30d', '60s') into integer seconds.
 */
export function parseDurationToSeconds(duration: string): number {
  if (!duration) return 0;
  const match = duration.trim().match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid duration format '${duration}'. Expected format: e.g. '15m', '8h', '30d', '60s'`);
  }
  const val = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
      return val;
    case 'm':
      return val * 60;
    case 'h':
      return val * 3600;
    case 'd':
      return val * 86400;
    default:
      return val;
  }
}

const durationRegex = /^\d+[smhd]$/;

const booleanEnum = (defaultValue: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(defaultValue)
    .transform((val) => val === 'true');

const commaSeparatedList = (defaultValue = '') =>
  z
    .string()
    .default(defaultValue)
    .transform((val) =>
      val
        ? val
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
    );

export const EnvSchema = z
  .object({
    // --------------------------------------------------------------------------
    // 1. Server Configuration
    // --------------------------------------------------------------------------
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    API_HOST: z.string().default('0.0.0.0'),
    API_GLOBAL_PREFIX: z.string().default('api/v1'),
    API_URL: z.string().url().default('http://localhost:3001'),
    WEB_URL: z.string().url().default('http://localhost:3000'),
    MOBILE_BASE_URL: z.string().optional().default(''),
    CORS_ORIGIN: commaSeparatedList('http://localhost:3000'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    TRUST_PROXY: booleanEnum('false'),

    // --------------------------------------------------------------------------
    // 2. Auth, Session & Security Tokens
    // --------------------------------------------------------------------------
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_ACCESS_TTL: z.string().regex(durationRegex, 'JWT_ACCESS_TTL must match duration format (e.g. 15m)').default('15m'),
    JWT_ISSUER: z.string().default('sentinel-vision-ai'),
    JWT_AUDIENCE_WEB: z.string().default('web'),
    JWT_AUDIENCE_MOBILE: z.string().default('mobile'),

    REFRESH_TOKEN_PEPPER: z.string().min(32, 'REFRESH_TOKEN_PEPPER must be at least 32 characters'),
    SESSION_IDLE_TTL: z.string().regex(durationRegex, 'SESSION_IDLE_TTL must match duration format (e.g. 8h)').default('8h'),
    SESSION_ABSOLUTE_TTL: z.string().regex(durationRegex, 'SESSION_ABSOLUTE_TTL must match duration format (e.g. 30d)').default('30d'),
    SESSION_ABSOLUTE_TTL_ADMIN: z.string().regex(durationRegex, 'SESSION_ABSOLUTE_TTL_ADMIN must match duration format (e.g. 7d)').default('7d'),
    SESSION_MAX_CONCURRENT: z.coerce.number().int().min(1).max(100).default(5),
    REFRESH_GRACE_SECONDS: z.coerce.number().int().min(0).max(300).default(15),
    STEP_UP_TTL: z.string().regex(durationRegex, 'STEP_UP_TTL must match duration format (e.g. 10m)').default('10m'),

    COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 characters'),
    COOKIE_DOMAIN: z.string().optional().default(''),
    COOKIE_SECURE: booleanEnum('false'),
    COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    REFRESH_COOKIE_NAME: z.string().default('sentinel_rt'),
    INTERNAL_SERVICE_TOKEN: z.string().min(32, 'INTERNAL_SERVICE_TOKEN must be at least 32 characters'),

    // --------------------------------------------------------------------------
    // 3. OAuth 2.0 Identity Providers
    // --------------------------------------------------------------------------
    OAUTH_GOOGLE_ENABLED: booleanEnum('false'),
    GOOGLE_CLIENT_ID: z.string().optional().default(''),
    GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
    GOOGLE_CALLBACK_URL: z.string().optional().default(''),

    OAUTH_GITHUB_ENABLED: booleanEnum('false'),
    GITHUB_CLIENT_ID: z.string().optional().default(''),
    GITHUB_CLIENT_SECRET: z.string().optional().default(''),
    GITHUB_CALLBACK_URL: z.string().optional().default(''),

    // --------------------------------------------------------------------------
    // 4. Email Delivery (Brevo REST API)
    // --------------------------------------------------------------------------
    BREVO_API_KEY: z.string().optional().default(''),
    BREVO_SENDER_NAME: z.string().optional().default(''),
    BREVO_SENDER_EMAIL: z.string().optional().default(''),
    BREVO_TIMEOUT_SECONDS: z.coerce.number().int().min(1).max(60).default(10),
    BREVO_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(5),
    EMAIL_RATE_PER_MINUTE: z.coerce.number().int().min(1).max(1000).default(20),
    EMAIL_DAILY_CAP: z.coerce.number().int().min(1).max(100000).default(250),
    BREVO_WEBHOOK_SECRET: z.string().optional().default(''),

    // --------------------------------------------------------------------------
    // 5. Governance, Authorization & Rate Limits
    // --------------------------------------------------------------------------
    AUTH_ALLOWED_EMAIL_DOMAINS: commaSeparatedList(''),
    AUTH_REQUIRE_ADMIN_APPROVAL: booleanEnum('true'),
    AUTH_REGISTRATION_ENABLED: booleanEnum('true'),
    AUTH_MAX_FAILED_LOGINS: z.coerce.number().int().min(1).max(50).default(5),
    AUTH_LOCKOUT_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
    THROTTLE_TTL_SECONDS: z.coerce.number().int().min(1).default(60),
    THROTTLE_LIMIT: z.coerce.number().int().min(1).default(100),
    SEED_DEFAULT_PASSWORD: z.string().min(12, 'SEED_DEFAULT_PASSWORD must be at least 12 characters'),

    // --------------------------------------------------------------------------
    // 6. CAPTCHA (Cloudflare Turnstile)
    // --------------------------------------------------------------------------
    TURNSTILE_SECRET_KEY: z.string().min(1, 'TURNSTILE_SECRET_KEY is required'),

    // --------------------------------------------------------------------------
    // 7. Databases & Caching (MongoDB Atlas & Redis)
    // --------------------------------------------------------------------------
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().int().default(6379),
    REDIS_PASSWORD: z.string().min(1, 'REDIS_PASSWORD is required'),
    REDIS_DB: z.coerce.number().int().default(0),
    REDIS_KEY_PREFIX: z.string().default('sentinel:'),

    // --------------------------------------------------------------------------
    // 8. Event Bus (Kafka)
    // --------------------------------------------------------------------------
    KAFKA_BROKERS: z.string().min(1, 'KAFKA_BROKERS is required'),
    KAFKA_CLIENT_ID: z.string().default('sentinel-api'),
    KAFKA_GROUP_ID: z.string().default('sentinel-api'),

    // --------------------------------------------------------------------------
    // 9. Vector Database (Pinecone)
    // --------------------------------------------------------------------------
    PINECONE_API_KEY: z.string().min(1, 'PINECONE_API_KEY is required'),
    PINECONE_CLOUD: z.enum(['aws', 'gcp', 'azure']).default('aws'),
    PINECONE_REGION: z.string().default('us-east-1'),
    PINECONE_INDEX_FACE: z.string().default('sentinel-face'),
    PINECONE_INDEX_REID: z.string().default('sentinel-reid'),
    PINECONE_FACE_DIM: z.coerce.number().int().default(512),
    PINECONE_REID_DIM: z.coerce.number().int().default(512),
    PINECONE_METRIC: z.enum(['cosine', 'dotproduct', 'euclidean']).default('cosine'),
    PINECONE_NAMESPACE_PREFIX: z.string().default('dev'),

    // --------------------------------------------------------------------------
    // 10. Media Storage (Cloudinary & Continuous Recordings)
    // --------------------------------------------------------------------------
    STORAGE_DRIVER: z.enum(['cloudinary', 'minio']).default('cloudinary'),
    CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
    CLOUDINARY_API_KEY: z.string().optional().default(''),
    CLOUDINARY_API_SECRET: z.string().optional().default(''),
    CLOUDINARY_URL: z.string().optional().default(''),
    CLOUDINARY_ROOT_FOLDER: z.string().default('sentinel/dev'),
    CLOUDINARY_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().default(300),
    CLOUDINARY_NOTIFICATION_URL: z.string().optional().default(''),
    CLOUDINARY_MAX_IMAGE_MB: z.coerce.number().int().default(25),
    CLOUDINARY_MAX_VIDEO_MB: z.coerce.number().int().default(100),
    RECORDING_DRIVER: z.enum(['minio', 'local', 'off']).default('minio'),

    // --------------------------------------------------------------------------
    // 11. Media / WebRTC / TURN
    // --------------------------------------------------------------------------
    MEDIA_BASE_URL: z.string().url('MEDIA_BASE_URL must be a valid URL'),
    MEDIA_HLS_URL: z.string().url('MEDIA_HLS_URL must be a valid URL').default('http://localhost:8888'),
    MEDIA_RTSP_URL: z.string().default('rtsp://localhost:8554'),
    MEDIA_API_URL: z.string().url('MEDIA_API_URL must be a valid URL').default('http://localhost:9997'),
    STUN_URLS: commaSeparatedList('stun:stun.l.google.com:19302'),
    TURN_URLS: commaSeparatedList('turn:localhost:3478'),
    TURN_SECRET: z.string().min(16, 'TURN_SECRET must be at least 16 characters'),
    TURN_CREDENTIAL_TTL_SECONDS: z.coerce.number().int().default(600),
    // --------------------------------------------------------------------------
    // 11. Super Admin Bootstrap Configuration
    // --------------------------------------------------------------------------
    ADMIN_BOOTSTRAP_ENABLED: booleanEnum('false'),
    ADMIN_NAME: z.string().default('System Administrator'),
    ADMIN_EMAIL: z.string().optional().default(''),
    ADMIN_PASSWORD: z.string().optional().default(''),
    ADMIN_BADGE_NUMBER: z.string().optional().default('SA-0001'),
    ADMIN_DEPARTMENT: z.string().optional().default('Platform Administration'),
    ADMIN_MUST_CHANGE_PASSWORD: booleanEnum('true'),
    ADMIN_REQUIRE_MFA_SETUP: booleanEnum('true'),
    ADMIN_FORCE_PASSWORD_RESET: booleanEnum('false'),
    ADMIN_PROMOTE_EXISTING: booleanEnum('false'),
  })
  .superRefine((data, ctx) => {
    const isProd = data.NODE_ENV === 'production';

    // 1. Email (Brevo) Validation
    if (data.NODE_ENV !== 'test') {
      if (!data.BREVO_API_KEY || data.BREVO_API_KEY.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['BREVO_API_KEY'],
          message: 'BREVO_API_KEY is required for transactional email delivery in production and development',
        });
      }
      if (!data.BREVO_SENDER_EMAIL || !data.BREVO_SENDER_EMAIL.includes('@')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['BREVO_SENDER_EMAIL'],
          message: 'A valid BREVO_SENDER_EMAIL is required for transactional email delivery',
        });
      }
      if (!data.BREVO_SENDER_NAME || data.BREVO_SENDER_NAME.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['BREVO_SENDER_NAME'],
          message: 'BREVO_SENDER_NAME is required for transactional email delivery',
        });
      }
    }

    // 2. OAuth Google Validation
    if (data.OAUTH_GOOGLE_ENABLED) {
      if (!data.GOOGLE_CLIENT_ID || data.GOOGLE_CLIENT_ID.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['GOOGLE_CLIENT_ID'],
          message: 'GOOGLE_CLIENT_ID is required when OAUTH_GOOGLE_ENABLED=true',
        });
      }
      if (!data.GOOGLE_CLIENT_SECRET || data.GOOGLE_CLIENT_SECRET.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['GOOGLE_CLIENT_SECRET'],
          message: 'GOOGLE_CLIENT_SECRET is required when OAUTH_GOOGLE_ENABLED=true',
        });
      }
      if (!data.GOOGLE_CALLBACK_URL || !data.GOOGLE_CALLBACK_URL.startsWith('http')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['GOOGLE_CALLBACK_URL'],
          message: 'GOOGLE_CALLBACK_URL must be a valid URL when OAUTH_GOOGLE_ENABLED=true',
        });
      }
    }

    // 3. OAuth GitHub Validation
    if (data.OAUTH_GITHUB_ENABLED) {
      if (!data.GITHUB_CLIENT_ID || data.GITHUB_CLIENT_ID.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['GITHUB_CLIENT_ID'],
          message: 'GITHUB_CLIENT_ID is required when OAUTH_GITHUB_ENABLED=true',
        });
      }
      if (!data.GITHUB_CLIENT_SECRET || data.GITHUB_CLIENT_SECRET.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['GITHUB_CLIENT_SECRET'],
          message: 'GITHUB_CLIENT_SECRET is required when OAUTH_GITHUB_ENABLED=true',
        });
      }
      if (!data.GITHUB_CALLBACK_URL || !data.GITHUB_CALLBACK_URL.startsWith('http')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['GITHUB_CALLBACK_URL'],
          message: 'GITHUB_CALLBACK_URL must be a valid URL when OAUTH_GITHUB_ENABLED=true',
        });
      }
    }

    // 4. Storage Driver Cloudinary Validation
    if (data.STORAGE_DRIVER === 'cloudinary') {
      const hasUrl = Boolean(data.CLOUDINARY_URL && data.CLOUDINARY_URL.startsWith('cloudinary://'));
      const hasKeys = Boolean(
        data.CLOUDINARY_CLOUD_NAME &&
        data.CLOUDINARY_API_KEY &&
        data.CLOUDINARY_API_SECRET
      );

      if (!hasUrl && !hasKeys) {
        if (!data.CLOUDINARY_CLOUD_NAME) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['CLOUDINARY_CLOUD_NAME'],
            message: 'CLOUDINARY_CLOUD_NAME is required when STORAGE_DRIVER=cloudinary',
          });
        }
        if (!data.CLOUDINARY_API_KEY) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['CLOUDINARY_API_KEY'],
            message: 'CLOUDINARY_API_KEY is required when STORAGE_DRIVER=cloudinary',
          });
        }
        if (!data.CLOUDINARY_API_SECRET) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['CLOUDINARY_API_SECRET'],
            message: 'CLOUDINARY_API_SECRET is required when STORAGE_DRIVER=cloudinary',
          });
        }
      }
    }

    // 5. Production Strict Security Rules
    if (isProd) {
      if (!data.COOKIE_SECURE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['COOKIE_SECURE'],
          message: 'COOKIE_SECURE must be true in production',
        });
      }

      if (data.TURNSTILE_SECRET_KEY.startsWith('1x000000')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['TURNSTILE_SECRET_KEY'],
          message: 'Cloudflare Turnstile test keys (1x000...) are strictly forbidden in production',
        });
      }

      if (!data.API_URL.startsWith('https://')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['API_URL'],
          message: 'API_URL must use https:// in production',
        });
      }

      if (!data.WEB_URL.startsWith('https://')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['WEB_URL'],
          message: 'WEB_URL must use https:// in production',
        });
      }

      if (data.SEED_DEFAULT_PASSWORD && data.SEED_DEFAULT_PASSWORD.length < 12) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SEED_DEFAULT_PASSWORD'],
          message: 'SEED_DEFAULT_PASSWORD must be at least 12 characters in production',
        });
      }

      // Check for placeholder strings in secrets
      const secretsToCheck: Record<string, string> = {
        JWT_ACCESS_SECRET: data.JWT_ACCESS_SECRET,
        REFRESH_TOKEN_PEPPER: data.REFRESH_TOKEN_PEPPER,
        COOKIE_SECRET: data.COOKIE_SECRET,
        INTERNAL_SERVICE_TOKEN: data.INTERNAL_SERVICE_TOKEN,
        TURN_SECRET: data.TURN_SECRET,
        REDIS_PASSWORD: data.REDIS_PASSWORD,
      };

      for (const [name, val] of Object.entries(secretsToCheck)) {
        if (/development|change-in-production|REPLACE/i.test(val)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [name],
            message: `${name} contains placeholder or development tokens, forbidden in production`,
          });
        }
      }

      if (data.MOBILE_BASE_URL && /REPLACE/i.test(data.MOBILE_BASE_URL)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['MOBILE_BASE_URL'],
          message: 'MOBILE_BASE_URL contains placeholder value in production',
        });
      }
    }
    // 6. Super Admin Bootstrap Validation
    if (data.ADMIN_BOOTSTRAP_ENABLED) {
      if (!data.ADMIN_EMAIL || !z.string().email().safeParse(data.ADMIN_EMAIL).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ADMIN_EMAIL'],
          message: 'ADMIN_EMAIL is required and must be a valid email when ADMIN_BOOTSTRAP_ENABLED=true',
        });
      }

      if (!data.ADMIN_PASSWORD) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ADMIN_PASSWORD'],
          message: 'ADMIN_PASSWORD is required when ADMIN_BOOTSTRAP_ENABLED=true',
        });
      } else {
        const pass = data.ADMIN_PASSWORD;
        const hasUpper = /[A-Z]/.test(pass);
        const hasLower = /[a-z]/.test(pass);
        const hasDigit = /[0-9]/.test(pass);
        const hasSymbol = /[^A-Za-z0-9]/.test(pass);
        const symbolCount = (pass.match(/[^A-Za-z0-9]/g) || []).length;
        const meetsComplexity = hasUpper && hasLower && hasSymbol && (hasDigit || (!isProd && symbolCount >= 2));
        if (pass.length < 12 || !meetsComplexity) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['ADMIN_PASSWORD'],
            message: 'ADMIN_PASSWORD must be at least 12 characters with upper, lower, digit and symbol',
          });
        }
        if (data.SEED_DEFAULT_PASSWORD && pass === data.SEED_DEFAULT_PASSWORD) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['ADMIN_PASSWORD'],
            message: 'ADMIN_PASSWORD must differ from SEED_DEFAULT_PASSWORD',
          });
        }
      }

      if (isProd) {
        if (!data.ADMIN_MUST_CHANGE_PASSWORD) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['ADMIN_MUST_CHANGE_PASSWORD'],
            message: 'ADMIN_MUST_CHANGE_PASSWORD must be true in production',
          });
        }
        if (data.ADMIN_FORCE_PASSWORD_RESET) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['ADMIN_FORCE_PASSWORD_RESET'],
            message: 'ADMIN_FORCE_PASSWORD_RESET is a dev-only flag and must be false in production',
          });
        }
        if (data.ADMIN_PROMOTE_EXISTING) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['ADMIN_PROMOTE_EXISTING'],
            message: 'ADMIN_PROMOTE_EXISTING is a dev-only flag and must be false in production',
          });
        }
      }
    }
  });

export type Env = z.infer<typeof EnvSchema>;
