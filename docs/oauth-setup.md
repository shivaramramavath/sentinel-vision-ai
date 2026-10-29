# OAuth 2.0 Identity Provider Setup Guide

## 1. Overview & Security Invariants

Sentinel Vision AI supports Single Sign-On (SSO) via Google Workspace and GitHub Enterprise:

- **Backend-Initiated Redirect Flow**: Login begins with a direct redirect to `/api/v1/auth/google` or `/api/v1/auth/github`.
- **Zero Tokens in URLs**: OAuth callbacks NEVER transmit access tokens, refresh tokens, or user claims in URL query strings or hashes. The backend handles the authorization code exchange, establishes a session, sets an HTTP-only cookie, and redirects the user to `/auth/callback?status=ok`.
- **Strict Account Linking Rules**:
  - If a user registers via Google/GitHub with an email that matches an existing account:
    - **Verified Accounts**: The social identity is securely linked to the existing user.
    - **Unverified Accounts**: Auto-linking is strictly rejected to prevent pre-hijacking account takeover.
  - Linked identities can be unlinked at any time via Account Settings, provided the account has a password or another active identity provider.

---

## 2. Google OAuth 2.0 Configuration

### Step A: Google Cloud Console
1. Navigate to [Google Cloud Console - APIs & Services - Credentials](https://console.cloud.google.com/apis/credentials).
2. Click **Create Credentials** > **OAuth client ID**.
3. Select Application Type: **Web application**.
4. Set Name: `Sentinel Vision AI Terminal`.
5. Under **Authorized redirect URIs**, add:
   - Development: `http://localhost:4000/api/v1/auth/google/callback` (or your backend port)
   - Production: `https://api.sentinel-vision.internal/api/v1/auth/google/callback`
6. Click **Create** and save your Client ID and Client Secret.

### Step B: Environment Variables
Add the following to your backend `.env`:
```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:4000/api/v1/auth/google/callback
```

---

## 3. GitHub OAuth Configuration

### Step A: GitHub Developer Settings
1. Navigate to **GitHub Settings** > **Developer settings** > **OAuth Apps** > **New OAuth App**.
2. Configure application details:
   - Application name: `Sentinel Vision AI`
   - Homepage URL: `http://localhost:3000` (Web UI)
   - Authorization callback URL:
     - Development: `http://localhost:4000/api/v1/auth/github/callback`
     - Production: `https://api.sentinel-vision.internal/api/v1/auth/github/callback`
3. Click **Register application**.
4. Generate a new client secret and copy both Client ID and Client Secret.

### Step B: Environment Variables
Add the following to your backend `.env`:
```env
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_CALLBACK_URL=http://localhost:4000/api/v1/auth/github/callback
```

---

## 4. Testing OAuth Locally

1. Ensure the API backend is running on `http://localhost:4000` (or `http://localhost:3001` depending on your `PORT` config).
2. Visit the web app login screen at `http://localhost:3000/login`.
3. Click **Google** or **GitHub**.
4. Authorize the application on the provider's screen.
5. The provider redirects to `/api/v1/auth/{provider}/callback`, which issues the `sentinel_rt` cookie and redirects to `/auth/callback?status=ok`.
6. Next.js exchanges the cookie silently for an in-memory bearer token and navigates directly to `/dashboard`.
