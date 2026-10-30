import { ROLE_KEYS } from '../rbac';
import { z } from 'zod';
import { UserRole } from '../enums';

// ==========================================
// API ENVELOPES (RFC 7807 & PAGINATION)
// ==========================================

export const ApiProblemDetailsSchema = z.object({
  type: z.string().default('about:blank'),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  invalidParams: z
    .array(
      z.object({
        name: z.string(),
        reason: z.string(),
      }),
    )
    .optional(),
  correlationId: z.string().optional(),
});
export type ApiProblemDetails = z.infer<typeof ApiProblemDetailsSchema>;

export interface Paginated<T> {
  items: T[];
  nextCursor?: string | null;
  total?: number;
}

export function createPaginatedSchema<ItemType extends z.ZodTypeAny>(itemSchema: ItemType) {
  return z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().nullable().optional(),
    total: z.number().optional(),
  });
}

// ==========================================
// COUNTS & DASHBOARD METRICS
// ==========================================

export const CountsResponseSchema = z.object({
  pendingReviews: z.number().default(0),
  pendingReview: z.number().optional(),
  alerts: z.number().default(0),
  unacknowledgedAlerts: z.number().optional(),
  liveCameras: z.number().default(0),
  degradedCameras: z.number().default(0),
  offlineCameras: z.number().default(0),
  unplacedCameras: z.number().default(0),
  activeCases: z.number().default(0),
  criticalCases: z.number().default(0),
  minorCases: z.number().default(0),
  confirmedSightings: z.number().default(0),
  rejectedSightings: z.number().default(0),
  needsEvidenceSightings: z.number().default(0),
});
export type CountsResponse = z.infer<typeof CountsResponseSchema>;

export const KpiSummarySchema = z.object({
  activeCases: z.number(),
  searchesRunning: z.number(),
  pendingReviews: z.number(),
  peopleTracked: z.number(),
  camerasSearching: z.number(),
  completedToday: z.number(),
  avgVerificationTimeMinutes: z.number(),
  avgVerificationTimeDisplay: z.string(),
  systemReadinessScore: z.number(),
  lastUpdated: z.string(),
});
export type KpiSummary = z.infer<typeof KpiSummarySchema>;

// ==========================================
// USER DOMAIN
// ==========================================

export const UserRoleSchema = z.enum([
  'super_admin',
  'investigator',
  'reviewer',
  'viewer',
  'mobile_operator',
  'admin',
  'operator',
  'analyst',
]);

export const UserMfaSchema = z.object({
  enabled: z.boolean().default(false),
  recoveryCodesHashed: z.array(z.string()).default([]),
});
export type UserMfa = z.infer<typeof UserMfaSchema>;

export const UserSchema = z.object({
  id: z.string(),
  name: z.string().default(''),
  fullName: z.string().optional(),
  badgeNumber: z.string().default(''),
  email: z.string().email(),
  role: UserRoleSchema,
  avatarUrl: z.string().optional(),
  department: z.string().default(''),
  status: z.enum(['pending_verification', 'pending_approval', 'active', 'suspended', 'rejected']).default('active'),
  mfa: UserMfaSchema.default({ enabled: false, recoveryCodesHashed: [] }),
  mfaEnabled: z.boolean().optional(),
  failedLoginCount: z.number().default(0),
  lockedUntil: z.coerce.date().nullable().optional(),
  lastLoginAt: z.coerce.date().nullable().optional(),
  createdVia: z.enum(['password', 'google', 'github', 'invite', 'bootstrap']).default('password'),
  mustChangePassword: z.boolean().default(false).optional(),
  mfaEnrollmentRequired: z.boolean().default(false).optional(),
  active: z.boolean().default(true).optional(),
  createdAt: z.string().optional(),
});
export type User = z.infer<typeof UserSchema>;

// ==========================================
// CASE & REFERENCE DOMAIN
// ==========================================

