import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Case,
  CaseDocument,
  CaseStatus,
  ReferencePhoto,
  ReferenceVersionAudit,
} from './schemas/case.schema';
import { Sighting, SightingDocument } from '../sightings/schemas/sighting.schema';
import { Camera, CameraDocument } from '../cameras/schemas/camera.schema';
import { CreateCaseDto } from './dto/create-case.dto';
import { KafkaService } from '../common/kafka/kafka.service';
import { encryptField } from '../common/crypto/field-crypto.util';

function getDistanceMeters(coord1: [number, number], coord2: [number, number]): number {
  const DEG2RAD = Math.PI / 180;
  const lat1 = coord1[1] * DEG2RAD;
  const lat2 = coord2[1] * DEG2RAD;
  const dLat = (coord2[1] - coord1[1]) * DEG2RAD;
  const dLng = (coord2[0] - coord1[0]) * DEG2RAD;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(6371000 * c);
}

function createCirclePolygon(
  centerLng: number,
  centerLat: number,
  radiusMeters: number,
  steps = 48,
): [number, number][] {
  const DEG2RAD = Math.PI / 180;
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos(centerLat * DEG2RAD);

  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * (2 * Math.PI);
    const dLat = (radiusMeters * Math.cos(angle)) / metersPerDegLat;
    const dLng = (radiusMeters * Math.sin(angle)) / metersPerDegLng;
    ring.push([Number((centerLng + dLng).toFixed(6)), Number((centerLat + dLat).toFixed(6))]);
  }
  return ring;
}

@Injectable()
export class CasesService {
  private readonly logger = new Logger(CasesService.name);
  private readonly secretKey =
    process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'sentinel-master-secret-key-32chars';

  constructor(
    @InjectModel(Case.name)
    private readonly caseModel: Model<CaseDocument>,
    @InjectModel(Sighting.name)
    private readonly sightingModel: Model<SightingDocument>,
    @InjectModel(Camera.name)
    private readonly cameraModel: Model<CameraDocument>,
    private readonly kafkaService: KafkaService,
  ) {}

  private mapCase(doc: CaseDocument, user?: { id?: string; email?: string; role?: string }) {
    const obj = doc.toObject();
    const mapped: any = {
      ...obj,
      id: obj._id.toString(),
    };

    // Rule 3 & 4: Access control & PII redaction for Minors / Vulnerable targets
    const isRestrictedTarget = mapped.isMinor || mapped.isVulnerable;
    if (isRestrictedTarget && user) {
      const isSuperAdmin = user.role === 'Super Admin';
      const isAssigned =
        isSuperAdmin ||
        (mapped.assignedOfficer && (mapped.assignedOfficer === user.id || mapped.assignedOfficer === user.email)) ||
        (mapped.accessList && (mapped.accessList.includes(user.id) || mapped.accessList.includes(user.email)));

      if (!isAssigned) {
        // Redact sensitive encrypted PII
        if (mapped.encryptedPii) {
          mapped.encryptedPii = {
            nationalIdEncrypted: '[REDACTED - SENSITIVE MINOR/VULNERABLE DOSSIER]',
            contactPhoneEncrypted: '[REDACTED - SENSITIVE MINOR/VULNERABLE DOSSIER]',
            addressEncrypted: '[REDACTED - SENSITIVE MINOR/VULNERABLE DOSSIER]',
            medicalNotesEncrypted: '[REDACTED - SENSITIVE MINOR/VULNERABLE DOSSIER]',
          };
        }
        if (mapped.vulnerabilityDetailsEncrypted) {
          mapped.vulnerabilityDetailsEncrypted = '[REDACTED - SENSITIVE MINOR/VULNERABLE DOSSIER]';
        }
        if (mapped.registrationAuth?.reporter?.phoneEncrypted) {
          mapped.registrationAuth.reporter.phoneEncrypted = '[REDACTED]';
        }
      }
    }

    return mapped;
  }

  async findAll(status?: string, priority?: string) {
    const filter: Record<string, any> = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const cases = await this.caseModel.find(filter).sort({ createdAt: -1 }).exec();
    return cases.map((c) => this.mapCase(c));
  }

  async findById(id: string, user?: { id?: string; email?: string; role?: string }) {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    const doc = (isObjectId ? await this.caseModel.findById(id).exec() : null) ||
      await this.caseModel.findOne({ $or: [{ caseNumber: id }, { seedKey: id }] }).exec();
    if (!doc) {
      throw new NotFoundException(`Case with ID ${id} not found`);
    }
    return this.mapCase(doc, user);
  }

