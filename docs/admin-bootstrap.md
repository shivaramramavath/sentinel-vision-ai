# Sentinel Vision AI — Super Administrator Bootstrap & Credential Lifecycle Guide

This document specifies the operational lifecycle, initial bootstrap mechanism, forced credential setup, rotation procedures, and defensive safety controls for the Sentinel Vision AI **Super Administrator** account.

---

## 1. Overview & Architecture

Sentinel Vision AI implements an automated, idempotent bootstrap workflow designed to provision an initial root administrator account on first boot, while enforcing strict credential rotation and two-factor authentication (TOTP) before console access is granted.

```
+-------------------------------------------------------------------------------+
|                            1. Server First Boot                               |
|   AdminBootstrapService reads ADMIN_* env vars -> Atomic $setOnInsert in DB   |
+-------------------------------------------------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                       2. Initial Interactive Sign-in                          |
|   POST /api/v1/auth/login -> Returns user + { mustChangePassword: true,       |
|                                              mfaEnrollmentRequired: true }    |
+-------------------------------------------------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                   3. Forced Security Setup (Blocking Stepper)                 |
|   Web UI routes user to /settings/account/security?required=1                 |
|   JwtAuthGuard blocks ALL console APIs except logout & setup endpoints        |
|                                                                               |
|   [ Step 1: Set New Passphrase ] -> [ Step 2: Scan TOTP QR & Save Codes ]     |
+-------------------------------------------------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                          4. Post-Boot Secret Hygiene                          |
|   Remove ADMIN_PASSWORD from .env -> Active Super Admin verified in database  |
+-------------------------------------------------------------------------------+
```

---

## 2. Environment Variables Reference

All bootstrap settings are defined in `apps/api/.env` and validated by Zod schema (`EnvSchema` in `apps/api/src/config/env.schema.ts`).

| Variable | Type | Default | Description | Required in Prod? |
| :--- | :---: | :---: | :--- | :---: |
| `ADMIN_BOOTSTRAP_ENABLED` | `boolean` | `false` | Enable automated bootstrap provisioning on application startup | Optional |
| `ADMIN_NAME` | `string` | `System Administrator` | Official full name and title for the bootstrap user | No |
| `ADMIN_EMAIL` | `string` | — | Official email address for the bootstrap super admin | **Yes** (when enabled) |
| `ADMIN_PASSWORD` | `string` | — | Temporary passphrase (min 12 chars, upper, lower, digit, symbol) | **Yes** (when enabled) |
| `ADMIN_BADGE_NUMBER` | `string` | `SA-0001` | Official departmental identification badge number | No |
| `ADMIN_DEPARTMENT` | `string` | `Platform Administration` | Department or agency unit | No |
| `ADMIN_MUST_CHANGE_PASSWORD` | `boolean` | `true` | Force password update on first login (**must be true in prod**) | **Yes** (true) |
| `ADMIN_REQUIRE_MFA_SETUP` | `boolean` | `true` | Force TOTP MFA setup on first login | Optional |
| `ADMIN_FORCE_PASSWORD_RESET` | `boolean` | `false` | Overwrite existing admin password & revoke sessions (**dev-only**) | **Forbidden** (false) |
| `ADMIN_PROMOTE_EXISTING` | `boolean` | `false` | Promote existing non-admin with `ADMIN_EMAIL` (**dev-only**) | **Forbidden** (false) |

> [!IMPORTANT]
> - Boolean variables in the schema use strict `z.enum(['true', 'false']).transform(...)` parsing. Values like `"1"`, `"yes"`, or undefined coercions are strictly rejected.
> - `ADMIN_FORCE_PASSWORD_RESET` and `ADMIN_PROMOTE_EXISTING` are dev-only flags. Setting them to `true` when `NODE_ENV=production` triggers immediate boot failure.
> - `ADMIN_PASSWORD` must differ from `SEED_DEFAULT_PASSWORD`.

---

## 3. First Run & Initial Provisioning

### Step 3.1: Configure Environment Variables

In `apps/api/.env`, configure the bootstrap parameters:

```env
ADMIN_BOOTSTRAP_ENABLED=true
ADMIN_NAME=System Administrator
ADMIN_EMAIL=admin@agency.gov
ADMIN_PASSWORD=InitialAdmin@Pass2026!
ADMIN_BADGE_NUMBER=SA-0001
ADMIN_DEPARTMENT=Platform Administration
ADMIN_MUST_CHANGE_PASSWORD=true
ADMIN_REQUIRE_MFA_SETUP=true
ADMIN_FORCE_PASSWORD_RESET=false
ADMIN_PROMOTE_EXISTING=false
```

### Step 3.2: Verify Configuration

Run the pre-flight verification suite:

```bash
pnpm env:check
```

The check verifies that:
1. `ADMIN_*` variables comply with complexity and safety rules.
2. The password is fully redacted (`ADMIN_PASSWORD = [REDACTED]`).
3. Connection to MongoDB Atlas succeeds.

### Step 3.3: Start the Backend API

Start the NestJS API application:

```bash
pnpm --filter @sentinel/api start
```

On boot, `AdminBootstrapService`:
1. Executes an atomic `$setOnInsert` query against the `users` collection using the unique `email` index.
2. Generates an `argon2id` hash with memory cost \(2^{16}\) and time cost 3.
3. Sets `role: 'super_admin'`, `status: 'active'`, `emailVerifiedAt: now()`, `createdVia: 'bootstrap'`, `mustChangePassword: true`, `mfaEnrollmentRequired: true`.
4. Writes an audit entry: `admin.bootstrap.create`.
5. Logs only the domain: `Bootstrap super_admin created successfully for domain @agency.gov.`

