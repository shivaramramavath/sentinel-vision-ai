import { z } from 'zod';

export interface DashboardSummary {
  activeCasesCount: number;
  criticalCasesCount: number;
  awaitingReviewCount: number;
  oldestReviewWaitMinutes: number;
  slaBreachCount: number;
  searchesRunningCount: number;
  searchesStageSummary: string; // e.g. "2 indexing · 1 fusing"
  samePersonDecisions7d: number;
  rejectedDecisions7d: number;
  medianTimeToFirstReviewMinutes: number;
  targetReviewMinutes: number;
  turnaroundTrendPct: number; // e.g. -14% (faster)
}

export interface ContributingFactors {
  priorityWeight: number; // 0.2 - 1.0
  timeFactor: number;     // saturating 0..1
  reviewFactor: number;   // 0..1
  slaRisk: number;        // >=1 means breach
  vulnerableBoost: number; // 1 for minor/vulnerable
  explanation: string;
}

export interface PriorityCaseSummary {
  id: string;
  caseNumber: string;
  personName: string;
  avatarUrl: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  isMinor: boolean;
  isVulnerable: boolean;
  lastSeenAt: string;
  lastSeenLocation: string;
  missingHours: number;
  missingMinutes: number;
  pendingReviewsCount: number;
  searchProgressPct: number;
  lastHopTimestamp?: string;
  readinessScore: number;
  priorityScore: number;
  priorityRank: number;
  contributingFactors: ContributingFactors;
  nearCamerasCount: number;
  lastKnownCoords: [number, number]; // [lng, lat]
  reachableAreaMeters: number;
  suggestedCameras: Array<{
    id: string;
    cameraCode: string;
    name: string;
    coords: [number, number];
    reason: string;
  }>;
  journeyHops: Array<{
    id: string;
    cameraCode: string;
    coords: [number, number];
    timestamp: string;
    status: 'same_person' | 'possible';
  }>;
}

export type ActionQueueType =
  | 'review'
  | 'sla_breach'
  | 'stale_case'
  | 'draft_case'
  | 'report_approval'
  | 'mobile_approval';

export interface ActionQueueItem {
  id: string;
  type: ActionQueueType;
  title: string;
  urgencyScore: number;
  createdAt: string;
  slaDueAt?: string;
  slaMinutesRemaining?: number;
  isBreached?: boolean;
  caseId?: string;
  caseNumber?: string;
  personName?: string;
  candidateCropUrl?: string;
  referenceCropUrl?: string;
  fusedScore?: number;
  confidenceBand?: 'high' | 'medium' | 'low';
  cameraCode?: string;
  locationName?: string;
  detectedAt?: string;
  sightingId?: string;
  metadata?: Record<string, any>;
}

export type SuggestionType =
  | 'NO_RECENT_SIGHTING'
  | 'UNSEARCHED_CAMERAS'
  | 'COVERAGE_GAP'
  | 'SEARCH_EMPTY'
  | 'LOW_READINESS'
  | 'STALE_LAST_SEEN'
  | 'REVIEW_BACKLOG'
  | 'MODEL_REEMBED_PENDING';

export interface DashboardSuggestion {
  id: string;
  caseId: string;
  caseNumber: string;
  personName: string;
  type: SuggestionType;
  title: string;
  reason: string;
  evidence: string;
  actionLabel: string;
  actionUrl: string;
  createdAt: string;
  dismissedBy?: string;
}

export interface ActivityFeedItem {
  id: string;
  caseId?: string;
  caseNumber?: string;
  personName?: string;
  type: 'candidate_found' | 'decision_made' | 'case_updated' | 'search_completed' | 'reference_added' | 'status_changed';
  title: string;
  details: string;
  actor: string;
  timestamp: string;
  targetUrl: string;
  isMine: boolean;
}

export interface TrendDataPoint {
  date: string;
  highBand: number;
  mediumBand: number;
  lowBand: number;
  medianReviewSec: number;
  p90ReviewSec: number;
  slaTargetSec: number;
  searchesCompleted: number;
  confirmedRateHigh: number;
  confirmedRateMedium: number;
  confirmedRateLow: number;
  sampleSize: number;
}

export interface ReviewerWorkload {
  userId: string;
  name: string;
  avatarUrl: string;
  role: string;
  isOnline: boolean;
  isOnCall: boolean;
  pendingReviewsCount: number;
  avgReviewSec: number;
}

export interface TeamOnCallStatus {
  currentOnCallUser: {
    id: string;
    name: string;
    avatarUrl: string;
    shiftEndAt: string;
  };
  reviewers: ReviewerWorkload[];
  workloadImbalanceWarning?: string;
}

export interface SinceDigest {
  newCandidatesCount: number;
  decisionsByOthersCount: number;
  casesEscalatedCount: number;
  searchesCompletedCount: number;
  hasUpdates: boolean;
  summaryText: string;
}

export interface DashboardLayout {
  userId: string;
  visibleWidgets: string[];
  widgetOrder: string[];
  updatedAt: string;
}