export const CasePrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export type CasePriority = z.infer<typeof CasePrioritySchema>;

export const DomainCaseStatusSchema = z.enum(['draft', 'active', 'under_review', 'found', 'closed']);
export type DomainCaseStatus = z.infer<typeof DomainCaseStatusSchema>;

export const DomainReferencePhotoSchema = z.object({
  id: z.string(),
  url: z.string(),
  type: z.string(),
  faceDetected: z.boolean().optional(),
  reidExtracted: z.boolean().optional(),
  qualityScore: z.number(), // 0-100 or 0.0-1.0
  isSynthetic: z.boolean().optional(),
  provenance: z
    .object({
      source: z.string(),
      verifiedReal: z.boolean(),
      verifiedBy: z.string(),
      fileHashSha256: z.string(),
    })
    .optional(),
  uploadedAt: z.string(),
});
export type DomainReferencePhoto = z.infer<typeof DomainReferencePhotoSchema>;
export const ReferencePhotoSchema = DomainReferencePhotoSchema;
export type ReferencePhoto = DomainReferencePhoto;

export const CaseSchema = z.object({
  id: z.string(),
  caseNumber: z.string(),
  title: z.string(),
  personName: z.string(),
  dob: z.string().optional(),
  age: z.number(),
  gender: z.enum(['male', 'female', 'unknown']),
  heightCm: z.number().optional(),
  lastSeenLocation: z.string(),
  lastSeenAt: z.string(),
  reportedAt: z.string(),
  priority: CasePrioritySchema,
  status: DomainCaseStatusSchema,
  description: z.string(),
  lastSeenWearing: z.string(),
  distinguishingFeatures: z.string().optional(),
  referenceSetVersion: z.number().optional(),
  referencePhotos: z.array(DomainReferencePhotoSchema).default([]),
  referenceVersionHistory: z
    .array(
      z.object({
        version: z.number(),
        photos: z.array(DomainReferencePhotoSchema),
        action: z.string(),
        changedBy: z.string(),
        updatedAt: z.string(),
        reason: z.string().optional(),
      }),
    )
    .optional(),
  isMinor: z.boolean().optional(),
  isVulnerable: z.boolean().optional(),
  vulnerabilityDetailsEncrypted: z.string().optional(),
  registrationAuth: z.any().optional(),
  encryptedPii: z.any().optional(),
  sightingsCount: z.number().default(0),
  assignedOfficer: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Case = z.infer<typeof CaseSchema>;

// ==========================================
// CAMERA & TOPOLOGY DOMAIN
// ==========================================

export const DomainCameraStatusSchema = z.enum([
  'live',
  'offline',
  'degraded',
  'disabled',
  'registering',
  'pending_pairing',
  'LIVE',
  'OFFLINE',
  'DEGRADED',
]);
export type DomainCameraStatus = z.infer<typeof DomainCameraStatusSchema>;

export const CameraSourceTypeSchema = z.enum([
  'cctv_rtsp',
  'cctv_onvif',
  'mobile_webrtc',
  'mobile_rtmp',
  'usb_webcam',
  'file_upload',
]);
export type CameraSourceType = z.infer<typeof CameraSourceTypeSchema>;

export const CameraHealthSchema = z.object({
  lastSeenAt: z.string().optional(),
  lastFrameAt: z.string().optional(),
  fps: z.number().default(0),
  bitrate: z.number().default(0),
  packetLoss: z.number().default(0),
  latencyMs: z.number().default(0),
  reconnects: z.number().optional(),
  uptimePercentage: z.number().optional(),
});
export type CameraHealth = z.infer<typeof CameraHealthSchema>;

export const CameraAiPolicySchema = z.object({
  enabled: z.boolean().default(true),
  sampleFps: z.number().default(5),
  minDetectionConf: z.number().default(0.7),
  activeHours: z.string().optional(),
});
export type CameraAiPolicy = z.infer<typeof CameraAiPolicySchema>;

export const CameraRecordPolicySchema = z.object({
  mode: z.enum(['continuous', 'motion', 'event_only', 'off']).default('continuous'),
  segmentSec: z.number().default(900),
  retentionDays: z.number().default(30),
  quality: z.enum(['original', 'economy']).default('original'),
});
export type CameraRecordPolicy = z.infer<typeof CameraRecordPolicySchema>;

export const CameraSchema = z.object({
  id: z.string(),
  cameraId: z.string().optional(),
  cameraCode: z.string().optional(),
  name: z.string(),
  locationName: z.string(),
  siteId: z.string().optional(),
  siteName: z.string().optional(),
  zone: z.string(),
  status: DomainCameraStatusSchema,
  sourceType: CameraSourceTypeSchema.optional(),
  peopleCount: z.number().default(0),
  fps: z.number().default(30),
  bitrateKbps: z.number().optional(),
  resolution: z.string().optional(),
  video: z.any().optional(),
  coords: z.tuple([z.number(), z.number()]), // [lat, lng]
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  lastPing: z.string().optional(),
  rtspUrl: z.string().default(''),
  thumbnailUrl: z.string().default(''),
  heading: z.number().optional(),
  fovDegrees: z.number().optional(),
  range: z.number().optional(),
  floor: z.number().optional(),
  buildingId: z.string().optional(),
  indoor: z.boolean().optional(),
  activeDetections: z.number().optional(),
  aiPolicy: CameraAiPolicySchema.optional(),
  recordPolicy: CameraRecordPolicySchema.optional(),
  authorization: z.any().optional(),
  health: CameraHealthSchema.optional(),
  deviceInfo: z.any().optional(),
});
export type Camera = z.infer<typeof CameraSchema>;

export const CameraTopologyTransitionSchema = z.object({
  id: z.string().optional(),
  fromCamera: z.string(),
  toCamera: z.string(),
  minTravelSec: z.number(),
  maxTravelSec: z.number(),
  distanceMeters: z.number().optional(),
  isTwoWay: z.boolean().optional(),
  source: z.enum(['manual', 'learned']).optional(),
  updatedAt: z.string().optional(),
});
export type CameraTopologyTransition = z.infer<typeof CameraTopologyTransitionSchema>;

// ==========================================
// SIGHTING & REVIEW DOMAIN
// ==========================================

export const DomainConfidenceBandSchema = z.enum(['low', 'medium', 'high']);
export type DomainConfidenceBand = z.infer<typeof DomainConfidenceBandSchema>;

export const SightingReviewStatusSchema = z.enum([
  'pending_review',
  'confirmed_sighting',
  'rejected',
  'need_evidence',
  'pending',
  'confirmed',
  'possible',
]);
export type SightingReviewStatus = z.infer<typeof SightingReviewStatusSchema>;

export const SightingSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  caseNumber: z.string(),
  personName: z.string(),
  cameraId: z.string(),
  cameraName: z.string(),
  locationName: z.string(),
  detectedAt: z.string(),
  referenceThumbnailUrl: z.string(),
  candidateFrameUrl: z.string(),
  faceScore: z.number(),
  reidScore: z.number(),
  temporalPlausibility: z.number().default(0.85),
  cameraPlausibility: z.number().default(0.9),
  fusedRank: z.number().default(1),
  confidenceBand: DomainConfidenceBandSchema.default('medium'),
  displayLabel: z.literal('Possible match').default('Possible match'),
  status: SightingReviewStatusSchema,
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().optional(),
  reviewNotes: z.string().optional(),
  rejectReasonCode: z.string().optional(),
  promotionStatus: z.enum(['none', 'pending_approval', 'promoted', 'rejected']).optional(),
  promotedToReferenceId: z.string().optional(),
  promotionRequestedBy: z.string().optional(),
  promotionRequestedAt: z.string().optional(),
  promotionApprovedBy: z.string().optional(),
  promotionApprovedAt: z.string().optional(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
});
export type Sighting = z.infer<typeof SightingSchema>;

export const HardNegativeSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  sightingId: z.string(),
  reason: z.string(),
  rejectedAt: z.string(),
  rejectedBy: z.string(),
  thumbnailUrl: z.string(),
});
export type HardNegative = z.infer<typeof HardNegativeSchema>;

