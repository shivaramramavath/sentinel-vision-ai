# Transactional Email & Notifications Architecture

## 1. Overview & Privacy Safeguards

Sentinel Vision AI handles critical identity lifecycle events (email verification, supervisor clearance approvals, password resets, token reuse alerts, device authorisations) via an asynchronous, fault-tolerant email pipeline:

- **Dual Transport Strategy**:
  - **Production**: Brevo (formerly Sendinblue) Transactional API (`EMAIL_TRANSPORT=brevo`).
  - **Development / Local**: Mailpit SMTP Server (`EMAIL_TRANSPORT=smtp-dev`).
- **Privacy & CJIS Compliance**:
  - Email bodies and subject contents containing sensitive case or user details are **never logged** to stdout or disk.
  - `BrevoService` logs exclusively the recipient's domain (e.g. `dispatched to @sentinel.gov`), never personal identifiers.
  - Database logs in MongoDB (`email_logs` collection) store only a cryptographic SHA-256 hash of the recipient address (`recipientHash`), template ID, message ID, attempts, and delivery status.

---

## 2. BullMQ Queue & Worker Architecture

Email delivery is completely decoupled from HTTP request lifecycles to guarantee sub-millisecond response times:

```mermaid
flowchart LR
    A[NestJS Controller / Service] -->|emailService.enqueue()| B[(Redis: BullMQ 'email' Queue)]
    B --> C[EmailProcessor Worker]
    C -->|Brevo or Mailpit| D[Mail Transport]
    C -->|Retry 5x Exponential Backoff| B
    C -->|After 5 Failures| E[(DLQ: 'email-failed')]
    C --> F[(MongoDB: 'email_logs')]
```

- **Queue Name**: `email`
- **Concurrency**: 5 parallel worker threads
- **Retry Strategy**: 5 attempts with exponential backoff (`delay = 2000 * 2^(attempt - 1)`).
- **Dead Letter Queue (DLQ)**: Failed deliveries after 5 attempts are routed to `email-failed` and trigger a high-priority system alert.

---

## 3. Local Development with Mailpit

In development, all emails are captured by the containerized Mailpit service:

- **SMTP Ingestion Port**: `1025`
- **Web UI & REST API**: `http://localhost:8025`

To start Mailpit:
```bash
docker compose -f infra/docker-compose.dev.yml up -d sentinel-mailpit
```

Verify Mailpit is running:
```bash
curl http://localhost:8025/api/v1/info
```

Open `http://localhost:8025` in your browser to inspect delivered HTML emails, test verification links, and review responsive rendering.

---

## 4. Production Setup with Brevo

1. Sign up at [Brevo (Sendinblue)](https://www.brevo.com/).
2. Navigate to **SMTP & API** > **API Keys** and generate a new API key.
3. Configure sender domains under **Senders, Domains & Dedicated IPs**.
4. Set the following environment variables in production:
```env
EMAIL_TRANSPORT=brevo
BREVO_API_KEY=xkeysib-your-actual-api-key
EMAIL_FROM="Sentinel Vision AI <no-reply@sentinel-vision.gov>"
```

---

## 5. Catalog of Email Templates

All email templates use a crisp, black-and-white, shadcn-aligned responsive HTML design tested across desktop and mobile mail clients:

| Template Identifier | Trigger Event | Key Call to Action |
| :--- | :--- | :--- |
| `verifyEmail` | User registration | "Verify Email Address" button (valid 24h) |
| `welcomePendingApproval`| User registration complete | Information on administrator clearance review |
| `accountApproved` | Supervisor approves user | "Sign In to Terminal" button with assigned role |
| `accountRejected` | Supervisor rejects user | Explanation of agency clearance denial |
| `passwordReset` | Password reset requested | "Reset Passphrase" button (valid 30m) |
| `passwordChanged` | Passphrase changed | Alert notice with timestamp and device summary |
| `newLoginAlert` | New device / location login | "Secure My Account / Wasn't Me" emergency link |
| `securityAlert` | Token reuse or compromise | Alert notice of immediate session invalidation |
| `mobileOperatorApproved`| Mobile operator approved | Instructions to pair bodycam / mobile device |
| `deviceApproved` | Mobile device authorized | WHIP streaming activation confirmation |
| `invite` | Station / Department invite | "Accept Station Clearance" button with invite code |
