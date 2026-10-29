import {
  MissingPerson,
  MissingPersonStatus,
  MissingPersonPriority,
  LastSeenRecord,
} from '@sentinel/shared-types';

export type {
  MissingPerson,
  MissingPersonStatus,
  MissingPersonPriority,
  LastSeenRecord,
};

export interface ClothingItem {
  type: string;
  colour: string;
  pattern?: string;
  brand?: string;
}

export interface ClothingAccessory {
  type: string;
  colour: string;
}

export interface LastSeenClothing {
  items: ClothingItem[];
  accessories: ClothingAccessory[];
  footwear?: string;
  carriedItems: string[];
}

export interface PersonReporter {
  name: string;
  relation: string;
  phoneEncrypted?: string;
  emailEncrypted?: string;
  contactPreference: 'phone' | 'email' | 'in_person';
}

export interface PersonAuthority {
  reportNumber: string;
  station: string;
  officerName: string;
  authorizedBy: string;
  authorizedAt: string;
  legalBasisNote: string;
}

export interface FieldDiffHistory {
  at: string;
  actor: string;
  before: Record<string, any>;
  after: Record<string, any>;
  changedFields: string[];
}

export type ReferenceImageType =
  | 'face_front'
  | 'face_profile_left'
  | 'face_profile_right'
  | 'face_angled'
  | 'body_full_front'
  | 'body_full_back'
  | 'body_upper'
  | 'clothing_detail'
  | 'cctv_crop_verified';

export type ReferenceStatus = 'uploading' | 'processing' | 'ready' | 'needs_review' | 'rejected';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  confidence?: number;
}

export interface ReferenceImageUI {
  id: string;
  referenceId: string;
  caseId: string;
  url: string;
  thumbnailUrl?: string;
  type: ReferenceImageType;
  status: ReferenceStatus;
  qualityScore: number; // 0-100
  qualityTier: 'excellent' | 'good' | 'fair' | 'poor';
  poseBin: 'front' | 'front_left' | 'left' | 'back_left' | 'back' | 'back_right' | 'right' | 'front_right';
  isPrimary: boolean;
  warnings: string[];
  rejectReasons?: string[];
  photoTakenAt?: string;
  source?: string;
  uploadProgress?: number;
  detectedFaces?: BoundingBox[];
  detectedBodies?: BoundingBox[];
  selectedFaceBox?: BoundingBox;
  selectedPersonBox?: BoundingBox;
  isOutlier?: boolean;
  duplicateMatchCaseId?: string;
}

export interface PoseCoverageReport {
  covered: string[];
  missing: string[];
  coverageRatio: number; // 0 to 1
  bodyViewsCovered: {
    front: boolean;
    back: boolean;
    side: boolean;
  };
}

export interface ReadinessScoreResult {
  score: number; // 0-100
  tier: 'READY' | 'SUBOPTIMAL' | 'INSUFFICIENT';
  breakdown: {
    faceQuality: number;
    poseDiversity: number;
    bodyFullness: number;
    temporalRecency: number;
  };
  recommendations: string[];
  missingAngles: string[];
}

export interface DuplicateCaseMatch {
  matchCaseId: string;
  caseNumber: string;
  fullName: string;
  similarity: number; // 0 - 1
  thumbnailUrl: string;
  status: string;
  lastSeenLocation: string;
  registeredAt: string;
}

export interface HardNegative {
  id: string;
  caseId: string;
  sightingId: string;
  cropUrl: string;
  rejectReasonCode: string;
  rejectedBy: string;
  rejectedAt: string;
  model_version: string;
}

