/**
 * SENTINEL VISION AI - SINGLE SOURCE OF TRUTH (MOCK DATABASE & SELECTORS)
 * 
 * Every count in the UI (sidebar badges, tab counts, KPI numbers, headers)
 * is DERIVED from these selectors. Never hard-code counts.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  Case,
  Camera,
  CameraStatus,
  CameraTopologyTransition,
  CameraHealth,
  CameraSourceType,
  Sighting,
  SearchJob,
  Journey,
  JourneyNode,
  EvidenceItem,
  SystemAlert,
  SystemReport,
  ReferencePhoto,
} from '@/types';
import { DetailedJourney, DetailedHopNode } from '@/types/tracking';

// ==========================================
// 1. AI MODEL REGISTRY CONFIGURATION
// Model facts come from this config, never typed into JSX
// ==========================================
export const AI_MODEL_REGISTRY = {
  face: {
    name: 'ArcFace',
    version: 'v2.1',
    embeddingDim: 512,
    metric: 'Cosine Similarity',
    threshold: 0.65,
    description: 'Deep face recognition embedding with 5-landmark alignment',
  },
  reid: {
    name: 'OSNet-AIN',
    version: 'x1.0',
    embeddingDim: 512,
    metric: 'Euclidean / Cosine',
    threshold: 0.58,
    description: 'Omni-Scale Network with attention for whole-body person Re-ID',
  },
  color: {
    name: 'HSV Color Histogram',
    version: 'v2.0',
    embeddingDim: 32,
    metric: 'Bhattacharyya Distance',
    threshold: 0.50,
    description: 'Spatial 3-tier color distribution across upper/lower clothing',
  },
  spatiotemporal: {
    name: 'Kinematic Plausibility',
    version: 'v1.4',
    algorithm: 'Kalman Velocity Gate',
    walkingSpeedRangeMps: [0.8, 1.8],
    description: 'Physical transit speed and topology graph traversal plausibility',
  },
} as const;

// Helper to determine if someone is a minor (< 18 from DOB)
export function isMinorFromDob(dob?: string): boolean {
  if (!dob) return false;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return false;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age < 18;
}

// ==========================================
// 2. MOCK DATABASE ENTITIES
// Distinct photos per person, real DOBs, versioned references
// ==========================================

export const INITIAL_CASES: Case[] = [
  {
    id: 'case_001',
    caseNumber: 'MP-2026-1042',
    title: 'Disappearance of Maya Chen',
    personName: 'Maya Chen',
    age: 14, // Derived from DOB 2012-05-18 (< 18 = Minor)
    gender: 'female',
    heightCm: 158,
    lastSeenLocation: 'North Station Concourse, Zone A',
    lastSeenAt: '2026-10-28T09:15:00Z',
    reportedAt: '2026-10-28T10:30:00Z',
    priority: 'high',
    status: 'active',
    description: 'Student last seen leaving North Station subway concourse heading toward East Arcade. Carrying teal backpack.',
    lastSeenWearing: 'Navy blue hoodie with white drawstrings, dark denim jeans, white sneakers, teal backpack',
    distinguishingFeatures: 'Small birthmark near left collarbone, silver stud earrings',
    isMinor: true,
    isVulnerable: true,
    assignedOfficer: 'Insp. Sarah Vance',
    sightingsCount: 4,
    referenceSetVersion: 2,
    referencePhotos: [
      {
        id: 'ref_mc_01',
        url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
        type: 'face',
        qualityScore: 94,
        uploadedAt: '2026-10-28T10:35:00Z',
        provenance: {
          source: 'School ID record',
          verifiedReal: true,
          verifiedBy: 'Insp. Sarah Vance',
          fileHashSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        },
      },
      {
        id: 'ref_mc_02',
        url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        type: 'full_body',
        qualityScore: 88,
        uploadedAt: '2026-10-28T10:40:00Z',
      },
      {
        id: 'ref_mc_03',
        url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80',
        type: 'profile_left',
        qualityScore: 91,
        uploadedAt: '2026-10-28T11:15:00Z',
      },
    ],
    registrationAuth: {
      reporter: {
        name: 'Eleanor Chen',
        relationship: 'Mother',
      },
      authority: {
        name: 'Metro Transit Police',
        firOrCaseNumber: 'FIR-2026-9904',
        officerBadge: 'SV-4902',
      },
      consent: {
        confirmed: true,
        confirmedAt: '2026-10-28T10:32:00Z',
        legalBasis: 'Statutory missing minor urgent bulletin order',
      },
    },
  },
  {
    id: 'case_002',
    caseNumber: 'MP-2026-0988',
    title: 'Missing Child: Leo Torres',
    personName: 'Leo Torres',
    age: 9, // DOB 2017-08-22 (< 18 = Minor)
    gender: 'male',
    heightCm: 132,
    lastSeenLocation: 'Riverwalk Plaza Carousel',
    lastSeenAt: '2026-10-28T14:45:00Z',
    reportedAt: '2026-10-28T15:10:00Z',
    priority: 'critical',
    status: 'active',
    description: 'Separated from parent at Riverwalk Plaza carousel. Urgent alert active.',
    lastSeenWearing: 'Bright blue windbreaker jacket, gray track pants, neon yellow sneakers',
    distinguishingFeatures: 'Light freckles across nose, slight gap in front teeth',
    isMinor: true,
    isVulnerable: true,
    assignedOfficer: 'Det. Marcus Brody',
    sightingsCount: 3,
    referenceSetVersion: 1,
    referencePhotos: [
      {
        id: 'ref_lt_01',
        url: 'https://images.unsplash.com/photo-1485546246426-74dc88dec4d9?auto=format&fit=crop&w=400&q=80',
        type: 'face',
        qualityScore: 89,
        uploadedAt: '2026-10-28T15:12:00Z',
      },
      {
        id: 'ref_lt_02',
        url: 'https://images.unsplash.com/photo-1471286174890-9c112ffca564?auto=format&fit=crop&w=400&q=80',
        type: 'full_body',
        qualityScore: 84,
        uploadedAt: '2026-10-28T15:15:00Z',
      },
    ],
    registrationAuth: {
      reporter: {
        name: 'Sofia Torres',
        relationship: 'Mother',
      },
      authority: {
        name: 'Central District Police',
        firOrCaseNumber: 'FIR-2026-9812',
        officerBadge: 'MB-1184',
      },
      consent: {
        confirmed: true,
        confirmedAt: '2026-10-28T15:11:00Z',
        legalBasis: 'Amber Alert statutory authorization',
      },
    },
  },
  {
    id: 'case_003',
    caseNumber: 'MP-2026-0841',
    title: 'Silver Alert: David Vance',
    personName: 'David Vance',
    age: 74,
    gender: 'male',
    heightCm: 175,
    lastSeenLocation: 'Central Market Square North Exit',
    lastSeenAt: '2026-10-28T07:30:00Z',
    reportedAt: '2026-10-28T09:00:00Z',
    priority: 'critical',
    status: 'under_review',
    description: 'Elderly individual with early stage memory impairment. Wandered from assisted transport pickup.',
    lastSeenWearing: 'Charcoal wool flat cap, olive trench coat, brown leather shoes, dark wooden cane',
    distinguishingFeatures: 'Short silver beard, silver wire-rimmed glasses, uses dark cane',
    isMinor: false,
    isVulnerable: true,
    assignedOfficer: 'Insp. Sarah Vance',
    sightingsCount: 2,
    referenceSetVersion: 1,
    referencePhotos: [
      {
        id: 'ref_dv_01',
        url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
        type: 'face',
        qualityScore: 92,
        uploadedAt: '2026-10-28T09:05:00Z',
      },
    ],
    registrationAuth: {
      reporter: {
        name: 'Claire Vance',
        relationship: 'Daughter / Guardian',
      },
      authority: {
        name: 'Silver Alert Taskforce',
        firOrCaseNumber: 'FIR-2026-8711',
      },
      consent: {
        confirmed: true,
        confirmedAt: '2026-10-28T09:02:00Z',
        legalBasis: 'Silver alert vulnerable adult guardian consent',
      },
    },
  },
  {
    id: 'case_004',
    caseNumber: 'MP-2026-1102',
    title: 'Disappearance: Priya Sharma',
    personName: 'Priya Sharma',
    age: 26,
    gender: 'female',
    heightCm: 165,
    lastSeenLocation: 'West Tech Park, Tower B Plaza',
    lastSeenAt: '2026-10-27T19:00:00Z',
    reportedAt: '2026-10-28T08:00:00Z',
    priority: 'medium',
    status: 'active',
    description: 'Software engineer did not return home after leaving office campus.',
    lastSeenWearing: 'Maroon woolen scarf, black overcoat, gray slacks, black tote bag',
    distinguishingFeatures: 'Dimple on right cheek, small wrist tattoo',
    isMinor: false,
    isVulnerable: false,
    assignedOfficer: 'Det. Marcus Brody',
    sightingsCount: 2,
    referenceSetVersion: 2,
    referencePhotos: [
      {
        id: 'ref_ps_01',
        url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
        type: 'face',
        qualityScore: 96,
        uploadedAt: '2026-10-28T08:15:00Z',
      },
    ],
  },
  {
    id: 'case_005',
    caseNumber: 'MP-2026-1215',
    title: 'Missing Teen: Lucas Tremblay',
    personName: 'Lucas Tremblay',
    age: 16, // DOB 2010-11-03 (< 18 = Minor)
    gender: 'male',
    heightCm: 172,
    lastSeenLocation: 'Skate Arena Gate 4',
    lastSeenAt: '2026-10-28T16:20:00Z',
    reportedAt: '2026-10-28T18:00:00Z',
    priority: 'high',
    status: 'active',
    description: 'Teenager separated from group near Skate Arena. Phone appears switched off.',
    lastSeenWearing: 'Forest green oversized hoodie, dark cargo pants, high-top skate shoes, black skateboard',
    distinguishingFeatures: 'Curved scar on right eyebrow',
    isMinor: true,
    isVulnerable: false,
    assignedOfficer: 'Officer David Kim',
    sightingsCount: 1,
    referenceSetVersion: 1,
    referencePhotos: [
      {
        id: 'ref_ltb_01',
        url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80',
        type: 'face',
        qualityScore: 87,
        uploadedAt: '2026-10-28T18:10:00Z',
      },
    ],
  },
  {
    id: 'case_006',
    caseNumber: 'MP-2026-1230',
    title: 'Inquiry: Amina Bello',
    personName: 'Amina Bello',
    age: 32,
    gender: 'female',
    heightCm: 168,
    lastSeenLocation: 'Downtown Metro Station Platform 2',
    lastSeenAt: '2026-10-27T22:30:00Z',
    reportedAt: '2026-10-28T06:30:00Z',
    priority: 'low',
    status: 'found',
    description: 'Individual located safely at transit customer assistance center. Case resolved.',
    lastSeenWearing: 'Ochre knit sweater, cream trousers',
    isMinor: false,
    isVulnerable: false,
    assignedOfficer: 'Analyst Elena Rostova',
    sightingsCount: 2,
    referenceSetVersion: 1,
    referencePhotos: [
      {
        id: 'ref_ab_01',
        url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=400&q=80',
        type: 'face',
        qualityScore: 93,
        uploadedAt: '2026-10-28T06:40:00Z',
      },
    ],
  },
  {
    id: 'case_007',
    caseNumber: 'MP-2026-1250',
    title: 'Draft: Case Intake Intake 409',
    personName: 'Unsubmitted Draft Registration',
    age: 28,
    gender: 'unknown',
    lastSeenLocation: 'Terminal 3 Baggage Area',
    lastSeenAt: '2026-10-28T12:00:00Z',
    reportedAt: '2026-10-28T12:15:00Z',
    priority: 'medium',
    status: 'closed', // draft stage
    description: 'Autosaved registration draft awaiting FIR report confirmation and guardian signature.',
    lastSeenWearing: 'Black jacket',
    isMinor: false,
    assignedOfficer: 'Unassigned',
    sightingsCount: 0,
    referenceSetVersion: 0,
    referencePhotos: [],
  },
];

// ==========================================
// 3. SURVEILLANCE SITES & CAMERAS (124 CAMERAS · 8 SITES)
// ==========================================
export const SURVEILLANCE_SITES = [
  { id: 'site_central', name: 'Metro Central Concourse', baseLat: 40.7128, baseLng: -74.0060, floor: 1, indoor: true },
  { id: 'site_t1', name: 'Terminal 1 Departures', baseLat: 40.7142, baseLng: -74.0045, floor: 2, indoor: true },
  { id: 'site_t2', name: 'Terminal 2 Arrivals', baseLat: 40.7115, baseLng: -74.0075, floor: 1, indoor: true },
  { id: 'site_north', name: 'North Gate Security', baseLat: 40.7155, baseLng: -74.0030, floor: 1, indoor: false },
  { id: 'site_bus', name: 'South Bus Interchange', baseLat: 40.7095, baseLng: -74.0080, floor: -1, indoor: true },
  { id: 'site_retail', name: 'Duty Free Promenade', baseLat: 40.7135, baseLng: -74.0050, floor: 2, indoor: true },
  { id: 'site_escalator', name: 'East Escalators Corridor', baseLat: 40.7120, baseLng: -74.0025, floor: -1, indoor: true },
  { id: 'site_reclaim', name: 'Baggage Reclaim Zone 4', baseLat: 40.7130, baseLng: -74.0085, floor: 1, indoor: true },
] as const;

export function deriveCameraStatus(
  health?: CameraHealth,
  isDisabled?: boolean,
  isRegistering?: boolean,
): CameraStatus {
  if (isDisabled) return 'disabled';
  if (isRegistering) return 'registering';
  if (!health) return 'offline';
  const now = Date.now();
  const lastFrameTs = health.lastFrameAt ? new Date(health.lastFrameAt).getTime() : 0;
  const timeSinceLastFrameSec = (now - lastFrameTs) / 1000;
  if (timeSinceLastFrameSec > 10 || health.fps === 0) {
    return 'offline';
  }
  if (health.fps < 15 || health.packetLoss >= 5 || health.latencyMs > 300) {
    return 'degraded';
  }
  return 'live';
}

const CAMERA_THUMBNAILS = [
  'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=640&q=80',
  'https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=640&q=80',
  'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=640&q=80',
  'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=640&q=80',
  'https://images.unsplash.com/photo-1477959858617-67f30bc75b82?auto=format&fit=crop&w=640&q=80',
  'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=640&q=80',
  'https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=640&q=80',
  'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=640&q=80',
];

export const INITIAL_CAMERAS: Camera[] = Array.from({ length: 124 }, (_, index) => {
  const i = index + 1;
  const camNumStr = String(i).padStart(3, '0');
  const code = `CAM-${camNumStr}`;
  const id = i <= 5 ? `cam_${String(i).padStart(3, '0')}` : `cam_${camNumStr}`;

  // Offline indices: 6, 14, 48, 89, 103, 112, 116, 124 (exactly 8 cameras)
  const isOffline = [6, 14, 48, 89, 103, 112, 116, 124].includes(i);
  // Degraded indices: 5, 23, 54, 81, 97, 107 (exactly 6 cameras)
  const isDegraded = !isOffline && [5, 23, 54, 81, 97, 107].includes(i);
  // Live: remaining 110 cameras

  // Unplaced indices: 118, 119, 120, 121, 122, 123, 124 (exactly 7 cameras)
  const isUnplaced = i >= 118;

  const locIndex = (i - 1) % SURVEILLANCE_SITES.length;
  const loc = SURVEILLANCE_SITES[locIndex];

  // Deterministic radial scatter around site base coordinates
  const goldenAngle = 2.399963229728653;
  const spreadRadius = 0.00035 + ((i * 19) % 100) * 0.000008;
  const latOffset = Math.sin(i * goldenAngle) * spreadRadius;
  const lngOffset = Math.cos(i * goldenAngle) * spreadRadius;
  const lat = isUnplaced ? undefined : Number((loc.baseLat + latOffset).toFixed(6));
  const lng = isUnplaced ? undefined : Number((loc.baseLng + lngOffset).toFixed(6));

  const sourceTypes: CameraSourceType[] = [
    'cctv_rtsp',
    'cctv_rtsp',
    'cctv_onvif',
    'cctv_rtsp',
    'mobile_webrtc',
    'mobile_rtmp',
    'usb_webcam',
    'file_upload',
  ];
  const sourceType = sourceTypes[i % sourceTypes.length];
  const floor = isUnplaced ? undefined : loc.floor;
  const bitrateKbps = isOffline ? 0 : isDegraded ? 1200 : (i % 4 === 0 ? 8192 : 4096);

  const health: CameraHealth = {
    lastSeenAt: new Date(Date.now() - (isOffline ? 14 * 60 * 1000 : 2000)).toISOString(),
    lastFrameAt: new Date(Date.now() - (isOffline ? 14 * 60 * 1000 : 1000)).toISOString(),
    fps: isOffline ? 0 : isDegraded ? 12 : 30,
    bitrate: bitrateKbps,
    packetLoss: isOffline ? 100 : isDegraded ? 6.8 : 0.1,
    latencyMs: isOffline ? 0 : isDegraded ? 340 : 42,
    reconnects: isDegraded ? 4 : 0,
    uptimePercentage: isOffline ? 88.4 : 99.8,
  };

  const status = deriveCameraStatus(health);

  // Backward compatibility for initial 5 mock cameras
  const legacyNames: Record<number, { name: string; locationName: string; zone: string; coords: [number, number] }> = {
    1: { name: 'CAM-01 Concourse North', locationName: 'North Station Metro - Main Turnstiles', zone: 'Zone A - Entrance', coords: [40.758896, -73.98513] },
    2: { name: 'CAM-02 Escalator Bank E', locationName: 'North Station Metro - Escalator Bank East', zone: 'Zone B - Transit Hub', coords: [40.7592, -73.9845] },
    3: { name: 'CAM-03 East Arcade Corridor', locationName: 'North Station - Shopping Arcade East', zone: 'Zone B - Commercial', coords: [40.7598, -73.9839] },
    4: { name: 'CAM-04 Street Exit 2A', locationName: 'North Station - Street Exit 2A 42nd St', zone: 'Zone C - Perimeter', coords: [40.7605, -73.9832] },
    5: { name: 'CAM-05 Riverwalk Plaza North', locationName: 'Riverwalk Esplanade North', zone: 'Zone D - Waterfront', coords: [40.7615, -73.982] },
  };

  const legacy = legacyNames[i];

  return {
    id,
    cameraId: id,
    cameraCode: code,
    name: legacy ? legacy.name : `${code}: ${loc.name} N${((i % 16) + 1)}`,
    locationName: isUnplaced ? 'Unassigned Asset' : (legacy ? legacy.locationName : loc.name),
    siteId: isUnplaced ? 'site_unplaced' : loc.id,
    siteName: isUnplaced ? 'Unassigned Fleet' : loc.name,
    zone: isUnplaced ? 'Field Mobile Units' : (legacy ? legacy.zone : `Zone ${String.fromCharCode(65 + (i % 5))} - Floor ${floor}`),
    status,
    sourceType,
    peopleCount: isOffline ? 0 : Math.floor(((i * 7) % 38) + 3),
    fps: health.fps,
    bitrateKbps,
    resolution: i % 4 === 0 ? '3840x2160 (4K)' : '1920x1080 (FHD)',
    coords: isUnplaced ? (undefined as any) : (legacy ? legacy.coords : [lat!, lng!]),
    latitude: isUnplaced ? undefined : (legacy ? legacy.coords[0] : lat),
    longitude: isUnplaced ? undefined : (legacy ? legacy.coords[1] : lng),
    lastPing: isOffline ? '14m ago' : '1s ago',
    rtspUrl: `rtsp://edge${String((i % 4) + 1).padStart(2, '0')}.sentinel.internal:554/live/${id}`,
    thumbnailUrl: CAMERA_THUMBNAILS[i % CAMERA_THUMBNAILS.length],
    heading: (i * 47) % 360,
    fovDegrees: ([60, 75, 90] as const)[i % 3],
    range: 25 + (i % 6) * 5,
    floor,
    indoor: isUnplaced ? false : loc.indoor,
    activeDetections: (!isOffline && (i % 7 === 0 || i <= 3)) ? Math.floor((i % 3) + 1) : 0,
    aiPolicy: {
      enabled: i % 5 !== 0,
      sampleFps: 2.0,
      minDetectionConf: 0.65,
      activeHours: '24/7',
    },
    recordPolicy: {
      mode: (['continuous', 'motion', 'continuous', 'event_only'] as const)[i % 4],
      segmentSec: 15,
      retentionDays: 30,
      quality: 'original',
    },
    authorization: {
      consentConfirmed: true,
      authorizedBy: 'admin@sentinel.gov',
      authorizedAt: '2026-09-01T00:00:00Z',
      purpose: 'Surveillance & Public Safety Monitoring',
      legalBasisNote: 'Statutory Authority Chapter 14B',
    },
    health,
    deviceInfo: sourceType === 'mobile_webrtc' || sourceType === 'mobile_rtmp' ? {
      userAgent: 'Officer-Bodycam-PWA/2.1 (Android 14; Pixel 8)',
      battery: 0.82,
      networkType: '5G',
    } : undefined,
  };
});

export const INITIAL_TOPOLOGY_TRANSITIONS: CameraTopologyTransition[] = [
  { fromCamera: 'cam_001', toCamera: 'cam_002', minTravelSec: 45, maxTravelSec: 180, distanceMeters: 85, isTwoWay: true, source: 'manual' },
  { fromCamera: 'cam_002', toCamera: 'cam_003', minTravelSec: 90, maxTravelSec: 320, distanceMeters: 175, isTwoWay: true, source: 'manual' },
  { fromCamera: 'cam_003', toCamera: 'cam_004', minTravelSec: 60, maxTravelSec: 240, distanceMeters: 120, isTwoWay: true, source: 'manual' },
  { fromCamera: 'cam_001', toCamera: 'cam_007', minTravelSec: 30, maxTravelSec: 150, distanceMeters: 65, isTwoWay: true, source: 'manual' },
  { fromCamera: 'cam_007', toCamera: 'cam_014', minTravelSec: 80, maxTravelSec: 280, distanceMeters: 140, isTwoWay: false, source: 'learned' },
  { fromCamera: 'cam_005', toCamera: 'cam_008', minTravelSec: 75, maxTravelSec: 250, distanceMeters: 130, isTwoWay: true, source: 'manual' },
  { fromCamera: 'cam_008', toCamera: 'cam_012', minTravelSec: 60, maxTravelSec: 220, distanceMeters: 110, isTwoWay: true, source: 'learned' },
  { fromCamera: 'cam_009', toCamera: 'cam_015', minTravelSec: 50, maxTravelSec: 190, distanceMeters: 95, isTwoWay: true, source: 'manual' },
  { fromCamera: 'cam_015', toCamera: 'cam_022', minTravelSec: 100, maxTravelSec: 350, distanceMeters: 210, isTwoWay: true, source: 'manual' },
  { fromCamera: 'cam_022', toCamera: 'cam_031', minTravelSec: 70, maxTravelSec: 260, distanceMeters: 150, isTwoWay: false, source: 'learned' },
  { fromCamera: 'cam_018', toCamera: 'cam_027', minTravelSec: 120, maxTravelSec: 420, distanceMeters: 280, isTwoWay: true, source: 'manual' },
  { fromCamera: 'cam_027', toCamera: 'cam_035', minTravelSec: 85, maxTravelSec: 300, distanceMeters: 165, isTwoWay: true, source: 'manual' },
];

// ==========================================
// 4. SIGHTINGS (CANDIDATES / POSSIBLE MATCHES)
// Wording: "possible match / possible sighting"
// Status: pending_review | confirmed_sighting | rejected | need_evidence
// ==========================================
export const INITIAL_SIGHTINGS: Sighting[] = [
  {
    id: 'sig_001',
    caseId: 'case_001',
    caseNumber: 'MP-2026-1042',
    personName: 'Maya Chen',
    cameraId: 'cam_001',
    cameraName: 'CAM-01 Concourse North',
    locationName: 'North Station Metro - Main Turnstiles',
    detectedAt: '2026-10-28T09:18:24Z',
    referenceThumbnailUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
    candidateFrameUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    faceScore: 0.93,
    reidScore: 0.89,
    temporalPlausibility: 0.98,
    cameraPlausibility: 0.95,
    fusedRank: 0.94,
    confidenceBand: 'high',
    displayLabel: 'Possible match',
    status: 'confirmed_sighting',
    reviewedBy: 'Insp. Sarah Vance',
    reviewedAt: '2026-10-28T09:30:00Z',
    reviewNotes: 'High facial landmark alignment; verified teal backpack and dark hoodie.',
  },
  {
    id: 'sig_002',
    caseId: 'case_001',
    caseNumber: 'MP-2026-1042',
    personName: 'Maya Chen',
    cameraId: 'cam_002',
    cameraName: 'CAM-02 Escalator Bank E',
    locationName: 'North Station Metro - Escalator Bank East',
    detectedAt: '2026-10-28T09:22:45Z',
    referenceThumbnailUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
    candidateFrameUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=300&q=80',
    faceScore: 0.88,
    reidScore: 0.91,
    temporalPlausibility: 0.95,
    cameraPlausibility: 0.96,
    fusedRank: 0.91,
    confidenceBand: 'high',
    displayLabel: 'Possible match',
    status: 'confirmed_sighting',
    reviewedBy: 'Insp. Sarah Vance',
    reviewedAt: '2026-10-28T09:35:00Z',
    reviewNotes: 'Clear 3/4 left profile matches reference ref_mc_03.',
  },
  {
    id: 'sig_003',
    caseId: 'case_001',
    caseNumber: 'MP-2026-1042',
    personName: 'Maya Chen',
    cameraId: 'cam_003',
    cameraName: 'CAM-03 East Arcade Corridor',
    locationName: 'North Station - Shopping Arcade East',
    detectedAt: '2026-10-28T09:28:10Z',
    referenceThumbnailUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
    candidateFrameUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
    faceScore: 0.81,
    reidScore: 0.85,
    temporalPlausibility: 0.92,
    cameraPlausibility: 0.90,
    fusedRank: 0.84,
    confidenceBand: 'high',
    displayLabel: 'Possible match',
    status: 'pending_review',
  },
  {
    id: 'sig_004',
    caseId: 'case_001',
    caseNumber: 'MP-2026-1042',
    personName: 'Maya Chen',
    cameraId: 'cam_004',
    cameraName: 'CAM-04 Street Exit 2A',
    locationName: 'North Station - Street Exit 2A 42nd St',
    detectedAt: '2026-10-28T09:35:12Z',
    referenceThumbnailUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
    candidateFrameUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    faceScore: 0.64,
    reidScore: 0.76,
    temporalPlausibility: 0.88,
    cameraPlausibility: 0.84,
    fusedRank: 0.74,
    confidenceBand: 'medium',
    displayLabel: 'Possible match',
    status: 'pending_review',
  },
  // Leo Torres Sightings (Case 002)
  {
    id: 'sig_005',
    caseId: 'case_002',
    caseNumber: 'MP-2026-0988',
    personName: 'Leo Torres',
    cameraId: 'cam_005',
    cameraName: 'CAM-05 Riverwalk Plaza North',
    locationName: 'Riverwalk Esplanade North',
    detectedAt: '2026-10-28T14:52:10Z',
    referenceThumbnailUrl: 'https://images.unsplash.com/photo-1485546246426-74dc88dec4d9?auto=format&fit=crop&w=300&q=80',
    candidateFrameUrl: 'https://images.unsplash.com/photo-1471286174890-9c112ffca564?auto=format&fit=crop&w=300&q=80',
    faceScore: 0.89,
    reidScore: 0.92,
    temporalPlausibility: 0.96,
    cameraPlausibility: 0.94,
    fusedRank: 0.91,
    confidenceBand: 'high',
    displayLabel: 'Possible match',
    status: 'pending_review',
  },
  {
    id: 'sig_006',
    caseId: 'case_002',
    caseNumber: 'MP-2026-0988',
    personName: 'Leo Torres',
    cameraId: 'cam_002',
    cameraName: 'CAM-02 Escalator Bank E',
    locationName: 'North Station Metro - Escalator Bank East',
    detectedAt: '2026-10-28T15:20:00Z',
    referenceThumbnailUrl: 'https://images.unsplash.com/photo-1485546246426-74dc88dec4d9?auto=format&fit=crop&w=300&q=80',
    candidateFrameUrl: 'https://images.unsplash.com/photo-1485546246426-74dc88dec4d9?auto=format&fit=crop&w=300&q=80',
    faceScore: 0.54,
    reidScore: 0.62,
    temporalPlausibility: 0.40,
    cameraPlausibility: 0.50,
    fusedRank: 0.52,
    confidenceBand: 'low',
    displayLabel: 'Possible match',
    status: 'rejected',
    reviewedBy: 'Det. Marcus Brody',
    reviewedAt: '2026-10-28T15:35:00Z',
    rejectReasonCode: 'different_person',
    reviewNotes: 'Adult subject in background falsely triggered trigger window.',
  },
  {
    id: 'sig_007',
    caseId: 'case_003',
    caseNumber: 'MP-2026-0841',
    personName: 'David Vance',
    cameraId: 'cam_001',
    cameraName: 'CAM-01 Concourse North',
    locationName: 'North Station Metro - Main Turnstiles',
    detectedAt: '2026-10-28T07:45:00Z',
    referenceThumbnailUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
    candidateFrameUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
    faceScore: 0.85,
    reidScore: 0.87,
    temporalPlausibility: 0.94,
    cameraPlausibility: 0.92,
    fusedRank: 0.88,
    confidenceBand: 'high',
    displayLabel: 'Possible match',
    status: 'pending_review',
  },
  {
    id: 'sig_008',
    caseId: 'case_004',
    caseNumber: 'MP-2026-1102',
    personName: 'Priya Sharma',
    cameraId: 'cam_003',
    cameraName: 'CAM-03 East Arcade Corridor',
    locationName: 'North Station - Shopping Arcade East',
    detectedAt: '2026-10-28T08:12:00Z',
    referenceThumbnailUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
    candidateFrameUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
    faceScore: 0.78,
    reidScore: 0.80,
    temporalPlausibility: 0.86,
    cameraPlausibility: 0.85,
    fusedRank: 0.81,
    confidenceBand: 'medium',
    displayLabel: 'Possible match',
    status: 'need_evidence',
    reviewedBy: 'Det. Marcus Brody',
    reviewedAt: '2026-10-28T08:30:00Z',
    reviewNotes: 'Heavy shadow on lower face; need adjacent angle crop from CAM-02.',
  },
];

// ==========================================
// 5. DETAILED JOURNEYS (A, B, C variants)
// ==========================================
export const INITIAL_DETAILED_JOURNEYS: Record<string, DetailedJourney[]> = {
  case_001: [
    {
      journeyId: 'A',
      caseId: 'case_001',
      caseNumber: 'MP-2026-1042',
      personName: 'Maya Chen',
      label: 'Journey A - Best Path (Turnstiles → Arcade → Street 2A)',
      totalDistanceMeters: 420,
      durationMinutes: 17,
      firstSeenAt: '2026-10-28T09:18:24Z',
      lastSeenAt: '2026-10-28T09:35:12Z',
      confidence: 0.89,
      lowestConfidence: 0.74,
      diffSummary: 'Best path through concourse turnstiles to 42nd St exit',
      hopsCount: 4,
      confirmedCount: 2,
      possibleCount: 2,
      hops: [
        {
          hopNumber: 1,
          sightingId: 'sig_001',
          cameraId: 'cam_001',
          cameraName: 'CAM-01 Concourse North',
          zone: 'Zone A - Entrance',
          coords: [40.758896, -73.98513],
          timestamp: '2026-10-28T09:18:24Z',
          dwellTimeSeconds: 45,
          status: 'confirmed',
          verified: true,
          scores: { face: 0.93, reid: 0.89, temporal: 0.98, cameraPlausibility: 0.95, fused: 0.94 },
          thumbnails: {
            referenceUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
            cctvCropUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
            faceDetected: true,
            qualityScore: 94,
          },
          trackId: 'TRK-10492',
          direction: 'Northeast toward Escalators',
          reviewInfo: { reviewedBy: 'Insp. Sarah Vance', reviewedAt: '2026-10-28T09:30:00Z', notes: 'Confirmed' },
          transition: { elapsedSeconds: 0, distanceMeters: 0, speedMps: 0, plausibility: 'plausible' },
        },
        {
          hopNumber: 2,
          sightingId: 'sig_002',
          cameraId: 'cam_002',
          cameraName: 'CAM-02 Escalator Bank E',
          zone: 'Zone B - Transit Hub',
          coords: [40.7592, -73.9845],
          timestamp: '2026-10-28T09:22:45Z',
          dwellTimeSeconds: 30,
          status: 'confirmed',
          verified: true,
          scores: { face: 0.88, reid: 0.91, temporal: 0.95, cameraPlausibility: 0.96, fused: 0.91 },
          thumbnails: {
            referenceUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
            cctvCropUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=300&q=80',
            faceDetected: true,
            qualityScore: 91,
          },
          trackId: 'TRK-10518',
          direction: 'East toward Arcade',
          reviewInfo: { reviewedBy: 'Insp. Sarah Vance', reviewedAt: '2026-10-28T09:35:00Z', notes: 'Confirmed' },
          transition: { elapsedSeconds: 261, distanceMeters: 85, speedMps: 0.92, plausibility: 'plausible' },
        },
        {
          hopNumber: 3,
          sightingId: 'sig_003',
          cameraId: 'cam_003',
          cameraName: 'CAM-03 East Arcade Corridor',
          zone: 'Zone B - Commercial',
          coords: [40.7598, -73.9839],
          timestamp: '2026-10-28T09:28:10Z',
          dwellTimeSeconds: 60,
          status: 'possible',
          verified: false,
          scores: { face: 0.81, reid: 0.85, temporal: 0.92, cameraPlausibility: 0.90, fused: 0.84 },
          thumbnails: {
            referenceUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
            cctvCropUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
            faceDetected: true,
            qualityScore: 88,
          },
          trackId: 'TRK-10560',
          direction: 'North toward Street 2A',
          reviewInfo: {},
          transition: { elapsedSeconds: 325, distanceMeters: 110, speedMps: 1.05, plausibility: 'plausible' },
        },
        {
          hopNumber: 4,
          sightingId: 'sig_004',
          cameraId: 'cam_004',
          cameraName: 'CAM-04 Street Exit 2A',
          zone: 'Zone C - Perimeter',
          coords: [40.7605, -73.9832],
          timestamp: '2026-10-28T09:35:12Z',
          dwellTimeSeconds: 20,
          status: 'possible',
          verified: false,
          scores: { face: 0.64, reid: 0.76, temporal: 0.88, cameraPlausibility: 0.84, fused: 0.74 },
          thumbnails: {
            referenceUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
            cctvCropUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
            faceDetected: true,
            qualityScore: 78,
          },
          trackId: 'TRK-10604',
          direction: 'Exited street stairs to 42nd St',
          reviewInfo: {},
          transition: { elapsedSeconds: 422, distanceMeters: 135, speedMps: 0.98, plausibility: 'plausible' },
        },
      ],
      reachableArea: {
        center: [-73.9832, 40.7605],
        radiusMeters: 750,
        maxRadiusMeters: 3000,
        walkingSpeedMps: 1.2,
        elapsedMinutes: 38,
        label: 'Estimated reachable area (not a confirmed position)',
      },
      suggestedCameras: [
        {
          cameraId: 'cam_005',
          name: 'CAM-05 Riverwalk Plaza North',
          coords: [40.7615, -73.982],
          distanceMeters: 310,
          expectedArrivalWindowMin: '5-8 min',
        },
      ],
    },
    {
      journeyId: 'B',
      caseId: 'case_001',
      caseNumber: 'MP-2026-1042',
      personName: 'Maya Chen',
      label: 'Journey B - East Bus Terminal Divergence',
      totalDistanceMeters: 380,
      durationMinutes: 14,
      firstSeenAt: '2026-10-28T09:18:24Z',
      lastSeenAt: '2026-10-28T09:32:00Z',
      confidence: 0.82,
      lowestConfidence: 0.80,
      diffSummary: 'Diverges at Hop 3 toward East Bus Terminal bays',
      hopsCount: 2,
      confirmedCount: 2,
      possibleCount: 0,
      hops: [
        // Hops 1-2 identical, Hop 3 diverges toward Bus Terminal
        {
          hopNumber: 1,
          sightingId: 'sig_001',
          cameraId: 'cam_001',
          cameraName: 'CAM-01 Concourse North',
          zone: 'Zone A - Entrance',
          coords: [40.758896, -73.98513],
          timestamp: '2026-10-28T09:18:24Z',
          dwellTimeSeconds: 45,
          status: 'confirmed',
          verified: true,
          scores: { face: 0.93, reid: 0.89, temporal: 0.98, cameraPlausibility: 0.95, fused: 0.94 },
          thumbnails: {
            referenceUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
            cctvCropUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
            faceDetected: true,
            qualityScore: 94,
          },
          trackId: 'TRK-10492',
          direction: 'Northeast toward Escalators',
          reviewInfo: { reviewedBy: 'Insp. Sarah Vance', reviewedAt: '2026-10-28T09:30:00Z' },
          transition: { elapsedSeconds: 0, distanceMeters: 0, speedMps: 0, plausibility: 'plausible' },
        },
        {
          hopNumber: 2,
          sightingId: 'sig_002',
          cameraId: 'cam_002',
          cameraName: 'CAM-02 Escalator Bank E',
          zone: 'Zone B - Transit Hub',
          coords: [40.7592, -73.9845],
          timestamp: '2026-10-28T09:22:45Z',
          dwellTimeSeconds: 30,
          status: 'confirmed',
          verified: true,
          scores: { face: 0.88, reid: 0.91, temporal: 0.95, cameraPlausibility: 0.96, fused: 0.91 },
          thumbnails: {
            referenceUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
            cctvCropUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=300&q=80',
            faceDetected: true,
            qualityScore: 91,
          },
          trackId: 'TRK-10518',
          direction: 'South toward Bus Bays',
          reviewInfo: { reviewedBy: 'Insp. Sarah Vance', reviewedAt: '2026-10-28T09:35:00Z' },
          transition: { elapsedSeconds: 261, distanceMeters: 85, speedMps: 0.92, plausibility: 'plausible' },
        },
      ],
      reachableArea: {
        center: [-73.9845, 40.7592],
        radiusMeters: 850,
        maxRadiusMeters: 3000,
        walkingSpeedMps: 1.2,
        elapsedMinutes: 42,
        label: 'Estimated reachable area (not a confirmed position)',
      },
      suggestedCameras: [],
    },
  ],
};

// ==========================================
// 6. SEARCH JOBS
// ==========================================
export const INITIAL_SEARCH_JOBS: SearchJob[] = [
  {
    id: 'job_001',
    caseId: 'case_001',
    caseTitle: 'Disappearance of Maya Chen',
    referencePhotoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
    status: 'completed',
    progressPercent: 100,
    candidatesFound: 4,
    cameraScopeCount: 16,
    timeRangeHours: 12,
    minConfidence: 0.70,
    startedAt: '2026-10-28T09:16:00Z',
    completedAt: '2026-10-28T09:18:00Z',
  },
  {
    id: 'job_002',
    caseId: 'case_002',
    caseTitle: 'Missing Child: Leo Torres',
    referencePhotoUrl: 'https://images.unsplash.com/photo-1485546246426-74dc88dec4d9?auto=format&fit=crop&w=300&q=80',
    status: 'extracting_features',
    progressPercent: 68,
    candidatesFound: 2,
    cameraScopeCount: 24,
    timeRangeHours: 6,
    minConfidence: 0.65,
    startedAt: '2026-10-28T15:15:00Z',
  },
  {
    id: 'job_003',
    caseId: 'case_003',
    caseTitle: 'Silver Alert: David Vance',
    referencePhotoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
    status: 'completed',
    progressPercent: 100,
    candidatesFound: 1,
    cameraScopeCount: 8,
    timeRangeHours: 4,
    minConfidence: 0.75,
    startedAt: '2026-10-28T09:05:00Z',
    completedAt: '2026-10-28T09:07:00Z',
  },
];

// ==========================================
// 7. HARD NEGATIVES & AUDIT TRAIL
// ==========================================
export interface HardNegative {
  id: string;
  caseId: string;
  cropUrl: string;
  rejectedBy: string;
  rejectedAt: string;
  reasonCode: string;
  similarityToRef: number;
}

export const INITIAL_HARD_NEGATIVES: HardNegative[] = [
  {
    id: 'hn_001',
    caseId: 'case_002',
    cropUrl: 'https://images.unsplash.com/photo-1485546246426-74dc88dec4d9?auto=format&fit=crop&w=300&q=80',
    rejectedBy: 'Det. Marcus Brody',
    rejectedAt: '2026-10-28T15:35:00Z',
    reasonCode: 'different_person',
    similarityToRef: 0.62,
  },
];

export interface AuditEntry {
  id: string;
  timestamp: string;
  caseId?: string;
  actor: string;
  action: string;
  details: string;
}

export const INITIAL_AUDIT_TRAIL: AuditEntry[] = [
  {
    id: 'aud_001',
    timestamp: '2026-10-28T09:35:00Z',
    caseId: 'case_001',
    actor: 'Insp. Sarah Vance',
    action: 'DECISION_CONFIRMED',
    details: 'Confirmed sighting sig_002 at CAM-02 Escalator Bank E (fused score: 0.91)',
  },
  {
    id: 'aud_002',
    timestamp: '2026-10-28T09:30:00Z',
    caseId: 'case_001',
    actor: 'Insp. Sarah Vance',
    action: 'DECISION_CONFIRMED',
    details: 'Confirmed sighting sig_001 at CAM-01 Concourse North (fused score: 0.94)',
  },
  {
    id: 'aud_003',
    timestamp: '2026-10-28T09:16:00Z',
    caseId: 'case_001',
    actor: 'Insp. Sarah Vance',
    action: 'SEARCH_TRIGGERED',
    details: 'AI Search Job job_001 initiated across 16 perimeter cameras',
  },
];

// ==========================================
// 8. REACTIVE DATABASE STORE & SELECTORS
// ==========================================

interface UndoItem {
  token: string;
  sightingId: string;
  prevStatus: Sighting['status'];
  prevNotes?: string;
  prevReviewer?: string;
  prevReviewedAt?: string;
  prevRejectReason?: string;
  expiresAt: number;
}

interface DbStoreState {
  cases: Case[];
  cameras: Camera[];
  cameraTopology: CameraTopologyTransition[];
  topologyVersion: number;
  sightings: Sighting[];
  detailedJourneys: Record<string, DetailedJourney[]>;
  searches: SearchJob[];
  hardNegatives: HardNegative[];
  auditTrail: AuditEntry[];
  undoStack: UndoItem[];

  // Mutators
  recordDecision: (params: {
    sightingId: string;
    decision: 'confirmed_sighting' | 'rejected' | 'need_evidence';
    reasonCode?: string;
    notes?: string;
    checklist?: string[];
    actor?: string;
  }) => { undoToken: string; success: boolean };

  undoDecision: (undoToken: string) => boolean;

  createSearchJob: (job: Omit<SearchJob, 'id' | 'startedAt'>) => SearchJob;

  addCandidateToJourney: (sightingId: string, journeyId?: string) => void;

  dismissCandidate: (sightingId: string, reason?: string) => void;

  addCase: (caseData: Case) => void;
  updateCase: (id: string, patch: Partial<Case>) => void;

  // Camera & Topology mutators
  addTopologyTransition: (transition: CameraTopologyTransition) => void;
  updateTopologyTransition: (transition: CameraTopologyTransition) => void;
  deleteTopologyTransition: (fromCamera: string, toCamera: string) => void;
  placeCamera: (cameraId: string, coords: [number, number], heading?: number, fov?: number) => void;
  updateCamera: (id: string, patch: Partial<Camera>) => void;
  addCamera: (camera: Camera) => void;
  deleteCamera: (id: string) => void;
  bulkUpdateAiPolicy: (cameraIds: string[], enabled: boolean) => void;
}

export const useDbStore = create<DbStoreState>()(
  devtools(
    (set, get) => ({
      cases: INITIAL_CASES,
      cameras: INITIAL_CAMERAS,
      cameraTopology: INITIAL_TOPOLOGY_TRANSITIONS,
      topologyVersion: 1,
      sightings: INITIAL_SIGHTINGS,
      detailedJourneys: INITIAL_DETAILED_JOURNEYS,
      searches: INITIAL_SEARCH_JOBS,
      hardNegatives: INITIAL_HARD_NEGATIVES,
      auditTrail: INITIAL_AUDIT_TRAIL,
      undoStack: [],

      recordDecision: ({ sightingId, decision, reasonCode, notes, checklist, actor = 'Insp. Sarah Vance' }) => {
        const sighting = get().sightings.find((s) => s.id === sightingId);
        if (!sighting) return { undoToken: '', success: false };

        const undoToken = 'undo_' + Math.random().toString(36).substring(2, 9);
        const undoItem: UndoItem = {
          token: undoToken,
          sightingId,
          prevStatus: sighting.status,
          prevNotes: sighting.reviewNotes,
          prevReviewer: sighting.reviewedBy,
          prevReviewedAt: sighting.reviewedAt,
          prevRejectReason: sighting.rejectReasonCode,
          expiresAt: Date.now() + 10_000, // 10s undo window
        };

        const nowIso = new Date().toISOString();

        // 1. Update sighting status
        set((state) => ({
          sightings: state.sightings.map((s) =>
            s.id === sightingId
              ? {
                  ...s,
                  status: decision,
                  reviewedBy: actor,
                  reviewedAt: nowIso,
                  reviewNotes: notes || (checklist && checklist.length ? `Verified: ${checklist.join(', ')}` : s.reviewNotes),
                  rejectReasonCode: reasonCode,
                }
              : s,
          ),
          undoStack: [...state.undoStack.filter((u) => u.expiresAt > Date.now()), undoItem],
        }));

        // 2. Synchronize Journey node status and re-calculate segment styles
        const targetCaseId = sighting.caseId;
        const currentJourneys = get().detailedJourneys[targetCaseId] || [];

        const updatedJourneys = currentJourneys.map((j) => {
          const updatedHops = j.hops.map((hop: DetailedHopNode) => {
            if (hop.sightingId === sightingId) {
              const newHopStatus =
                decision === 'confirmed_sighting'
                  ? ('confirmed' as const)
                  : decision === 'rejected'
                  ? ('rejected' as const)
                  : ('possible' as const);
              return {
                ...hop,
                status: newHopStatus,
                verified: decision === 'confirmed_sighting',
                reviewInfo: {
                  reviewedBy: actor,
                  reviewedAt: nowIso,
                  notes: notes,
                },
              };
            }
            return hop;
          });
          return {
            ...j,
            hops: updatedHops,
            confirmedCount: updatedHops.filter((h) => h.status === 'confirmed').length,
            possibleCount: updatedHops.filter((h) => h.status === 'possible').length,
          };
        });

        // 3. If rejected, add to hard negatives
        let newHardNegatives = get().hardNegatives;
        if (decision === 'rejected') {
          const hn: HardNegative = {
            id: 'hn_' + Date.now(),
            caseId: targetCaseId,
            cropUrl: sighting.candidateFrameUrl,
            rejectedBy: actor,
            rejectedAt: nowIso,
            reasonCode: reasonCode || 'different_person',
            similarityToRef: sighting.fusedRank,
          };
          newHardNegatives = [hn, ...newHardNegatives];
        }

        // 4. Record Audit log
        const auditAction =
          decision === 'confirmed_sighting'
            ? 'DECISION_CONFIRMED'
            : decision === 'rejected'
            ? 'DECISION_REJECTED'
            : 'DECISION_NEED_EVIDENCE';

        const auditEntry: AuditEntry = {
          id: 'aud_' + Date.now(),
          timestamp: nowIso,
          caseId: targetCaseId,
          actor,
          action: auditAction,
          details: `${decision === 'confirmed_sighting' ? 'Confirmed' : decision === 'rejected' ? 'Rejected' : 'Flagged need evidence for'} sighting ${sightingId} at ${sighting.cameraName} (Score: ${sighting.fusedRank})`,
        };

        set((state) => ({
          detailedJourneys: {
            ...state.detailedJourneys,
            [targetCaseId]: updatedJourneys,
          },
          hardNegatives: newHardNegatives,
          auditTrail: [auditEntry, ...state.auditTrail],
        }));

        return { undoToken, success: true };
      },

      undoDecision: (undoToken: string) => {
        const item = get().undoStack.find((u) => u.token === undoToken);
        if (!item) return false;

        set((state) => ({
          sightings: state.sightings.map((s) =>
            s.id === item.sightingId
              ? {
                  ...s,
                  status: item.prevStatus,
                  reviewedBy: item.prevReviewer,
                  reviewedAt: item.prevReviewedAt,
                  reviewNotes: item.prevNotes,
                  rejectReasonCode: item.prevRejectReason,
                }
              : s,
          ),
          undoStack: state.undoStack.filter((u) => u.token !== undoToken),
        }));

        return true;
      },

      createSearchJob: (jobData) => {
        const newJob: SearchJob = {
          ...jobData,
          id: 'job_' + Date.now(),
          startedAt: new Date().toISOString(),
          status: 'extracting_features',
          progressPercent: 15,
          candidatesFound: 0,
        };
        set((state) => ({ searches: [newJob, ...state.searches] }));
        return newJob;
      },

      addCandidateToJourney: (sightingId, journeyId = 'A') => {
        const sighting = get().sightings.find((s) => s.id === sightingId);
        if (!sighting) return;

        const targetCaseId = sighting.caseId;
        const journeys = get().detailedJourneys[targetCaseId] || [];
        const journey = journeys.find((j) => j.journeyId === journeyId) || journeys[0];
        if (!journey) return;

        // Create new hop node
        const newHopNumber = journey.hops.length + 1;
        const newHop: DetailedHopNode = {
          hopNumber: newHopNumber,
          sightingId: sighting.id,
          cameraId: sighting.cameraId,
          cameraName: sighting.cameraName,
          zone: sighting.locationName,
          coords: [40.7605, -73.9832], // fallback or lookup
          timestamp: sighting.detectedAt,
          dwellTimeSeconds: 30,
          status: sighting.status === 'confirmed_sighting' ? 'confirmed' : 'possible',
          verified: sighting.status === 'confirmed_sighting',
          scores: {
            face: sighting.faceScore,
            reid: sighting.reidScore,
            temporal: sighting.temporalPlausibility,
            cameraPlausibility: sighting.cameraPlausibility,
            fused: sighting.fusedRank,
          },
          thumbnails: {
            referenceUrl: sighting.referenceThumbnailUrl,
            cctvCropUrl: sighting.candidateFrameUrl,
            faceDetected: sighting.faceScore > 0,
            qualityScore: Math.round(sighting.fusedRank * 100),
          },
          trackId: 'TRK-NEW-' + sighting.id.slice(-4),
          direction: 'Surveillance sequence',
          reviewInfo: {
            reviewedBy: sighting.reviewedBy,
            reviewedAt: sighting.reviewedAt,
            notes: sighting.reviewNotes,
          },
          transition: {
            elapsedSeconds: 300,
            distanceMeters: 100,
            speedMps: 1.0,
            plausibility: 'plausible',
          },
          isNew: true,
        };

        const updatedJourneys = journeys.map((j) =>
          j.journeyId === journey.journeyId ? { ...j, hops: [...j.hops, newHop], hopsCount: j.hops.length + 1 } : j,
        );

        set((state) => ({
          detailedJourneys: {
            ...state.detailedJourneys,
            [targetCaseId]: updatedJourneys,
          },
        }));
      },

      dismissCandidate: (sightingId, reason = 'dismissed') => {
        get().recordDecision({
          sightingId,
          decision: 'rejected',
          reasonCode: reason,
        });
      },

      addCase: (caseData) => set((s) => ({ cases: [caseData, ...s.cases] })),
      updateCase: (id, patch) =>
        set((s) => ({ cases: s.cases.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),

      addTopologyTransition: (transition) => {
        set((state) => ({
          cameraTopology: [...state.cameraTopology, transition],
          topologyVersion: state.topologyVersion + 1,
          auditTrail: [
            {
              id: 'aud_' + Date.now(),
              timestamp: new Date().toISOString(),
              actor: 'Insp. Sarah Vance',
              action: 'TOPOLOGY_EDGE_ADDED',
              details: `Added transition ${transition.fromCamera} -> ${transition.toCamera} (${transition.minTravelSec}-${transition.maxTravelSec}s)`,
            },
            ...state.auditTrail,
          ],
        }));
      },

      updateTopologyTransition: (transition) => {
        set((state) => ({
          cameraTopology: state.cameraTopology.map((t) =>
            (t.fromCamera === transition.fromCamera && t.toCamera === transition.toCamera)
              ? transition
              : t,
          ),
          topologyVersion: state.topologyVersion + 1,
        }));
      },

      deleteTopologyTransition: (fromCamera, toCamera) => {
        set((state) => ({
          cameraTopology: state.cameraTopology.filter(
            (t) => !(t.fromCamera === fromCamera && t.toCamera === toCamera),
          ),
          topologyVersion: state.topologyVersion + 1,
          auditTrail: [
            {
              id: 'aud_' + Date.now(),
              timestamp: new Date().toISOString(),
              actor: 'Insp. Sarah Vance',
              action: 'TOPOLOGY_EDGE_REMOVED',
              details: `Removed transition ${fromCamera} -> ${toCamera}`,
            },
            ...state.auditTrail,
          ],
        }));
      },

      placeCamera: (cameraId, coords, heading = 0, fov = 75) => {
        set((state) => ({
          cameras: state.cameras.map((c) =>
            c.id === cameraId || c.cameraId === cameraId || c.cameraCode === cameraId
              ? {
                  ...c,
                  coords,
                  latitude: coords[0],
                  longitude: coords[1],
                  heading,
                  fovDegrees: fov,
                  locationName: c.locationName === 'Unassigned Asset' ? 'Placed Camera Location' : c.locationName,
                }
              : c,
          ),
          auditTrail: [
            {
              id: 'aud_' + Date.now(),
              timestamp: new Date().toISOString(),
              actor: 'Insp. Sarah Vance',
              action: 'CAMERA_GEO_PLACED',
              details: `Camera ${cameraId} placed at coords [${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}]`,
            },
            ...state.auditTrail,
          ],
        }));
      },

      updateCamera: (id, patch) => {
        set((state) => ({
          cameras: state.cameras.map((c) =>
            c.id === id || c.cameraId === id || c.cameraCode === id ? { ...c, ...patch } : c,
          ),
        }));
      },

      addCamera: (camera) => {
        set((state) => ({
          cameras: [camera, ...state.cameras],
          auditTrail: [
            {
              id: 'aud_' + Date.now(),
              timestamp: new Date().toISOString(),
              actor: 'Insp. Sarah Vance',
              action: 'CAMERA_REGISTERED',
              details: `Registered camera ${camera.cameraCode || camera.id} (${camera.name})`,
            },
            ...state.auditTrail,
          ],
        }));
      },

      deleteCamera: (id) => {
        set((state) => ({
          cameras: state.cameras.filter((c) => c.id !== id && c.cameraId !== id && c.cameraCode !== id),
          auditTrail: [
            {
              id: 'aud_' + Date.now(),
              timestamp: new Date().toISOString(),
              actor: 'Insp. Sarah Vance',
              action: 'CAMERA_DELETED',
              details: `Removed camera ${id} from fleet`,
            },
            ...state.auditTrail,
          ],
        }));
      },

      bulkUpdateAiPolicy: (cameraIds, enabled) => {
        set((state) => ({
          cameras: state.cameras.map((c) =>
            cameraIds.includes(c.id) || cameraIds.includes(c.cameraCode || '')
              ? {
                  ...c,
                  aiPolicy: {
                    ...(c.aiPolicy || { sampleFps: 2.0, minDetectionConf: 0.65 }),
                    enabled,
                  },
                }
              : c,
          ),
        }));
      },
    }),
    { name: 'SentinelMockDb' },
  ),
);

// ==========================================
// 9. SELECTORS (DERIVED STATS ONLY)
// Every count and list in the UI calls these selectors
// ==========================================

export const selectPendingReviewCount = (state: DbStoreState, caseId?: string): number => {
  return state.sightings.filter(
    (s) => s.status === 'pending_review' && (!caseId || s.caseId === caseId),
  ).length;
};

export const selectConfirmedSightingsCount = (state: DbStoreState, caseId?: string): number => {
  return state.sightings.filter(
    (s) => s.status === 'confirmed_sighting' && (!caseId || s.caseId === caseId),
  ).length;
};

export const selectRejectedSightingsCount = (state: DbStoreState, caseId?: string): number => {
  return state.sightings.filter(
    (s) => s.status === 'rejected' && (!caseId || s.caseId === caseId),
  ).length;
};

export const selectNeedsEvidenceCount = (state: DbStoreState, caseId?: string): number => {
  return state.sightings.filter(
    (s) => s.status === 'need_evidence' && (!caseId || s.caseId === caseId),
  ).length;
};

export const selectActiveCasesCount = (state: DbStoreState): number => {
  return state.cases.filter((c) => c.status === 'active').length;
};

export const selectCriticalCasesCount = (state: DbStoreState): number => {
  return state.cases.filter((c) => c.priority === 'critical').length;
};

export const selectMinorCasesCount = (state: DbStoreState): number => {
  return state.cases.filter((c) => isMinorFromDob(c.lastSeenAt) || c.isMinor).length;
};

export const selectCaseById = (state: DbStoreState, caseId: string): Case | undefined => {
  return state.cases.find((c) => c.id === caseId || c.caseNumber === caseId);
};

export const selectCases = (
  state: DbStoreState,
  filters?: {
    status?: string;
    priority?: string;
    q?: string;
    minorOnly?: boolean;
    sort?: string;
  },
): Case[] => {
  return state.cases.filter((c) => {
    if (filters?.status && filters.status !== 'all' && c.status !== filters.status) {
      return false;
    }
    if (filters?.priority && filters.priority !== 'all' && c.priority !== filters.priority) {
      return false;
    }
    if (filters?.minorOnly && !c.isMinor && !isMinorFromDob(c.lastSeenAt)) {
      return false;
    }
    if (filters?.q) {
      const q = filters.q.toLowerCase();
      const match =
        c.personName.toLowerCase().includes(q) ||
        c.caseNumber.toLowerCase().includes(q) ||
        c.lastSeenLocation.toLowerCase().includes(q) ||
        (c.registrationAuth?.authority?.firOrCaseNumber || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });
};

export const selectSightingsByCase = (
  state: DbStoreState,
  caseId: string,
  statusFilter?: string,
): Sighting[] => {
  return state.sightings.filter(
    (s) => s.caseId === caseId && (!statusFilter || statusFilter === 'all' || s.status === statusFilter),
  );
};

export const selectQueueSightings = (
  state: DbStoreState,
  filters?: {
    caseId?: string;
    status?: string;
    conf?: string;
    camera?: string;
  },
): Sighting[] => {
  return state.sightings
    .filter((s) => {
      if (filters?.caseId && s.caseId !== filters.caseId) return false;
      if (filters?.status && filters.status !== 'all' && s.status !== filters.status) return false;
      if (filters?.conf && filters.conf !== 'all' && s.confidenceBand !== filters.conf) return false;
      if (filters?.camera && filters.camera !== 'all' && s.cameraId !== filters.camera) return false;
      return true;
    })
    .sort((a, b) => b.fusedRank - a.fusedRank);
};

export const selectSightingById = (state: DbStoreState, sightingId: string): Sighting | undefined => {
  return state.sightings.find((s) => s.id === sightingId);
};

export const selectJourneysByCase = (state: DbStoreState, caseId: string): DetailedJourney[] => {
  return state.detailedJourneys[caseId] || [];
};

export const selectSearchesByCase = (state: DbStoreState, caseId: string): SearchJob[] => {
  return state.searches.filter((s) => s.caseId === caseId);
};

export const selectReferencesByCase = (state: DbStoreState, caseId: string): ReferencePhoto[] => {
  const c = state.cases.find((item) => item.id === caseId || item.caseNumber === caseId);
  return c?.referencePhotos || [];
};

export const selectHardNegatives = (state: DbStoreState, caseId: string): HardNegative[] => {
  return state.hardNegatives.filter((hn) => hn.caseId === caseId);
};

export const selectAuditTrail = (state: DbStoreState, caseId?: string): AuditEntry[] => {
  return state.auditTrail.filter((a) => !caseId || a.caseId === caseId);
};

export const selectReadiness = (
  state: DbStoreState,
  caseId: string,
): { score: number; recommendations: string[] } => {
  const c = state.cases.find((item) => item.id === caseId);
  if (!c) return { score: 0, recommendations: ['Case not found'] };

  const photos = c.referencePhotos || [];
  let score = 20; // baseline
  const recs: string[] = [];

  if (photos.length >= 1) score += 30;
  else recs.push('Add at least 1 high-resolution frontal face reference photo.');

  const hasBody = photos.some((p) => p.type.includes('body'));
  if (hasBody) score += 20;
  else recs.push('Add full-body photo for whole-person Re-ID matching.');

  const hasProfile = photos.some((p) => p.type.includes('profile'));
  if (hasProfile) score += 15;
  else recs.push('Add left or right profile angle for multi-camera cross-matching.');

  if (c.registrationAuth?.consent?.confirmed) score += 15;
  else recs.push('Record formal FIR/report authority authorization to verify consent.');

  return { score: Math.min(100, score), recommendations: recs };
};

// ==========================================
// 10. CAMERA SELECTORS (SHARED SOURCE OF TRUTH)
// ==========================================

export const selectCameras = (
  state: DbStoreState,
  filters?: {
    status?: string;
    siteId?: string;
    floor?: number | 'all';
    sourceType?: string;
    q?: string;
    aiOnly?: boolean;
    recordingOnly?: boolean;
    mobileOnly?: boolean;
  },
): Camera[] => {
  return state.cameras.filter((c) => {
    if (filters?.status && filters.status !== 'all' && c.status !== filters.status) return false;
    if (filters?.siteId && filters.siteId !== 'all' && c.siteId !== filters.siteId) return false;
    if (filters?.floor !== undefined && filters.floor !== 'all' && c.floor !== filters.floor) return false;
    if (filters?.sourceType && filters.sourceType !== 'all' && c.sourceType !== filters.sourceType) return false;
    if (filters?.aiOnly && !c.aiPolicy?.enabled) return false;
    if (filters?.recordingOnly && (!c.recordPolicy?.mode || c.recordPolicy.mode === 'off')) return false;
    if (filters?.mobileOnly && c.sourceType !== 'mobile_webrtc' && c.sourceType !== 'mobile_rtmp') return false;

    if (filters?.q) {
      const q = filters.q.toLowerCase();
      const match =
        (c.cameraCode || '').toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.locationName.toLowerCase().includes(q) ||
        c.zone.toLowerCase().includes(q) ||
        (c.rtspUrl || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });
};

export const selectCameraById = (state: DbStoreState, idOrCode?: string): Camera | undefined => {
  if (!idOrCode) return undefined;
  return state.cameras.find((c) => c.id === idOrCode || c.cameraId === idOrCode || c.cameraCode === idOrCode);
};

export const selectTotalCamerasCount = (state: DbStoreState): number => state.cameras.length;

export const selectLiveCamerasCount = (state: DbStoreState): number => {
  return state.cameras.filter((c) => c.status === 'live').length;
};

export const selectDegradedCamerasCount = (state: DbStoreState): number => {
  return state.cameras.filter((c) => c.status === 'degraded').length;
};

export const selectOfflineCamerasCount = (state: DbStoreState): number => {
  return state.cameras.filter((c) => c.status === 'offline').length;
};

export const selectUnplacedCameras = (state: DbStoreState): Camera[] => {
  return state.cameras.filter((c) => !c.coords || c.coords[0] === 0 || typeof c.latitude !== 'number');
};

export const selectSites = (state: DbStoreState): { id: string; name: string; count: number }[] => {
  const map = new Map<string, { id: string; name: string; count: number }>();
  state.cameras.forEach((c) => {
    if (c.siteId && c.siteId !== 'site_unplaced') {
      const existing = map.get(c.siteId);
      if (existing) {
        existing.count++;
      } else {
        map.set(c.siteId, { id: c.siteId, name: c.siteName || c.locationName, count: 1 });
      }
    }
  });
  return Array.from(map.values());
};

export const selectTopologyTransitions = (state: DbStoreState): CameraTopologyTransition[] => {
  return state.cameraTopology;
};

export const selectTopologyVersion = (state: DbStoreState): number => {
  return state.topologyVersion;
};
