import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { AdminBootstrapService } from './admin-bootstrap.service';
import type {
  AdminUserRecord,
  RbacPermissionMatrix,
  InvestigationTeam,
  RegisteredAiModel,
  ThresholdProfile,
  ImpactPreviewResult,
  QueueLagTelemetry,
  RetentionPolicy,
  AdminAuditEntry,
  ServiceHealthStatus,
} from '@sentinel/shared-types';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  // In-memory data store for administrative registries
  private users: AdminUserRecord[] = [
    {
      id: 'u-admin',
      badgeNumber: 'BDG-001',
      fullName: 'Sarah Connor',
      email: 'admin@sentinel.gov',
      department: 'Special Operations Command',
      teamId: 'team_01',
      teamName: 'Alpha Tactical Unit',
      role: 'Super Admin',
      status: 'active',
      mfaEnabled: true,
      mfaMethod: 'totp',
      lastLoginAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      activeSessionsCount: 2,
      createdAt: new Date('2026-01-01').toISOString(),
    },
    {
      id: 'u-lead',
      badgeNumber: 'BDG-042',
      fullName: 'David Mills',
      email: 'dmills@sentinel.gov',
      department: 'Homicide & Missing Persons',
      teamId: 'team_01',
      teamName: 'Alpha Tactical Unit',
      role: 'Investigator',
      status: 'active',
      mfaEnabled: true,
      mfaMethod: 'sms',
      lastLoginAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      activeSessionsCount: 1,
      createdAt: new Date('2026-01-15').toISOString(),
    },
    {
      id: 'u-rev1',
      badgeNumber: 'BDG-108',
      fullName: 'Alex Murphy',
      email: 'amurphy@sentinel.gov',
      department: 'Central Video Analytics',
      teamId: 'team_02',
      teamName: 'Surveillance Triage',
      role: 'Reviewer',
      status: 'active',
      mfaEnabled: false,
      lastLoginAt: new Date(Date.now() - 3600000 * 26).toISOString(),
      activeSessionsCount: 1,
      createdAt: new Date('2026-02-01').toISOString(),
    },
  ];

  private teams: InvestigationTeam[] = [
    {
      id: 'team_01',
      name: 'Alpha Tactical Unit',
      department: 'Rapid Incident Response',
      leadOfficerId: 'u-admin',
      leadOfficerName: 'Sarah Connor',
      memberCount: 8,
      assignedSiteIds: ['metro-central', 'north-hub'],
      activeCaseCount: 2,
    },
    {
      id: 'team_02',
      name: 'Surveillance Triage',
      department: 'Video Analytics Command',
      leadOfficerId: 'u-lead',
      leadOfficerName: 'David Mills',
      memberCount: 14,
      assignedSiteIds: ['metro-central', 'east-station', 'south-terminal'],
      activeCaseCount: 3,
    },
  ];

  private models: RegisteredAiModel[] = [
    {
      id: 'mod_face_01',
      modelType: 'face_recognizer',
      modelName: 'AdaFace-IR50',
      version: 'v2.4.0',
      status: 'active',
      embeddingDimensions: 512,
      benchmarkMetrics: {
        rank1Accuracy: 98.4,
        mAP: 96.2,
        falseMatchRateAtOperatingPoint: 0.001,
        latencyMs: 14,
      },
      activatedAt: new Date('2026-03-01').toISOString(),
      activatedBy: 'admin@sentinel.gov',
    },
    {
      id: 'mod_reid_01',
      modelType: 'person_reid',
      modelName: 'OSNet-AIN-x1.0',
      version: 'v1.8.2',
      status: 'active',
      embeddingDimensions: 512,
      benchmarkMetrics: {
        rank1Accuracy: 94.6,
        mAP: 91.8,
        falseMatchRateAtOperatingPoint: 0.005,
        latencyMs: 18,
      },
      activatedAt: new Date('2026-03-01').toISOString(),
      activatedBy: 'admin@sentinel.gov',
    },
    {
      id: 'mod_reid_shadow',
      modelType: 'person_reid',
      modelName: 'TransReID-ViT-B',
      version: 'v0.9-candidate',
      status: 'shadow',
      embeddingDimensions: 768,
      benchmarkMetrics: {
        rank1Accuracy: 96.1,
        mAP: 93.4,
        falseMatchRateAtOperatingPoint: 0.003,
        latencyMs: 32,
      },
      shadowDisagreementRatePct: 4.2,
    },
    {
      id: 'mod_det_01',
      modelType: 'face_detector',
      modelName: 'YOLOv8x-Face',
      version: 'v8.1.0',
      status: 'active',
      embeddingDimensions: 0,
      benchmarkMetrics: {
        rank1Accuracy: 99.1,
        mAP: 97.8,
        falseMatchRateAtOperatingPoint: 0.0005,
        latencyMs: 8,
      },
      activatedAt: new Date('2026-02-15').toISOString(),
      activatedBy: 'admin@sentinel.gov',
    },
  ];

  private thresholds: ThresholdProfile[] = [
    {
      id: 'thresh_default',
      name: 'Default Production Profile',
      scope: 'default',
      faceCosineThresholdHigh: 0.75,
      faceCosineThresholdMedium: 0.55,
      reidCosineThresholdHigh: 0.72,
      reidCosineThresholdMedium: 0.50,
      fusedScoreHighBand: 0.85,
      fusedScoreMediumBand: 0.65,
      minQualityFloor: 0.40,
      isActive: true,
      version: 3,
      updatedAt: new Date(Date.now() - 3600000 * 24 * 7).toISOString(),
    },
    {
      id: 'thresh_low_light',
      name: 'Low-Light & Platform Profile',
      scope: 'camera_group',
      faceCosineThresholdHigh: 0.70,
      faceCosineThresholdMedium: 0.48,
      reidCosineThresholdHigh: 0.68,
      reidCosineThresholdMedium: 0.45,
      fusedScoreHighBand: 0.80,
      fusedScoreMediumBand: 0.60,
      minQualityFloor: 0.30,
      isActive: false,
      version: 1,
      updatedAt: new Date(Date.now() - 3600000 * 24 * 14).toISOString(),
    },
  ];

  private retentionPolicies: RetentionPolicy[] = [
    { dataClass: 'live_footage', retentionDays: 7, autoPurgeEnabled: true, requiresSupervisorApproval: false, excludedLegalHoldsCount: 12 },
    { dataClass: 'recorded_segments', retentionDays: 30, autoPurgeEnabled: true, requiresSupervisorApproval: true, excludedLegalHoldsCount: 28 },
    { dataClass: 'crops', retentionDays: 90, autoPurgeEnabled: true, requiresSupervisorApproval: false, excludedLegalHoldsCount: 45 },
    { dataClass: 'evidence', retentionDays: 365 * 3, autoPurgeEnabled: false, requiresSupervisorApproval: true, excludedLegalHoldsCount: 84 },
    { dataClass: 'reports', retentionDays: 365 * 7, autoPurgeEnabled: false, requiresSupervisorApproval: true, excludedLegalHoldsCount: 19 },
  ];

  private auditLogs: AdminAuditEntry[] = [
    {
      id: 'aud_01',
      actorEmail: 'admin@sentinel.gov',
      actorRole: 'Super Admin',
      action: 'UPDATE_THRESHOLD_PROFILE',
      targetEntity: 'ThresholdProfile',
      targetId: 'thresh_default',
      ipAddress: '10.0.4.12',
      timestamp: new Date(Date.now() - 3600000 * 18).toISOString(),
      changeReason: 'Optimized fused confidence bands following Q3 calibration report',
      isAnomaly: false,
    },
    {
      id: 'aud_02',
      actorEmail: 'dmills@sentinel.gov',
      actorRole: 'Investigator',
      action: 'EXPORT_EVIDENCE_PACKAGE',
      targetEntity: 'Evidence',
      targetId: 'pkg_19284',
      caseId: 'case_001',
      ipAddress: '10.0.4.55',
      timestamp: new Date(Date.now() - 3600000 * 6).toISOString(),
      changeReason: 'Formal law enforcement package compilation for MP-2026-0042',
      isAnomaly: false,
    },
    {
      id: 'aud_03',
      actorEmail: 'unknown_scanner@external',
      actorRole: 'Anonymous',
      action: 'MULTIPLE_FAILED_LOGINS',
      targetEntity: 'User',
      targetId: 'admin@sentinel.gov',
      ipAddress: '194.26.29.11',
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
      changeReason: 'Rate limit tripped after 5 consecutive failed attempts',
      isAnomaly: true,
    },
  ];

  constructor(
    @Optional()
    private readonly adminBootstrapService?: AdminBootstrapService,
  ) {}

  // USERS
  getUsers(): AdminUserRecord[] {
    return this.users;
  }

  inviteUser(dto: { email: string; role: any; department: string; changeReason: string }): AdminUserRecord {
    const newUser: AdminUserRecord = {
      id: `u-${Date.now()}`,
      badgeNumber: `BDG-${Math.floor(100 + Math.random() * 900)}`,
      fullName: dto.email.split('@')[0].replace('.', ' '),
      email: dto.email,
      department: dto.department || 'Operations',
      role: dto.role || 'Reviewer',
      status: 'invited',
      mfaEnabled: false,
      activeSessionsCount: 0,
      createdAt: new Date().toISOString(),
    };
    this.users.push(newUser);
    this.logAudit('INVITE_USER', 'User', newUser.id, dto.changeReason);
    return newUser;
  }

  async updateUserRole(
    userId: string,
    newRole: 'Super Admin' | 'Investigator' | 'Reviewer' | 'Viewer',
    changeReason: string,
    secondAdminApprovalEmail?: string,
  ): Promise<AdminUserRecord> {
    const user = this.users.find((u) => u.id === userId);
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    if (user.role === 'Super Admin' && newRole !== 'Super Admin') {
      if (this.adminBootstrapService) {
        await this.adminBootstrapService.assertNotLastActiveSuperAdmin(userId, 'demote');
      }
    }

    if (newRole === 'Super Admin' && !secondAdminApprovalEmail) {
      throw new BadRequestException('Granting Super Admin role strictly requires confirmation and a second administrator approval.');
    }

    const previousRole = user.role;
    user.role = newRole;

    this.logAudit(
      'UPDATE_USER_ROLE',
      'User',
      userId,
      `${changeReason} (Role changed from ${previousRole} to ${newRole}${secondAdminApprovalEmail ? ` approved by ${secondAdminApprovalEmail}` : ''})`,
    );

    return user;
  }

  async suspendUser(userId: string, changeReason: string): Promise<AdminUserRecord> {
    const user = this.users.find((u) => u.id === userId);
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    if (user.role === 'Super Admin') {
      if (this.adminBootstrapService) {
        await this.adminBootstrapService.assertNotLastActiveSuperAdmin(userId, 'suspend');
      }
    }

    user.status = 'suspended';
    this.logAudit('SUSPEND_USER', 'User', userId, changeReason);
    return user;
  }

  async deleteUser(userId: string): Promise<{ success: boolean }> {
    const user = this.users.find((u) => u.id === userId);
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    if (user.role === 'Super Admin') {
      if (this.adminBootstrapService) {
        await this.adminBootstrapService.assertNotLastActiveSuperAdmin(userId, 'delete');
      }
    }

    this.users = this.users.filter((u) => u.id !== userId);
    this.logAudit('DELETE_USER', 'User', userId, 'Administrative user deletion');
    return { success: true };
  }

  resetMfa(userId: string, changeReason: string): { success: boolean; message: string } {
    const user = this.users.find((u) => u.id === userId);
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    user.mfaEnabled = false;
    user.mfaMethod = undefined;
    this.logAudit('RESET_USER_MFA', 'User', userId, changeReason);
    return { success: true, message: `MFA credentials for ${user.email} reset. User prompted to re-enroll on next login.` };
  }

  revokeSessions(userId: string, changeReason: string): { success: boolean; count: number } {
    const user = this.users.find((u) => u.id === userId);
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const count = user.activeSessionsCount;
    user.activeSessionsCount = 0;
    this.logAudit('REVOKE_USER_SESSIONS', 'User', userId, changeReason);
    return { success: true, count };
  }

  // ROLES
  getRoles(): RbacPermissionMatrix[] {
    return [
      {
        role: 'Super Admin',
        permissions: [
          { resource: 'cases', actions: { view: true, create: true, update: true, decide: true, export: true, purge: true } },
          { resource: 'sightings', actions: { view: true, create: true, update: true, decide: true, export: true, purge: true } },
          { resource: 'evidence', actions: { view: true, create: true, update: true, decide: true, export: true, purge: true } },
          { resource: 'reports', actions: { view: true, create: true, update: true, decide: true, export: true, purge: true } },
          { resource: 'cameras', actions: { view: true, create: true, update: true, decide: true, export: true, purge: true } },
          { resource: 'users', actions: { view: true, create: true, update: true, decide: true, export: true, purge: true } },
          { resource: 'settings', actions: { view: true, create: true, update: true, decide: true, export: true, purge: true } },
          { resource: 'pii', actions: { view: true, create: true, update: true, decide: true, export: true, purge: true } },
        ],
      },
      {
        role: 'Investigator',
        permissions: [
          { resource: 'cases', actions: { view: true, create: true, update: true, decide: true, export: true, purge: false } },
          { resource: 'sightings', actions: { view: true, create: true, update: true, decide: true, export: true, purge: false } },
          { resource: 'evidence', actions: { view: true, create: true, update: true, decide: true, export: true, purge: false } },
          { resource: 'reports', actions: { view: true, create: true, update: true, decide: true, export: true, purge: false } },
          { resource: 'cameras', actions: { view: true, create: false, update: false, decide: false, export: true, purge: false } },
          { resource: 'users', actions: { view: true, create: false, update: false, decide: false, export: false, purge: false } },
          { resource: 'settings', actions: { view: true, create: false, update: false, decide: false, export: false, purge: false } },
          { resource: 'pii', actions: { view: true, create: false, update: false, decide: false, export: true, purge: false } },
        ],
      },
      {
        role: 'Reviewer',
        permissions: [
          { resource: 'cases', actions: { view: true, create: false, update: false, decide: true, export: false, purge: false } },
          { resource: 'sightings', actions: { view: true, create: false, update: true, decide: true, export: false, purge: false } },
          { resource: 'evidence', actions: { view: true, create: false, update: false, decide: false, export: false, purge: false } },
          { resource: 'reports', actions: { view: true, create: false, update: false, decide: false, export: false, purge: false } },
          { resource: 'cameras', actions: { view: true, create: false, update: false, decide: false, export: false, purge: false } },
          { resource: 'users', actions: { view: false, create: false, update: false, decide: false, export: false, purge: false } },
          { resource: 'settings', actions: { view: false, create: false, update: false, decide: false, export: false, purge: false } },
          { resource: 'pii', actions: { view: false, create: false, update: false, decide: false, export: false, purge: false } },
        ],
      },
    ];
  }

  // TEAMS
  getTeams(): InvestigationTeam[] {
    return this.teams;
  }

  // MODELS
  getModels(): RegisteredAiModel[] {
    return this.models;
  }

  setShadowModel(modelId: string, changeReason: string): RegisteredAiModel {
    const model = this.models.find((m) => m.id === modelId);
    if (!model) throw new NotFoundException(`Model ${modelId} not found`);

    model.status = 'shadow';
    this.logAudit('SET_SHADOW_MODEL', 'AiModel', modelId, changeReason);
    return model;
  }

  promoteModel(modelId: string, changeReason: string): RegisteredAiModel {
    const target = this.models.find((m) => m.id === modelId);
    if (!target) throw new NotFoundException(`Model ${modelId} not found`);

    // Demote current active model of same type to candidate or retired
    this.models
      .filter((m) => m.modelType === target.modelType && m.id !== target.id && m.status === 'active')
      .forEach((m) => (m.status = 'candidate'));

    target.status = 'active';
    target.activatedAt = new Date().toISOString();
    target.activatedBy = 'admin@sentinel.gov';

    this.logAudit('PROMOTE_AI_MODEL', 'AiModel', modelId, changeReason);
    return target;
  }

  // THRESHOLDS
  getThresholds(): ThresholdProfile[] {
    return this.thresholds;
  }

  previewThresholdImpact(profileId: string): ImpactPreviewResult {
    return {
      profileId,
      evaluatedSightingsCount: 154,
      decisionsFlippedCount: 6,
      expectedExtraReviewsPerDay: 4.2,
      projectedFMR: 0.0014,
      projectedFNMR: 0.021,
    };
  }

  activateThreshold(profileId: string, changeReason: string, secondAdminApproval?: string): ThresholdProfile {
    const target = this.thresholds.find((t) => t.id === profileId);
    if (!target) throw new NotFoundException(`Profile ${profileId} not found`);

    this.thresholds.forEach((t) => (t.isActive = t.id === profileId));
    target.isActive = true;
    target.version += 1;
    target.updatedAt = new Date().toISOString();

    this.logAudit(
      'ACTIVATE_THRESHOLD_PROFILE',
      'ThresholdProfile',
      profileId,
      `${changeReason} (Approved by ${secondAdminApproval || 'Supervisor'})`,
    );

    return target;
  }

  // QUEUES
  getQueues(): QueueLagTelemetry[] {
    return [
      { queueName: 'sightings.scored', waitingCount: 4, activeCount: 8, failedCount: 0, delayedCount: 0, dlqCount: 0, consumerLag: 12, throughputPerSecond: 44.5 },
      { queueName: 'search.jobs.progress', waitingCount: 1, activeCount: 3, failedCount: 0, delayedCount: 0, dlqCount: 0, consumerLag: 3, throughputPerSecond: 18.2 },
      { queueName: 'reports.generate', waitingCount: 0, activeCount: 1, failedCount: 0, delayedCount: 0, dlqCount: 0, consumerLag: 0, throughputPerSecond: 2.1 },
      { queueName: 'notifications.dispatch', waitingCount: 0, activeCount: 2, failedCount: 0, delayedCount: 0, dlqCount: 0, consumerLag: 1, throughputPerSecond: 14.8 },
    ];
  }

  // INTEGRATIONS
  getIntegrations(): Record<string, any> {
    return {
      pinecone: {
        status: 'connected',
        indexName: 'sentinel-prod-face-512',
        dimension: 512,
        metric: 'cosine',
        namespaces: ['cases_active', 'references_v2', 'cctv_crops'],
        latencyMs: 18,
      },
      kafka: {
        status: 'connected',
        brokers: ['localhost:9092'],
        topicsCount: 12,
        throughputMbps: 8.4,
      },
      mediamtx: {
        status: 'connected',
        rtspEndpoint: 'rtsp://localhost:8554',
        hlsEndpoint: 'http://localhost:8888',
        activeStreams: 24,
      },
      redis: {
        status: 'connected',
        clusterMode: false,
        memoryUsedMb: 64.2,
      },
      mongodb: {
        status: 'connected',
        database: 'sentinel_vision_ai',
        collections: 14,
      },
    };
  }

  // RETENTION
  getRetention(): RetentionPolicy[] {
    return this.retentionPolicies;
  }

  previewRetentionDeletion(dataClass: string, newDays: number): { itemsPurged: number; storageFreedGb: number } {
    return {
      itemsPurged: 1420,
      storageFreedGb: 18.4,
    };
  }

  // AUDIT LOG
  getAuditLog(query?: { actor?: string; action?: string; search?: string }): AdminAuditEntry[] {
    let result = [...this.auditLogs];
    if (query?.actor) result = result.filter((a) => a.actorEmail.includes(query.actor!));
    if (query?.action) result = result.filter((a) => a.action === query.action);
    if (query?.search) {
      result = result.filter(
        (a) =>
          a.targetEntity.toLowerCase().includes(query.search!.toLowerCase()) ||
          a.changeReason?.toLowerCase().includes(query.search!.toLowerCase()),
      );
    }
    return result;
  }

  logAudit(action: string, targetEntity: string, targetId: string, changeReason: string): void {
    const entry: AdminAuditEntry = {
      id: `aud_${Date.now()}`,
      actorEmail: 'admin@sentinel.gov',
      actorRole: 'Super Admin',
      action,
      targetEntity,
      targetId,
      ipAddress: '127.0.0.1',
      timestamp: new Date().toISOString(),
      changeReason,
      isAnomaly: false,
    };
    this.auditLogs.unshift(entry);
  }

  // SYSTEM HEALTH
  getSystemHealth(): ServiceHealthStatus[] {
    return [
      { serviceName: 'NestJS Gateway API', status: 'healthy', port: 3001, latencyMs: 4, uptimeSeconds: 84200, errorRatePct: 0.01, p95LatencyMs: 24 },
      { serviceName: 'FastAPI AI Inference', status: 'healthy', port: 8000, latencyMs: 22, uptimeSeconds: 84200, gpuUtilizationPct: 48, errorRatePct: 0.04, p95LatencyMs: 65 },
      { serviceName: 'MongoDB Database', status: 'healthy', port: 27017, latencyMs: 1, uptimeSeconds: 120400, storageUsageGb: 32.4, storageLimitGb: 200, errorRatePct: 0, p95LatencyMs: 6 },
      { serviceName: 'Redis PubSub & Cache', status: 'healthy', port: 6379, latencyMs: 1, uptimeSeconds: 120400, errorRatePct: 0, p95LatencyMs: 3 },
      { serviceName: 'Kafka Event Streaming', status: 'healthy', port: 9092, latencyMs: 6, uptimeSeconds: 120400, ingestBandwidthMbps: 18.2, errorRatePct: 0, p95LatencyMs: 12 },
      { serviceName: 'MediaMTX Video Ingestion', status: 'healthy', port: 8554, latencyMs: 12, uptimeSeconds: 120400, ingestBandwidthMbps: 42.6, errorRatePct: 0.02, p95LatencyMs: 28 },
      { serviceName: 'Pinecone Vector DB', status: 'healthy', port: 443, latencyMs: 18, uptimeSeconds: 500000, errorRatePct: 0, p95LatencyMs: 35 },
    ];
  }
}
