/**
 * Re-exporting unified types from @sentinel/shared-types (Single Source of Truth)
 */
export * from '@sentinel/shared-types';

// Backward compatibility type aliases if needed by existing UI components
export type CasePriority = 'critical' | 'high' | 'medium' | 'low';
export type CaseStatus = 'draft' | 'active' | 'under_review' | 'found' | 'closed';
export type CameraStatus = 'live' | 'offline' | 'degraded' | 'disabled' | 'registering' | 'pending_pairing' | 'LIVE' | 'OFFLINE' | 'DEGRADED';
export type ConfidenceBand = 'low' | 'medium' | 'high';
export type SightingReviewStatus = 'pending_review' | 'confirmed_sighting' | 'rejected' | 'need_evidence' | 'pending' | 'confirmed';
export type SearchJobStatus =
  | 'queued'
  | 'extracting_features'
  | 'searching_face_index'
  | 'searching_reid_index'
  | 'fusing_results'
  | 'completed'
  | 'failed'
  | 'running';
export type AlertSeverity = 'critical' | 'warning' | 'info';
