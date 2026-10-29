import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SightingsService } from '../sightings/sightings.service';
import { CasesService } from '../cases/cases.service';
import { CamerasService } from '../cameras/cameras.service';
import { RedisService } from '../common/redis/redis.service';
import {
  Sighting,
  SightingDocument,
  SightingReviewStatus,
} from '../sightings/schemas/sighting.schema';
import {
  VerificationLabel,
  VerificationLabelDocument,
} from './schemas/verification-label.schema';
import { ReviewSightingDto } from '../sightings/dto/review-sighting.dto';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private readonly sightingsService: SightingsService,
    private readonly casesService: CasesService,
    private readonly camerasService: CamerasService,
    private readonly redisService: RedisService,
    @InjectModel(VerificationLabel.name)
    private readonly labelModel: Model<VerificationLabelDocument>,
    @InjectModel(Sighting.name)
    private readonly sightingModel: Model<SightingDocument>,
  ) {}

  /**
   * Acquire a distributed reviewer lock in Redis (TTL: 10 minutes)
   * to strictly prevent concurrent double-review.
   */
  async acquireLock(
    sightingId: string,
    reviewerId: string,
    reviewerEmail: string,
  ): Promise<{ status: string; lockedBy: string; expiresAt: string }> {
    const sighting = await this.sightingModel.findOne({ id: sightingId }).exec();
    if (!sighting) {
      throw new NotFoundException(`Sighting ${sightingId} not found`);
    }

    const lockKey = `sighting:lock:${sightingId}`;
    const ttlSec = 600; // 10 minutes lock

    // Try acquiring lock atomically with SETNX
    const acquired = await this.redisService.setnx(lockKey, reviewerEmail, ttlSec);
    if (!acquired) {
      const currentOwner = (await this.redisService.get(lockKey)) || 'another investigator';
      if (currentOwner !== reviewerEmail) {
        throw new ConflictException(
          `Sighting ${sightingId} is currently locked by reviewer: ${currentOwner}`,
        );
      }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSec * 1000).toISOString();

    sighting.status = 'locked';
    sighting.lockedBy = reviewerEmail;
    sighting.lockedAt = now.toISOString();
    await sighting.save();

    this.logger.log(`Reviewer lock acquired on sighting ${sightingId} by ${reviewerEmail}`);
    return { status: 'locked', lockedBy: reviewerEmail, expiresAt };
  }

  /**
   * Release reviewer lock when investigator cancels or navigates away.
   */
  async releaseLock(
    sightingId: string,
    reviewerEmail: string,
  ): Promise<{ status: string }> {
    const lockKey = `sighting:lock:${sightingId}`;
    const currentOwner = await this.redisService.get(lockKey);

    if (currentOwner && currentOwner === reviewerEmail) {
      await this.redisService.del(lockKey);
    }

    const sighting = await this.sightingModel.findOne({ id: sightingId }).exec();
    if (sighting && sighting.status === 'locked') {
      sighting.status = sighting.firstReviewerId ? 'pending_second_review' : 'pending';
      sighting.lockedBy = '';
      sighting.lockedAt = '';
      await sighting.save();
    }

    return { status: 'unlocked' };
  }

  /**
   * Returns verification queue prioritized by:
   * 1. Case Priority ('critical' > 'high' > 'medium' > 'low')
   * 2. Calibrated Fusion Score (descending)
   * 3. Capture Timestamp (ascending - oldest first)
   */
  async getPrioritizedQueue(limit = 50): Promise<any[]> {
    const pendingSightings = await this.sightingModel
      .find({
        status: {
          $in: ['pending', 'pending_second_review', 'locked', 'need_evidence'],
        },
        isPurged: { $ne: true },
      })
      .sort({ fusedScore: -1, timestamp: 1 })
      .limit(limit * 2)
      .lean()
      .exec();

    if (!pendingSightings || pendingSightings.length === 0) {
      return [];
    }

    const caseIds = [...new Set(pendingSightings.map((s) => s.caseId))];
    const caseMap = new Map<string, any>();

    for (const cId of caseIds) {
      try {
        const c = await this.casesService.findById(cId);
        if (c) caseMap.set(cId, c);
      } catch {
        // ignore missing case lookup
      }
    }

    const priorityWeights: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    const enriched = pendingSightings.map((s) => {
      const c = caseMap.get(s.caseId);
      const casePriority = c?.priority || 'medium';
      return {
        ...s,
        casePriority,
        priorityWeight: priorityWeights[casePriority] || 2,
      };
    });

    enriched.sort((a, b) => {
      if (b.priorityWeight !== a.priorityWeight) {
        return b.priorityWeight - a.priorityWeight;
      }
      return b.fusedScore - a.fusedScore;
    });

    return enriched.slice(0, limit);
  }

  /**
   * Submit human verification decision.
   *
   * Business Rules:
   * 1. Reject requires mandatory reason code and notes.
   * 2. High/Critical priority cases enforce Two-Person Rule:
   *    First review -> pending_second_review.
   *    Second review (must be distinct investigator) -> confirmed.
   * 3. Streams decision to labels collection for Phase 5 fusion calibration.
   */
  async verifySighting(
    sightingId: string,
    dto: ReviewSightingDto,
    reviewerId: string,
    reviewerEmail: string,
  ): Promise<SightingDocument> {
    const sighting = await this.sightingModel.findOne({ id: sightingId }).exec();
    if (!sighting) {
      throw new NotFoundException(`Sighting ${sightingId} not found`);
    }

    // Rule 1: Rejection mandates reason code and explanation notes
    if (dto.status === 'rejected') {
      if (!dto.rejectReasonCode) {
        throw new BadRequestException(
          'Mandatory rejectReasonCode required on rejection (e.g. different_person, clothing_mismatch, poor_lighting, occlusion, other)',
        );
      }
      if (!dto.notes || dto.notes.trim().length === 0) {
        throw new BadRequestException('Mandatory explanation note required when rejecting a possible match.');
      }
    }

    // Lookup case priority for two-person verification rule
    let casePriority = 'medium';
    try {
      const c = await this.casesService.findById(sighting.caseId);
      if (c) casePriority = c.priority;
    } catch {
      // fallback
    }

    const isHighPriorityCase = casePriority === 'critical' || casePriority === 'high';
    const nowIso = new Date().toISOString();

    if (dto.status === 'confirmed' && isHighPriorityCase) {
      // Two-Person Rule check
      if (!sighting.firstReviewerId) {
        // Stage 1: First Investigator Confirms
        sighting.status = 'pending_second_review';
        sighting.firstReviewerId = reviewerEmail;
        sighting.firstReviewedAt = nowIso;
        sighting.reviewNotes = dto.notes || 'First review confirmed';
        sighting.reviewedBy = reviewerEmail;
        this.logger.log(
          `Sighting ${sightingId} confirmed by 1st reviewer (${reviewerEmail}). Awaiting second-person review.`,
        );
      } else {
        // Stage 2: Second Investigator Confirms
        if (sighting.firstReviewerId === reviewerEmail) {
          throw new BadRequestException(
            'Two-Person Rule Violation: Second reviewer must be a different investigator than the first reviewer.',
          );
        }
        sighting.status = 'confirmed';
        sighting.secondReviewerId = reviewerEmail;
        sighting.secondReviewedAt = nowIso;
        sighting.reviewNotes = (sighting.reviewNotes ? sighting.reviewNotes + ' | ' : '') + (dto.notes || 'Second review confirmed');
        sighting.reviewedBy = `${sighting.firstReviewerId} & ${reviewerEmail}`;
        sighting.reviewedAt = nowIso;
        await this.casesService.incrementSightingsCount(sighting.caseId);
        this.logger.log(`Sighting ${sightingId} confirmed by 2nd reviewer (${reviewerEmail}). Status: confirmed.`);
      }
    } else {
      // Standard single-reviewer confirmation / rejection
      sighting.status = dto.status;
      sighting.reviewNotes = dto.notes || '';
      sighting.rejectReasonCode = dto.rejectReasonCode || '';
      sighting.reviewedBy = reviewerEmail;
      sighting.reviewedAt = nowIso;

      if (dto.status === 'confirmed') {
        await this.casesService.incrementSightingsCount(sighting.caseId);
      }
    }

    // Release reviewer lock
    await this.redisService.del(`sighting:lock:${sightingId}`);
    sighting.lockedBy = '';
    sighting.lockedAt = '';

    const savedSighting = await sighting.save();

    // Stream decision to labels collection for Phase 5 calibration
    if (savedSighting.status === 'confirmed' || savedSighting.status === 'rejected') {
      await this.labelModel.create({
        sightingId,
        caseId: sighting.caseId,
        label: savedSighting.status,
        reviewerId: reviewerEmail,
        notes: sighting.reviewNotes,
        features: {
          faceScore: sighting.faceScore,
          reidScore: sighting.reidScore,
          temporalScore: sighting.temporalScore,
          cameraPlausibility: sighting.cameraPlausibility,
          fusedScore: sighting.fusedScore,
          confidence: sighting.confidence,
          cameraId: sighting.cameraId,
          rejectReasonCode: sighting.rejectReasonCode || null,
        },
        modelVersion: sighting.model_version || 'sentinel-fusion-v1.0.0',
        recordedAt: nowIso,
      });

      // Online Bayesian learning: update camera topology transition distribution from verified journey hop
      if (savedSighting.status === 'confirmed') {
        try {
          const prevConfirmed = await this.sightingModel
            .findOne({
              caseId: sighting.caseId,
              status: 'confirmed',
              _id: { $ne: savedSighting._id },
              timestamp: { $lt: savedSighting.timestamp },
            })
            .sort({ timestamp: -1 })
            .exec();

          if (prevConfirmed && prevConfirmed.cameraId !== savedSighting.cameraId) {
            const t1 = new Date(prevConfirmed.timestamp).getTime();
            const t2 = new Date(savedSighting.timestamp).getTime();
            const observedTravelSec = Math.max(1, Math.round((t2 - t1) / 1000));
            await this.camerasService.learnTransition(
              prevConfirmed.cameraId,
              savedSighting.cameraId,
              observedTravelSec,
            );
          }
        } catch (err: any) {
          this.logger.warn(`Failed to update learned topology transition: ${err.message}`);
        }
      }
    }

    return savedSighting;
  }

  async getLabels(limit = 1000): Promise<VerificationLabel[]> {
    return this.labelModel.find().limit(limit).sort({ createdAt: -1 }).lean().exec();
  }
}
