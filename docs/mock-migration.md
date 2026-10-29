# Mock Migration & Frontend Real-Data Plan

This document details the inventory of mock data currently present in `apps/web/src/mocks/data.ts` and `apps/web/src/mocks/db.ts`, along with the target MongoDB collections, NestJS endpoints, TanStack Query hooks, consuming components, server-computed derived values, and flagged inconsistencies.

---

## 1. Inventory & Migration Matrix

| Mock Export | Source Type (`@/types` or `db.ts`) | Target MongoDB Collection | NestJS Endpoint(s) | TanStack Query Hook | Consuming Components / Pages |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`MOCK_CURRENT_USER`** | `User` | `users` | `GET /api/v1/auth/me` | `useCurrentUser()` | `auth.service.ts`, `user.service.ts`, `topbar.tsx` |
| **`MOCK_USERS`** | `User[]` | `users` | `GET /api/v1/users` | `useUsers()` | `user.store.ts`, `user.service.ts` |
| **`MOCK_CASES`** / **`INITIAL_CASES`** | `Case[]` | `cases` | `GET /api/v1/cases`, `GET /api/v1/cases/:id`, `GET /api/v1/cases/:id/overview` | `useCases()`, `useCase(id)`, `useCaseOverview(id)` | `cases/page.tsx`, `cases/[id]/page.tsx`, `evidence/page.tsx`, `reports/page.tsx`, `search/page.tsx`, `search/[id]/page.tsx`, `journeys/page.tsx`, `DashboardHeroMap.tsx`, `CaseHeader.tsx`, `CaseSwitcher.tsx`, `PersonCommand.tsx`, `case.service.ts` |
| **`MOCK_CAMERAS`** / **`INITIAL_CAMERAS`** | `Camera[]` | `cameras` | `GET /api/v1/cameras`, `GET /api/v1/cameras/geojson`, `GET /api/v1/cameras/:id`, `GET /api/v1/cameras/:id/health` | `useCameras(filters)`, `useCamerasGeoJson()`, `useCamera(id)`, `useCameraHealth(id)` | `cameras/page.tsx`, `cameras/[id]/page.tsx`, `SituationRoom.tsx`, `DashboardHeroMap.tsx`, `CameraDetailPanel.tsx`, `UnplacedCamerasTray.tsx`, `camera.service.ts` |
| **`SURVEILLANCE_LOCATIONS`** / **`SURVEILLANCE_SITES`** | `LocationConfig[]` | `cameras` (distinct site metadata) | `GET /api/v1/cameras/sites` | `useCameraSites()` | `MobileIngestionPanel.tsx`, `DashboardHeroMap.tsx`, `cameras/page.tsx` |
| **`MOCK_TOPOLOGY_TRANSITIONS`** / **`INITIAL_TOPOLOGY_TRANSITIONS`** | `CameraTopologyTransition[]` | `cameratopologies` | `GET /api/v1/cameras/topology`, `PATCH /api/v1/topology/transitions/:id` | `useTopology()`, `useUpdateTransition()` | `cameras/page.tsx`, `CameraDetailPanel.tsx`, `TopologyEditBanner.tsx`, `DashboardHeroMap.tsx` |
| **`MOCK_SIGHTINGS`** / **`INITIAL_SIGHTINGS`** | `Sighting[]` | `sightings` | `GET /api/v1/sightings`, `GET /api/v1/sightings/:id`, `POST /api/v1/sightings/:id/decision` | `useSightings(filters)`, `useSighting(id)`, `useDecideSighting()` | `review/page.tsx`, `cases/[id]/page.tsx`, `search/[id]/page.tsx`, `cameras/[id]/page.tsx`, `CameraDetailPanel.tsx`, `sighting.service.ts` |
| **`INITIAL_HARD_NEGATIVES`** | `HardNegative[]` | `sightings` (flag `isHardNegative: true` or negative cluster) | `GET /api/v1/cases/:id/hard-negatives` | `useHardNegatives(caseId)` | `review/page.tsx` |
| **`MOCK_SEARCH_JOBS`** / **`INITIAL_SEARCH_JOBS`** | `SearchJob[]` | `searchjobs` | `GET /api/v1/search-jobs`, `GET /api/v1/search-jobs/:id`, `POST /api/v1/search-jobs` | `useSearchJobs(caseId)`, `useCreateSearchJob()` | `search/page.tsx`, `cases/[id]/page.tsx`, `search.service.ts` |
| **`MOCK_JOURNEYS`** / **`INITIAL_DETAILED_JOURNEYS`** | `Journey[]` / `DetailedJourney[]` | `sightings` / `journeys` (aggregated hops) | `GET /api/v1/journeys?caseId=...`, `GET /api/v1/cases/:id/journey` | `useJourney(caseId)` | `journeys/page.tsx`, `DashboardHeroMap.tsx`, `journey.service.ts` |
| **`MOCK_EVIDENCE`** | `EvidenceItem[]` | `evidences` | `GET /api/v1/evidence`, `GET /api/v1/evidence/:id`, `GET /api/v1/evidence/summary/integrity` | `useEvidence(params)`, `useIntegritySummary()` | `evidence/page.tsx` |
| **`MOCK_ALERTS`** | `SystemAlert[]` | `systemalerts` | `GET /api/v1/alerts`, `GET /api/v1/alerts/summary`, `POST /api/v1/alerts/:id/ack` | `useAlerts(params)`, `useAlertsSummary()`, `useAckAlert()` | `alerts/page.tsx`, `topbar.tsx`, `DashboardHeroMap.tsx` |
| **`MOCK_REPORTS`** | `SystemReport[]` | `systemreports` | `GET /api/v1/reports`, `POST /api/v1/reports` | `useReports(params)`, `useCreateReport()` | `evidence/page.tsx`, `reports/page.tsx`, `report.service.ts` |
| **`INITIAL_AUDIT_TRAIL`** | `AuditEntry[]` | `adminaudits` / `caseactivities` | `GET /api/v1/cases/:id/activity`, `GET /api/v1/admin/audit` | `useCaseActivity(caseId)`, `useAdminAuditLog()` | `cases/[id]/page.tsx`, `review/page.tsx`, `admin/[section]/page.tsx` |
| **`AI_MODEL_REGISTRY`** | Model config object | `registeredmodels` (or shared config) | `GET /api/v1/admin/models` | `useModelRegistry()` | `ScoreBreakdown.tsx`, `search/page.tsx`, `admin/[section]/page.tsx` |

