import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as argon2 from 'argon2';
import { User, UserDocument } from './users/schemas/user.schema';
import { Camera, CameraDocument } from './cameras/schemas/camera.schema';
import { CameraTopology, CameraTopologyDocument } from './cameras/schemas/camera-topology.schema';
import { Case, CaseDocument } from './cases/schemas/case.schema';
import { Sighting, SightingDocument } from './sightings/schemas/sighting.schema';
import { Evidence, EvidenceDocument } from './evidence/schemas/evidence.schema';
import { SystemReport, SystemReportDocument } from './reports/schemas/report.schema';
import { SystemAlert, SystemAlertDocument } from './alerts/schemas/alert.schema';
import { SearchJob, SearchJobDocument } from './search-jobs/schemas/search-job.schema';
import { createHash } from 'crypto';

const LOCATIONS = [
  { name: 'Metro Central Concourse', baseLat: 17.3850, baseLng: 78.4867 },
  { name: 'Terminal 1 Departures', baseLat: 17.3872, baseLng: 78.4891 },
  { name: 'Terminal 2 Arrivals', baseLat: 17.3831, baseLng: 78.4842 },
  { name: 'North Gate Security', baseLat: 17.3895, baseLng: 78.4878 },
  { name: 'South Bus Interchange', baseLat: 17.3812, baseLng: 78.4855 },
  { name: 'Duty Free Promenade', baseLat: 17.3861, baseLng: 78.4882 },
  { name: 'East Escalators Corridor', baseLat: 17.3868, baseLng: 78.4905 },
  { name: 'Baggage Reclaim Zone 4', baseLat: 17.3825, baseLng: 78.4830 },
];

