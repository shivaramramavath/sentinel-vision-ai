import { z } from 'zod';

export type EvidenceItemType =
  | 'frame_snapshot'
  | 'video_clip'
  | 'face_crop'
  | 'body_crop'
  | 'reference_photo'
  | 'report_attachment';

export type IntegrityStatus = 'verified' | 'pending' | 'failed';

export interface DerivedEmbeddingData {
  embeddingRecordId: string;
  modelVersion: string;
  embeddingDimensions: number;
  qualityScore: number;
  extractedAt: string;
  disclaimer: string; // "Derived feature vector for index matching only — not primary evidence."
}

export interface CustodyLedgerEntry {
  id: string;
  evidenceId: string;
  caseId?: string;
  sequenceNumber: number;
  prevEntryHash: string;
  entryHash: string; // SHA-256(prevEntryHash + canonical payload)
  action:
    | 'ingested'
    | 'hashed'
    | 'viewed'
    | 'reviewed'
    | 'exported'
    | 'redacted'
    | 'legal_hold'
    | 'verification_run';
  actor: string;
  actorRole: string;
  timestamp: string;
  notes?: string;
  proofSignature?: string;
}

export interface DigitalEvidenceItem {
  id: string;
  caseId: string;
  caseNumber: string;
  personName: string;
  title: string;
  type: EvidenceItemType;
  capturedAt: string;
  clockOffsetMs: number;
  cameraId: string;
  cameraCode: string;
  locationName: string;
  fileSizeBytes: number;
  sha256: string;
  integrityStatus: IntegrityStatus;
  lastVerifiedAt: string;
  mediaUrl: string;
  thumbnailUrl: string;
  codec?: string;
  resolution?: string;
  fps?: number;
  isLegalHold: boolean;
  legalHoldReason?: string;
  legalHoldPlacedBy?: string;
  legalHoldPlacedAt?: string;
  isRedacted: boolean;
  parentEvidenceId?: string;
  redactionNotes?: string;
  linkedSightingId?: string;
  linkedHopId?: string;
  linkedDecision?: 'same_person' | 'not_same_person' | 'possible';
  tags: string[];
  derivedData?: DerivedEmbeddingData;
  chainOfCustody: CustodyLedgerEntry[];
  accessLog: Array<{
    actor: string;
    action: string;
    timestamp: string;
    ipAddress?: string;
  }>;
}

export interface IntegritySummary {
  totalItems: number;
  verifiedItems: number;
  pendingItems: number;
  failedItems: number;
  lastFullCheckAt: string;
  isTampered: boolean;
  tamperedItemIds?: string[];
  summaryText: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: 'investigation' | 'movement' | 'audit' | 'operations';
  defaultSections: string[];
  isScheduledSupported: boolean;
}

export interface GeneratedReport {
  id: string;
  caseId: string;
  caseNumber: string;
  title: string;
  templateId: string;
  templateName: string;
  status: 'queued' | 'generating' | 'ready' | 'failed';
  version: number;
  sizeBytes: number;
  generatedBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  digitalSignature?: string;
  signerPublicKey?: string;
  isLocked: boolean;
  pdfDownloadUrl?: string;
  zipDownloadUrl?: string;
  shareLinks: Array<{
    shareToken: string;
    expiresAt: string;
    passcodeProtected: boolean;
    accessCount: number;
    revoked: boolean;
  }>;
}

export interface ReportSchedule {
  id: string;
  title: string;
  templateId: string;
  cronExpression: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  recipients: string[];
  lastRunAt?: string;
  nextRunAt: string;
  active: boolean;
}

export interface ExportPackage {
  id: string;
  caseId: string;
  packageNumber: string;
  manifestSha256: string;
  itemCount: number;
  fileSizeBytes: number;
  createdAt: string;
  expiresAt: string;
  downloadCount: number;
  downloadUrl: string;
  status: 'ready' | 'expired';
}
