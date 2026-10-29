import { Model } from 'mongoose';
import { SightingDocument } from '../sightings/schemas/sighting.schema';
import { CaseDocument } from '../cases/schemas/case.schema';
import { CameraDocument } from '../cameras/schemas/camera.schema';
import { resolveOffset } from './time-offsets';

export async function seedSightings(
  sightingModel: Model<SightingDocument>,
  caseModel: Model<CaseDocument>,
  cameraModel: Model<CameraDocument>,
  options: { reset?: boolean } = {},
) {
  if (options.reset) {
    await sightingModel.deleteMany({ seed: true });
  }

  const case1 = await caseModel.findOne({ caseNumber: 'MP-2026-0891' });
  const case2 = await caseModel.findOne({ caseNumber: 'MP-2026-1042' });
  const case3 = await caseModel.findOne({ caseNumber: 'MP-2026-1038' });

  if (!case1 || !case2 || !case3) {
    throw new Error('Cannot seed sightings: prerequisite cases MP-2026-0891, MP-2026-1042, MP-2026-1038 not found.');
  }

  const cam001 = await cameraModel.findOne({ cameraCode: 'CAM-001' }) || { longitude: 78.4867, latitude: 17.3850 };
  const cam002 = await cameraModel.findOne({ cameraCode: 'CAM-002' }) || { longitude: 78.4891, latitude: 17.3872 };
  const cam003 = await cameraModel.findOne({ cameraCode: 'CAM-003' }) || { longitude: 78.4842, latitude: 17.3831 };
  const cam005 = await cameraModel.findOne({ cameraCode: 'CAM-005' }) || { longitude: 78.4855, latitude: 17.3812 };
  const cam007 = await cameraModel.findOne({ cameraCode: 'CAM-007' }) || { longitude: 78.4905, latitude: 17.3868 };
  const cam012 = await cameraModel.findOne({ cameraCode: 'CAM-012' }) || { longitude: 78.4880, latitude: 17.3860 };
  const cam024 = await cameraModel.findOne({ cameraCode: 'CAM-024' }) || { longitude: 78.4870, latitude: 17.3855 };

  const rawSightings = [
    {
      seedKey: 'sight_01',
      id: 'sight_01',
      caseId: case1._id.toString(),
      caseNumber: case1.caseNumber,
      personName: case1.personName,
      cameraId: 'CAM-003',
      cameraLocation: 'Terminal 2 Arrivals — Corridor B',
      location: { type: 'Point', coordinates: [cam003.longitude, cam003.latitude] },
      coordinates: [cam003.longitude, cam003.latitude],
      timestampOffset: '-1h15m',
      confidence: 'high',
      faceScore: 0.89,
      reidScore: 0.86,
      temporalScore: 0.95,
      cameraPlausibility: 0.98,
      fusedScore: 0.91,
      frameUrl: '/uploads/reference-photos/crop_cam003.svg',
      thumbnailUrl: '/uploads/reference-photos/crop_cam003.svg',
      referencePhotoUrl: case1.referencePhotos[0]?.url || '/uploads/reference-photos/ref_maya_lin_front.svg',
      bbox: [142, 98, 86, 194],
      status: 'confirmed',
      reviewNotes: 'Subject blue blazer and school skirt confirmed by parent',
      reviewedBy: 'Insp. Sarah Vance',
      reviewedAtOffset: '-1h',
      seed: true,
    },
    {
      seedKey: 'sight_02',
      id: 'sight_02',
      caseId: case1._id.toString(),
      caseNumber: case1.caseNumber,
      personName: case1.personName,
      cameraId: 'CAM-007',
      cameraLocation: 'East Escalators Corridor — Gate 4',
      location: { type: 'Point', coordinates: [cam007.longitude, cam007.latitude] },
      coordinates: [cam007.longitude, cam007.latitude],
      timestampOffset: '-55m',
      confidence: 'high',
      faceScore: 0.84,
      reidScore: 0.91,
      temporalScore: 0.92,
      cameraPlausibility: 0.94,
      fusedScore: 0.89,
      frameUrl: '/uploads/reference-photos/crop_cam007.svg',
      thumbnailUrl: '/uploads/reference-photos/crop_cam007.svg',
      referencePhotoUrl: case1.referencePhotos[0]?.url || '/uploads/reference-photos/ref_maya_lin_front.svg',
      bbox: [210, 115, 78, 180],
      status: 'confirmed',
      reviewNotes: 'Walking towards Metro Concourse turnstiles',
      reviewedBy: 'Insp. Sarah Vance',
      reviewedAtOffset: '-45m',
      seed: true,
    },
    {
      seedKey: 'sight_03',
      id: 'sight_03',
      caseId: case1._id.toString(),
      caseNumber: case1.caseNumber,
      personName: case1.personName,
      cameraId: 'CAM-001',
      cameraLocation: 'Metro Central Concourse — Turnstiles North',
      location: { type: 'Point', coordinates: [cam001.longitude, cam001.latitude] },
      coordinates: [cam001.longitude, cam001.latitude],
      timestampOffset: '-25m',
      confidence: 'medium',
      faceScore: 0.76,
      reidScore: 0.81,
      temporalScore: 0.88,
      cameraPlausibility: 0.90,
      fusedScore: 0.82,
      frameUrl: '/uploads/reference-photos/crop_cam001.svg',
      thumbnailUrl: '/uploads/reference-photos/crop_cam001.svg',
      referencePhotoUrl: case1.referencePhotos[0]?.url || '/uploads/reference-photos/ref_maya_lin_front.svg',
      bbox: [320, 140, 72, 165],
      status: 'pending',
      reviewNotes: '',
      reviewedBy: '',
      reviewedAtOffset: null,
      seed: true,
    },
    {
      seedKey: 'sight_04',
      id: 'sight_04',
      caseId: case1._id.toString(),
      caseNumber: case1.caseNumber,
      personName: case1.personName,
      cameraId: 'CAM-005',
      cameraLocation: 'South Bus Interchange — Platform 3',
      location: { type: 'Point', coordinates: [cam005.longitude, cam005.latitude] },
      coordinates: [cam005.longitude, cam005.latitude],
      timestampOffset: '-10m',
      confidence: 'medium',
      faceScore: 0.71,
      reidScore: 0.79,
      temporalScore: 0.85,
      cameraPlausibility: 0.89,
      fusedScore: 0.78,
      frameUrl: '/uploads/reference-photos/crop_cam005.svg',
      thumbnailUrl: '/uploads/reference-photos/crop_cam005.svg',
      referencePhotoUrl: case1.referencePhotos[0]?.url || '/uploads/reference-photos/ref_maya_lin_front.svg',
      bbox: [180, 105, 80, 185],
      status: 'pending',
      reviewNotes: '',
      reviewedBy: '',
      reviewedAtOffset: null,
      seed: true,
    },
    {
      seedKey: 'sight_05',
      id: 'sight_05',
      caseId: case2._id.toString(),
      caseNumber: case2.caseNumber,
      personName: case2.personName,
      cameraId: 'CAM-002',
      cameraLocation: 'Terminal 1 Departures — Gate 12',
      location: { type: 'Point', coordinates: [cam002.longitude, cam002.latitude] },
      coordinates: [cam002.longitude, cam002.latitude],
      timestampOffset: '-2h',
      confidence: 'high',
      faceScore: 0.93,
      reidScore: 0.88,
      temporalScore: 0.96,
      cameraPlausibility: 0.97,
      fusedScore: 0.93,
      frameUrl: '/uploads/reference-photos/crop_cam002.svg',
      thumbnailUrl: '/uploads/reference-photos/crop_cam002.svg',
      referencePhotoUrl: case2.referencePhotos[0]?.url || '/uploads/reference-photos/ref_maya_chen_front.svg',
      bbox: [110, 80, 95, 210],
      status: 'confirmed',
      reviewNotes: 'Yellow hoodie and purple backpack match reference descriptors',
      reviewedBy: 'Insp. Sarah Vance',
      reviewedAtOffset: '-1h45m',
      seed: true,
    },
    {
      seedKey: 'sight_06',
      id: 'sight_06',
      caseId: case1._id.toString(),
      caseNumber: case1.caseNumber,
      personName: case1.personName,
      cameraId: 'CAM-012',
      cameraLocation: 'Duty Free Promenade West',
      location: { type: 'Point', coordinates: [cam012.longitude, cam012.latitude] },
      coordinates: [cam012.longitude, cam012.latitude],
      timestampOffset: '-30m',
      confidence: 'low',
      faceScore: 0.52,
      reidScore: 0.61,
      temporalScore: 0.72,
      cameraPlausibility: 0.75,
      fusedScore: 0.58,
      frameUrl: '/uploads/reference-photos/crop_cam001.svg',
      thumbnailUrl: '/uploads/reference-photos/crop_cam001.svg',
      referencePhotoUrl: case1.referencePhotos[0]?.url || '/uploads/reference-photos/ref_maya_lin_front.svg',
      bbox: [150, 110, 60, 140],
      status: 'rejected',
      reviewNotes: 'Negative cluster — adult bystander with black jacket',
      reviewedBy: 'Officer Marcus Chen',
      reviewedAtOffset: '-20m',
      seed: true,
    },
    {
      seedKey: 'sight_07',
      id: 'sight_07',
      caseId: case3._id.toString(),
      caseNumber: case3.caseNumber,
      personName: case3.personName,
      cameraId: 'CAM-024',
      cameraLocation: 'East Escalators Corridor Level 2',
      location: { type: 'Point', coordinates: [cam024.longitude, cam024.latitude] },
      coordinates: [cam024.longitude, cam024.latitude],
      timestampOffset: '-4h',
      confidence: 'medium',
      faceScore: 0.71,
      reidScore: 0.73,
      temporalScore: 0.82,
      cameraPlausibility: 0.85,
      fusedScore: 0.74,
      frameUrl: '/uploads/reference-photos/crop_cam007.svg',
      thumbnailUrl: '/uploads/reference-photos/crop_cam007.svg',
      referencePhotoUrl: case3.referencePhotos[0]?.url || '/uploads/reference-photos/ref_david_kim_front.svg',
      bbox: [190, 130, 75, 170],
      status: 'need_evidence',
      reviewNotes: 'Face partially occluded by shadow, awaiting higher-res frame export',
      reviewedBy: 'Det. Marcus Brody',
      reviewedAtOffset: '-3h30m',
      seed: true,
    },
  ];

  const seededSightings = [];

  for (const s of rawSightings) {
    const doc = {
      ...s,
      timestamp: resolveOffset(s.timestampOffset),
      reviewedAt: s.reviewedAtOffset ? resolveOffset(s.reviewedAtOffset) : null,
    };

    const saved = await sightingModel.findOneAndUpdate(
      { id: s.id },
      { $set: doc },
      { upsert: true, new: true },
    );
    seededSightings.push(saved);
  }

  return { count: seededSightings.length, sightings: seededSightings };
}
