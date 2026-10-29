import { z } from 'zod';
import { ConfidenceBand } from '../enums';

export const SearchRequestSchema = z.object({
  caseId: z.string(),
  /**
   * Reference photo object key from MinIO — the system will
   * extract face + reid features from this image separately.
   */
  referencePhotoKey: z.string(),
  /** 0–1 threshold for face similarity (default: 0.6) */
  faceThreshold: z.number().min(0).max(1).default(0.6),
  /** 0–1 threshold for reid similarity (default: 0.5) */
  reidThreshold: z.number().min(0).max(1).default(0.5),
  /** Max results to return */
  topK: z.number().int().min(1).max(100).default(20),
  /** Optional time range filter */
  fromTime: z.coerce.date().optional(),
  toTime: z.coerce.date().optional(),
  /** Optional camera filter */
  cameraIds: z.array(z.string()).optional(),
});

export const SearchResultItemSchema = z.object({
  sightingId: z.string(),
  cameraId: z.string(),
  detectedAt: z.coerce.date(),
  thumbnailKey: z.string(),
  /** Ordinal band only — never expose raw scores in UI */
  confidenceBand: z.nativeEnum(ConfidenceBand),
  /** Human-facing label — always "Possible match" */
  displayLabel: z.literal('Possible match'),
  faceRank: z.number().int().optional(),
  reidRank: z.number().int().optional(),
});

export const SearchResponseSchema = z.object({
  searchId: z.string(),
  caseId: z.string(),
  queriedAt: z.coerce.date(),
  results: z.array(SearchResultItemSchema),
  totalResults: z.number().int(),
  disclaimer: z
    .string()
    .default(
      'All results are candidate matches for human review only. No identity has been confirmed.',
    ),
});

export type SearchRequest = z.infer<typeof SearchRequestSchema>;
export type SearchResultItem = z.infer<typeof SearchResultItemSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
