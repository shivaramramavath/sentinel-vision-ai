# Storage Architecture & Cloudinary Integration

## 1. Overview
Sentinel Vision AI employs a unified, vendor-agnostic storage abstraction layer (`StorageProvider`) designed to manage the lifecycle, cryptographic integrity, delivery security, and auditability of digital assets across the platform.

Cloudinary is the primary production driver (`STORAGE_DRIVER=cloudinary`), replacing MinIO for all sensitive evidentiary, biometric, and operational assets. MinIO remains available as an offline development driver and as the default storage driver for continuous video recording segments (`RECORDING_DRIVER=minio|local|off`).

```mermaid
flowchart TD
    Client[Web & Mobile Clients]
    Worker[Python Inference & Frame Workers]
    NestAPI[NestJS API Gateway]
    StorageSvc[StorageService Abstraction]
    Cloudinary[Cloudinary Provider (Authenticated Delivery)]
    MinIO[MinIO / S3 Provider (Continuous Recordings & Offline Dev)]
    Mongo[(MongoDB: media_assets collection)]
    Custody[(Custody Ledger & Audit Trail)]

    Client -->|Bearer Auth / Signed URLs| NestAPI
    Worker -->|x-internal-service-token| NestAPI
    NestAPI --> StorageSvc
    StorageSvc -->|Metadata & Checksums| Mongo
    StorageSvc -->|Audit Logs| Custody
    StorageSvc -->|DRIVER=cloudinary| Cloudinary
    StorageSvc -->|DRIVER=minio| MinIO
```

---

## 2. Environment Variables & Fail-Fast Boot
All storage configuration is defined via environment variables. Sensitive API keys and secrets reside strictly on the server in `apps/api/.env` and are **never exposed to frontend clients**.

| Environment Variable | Description | Default / Example |
|---|---|---|
| `STORAGE_DRIVER` | Active driver for sensitive assets (`cloudinary` or `minio`) | `cloudinary` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account cloud name | `sentinel-gov` |
| `CLOUDINARY_API_KEY` | Cloudinary REST API Key | `123456789012345` |
| `CLOUDINARY_API_SECRET` | Cloudinary REST API Secret | `••••••••••••••••••••••••••••••••` |
| `CLOUDINARY_URL` | Optional composite URL (`cloudinary://key:secret@cloud`) | `cloudinary://...` |
| `CLOUDINARY_ROOT_FOLDER` | Namespace root folder per environment | `sentinel/dev` |
| `CLOUDINARY_SIGNED_URL_TTL_SECONDS` | Default signed URL lifetime (seconds) | `300` |
| `CLOUDINARY_NOTIFICATION_URL` | Webhook URL for asynchronous video transformations | `${API_URL}/webhooks/cloudinary` |
| `CLOUDINARY_MAX_IMAGE_MB` | Maximum permitted image upload size | `25` |
| `CLOUDINARY_MAX_VIDEO_MB` | Maximum permitted video clip upload size | `100` |
| `RECORDING_DRIVER` | Driver for continuous 24/7 video segments (`minio`, `local`, `off`) | `minio` |
| `INTERNAL_SERVICE_TOKEN` | Shared secret token for Python AI workers | `••••••••••••••••••••••••••••••••` |

On startup, `EnvValidationSchema` and `app.config.ts` perform strict validation. If `STORAGE_DRIVER=cloudinary` and required credentials are missing in production mode, the application terminates immediately with a clear error message.

---

## 3. Deterministic Public ID & Folder Conventions
To ensure consistent asset referencing and case-level isolation, all assets uploaded to Cloudinary adhere to deterministic paths rooted at `CLOUDINARY_ROOT_FOLDER`:

| Asset Kind | Storage Path / Public ID Pattern | Resource Type | Delivery Type |
|---|---|---|---|
| **Reference Photo** | `{ROOT}/cases/{caseId}/references/{referenceId}` | `image` | `authenticated` |
| **Suspect Crop** | `{ROOT}/cases/{caseId}/crops/{cropId}` | `image` | `authenticated` |
| **Evidence Snapshot** | `{ROOT}/cases/{caseId}/evidence/{evidenceId}` | `image` | `authenticated` |
| **Event Video Clip** | `{ROOT}/cases/{caseId}/clips/{clipId}` | `video` | `authenticated` |
| **PDF Case Dossier** | `{ROOT}/reports/{reportId}` | `raw` | `authenticated` |
| **User Avatar** | `{ROOT}/avatars/{userId}` | `image` | `authenticated` |
| **Export Bundle** | `{ROOT}/exports/{exportId}` | `raw` | `authenticated` |