// ==========================================
// SEARCH JOBS
// ==========================================

export const SearchJobStateSchema = z.enum([
  'queued',
  'extracting_features',
  'searching_face_index',
  'searching_reid_index',
  'fusing_results',
  'completed',
  'failed',
  'running',
]);
export type SearchJobState = z.infer<typeof SearchJobStateSchema>;

export const SearchJobSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  caseTitle: z.string(),
  referencePhotoUrl: z.string(),
  status: SearchJobStateSchema,
  progressPercent: z.number(),
  candidatesFound: z.number(),
  cameraScopeCount: z.number(),
  timeRangeHours: z.number(),
  minConfidence: z.number(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
});
export type SearchJob = z.infer<typeof SearchJobSchema>;

// ==========================================
// JOURNEYS & TRACKING
// ==========================================

export const TransitionMetricSchema = z.object({
  elapsedSeconds: z.number(),
  distanceMeters: z.number(),
  speedMps: z.number(),
  plausibility: z.enum(['plausible', 'tight', 'slow', 'unobserved_gap']),
  gapMinutes: z.number().optional(),
});
export type TransitionMetric = z.infer<typeof TransitionMetricSchema>;

export const DetailedHopNodeSchema = z.object({
  hopNumber: z.number(),
  sightingId: z.string(),
  cameraId: z.string(),
  cameraName: z.string(),
  zone: z.string(),
  coords: z.tuple([z.number(), z.number()]), // [lat, lng]
  timestamp: z.string(),
  dwellTimeSeconds: z.number(),
  status: z.enum(['confirmed', 'possible', 'rejected', 'pending']),
  verified: z.boolean(),
  scores: z.object({
    face: z.number().nullable(),
    reid: z.number(),
    temporal: z.number(),
    cameraPlausibility: z.number(),
    fused: z.number(),
  }),
  thumbnails: z.object({
    referenceUrl: z.string(),
    cctvCropUrl: z.string(),
    frameUrl: z.string().optional(),
    faceDetected: z.boolean(),
    qualityScore: z.number(),
  }),
  trackId: z.string(),
  direction: z.string(),
  reviewInfo: z.object({
    reviewedBy: z.string().optional(),
    reviewedAt: z.string().optional(),
    notes: z.string().optional(),
  }),
  transition: TransitionMetricSchema,
  isNew: z.boolean().optional(),
});
export type DetailedHopNode = z.infer<typeof DetailedHopNodeSchema>;