---

## 4. Forced Setup Flow (`/settings/account/security?required=1`)

When the bootstrap administrator logs in for the first time via `POST /api/v1/auth/login`:
1. The login response returns:
   ```json
   {
     "accessToken": "ey...",
     "mustChangePassword": true,
     "mfaEnrollmentRequired": true,
     "user": { ... }
   }
   ```
2. The web client (`AuthProvider`) detects the pending security flags and redirects immediately to:
   ```
   /settings/account/security?required=1
   ```
3. `JwtAuthGuard` on the API blocks all standard endpoints (cases, cameras, alerts, admin registries). Any attempt to access restricted APIs returns `403 Forbidden` (`Mandatory security setup pending`).
4. **Step 1 — Change Password**:
   - Officer inputs the bootstrap temporary passphrase and a new compliant operational passphrase.
   - Calls `POST /api/v1/auth/change-password`.
   - Clears `mustChangePassword: false` and emits audit event `user.password.change`.
5. **Step 2 — TOTP MFA Enrollment**:
   - Officer scans the generated TOTP QR code into an authenticator application.
   - Enters the 6-digit confirmation code.
   - Calls `POST /api/v1/auth/mfa/enable`.
   - Generates 8 single-use emergency backup recovery codes.
   - Clears `mfaEnrollmentRequired: false` and emits audit event `user.mfa.enroll`.
6. Once completed, the officer clicks **Complete Setup & Access Command Center** and is redirected to `/dashboard`.

---

## 5. Post-Boot Secret Hygiene

After initial provisioning, retaining plaintext passwords in environment files presents an unnecessary security risk.

1. Edit `apps/api/.env`:
   ```env
   ADMIN_BOOTSTRAP_ENABLED=false
   ADMIN_PASSWORD=
   ```
2. Run `pnpm env:check` to verify:
   ```bash
   pnpm env:check
   ```
   If `ADMIN_PASSWORD` is still present while `ADMIN_BOOTSTRAP_ENABLED=false`, `pnpm env:check` emits a warning:
   ```
   ⚠️ [WARN] Admin Password Hygiene: ADMIN_PASSWORD is still present in environment while ADMIN_BOOTSTRAP_ENABLED=false.
        👉 HINT: For security hygiene, remove ADMIN_PASSWORD from your .env file after initial provisioning.
   ```
   When removed, the check confirms:
   ```
   ✅ [PASS] Super Admin DB State: Active super_admin account verified in database (count: 1).
   ```

---

## 6. Rotating Admin Passwords & Recovery

When `ADMIN_BOOTSTRAP_ENABLED=false`, administrators have two dedicated mechanisms for password management:

### Option A: Interactive CLI Command (Recommended)

Run the interactive CLI prompt:

```bash
pnpm admin:reset-password
```

- Prompts for the administrator's email.
- Uses hidden terminal input (no characters echoed to the screen or recorded in shell history).
- Validates password complexity.
- Connects directly to the database and re-hashes with `argon2id`.
- Revokes all active web and device sessions in MongoDB.
- Records an audit log: `admin.bootstrap.password_reset`.

### Option B: Emergency Dev-Only Force Reset

In a development or staging environment where CLI access is restricted:
1. Set `ADMIN_BOOTSTRAP_ENABLED=true`
2. Set `ADMIN_FORCE_PASSWORD_RESET=true`
3. Set `ADMIN_PASSWORD=<new-temporary-password>`
4. Boot the server once to apply the reset.
5. Immediately revert `ADMIN_FORCE_PASSWORD_RESET=false` and blank `ADMIN_PASSWORD`.

---

## 7. Safety Controls & Lockout Defense

| Threat / Risk | Defensive Control | Enforcing Component |
| :--- | :--- | :--- |
| **Accidental Lockout** | Refuses to suspend, delete, or demote the last active `super_admin` (`HTTP 409 Conflict`). | `AdminBootstrapService.assertNotLastActiveSuperAdmin()` |
| **Password Leak in Logs** | `ADMIN_PASSWORD` is fully masked as `[REDACTED]` in `printMaskedConfig()` and Pino serializers. | `apps/api/src/config/utils/masked-config-printer.ts` |
| **Git Leaks** | Allowlist-free regex scan explicitly flags raw `ADMIN_PASSWORD` assignments. | `.gitleaks.toml` (`sentinel-admin-password-secret`) |
| **Concurrent Boot Races** | MongoDB atomic `$setOnInsert` and unique email index ensure only one record is created. | `AdminBootstrapService.bootstrapFromEnv()` |
| **Bypassing Setup** | `JwtAuthGuard` returns `403 Forbidden` for any console API until flags are cleared. | `apps/api/src/auth/guards/jwt-auth.guard.ts` |
| **Domain Privacy** | Console logs output only the email domain (e.g. `@agency.gov`), never officer names. | `AdminBootstrapService` Logger |

---

## 8. CLI Commands Summary

| Command | Purpose | Input Mechanism |
| :--- | :--- | :--- |
| `pnpm admin:create` | Provision a new Super Admin account without modifying `.env` | Interactive hidden prompt |
| `pnpm admin:reset-password` | Reset password for an existing Super Admin and revoke all sessions | Interactive hidden prompt |
| `pnpm env:check` | Verify environment schema, DB super admin status, and secret hygiene | Automated health suite |
