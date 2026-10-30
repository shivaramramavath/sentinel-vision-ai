# Sentinel Vision AI — Environment Variables Directory

This document provides an exhaustive inventory of every environment variable utilized across the Sentinel Vision AI monorepo (`apps/api`, `apps/web`, `apps/inference`, and `infra/docker-compose.yml`), detailing its purpose, validation constraints, sensitivity level, and provisioning instructions.

## Variable Reference Table

| Variable | App(s) | Required (Dev / Prod) | Secret? | Example / Format | Purpose | How to Obtain |
|---|---|---|---|---|---|---|
| `NODE_ENV` | api, web, inference | Required / Required | No | `development` / `production` | Defines Node runtime environment and behavior mode | System environment |
| `API_PORT` | api | Optional (default 3001) / Required | No | `3001` | Local port for NestJS HTTP server | Assigned port in hosting environment |
| `API_HOST` | api | Optional (default 0.0.0.0) / Required | No | `0.0.0.0` | IP interface binding for NestJS HTTP listener | Default `0.0.0.0` for containers |
| `API_GLOBAL_PREFIX` | api | Optional (default api/v1) / Required | No | `api/v1` | URL routing prefix for all REST endpoints | Architecture specification |
| `API_URL` | api | Required / Required | No | `http://localhost:3001` | Publicly accessible base URL for NestJS API | Assigned domain name |
| `WEB_URL` | api | Required / Required | No | `http://localhost:3000` | Publicly accessible base URL for Next.js Web app | Assigned web domain name |
| `MOBILE_BASE_URL` | api, web | Optional / Required | No | `https://stream.sentinel.gov` | Public HTTPS tunnel or domain for mobile camera operators | Cloudflare Tunnel, ngrok, or domain |
| `CORS_ORIGIN` | api | Required / Required | No | `http://localhost:3000` | Comma-separated whitelist of allowed CORS origins | Web app URL(s) |
| `LOG_LEVEL` | api, inference | Optional (default debug/info) / Required | No | `info` / `debug` | Pino and Python logging severity threshold | Operational preference |
| `TRUST_PROXY` | api | Optional (default false) / Required | No | `true` / `false` / `1` | Express reverse proxy header trust setting | Enable if behind ALB, Nginx, or Cloudflare |
| `JWT_ACCESS_SECRET` | api | Required / Required | **Yes** (>= 32 chars) | `c47a...` | HMAC-SHA256 signature key for short-lived access tokens | `pnpm env:rotate JWT_ACCESS_SECRET` |
| `JWT_ACCESS_TTL` | api | Optional (default 15m) / Required | No | `15m` | Time duration string before access token expires | Policy duration string ('15m', '1h') |
| `JWT_ISSUER` | api | Optional (default sentinel-vision-ai) | No | `sentinel-vision-ai` | Canonical issuer identifier in JWT payload | Domain identity |
| `JWT_AUDIENCE_WEB` | api | Optional (default web) | No | `web` | Canonical audience claim for web application | App client identity |
| `JWT_AUDIENCE_MOBILE` | api | Optional (default mobile) | No | `mobile` | Canonical audience claim for mobile camera PWA | App client identity |
| `REFRESH_TOKEN_PEPPER` | api | Required / Required | **Yes** (>= 32 chars) | `d8b1...` | Server-side HMAC pepper applied to refresh tokens before Redis storage | `pnpm env:rotate REFRESH_TOKEN_PEPPER` |
| `SESSION_IDLE_TTL` | api | Optional (default 8h) / Required | No | `8h` | Sliding idle session timeout before re-authentication | Policy duration ('8h', '2h') |
| `SESSION_ABSOLUTE_TTL` | api | Optional (default 30d) / Required | No | `30d` | Maximum lifespan of user session regardless of activity | Policy duration ('30d', '7d') |
| `SESSION_ABSOLUTE_TTL_ADMIN` | api | Optional (default 7d) / Required | No | `7d` | Restricted lifespan of administrative sessions | Policy duration ('7d', '24h') |
| `SESSION_MAX_CONCURRENT` | api | Optional (default 5) / Required | No | `5` | Maximum active concurrent sessions allowed per user | Security policy threshold |
| `REFRESH_GRACE_SECONDS` | api | Optional (default 15) / Required | No | `15` | Window permitting concurrent token refresh requests | Network latency buffer |
| `STEP_UP_TTL` | api | Optional (default 10m) / Required | No | `10m` | Validity window of step-up MFA authorization challenge | Policy duration string |
| `COOKIE_SECRET` | api | Required / Required | **Yes** (>= 32 chars) | `e1f0...` | Cryptographic key used to sign and verify session cookies | `pnpm env:rotate COOKIE_SECRET` |
| `COOKIE_DOMAIN` | api | Optional / Optional | No | `.sentinel.gov` (blank for host-only) | Domain attribute for session refresh cookie | Domain architecture |
| `COOKIE_SECURE` | api | Optional (default false in dev) / **Required (true in prod)** | No | `true` / `false` | Restricts cookie transmission to HTTPS connections | Set `true` in production |
| `COOKIE_SAMESITE` | api | Optional (default lax) / Required | No | `lax` / `strict` / `none` | SameSite cookie attribute preventing CSRF | Standard browser policy |
| `REFRESH_COOKIE_NAME` | api | Optional (default sentinel_rt) | No | `sentinel_rt` | Cookie name storing the session refresh token | Client/server convention |
| `INTERNAL_SERVICE_TOKEN` | api, inference | Required / Required | **Yes** (>= 32 chars) | `a90b...` | Shared bearer token for authenticating internal AI worker calls | `pnpm env:rotate INTERNAL_SERVICE_TOKEN` |
| `OAUTH_GOOGLE_ENABLED` | api | Optional (default false) | No | `true` / `false` | Enables Google OAuth login flow | Feature flag |
| `GOOGLE_CLIENT_ID` | api | Conditional (`GOOGLE_ENABLED=true`) | No | `7812...apps.googleusercontent.com` | Google Cloud OAuth 2.0 Client ID | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | api | Conditional (`GOOGLE_ENABLED=true`) | **Yes** | `GOCSPX-...` | Google Cloud OAuth 2.0 Client Secret | Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | api | Conditional (`GOOGLE_ENABLED=true`) | No | `http://localhost:3001/api/v1/auth/google/callback` | OAuth redirect callback URI matching GCP settings | Google Cloud Console |
| `OAUTH_GITHUB_ENABLED` | api | Optional (default false) | No | `true` / `false` | Enables GitHub OAuth login flow | Feature flag |
| `GITHUB_CLIENT_ID` | api | Conditional (`GITHUB_ENABLED=true`) | No | `Ov23...` | GitHub OAuth App Client ID | GitHub Developer Settings |
| `GITHUB_CLIENT_SECRET` | api | Conditional (`GITHUB_ENABLED=true`) | **Yes** | `ghs_...` | GitHub OAuth App Client Secret | GitHub Developer Settings |
| `GITHUB_CALLBACK_URL` | api | Conditional (`GITHUB_ENABLED=true`) | No | `http://localhost:3001/api/v1/auth/github/callback` | OAuth redirect callback URI matching GitHub settings | GitHub Developer Settings |
| `EMAIL_TRANSPORT` | api | Optional (default smtp-dev) / Required | No | `brevo` / `smtp-dev` | Outbound email delivery driver | Email infrastructure choice |
| `SMTP_DEV_HOST` | api | Optional (default localhost) | No | `localhost` | Hostname of local dev SMTP capture sink (Mailpit) | docker-compose mailpit |
| `SMTP_DEV_PORT` | api | Optional (default 1025) | No | `1025` | Port of local dev SMTP capture sink | docker-compose mailpit |
| `BREVO_API_KEY` | api | Conditional (`EMAIL_TRANSPORT=brevo`) | **Yes** | `xkeysib-...` | Brevo REST API Key | Brevo Dashboard -> SMTP & API |
| `BREVO_SENDER_NAME` | api | Optional (default Sentinel Vision AI) | No | `Sentinel Vision AI` | Outbound sender name for transactional emails | Brevo Sender Profile |
| `BREVO_SENDER_EMAIL` | api | Conditional (`EMAIL_TRANSPORT=brevo`) | No | `noreply@sentinel.gov` | Outbound verified sender email address | Brevo Dashboard -> Senders |
| `BREVO_TIMEOUT_SECONDS` | api | Optional (default 10) | No | `10` | HTTP request timeout for Brevo API calls | Network configuration |
| `BREVO_MAX_RETRIES` | api | Optional (default 2) | No | `2` | Maximum retry attempts for failed emails | Reliability configuration |
| `AUTH_ALLOWED_EMAIL_DOMAINS` | api | Optional (empty allows any) | No | `sentinel.gov,police.gov` | Whitelist of permitted email domains for registration | Security governance |
| `AUTH_REQUIRE_ADMIN_APPROVAL` | api | Optional (default true) | No | `true` / `false` | Gate requiring administrator activation for new accounts | Security governance |
| `AUTH_REGISTRATION_ENABLED` | api | Optional (default true) | No | `true` / `false` | Enables public user registration form | Security governance |
| `AUTH_MAX_FAILED_LOGINS` | api | Optional (default 5) | No | `5` | Maximum failed attempts before account lockout | Security governance |
| `AUTH_LOCKOUT_MINUTES` | api | Optional (default 15) | No | `15` | Account lockout duration following repeated failures | Security governance |
| `THROTTLE_TTL_SECONDS` | api | Optional (default 60) | No | `60` | Sliding window duration for IP rate limiting | Rate limiter setting |
| `THROTTLE_LIMIT` | api | Optional (default 100) | No | `100` | Maximum requests permitted per window per client IP | Rate limiter setting |
| `SEED_DEFAULT_PASSWORD` | api | Required (dev) / **Forbidden in prod** | **Yes** (>= 12 chars) | `AdminSecurePass2026!` | Initial password for demo/seeded database users | `pnpm env:rotate SEED_DEFAULT_PASSWORD` |
| `TURNSTILE_SECRET_KEY` | api | Required / Required | **Yes** | `0x4AAAAAA...` (1x000... in dev) | Cloudflare Turnstile Server-Side verification key | Cloudflare Dashboard -> Turnstile |
| `MONGODB_URI` | api | Required / Required | **Yes** | `mongodb+srv://...` | MongoDB connection URI (Atlas replica set) | MongoDB Atlas Dashboard |
| `REDIS_HOST` | api, inference, docker-compose | Required / Required | No | `localhost` | Redis server hostname | Redis server / container |
| `REDIS_PORT` | api, inference, docker-compose | Optional (default 6379) | No | `6379` | Redis server port | Redis server / container |
| `REDIS_PASSWORD` | api, docker-compose | Required / Required | **Yes** | `x9K...` (URL-safe string) | Redis server authentication password | `pnpm env:rotate REDIS_PASSWORD` |
| `REDIS_DB` | api | Optional (default 0) | No | `0` | Logical Redis database number | Redis configuration |
| `REDIS_KEY_PREFIX` | api | Optional (default sentinel:) | No | `sentinel:` | Key prefix applied to all application Redis keys | Namespace convention |
| `KAFKA_BROKERS` | api, inference, docker-compose | Required / Required | No | `localhost:9092` | Comma-separated list of Kafka broker hosts/ports | Kafka cluster / docker-compose |
| `KAFKA_CLIENT_ID` | api, inference | Optional (default sentinel-api) | No | `sentinel-api` | Kafka client identifier | Event bus convention |
| `KAFKA_GROUP_ID` | api, inference | Optional (default sentinel-api) | No | `sentinel-api` | Kafka consumer group name | Event bus convention |
| `PINECONE_API_KEY` | api, inference | Required / Required | **Yes** | `pcsk_...` | Pinecone API key for vector operations | Pinecone Console |
| `PINECONE_CLOUD` | api | Optional (default aws) | No | `aws` / `gcp` / `azure` | Cloud provider for serverless vector indexes | Pinecone Console |
| `PINECONE_REGION` | api | Optional (default us-east-1) | No | `us-east-1` | Cloud region for serverless vector indexes | Pinecone Console |
| `PINECONE_INDEX_FACE` | api, inference | Optional (default sentinel-face) | No | `sentinel-face` | Name of vector index for facial embeddings | Vector configuration |
| `PINECONE_INDEX_REID` | api, inference | Optional (default sentinel-reid) | No | `sentinel-reid` | Name of vector index for Re-ID body embeddings | Vector configuration |
| `PINECONE_FACE_DIM` | api | Optional (default 512) | No | `512` | Embedding dimensionality for facial vectors | Model registry (AdaFace/ArcFace) |
| `PINECONE_REID_DIM` | api | Optional (default 512) | No | `512` | Embedding dimensionality for Re-ID vectors | Model registry (OSNet-AIN) |
| `PINECONE_METRIC` | api | Optional (default cosine) | No | `cosine` | Vector similarity distance metric | Vector configuration |
| `PINECONE_NAMESPACE_PREFIX` | api, inference | Optional (default dev) | No | `dev` / `prod` | Prefix isolating cases in Pinecone namespaces | Environment partition |
| `STORAGE_DRIVER` | api | Required / Required | No | `cloudinary` / `minio` | Media storage driver for sensitive assets | Storage choice |
| `CLOUDINARY_CLOUD_NAME` | api | Conditional (`STORAGE_DRIVER=cloudinary`) | No | `sentinel-gov` | Cloudinary account cloud name | Cloudinary Dashboard |
| `CLOUDINARY_API_KEY` | api | Conditional (`STORAGE_DRIVER=cloudinary`) | No | `123456789012345` | Cloudinary REST API Key | Cloudinary Dashboard |
| `CLOUDINARY_API_SECRET` | api | Conditional (`STORAGE_DRIVER=cloudinary`) | **Yes** | `••••••••••••••••` | Cloudinary REST API Secret | Cloudinary Dashboard |
| `CLOUDINARY_URL` | api | Optional alternative to individual keys | **Yes** | `cloudinary://...` | Composite Cloudinary configuration URL | Cloudinary Dashboard |
| `CLOUDINARY_ROOT_FOLDER` | api | Optional (default sentinel/dev) | No | `sentinel/dev` / `sentinel/prod` | Namespace folder in Cloudinary | Environment partition |
| `CLOUDINARY_SIGNED_URL_TTL_SECONDS` | api | Optional (default 300) | No | `300` | Signed URL expiration in seconds | Security policy |
| `CLOUDINARY_NOTIFICATION_URL` | api | Optional | No | `http://api.sentinel.gov/api/v1/webhooks/cloudinary` | Webhook URL for asynchronous video transformations | Deployment hostname |
| `CLOUDINARY_MAX_IMAGE_MB` | api | Optional (default 25) | No | `25` | Maximum image upload file size | Media policy |
| `CLOUDINARY_MAX_VIDEO_MB` | api | Optional (default 100) | No | `100` | Maximum video clip upload file size | Media policy |
| `RECORDING_DRIVER` | api | Optional (default minio) | No | `minio` / `local` / `off` | Continuous video recording chunk storage driver | Storage policy |
| `MEDIA_BASE_URL` | api, web | Required / Required | No | `http://localhost:8889` | MediaMTX WebRTC playback base URL | Media server / docker-compose |
| `MEDIA_HLS_URL` | api | Optional (default http://localhost:8888) | No | `http://localhost:8888` | MediaMTX HLS playback base URL | Media server / docker-compose |
| `MEDIA_RTSP_URL` | api | Optional (default rtsp://localhost:8554) | No | `rtsp://localhost:8554` | MediaMTX RTSP ingestion base URL | Media server / docker-compose |
| `MEDIA_API_URL` | api | Optional (default http://localhost:9997) | No | `http://localhost:9997` | MediaMTX REST control API URL | Media server / docker-compose |
| `STUN_URLS` | api | Optional (default stun.l.google.com:19302) | No | `stun:stun.l.google.com:19302` | Comma-separated public STUN servers for WebRTC ICE | STUN provider |
| `TURN_URLS` | api | Optional (default turn:localhost:3478) | No | `turn:turn.sentinel.gov:3478` | Comma-separated TURN relay servers | Coturn / TURN provider |
| `TURN_SECRET` | api, docker-compose | Required / Required | **Yes** (>= 16 chars) | `f0a3...` | Shared static secret for ephemeral TURN credentials | `pnpm env:rotate TURN_SECRET` |
| `TURN_CREDENTIAL_TTL_SECONDS` | api | Optional (default 600) | No | `600` | Validity window of ephemeral WebRTC TURN credentials | WebRTC policy |
| `NEXT_PUBLIC_API_URL` | web | Required / Required | No | `http://localhost:3001` | Public API endpoint for browser TanStack Query calls | Web app configuration |
| `NEXT_PUBLIC_WS_URL` | web | Required / Required | No | `ws://localhost:3001` | Public WebSocket endpoint for real-time telemetry | Web app configuration |
| `NEXT_PUBLIC_MEDIA_BASE_URL` | web | Required / Required | No | `http://localhost:8889` | Public MediaMTX WebRTC URL for video feeds | Web app configuration |
| `NEXT_PUBLIC_MOBILE_BASE_URL` | web | Optional (dev) / Required (prod) | No | `https://stream.sentinel.gov` | Public HTTPS URL for mobile camera operator interface | Tunnel / reverse proxy |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | web | Required / Required | No | `0x4AAAAAA...` (1x000... in dev) | Cloudflare Turnstile public site key | Cloudflare Dashboard -> Turnstile |
| `API_INTERNAL_URL` | inference | Required / Required | No | `http://localhost:3001` | Internal API gateway URL for AI inference workers | Container network DNS |
| `DEVICE` | inference | Optional (default cpu) | No | `cuda` / `cpu` / `mps` | Hardware accelerator device for PyTorch inference | System GPU environment |
| `MODEL_DIR` | inference | Optional (default ./models) | No | `./models` | File directory containing model weights | Inference filesystem |