export const DetailedJourneySchema = z.object({
  journeyId: z.string(),
  caseId: z.string(),
  caseNumber: z.string(),
  personName: z.string(),
  label: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  summary: z.string(),
  hops: z.array(DetailedHopNodeSchema),
  totalDistanceMeters: z.number(),
  totalDurationSeconds: z.number(),
  avgSpeedMps: z.number(),
  activeTrack: z.boolean(),
  lastActiveIso: z.string(),
  createdAt: z.string().optional(),
});
export type DetailedJourney = z.infer<typeof DetailedJourneySchema>;

export const JourneyNodeSchema = z.object({
  sightingId: z.string(),
  cameraId: z.string(),
  cameraName: z.string(),
  zone: z.string(),
  timestamp: z.string(),
  confidenceBand: DomainConfidenceBandSchema,
  coords: z.tuple([z.number(), z.number()]),
  dwellTimeSeconds: z.number(),
  verified: z.boolean().optional(),
  status: SightingReviewStatusSchema.optional(),
  appearanceSimilarity: z.number().optional(),
  faceScore: z.number().optional(),
  reidScore: z.number().optional(),
});
export type JourneyNode = z.infer<typeof JourneyNodeSchema>;

export const JourneySchema = z.object({
  id: z.string(),
  caseId: z.string(),
  personName: z.string(),
  cameraSequence: z.array(JourneyNodeSchema),
  totalDistanceMeters: z.number(),
  durationMinutes: z.number(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
});
export type Journey = z.infer<typeof JourneySchema>;

// ==========================================
// EVIDENCE, ALERTS, REPORTS, AUDIT
// ==========================================

export const CustodyRecordSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  action: z.string(),
  actor: z.string(),
  role: z.string(),
  notes: z.string().optional(),
});
export type CustodyRecord = z.infer<typeof CustodyRecordSchema>;

