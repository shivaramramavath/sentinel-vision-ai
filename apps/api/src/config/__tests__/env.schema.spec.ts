import { EnvSchema, parseDurationToSeconds } from '../env.schema';

describe('Environment Configuration Schema (EnvSchema)', () => {
  const validBaseEnv: Record<string, string> = {
    NODE_ENV: 'development',
    API_PORT: '3001',
    API_HOST: '0.0.0.0',
    API_URL: 'http://localhost:3001',
    WEB_URL: 'http://localhost:3000',
    API_GLOBAL_PREFIX: 'api/v1',
    CORS_ORIGIN: 'http://localhost:3000, http://127.0.0.1:3000',
    TRUST_PROXY: 'false',
    LOG_LEVEL: 'info',
    THROTTLE_TTL_SECONDS: '60',
    THROTTLE_LIMIT: '100',

    JWT_ACCESS_SECRET: '0123456789012345678901234567890123456789',
    JWT_ACCESS_TTL: '15m',
    JWT_ISSUER: 'sentinel-vision-ai',
    JWT_AUDIENCES: 'web,mobile',
    REFRESH_TOKEN_PEPPER: '0123456789012345678901234567890123456789',
    REFRESH_GRACE_SECONDS: '30',
    SESSION_IDLE_TTL: '8h',
    SESSION_ABSOLUTE_TTL: '30d',
    SESSION_ABSOLUTE_TTL_ADMIN: '12h',
    SESSION_MAX_CONCURRENT: '3',
    STEP_UP_TTL: '15m',
    COOKIE_SECRET: '0123456789012345678901234567890123456789',
    COOKIE_DOMAIN: '',
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
    AUTH_ALLOWED_EMAIL_DOMAINS: 'example.com, sentinel.gov',
    AUTH_MAX_FAILED_LOGINS: '5',
    AUTH_LOCKOUT_MINUTES: '15',
    SEED_DEFAULT_PASSWORD: 'SuperSecurePassword@2026',

    TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',

    MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/sentinel',
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379',
    REDIS_PASSWORD: 'redispassword123456789',
    REDIS_DB: '0',
    REDIS_KEY_PREFIX: 'sentinel:',

    KAFKA_BROKERS: 'localhost:9092',
    KAFKA_CLIENT_ID: 'sentinel-api',
    KAFKA_GROUP_ID: 'sentinel-core-group',

    PINECONE_API_KEY: 'test-pinecone-api-key-abcdef123456',
    PINECONE_INDEX_FACE: 'face-embeddings',
    PINECONE_INDEX_REID: 'reid-embeddings',
    PINECONE_FACE_DIM: '512',
    PINECONE_REID_DIM: '512',
    PINECONE_CLOUD: 'aws',
    PINECONE_REGION: 'us-east-1',
    PINECONE_NAMESPACE_PREFIX: 'sentinel',

    STORAGE_DRIVER: 'minio',
    RECORDING_DRIVER: 'local',

    MEDIA_BASE_URL: 'http://localhost:8889',
    MEDIA_HLS_URL: 'http://localhost:8888',
    MEDIA_RTSP_URL: 'rtsp://localhost:8554',
    MEDIA_API_URL: 'http://localhost:9997',
    STUN_URLS: 'stun:stun.l.google.com:19302',
    TURN_URLS: 'turn:localhost:3478',
    TURN_SECRET: '0123456789abcdef0123456789abcdef',
    TURN_CREDENTIAL_TTL_SECONDS: '600',
  };

  describe('Duration Parsing helper', () => {
    it('should correctly parse 15m to 900 seconds', () => {
      expect(parseDurationToSeconds('15m')).toBe(900);
    });

    it('should correctly parse 8h to 28800 seconds', () => {
      expect(parseDurationToSeconds('8h')).toBe(28800);
    });

    it('should correctly parse 30d to 2592000 seconds', () => {
      expect(parseDurationToSeconds('30d')).toBe(2592000);
    });

    it('should parse 45s to 45 seconds', () => {
      expect(parseDurationToSeconds('45s')).toBe(45);
    });
  });

  describe('Schema Validation', () => {
    it('should validate a complete valid environment configuration', () => {
      const parsed = EnvSchema.safeParse(validBaseEnv);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parseDurationToSeconds(parsed.data.JWT_ACCESS_TTL)).toBe(900);
        expect(parseDurationToSeconds(parsed.data.SESSION_IDLE_TTL)).toBe(28800);
        expect(parseDurationToSeconds(parsed.data.SESSION_ABSOLUTE_TTL)).toBe(2592000);
        expect(parsed.data.AUTH_REGISTRATION_ENABLED).toBe(true);
        expect(parsed.data.CORS_ORIGIN).toEqual(['http://localhost:3000', 'http://127.0.0.1:3000']);
        expect(parsed.data.AUTH_ALLOWED_EMAIL_DOMAINS).toEqual(['example.com', 'sentinel.gov']);
      }
    });

    it('should fail if a secret is missing', () => {
      const env = { ...validBaseEnv };
      delete (env as any).JWT_ACCESS_SECRET;
      const parsed = EnvSchema.safeParse(env);
      expect(parsed.success).toBe(false);
    });

    it('should fail if JWT secret is shorter than 32 characters', () => {
      const env = { ...validBaseEnv, JWT_ACCESS_SECRET: 'short-secret-less-than-32' };
      const parsed = EnvSchema.safeParse(env);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.path[0]);
        expect(issues).toContain('JWT_ACCESS_SECRET');
      }
    });

    it('should fail if TURN_SECRET is shorter than 16 characters', () => {
      const env = { ...validBaseEnv, TURN_SECRET: 'short-turn' };
      const parsed = EnvSchema.safeParse(env);
      expect(parsed.success).toBe(false);
    });

    it('should strictly parse "false" to boolean false (not true)', () => {
      const env = { ...validBaseEnv, AUTH_REGISTRATION_ENABLED: 'false' };
      const parsed = EnvSchema.safeParse(env);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.AUTH_REGISTRATION_ENABLED).toBe(false);
      }
    });

    it('should reject non-boolean string values like "yes" or "1"', () => {
      const env = { ...validBaseEnv, AUTH_REGISTRATION_ENABLED: 'yes' };
      const parsed = EnvSchema.safeParse(env);
      expect(parsed.success).toBe(false);
    });

    it('should enforce conditional requirements when EMAIL_TRANSPORT is brevo', () => {
      const env = { ...validBaseEnv, EMAIL_TRANSPORT: 'brevo' };
      const parsed = EnvSchema.safeParse(env);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.path[0]);
        expect(issues).toContain('BREVO_API_KEY');
        expect(issues).toContain('BREVO_SENDER_EMAIL');
      }
    });

    it('should enforce conditional requirements when OAUTH_GOOGLE_ENABLED is true', () => {
      const env = { ...validBaseEnv, OAUTH_GOOGLE_ENABLED: 'true' };
      const parsed = EnvSchema.safeParse(env);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.path[0]);
        expect(issues).toContain('GOOGLE_CLIENT_ID');
        expect(issues).toContain('GOOGLE_CLIENT_SECRET');
        expect(issues).toContain('GOOGLE_CALLBACK_URL');
      }
    });

    it('should enforce conditional requirements when STORAGE_DRIVER is cloudinary', () => {
      const env = { ...validBaseEnv, STORAGE_DRIVER: 'cloudinary' };
      const parsed = EnvSchema.safeParse(env);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.path[0]);
        expect(issues).toContain('CLOUDINARY_CLOUD_NAME');
        expect(issues).toContain('CLOUDINARY_API_KEY');
        expect(issues).toContain('CLOUDINARY_API_SECRET');
      }
    });

    describe('Production Hardening Rules', () => {
      const prodEnv = {
        ...validBaseEnv,
        NODE_ENV: 'production',
        API_URL: 'https://api.sentinel.gov',
        WEB_URL: 'https://sentinel.gov',
        COOKIE_SECURE: 'true',
        TURNSTILE_SECRET_KEY: '0x4AAAAAAAJ8x1234567890123456789',
        SEED_DEFAULT_PASSWORD: 'HardenedProductionPassword@2026',
        MEDIA_BASE_URL: 'https://stream.sentinel.gov',
        MEDIA_HLS_URL: 'https://hls.sentinel.gov',
        MEDIA_API_URL: 'https://internal-media.sentinel.gov',
      };

      it('should reject COOKIE_SECURE=false in production', () => {
        const env = { ...prodEnv, COOKIE_SECURE: 'false' };
        const parsed = EnvSchema.safeParse(env);
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
          const messages = parsed.error.issues.map((i) => i.message);
          expect(messages.some((m) => m.includes('COOKIE_SECURE must be true in production'))).toBe(true);
        }
      });

      it('should reject http:// URLs for API_URL in production', () => {
        const env = { ...prodEnv, API_URL: 'http://insecure.sentinel.gov' };
        const parsed = EnvSchema.safeParse(env);
        expect(parsed.success).toBe(false);
      });

      it('should reject Turnstile dev test key in production', () => {
        const env = { ...prodEnv, TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA' };
        const parsed = EnvSchema.safeParse(env);
        expect(parsed.success).toBe(false);
      });

      it('should reject SEED_DEFAULT_PASSWORD shorter than 12 characters in production', () => {
        const env = { ...prodEnv, SEED_DEFAULT_PASSWORD: 'shortpass' };
        const parsed = EnvSchema.safeParse(env);
        expect(parsed.success).toBe(false);
      });
    });
  });
});
