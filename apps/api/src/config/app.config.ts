import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.API_PORT ?? '3001', 10),
  apiUrl: process.env.API_URL ?? 'http://localhost:3001',
  webUrl: process.env.WEB_URL ?? 'http://localhost:3000',
  mobileBaseUrl: process.env.MOBILE_BASE_URL ?? 'http://localhost:3000',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  nodeEnv: process.env.NODE_ENV ?? 'development',

  mongoUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/sentinel_vision',
  redisHost: process.env.REDIS_HOST ?? 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  kafkaBrokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
  minioEndpoint: process.env.MINIO_ENDPOINT ?? 'localhost',
  minioPort: parseInt(process.env.MINIO_PORT ?? '9000', 10),
  minioAccessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
  minioSecretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
  minioUseSsl: process.env.MINIO_USE_SSL === 'true',
  minioBucketPhotos: process.env.MINIO_BUCKET_PHOTOS ?? 'reference-photos',
  minioBucketThumbnails: process.env.MINIO_BUCKET_THUMBNAILS ?? 'sighting-thumbnails',
  minioBucketCrops: process.env.MINIO_BUCKET_CROPS ?? 'frame-crops',
  pineconeApiKey: process.env.PINECONE_API_KEY ?? '',
  pineconeFaceIndex: process.env.PINECONE_FACE_INDEX ?? 'face-embeddings',
  pineconeReidIndex: process.env.PINECONE_REID_INDEX ?? 'reid-embeddings',

  // Auth & Token Settings
  jwtSecret: process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? 'sentinel-access-secret-development-key-32chars',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? 'sentinel-access-secret-development-key-32chars',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_TTL ?? '15m',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'sentinel-refresh-secret-development-key-32chars',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_TTL ?? '30d',
  cookieSecret: process.env.COOKIE_SECRET ?? 'sentinel-cookie-secret-development-key-32chars',
  cookieDomain: process.env.COOKIE_DOMAIN ?? 'localhost',
  refreshCookieName: process.env.REFRESH_COOKIE_NAME ?? 'sentinel_rt',

  // OAuth Providers
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3001/api/v1/auth/google/callback',
  githubClientId: process.env.GITHUB_CLIENT_ID ?? '',
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
  githubCallbackUrl: process.env.GITHUB_CALLBACK_URL ?? 'http://localhost:3001/api/v1/auth/github/callback',

  // Email Config
  emailTransport: process.env.EMAIL_TRANSPORT ?? 'smtp-dev',
  brevoApiKey: process.env.BREVO_API_KEY ?? '',
  brevoSenderName: process.env.BREVO_SENDER_NAME ?? 'Sentinel Vision AI',
  brevoSenderEmail: process.env.BREVO_SENDER_EMAIL ?? 'notifications@sentinelvision.ai',
  brevoTimeoutSeconds: parseInt(process.env.BREVO_TIMEOUT_SECONDS ?? '10', 10),
  brevoMaxRetries: parseInt(process.env.BREVO_MAX_RETRIES ?? '2', 10),
  smtpDevHost: process.env.SMTP_DEV_HOST ?? 'localhost',
  smtpDevPort: parseInt(process.env.SMTP_DEV_PORT ?? '1025', 10),

  // Auth Governance
  authAllowedEmailDomains: (process.env.AUTH_ALLOWED_EMAIL_DOMAINS ?? '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean),
  authRequireAdminApproval: process.env.AUTH_REQUIRE_ADMIN_APPROVAL !== 'false',
  authRegistrationEnabled: process.env.AUTH_REGISTRATION_ENABLED !== 'false',
  seedDefaultPassword: process.env.SEED_DEFAULT_PASSWORD ?? 'Sentinel@2026',

  // WebRTC / Mobile Streaming
  turnSecret: process.env.TURN_SECRET ?? 'sentinel_turn_secret_2026',
  mediaBaseUrl: process.env.MEDIA_BASE_URL ?? 'http://localhost:8889',
  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY ?? '',

  cameraSecretKey: process.env.CAMERA_SECRET_KEY ?? 'sentinel-camera-master-aes-key-32b',
  mediamtxNodes: [
    {
      id: 'node-edge-01',
      name: 'Primary Ingest Node (Edge 01)',
      rtspBase: process.env.MEDIAMTX_RTSP_BASE ?? 'rtsp://localhost:8554',
      webrtcBase: process.env.MEDIAMTX_WEBRTC_BASE ?? 'http://localhost:8889',
      hlsBase: process.env.MEDIAMTX_HLS_BASE ?? 'http://localhost:8888',
      apiBase: process.env.MEDIAMTX_API_BASE ?? 'http://localhost:9997',
      maxStreams: 100,
      maxBitrateMbps: 1000,
    },
    {
      id: 'node-edge-02',
      name: 'Secondary Ingest Node (Edge 02 - Failover/Burst)',
      rtspBase: process.env.MEDIAMTX_RTSP_BASE_02 ?? 'rtsp://localhost:8555',
      webrtcBase: process.env.MEDIAMTX_WEBRTC_BASE_02 ?? 'http://localhost:8899',
      hlsBase: process.env.MEDIAMTX_HLS_BASE_02 ?? 'http://localhost:8898',
      apiBase: process.env.MEDIAMTX_API_BASE_02 ?? 'http://localhost:9998',
      maxStreams: 100,
      maxBitrateMbps: 1000,
    },
  ],
}));
