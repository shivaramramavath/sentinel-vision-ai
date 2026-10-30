import { Model } from 'mongoose';
import { EvidenceDocument } from '../evidence/schemas/evidence.schema';
import { SightingDocument } from '../sightings/schemas/sighting.schema';
import { MediaAssetDocument } from '../common/storage/schemas/media-asset.schema';
import { createHash } from 'crypto';

export async function seedEvidence(
  evidenceModel: Model<EvidenceDocument>,
  sightingModel: Model<SightingDocument>,
  mediaAssetModel?: Model<MediaAssetDocument>,
  options: { reset?: boolean } = {},
) {
  const driver = (process.env.STORAGE_DRIVER || 'cloudinary') as 'cloudinary' | 'minio';
  const rootFolder = process.env.CLOUDINARY_ROOT_FOLDER || 'sentinel/dev';

  if (options.reset) {
    await evidenceModel.deleteMany({ seed: true });
  }

  const sightings = await sightingModel.find({ status: { $in: ['confirmed', 'need_evidence'] } });

  const seededEvidence = [];
  let prevHash = 'GENESIS_00000000000000000000000000000000';

  for (let i = 0; i < sightings.length; i++) {
    const s = sightings[i];
    const evId = `ev_${s.id.replace('sight_', '')}`;
    const frameAssetId = `ast_frame_${evId}`;
    const cropAssetId = `ast_crop_${evId}`;
    const framePublicId = `${rootFolder}/cases/${s.caseId}/evidence/${evId}`;
    const cropPublicId = `${rootFolder}/cases/${s.caseId}/crops/${evId}`;

    const rawData = `${s.id}-${s.cameraId}-${s.timestamp}-${s.frameUrl}`;
    const sha256 = createHash('sha256').update(rawData).digest('hex');

    const entryHash = createHash('sha256')
      .update(prevHash + s.id + s.timestamp + 'INGEST_CONFIRMED')
      .digest('hex');

    if (mediaAssetModel) {
      await mediaAssetModel.findOneAndUpdate(
        { publicId: framePublicId },
        {
          $set: {
            assetId: frameAssetId,
            provider: driver,
            publicId: framePublicId,
            version: 1,
            format: 'svg',
            bytes: 1420580 + i * 4020,
            sha256,
            width: 1920,
            height: 1080,
            deliveryType: 'authenticated',
            secureUrl: s.frameUrl,
            context: {
              caseId: s.caseId,
              evidenceId: evId,
              cameraId: s.cameraId,
              sightingId: s.id,
              kind: 'frame',
            },
            tags: ['evidence', 'frame', s.caseId, s.cameraId],
            legalHold: false,
            uploadedBy: 'system',
            status: 'active',
          },
        },
        { upsert: true, new: true },
      );

      await mediaAssetModel.findOneAndUpdate(
        { publicId: cropPublicId },
        {
          $set: {
            assetId: cropAssetId,
            provider: driver,
            publicId: cropPublicId,
            version: 1,
            format: 'svg',
            bytes: 65536,
            sha256,
            width: 256,
            height: 256,
            deliveryType: 'authenticated',
            secureUrl: s.thumbnailUrl,
            context: {
              caseId: s.caseId,
              evidenceId: evId,
              cameraId: s.cameraId,
              sightingId: s.id,
              kind: 'crop',
            },
            tags: ['evidence', 'crop', s.caseId, s.cameraId],
            legalHold: false,
            uploadedBy: 'system',
            status: 'active',
          },
        },
        { upsert: true, new: true },
      );
    }

    const doc = {
      seedKey: evId,
      id: evId,
      caseId: s.caseId,
      caseNumber: s.caseNumber,
      personName: s.personName,
      title: `Surveillance Evidence on ${s.cameraId}`,
      type: 'frame_snapshot',
      sightingId: s.id,
      cameraId: s.cameraId,
      cameraCode: s.cameraId,
      locationName: s.cameraLocation,
      frameUrl: s.frameUrl,
      cropUrl: s.thumbnailUrl,
      referenceImageUrl: s.referencePhotoUrl,
      mediaAssetId: frameAssetId,
      frameAssetId,
      cropAssetId,
      sha256Hash: sha256,
      sha256OriginalFrame: sha256,
      sha256Crop: sha256,
      integrityStatus: 'verified',
      isTampered: false,
      legalHold: false,
      fileSizeBytes: 1420580 + i * 4020,
      chainOfCustody: [
        {
          action: 'INGEST_CONFIRMED',
          actor: 'Sentinel AI Capture Engine v2.0',
          actorRole: 'System Pipeline',
          timestamp: s.timestamp,
          hash: entryHash,
          prevEntryHash: prevHash,
          notes: 'Camera frame snapshot ingested with SHA-256 validation proof',
          caseId: s.caseId,
        },
      ],
      capturedAt: s.timestamp,
      seed: true,
    };

    prevHash = entryHash;

    const saved = await evidenceModel.findOneAndUpdate(
      { id: evId },
      { $set: doc },
      { upsert: true, new: true },
    );
    seededEvidence.push(saved);
  }

  return { count: seededEvidence.length, evidence: seededEvidence };
}