---

## 2. Server-Computed Derived Values (Must NOT be Hard-Coded)

The following metrics are currently hard-coded or computed via in-memory mock client filters in `db.ts` or `data.ts`. They will be computed dynamically on the server:

1. **Dashboard KPIs (`GET /api/v1/dashboard/summary`)**:
   - `activeCases`: Count of cases where `status === 'active'`.
   - `searchesRunning`: Count of `searchjobs` where `status === 'running'`.
   - `pendingReviews`: Count of `sightings` where `status === 'pending'`.
   - `peopleTracked`: Distinct cases with confirmed sightings in the last 24h.
   - `camerasSearching`: Number of active cameras referenced in running search jobs.
   - `completedToday`: Cases closed or sightings resolved today.
   - `avgVerificationTime`: Server-computed mean of `reviewedAt - createdAt` across decided sightings in the last 7 days.
2. **Global & Per-Case Counts (`GET /api/v1/counts?scope=global|case:{id}`)**:
   - `pendingReviews`: Drives sidebar badge for Review and case header counter.
   - `liveCameras`: Count of cameras with `status === 'LIVE'`. Drives sidebar badge for Cameras.
   - `degradedCameras`: Count of cameras with `status === 'DEGRADED'`.
   - `offlineCameras`: Count of cameras with `status === 'OFFLINE'`.
   - `unplacedCameras`: Count of cameras lacking geo coordinates / floorplan placement.
   - `alerts`: Active unread alerts count for topbar.
   - `confirmedSightings`: Sightings decided as 'confirmed'.
   - `rejectedSightings`: Sightings decided as 'rejected'.
   - `needsEvidenceSightings`: Sightings marked 'needs_evidence'.
