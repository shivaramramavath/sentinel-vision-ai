import { z } from 'zod';

export type AlertSeverityType = 'critical' | 'warning' | 'info';
export type AlertStatusType = 'new' | 'acknowledged' | 'assigned' | 'snoozed' | 'resolved';
export type AlertSourceType = 'detection' | 'camera' | 'system' | 'case' | 'queue';

export interface AlertEvent {
  id: string;
  dedupeKey: string;
  occurrenceCount: number;
  firstOccurrenceAt: string;
  lastOccurrenceAt: string;
  severity: AlertSeverityType;
  status: AlertStatusType;
  type: AlertSourceType;
  title: string;
  message: string;
  caseId?: string;
  caseNumber?: string;
  personName?: string;
  cameraId?: string;
  cameraCode?: string;
  locationName?: string;
  sightingId?: string;
  candidateCropUrl?: string;
  referenceCropUrl?: string;
  fusedScore?: number;
  matchBand?: 'high' | 'medium' | 'low';
  assigneeId?: string;
  assigneeName?: string;
  snoozedUntil?: string;
  slaDueAt?: string;
  slaMinutesRemaining?: number;
  isEscalated: boolean;
  escalatedAt?: string;
  resolutionNote?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  metadata?: Record<string, any>;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  triggerType:
    | 'sighting_score_threshold'
    | 'sighting_reachable_area'
    | 'camera_offline'
    | 'fps_degradation'
    | 'queue_lag'
    | 'dlq_backlog'
    | 'storage_high'
    | 'token_reuse_detected'
    | 'integrity_check_failure'
    | 'mobile_stream_dropped';
  conditions: {
    casePriority?: ('critical' | 'high' | 'medium' | 'low')[];
    minFusedScore?: number;
    offlineMinutesThreshold?: number;
    fpsFloor?: number;
    siteIds?: string[];
    quietHours?: { start: string; end: string };
  };
  actions: {
    severity: AlertSeverityType;
    notifyChannels: string[];
    assignToOnCall: boolean;
    autoOpenReviewItem: boolean;
    raiseCasePriority?: boolean;
    createMaintenanceTicket?: boolean;
  };
  enabled: boolean;
  version: number;
  owner: string;
  createdAt: string;
  updatedAt: string;
}

export interface DispatchChannel {
  id: string;
  name: string;
  type: 'in_app' | 'email' | 'sms' | 'push_pwa' | 'webhook_slack' | 'webhook_teams' | 'webhook_generic';
  endpointOrTarget: string;
  rateLimitPerMinute: number;
  enabled: boolean;
  isVerified: boolean;
  lastDeliveryStatus?: 'delivered' | 'failed';
  lastDeliveryAt?: string;
  deliverySuccessRatePct: number;
}

export interface OnCallShift {
  id: string;
  officerId: string;
  officerName: string;
  role: string;
  shiftStart: string;
  shiftEnd: string;
  tier: 1 | 2 | 3; // 1 = Primary investigator, 2 = Supervisor, 3 = Admin
  contactPhone: string;
  radioCallSign: string;
  isCurrentlyActive: boolean;
}

export interface AlertsSummary {
  unreadCount: number;
  criticalCount: number;
  warningCount: number;
  activeStormCount: number;
  topRecent: AlertEvent[];
}
