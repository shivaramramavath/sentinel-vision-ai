# Sentinel Vision AI — docs/status.md

> Generated: 2026-10-30  
> Update this file at the end of every phase.

---

## PHASE 0 — AUDIT & BASELINE FIXES

| Item | Status | Notes |
|------|--------|-------|
| `docs/status.md` produced | ✅ Done | This file |
| Authorization audit: all controllers scanned | ✅ Done | See table below |
| Runtime RBAC discovery service | ⚠️ Partial | Planned in `apps/api/src/common/rbac/rbac-discovery.service.ts` |
| CI test: route without @Public() or permission fails | ⚠️ Partial | `apps/api/src/common/rbac/rbac-matrix.spec.ts` to be added |
| cameras.controller.ts – added missing guards | ✅ Done | GET /cameras, GET /cameras/:id, GET /cameras/nearby, GET /cameras/topology, GET /cameras/geojson, GET /cameras/next-search, GET /cameras/bandwidth/report, POST /cameras/bandwidth/estimate, POST /cameras/test-connection, GET /cameras/:id/gaps, POST /cameras/:id/mobile-telemetry, POST /cameras/:id/clock-sync, GET /cameras/:id/sampler-metrics, POST /cameras/:id/sample-fps, GET /cameras/:id/health, GET /cameras/:id/snapshot, GET /cameras/tracks/nearby, POST /cameras/tracks/telemetry, POST /cameras/health, POST /cameras/:id/segments, GET /cameras/:id/timeline, GET /cameras/:id/playback/playlist.m3u8, POST /cameras/:id/clips/export, POST /cameras/:id/event-clip, GET /cameras/storage/report |
| Public-by-design endpoint hardening | ⚠️ Partial | Shared-secret middleware for /media/auth, /webhooks/*, /internal/* planned |
| Mailpit removal | ✅ Done | Docker compose, SMTP-dev module, nodemailer removed |
| QR pairing endpoints removed | ✅ Done (prior session) | No QR routes found in codebase |
| Global STREAM_KEY_SECRET removed | ✅ Done (prior session) | Per-camera JWT keys used |
| CJIS compliance claims removed | ✅ Done (prior session) | No CJIS text found in UI/docs |
| Mock data in apps/api/src | ✅ Clean | No MOCK_* constants found |
| Mock data in apps/web/src | ✅ Clean | No MOCK_* constants found |
| docs/architecture.md – Re-ID 512-d, Cloudinary | ⚠️ Partial | Still shows 256-d and MinIO references |
| docs/email.md – Mailpit removed | ⚠️ Partial | File still has Mailpit references |
| docs/setup-keys.md – SMTP vars removed | ⚠️ Partial | Still lists SMTP_DEV_* variables |
| docs/auth.md – RBAC table regenerated | ⚠️ Partial | Table not yet regenerated from code |
| docs/env.md – SMTP vars removed | ⚠️ Partial | EMAIL_TRANSPORT, SMTP_DEV_* still listed |
| docs/evaluation.md – synthetic numbers flagged | ⚠️ Partial | Warning notice not yet prepended |
| Redis requirepass enforcement | ⚠️ Partial | Schema validates REDIS_PASSWORD; docker compose needs update |
| .env tracked in git | ✅ Clean | .env is in .gitignore |
| gitleaks scan | ⚠️ Not run | Run: `npx gitleaks detect --source=.` |

---

## PHASE 1 — PLATFORM FOUNDATION

| Item | Status | Notes |
|------|--------|-------|
| Zod config schema — z.enum booleans, no secret defaults | ✅ Done | `apps/api/src/config/env.schema.ts` |
| Zod superRefine — Brevo required in non-test | ✅ Done | `env.schema.ts` |
| Zod superRefine — production security rules | ✅ Done | `env.schema.ts` |
| `pnpm env:check` script | ⚠️ Partial | Needs live service checks for MongoDB, Redis, Kafka, Pinecone, Cloudinary, Brevo, MediaMTX |
| Storage driver async factory (no process.env at import) | ✅ Done | `apps/api/src/common/storage/storage.module.ts` rewired with `STORAGE_PROVIDER` token |
| `safeDelayMs` helper + unit tests | ✅ Done | `apps/api/src/common/utils/time.utils.ts` + `__tests__/time.utils.spec.ts` |
| Replace raw `setTimeout(..., x - Date.now())` | ⚠️ Partial | Helper created; grep for usages pending |
| KafkaJS partitioner warning fixed | ✅ Done | `apps/api/src/common/kafka/kafka.service.ts` — `Partitioners.DefaultPartitioner` |
| docs/kafka.md created/updated | ⚠️ Partial | Needs creation/update |
| Bull Board gated by QUEUE_DASHBOARD_ENABLED | ⚠️ Partial | Needs update in `apps/api/src/main.ts` |
| Swagger gated by SWAGGER_ENABLED | ⚠️ Partial | Needs update in `apps/api/src/main.ts` |
| Startup log: selected storage driver | ✅ Done | StorageModule logs selected driver |
| Startup log: no negative-timeout warning | ⚠️ Partial | safeDelayMs helper available; callers need updating |
| Startup log: no partitioner warning | ✅ Done | Partitioners.DefaultPartitioner added |
| Startup log: Bootstrap admin message | ✅ Done (prior session) | AdminBootstrapService logs exist |

---

## PHASE 2 — IDENTITY, SESSIONS AND ROLES

| Item | Status | Notes |
|------|--------|-------|
| Staff register + email verify + admin approval | ✅ Exists | `apps/api/src/auth/auth.service.ts` |
| Login with generic 401 + internal reason codes | ⚠️ Partial | Generic 401 exists; internal reason codes + audit partial |
| Account lockout | ✅ Exists | 5-attempt lockout, 15-min, in AuthService |
| MFA (TOTP + recovery codes) | ✅ Exists | `auth.service.ts` |
| Google/GitHub OAuth | ✅ Exists | Passport strategies registered |
| Logout / logout-all | ✅ Exists | Session revocation |
| Password reset flow | ✅ Exists | Forgot/reset token flow |
| Step-up auth | ✅ Exists | `RequireStepUp()` decorator + guard |
| Redis sessions (opaque refresh tokens, rotation, reuse detection) | ⚠️ Partial | Sessions in MongoDB; Redis integration partial |
| Email normalisation (shared Zod pipe) | ⚠️ Partial | Inline trim().toLowerCase() in auth.service; no shared pipe |
| Mobile realm (separate audience, /m/login) | ✅ Exists | `apps/api/src/mobile/` |
| Bootstrap super admin from env | ✅ Exists | `admin-bootstrap.service.ts` |
| Brevo email service (typed config, queue, templates) | ✅ Exists | `apps/api/src/modules/email/` |

---

## PHASE 3 — CAMERAS AND CONTINUOUS VIDEO INGESTION

| Item | Status | Notes |
|------|--------|-------|
| Camera registry (CCTV RTSP, WebRTC, webcam, file) | ✅ Exists | `apps/api/src/cameras/` |
| Consent/authorization record | ⚠️ Partial | Not fully implemented |
| Per-camera stream keys | ✅ Exists | Implemented in cameras service |
| Geo + heading + FOV | ✅ Exists | Camera schema includes location |
| Topology edges | ✅ Exists | Topology routes in cameras controller |
| Continuous streaming / MediaMTX integration | ✅ Exists | `cameras.service.ts` |
| Health state machine | ✅ Exists | Health polling and status |
| WebRTC WHIP for mobile | ⚠️ Partial | Basic mobile stream support exists |
| frame-sampler app | ✅ Exists | `apps/frame-sampler/` |
| Cameras page (UI) | ✅ Exists | `apps/web/src/app/(app)/cameras/` |
| `pnpm ingest:simulate` | ❌ Missing | Not yet implemented |

---

## PHASE 4 — MISSING-PERSON REGISTRY AND WATCHLIST

| Item | Status | Notes |
|------|--------|-------|
| Registration wizard | ✅ Exists | `apps/api/src/missing-persons/` |
| Reference photo manager | ⚠️ Partial | Upload + Cloudinary storage; quality scoring partial |
| Watchlist Pinecone index upsert on case activation | ⚠️ Partial | Watchlist service exists; real Pinecone integration partial |
| Watchlist cleanup on case close | ⚠️ Partial | Logic exists but not fully tested |
| Hard negatives | ❌ Missing | Not implemented |
| Readiness score | ⚠️ Partial | Basic quality scoring exists |

---

## PHASE 5 — LIVE AI PIPELINE AND WATCHLIST MATCHING

| Item | Status | Notes |
|------|--------|-------|
| apps/inference (FastAPI + PyTorch) | ✅ Exists | `apps/inference/` |
| YOLO detection | ✅ Exists | YOLOv8 in inference |
| ByteTrack tracking | ✅ Exists | ByteTrack integration |
| ArcFace face embedding (512-d) | ✅ Exists | Model registry specifies face 512 |
| OSNet Re-ID embedding (512-d) | ✅ Exists | Model registry specifies reid 512 |
| Crop quality gating | ⚠️ Partial | Basic gating; FIQA partial |
| Pinecone watchlist matching | ⚠️ Partial | API integration exists; real queries partial |
| Evidence aggregation per track | ⚠️ Partial | Logic implemented partially |
| Camera plausibility scoring | ❌ Missing | Not yet implemented |
| Fusion + calibration model | ❌ Missing | Not yet implemented |
| `candidates.scored` Kafka event | ⚠️ Partial | Event type defined; emission logic partial |
| Privacy: non-match embeddings never persisted | ✅ Exists (by design) | Redis TTL-only embeddings |
| Latency: p95 <= 5s on GPU | ❌ Unmeasured | Evaluation pending Phase 11 |

---

## PHASE 6 — SIGHTINGS, ALERTS AND NOTIFICATIONS

| Item | Status | Notes |
|------|--------|-------|
| Sighting creation from candidates.scored | ✅ Exists | `apps/api/src/sightings/` |
| Alert rules engine (band, priority, SLA) | ⚠️ Partial | `apps/api/src/alerts/` |
| Alert deduplication | ⚠️ Partial | Basic dedup logic |
| SLA escalation timers | ⚠️ Partial | Logic exists; safeDelayMs needs applying |
| Dashboard alerts (Socket.IO) | ✅ Exists | Socket.IO gateway |
| Email alerts via Brevo queue | ✅ Exists | possibleMatchAlert template |
| Delivery log | ⚠️ Partial | EmailLog exists |

---

## PHASE 7 — REVIEW AND VERIFICATION

| Item | Status | Notes |
|------|--------|-------|
| Review workspace (UI) | ✅ Exists | `apps/web/src/app/(app)/review/` |
| Decision flow (same/not-same/more-evidence) | ✅ Exists | `apps/api/src/sightings/` |
| Four-eyes on critical cases | ⚠️ Partial | Policy defined; enforcement partial |
| Audit trail | ✅ Exists | AuditService |
| Hard-negative recording on rejection | ❌ Missing | Not yet implemented |

---

## PHASE 8 — JOURNEYS, RETROSPECTIVE SEARCH AND MAPS

| Item | Status | Notes |
|------|--------|-------|
| Journey reconstruction | ⚠️ Partial | `apps/api/src/journeys/` |
| Retrospective search | ⚠️ Partial | `apps/api/src/search-jobs/` |
| BullMQ + Kafka sharded search | ⚠️ Partial | Basic queue structure |
| Maps (MapLibre) | ⚠️ Partial | UI map exists; journey map partial |

---

## PHASE 9 — EVIDENCE, REPORTS, RETENTION AND PRIVACY

| Item | Status | Notes |
|------|--------|-------|
| Cloudinary authenticated storage | ✅ Exists | CloudinaryStorageProvider |
| Custody ledger | ⚠️ Partial | Hash chaining partial |
| Integrity verification | ❌ Missing | Re-hash check not implemented |
| Legal hold | ⚠️ Partial | Schema field exists |
| Reports | ⚠️ Partial | `apps/api/src/reports/` |
| Retention jobs | ⚠️ Partial | StorageLifecycleService |
| Data-subject requests | ❌ Missing | Not implemented |

---

## PHASE 10 — DASHBOARD AND UX CONSOLIDATION

| Item | Status | Notes |
|------|--------|-------|
| Command Center page | ✅ Exists | Dashboard routes |
| TanStack Query integration | ✅ Exists | Throughout web app |
| Permission-driven sidebar | ✅ Exists | RBAC-gated navigation |
| Light/dark theme | ✅ Exists | shadcn/ui with theme |
| Playwright tests per role | ❌ Missing | Not yet written |

---

## PHASE 11 — EVALUATION, PERFORMANCE AND RELEASE

| Item | Status | Notes |
|------|--------|-------|
| `make eval` on real datasets | ❌ Missing | Phase 11 |
| Load tests (k6) | ❌ Missing | Phase 11 |
| Chaos tests | ❌ Missing | Phase 11 |
| Release checklist | ❌ Missing | Phase 11 |

---

## SUMMARY

- **Phase 0**: ✅ Audit done; ⚠️ several doc updates and endpoint hardening still needed
- **Phase 1**: ✅ safeDelayMs + Kafka partitioner + storage factory done; ⚠️ env:check, Bull Board/Swagger gates, remaining setTimeout replacements pending
- **Phases 2–7**: ⚠️ Partial — core functionality exists; hardening and completeness work needed per phase
- **Phases 8–11**: ❌ Mostly missing or early skeleton

> **Action required before continuing to Phase 2:**
> 1. Add shared email-normalisation Zod transform used by ALL DTOs
> 2. Complete auth login reason codes and audit logging
> 3. Apply `safeDelayMs` to all SLA escalation timers in alerts service
> 4. Gate Bull Board and Swagger behind feature flags in main.ts
> 5. Update corrupted docs (architecture.md, email.md, setup-keys.md, env.md)
