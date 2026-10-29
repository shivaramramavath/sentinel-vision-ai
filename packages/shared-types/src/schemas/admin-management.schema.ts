import { z } from 'zod';

export type UserStatus = 'active' | 'invited' | 'suspended';

export interface AdminUserRecord {
  id: string;
  badgeNumber: string;
  fullName: string;
  email: string;
  department: string;
  teamId?: string;
  teamName?: string;
  role: 'Super Admin' | 'Investigator' | 'Reviewer' | 'Viewer';
  status: UserStatus;
  mfaEnabled: boolean;
  mfaMethod?: 'totp' | 'sms';
  lastLoginAt?: string;
  activeSessionsCount: number;
  createdAt: string;
}

export interface RbacPermissionMatrix {
  role: string;
  permissions: {
    resource:
      | 'cases'
      | 'sightings'
      | 'evidence'
      | 'reports'
      | 'cameras'
      | 'users'
      | 'settings'
      | 'pii';
    actions: {
      view: boolean;
      create: boolean;
      update: boolean;
      decide: boolean;
      export: boolean;
      purge: boolean;
    };
  }[];
}

export interface InvestigationTeam {
  id: string;
  name: string;
  department: string;
  leadOfficerId: string;
  leadOfficerName: string;
  memberCount: number;
  assignedSiteIds: string[];
  activeCaseCount: number;
}

export interface ModelBenchmarkMetrics {
  rank1Accuracy: number;
  mAP: number;
  falseMatchRateAtOperatingPoint: number;
  latencyMs: number;
}

export interface RegisteredAiModel {
  id: string;
  modelType: 'face_detector' | 'face_recognizer' | 'person_reid' | 'fusion_calibrator';
  modelName: string;
  version: string;
  status: 'active' | 'shadow' | 'candidate' | 'retired';
  embeddingDimensions: number;
  benchmarkMetrics: ModelBenchmarkMetrics;
  activatedAt?: string;
  activatedBy?: string;
  shadowDisagreementRatePct?: number;
}

export interface ThresholdProfile {
  id: string;
  name: string;
  scope: 'default' | 'site_specific' | 'camera_group';
  siteId?: string;
  faceCosineThresholdHigh: number;
  faceCosineThresholdMedium: number;
  reidCosineThresholdHigh: number;
  reidCosineThresholdMedium: number;
  fusedScoreHighBand: number;
  fusedScoreMediumBand: number;
  minQualityFloor: number;
  isActive: boolean;
  version: number;
  updatedAt: string;
}

export interface ImpactPreviewResult {
  profileId: string;
  evaluatedSightingsCount: number;
  decisionsFlippedCount: number;
  expectedExtraReviewsPerDay: number;
  projectedFMR: number;
  projectedFNMR: number;
}

export interface QueueLagTelemetry {
  queueName: string;
  waitingCount: number;
  activeCount: number;
  failedCount: number;
  delayedCount: number;
  dlqCount: number;
  consumerLag: number;
  throughputPerSecond: number;
}

export interface RetentionPolicy {
  dataClass: 'live_footage' | 'recorded_segments' | 'crops' | 'evidence' | 'reports';
  retentionDays: number;
  autoPurgeEnabled: boolean;
  requiresSupervisorApproval: boolean;
  excludedLegalHoldsCount: number;
}

export interface AdminAuditEntry {
  id: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetEntity: string;
  targetId: string;
  caseId?: string;
  ipAddress: string;
  userAgent?: string;
  timestamp: string;
  changeReason?: string;
  isAnomaly: boolean;
  diffBefore?: Record<string, any>;
  diffAfter?: Record<string, any>;
}

export interface ServiceHealthStatus {
  serviceName: string;
  status: 'healthy' | 'degraded' | 'offline';
  port: number;
  latencyMs: number;
  uptimeSeconds: number;
  gpuUtilizationPct?: number;
  ingestBandwidthMbps?: number;
  storageUsageGb?: number;
  storageLimitGb?: number;
  errorRatePct: number;
  p95LatencyMs: number;
  lastIncident?: string;
}
