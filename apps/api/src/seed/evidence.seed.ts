import { Model } from 'mongoose';
import { EvidenceDocument } from '../evidence/schemas/evidence.schema';
import { SightingDocument } from '../sightings/schemas/sighting.schema';
import { createHash } from 'crypto';

export async function seedEvidence(
  evidenceModel: Model<EvidenceDocument>,
  sightingModel: Model<SightingDocument>,
  options: { reset?: boolean } = {},
) {
  if (options.reset) {
    await evidenceModel.deleteMany({ seed: true });
  }

  const sightings = await sightingModel.find({ status: { $in: ['confirmed', 'need_evidence'] } });

  const seededEvidence = [];
  let prevHash = 'GENESIS_00000000000000000000000000000000';

  for (let i = 0; i < sightings.length; i++) {
    const s = sightings[i];
    const evId = `ev_${s.id.replace('sight_', '')}`;
    const rawData = `${s.id}-${s.cameraId}-${s.timestamp}-${s.frameUrl}`;
    const sha256 = createHash('sha256').update(rawData).digest('hex');

    const entryHash = createHash('sha256')
      .update(prevHash + s.id + s.timestamp + 'INGEST_CONFIRMED')
      .digest('hex');

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
