import { z } from 'zod';
import { EmbeddingKind } from '../enums';

/**
 * EmbeddingRecord — metadata stored in MongoDB.
 * The actual vector is stored in Pinecone only.
 *
 * IMPORTANT: face and reid embeddings are in SEPARATE feature spaces.
 * face vectors: 512-dim (ArcFace)
 * reid vectors: 512-dim (OSNet / FastReID)
 * These must NEVER be concatenated or compared cross-kind.
 */
export const EmbeddingRecordSchema = z.object({
  id: z.string(),
  /** Face (ArcFace 512-dim) OR Reid (ReID 512-dim) — never mixed */
  kind: z.nativeEnum(EmbeddingKind),
  caseId: z.string(),
  personId: z.string().optional(),
  cameraId: z.string(),
  frameTimestamp: z.coerce.date(),
  ingestedAt: z.coerce.date(),
  /**
   * Model version tag — stored with every embedding to allow
   * re-indexing when models are updated.
   */
  model_version: z.string().min(1),
  /** MinIO object key for the source crop image */
  cropKey: z.string(),
  /** Pinecone vector ID (same as `id`) */
  pineconeId: z.string(),
  /** Index name in Pinecone — must match kind */
  pineconeIndex: z.string(),
});

export type EmbeddingRecord = z.infer<typeof EmbeddingRecordSchema>;

/** Face-specific embedding metadata */
export const FaceEmbeddingMetaSchema = EmbeddingRecordSchema.extend({
  kind: z.literal(EmbeddingKind.FACE),
  faceDetectionScore: z.number().min(0).max(1),
  /** Bounding box in source frame [x1, y1, x2, y2] */
  faceBbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
});

/** Reid-specific embedding metadata */
export const ReidEmbeddingMetaSchema = EmbeddingRecordSchema.extend({
  kind: z.literal(EmbeddingKind.REID),
  personBbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  personDetectionScore: z.number().min(0).max(1),
  bytetrackId: z.number().int().optional(),
});

export type FaceEmbeddingMeta = z.infer<typeof FaceEmbeddingMetaSchema>;
export type ReidEmbeddingMeta = z.infer<typeof ReidEmbeddingMetaSchema>;