export const EvidenceItemSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  sightingId: z.string().optional(),
  title: z.string(),
  type: z.enum(['frame_snapshot', 'face_crop', 'reid_feature_vector', 'audit_log']),
  sha256: z.string(),
  capturedAt: z.string(),
  previewUrl: z.string().optional(),
  fileSizeBytes: z.number(),
  chainOfCustody: z.array(CustodyRecordSchema),
});
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

export const AlertSeveritySchema = z.enum(['critical', 'warning', 'info']);
export type AlertSeverity = z.infer<typeof AlertSeveritySchema>;

export const SystemAlertSchema = z.object({
  id: z.string(),
  caseId: z.string().optional(),
  sightingId: z.string().optional(),
  title: z.string(),
  message: z.string(),
  severity: AlertSeveritySchema,
  timestamp: z.string(),
  read: z.boolean(),
});
export type SystemAlert = z.infer<typeof SystemAlertSchema>;

export const SystemReportSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  title: z.string(),
  type: z.enum(['investigation_summary', 'chain_of_custody', 'sighting_audit', 'movement_timeline']),
  generatedBy: z.string(),
  generatedAt: z.string(),
  format: z.enum(['PDF', 'CSV']),
  fileSize: z.string(),
  downloadUrl: z.string().optional(),
});
export type SystemReport = z.infer<typeof SystemReportSchema>;

export const AuditEntrySchema = z.object({
  id: z.string(),
  caseId: z.string().optional(),
  actor: z.string(),
  action: z.string(),
  summary: z.string(),
  timestamp: z.string(),
  meta: z.record(z.any()).optional(),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

// ==========================================
// AUTH & ACCOUNT MANAGEMENT
// ==========================================

export const AuthIdentitySchema = z.object({
  userId: z.string(),
  provider: z.enum(['google', 'github']),
  providerUserId: z.string(),
  email: z.string().email(),
  emailVerified: z.boolean().default(false),
  linkedAt: z.coerce.date().default(() => new Date()),
});
export type AuthIdentity = z.infer<typeof AuthIdentitySchema>;

export const SessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  refreshTokenFamilyId: z.string(),
  currentTokenHash: z.string(),
  userAgent: z.string().default('unknown'),
  ipHash: z.string().default(''),
  deviceLabel: z.string().default('Unknown Device'),
  createdAt: z.coerce.date(),
  lastUsedAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
  revokedAt: z.coerce.date().nullable().optional(),
  revokedReason: z.string().optional(),
});
export type Session = z.infer<typeof SessionSchema>;

export const InviteSchema = z.object({
  id: z.string().optional(),
  codeHash: z.string(),
  role: z.string(),
  teams: z.array(z.string()).default([]),
  expiresAt: z.coerce.date(),
  maxUses: z.number().default(1),
  usedCount: z.number().default(0),
  autoApprove: z.boolean().default(false),
});
export type Invite = z.infer<typeof InviteSchema>;

export const RegisterRequestSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(10),
  inviteCode: z.string().optional(),
  consent: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms of service and security policy',
  }),
  captchaToken: z.string().optional(),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  mfaCode: z.string().optional(),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  user: UserSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
