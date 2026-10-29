import { z } from 'zod';

export const ApiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(3001),
  API_HOST: z.string().default('0.0.0.0'),
  API_URL: z.string().default('http://localhost:3001'),
  WEB_URL: z.string().default('http://localhost:3000'),
  MOBILE_BASE_URL: z.string().default('http://localhost:3000'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017/sentinel_vision'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),

  KAFKA_BROKERS: z.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: z.string().default('sentinel-api'),

  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().default('minioadmin'),
  MINIO_USE_SSL: z.coerce.boolean().default(false),
  MINIO_BUCKET_PHOTOS: z.string().default('reference-photos'),
  MINIO_BUCKET_THUMBNAILS: z.string().default('sighting-thumbnails'),
  MINIO_BUCKET_CROPS: z.string().default('frame-crops'),

  PINECONE_API_KEY: z.string().optional().default(''),
  PINECONE_FACE_INDEX: z.string().default('face-embeddings'),
  PINECONE_REID_INDEX: z.string().default('reid-embeddings'),

  // JWT & Session Security
  JWT_SECRET: z.string().default('dev-secret-change-in-production-min-32-chars'),
  JWT_ACCESS_SECRET: z.string().default('sentinel-access-secret-development-key-32chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().default('sentinel-refresh-secret-development-key-32chars'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  COOKIE_SECRET: z.string().default('sentinel-cookie-secret-development-key-32chars'),
  COOKIE_DOMAIN: z.string().default('localhost'),
  REFRESH_COOKIE_NAME: z.string().default('sentinel_rt'),

  // OAuth 2.0 Providers
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:3001/api/v1/auth/google/callback'),

  GITHUB_CLIENT_ID: z.string().optional().default(''),
  GITHUB_CLIENT_SECRET: z.string().optional().default(''),
  GITHUB_CALLBACK_URL: z.string().default('http://localhost:3001/api/v1/auth/github/callback'),

  // Email Configuration (Brevo / Local Dev SMTP Mailpit)
  EMAIL_TRANSPORT: z.enum(['brevo', 'smtp-dev']).default('smtp-dev'),
  BREVO_API_KEY: z.string().optional().default(''),
  BREVO_SENDER_NAME: z.string().default('Sentinel Vision AI'),
  BREVO_SENDER_EMAIL: z.string().default('notifications@sentinelvision.ai'),
  BREVO_TIMEOUT_SECONDS: z.coerce.number().default(10),
  BREVO_MAX_RETRIES: z.coerce.number().default(2),
  SMTP_DEV_HOST: z.string().default('localhost'),
  SMTP_DEV_PORT: z.coerce.number().default(1025),

  // Auth Governance & Policies
  AUTH_ALLOWED_EMAIL_DOMAINS: z.string().optional().default(''),
  AUTH_REQUIRE_ADMIN_APPROVAL: z.coerce.boolean().default(true),
  AUTH_REGISTRATION_ENABLED: z.coerce.boolean().default(true),
  SEED_DEFAULT_PASSWORD: z.string().default('Sentinel@2026'),

  // WebRTC / Mobile Streaming
  TURN_SECRET: z.string().default('sentinel_turn_secret_2026'),
  MEDIA_BASE_URL: z.string().default('http://localhost:8889'),

  // Cloudflare Turnstile CAPTCHA
  TURNSTILE_SECRET_KEY: z.string().optional().default('1x0000000000000000000000000000000AA'),
});

export type ApiEnv = z.infer<typeof ApiEnvSchema>;

export function validateApiEnv(config: Record<string, unknown>): ApiEnv {
  const result = ApiEnvSchema.safeParse(config);
  if (!result.success) {
    const errorDetails = result.error.format();
    console.error('❌ FATAL: apps/api environment variable validation failed on boot:');
    console.error(JSON.stringify(errorDetails, null, 2));
    throw new Error('Config validation failed on boot');
  }
  return result.data;
}