3. **Case Biometric Readiness (`GET /api/v1/cases/:id/readiness` or inside `/cases/:id/overview`)**:
   - Readiness percentage calculated from reference photo quality scores, face detection status, and ReID extraction completion.
4. **Minor Flag**:
   - Server-derived `isMinor: boolean` based on Date of Birth (`dob`) relative to current date, supplied directly on case records.

---

## 3. Flagged Inconsistencies & Fixes in Seed Data

1. **Duplicate Faces / Photos**:
   - *Inconsistency*: Unsplash URLs `photo-1544005313-94ddf0286df2` and `photo-1517841905240-472988babdf9` were reused across both Maya Lin (`case_001`), Maya Chen (`MP-2026-1042`), and multiple sighting candidate crops.
   - *Fix*: Provide distinct, unique seeded photos for each person and sighting candidate stored in `apps/api/seed-assets/` and served through the backend API with SHA-256 hashes.
2. **User Role Inconsistencies**:
   - *Inconsistency*: `data.ts` uses legacy roles (`'admin'`, `'operator'`, `'analyst'`, `'viewer'`) whereas `users/schemas/user.schema.ts` and `seed.ts` used `'Super Admin'`, `'Investigator'`, `'Reviewer'`, `'Viewer'`.
   - *Fix*: Unify on the standard enum: `super_admin | investigator | reviewer | viewer` (plus `mobile_operator`). Update guards and UI permissions to use this unified enum.
3. **Mismatched IDs and Camera Naming**:
   - *Inconsistency*: In `data.ts`, cameras are named `CCTV 001`, `cam_001` whereas new UI views standardise on `CAM-001`. Cases used `case_001` while the rest of the application references `MP-2026-0891` or `MP-2026-1042`.
   - *Fix*: Standardize deterministic IDs across seed collections: `CAM-001` through `CAM-124`, `MP-2026-0042`, `MP-2026-0891`, `MP-2026-1042`, preserving stable slugs so URLs and tests remain consistent.
4. **Topology Adjacency**:
   - *Inconsistency*: Transitions in `data.ts` were arbitrary pairs with static travel times.
   - *Fix*: Generate deterministic topology links based on actual Haversine distance between cameras, calculating realistic `minTravelSec` and `maxTravelSec`.

---

## 4. Architecture Slices

- **Step 1: Shared Types & Enums**: Export domain Zod schemas and inferred types (`@sentinel/shared-types`), unified roles, and API envelopes (`Paginated<T>`, `ApiError`).
- **Step 2: Backend Database Seeder**: Modular seeder in `apps/api/src/seed/` with seed key upsert, timestamp offsets from now, and argon2id password hashing.
- **Step 3: Backend Derived Endpoints**: Implement `/dashboard/summary`, `/counts`, and full REST cursor-paginated endpoints for cases, sightings, cameras, and journeys.
- **Step 4: Frontend Data Layer**: TanStack Query v5 client, query keys factory, API services, and custom hooks with loading skeletons, empty states, and error handling.
- **Step 5: Migration Slices**: Migrate slice-by-slice (Auth $\to$ Cameras $\to$ Cases $\to$ Sightings/Review $\to$ Journeys $\to$ Search Jobs $\to$ Evidence/Alerts/Reports $\to$ Dashboard/Counts/Sidebar).
- **Step 6: Guardrails & Tests**: Remove `USE_MOCKS`, delete `data.ts` and `db.ts`, enforce CI zero-mock check, and run end-to-end and Jest test suites.
