import { registerAs } from '@nestjs/config';

export const serverConfig = registerAs('server', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.API_PORT ?? '3001', 10),
  host: process.env.API_HOST ?? '0.0.0.0',
  globalPrefix: process.env.API_GLOBAL_PREFIX ?? 'api/v1',
  apiUrl: process.env.API_URL ?? 'http://localhost:3001',
  webUrl: process.env.WEB_URL ?? 'http://localhost:3000',
  mobileBaseUrl: process.env.MOBILE_BASE_URL ?? '',
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  trustProxy: process.env.TRUST_PROXY === 'true',
  throttleTtlSeconds: parseInt(process.env.THROTTLE_TTL_SECONDS ?? '60', 10),
  throttleLimit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
}));