async function seed() {
  console.log('🌱 Starting Sentinel Vision AI Database Seeding...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
  const cameraModel = app.get<Model<CameraDocument>>(getModelToken(Camera.name));
  const topologyModel = app.get<Model<CameraTopologyDocument>>(getModelToken(CameraTopology.name));
  const caseModel = app.get<Model<CaseDocument>>(getModelToken(Case.name));
  const sightingModel = app.get<Model<SightingDocument>>(getModelToken(Sighting.name));
  const evidenceModel = app.get<Model<EvidenceDocument>>(getModelToken(Evidence.name));
  const reportModel = app.get<Model<SystemReportDocument>>(getModelToken(SystemReport.name));
  const alertModel = app.get<Model<SystemAlertDocument>>(getModelToken(SystemAlert.name));
  const searchJobModel = app.get<Model<SearchJobDocument>>(getModelToken(SearchJob.name));

  // 1. Clear existing collections
  console.log('🧹 Purging old collections...');
  await Promise.all([
    userModel.deleteMany({}),
    cameraModel.deleteMany({}),
    topologyModel.deleteMany({}),
    caseModel.deleteMany({}),
    sightingModel.deleteMany({}),
    evidenceModel.deleteMany({}),
    reportModel.deleteMany({}),
    alertModel.deleteMany({}),
    searchJobModel.deleteMany({}),
  ]);

  // 2. Seed Users across all 4 RBAC Roles
  console.log('👤 Seeding RBAC users...');
  const superAdminPass = await argon2.hash('SuperAdmin@2026');
  const investigatorPass = await argon2.hash('Investigator@2026');
  const reviewerPass = await argon2.hash('Reviewer@2026');
  const viewerPass = await argon2.hash('Viewer@2026');

  const users = await userModel.create([
    {
      email: 'admin@sentinel.gov',
      passwordHash: superAdminPass,
      fullName: 'Chief Director Robert Vance',
      badgeNumber: 'SVT-001',
      role: 'Super Admin',
      active: true,
      department: 'Directorate of Command & Intelligence',
    },
    {
      email: 'sarah.vance@sentinel.gov',
      passwordHash: investigatorPass,
      fullName: 'Insp. Sarah Vance',
      badgeNumber: 'INV-4821',
      role: 'Investigator',
      active: true,
      department: 'Special Missing Persons Division',
    },
    {
      email: 'marcus.chen@sentinel.gov',
      passwordHash: reviewerPass,
      fullName: 'Officer Marcus Chen',
      badgeNumber: 'REV-9204',
      role: 'Reviewer',
      active: true,
      department: 'Biometric Verification Unit',
    },
    {
      email: 'viewer@sentinel.gov',
      passwordHash: viewerPass,
      fullName: 'Auditor James Kelly',
      badgeNumber: 'AUD-1002',
      role: 'Viewer',
      active: true,
      department: 'Judicial Oversight & Ethics Office',
    },
  ]);

  // 3. Seed 124 Cameras across 8 Surveillance Locations
  console.log('📹 Seeding 124 Cameras across 8 locations...');
  const cameraDocs = [];
  const totalCameras = 124;

  for (let i = 1; i <= totalCameras; i++) {
    const loc = LOCATIONS[(i - 1) % LOCATIONS.length];
    const camNum = String(i).padStart(3, '0');
    const cameraId = `cam_${camNum}`;
    const jitterLat = (Math.random() - 0.5) * 0.003;
    const jitterLng = (Math.random() - 0.5) * 0.003;
    const isOffline = i === 14 || i === 89;
    const isDegraded = i === 42 || i === 105;

    const lat = Number((loc.baseLat + jitterLat).toFixed(6));
    const lng = Number((loc.baseLng + jitterLng).toFixed(6));

    cameraDocs.push({
      id: cameraId,
      name: `CCTV ${camNum} — ${loc.name}`,
      locationName: loc.name,
      latitude: lat,
      longitude: lng,
      location: {
        type: 'Point',
        coordinates: [lng, lat],
      },
      headingDeg: (i * 47) % 360,
      fovDeg: [60, 75, 90][i % 3],
      rangeM: 25 + (i % 6) * 5,
      floor: (i % 3 === 0) ? -1 : (i % 2 === 0) ? 2 : 1,
      buildingId: `bld_${(i % 4) + 1}`,
      siteId: 'site_primary',
      status: isOffline ? 'OFFLINE' : isDegraded ? 'DEGRADED' : 'LIVE',
      streamUrl: `rtsp://stream.sentinel.internal:554/live/${cameraId}`,
      fps: isOffline ? 0 : 30,
      peopleCount: isOffline ? 0 : Math.floor(Math.random() * 25) + 3,
      zone: `Zone ${String.fromCharCode(65 + ((i - 1) % 6))}`,
    });
  }
  await cameraModel.insertMany(cameraDocs);

  // 4. Seed Camera Topology Adjacency List
  console.log('🕸️ Seeding Camera Topology adjacency list...');
  const topologyDocs = [];
  for (let i = 1; i < totalCameras; i++) {
    const fromCam = `cam_${String(i).padStart(3, '0')}`;
    const toCam = `cam_${String(i + 1).padStart(3, '0')}`;
    const travelSec = 45 + Math.floor(Math.random() * 90);
    topologyDocs.push({
      fromCamera: fromCam,
      toCamera: toCam,
      minTravelSec: travelSec - 20,
      maxTravelSec: travelSec + 60,
      distanceMeters: Math.floor(travelSec * 1.4),
    });
  }
  await topologyModel.insertMany(topologyDocs);

  // 5. Seed Cases
  console.log('📁 Seeding sample Missing Persons Cases...');
  const case1 = await caseModel.create({
    caseNumber: 'MP-2026-1042',
    title: 'Disappearance of Maya Chen',
    personName: 'Maya Chen',
    age: 14,
    gender: 'female',
    lastSeenLocation: 'Terminal 2 Arrivals, Metro Station',
    lastSeenAt: '2026-10-28T09:15:00Z',
    reportedAt: '2026-10-28T10:00:00Z',
    priority: 'critical',
    status: 'active',
    description: 'Separated from school excursion party near baggage carousel. Non-verbal, vulnerable.',
    lastSeenWearing: 'Bright yellow hoodie, dark jeans, white sneakers, purple canvas backpack',
    assignedOfficer: 'Insp. Sarah Vance',
    sightingsCount: 4,
    referencePhotos: [
      {
        id: 'ref_01',
        url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600',
        type: 'frontal',
        qualityScore: 0.98,
        uploadedAt: '2026-10-28T10:05:00Z',
        model_version: 'v1.0',
      },
      {
        id: 'ref_02',
        url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600',
        type: 'profile_right',
        qualityScore: 0.91,
        uploadedAt: '2026-10-28T10:07:00Z',
        model_version: 'v1.0',
      },
    ],
  });

  const case2 = await caseModel.create({
    caseNumber: 'MP-2026-1038',
    title: 'Search for David Kim',
    personName: 'David Kim',
    age: 72,
    gender: 'male',
    lastSeenLocation: 'Terminal 1 Departures, Check-in Hall B',
    lastSeenAt: '2026-10-27T18:30:00Z',
    reportedAt: '2026-10-27T19:00:00Z',
    priority: 'high',
    status: 'active',
    description: 'Elderly gentleman with mild memory impairment. Wandered away from gate waiting area.',
    lastSeenWearing: 'Navy blue windbreaker jacket, grey slacks, black walking cane',
    assignedOfficer: 'Insp. Sarah Vance',
    sightingsCount: 2,
    referencePhotos: [
      {
        id: 'ref_03',
        url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600',
        type: 'frontal',
        qualityScore: 0.95,
        uploadedAt: '2026-10-27T19:05:00Z',
        model_version: 'v1.0',
      },
    ],
  });

  const case3 = await caseModel.create({
    caseNumber: 'MP-2026-0994',
    title: 'Investigation: Elena Rostova',
    personName: 'Elena Rostova',
    age: 29,
    gender: 'female',
    lastSeenLocation: 'East Escalators Corridor, Level 3',
    lastSeenAt: '2026-10-26T14:10:00Z',
    reportedAt: '2026-10-26T15:00:00Z',
    priority: 'medium',
    status: 'resolved',
    description: 'Located safely at transit hotel with assistance from airport security.',
    lastSeenWearing: 'Olive green trench coat, black turtleneck',
    assignedOfficer: 'Officer Marcus Chen',
    sightingsCount: 3,
    referencePhotos: [],
  });

  // 6. Seed Sightings with Feature Space Separation & geo inheritance from cameras
  console.log('🎯 Seeding candidate sightings (with inherited camera geo and coordinates)...');
  const cam003 = cameraDocs.find((c) => c.id === 'cam_003')!;
  const cam007 = cameraDocs.find((c) => c.id === 'cam_007')!;
  const cam001 = cameraDocs.find((c) => c.id === 'cam_001')!;
  const cam005 = cameraDocs.find((c) => c.id === 'cam_005')!;
  const cam002 = cameraDocs.find((c) => c.id === 'cam_002')!;

  const sightings = await sightingModel.create([
    {
      id: 'sight_01',
      caseId: case1._id.toString(),
      caseNumber: case1.caseNumber,
      personName: case1.personName,
      cameraId: 'cam_003',
      cameraLocation: 'Terminal 2 Arrivals — Corridor B',
      location: {
        type: 'Point',
        coordinates: [cam003.longitude, cam003.latitude],
      },
      coordinates: [cam003.longitude, cam003.latitude],
      timestamp: '2026-10-28T09:22:15Z',
      confidence: 'high',
      faceScore: 0.89,
      reidScore: 0.86,
      temporalScore: 0.95,
      cameraPlausibility: 0.98,
      fusedScore: 0.91,
      frameUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300',
      referencePhotoUrl: case1.referencePhotos[0].url,
      bbox: [142, 98, 86, 194],
      status: 'confirmed',
      reviewNotes: 'Subject yellow hoodie and backpack confirmed by parent',
      reviewedBy: 'Insp. Sarah Vance',
      reviewedAt: '2026-10-28T10:15:00Z',
      model_version: 'v1.0',
    },
    {
      id: 'sight_02',
      caseId: case1._id.toString(),
      caseNumber: case1.caseNumber,
      personName: case1.personName,
      cameraId: 'cam_007',
      cameraLocation: 'East Escalators Corridor — Gate 4',
      location: {
        type: 'Point',
        coordinates: [cam007.longitude, cam007.latitude],
      },
      coordinates: [cam007.longitude, cam007.latitude],
      timestamp: '2026-10-28T09:34:40Z',
      confidence: 'high',
      faceScore: 0.84,
      reidScore: 0.91,
      temporalScore: 0.92,
      cameraPlausibility: 0.94,
      fusedScore: 0.89,
      frameUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300',
      referencePhotoUrl: case1.referencePhotos[0].url,
      bbox: [210, 115, 78, 180],
      status: 'confirmed',
      reviewNotes: 'Walking towards Metro Concourse with transit group',
      reviewedBy: 'Insp. Sarah Vance',
      reviewedAt: '2026-10-28T10:20:00Z',
      model_version: 'v1.0',
    },
    {
      id: 'sight_03',
      caseId: case1._id.toString(),
      caseNumber: case1.caseNumber,
      personName: case1.personName,
      cameraId: 'cam_001',
      cameraLocation: 'Metro Central Concourse — Turnstiles North',
      location: {
        type: 'Point',
        coordinates: [cam001.longitude, cam001.latitude],
      },
      coordinates: [cam001.longitude, cam001.latitude],
      timestamp: '2026-10-28T09:51:10Z',
      confidence: 'medium',
      faceScore: 0.76,
      reidScore: 0.81,
      temporalScore: 0.88,
      cameraPlausibility: 0.90,
      fusedScore: 0.82,
      frameUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300',
      referencePhotoUrl: case1.referencePhotos[0].url,
      bbox: [320, 140, 72, 165],
      status: 'pending',
      reviewNotes: '',
      reviewedBy: '',
      reviewedAt: null,
      model_version: 'v1.0',
    },
    {
      id: 'sight_04',
      caseId: case1._id.toString(),
      caseNumber: case1.caseNumber,
      personName: case1.personName,
      cameraId: 'cam_005',
      cameraLocation: 'South Bus Interchange — Platform 3',
      location: {
        type: 'Point',
        coordinates: [cam005.longitude, cam005.latitude],
      },
      coordinates: [cam005.longitude, cam005.latitude],
      timestamp: '2026-10-28T10:12:35Z',
      confidence: 'medium',
      faceScore: 0.71,
      reidScore: 0.79,
      temporalScore: 0.85,
      cameraPlausibility: 0.89,
      fusedScore: 0.78,
      frameUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300',
      referencePhotoUrl: case1.referencePhotos[0].url,
      bbox: [180, 105, 80, 185],
      status: 'pending',
      reviewNotes: '',
      reviewedBy: '',
      reviewedAt: null,
      model_version: 'v1.0',
    },
    {
      id: 'sight_05',
      caseId: case2._id.toString(),
      caseNumber: case2.caseNumber,
      personName: case2.personName,
      cameraId: 'cam_002',
      cameraLocation: 'Terminal 1 Departures — Gate 12',
      location: {
        type: 'Point',
        coordinates: [cam002.longitude, cam002.latitude],
      },
      coordinates: [cam002.longitude, cam002.latitude],
      timestamp: '2026-10-27T18:48:20Z',
      confidence: 'high',
      faceScore: 0.93,
      reidScore: 0.88,
      temporalScore: 0.96,
      cameraPlausibility: 0.97,
      fusedScore: 0.93,
      frameUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300',
      referencePhotoUrl: case2.referencePhotos[0].url,
      bbox: [110, 80, 95, 210],
      status: 'confirmed',
      reviewNotes: 'Subject cane visible in right hand',
      reviewedBy: 'Insp. Sarah Vance',
      reviewedAt: '2026-10-27T19:30:00Z',
      model_version: 'v1.0',
    },
  ]);

  // 7. Seed Evidence items with SHA-256 Proofs
  console.log('🔒 Seeding Evidence with cryptographic hash proofs...');
  for (const s of sightings) {
    const rawData = `${s.id}-${s.cameraId}-${s.timestamp}-${s.frameUrl}`;
    const hash = createHash('sha256').update(rawData).digest('hex');

    await evidenceModel.create({
      id: `ev_${s.id.replace('sight_', '')}`,
      caseId: s.caseId,
      sightingId: s.id,
      cameraId: s.cameraId,
      frameUrl: s.frameUrl,
      sha256Hash: hash,
      chainOfCustody: [
        {
          action: 'ingested',
          actor: 'Sentinel AI Capture Engine v2.0',
          timestamp: s.timestamp,
          hash: hash.substring(0, 32),
        },
        {
          action: 'reviewed_confirm',
          actor: 'System Evidence Vault',
          timestamp: new Date().toISOString(),
          hash,
        },
      ],
      capturedAt: s.timestamp,
      fileSizeBytes: 1420580,
    });
  }

  // 8. Seed Reports & Alerts
  console.log('📊 Seeding investigative reports and alerts...');
  await reportModel.create([
    {
      id: 'rep_1042_summary',
      caseId: case1._id.toString(),
      title: 'Missing Person Rapid Assessment: Maya Chen',
      type: 'investigation_summary',
      generatedBy: 'Insp. Sarah Vance',
      generatedAt: '2026-10-28T10:30:00Z',
      format: 'PDF',
      fileSize: '3.8 MB',
      downloadUrl: '/reports/rep_1042_summary/download',
    },
    {
      id: 'rep_1038_tracking',
      caseId: case2._id.toString(),
      title: 'Movement Trajectory Export: David Kim',
      type: 'movement_timeline',
      generatedBy: 'Insp. Sarah Vance',
      generatedAt: '2026-10-27T20:15:00Z',
      format: 'CSV',
      fileSize: '412 KB',
      downloadUrl: '/reports/rep_1038_tracking/download',
    },
  ]);

  await alertModel.create([
    {
      id: 'alt_01',
      type: 'high_confidence_match',
      title: 'High Confidence Match Detected',
      message: 'Possible match (89% fused score) detected for Maya Chen on Camera 007',
      timestamp: '2026-10-28T09:35:00Z',
      read: false,
      caseId: case1._id.toString(),
      sightingId: 'sight_02',
    },
    {
      id: 'alt_02',
      type: 'camera_offline',
      title: 'Camera Feed Disconnected',
      message: 'Camera cam_014 (Terminal 1 Departures) has gone offline',
      timestamp: '2026-10-28T08:12:00Z',
      read: true,
      caseId: null,
      sightingId: null,
    },
  ]);

  await searchJobModel.create([
    {
      id: 'job_active_1042',
      caseId: case1._id.toString(),
      caseTitle: case1.title,
      referencePhotoUrl: case1.referencePhotos[0].url,
      status: 'running',
      progressPercent: 68,
      candidatesFound: 4,
      cameraScopeCount: 124,
      timeRangeHours: 24,
      minConfidence: 0.75,
      startedAt: '2026-10-28T09:20:00Z',
    },
  ]);

  console.log('✅ Sentinel Vision AI database successfully seeded!');
  await app.close();
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