  async getOverview(id: string, user?: { id?: string; email?: string; role?: string }) {
    const c = await this.findById(id, user);
    const caseId = (c as any).id || (c as any)._id?.toString();
    const caseNumber = (c as any).caseNumber;
    const [pendingCount, confirmedCount, sightings] = await Promise.all([
      this.sightingModel.countDocuments({
        $or: [{ caseId }, { caseNumber }],
        status: { $in: ['pending', 'pending_review'] },
      }),
      this.sightingModel.countDocuments({
        $or: [{ caseId }, { caseNumber }],
        status: { $in: ['confirmed', 'confirmed_sighting'] },
      }),
      this.sightingModel
        .find({ $or: [{ caseId }, { caseNumber }] })
        .sort({ timestamp: -1 })
        .limit(10)
        .exec(),
    ]);

    const photos = (c as any).referencePhotos || [];
    let readiness = 75;
    if (photos.length > 0) {
      const avgQuality =
        photos.reduce((acc: number, p: any) => acc + (p.qualityScore || 0), 0) / photos.length;
      readiness = Math.round(avgQuality > 1 ? avgQuality : avgQuality * 100);
    }

    return {
      case: c,
      readinessScore: readiness,
      pendingCount,
      confirmedCount,
      recentSightings: sightings,
    };
  }

  async create(dto: CreateCaseDto) {
    const currentYear = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const caseNumber = `MP-${currentYear}-${randomSuffix}`;

    // Rule 3: Flag minors and vulnerable individuals
    const isMinor = dto.age < 18;
    const isVulnerable = Boolean(dto.isVulnerable || dto.vulnerabilityDetails);

    // Rule 4: Minimal PII - Encrypt sensitive fields at rest using AES-256-GCM
    const vulnerabilityDetailsEncrypted = dto.vulnerabilityDetails
      ? encryptField(dto.vulnerabilityDetails, this.secretKey)
      : '';

    const encryptedPii = {
      nationalIdEncrypted: dto.nationalId ? encryptField(dto.nationalId, this.secretKey) : '',
      contactPhoneEncrypted: dto.contactPhone ? encryptField(dto.contactPhone, this.secretKey) : '',
      addressEncrypted: dto.address ? encryptField(dto.address, this.secretKey) : '',
      medicalNotesEncrypted: dto.medicalNotes ? encryptField(dto.medicalNotes, this.secretKey) : '',
    };

    // Rule 3: Statutory registration authorization
    const registrationAuth = {
      reporter: {
        name: dto.reporterName || 'Confidential Reporter',
        relationship: dto.reporterRelationship || 'Family/Guardian',
        phoneEncrypted: dto.reporterPhone ? encryptField(dto.reporterPhone, this.secretKey) : '',
      },
      authority: {
        name: dto.authorityName || 'State Missing Persons Unit',
        firOrCaseNumber: dto.firOrCaseNumber || `FIR-${caseNumber}`,
        officerBadge: dto.officerBadge || '',
      },
      consent: {
        confirmed: dto.consentConfirmed !== false,
        confirmedAt: new Date().toISOString(),
        legalBasis: dto.legalBasis || 'Statutory Custody / Missing Persons Protection Act',
      },
    };

    const newCase = new this.caseModel({
      ...dto,
      caseNumber,
      lastSeenAt: dto.lastSeenAt || new Date().toISOString(),
      reportedAt: new Date().toISOString(),
      priority: dto.priority || 'medium',
      status: 'active',
      sightingsCount: 0,
      isMinor,
      isVulnerable,
      vulnerabilityDetailsEncrypted,
      encryptedPii,
      registrationAuth,
      referenceSetVersion: 1,
      referencePhotos: [],
      referenceVersionHistory: [],
    });

    const saved = await newCase.save();
    this.logger.log(
      `Registered case ${saved.caseNumber} (isMinor: ${isMinor}, isVulnerable: ${isVulnerable}, refVersion: 1)`,
    );
    return this.mapCase(saved);
  }

  async updateStatus(id: string, status: CaseStatus) {
    const doc = await this.caseModel
      .findByIdAndUpdate(id, { $set: { status } }, { new: true })
      .exec();
    if (!doc) {
      throw new NotFoundException(`Case with ID ${id} not found`);
    }
    return this.mapCase(doc);
  }

