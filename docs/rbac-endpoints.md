# Sentinel Vision AI — API Endpoint RBAC Audit

| HTTP Method | Endpoint | Required Permission(s) | Step-Up Required | Controller File |
|:---|:---|:---|:---:|:---|
| PUT | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class RbacController {
  constructor(private readonly rbacService: RbacService/admin/users/:id/role` | `roles:read` | No | apps/api/src/rbac/rbac.controller.ts |
| GET | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class RbacController {
  constructor(private readonly rbacService: RbacService/rbac/matrix` | `roles:read` | No | apps/api/src/rbac/rbac.controller.ts |
| GET | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class RbacController {
  constructor(private readonly rbacService: RbacService/rbac/roles` | `authenticated / public` | No | apps/api/src/rbac/rbac.controller.ts |
| GET | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(AuditInterceptor)
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService/cases/:caseId/evidence` | `authenticated / public` | No | apps/api/src/evidence/evidence.controller.ts |
| GET | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(AuditInterceptor)
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService/custody` | `evidence:export` | No | apps/api/src/evidence/evidence.controller.ts |
| POST | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(AuditInterceptor)
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService/custody/verify-chain` | `authenticated / public` | No | apps/api/src/evidence/evidence.controller.ts |
| GET | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(AuditInterceptor)
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService/evidence` | `authenticated / public` | No | apps/api/src/evidence/evidence.controller.ts |
| GET | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(AuditInterceptor)
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService/evidence/:id` | `authenticated / public` | No | apps/api/src/evidence/evidence.controller.ts |
| POST | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(AuditInterceptor)
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService/evidence/:id/legal-hold` | `evidence:export` | No | apps/api/src/evidence/evidence.controller.ts |
| POST | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(AuditInterceptor)
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService/evidence/:id/redactions` | `evidence:export` | No | apps/api/src/evidence/evidence.controller.ts |
| GET | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(AuditInterceptor)
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService/evidence/:id/signed-url` | `authenticated / public` | No | apps/api/src/evidence/evidence.controller.ts |
| POST | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(AuditInterceptor)
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService/evidence/:id/verify` | `authenticated / public` | No | apps/api/src/evidence/evidence.controller.ts |
| GET | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(AuditInterceptor)
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService/evidence/summary/integrity` | `authenticated / public` | No | apps/api/src/evidence/evidence.controller.ts |
| POST | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(AuditInterceptor)
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService/evidence/verify-all` | `evidence:read` | No | apps/api/src/evidence/evidence.controller.ts |
| POST | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(AuditInterceptor)
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService/exports` | `evidence:read` | No | apps/api/src/evidence/evidence.controller.ts |
| POST | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(AuditInterceptor)
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService/exports/verify` | `evidence:export` | No | apps/api/src/evidence/evidence.controller.ts |
| GET | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(RbacDataShapingInterceptor)
@UseInterceptors(AuditInterceptor)
export class SightingsController {
  constructor(private readonly sightingsService: SightingsService/cases/:caseId/hard-negatives` | `authenticated / public` | No | apps/api/src/sightings/sightings.controller.ts |
| GET | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(RbacDataShapingInterceptor)
@UseInterceptors(AuditInterceptor)
export class SightingsController {
  constructor(private readonly sightingsService: SightingsService/cases/:caseId/sightings` | `authenticated / public` | No | apps/api/src/sightings/sightings.controller.ts |
| GET | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(RbacDataShapingInterceptor)
@UseInterceptors(AuditInterceptor)
export class SightingsController {
  constructor(private readonly sightingsService: SightingsService/sightings` | `authenticated / public` | No | apps/api/src/sightings/sightings.controller.ts |
| GET | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(RbacDataShapingInterceptor)
@UseInterceptors(AuditInterceptor)
export class SightingsController {
  constructor(private readonly sightingsService: SightingsService/sightings/:id` | `authenticated / public` | No | apps/api/src/sightings/sightings.controller.ts |
| POST | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(RbacDataShapingInterceptor)
@UseInterceptors(AuditInterceptor)
export class SightingsController {
  constructor(private readonly sightingsService: SightingsService/sightings/:id/decision` | `sightings:decide` | No | apps/api/src/sightings/sightings.controller.ts |
| POST | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(RbacDataShapingInterceptor)
@UseInterceptors(AuditInterceptor)
export class SightingsController {
  constructor(private readonly sightingsService: SightingsService/sightings/:id/promote-to-reference` | `sightings:decide` | No | apps/api/src/sightings/sightings.controller.ts |
| PATCH | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(RbacDataShapingInterceptor)
@UseInterceptors(AuditInterceptor)
export class SightingsController {
  constructor(private readonly sightingsService: SightingsService/sightings/:id/review` | `authenticated / public` | No | apps/api/src/sightings/sightings.controller.ts |
| GET | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(RbacDataShapingInterceptor)
@UseInterceptors(AuditInterceptor)
export class SightingsController {
  constructor(private readonly sightingsService: SightingsService/sightings/hard-negatives` | `authenticated / public` | No | apps/api/src/sightings/sightings.controller.ts |
| GET | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService/counts` | `authenticated / public` | No | apps/api/src/dashboard/dashboard.controller.ts |
| GET | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService/dashboard/action-queue` | `authenticated / public` | No | apps/api/src/dashboard/dashboard.controller.ts |
| GET | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService/dashboard/activity` | `authenticated / public` | No | apps/api/src/dashboard/dashboard.controller.ts |
| GET | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService/dashboard/priority-cases` | `authenticated / public` | No | apps/api/src/dashboard/dashboard.controller.ts |
| GET | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService/dashboard/since` | `dashboard:read` | No | apps/api/src/dashboard/dashboard.controller.ts |
| GET | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService/dashboard/suggestions` | `authenticated / public` | No | apps/api/src/dashboard/dashboard.controller.ts |
| GET | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService/dashboard/summary` | `authenticated / public` | No | apps/api/src/dashboard/dashboard.controller.ts |
| GET | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService/dashboard/team` | `authenticated / public` | No | apps/api/src/dashboard/dashboard.controller.ts |
| GET | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService/dashboard/trends` | `authenticated / public` | No | apps/api/src/dashboard/dashboard.controller.ts |
| GET | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService/users/me/dashboard-layout` | `authenticated / public` | No | apps/api/src/dashboard/dashboard.controller.ts |
| PUT | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService/users/me/dashboard-layout` | `authenticated / public` | No | apps/api/src/dashboard/dashboard.controller.ts |
| GET | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class JourneysController {
  constructor(private readonly journeysService: JourneysService/cases/:caseId/journey` | `journeys:read` | No | apps/api/src/journeys/journeys.controller.ts |
| GET | `/api/v1/)
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class JourneysController {
  constructor(private readonly journeysService: JourneysService/journeys` | `authenticated / public` | No | apps/api/src/journeys/journeys.controller.ts |
| POST | `/api/v1/)
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly kafkaService: KafkaService,
  /internal/evidence` | `authenticated / public` | No | apps/api/src/common/storage/storage.controller.ts |
| GET | `/api/v1/)
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly kafkaService: KafkaService,
  /internal/media/:assetId/original` | `authenticated / public` | No | apps/api/src/common/storage/storage.controller.ts |
| GET | `/api/v1/)
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly kafkaService: KafkaService,
  /media/assets/:id/signed-url` | `authenticated / public` | No | apps/api/src/common/storage/storage.controller.ts |
| GET | `/api/v1/)
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly kafkaService: KafkaService,
  /storage/usage` | `authenticated / public` | No | apps/api/src/common/storage/storage.controller.ts |
| POST | `/api/v1/)
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly kafkaService: KafkaService,
  /webhooks/cloudinary` | `authenticated / public` | No | apps/api/src/common/storage/storage.controller.ts |
| GET | `/api/v1/admin/audit` | `retention:manage` | No | apps/api/src/admin/admin.controller.ts |
| GET | `/api/v1/admin/health` | `audit:read` | No | apps/api/src/admin/admin.controller.ts |
| GET | `/api/v1/admin/integrations` | `admin:system` | No | apps/api/src/admin/admin.controller.ts |
| GET | `/api/v1/admin/mobile/devices` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-admin.controller.ts |
| POST | `/api/v1/admin/mobile/devices/:id/approve` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-admin.controller.ts |
| POST | `/api/v1/admin/mobile/devices/:id/revoke` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-admin.controller.ts |
| POST | `/api/v1/admin/mobile/invites` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-admin.controller.ts |
| GET | `/api/v1/admin/mobile/invites` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-admin.controller.ts |
| POST | `/api/v1/admin/mobile/invites/:id/revoke` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-admin.controller.ts |
| GET | `/api/v1/admin/mobile/sessions/active` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-admin.controller.ts |
| GET | `/api/v1/admin/mobile/users` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-admin.controller.ts |
| POST | `/api/v1/admin/mobile/users/:id/approve` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-admin.controller.ts |
| POST | `/api/v1/admin/mobile/users/:id/reactivate` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-admin.controller.ts |
| POST | `/api/v1/admin/mobile/users/:id/reject` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-admin.controller.ts |
| POST | `/api/v1/admin/mobile/users/:id/suspend` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-admin.controller.ts |
| GET | `/api/v1/admin/models` | `users:read` | No | apps/api/src/admin/admin.controller.ts |
| POST | `/api/v1/admin/models/:id/promote` | `models:manage` | No | apps/api/src/admin/admin.controller.ts |
| POST | `/api/v1/admin/models/:id/shadow` | `models:manage` | No | apps/api/src/admin/admin.controller.ts |
| GET | `/api/v1/admin/queues` | `thresholds:approve` | Yes | apps/api/src/admin/admin.controller.ts |
| GET | `/api/v1/admin/retention` | `integrations:manage` | No | apps/api/src/admin/admin.controller.ts |
| POST | `/api/v1/admin/retention/preview-deletion` | `retention:manage` | No | apps/api/src/admin/admin.controller.ts |
| GET | `/api/v1/admin/roles` | `users:manage` | Yes | apps/api/src/admin/admin.controller.ts |
| GET | `/api/v1/admin/teams` | `roles:read` | No | apps/api/src/admin/admin.controller.ts |
| GET | `/api/v1/admin/thresholds` | `models:manage` | Yes | apps/api/src/admin/admin.controller.ts |
| POST | `/api/v1/admin/thresholds/activate` | `thresholds:propose` | No | apps/api/src/admin/admin.controller.ts |
| POST | `/api/v1/admin/thresholds/preview-impact` | `thresholds:propose` | No | apps/api/src/admin/admin.controller.ts |
| GET | `/api/v1/admin/users` | `authenticated / public` | No | apps/api/src/admin/admin.controller.ts |
| DELETE | `/api/v1/admin/users/:id` | `users:manage` | No | apps/api/src/admin/admin.controller.ts |
| POST | `/api/v1/admin/users/:id/mfa-reset` | `roles:manage` | Yes | apps/api/src/admin/admin.controller.ts |
| POST | `/api/v1/admin/users/:id/revoke-sessions` | `users:manage` | No | apps/api/src/admin/admin.controller.ts |
| POST | `/api/v1/admin/users/:id/role` | `users:manage` | No | apps/api/src/admin/admin.controller.ts |
| POST | `/api/v1/admin/users/:id/suspend` | `users:manage` | No | apps/api/src/admin/admin.controller.ts |
| POST | `/api/v1/admin/users/invite` | `users:read` | No | apps/api/src/admin/admin.controller.ts |
| GET | `/api/v1/alerts` | `authenticated / public` | No | apps/api/src/alerts/alerts.controller.ts |
| POST | `/api/v1/alerts/:id/ack` | `authenticated / public` | No | apps/api/src/alerts/alerts.controller.ts |
| POST | `/api/v1/alerts/:id/assign` | `authenticated / public` | No | apps/api/src/alerts/alerts.controller.ts |
| POST | `/api/v1/alerts/:id/escalate` | `authenticated / public` | No | apps/api/src/alerts/alerts.controller.ts |
| PATCH | `/api/v1/alerts/:id/read` | `authenticated / public` | No | apps/api/src/alerts/alerts.controller.ts |
| POST | `/api/v1/alerts/:id/resolve` | `authenticated / public` | No | apps/api/src/alerts/alerts.controller.ts |
| POST | `/api/v1/alerts/:id/snooze` | `authenticated / public` | No | apps/api/src/alerts/alerts.controller.ts |
| POST | `/api/v1/alerts/bulk-action` | `authenticated / public` | No | apps/api/src/alerts/alerts.controller.ts |
| GET | `/api/v1/alerts/channels` | `authenticated / public` | No | apps/api/src/alerts/alerts.controller.ts |
| POST | `/api/v1/alerts/channels` | `authenticated / public` | No | apps/api/src/alerts/alerts.controller.ts |
| POST | `/api/v1/alerts/channels/:id/test` | `alerts:manage_rules` | No | apps/api/src/alerts/alerts.controller.ts |
| GET | `/api/v1/alerts/oncall` | `authenticated / public` | No | apps/api/src/alerts/alerts.controller.ts |
| POST | `/api/v1/alerts/oncall/override` | `authenticated / public` | No | apps/api/src/alerts/alerts.controller.ts |
| GET | `/api/v1/alerts/rules` | `authenticated / public` | No | apps/api/src/alerts/alerts.controller.ts |
| POST | `/api/v1/alerts/rules` | `authenticated / public` | No | apps/api/src/alerts/alerts.controller.ts |
| POST | `/api/v1/alerts/rules/:id/test` | `alerts:act` | No | apps/api/src/alerts/alerts.controller.ts |
| GET | `/api/v1/alerts/summary` | `authenticated / public` | No | apps/api/src/alerts/alerts.controller.ts |
| GET | `/api/v1/audit` | `authenticated / public` | No | apps/api/src/audit/audit.controller.ts |
| POST | `/api/v1/auth/change-password` | `authenticated / public` | No | apps/api/src/auth/auth.controller.ts |
| POST | `/api/v1/auth/forgot-password` | `authenticated / public` | No | apps/api/src/auth/auth.controller.ts |
| GET | `/api/v1/auth/github` | `authenticated / public` | No | apps/api/src/auth/auth.controller.ts |
| GET | `/api/v1/auth/github/callback` | `authenticated / public` | No | apps/api/src/auth/auth.controller.ts |
| GET | `/api/v1/auth/google` | `authenticated / public` | No | apps/api/src/auth/auth.controller.ts |
| GET | `/api/v1/auth/google/callback` | `authenticated / public` | No | apps/api/src/auth/auth.controller.ts |
| GET | `/api/v1/auth/identities` | `authenticated / public` | No | apps/api/src/auth/auth.controller.ts |
| DELETE | `/api/v1/auth/identities/:provider` | `authenticated / public` | No | apps/api/src/auth/auth.controller.ts |
| POST | `/api/v1/auth/invites` | `users:manage` | No | apps/api/src/auth/auth.controller.ts |
| POST | `/api/v1/auth/login` | `authenticated / public` | No | apps/api/src/auth/auth.controller.ts |
| POST | `/api/v1/auth/logout` | `authenticated / public` | No | apps/api/src/auth/auth.controller.ts |
| POST | `/api/v1/auth/logout-all` | `authenticated / public` | No | apps/api/src/auth/auth.controller.ts |
| GET | `/api/v1/auth/me` | `authenticated / public` | No | apps/api/src/auth/auth.controller.ts |
| PATCH | `/api/v1/auth/me` | `authenticated / public` | No | apps/api/src/auth/auth.controller.ts |
| GET | `/api/v1/auth/me/permissions` | `authenticated / public` | No | apps/api/src/auth/auth.controller.ts |
| POST | `/api/v1/auth/mfa/disable` | `authenticated / public` | No | apps/api/src/auth/auth.controller.ts |
| POST | `/api/v1/auth/mfa/enable` | `authenticated / public` | No | apps/api/src/auth/auth.controller.ts |
| POST | `/api/v1/auth/mfa/setup` | `authenticated / public` | No | apps/api/src/auth/auth.controller.ts |
| GET | `/api/v1/auth/providers` | `authenticated / public` | No | apps/api/src/auth/auth.controller.ts |
| POST | `/api/v1/auth/refresh` | `authenticated / public` | No | apps/api/src/auth/auth.controller.ts |
| POST | `/api/v1/auth/register` | `authenticated / public` | No | apps/api/src/auth/auth.controller.ts |
| POST | `/api/v1/auth/resend-verification` | `authenticated / public` | No | apps/api/src/auth/auth.controller.ts |
| POST | `/api/v1/auth/reset-password` | `authenticated / public` | No | apps/api/src/auth/auth.controller.ts |
| GET | `/api/v1/auth/sessions` | `authenticated / public` | No | apps/api/src/auth/auth.controller.ts |
| DELETE | `/api/v1/auth/sessions/:id` | `authenticated / public` | No | apps/api/src/auth/auth.controller.ts |
| POST | `/api/v1/auth/step-up` | `authenticated / public` | No | apps/api/src/auth/auth.controller.ts |
| POST | `/api/v1/auth/users/:id/approve` | `authenticated / public` | No | apps/api/src/auth/auth.controller.ts |
| POST | `/api/v1/auth/users/:id/force-logout` | `users:manage` | No | apps/api/src/auth/auth.controller.ts |
| POST | `/api/v1/auth/users/:id/reactivate` | `users:manage` | No | apps/api/src/auth/auth.controller.ts |
| POST | `/api/v1/auth/users/:id/reject` | `users:approve` | No | apps/api/src/auth/auth.controller.ts |
| POST | `/api/v1/auth/users/:id/reset-mfa` | `users:manage` | No | apps/api/src/auth/auth.controller.ts |
| POST | `/api/v1/auth/users/:id/suspend` | `users:manage` | No | apps/api/src/auth/auth.controller.ts |
| POST | `/api/v1/auth/verify-email` | `authenticated / public` | No | apps/api/src/auth/auth.controller.ts |
| POST | `/api/v1/cameras` | `authenticated / public` | No | apps/api/src/cameras/cameras.controller.ts |
| GET | `/api/v1/cameras` | `cameras:manage` | No | apps/api/src/cameras/cameras.controller.ts |
| GET | `/api/v1/cameras/:id` | `authenticated / public` | No | apps/api/src/cameras/cameras.controller.ts |
| PATCH | `/api/v1/cameras/:id` | `authenticated / public` | No | apps/api/src/cameras/cameras.controller.ts |
| POST | `/api/v1/cameras/:id/clips/export` | `authenticated / public` | No | apps/api/src/cameras/cameras.controller.ts |
| POST | `/api/v1/cameras/:id/clock-sync` | `authenticated / public` | No | apps/api/src/cameras/cameras.controller.ts |
| POST | `/api/v1/cameras/:id/disable` | `cameras:manage` | No | apps/api/src/cameras/cameras.controller.ts |
| POST | `/api/v1/cameras/:id/enable` | `cameras:manage` | No | apps/api/src/cameras/cameras.controller.ts |
| POST | `/api/v1/cameras/:id/event-clip` | `authenticated / public` | No | apps/api/src/cameras/cameras.controller.ts |
| GET | `/api/v1/cameras/:id/gaps` | `authenticated / public` | No | apps/api/src/cameras/cameras.controller.ts |
| GET | `/api/v1/cameras/:id/health` | `authenticated / public` | No | apps/api/src/cameras/cameras.controller.ts |
| POST | `/api/v1/cameras/:id/mobile-telemetry` | `cameras:manage` | No | apps/api/src/cameras/cameras.controller.ts |
| GET | `/api/v1/cameras/:id/playback-token` | `authenticated / public` | No | apps/api/src/cameras/cameras.controller.ts |
| GET | `/api/v1/cameras/:id/playback/playlist.m3u8` | `authenticated / public` | No | apps/api/src/cameras/cameras.controller.ts |
| POST | `/api/v1/cameras/:id/sample-fps` | `authenticated / public` | No | apps/api/src/cameras/cameras.controller.ts |
| GET | `/api/v1/cameras/:id/sampler-metrics` | `authenticated / public` | No | apps/api/src/cameras/cameras.controller.ts |
| POST | `/api/v1/cameras/:id/segments` | `authenticated / public` | No | apps/api/src/cameras/cameras.controller.ts |
| GET | `/api/v1/cameras/:id/snapshot` | `authenticated / public` | No | apps/api/src/cameras/cameras.controller.ts |
| GET | `/api/v1/cameras/:id/timeline` | `authenticated / public` | No | apps/api/src/cameras/cameras.controller.ts |
| POST | `/api/v1/cameras/bandwidth/estimate` | `authenticated / public` | No | apps/api/src/cameras/cameras.controller.ts |
| GET | `/api/v1/cameras/bandwidth/report` | `cameras:manage` | No | apps/api/src/cameras/cameras.controller.ts |
| POST | `/api/v1/cameras/bulk-import` | `cameras:manage` | No | apps/api/src/cameras/cameras.controller.ts |
| POST | `/api/v1/cameras/discover/onvif` | `topology:edit` | No | apps/api/src/cameras/cameras.controller.ts |
| GET | `/api/v1/cameras/geojson` | `authenticated / public` | No | apps/api/src/cameras/cameras.controller.ts |
| POST | `/api/v1/cameras/health` | `authenticated / public` | No | apps/api/src/cameras/cameras.controller.ts |
| GET | `/api/v1/cameras/nearby` | `authenticated / public` | No | apps/api/src/cameras/cameras.controller.ts |
| GET | `/api/v1/cameras/next-search` | `authenticated / public` | No | apps/api/src/cameras/cameras.controller.ts |
| POST | `/api/v1/cameras/retention/purge` | `authenticated / public` | No | apps/api/src/cameras/cameras.controller.ts |
| GET | `/api/v1/cameras/storage/report` | `retention:manage` | No | apps/api/src/cameras/cameras.controller.ts |
| POST | `/api/v1/cameras/test-connection` | `authenticated / public` | No | apps/api/src/cameras/cameras.controller.ts |
| GET | `/api/v1/cameras/topology` | `authenticated / public` | No | apps/api/src/cameras/cameras.controller.ts |
| PUT | `/api/v1/cameras/topology/:from/:to` | `authenticated / public` | No | apps/api/src/cameras/cameras.controller.ts |
| PATCH | `/api/v1/cameras/topology/transitions/:id` | `topology:edit` | No | apps/api/src/cameras/cameras.controller.ts |
| GET | `/api/v1/cameras/tracks/nearby` | `authenticated / public` | No | apps/api/src/cameras/cameras.controller.ts |
| POST | `/api/v1/cameras/tracks/telemetry` | `authenticated / public` | No | apps/api/src/cameras/cameras.controller.ts |
| GET | `/api/v1/cases` | `authenticated / public` | No | apps/api/src/cases/cases.controller.ts |
| POST | `/api/v1/cases` | `authenticated / public` | No | apps/api/src/cases/cases.controller.ts |
| GET | `/api/v1/cases/:id` | `authenticated / public` | No | apps/api/src/cases/cases.controller.ts |
| POST | `/api/v1/cases/:id/close` | `cases:update` | No | apps/api/src/cases/cases.controller.ts |
| GET | `/api/v1/cases/:id/journey/geojson` | `authenticated / public` | No | apps/api/src/cases/cases.controller.ts |
| GET | `/api/v1/cases/:id/journeys` | `authenticated / public` | No | apps/api/src/cases/cases.controller.ts |
| GET | `/api/v1/cases/:id/journeys/:journeyId` | `authenticated / public` | No | apps/api/src/cases/cases.controller.ts |
| GET | `/api/v1/cases/:id/overview` | `authenticated / public` | No | apps/api/src/cases/cases.controller.ts |
| GET | `/api/v1/cases/:id/possible-area` | `authenticated / public` | No | apps/api/src/cases/cases.controller.ts |
| GET | `/api/v1/cases/:id/references/history` | `authenticated / public` | No | apps/api/src/cases/cases.controller.ts |
| PATCH | `/api/v1/cases/:id/status` | `cases:create` | No | apps/api/src/cases/cases.controller.ts |
| GET | `/api/v1/health` | `authenticated / public` | No | apps/api/src/health/health.controller.ts |
| POST | `/api/v1/media/auth` | `authenticated / public` | No | apps/api/src/media/media.controller.ts |
| POST | `/api/v1/media/hook/stream-status` | `authenticated / public` | No | apps/api/src/media/media.controller.ts |
| GET | `/api/v1/media/ice-servers` | `authenticated / public` | No | apps/api/src/media/media.controller.ts |
| POST | `/api/v1/missing-persons` | `authenticated / public` | No | apps/api/src/missing-persons/missing-persons.controller.ts |
| GET | `/api/v1/missing-persons` | `cases:update` | No | apps/api/src/missing-persons/missing-persons.controller.ts |
| GET | `/api/v1/missing-persons/:id` | `authenticated / public` | No | apps/api/src/missing-persons/missing-persons.controller.ts |
| PATCH | `/api/v1/missing-persons/:id` | `authenticated / public` | No | apps/api/src/missing-persons/missing-persons.controller.ts |
| GET | `/api/v1/missing-persons/:id/history` | `authenticated / public` | No | apps/api/src/missing-persons/missing-persons.controller.ts |
| POST | `/api/v1/missing-persons/:id/last-seen` | `cases:update` | No | apps/api/src/missing-persons/missing-persons.controller.ts |
| GET | `/api/v1/missing-persons/:id/readiness` | `authenticated / public` | No | apps/api/src/missing-persons/missing-persons.controller.ts |
| POST | `/api/v1/missing-persons/:id/status` | `cases:update` | No | apps/api/src/missing-persons/missing-persons.controller.ts |
| POST | `/api/v1/missing-persons/:id/submit` | `cases:update` | No | apps/api/src/missing-persons/missing-persons.controller.ts |
| GET | `/api/v1/missing-persons/duplicates` | `authenticated / public` | No | apps/api/src/missing-persons/missing-persons.controller.ts |
| GET | `/api/v1/missing-persons/search` | `authenticated / public` | No | apps/api/src/missing-persons/missing-persons.controller.ts |
| POST | `/api/v1/missing-persons/search-by-photo` | `authenticated / public` | No | apps/api/src/missing-persons/missing-persons.controller.ts |
| POST | `/api/v1/mobile/auth/forgot-password` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-auth.controller.ts |
| POST | `/api/v1/mobile/auth/login` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-auth.controller.ts |
| POST | `/api/v1/mobile/auth/logout` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-auth.controller.ts |
| POST | `/api/v1/mobile/auth/refresh` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-auth.controller.ts |
| POST | `/api/v1/mobile/auth/register` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-auth.controller.ts |
| POST | `/api/v1/mobile/auth/resend-otp` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-auth.controller.ts |
| POST | `/api/v1/mobile/auth/reset-password` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-auth.controller.ts |
| POST | `/api/v1/mobile/auth/verify` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-auth.controller.ts |
| POST | `/api/v1/mobile/devices` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-devices.controller.ts |
| GET | `/api/v1/mobile/devices` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-devices.controller.ts |
| PATCH | `/api/v1/mobile/devices/:id` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-devices.controller.ts |
| DELETE | `/api/v1/mobile/devices/:id` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-devices.controller.ts |
| POST | `/api/v1/mobile/devices/:id/sessions` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-devices.controller.ts |
| GET | `/api/v1/mobile/me` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-devices.controller.ts |
| POST | `/api/v1/mobile/sessions/:id/heartbeat` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-devices.controller.ts |
| POST | `/api/v1/mobile/sessions/:id/stop` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-devices.controller.ts |
| POST | `/api/v1/mobile/sessions/:id/token-refresh` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-devices.controller.ts |
| GET | `/api/v1/mobile/time` | `authenticated / public` | No | apps/api/src/mobile/controllers/mobile-devices.controller.ts |
| POST | `/api/v1/references` | `references:manage` | No | apps/api/src/references/references.controller.ts |
| PATCH | `/api/v1/references/:id` | `references:manage` | No | apps/api/src/references/references.controller.ts |
| DELETE | `/api/v1/references/:id` | `references:manage` | No | apps/api/src/references/references.controller.ts |
| POST | `/api/v1/references/:id/replace` | `references:manage` | No | apps/api/src/references/references.controller.ts |
| POST | `/api/v1/references/:id/reprocess` | `references:manage` | No | apps/api/src/references/references.controller.ts |
| POST | `/api/v1/references/../cases/:caseId/references/upload` | `references:manage` | No | apps/api/src/references/references.controller.ts |
| POST | `/api/v1/references/presign` | `authenticated / public` | No | apps/api/src/references/references.controller.ts |
| GET | `/api/v1/reports` | `authenticated / public` | No | apps/api/src/reports/reports.controller.ts |
| POST | `/api/v1/reports` | `authenticated / public` | No | apps/api/src/reports/reports.controller.ts |
| POST | `/api/v1/reports/:id/approve` | `reports:generate` | No | apps/api/src/reports/reports.controller.ts |
| GET | `/api/v1/reports/:id/download` | `reports:generate` | No | apps/api/src/reports/reports.controller.ts |
| POST | `/api/v1/reports/:id/share` | `reports:approve` | No | apps/api/src/reports/reports.controller.ts |
| GET | `/api/v1/reports/schedules` | `reports:generate` | No | apps/api/src/reports/reports.controller.ts |
| POST | `/api/v1/reports/schedules` | `reports:read` | No | apps/api/src/reports/reports.controller.ts |
| GET | `/api/v1/reports/templates` | `authenticated / public` | No | apps/api/src/reports/reports.controller.ts |
| GET | `/api/v1/users` | `authenticated / public` | No | apps/api/src/users/users.controller.ts |
| POST | `/api/v1/users/:id/avatar` | `users:read` | No | apps/api/src/users/users.controller.ts |
| GET | `/api/v1/users/me` | `authenticated / public` | No | apps/api/src/users/users.controller.ts |
| POST | `/api/v1/verification/:id/lock` | `sightings:decide` | No | apps/api/src/verification/verification.controller.ts |
| POST | `/api/v1/verification/:id/review` | `sightings:decide` | No | apps/api/src/verification/verification.controller.ts |
| POST | `/api/v1/verification/:id/unlock` | `sightings:decide` | No | apps/api/src/verification/verification.controller.ts |
| GET | `/api/v1/verification/labels` | `sightings:decide` | No | apps/api/src/verification/verification.controller.ts |
| GET | `/api/v1/verification/queue` | `authenticated / public` | No | apps/api/src/verification/verification.controller.ts |
