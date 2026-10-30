# Sentinel Vision AI — Secrets & External Keys Setup Guide

This guide walks you through obtaining, provisioning, and validating all third-party credentials and cloud services required by Sentinel Vision AI.

---

## 1. Automated Secret Generation (`pnpm env:rotate`)
Sentinel provides an in-place secret generator using cryptographically secure random bytes (`crypto.randomBytes(48)` for tokens, `24` for passwords):

```bash
# Generate all internal cryptographic keys in apps/api/.env
pnpm env:rotate JWT_ACCESS_SECRET REFRESH_TOKEN_PEPPER COOKIE_SECRET INTERNAL_SERVICE_TOKEN TURN_SECRET SEED_DEFAULT_PASSWORD REDIS_PASSWORD
```

> **Rules**:
> - Never hard-code secrets into source code or commit `.env` files.
> - `REDIS_PASSWORD` must only contain URL-safe base64url characters (never `$#@&*^!`).

---

## 2. MongoDB Atlas (Database & Transactions)
Sentinel Vision AI relies on MongoDB replica sets to execute atomic multi-document transactions (e.g. outbox pattern, chain of custody).

1. Log in to [MongoDB Atlas](https://cloud.mongodb.com/).
2. Create a cluster (M0 free tier or higher).
3. **Database Access**: Create a database user with `readWriteAnyDatabase` privileges.
4. **Network Access**:
   - Add your current development IP address (or `0.0.0.0/0` with strong authentication for testing).
   - If `pnpm env:check` reports a timeout connecting to Atlas, verify that your client IP has not changed.
5. Copy the connection string (`mongodb+srv://...`) into `MONGODB_URI` in `apps/api/.env`.

---

## 3. Pinecone (Biometric Vector DB)
Facial recognition and Person Re-ID embeddings (512-dimensional vectors) are indexed in Pinecone serverless.

1. Sign up at [Pinecone Console](https://app.pinecone.io/).
2. Create an API Key in **API Keys** and set `PINECONE_API_KEY` in `apps/api/.env`.
3. Set your preferred cloud and region:
   ```env
   PINECONE_CLOUD=aws
   PINECONE_REGION=us-east-1
   ```
4. Run the automated initialization script to provision serverless indexes:
   ```bash
   pnpm pinecone:init
   ```
   This creates:
   - `sentinel-face` (dim: 512, metric: cosine)
   - `sentinel-reid` (dim: 512, metric: cosine)

---

## 4. Cloudinary (Authenticated Media Vault)
Digital evidence snapshots, candidate face crops, video clips, and dossier PDFs are stored in Cloudinary under delivery type `authenticated`.

1. Sign up at [Cloudinary](https://cloudinary.com/).
2. Navigate to **Dashboard -> Product Environment Settings**.
3. Copy **Cloud Name**, **API Key**, and **API Secret** into `apps/api/.env`:
   ```env
   STORAGE_DRIVER=cloudinary
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   CLOUDINARY_ROOT_FOLDER=sentinel/dev
   ```
4. Verify upload access with:
   ```bash
   pnpm env:check
   ```

---

## 5. Brevo (Transactional Email Delivery)
Email delivery for user registration verification, password resets, and suspicious login alerts.

1. Create an account at [Brevo](https://www.brevo.com/).
2. Navigate to **SMTP & API -> API Keys** -> Generate a new API Key (`xkeysib-...`).
3. Set `BREVO_API_KEY` in `apps/api/.env`.
4. Go to **Senders & IP -> Senders** -> Add and verify your domain sender email address (e.g. `noreply@sentinel.gov`).
5. Configure in `apps/api/.env`:
   ```env
   EMAIL_TRANSPORT=brevo
   BREVO_SENDER_NAME="Sentinel Vision AI"
   BREVO_SENDER_EMAIL=noreply@yourdomain.com
   ```
   *(For offline development, set `EMAIL_TRANSPORT=smtp-dev` to direct all email to local Mailpit at `localhost:1025`)*.

---

## 6. Google OAuth 2.0 (Single Sign-On)
1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project and configure the **OAuth consent screen** (User Type: External, Scopes: `openid`, `email`, `profile`).
3. Under **Test Users**, add your developer Google accounts.
4. Go to **Credentials -> Create Credentials -> OAuth client ID** (Application type: Web application).
5. Add Authorized Redirect URI:
   `http://localhost:3001/api/v1/auth/google/callback`
6. Set in `apps/api/.env`:
   ```env
   OAUTH_GOOGLE_ENABLED=true
   GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_CALLBACK_URL=http://localhost:3001/api/v1/auth/google/callback
   ```

---

## 7. GitHub OAuth (Single Sign-On)
1. Go to [GitHub Developer Settings -> OAuth Apps](https://github.com/settings/developers).
2. Click **New OAuth App**:
   - Application name: `Sentinel Vision AI`
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3001/api/v1/auth/github/callback`
3. Generate a Client Secret and copy credentials to `apps/api/.env`:
   ```env
   OAUTH_GITHUB_ENABLED=true
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret
   GITHUB_CALLBACK_URL=http://localhost:3001/api/v1/auth/github/callback
   ```

---

## 8. Cloudflare Turnstile (Bot Detection)
1. Go to [Cloudflare Dashboard -> Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile).
2. Add Site (Widget Mode: Managed or Non-interactive).
3. Set domain to `localhost` and your production domain.
4. Set secret and site keys:
   - Backend `apps/api/.env`: `TURNSTILE_SECRET_KEY=0x4AAAAAA...`
   - Frontend `apps/web/.env.local`: `NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAA...`
   *(In dev mode, using `1x0000000000000000000000000000000AA` always passes)*.

---

## 9. Mobile Camera Ingestion (HTTPS Tunnel)
Browsers strictly enforce HTTPS for WebRTC camera access. When streaming from a smartphone camera on a local dev network:

1. Start an HTTPS tunnel pointing to your local web server (port 3000):
   ```bash
   cloudflared tunnel --url http://localhost:3000
   # Or: ngrok http 3000
   ```
2. Copy the resulting HTTPS tunnel URL to `MOBILE_BASE_URL` in `apps/api/.env` and `NEXT_PUBLIC_MOBILE_BASE_URL` in `apps/web/.env.local`:
   ```env
   MOBILE_BASE_URL=https://random-subdomain.trycloudflare.com
   ```
3. Mobile operators navigate to `https://<tunnel-url>/m/login` to authenticate and stream.