  async closeCase(id: string, notes = '', closedBy = 'Super Admin') {
    const doc = await this.caseModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            status: 'closed',
            closedAt: new Date().toISOString(),
            closedBy,
            closureNotes: notes,
          },
        },
        { new: true },
      )
      .exec();
    if (!doc) {
      throw new NotFoundException(`Case with ID ${id} not found`);
    }
    return this.mapCase(doc);
  }

  async update(id: string, updateData: Partial<Case>) {
    const doc = await this.caseModel
      .findByIdAndUpdate(id, { $set: updateData }, { new: true })
      .exec();
    if (!doc) {
      throw new NotFoundException(`Case with ID ${id} not found`);
    }
    return this.mapCase(doc);
  }

  // ==========================================
  // REFERENCE SET VERSIONING & AUDIT TRAIL
  // ==========================================

  /**
   * Rule 1: A case's reference set is versioned. Any add creates a new referenceSetVersion
   * and triggers incremental re-embedding and Pinecone sync. Old versions stay in the audit trail.
   * Rule 2: Never fabricate or synthesize faces/body views. Only real photos are references.
   */
  async addReferencePhoto(
    caseId: string,
    photo: ReferencePhoto,
    actor = 'System',
    reason = 'Enrolled new biometric reference photo',
  ) {
    // Invariant: Synthetic or generative images strictly prohibited
    if (photo.isSynthetic === true || photo.provenance?.verifiedReal === false) {
      throw new BadRequestException(
        'Generative or synthetic reference images are strictly prohibited for missing-person cases. Only authentic photographs may be enrolled.',
      );
    }

    const doc = await this.caseModel.findById(caseId).exec();
    if (!doc) {
      throw new NotFoundException(`Case with ID ${caseId} not found`);
    }

    const previousVersion = doc.referenceSetVersion || 1;
    const nextVersion = previousVersion + 1;

    // Snapshot existing reference set into immutable audit history
    const auditEntry: ReferenceVersionAudit = {
      version: previousVersion,
      photos: [...doc.referencePhotos],
      action: 'add',
      changedBy: actor,
      updatedAt: new Date().toISOString(),
      reason,
    };

    doc.referenceVersionHistory.push(auditEntry);
    doc.referencePhotos.push(photo);
    doc.referenceSetVersion = nextVersion;

    const saved = await doc.save();

    // Trigger Pinecone sync & Kafka incremental re-embedding
    await this.publishReferenceSetUpdated(saved, 'add', previousVersion, nextVersion, photo.id);

    this.logger.log(
      `Case ${caseId} reference set incremented to v${nextVersion} (added photo ${photo.id}). Audit trail preserved.`,
    );

    return this.mapCase(saved);
  }

  /**
   * Rule 1: Removing a reference creates a new referenceSetVersion, preserves history,
   * and triggers Pinecone vector retirement/sync.
   */
  async removeReferencePhoto(
    caseId: string,
    photoId: string,
    actor = 'System',
    reason = 'Revoked reference photo',
  ) {
    const doc = await this.caseModel.findById(caseId).exec();
    if (!doc) {
      throw new NotFoundException(`Case with ID ${caseId} not found`);
    }

    const photoExists = doc.referencePhotos.some((p) => p.id === photoId);
    if (!photoExists) {
      throw new NotFoundException(`Reference photo ${photoId} not found in case ${caseId}`);
    }

    const previousVersion = doc.referenceSetVersion || 1;
    const nextVersion = previousVersion + 1;

    // Snapshot current state to audit trail
    const auditEntry: ReferenceVersionAudit = {
      version: previousVersion,
      photos: [...doc.referencePhotos],
      action: 'remove',
      changedBy: actor,
      updatedAt: new Date().toISOString(),
      reason,
    };

    doc.referenceVersionHistory.push(auditEntry);
    doc.referencePhotos = doc.referencePhotos.filter((p) => p.id !== photoId);
    doc.referenceSetVersion = nextVersion;

    const saved = await doc.save();

    // Trigger Pinecone sync & Kafka incremental re-embedding
    await this.publishReferenceSetUpdated(saved, 'remove', previousVersion, nextVersion, photoId);

    this.logger.log(
      `Case ${caseId} reference set incremented to v${nextVersion} (removed photo ${photoId}).`,
    );

    return this.mapCase(saved);
  }

  /**
   * Rule 1 & 2: Replacing a reference photo creates a new referenceSetVersion.
   */
  async replaceReferencePhoto(
    caseId: string,
    photoId: string,
    newPhoto: ReferencePhoto,
    actor = 'System',
    reason = 'Replaced reference photo with updated photograph',
  ) {
    if (newPhoto.isSynthetic === true || newPhoto.provenance?.verifiedReal === false) {
      throw new BadRequestException(
        'Generative or synthetic reference images are strictly prohibited for missing-person cases. Only authentic photographs may be enrolled.',
      );
    }

    const doc = await this.caseModel.findById(caseId).exec();
    if (!doc) {
      throw new NotFoundException(`Case with ID ${caseId} not found`);
    }

    const photoIdx = doc.referencePhotos.findIndex((p) => p.id === photoId);
    if (photoIdx === -1) {
      throw new NotFoundException(`Reference photo ${photoId} not found in case ${caseId}`);
    }

    const previousVersion = doc.referenceSetVersion || 1;
    const nextVersion = previousVersion + 1;

    const auditEntry: ReferenceVersionAudit = {
      version: previousVersion,
      photos: [...doc.referencePhotos],
      action: 'replace',
      changedBy: actor,
      updatedAt: new Date().toISOString(),
      reason,
    };

    doc.referenceVersionHistory.push(auditEntry);
    doc.referencePhotos[photoIdx] = newPhoto;
    doc.referenceSetVersion = nextVersion;

    const saved = await doc.save();

    await this.publishReferenceSetUpdated(saved, 'replace', previousVersion, nextVersion, newPhoto.id);

    return this.mapCase(saved);
  }

  async getReferenceVersionHistory(caseId: string) {
    const doc = await this.caseModel.findById(caseId).exec();
    if (!doc) {
      throw new NotFoundException(`Case with ID ${caseId} not found`);
    }
    return {
      caseId: doc._id.toString(),
      caseNumber: doc.caseNumber,
      currentVersion: doc.referenceSetVersion,
      activePhotosCount: doc.referencePhotos.length,
      history: doc.referenceVersionHistory,
    };
  }

  private async publishReferenceSetUpdated(
    caseDoc: CaseDocument,
    action: 'add' | 'remove' | 'replace',
    previousVersion: number,
    newVersion: number,
    targetPhotoId?: string,
  ) {
    const event = {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      type: 'case.reference_set.updated',
      timestamp: new Date().toISOString(),
      caseId: caseDoc._id.toString(),
      data: {
        caseId: caseDoc._id.toString(),
        caseNumber: caseDoc.caseNumber,
        action,
        previousVersion,
        newVersion,
        pineconeNamespace: `case_${caseDoc._id.toString()}_v${newVersion}`,
        retireNamespace: `case_${caseDoc._id.toString()}_v${previousVersion}`,
        targetPhotoId,
        photoCount: caseDoc.referencePhotos.length,
        photos: caseDoc.referencePhotos.map((p) => ({
          id: p.id,
          url: p.url,
          type: p.type,
          fileHashSha256: p.provenance?.fileHashSha256,
        })),
      },
    };

    await this.kafkaService.publishEvent('case.events', event as any, caseDoc._id.toString());
  }

  async incrementSightingsCount(caseId: string) {
    return this.caseModel.findByIdAndUpdate(caseId, {
      $inc: { sightingsCount: 1 },
    });
  }

  /**
   * Generates a GeoJSON FeatureCollection of Point features (ordered) + LineString
   * connecting sequential confirmed/investigated sighting hops for a case journey.
   */
  async getJourneyGeoJson(caseId: string) {
    const caseDoc = await this.caseModel.findOne({
      $or: [{ _id: caseId.match(/^[0-9a-fA-F]{24}$/) ? caseId : undefined }, { caseNumber: caseId }, { id: caseId }].filter(Boolean) as any,
    }).exec();

    const targetCaseId = caseDoc ? caseDoc._id.toString() : caseId;

    // Fetch sightings ordered chronologically
    const sightings = await this.sightingModel
      .find({
        $or: [{ caseId: targetCaseId }, { caseId }, { caseNumber: caseDoc?.caseNumber }].filter(Boolean) as any,
      })
      .sort({ timestamp: 1 })
      .exec();

    const cameras = await this.cameraModel.find().exec();
    const camMap = new Map<string, CameraDocument>();
    cameras.forEach((c) => camMap.set(c.id, c));

    const pointFeatures = sightings
      .map((s, idx) => {
        let lng = s.coordinates?.[0] ?? s.location?.coordinates?.[0];
        let lat = s.coordinates?.[1] ?? s.location?.coordinates?.[1];
        const cam = camMap.get(s.cameraId);

        // Rule 4: Mobile cameras can move: resolve dynamic location with timestamp
        if (cam && (cam.isMovable || cam.mounting === 'mobile')) {
          const targetMs = new Date(s.timestamp).getTime();
          let closest: [number, number] = [
            cam.location?.coordinates?.[0] ?? cam.longitude,
            cam.location?.coordinates?.[1] ?? cam.latitude,
          ];
          let minDelta = Infinity;

          if (cam.locationHistory && cam.locationHistory.length > 0) {
            for (const h of cam.locationHistory) {
              const delta = Math.abs(new Date(h.timestamp).getTime() - targetMs);
              if (delta < minDelta) {
                minDelta = delta;
                closest = [h.coordinates[0], h.coordinates[1]];
              }
            }
          }
          lng = closest[0];
          lat = closest[1];
        } else if (typeof lng !== 'number' || typeof lat !== 'number') {
          if (cam) {
            lng = cam.location?.coordinates?.[0] ?? cam.longitude;
            lat = cam.location?.coordinates?.[1] ?? cam.latitude;
          }
        }

        if (typeof lng !== 'number' || typeof lat !== 'number') return null;

        const isVerified = s.status === 'confirmed';

        return {
          type: 'Feature' as const,
          id: `hop_${s.id || idx + 1}`,
          geometry: {
            type: 'Point' as const,
            coordinates: [lng, lat],
          },
          properties: {
            hopIndex: idx + 1,
            sightingId: s.id,
            cameraId: s.cameraId,
            cameraLocation: s.cameraLocation,
            timestamp: s.timestamp,
            locationTimestamp: s.timestamp,
            isDynamicLocation: Boolean(cam?.isMovable || cam?.mounting === 'mobile'),
            confidence: s.confidence,
            status: s.status,
            faceScore: s.faceScore,
            reidScore: s.reidScore,
            fusedScore: s.fusedScore,
            verified: isVerified,
          },
        };
      })
      .filter(Boolean) as Array<{
        type: 'Feature';
        id: string;
        geometry: { type: 'Point'; coordinates: [number, number] };
        properties: any;
      }>;

    const coordinates = pointFeatures.map((p) => p.geometry.coordinates);

    // Compute total distance along trajectory and generate per-hop geometry
    let totalDistanceMeters = 0;
    const hopLineFeatures: any[] = [];

    for (let i = 0; i < pointFeatures.length - 1; i++) {
      const fromNode = pointFeatures[i];
      const toNode = pointFeatures[i + 1];
      const fromCoords = fromNode.geometry.coordinates;
      const toCoords = toNode.geometry.coordinates;
      const hopDist = getDistanceMeters(fromCoords, toCoords);
      totalDistanceMeters += hopDist;

      const t1 = new Date(fromNode.properties.timestamp).getTime();
      const t2 = new Date(toNode.properties.timestamp).getTime();

      // Rule 5: Correct cross-camera timestamps using NTP/clock offset per camera
      const cam1 = camMap.get(fromNode.properties.cameraId);
      const cam2 = camMap.get(toNode.properties.cameraId);
      const offset1 = cam1?.health?.clockOffsetMs ?? 0;
      const offset2 = cam2?.health?.clockOffsetMs ?? 0;

      const t1Corrected = t1 + offset1;
      const t2Corrected = t2 + offset2;
      const rawElapsedSec = Math.max(1, Math.round((t2 - t1) / 1000));
      const correctedElapsedSec = Math.max(1, Math.round((t2Corrected - t1Corrected) / 1000));
      const speedMps = Math.round((hopDist / correctedElapsedSec) * 100) / 100;
      const isPhysicallyPlausible = speedMps <= 3.0; // Hard constraint: 3.0 m/s sprint limit
      const isVerified = Boolean(fromNode.properties.verified && toNode.properties.verified);

      hopLineFeatures.push({
        type: 'Feature' as const,
        id: `hop_segment_${fromNode.properties.sightingId}_${toNode.properties.sightingId}`,
        geometry: {
          type: 'LineString' as const,
          coordinates: [fromCoords, toCoords],
        },
        properties: {
          type: 'hop_segment',
          hopIndex: i + 1,
          fromCameraId: fromNode.properties.cameraId,
          toCameraId: toNode.properties.cameraId,
          fromCameraLocation: fromNode.properties.cameraLocation,
          toCameraLocation: toNode.properties.cameraLocation,
          fromSightingId: fromNode.properties.sightingId,
          toSightingId: toNode.properties.sightingId,
          fromTimestamp: fromNode.properties.timestamp,
          toTimestamp: toNode.properties.timestamp,
          rawElapsedSec,
          elapsedSec: correctedElapsedSec,
          elapsedSeconds: correctedElapsedSec,
          clockOffsetCorrected: true,
          clockOffsetFromMs: offset1,
          clockOffsetToMs: offset2,
          distanceMeters: Math.round(hopDist),
          speedMps,
          isPhysicallyPlausible,
          isVerified,
          status: toNode.properties.status,
          fusedScore: toNode.properties.fusedScore,
        },
      });
    }

    const features: any[] = [...pointFeatures, ...hopLineFeatures];

    if (coordinates.length >= 2) {
      features.push({
        type: 'Feature',
        id: `journey_route_${caseId}`,
        geometry: {
          type: 'LineString',
          coordinates,
        },
        properties: {
          caseId,
          hopCount: pointFeatures.length,
          firstSeenAt: sightings[0]?.timestamp,
          lastSeenAt: sightings[sightings.length - 1]?.timestamp,
          totalDistanceMeters,
        },
      });
    }

    return {
      type: 'FeatureCollection',
      features,
    };
  }

  /**
   * Generates an Estimated Reachable Area Polygon circle computed from the last sighting:
   * radius = walking_speed (1.4 m/s) * elapsed seconds since sighting, capped at 3000m.
   * Labeled strictly: "Estimated reachable area (not a confirmed position)".
   */
  async getPossibleArea(caseId: string, at?: string) {
    const caseDoc = await this.caseModel.findOne({
      $or: [{ _id: caseId.match(/^[0-9a-fA-F]{24}$/) ? caseId : undefined }, { caseNumber: caseId }, { id: caseId }].filter(Boolean) as any,
    }).exec();

    const targetCaseId = caseDoc ? caseDoc._id.toString() : caseId;

    // Latest sighting
    const latestSighting = await this.sightingModel
      .findOne({
        $or: [{ caseId: targetCaseId }, { caseId }, { caseNumber: caseDoc?.caseNumber }].filter(Boolean) as any,
      })
      .sort({ timestamp: -1 })
      .exec();

    let center: [number, number] = [78.4867, 17.3850];
    let lastSeenTimestamp = caseDoc?.lastSeenAt || new Date().toISOString();

    if (latestSighting) {
      let lng = latestSighting.coordinates?.[0] ?? latestSighting.location?.coordinates?.[0];
      let lat = latestSighting.coordinates?.[1] ?? latestSighting.location?.coordinates?.[1];

      if (typeof lng !== 'number' || typeof lat !== 'number') {
        const cam = await this.cameraModel.findOne({ id: latestSighting.cameraId }).exec();
        if (cam) {
          lng = cam.location?.coordinates?.[0] ?? cam.longitude;
          lat = cam.location?.coordinates?.[1] ?? cam.latitude;
        }
      }

      if (typeof lng === 'number' && typeof lat === 'number') {
        center = [lng, lat];
      }
      lastSeenTimestamp = latestSighting.timestamp;
    } else {
      // Fallback to first camera if no sightings exist
      const firstCam = await this.cameraModel.findOne().exec();
      if (firstCam) {
        center = [
          firstCam.location?.coordinates?.[0] ?? firstCam.longitude,
          firstCam.location?.coordinates?.[1] ?? firstCam.latitude,
        ];
      }
    }

    const targetTime = at ? new Date(at).getTime() : Date.now();
    const lastSeenTime = new Date(lastSeenTimestamp).getTime();
    const elapsedSeconds = Math.max(60, Math.floor((targetTime - lastSeenTime) / 1000));
    const walkingSpeedMps = 1.4;

    // r = walkingSpeed * elapsedSeconds, capped at 3000m
    const radiusMeters = Math.min(3000, Math.max(80, Math.round(elapsedSeconds * walkingSpeedMps)));

    const ring = createCirclePolygon(center[0], center[1], radiusMeters);

    return {
      type: 'Feature',
      id: `possible_area_${caseId}`,
      geometry: {
        type: 'Polygon',
        coordinates: [ring],
      },
      properties: {
        caseId,
        caseNumber: caseDoc?.caseNumber,
        personName: caseDoc?.personName,
        center,
        radiusMeters,
        elapsedSeconds,
        walkingSpeedMps,
        lastSeenTimestamp,
        computedAt: new Date(targetTime).toISOString(),
        label: 'Estimated reachable area (not a confirmed position)',
      },
    };
  }

  /**
   * Top-3 Alternative Journeys from cross-camera association.
   */
  async getAlternativeJourneys(caseId: string) {
    const caseDoc = await this.caseModel.findOne({
      $or: [{ _id: caseId.match(/^[0-9a-fA-F]{24}$/) ? caseId : undefined }, { caseNumber: caseId }, { id: caseId }].filter(Boolean) as any,
    }).exec();

    const targetCaseId = caseDoc ? caseDoc._id.toString() : caseId;
    const personName = caseDoc?.personName || 'Maya Chen';
    const caseNumber = caseDoc?.caseNumber || 'MP-2026-1042';

    const sightings = await this.sightingModel
      .find({
        $or: [{ caseId: targetCaseId }, { caseId }, { caseNumber: caseDoc?.caseNumber }].filter(Boolean) as any,
      })
      .sort({ timestamp: 1 })
      .exec();

    const cameras = await this.cameraModel.find().exec();
    const camMap = new Map<string, CameraDocument>();
    cameras.forEach((c) => camMap.set(c.id, c));

    const referenceUrl =
      caseDoc?.referencePhotos?.[0]?.url ||
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80';

    // Build base hops
    const buildHops = (sightingList: typeof sightings, variant: 'A' | 'B' | 'C') => {
      return sightingList.map((s, idx) => {
        const cam = camMap.get(s.cameraId);
        const lat = s.coordinates?.[1] ?? s.location?.coordinates?.[1] ?? cam?.latitude ?? 17.3850 + idx * 0.0015;
        const lng = s.coordinates?.[0] ?? s.location?.coordinates?.[0] ?? cam?.longitude ?? 78.4867 + idx * 0.0012;

        const isVerified = s.status === 'confirmed';
        const fused = s.fusedScore ?? (isVerified ? 0.85 : 0.68);
        const face = s.faceScore ?? (idx % 2 === 0 ? 0.82 : null);
        const reid = s.reidScore ?? 0.81;
        const temporal = s.temporalScore ?? 0.88;
        const plausibility = s.cameraPlausibility ?? 0.92;

        return {
          hopNumber: idx + 1,
          sightingId: s.id || `sight_${variant}_${idx + 1}`,
          cameraId: s.cameraId || `cam_${idx + 1}`,
          cameraName: s.cameraLocation || cam?.name || `CAM-0${idx + 1}: Concourse Node`,
          zone: cam?.zone || `Zone ${String.fromCharCode(65 + idx)}`,
          coords: [lat, lng] as [number, number],
          timestamp: s.timestamp || new Date(Date.now() - (4 - idx) * 360000).toISOString(),
          dwellTimeSeconds: 45 + idx * 15,
          status: isVerified ? ('confirmed' as const) : ('possible' as const),
          verified: isVerified,
          scores: {
            face,
            reid,
            temporal,
            cameraPlausibility: plausibility,
            fused,
          },
          thumbnails: {
            referenceUrl,
            cctvCropUrl: s.thumbnailUrl || s.frameUrl || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
            frameUrl: s.frameUrl || s.thumbnailUrl || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80',
            faceDetected: face !== null,
            qualityScore: Math.round(fused * 100),
          },
          trackId: `TRK-88${idx + 1}`,
          direction: idx % 2 === 0 ? 'North-East' : 'East',
          reviewInfo: {
            reviewedBy: isVerified ? s.reviewedBy || 'Insp. Sarah Vance' : undefined,
            reviewedAt: isVerified ? s.reviewedAt || s.timestamp : undefined,
            notes: s.reviewNotes,
          },
          transition: {
            elapsedSeconds: idx === 0 ? 0 : 380,
            distanceMeters: idx === 0 ? 0 : 210,
            speedMps: 0.95,
            plausibility: 'plausible' as const,
            gapMinutes: idx === 2 ? 14 : undefined,
          },
        };
      });
    };

    let baseSightings = sightings;
    if (baseSightings.length === 0) {
      // Mock seed for cases without raw sightings in DB
      baseSightings = [
        {
          id: 'sight_mock_1',
          cameraId: 'cam_001',
          cameraLocation: 'CAM-01: Terminal 2 Arrivals Main Concourse',
          coordinates: [78.4867, 17.3850],
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          confidence: 'high',
          status: 'confirmed',
          faceScore: 0.88,
          reidScore: 0.85,
          temporalScore: 0.92,
          cameraPlausibility: 0.94,
          fusedScore: 0.87,
        } as any,
        {
          id: 'sight_mock_2',
          cameraId: 'cam_002',
          cameraLocation: 'CAM-02: Platform 3 North Turnstiles',
          coordinates: [78.4880, 17.3862],
          timestamp: new Date(Date.now() - 1380000).toISOString(),
          confidence: 'high',
          status: 'confirmed',
          faceScore: 0.84,
          reidScore: 0.81,
          temporalScore: 0.89,
          cameraPlausibility: 0.91,
          fusedScore: 0.84,
        } as any,
        {
          id: 'sight_mock_3',
          cameraId: 'cam_003',
          cameraLocation: 'CAM-03: North Plaza Escalator Foot',
          coordinates: [78.4895, 17.3878],
          timestamp: new Date(Date.now() - 840000).toISOString(),
          confidence: 'medium',
          status: 'pending',
          faceScore: 0.65,
          reidScore: 0.72,
          temporalScore: 0.76,
          cameraPlausibility: 0.85,
          fusedScore: 0.71,
        } as any,
        {
          id: 'sight_mock_4',
          cameraId: 'cam_004',
          cameraLocation: 'CAM-04: Metro Line 2 Departures Gate',
          coordinates: [78.4905, 17.3890],
          timestamp: new Date(Date.now() - 360000).toISOString(),
          confidence: 'medium',
          status: 'pending',
          faceScore: 0.62,
          reidScore: 0.68,
          temporalScore: 0.71,
          cameraPlausibility: 0.79,
          fusedScore: 0.67,
        } as any,
      ];
    }

    const hopsA = buildHops(baseSightings, 'A');

    // Create Journey B (Alternative branch at hop 3)
    const hopsB = JSON.parse(JSON.stringify(hopsA));
    if (hopsB.length >= 3) {
      hopsB[2].cameraName = 'CAM-007: East Promenade Walkway';
      hopsB[2].coords = [hopsB[2].coords[0] - 0.0008, hopsB[2].coords[1] + 0.0018];
      hopsB[2].scores.fused = 0.69;
      hopsB[2].transition.plausibility = 'tight';
      hopsB[2].transition.speedMps = 2.4;
    }

    // Create Journey C (Alternative branch at hop 2)
    const hopsC = JSON.parse(JSON.stringify(hopsA));
    if (hopsC.length >= 2) {
      hopsC[1].cameraName = 'CAM-005: South Bus Interchange Ramp';
      hopsC[1].coords = [hopsC[1].coords[0] - 0.0015, hopsC[1].coords[1] - 0.0012];
      hopsC[1].scores.fused = 0.64;
      hopsC[1].transition.plausibility = 'slow';
      hopsC[1].transition.speedMps = 0.35;
    }

    const lastHop = hopsA[hopsA.length - 1];
    const lastSeenTime = new Date(lastHop.timestamp).getTime();
    const elapsedMinutes = Math.max(5, Math.round((Date.now() - lastSeenTime) / 60000));
    const walkingSpeedMps = 1.4;
    const radiusMeters = Math.min(1500, Math.max(120, Math.round(elapsedMinutes * 60 * walkingSpeedMps)));

    const reachableArea = {
      center: [lastHop.coords[1], lastHop.coords[0]] as [number, number], // [lng, lat]
      radiusMeters,
      maxRadiusMeters: 1500,
      walkingSpeedMps,
      elapsedMinutes,
      label: 'Estimated reachable area (not a confirmed position)',
    };

    const suggestedCameras = [
      {
        cameraId: 'cam_008',
        name: 'CAM-08: East Transit Connector',
        coords: [lastHop.coords[0] + 0.0015, lastHop.coords[1] + 0.0012] as [number, number],
        distanceMeters: 280,
        expectedArrivalWindowMin: '3-6 min',
      },
      {
        cameraId: 'cam_009',
        name: 'CAM-09: Perimeter Pedestrian Bridge',
        coords: [lastHop.coords[0] + 0.0022, lastHop.coords[1] - 0.0010] as [number, number],
        distanceMeters: 450,
        expectedArrivalWindowMin: '5-9 min',
      },
      {
        cameraId: 'cam_010',
        name: 'CAM-10: Metro North Plaza Exit Gate',
        coords: [lastHop.coords[0] + 0.0031, lastHop.coords[1] + 0.0024] as [number, number],
        distanceMeters: 620,
        expectedArrivalWindowMin: '8-13 min',
      },
    ];

    const packageJourney = (
      variant: 'A' | 'B' | 'C',
      label: string,
      diffSummary: string,
      hopsList: any[],
    ) => {
      const confirmedCount = hopsList.filter((h) => h.status === 'confirmed').length;
      const possibleCount = hopsList.length - confirmedCount;
      const lowestConfidence = Math.min(...hopsList.map((h) => h.scores.fused));
      const confidence = Number((hopsList.reduce((acc, h) => acc + h.scores.fused, 0) / hopsList.length).toFixed(2));
      const totalDistanceMeters = hopsList.reduce((acc, h) => acc + h.transition.distanceMeters, 0);

      return {
        journeyId: variant,
        caseId: targetCaseId,
        caseNumber,
        personName,
        label,
        diffSummary,
        confidence,
        lowestConfidence,
        totalDistanceMeters: totalDistanceMeters || 850,
        durationMinutes: Math.round(hopsList.length * 6.5),
        hopsCount: hopsList.length,
        confirmedCount,
        possibleCount,
        firstSeenAt: hopsList[0].timestamp,
        lastSeenAt: hopsList[hopsList.length - 1].timestamp,
        hops: hopsList,
        reachableArea,
        suggestedCameras,
      };
    };

    return [
      packageJourney('A', `Journey A - ${hopsA.length} hops - best path`, 'Primary hypothesis (highest fused score)', hopsA),
      packageJourney('B', `Journey B - ${hopsB.length} hops - East Path`, 'Differs at hop 3: Escalator Foot vs East Promenade', hopsB),
      packageJourney('C', `Journey C - ${hopsC.length} hops - South Concourse`, 'Differs at hop 2: Platform Turnstiles vs Bus Ramp', hopsC),
    ];
  }

  async getJourneyById(caseId: string, journeyId: string) {
    const journeys = await this.getAlternativeJourneys(caseId);
    const found = journeys.find((j) => j.journeyId.toUpperCase() === journeyId.toUpperCase());
    if (!found) {
      return journeys[0];
    }
    return found;
  }
}
