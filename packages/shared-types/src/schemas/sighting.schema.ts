import { z } from 'zod';
import { ConfidenceBand, SightingStatus } from '../enums';

/**
 * A Sighting is a candidate match proposed by the system.
 * It is ALWAYS pending human review — never auto-confirmed.
 *
 * UI must display: "Possible match" — not "Found" or "Confirmed".
 * Raw scores (faceScore, reidScore) are internal only and must not
 * be surfaced directly to operators; use confidenceBand instead.
 */
export const SightingSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  cameraId: z.string(),
  detectedAt: z.coerce.date(),
  createdAt: z.coerce.date(),

  /** Internal similarity scores — DO NOT expose in UI */
  faceScore: z.number().min(0).max(1).optional(),
  reidScore: z.number().min(0).max(1).optional(),

  /**
   * Ordinal confidence band for UI display.
   * Show this, never raw scores.
   */
  confidenceBand: z.nativeEnum(ConfidenceBand),

  status: z.nativeEnum(SightingStatus).default(SightingStatus.PENDING_REVIEW),

  /** MinIO object key for sighting thumbnail */
  thumbnailKey: z.string(),

  /** Frame timestamp in source video */
  frameTimestamp: z.coerce.date(),

  /** IDs of EmbeddingRecords used to generate this sighting */
  faceEmbeddingId: z.string().optional(),
  reidEmbeddingId: z.string().optional(),

  reviewedBy: z.string().optional(),
  reviewedAt: z.coerce.date().optional(),
  reviewNotes: z.string().max(1000).optional(),
});

export const ReviewSightingSchema = z.object({
  status: z.enum([SightingStatus.CONFIRMED_SIGHTING, SightingStatus.REJECTED]),
  reviewNotes: z.string().max(1000).optional(),
  rejectReasonCode: z
    .enum([
      'different_person',
      'clothing_mismatch',
      'poor_lighting',
      'occlusion',
      'insufficient_resolution',
      'other',
    ])
    .optional(),
});

export const PromoteSightingDtoSchema = z.object({
  cropUrl: z.string().optional(),
  notes: z.string().optional(),
});

export const HardNegativeSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  sightingId: z.string(),
  cropUrl: z.string(),
  embeddingReid: z.array(z.number()).optional(),
  embeddingFace: z.array(z.number()).optional(),
  rejectReasonCode: z.string().default('different_person'),
  rejectedBy: z.string(),
  rejectedAt: z.coerce.date(),
  model_version: z.string().default('v1.0'),
});

export type Sighting = z.infer<typeof SightingSchema>;
export type ReviewSightingDto = z.infer<typeof ReviewSightingSchema>;
export type PromoteSightingDto = z.infer<typeof PromoteSightingDtoSchema>;
export type HardNegative = z.infer<typeof HardNegativeSchema>;