---

## 4. Security & Delivery Guarantees
### 4.1 Strict Authenticated Delivery (`type: authenticated`)
- **No Public Access**: All evidentiary images, face crops, surveillance snapshots, and video clips are stored with delivery type `authenticated`. Public CDN access via bare URLs is prohibited by Cloudinary access control.
- **HMAC-SHA Signed URLs**: Delivery URLs are dynamically signed using Cloudinary's cryptographic signature algorithm (`sign_url: true`) with short TTLs (default 300s, AI inference 120s).
- **Zero Secrets on Workers & Frontend**: Python inference workers and web browsers never possess Cloudinary API secrets. Workers upload frames and fetch originals via authenticated internal gateway endpoints (`/internal/evidence` and `/internal/media/:id/original`) authenticated with `x-internal-service-token`.

### 4.2 Append-Only Chain of Custody & Audit Logging
Whenever a signed delivery URL is issued for an evidentiary asset or reference photo, Sentinel logs an immutable record:
1. An audit event `MEDIA_SIGNED_URL_ISSUED` is logged in the MongoDB audit trail with user identity, purpose, and timestamp.
2. An append-only hash-chained custody entry (`action: 'access_signed_url'`) is added to the evidence item's ledger, linking the requester, time, and calculated SHA-256 seal.

### 4.3 Statutory Legal Hold Protection
Assets marked with `legalHold: true` cannot be purged or deleted:
- Calling `storageService.delete(assetId)` on an asset under legal hold throws a `ForbiddenException (403)`.
- Cloudinary asset metadata includes the `hold` tag and context attributes.

---

## 5. Media Normalization Pipeline
Prior to upload, all inbound images pass through an automated `sharp` normalization pipeline:
1. **EXIF Auto-Orientation**: Bakes camera rotation tags (`.rotate()`) into pixels, preventing inverted or sideways facial crops.
2. **Privacy EXIF Stripping**: Strips embedded GPS coordinates, camera serial numbers, and device metadata (`withMetadata({ exif: false })`).
3. **Format Whitelist & Conversion**: Converts iPhone HEIC/HEIF files to standard JPEG (`image/jpeg`).
4. **Dimension Bounds**: Caps maximum long-edge dimension at `4096px` while maintaining original aspect ratio.
5. **Cryptographic Checksum**: Computes canonical SHA-256 digest on normalized bytes before persistence.

---

## 6. Transformation Presets
Cloudinary on-the-fly transformations are leveraged for performant UI rendering while **never mutating original files**:

| Transformation Preset | Purpose | Cloudinary Parameters |
|---|---|---|
| `thumb` | Grid thumbnails & avatar icons | `c_thumb,g_face,w_256,h_256,q_auto,f_auto` |
| `card` | Candidate sighting cards | `c_fill,g_face,w_480,h_360,q_auto,f_auto` |
| `viewer` | High-resolution item inspection | `c_limit,w_1920,h_1080,q_auto,f_auto` |
| `clip_preview` | Video poster / thumbnail frame | `so_0,w_640,h_360,c_fill,f_jpg` |
| `inference` | AI feature extraction | **Uncompressed original bytes** (`sign_url: true`, no transforms) |
| `download` | Evidentiary package export | Original bytes with `fl_attachment` header |

---

## 7. Storage Driver Configuration (`RECORDING_DRIVER`)
Continuous 24/7 surveillance footage produces high volumes of 10-second `.ts` or `.mp4` video segments:
- Continuous video recordings are routed according to `RECORDING_DRIVER=minio|local|off`.
- When an event occurs (such as a candidate sighting or manual bookmark), Sentinel isolates the relevant window (-10s to +20s), places it under case legal hold, and uploads the evidentiary clip into Cloudinary (`kind: 'clip'`).
