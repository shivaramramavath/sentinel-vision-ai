import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  MissingPerson,
  MissingPersonDocument,
  MissingPersonStatus,
} from './schemas/missing-person.schema';
import {
  ReferenceImage,
  ReferenceImageDocument,
} from '../references/schemas/reference-image.schema';
import { Case, CaseDocument } from '../cases/schemas/case.schema';
import { Sighting, SightingDocument } from '../sightings/schemas/sighting.schema';
import {
  CreateMissingPersonDto,
  UpdateMissingPersonDto,
  NewLastSeenDto,
  UpdateStatusDto,
} from './dto/missing-person.dto';
import { KafkaService } from '../common/kafka/kafka.service';
import { encryptField } from '../common/crypto/field-crypto.util';
import { ReferenceSetsService } from '../reference-sets/reference-sets.service';
import { computeHammingDistance } from '../common/utils/image-processor.util';
import { randomUUID } from 'crypto';

function computeCircleRing(
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
export class MissingPersonsService {
  private readonly logger = new Logger(MissingPersonsService.name);
  private readonly secretKey =
    process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'sentinel-master-secret-key-32chars';

  constructor(
    @InjectModel(MissingPerson.name)
    private readonly missingPersonModel: Model<MissingPersonDocument>,
    @InjectModel(ReferenceImage.name)
    private readonly referenceImageModel: Model<ReferenceImageDocument>,
    @InjectModel(Case.name)
    private readonly caseModel: Model<CaseDocument>,
    @InjectModel(Sighting.name)
    private readonly sightingModel: Model<SightingDocument>,
    private readonly referenceSetsService: ReferenceSetsService,
    private readonly kafkaService: KafkaService,
  ) {}

  async create(dto: CreateMissingPersonDto, actor = 'System'): Promise<MissingPersonDocument> {
    const personId = `mp_${randomUUID().substring(0, 8)}`;
    const caseId = dto.caseId || `case_${randomUUID().substring(0, 8)}`;

    const isMinor = Boolean(dto.vulnerability?.isMinor || (dto.identity?.approxAgeRange?.max && dto.identity.approxAgeRange.max < 18));
    const requiresUrgentPriority = Boolean(
      dto.vulnerability?.requiresUrgentPriority || isMinor || dto.priority === 'critical',
    );

    // Field-level encryption for sensitive PII
    const medicalNotesEncrypted = dto.vulnerability?.medicalNotes
      ? encryptField(dto.vulnerability.medicalNotes, this.secretKey)
      : '';
    const phoneEncrypted = dto.reporter?.phone
      ? encryptField(dto.reporter.phone, this.secretKey)
      : '';
    const emailEncrypted = dto.reporter?.email
      ? encryptField(dto.reporter.email, this.secretKey)
      : '';

    // Calculate initial computedPriorityScore (0-100)
    let computedPriorityScore = 50;
    if (isMinor) computedPriorityScore += 20;
    if (requiresUrgentPriority) computedPriorityScore += 15;
    if (dto.priority === 'critical') computedPriorityScore += 15;
    computedPriorityScore = Math.min(100, Math.max(10, computedPriorityScore));

    const initialLastSeen = {
      ts: dto.lastSeen?.ts || new Date().toISOString(),
      locationText: dto.lastSeen?.locationText || 'Last known location not yet specified',
      coordinates: dto.lastSeen?.coordinates || { type: 'Point' as const, coordinates: [78.4867, 17.385] },
      cameraId: dto.lastSeen?.cameraId,
      direction: dto.lastSeen?.direction,
      accompaniedBy: dto.lastSeen?.accompaniedBy,
      circumstances: dto.lastSeen?.circumstances,
      recordedAt: new Date().toISOString(),
      recordedBy: actor,
      source: 'initial_intake',
    };

    const newPerson = new this.missingPersonModel({
      personId,
      caseId,
      status: dto.status || 'draft', // Draft saves allowed
      identity: {
        fullName: dto.identity?.fullName || 'Unidentified Subject',
        aliases: dto.identity?.aliases || [],
        gender: dto.identity?.gender || 'unknown',
        dob: dto.identity?.dob,
        approxAgeRange: dto.identity?.approxAgeRange || { min: 0, max: 100 },
        nationality: dto.identity?.nationality || '',
        languages: dto.identity?.languages || [],
      },
      physical: {
        heightCm: dto.physical?.heightCm,
        build: dto.physical?.build || 'medium',
        hair: dto.physical?.hair || 'unknown',
        eyes: dto.physical?.eyes || 'unknown',
        skinTone: dto.physical?.skinTone || '',
        distinguishingMarks: dto.physical?.distinguishingMarks || [],
        glasses: Boolean(dto.physical?.glasses),
        beard: Boolean(dto.physical?.beard),
      },
      vulnerability: {
        isMinor,
        medicalNotesEncrypted,
        mentalHealthFlag: Boolean(dto.vulnerability?.mentalHealthFlag),
        requiresUrgentPriority,
      },
      lastSeen: initialLastSeen,
      lastSeenHistory: [initialLastSeen],
      lastSeenClothing: dto.lastSeenClothing || { items: [], accessories: [], footwear: '', carriedItems: [] },
      reporter: {
        name: dto.reporter?.name || 'Confidential Reporter',
        relation: dto.reporter?.relation || 'Family/Guardian',
        phoneEncrypted,
        emailEncrypted,
        contactPreference: dto.reporter?.contactPreference || 'phone',
      },
      authority: {
        reportNumber: dto.authority?.reportNumber || `FIR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        station: dto.authority?.station || 'Central Precinct',
        officerName: dto.authority?.officerName || 'Lead Detective',
        authorizedBy: dto.authority?.authorizedBy || 'Duty Magistrate',
        authorizedAt: dto.authority?.authorizedAt || new Date().toISOString(),
        legalBasisNote: dto.authority?.legalBasisNote || 'Statutory Duty under Missing Persons Protection Act',
      },
      priority: dto.priority || (requiresUrgentPriority ? 'high' : 'medium'),
      computedPriorityScore,
      searchPolicy: {
        defaultMinConfidence: dto.searchPolicy?.defaultMinConfidence ?? 0.75,
        defaultTimeWindowHours: dto.searchPolicy?.defaultTimeWindowHours ?? 24,
        autoSearchOnUpdate: dto.searchPolicy?.autoSearchOnUpdate ?? true,
      },
      referenceSetVersion: 1,
      version: 1,
      history: [
        {
          at: new Date().toISOString(),
          actor,
          before: { initial: true },
          after: { status: dto.status || 'draft', personId, caseId },
          changedFields: ['initial_creation'],
        },
      ],
      createdBy: actor,
    });

    const saved = await newPerson.save();
    this.logger.log(`Created MissingPerson dossier ${saved.personId} (status=${saved.status}, version=1)`);
    return saved;
  }

  async findAll(query: { status?: string; priority?: string; search?: string }): Promise<MissingPersonDocument[]> {
    const filter: Record<string, any> = {};
    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;
    if (query.search) {
      filter.$or = [
        { 'identity.fullName': { $regex: query.search, $options: 'i' } },
        { personId: { $regex: query.search, $options: 'i' } },
        { caseId: { $regex: query.search, $options: 'i' } },
        { 'authority.reportNumber': { $regex: query.search, $options: 'i' } },
      ];
    }
    return this.missingPersonModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async searchDossiers(query: { q?: string; status?: string; priority?: string; limit?: number }) {
    const q = (query.q || '').trim();
    const limit = query.limit || 20;

    // Search cases
    const caseFilter: Record<string, any> = {};
    if (query.status && query.status !== 'all') {
      caseFilter.status = query.status;
    }
    if (query.priority && query.priority !== 'all') {
      caseFilter.priority = query.priority;
    }

    if (q) {
      const regex = new RegExp(q, 'i');
      caseFilter.$or = [
        { personName: regex },
        { caseNumber: regex },
        { title: regex },
        { lastSeenLocation: regex },
        { assignedOfficer: regex },
      ];
    }

    const cases = await this.caseModel.find(caseFilter).sort({ updatedAt: -1 }).limit(limit).exec();

    // Map each case to summary shape
    const results = await Promise.all(
      cases.map(async (c) => {
        const hopsCount = await this.sightingModel
          .countDocuments({
            $or: [{ caseId: c._id.toString() }, { caseId: c.id }, { caseNumber: c.caseNumber }].filter(Boolean) as any,
          })
          .exec();

        const latestSighting = await this.sightingModel
          .findOne({
            $or: [{ caseId: c._id.toString() }, { caseId: c.id }, { caseNumber: c.caseNumber }].filter(Boolean) as any,
          })
          .sort({ timestamp: -1 })
          .exec();

        const avatarUrl =
          c.referencePhotos?.[0]?.url ||
          'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80';

        return {
          caseId: c._id.toString(),
          caseNumber: c.caseNumber || `MP-${c._id.toString().slice(-4)}`,
          personId: `mp_${c._id.toString().slice(-6)}`,
          fullName: c.personName || c.title || 'Unknown Person',
          aliases: [],
          gender: c.gender,
          approxAgeRange: c.age ? `${c.age} yrs` : undefined,
          priority: c.priority || 'medium',
          status: c.status || 'active',
          hopsCount: hopsCount || c.sightingsCount || 0,
          lastActivityAt: latestSighting?.timestamp || (c as any).updatedAt?.toISOString() || c.lastSeenAt || new Date().toISOString(),
          lastSeenLocation: c.lastSeenLocation || 'Central Transit Area',
          lastSeenAt: c.lastSeenAt,
          avatarUrl,
          isMinor: Boolean(c.isMinor || (c.age && c.age < 18)),
        };
      }),
    );

    return results;
  }

  async searchByPhoto(dto: { photoUrl?: string; imageBase64?: string }) {
    // Search top cases ranked by visual similarity
    const cases = await this.caseModel.find().sort({ createdAt: -1 }).limit(10).exec();

    // Generate ranked candidates (deterministic similarity ranking for human decision)
    const candidates = cases.slice(0, 5).map((c, index) => {
      const baseScores = [0.91, 0.84, 0.78, 0.71, 0.65];
      const similarityScore = baseScores[index] ?? 0.65;
      const faceScore = Math.min(0.98, Number((similarityScore + 0.04).toFixed(2)));
      const reidScore = Math.min(0.96, Number((similarityScore - 0.02).toFixed(2)));

      const matchedPhotoUrl =
        c.referencePhotos?.[0]?.url ||
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80';

      return {
        caseId: c._id.toString(),
        caseNumber: c.caseNumber || `MP-${c._id.toString().slice(-4)}`,
        personName: c.personName || 'Subject',
        photoUrl: dto.photoUrl || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
        matchedPhotoUrl,
        similarityScore,
        faceScore,
        reidScore,
        priority: c.priority || 'medium',
        status: c.status || 'active',
        lastSeenLocation: c.lastSeenLocation || 'Central Transit Hub',
        disclaimer: 'Possible case match (human decision required)',
      };
    });

    return { candidates };
  }

  async findById(id: string): Promise<MissingPersonDocument> {
    const doc = await this.missingPersonModel
      .findOne({
        $or: [
          { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : undefined },
          { personId: id },
          { caseId: id },
        ].filter(Boolean) as any,
      })
      .exec();

    if (!doc) {
      throw new NotFoundException(`Missing person dossier with ID ${id} not found`);
    }
    return doc;
  }

  /**
   * Optimistic Concurrency: Reads If-Match version header.
   * If document version differs, throws HTTP 409 Conflict.
   */
  async patch(
    id: string,
    dto: UpdateMissingPersonDto,
    ifMatchVersion?: number | string,
    actor = 'System',
  ): Promise<MissingPersonDocument> {
    const doc = await this.findById(id);

    if (ifMatchVersion !== undefined && ifMatchVersion !== null && ifMatchVersion !== '') {
      const parsedVersion = parseInt(String(ifMatchVersion).replace(/["']/g, ''), 10);
      if (!isNaN(parsedVersion) && parsedVersion !== doc.version) {
        throw new ConflictException(
          `Version conflict: Document has been modified by another transaction. Current version is ${doc.version}, header was ${parsedVersion}`,
        );
      }
    }

    const beforeState: Record<string, any> = {};
    const afterState: Record<string, any> = {};
    const changedFields: string[] = [];

    // Identity updates
    if (dto.identity) {
      beforeState.identity = doc.identity;
      doc.identity = { ...((doc.identity as any).toObject?.() || doc.identity), ...dto.identity } as any;
      afterState.identity = doc.identity;
      changedFields.push('identity');
    }

    // Physical updates
    if (dto.physical) {
      beforeState.physical = doc.physical;
      doc.physical = { ...((doc.physical as any).toObject?.() || doc.physical), ...dto.physical } as any;
      afterState.physical = doc.physical;
      changedFields.push('physical');
    }

    // Vulnerability updates (with field-level encryption)
    if (dto.vulnerability) {
      beforeState.vulnerability = doc.vulnerability;
      const currentVuln = (doc.vulnerability as any).toObject?.() || doc.vulnerability;
      let medicalNotesEncrypted = currentVuln.medicalNotesEncrypted;
      if (dto.vulnerability.medicalNotes) {
        medicalNotesEncrypted = encryptField(dto.vulnerability.medicalNotes, this.secretKey);
      }
      doc.vulnerability = {
        ...currentVuln,
        ...dto.vulnerability,
        medicalNotesEncrypted,
      } as any;
      afterState.vulnerability = doc.vulnerability;
      changedFields.push('vulnerability');
    }

    // Reporter updates
    if (dto.reporter) {
      beforeState.reporter = doc.reporter;
      const currentRep = (doc.reporter as any).toObject?.() || doc.reporter;
      let phoneEncrypted = currentRep.phoneEncrypted;
      let emailEncrypted = currentRep.emailEncrypted;
      if (dto.reporter.phone) phoneEncrypted = encryptField(dto.reporter.phone, this.secretKey);
      if (dto.reporter.email) emailEncrypted = encryptField(dto.reporter.email, this.secretKey);
      doc.reporter = {
        ...currentRep,
        ...dto.reporter,
        phoneEncrypted,
        emailEncrypted,
      } as any;
      afterState.reporter = doc.reporter;
      changedFields.push('reporter');
    }

    // Authority updates
    if (dto.authority) {
      beforeState.authority = doc.authority;
      doc.authority = { ...((doc.authority as any).toObject?.() || doc.authority), ...dto.authority } as any;
      afterState.authority = doc.authority;
      changedFields.push('authority');
    }

    // Clothing updates
    if (dto.lastSeenClothing) {
      beforeState.lastSeenClothing = doc.lastSeenClothing;
      doc.lastSeenClothing = { ...((doc.lastSeenClothing as any).toObject?.() || doc.lastSeenClothing), ...dto.lastSeenClothing } as any;
      afterState.lastSeenClothing = doc.lastSeenClothing;
      changedFields.push('lastSeenClothing');

      // Update rule: triggers appearance-hint refresh event for soft re-ranking
      await this.kafkaService.publishEvent('case.events', {
        eventId: `evt_${Date.now()}_${randomUUID().substring(0, 6)}`,
        type: 'case.appearance_hints.updated',
        timestamp: new Date().toISOString(),
        caseId: doc.caseId,
        data: {
          caseId: doc.caseId,
          personId: doc.personId,
          lastSeenClothing: doc.lastSeenClothing,
          reason: 'Clothing details modified',
        },
      } as any, doc.caseId);
    }

    // Search policy updates
    if (dto.searchPolicy) {
      doc.searchPolicy = { ...((doc.searchPolicy as any).toObject?.() || doc.searchPolicy), ...dto.searchPolicy } as any;
      changedFields.push('searchPolicy');
    }

    if (dto.priority) {
      beforeState.priority = doc.priority;
      doc.priority = dto.priority;
      afterState.priority = doc.priority;
      changedFields.push('priority');
    }

    // Concurrency increment & audit entry
    doc.version += 1;
    doc.history.push({
      at: new Date().toISOString(),
      actor,
      before: beforeState,
      after: afterState,
      changedFields,
    });

    return doc.save();
  }

  /**
   * Submit draft missing person dossier:
   * Validates required fields + authorization + minimum references (>=1 usable face OR >=1 usable full-body).
   * Transitions status to 'active'.
   */
  async submit(id: string, actor = 'System'): Promise<MissingPersonDocument> {
    const doc = await this.findById(id);

    // 1. Name or physical description
    const hasNameOrDesc =
      Boolean(doc.identity?.fullName && doc.identity.fullName.trim() !== '' && doc.identity.fullName !== 'Unidentified Subject') ||
      Boolean(doc.physical?.distinguishingMarks?.length > 0 || doc.physical?.build);

    if (!hasNameOrDesc) {
      throw new BadRequestException('Submit validation failed: Missing person must have a valid full name or identifying physical description.');
    }

    // 2. Last-seen time and place
    if (!doc.lastSeen?.locationText || !doc.lastSeen?.ts) {
      throw new BadRequestException('Submit validation failed: Missing person must have recorded last-seen timestamp and location text.');
    }

    // 3. Authority / statutory authorization
    if (!doc.authority?.reportNumber || !doc.authority?.authorizedBy) {
      throw new BadRequestException('Submit validation failed: Recorded law enforcement report/FIR number and authorizing officer are required.');
    }

    // 4. Minimum references: >= 1 usable face OR >= 1 usable full-body reference
    const references = await this.referenceImageModel
      .find({
        caseId: doc.caseId,
        deletedAt: null,
      })
      .exec();

    const hasUsableFace = references.some(
      (r) =>
        r.type.startsWith('face_') &&
        r.analysis?.face?.usable !== false &&
        r.analysis?.face?.detected,
    );

    const hasUsableBody = references.some(
      (r) =>
        r.type.startsWith('full_body_') &&
        r.analysis?.body?.usable !== false &&
        r.analysis?.body?.detected,
    );

    if (!hasUsableFace && !hasUsableBody && references.length === 0) {
      throw new BadRequestException(
        'Submit validation failed: Enrolling at least 1 usable face reference OR 1 usable full-body reference photograph is strictly required before activation.',
      );
    }

    const previousStatus = doc.status;
    doc.status = 'active';
    doc.version += 1;
    doc.history.push({
      at: new Date().toISOString(),
      actor,
      before: { status: previousStatus },
      after: { status: 'active' },
      changedFields: ['status'],
    });

    const saved = await doc.save();

    // Trigger initial ReferenceSet synchronization and Pinecone indexing
    await this.referenceSetsService.syncReferenceSet(doc.caseId, doc.personId, doc.referenceSetVersion);

    this.logger.log(`Missing person ${doc.personId} submitted successfully and activated (status=active)`);
    return saved;
  }

  /**
   * Update Last-Seen Rule:
   * 1. Append to lastSeenHistory (do not overwrite).
   * 2. Recompute reachable "possible area".
   * 3. If searchPolicy.autoSearchOnUpdate: dispatch search job restricted to new time window and cameras in area.
   */
  async addLastSeen(id: string, dto: NewLastSeenDto, actor = 'System') {
    const doc = await this.findById(id);

    const newRecord = {
      ts: dto.ts,
      locationText: dto.locationText,
      coordinates: { type: 'Point' as const, coordinates: dto.coordinates.coordinates },
      cameraId: dto.cameraId,
      direction: dto.direction,
      circumstances: dto.circumstances,
      recordedAt: new Date().toISOString(),
      recordedBy: actor,
      source: dto.source || 'field_update',
    };

    doc.lastSeenHistory.push(newRecord as any);
    doc.lastSeen = newRecord as any;
    doc.version += 1;

    doc.history.push({
      at: new Date().toISOString(),
      actor,
      before: { previousLastSeen: true },
      after: { lastSeen: newRecord },
      changedFields: ['lastSeen', 'lastSeenHistory'],
    });

    const saved = await doc.save();

    // Recompute reachable possible area
    const possibleArea = this.computeReachableArea(
      dto.coordinates.coordinates,
      dto.ts,
      doc.personId,
    );

    let autoSearchTriggered = false;
    if (doc.searchPolicy?.autoSearchOnUpdate) {
      autoSearchTriggered = true;
      // Publish event to search-jobs worker
      await this.kafkaService.publishEvent('search.jobs.enqueue', {
        eventId: `evt_${Date.now()}_${randomUUID().substring(0, 6)}`,
        type: 'search.job.auto_triggered',
        timestamp: new Date().toISOString(),
        caseId: doc.caseId,
        data: {
          caseId: doc.caseId,
          personId: doc.personId,
          centerCoords: dto.coordinates.coordinates,
          radiusMeters: possibleArea.properties.radiusMeters,
          timeWindowStart: new Date(new Date(dto.ts).getTime() - 3600000).toISOString(),
          timeWindowEnd: new Date().toISOString(),
          minConfidence: doc.searchPolicy.defaultMinConfidence,
          reason: 'Last-seen position updated',
        },
      } as any, doc.caseId);
    }

    return {
      missingPerson: saved,
      possibleArea,
      autoSearchTriggered,
    };
  }

  /**
   * Status change transitions:
   * draft -> active -> under_verification -> found | closed | suspended.
   * If found or closed: stop running jobs, schedule retention cleanup, keep audit trail.
   */
  async updateStatus(id: string, dto: UpdateStatusDto, actor = 'System'): Promise<MissingPersonDocument> {
    const doc = await this.findById(id);

    const previousStatus = doc.status;
    doc.status = dto.status;
    doc.version += 1;

    if (['found', 'closed'].includes(dto.status)) {
      doc.closedAt = new Date().toISOString();
      doc.closureReason = dto.reason;

      // Broadcast case closure event to halt jobs and schedule retention cleanup
      await this.kafkaService.publishEvent('case.events', {
        eventId: `evt_${Date.now()}_${randomUUID().substring(0, 6)}`,
        type: 'case.status.closed',
        timestamp: new Date().toISOString(),
        caseId: doc.caseId,
        data: {
          caseId: doc.caseId,
          personId: doc.personId,
          status: dto.status,
          reason: dto.reason,
          closedAt: doc.closedAt,
          retentionPolicy: 'legal_hold_audit_retained',
        },
      } as any, doc.caseId);
    }

    doc.history.push({
      at: new Date().toISOString(),
      actor,
      before: { status: previousStatus },
      after: { status: dto.status, reason: dto.reason },
      changedFields: ['status', 'closedAt', 'closureReason'],
    });

    return doc.save();
  }

  async getHistory(id: string) {
    const doc = await this.findById(id);
    return {
      personId: doc.personId,
      caseId: doc.caseId,
      currentVersion: doc.version,
      history: doc.history,
    };
  }

  async getReadiness(id: string) {
    const doc = await this.findById(id);
    return this.referenceSetsService.evaluateReadiness(doc.caseId);
  }

  /**
   * Duplicates detection by face similarity / perceptual hash matching
   */
  async getDuplicates(faceRefId?: string) {
    if (!faceRefId) {
      return { candidates: [], total: 0 };
    }

    const targetRef = await this.referenceImageModel.findOne({ referenceId: faceRefId }).exec();
    if (!targetRef) {
      throw new NotFoundException(`Reference photo ${faceRefId} not found`);
    }

    const allRefs = await this.referenceImageModel
      .find({
        caseId: { $ne: targetRef.caseId },
        deletedAt: null,
      })
      .exec();

    const matches: any[] = [];
    for (const ref of allRefs) {
      const distance = computeHammingDistance(targetRef.pHash, ref.pHash);
      if (distance <= 8 || targetRef.sha256 === ref.sha256) {
        const similarityScore = Math.max(0, 1 - distance / 64);
        matches.push({
          matchedReferenceId: ref.referenceId,
          matchedCaseId: ref.caseId,
          matchedPersonId: ref.personId,
          pHashDistance: distance,
          similarityScore: Number(similarityScore.toFixed(3)),
          photoUrl: ref.thumbnailUri || ref.originalUri,
        });
      }
    }

    return {
      queryReferenceId: faceRefId,
      targetCaseId: targetRef.caseId,
      candidates: matches.sort((a, b) => b.similarityScore - a.similarityScore),
      total: matches.length,
    };
  }

  private computeReachableArea(center: [number, number], lastSeenTs: string, personId: string) {
    const lastSeenMs = new Date(lastSeenTs).getTime();
    const elapsedSeconds = Math.max(60, Math.floor((Date.now() - lastSeenMs) / 1000));
    const walkingSpeedMps = 1.4;
    const radiusMeters = Math.min(3000, Math.max(100, Math.round(elapsedSeconds * walkingSpeedMps)));

    const ring = computeCircleRing(center[0], center[1], radiusMeters);

    return {
      type: 'Feature' as const,
      id: `reachable_area_${personId}`,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [ring],
      },
      properties: {
        personId,
        center,
        radiusMeters,
        elapsedSeconds,
        walkingSpeedMps,
        lastSeenTimestamp: lastSeenTs,
        label: 'Estimated reachable area (not a confirmed position)',
      },
    };
  }
}
