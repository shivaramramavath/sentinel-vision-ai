export interface PersonSearchResult {
  caseId: string;
  caseNumber: string;
  personId?: string;
  fullName: string;
  aliases: string[];
  gender?: string;
  approxAgeRange?: string;
  avatarUrl: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  lastSeenLocation?: string;
  lastSeenAt?: string;
  hopsCount: number;
  lastActivityAt?: string;
  isMinor?: boolean;
}

export interface PhotoSearchCandidate {
  caseId: string;
  caseNumber: string;
  personName: string;
  photoUrl: string;
  matchedPhotoUrl: string;
  similarityScore: number; // 0-1
  faceScore?: number;
  reidScore?: number;
  priority: string;
  status: string;
  lastSeenLocation: string;
  disclaimer: string;
}

export interface TransitionMetric {
  elapsedSeconds: number;
  distanceMeters: number;
  speedMps: number;
  plausibility: 'plausible' | 'tight' | 'slow' | 'unobserved_gap';
  gapMinutes?: number;
}

export interface DetailedHopNode {
  hopNumber: number;
  sightingId: string;
  cameraId: string;
  cameraName: string;
  zone: string;
  coords: [number, number]; // [lat, lng]
  timestamp: string;
  dwellTimeSeconds: number;
  status: 'confirmed' | 'possible' | 'rejected';
  verified: boolean;
  scores: {
    face: number | null;
    reid: number;
    temporal: number;
    cameraPlausibility: number;
    fused: number;
  };
  thumbnails: {
    referenceUrl: string;
    cctvCropUrl: string;
    frameUrl?: string;
    faceDetected: boolean;
    qualityScore: number;
  };
  trackId: string;
  direction: string;
  reviewInfo: {
    reviewedBy?: string;
    reviewedAt?: string;
    notes?: string;
  };
  transition: TransitionMetric;
  isNew?: boolean;
}

export interface ReachableAreaInfo {
  center: [number, number]; // [lng, lat]
  radiusMeters: number;
  maxRadiusMeters: number;
  walkingSpeedMps: number;
  elapsedMinutes: number;
  label: string;
}

export interface SuggestedCamera {
  cameraId: string;
  name: string;
  coords: [number, number]; // [lat, lng]
  distanceMeters: number;
  expectedArrivalWindowMin: string;
}

export interface DetailedJourney {
  journeyId: string; // 'A' | 'B' | 'C'
  caseId: string;
  caseNumber: string;
  personName: string;
  label: string;
  diffSummary: string;
  confidence: number;
  lowestConfidence: number;
  totalDistanceMeters: number;
  durationMinutes: number;
  hopsCount: number;
  confirmedCount: number;
  possibleCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  hops: DetailedHopNode[];
  reachableArea: ReachableAreaInfo;
  suggestedCameras: SuggestedCamera[];
}
