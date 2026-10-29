import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Sighting, SightingDocument, SightingReviewStatus } from './schemas/sighting.schema';
import { HardNegative, HardNegativeDocument } from './schemas/hard-negative.schema';
import { CasesService } from '../cases/cases.service';
import { ReferencesService } from '../references/references.service';
import { MissingPersonsService } from '../missing-persons/missing-persons.service';
import { randomUUID } from 'crypto';

export interface CursorPaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;
}

@Injectable()
export class SightingsService {
  private readonly logger = new Logger(SightingsService.name);

  constructor(
    @InjectModel(Sighting.name)
    private readonly sightingModel: Model<SightingDocument>,
    @InjectModel(HardNegative.name)
    private readonly hardNegativeModel: Model<HardNegativeDocument>,
    private readonly casesService: CasesService,
    @Inject(forwardRef(() => ReferencesService))
    private readonly referencesService: ReferencesService,
    @Inject(forwardRef(() => MissingPersonsService))
    private readonly missingPersonsService: MissingPersonsService,
  ) {}

  encodeCursor(timestamp: string, id: string): string {
    return Buffer.from(JSON.stringify({ t: timestamp, id })).toString('base64');
  }

  decodeCursor(cursor: string): { t: string; id: string } | null {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf8');
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  async findPaginated(options: {
    caseId?: string;
    status?: string;
    limit?: number;
    cursor?: string;
  }): Promise<CursorPaginatedResult<SightingDocument>> {
    const limit = Math.min(options.limit || 20, 100);
    const query: Record<string, any> = {};

    if (options.caseId) {
      query.caseId = options.caseId;
    }
    if (options.status) {
      query.status = options.status;
    }

    if (options.cursor) {
      const decoded = this.decodeCursor(options.cursor);
      if (decoded) {
        query.$or = [
          { timestamp: { $lt: decoded.t } },
          { timestamp: decoded.t, id: { $lt: decoded.id } },
        ];
      }
    }

    // Fetch limit + 1 to determine hasMore
    const items = await this.sightingModel
      .find(query)
      .sort({ timestamp: -1, id: -1 })
      .limit(limit + 1)
      .exec();

    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;

    let nextCursor: string | null = null;
    if (hasMore && data.length > 0) {
      const lastItem = data[data.length - 1];
      nextCursor = this.encodeCursor(lastItem.timestamp, lastItem.id);
    }

    return {
      data,
      nextCursor,
      hasMore,
    };
  }

  async findAll(caseId?: string): Promise<SightingDocument[]> {
    const query: Record<string, any> = {};
    if (caseId) query.caseId = caseId;
    return this.sightingModel.find(query).sort({ timestamp: -1 }).exec();
  }

  async findById(id: string): Promise<SightingDocument> {
    const item = await this.sightingModel.findOne({ id }).exec();
    if (!item) {
      throw new NotFoundException(`Sighting ${id} not found`);
    }
    return item;
  }

  async review(
    id: string,
    status: SightingReviewStatus,
    notes?: string,
    reviewedBy = 'Investigator',
    rejectReasonCode?: string,
  ): Promise<SightingDocument> {
    const sighting = await this.sightingModel.findOne({ id }).exec();
    if (!sighting) {
      throw new NotFoundException(`Sighting ${id} not found`);
    }

    sighting.status = status;
    sighting.reviewNotes = notes || '';
    sighting.reviewedBy = reviewedBy;
    sighting.reviewedAt = new Date().toISOString();
    if (rejectReasonCode) {
      sighting.rejectReasonCode = rejectReasonCode;
    }

    const updated = await sighting.save();

    if (status === 'confirmed') {
      await this.casesService.incrementSightingsCount(sighting.caseId);
    } else if (status === 'rejected') {
      // Store rejected candidate in hard negative suppression list
      const negId = `neg_${Date.now()}_${randomUUID().substring(0, 4)}`;
      const cropUrl = sighting.thumbnailUrl || sighting.frameUrl;
      const reason = rejectReasonCode || 'different_person';

      await this.hardNegativeModel.create({
        id: negId,
        caseId: sighting.caseId,
        sightingId: sighting.id,
        cropUrl,
        rejectReasonCode: reason,
        rejectedBy: reviewedBy,
        rejectedAt: new Date().toISOString(),
        model_version: sighting.model_version || 'v1.0',
      });

      this.logger.log(
        `Added candidate sighting ${sighting.id} to Hard Negatives for case ${sighting.caseId} (reason: ${reason}).`,
      );
    }

    return updated;
  }

  /**
   * Promotes a verified sighting crop to an enrolled reference (cctv_crop_verified).
   * Enforces dual-authorization on high-priority and critical cases.
   */
  async promoteToReference(
    id: string,
    actor = 'Investigator',
    notes?: string,
  ) {
    const sighting = await this.sightingModel.findOne({ id }).exec();
    if (!sighting) {
      throw new NotFoundException(`Sighting ${id} not found`);
    }

    if (sighting.status !== 'confirmed') {
      throw new BadRequestException(
        `Only confirmed sightings can be promoted to references. Current status is '${sighting.status}'.`,
      );
    }

    if (sighting.promotionStatus === 'promoted') {
      return {
        status: 'promoted',
        referenceId: sighting.promotedToReferenceId,
        message: 'This sighting crop has already been enrolled as a reference.',
      };
    }

    // Check case priority
    let isHighPriority = false;
    try {
      const caseDoc = await this.casesService.findById(sighting.caseId);
      if (caseDoc && (caseDoc.priority === 'critical' || caseDoc.priority === 'high')) {
        isHighPriority = true;
      }
    } catch {
      // Fallback check missing person if case not directly found
      try {
        const mpDoc = await this.missingPersonsService.findById(sighting.caseId);
        if (mpDoc && (mpDoc.priority === 'critical' || mpDoc.priority === 'high')) {
          isHighPriority = true;
        }
      } catch {}
    }

    // Two-person rule on high-priority cases
    if (isHighPriority) {
      if (sighting.promotionStatus === 'none' || !sighting.promotionStatus) {
        // Step 1: First approver requests promotion
        sighting.promotionStatus = 'pending_approval';
        sighting.promotionRequestedBy = actor;
        sighting.promotionRequestedAt = new Date().toISOString();
        await sighting.save();

        this.logger.log(
          `Sighting ${id} reference promotion requested by ${actor}. Awaiting second approver for high-priority case ${sighting.caseId}.`,
        );

        return {
          status: 'pending_approval',
          requiresSecondApprover: true,
          requestedBy: actor,
          requestedAt: sighting.promotionRequestedAt,
          message: 'Reference promotion requested. High-priority case requires authorization from a second approver.',
        };
      }

      if (sighting.promotionStatus === 'pending_approval') {
        // Step 2: Second approver authorization
        if (sighting.promotionRequestedBy && sighting.promotionRequestedBy.toLowerCase() === actor.toLowerCase()) {
          throw new BadRequestException(
            `Second approver verification required. The approving reviewer (${actor}) cannot be the same user who requested promotion (${sighting.promotionRequestedBy}).`,
          );
        }

        sighting.promotionApprovedBy = actor;
        sighting.promotionApprovedAt = new Date().toISOString();
      }
    } else {
      // Standard / low priority: single approver is sufficient
      sighting.promotionApprovedBy = actor;
      sighting.promotionApprovedAt = new Date().toISOString();
    }

    // Perform enrollment of CCTV crop into Re-ID reference set
    const cropUrl = sighting.thumbnailUrl || sighting.frameUrl;
    const qualityScore = Math.round((sighting.fusedScore || 0.85) * 100);

    const refDoc = await this.referencesService.registerCctvCropReference({
      caseId: sighting.caseId,
      sightingId: sighting.id,
      cropUrl,
      qualityScore,
      actor,
      notes: notes || `CCTV verified crop from camera ${sighting.cameraId} (${sighting.cameraLocation})`,
    });

    sighting.promotionStatus = 'promoted';
    sighting.promotedToReferenceId = refDoc.referenceId;
    await sighting.save();

    this.logger.log(
      `Sighting ${id} crop successfully promoted to reference ${refDoc.referenceId} for case ${sighting.caseId}.`,
    );

    return {
      status: 'promoted',
      referenceId: refDoc.referenceId,
      promotedAt: sighting.promotionApprovedAt,
      approvedBy: sighting.promotionApprovedBy,
      message: 'CCTV crop successfully enrolled as reference and embedded into Re-ID gallery.',
    };
  }

  /**
   * Retrieves hard negative list for case to support suppression evaluation.
   */
  async getHardNegatives(caseId: string): Promise<HardNegativeDocument[]> {
    return this.hardNegativeModel.find({ caseId }).sort({ rejectedAt: -1 }).exec();
  }
}
