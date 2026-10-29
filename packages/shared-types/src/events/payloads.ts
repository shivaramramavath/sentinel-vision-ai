import { z } from 'zod';
import { ConfidenceBand, EmbeddingKind, SightingStatus } from '../enums';

// 1. search.jobs.commands
export const SearchJobsCommandPayloadSchema = z.object({
  searchJobId: z.string().uuid(),
  caseId: z.string().min(1),
  referencePhotoKey: z.string().min(1),
  faceThreshold: z.number().min(0).max(1).default(0.6),
  reidThreshold: z.number().min(0).max(1).default(0.5),
  topK: z.number().int().min(1).max(100).default(20),
  cameraIds: z.array(z.string()).optional(),
  fromTime: z.string().datetime().optional(),
  toTime: z.string().datetime().optional(),
  requestedBy: z.string().min(1),
});
export type SearchJobsCommandPayload = z.infer<typeof SearchJobsCommandPayloadSchema>;

// 2. search.jobs.progress
export const SearchJobStatus = {
  QUEUED: 'queued',
  EXTRACTING_FEATURES: 'extracting_features',
  SEARCHING_FACE_INDEX: 'searching_face_index',
  SEARCHING_REID_INDEX: 'searching_reid_index',
  FUSING_RESULTS: 'fusing_results',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;
export type SearchJobStatus = (typeof SearchJobStatus)[keyof typeof SearchJobStatus];

export const SearchJobsProgressPayloadSchema = z.object({
  searchJobId: z.string().uuid(),
  caseId: z.string().min(1),
  status: z.nativeEnum(SearchJobStatus),
  progressPercent: z.number().min(0).max(100),
  candidatesFound: z.number().int().min(0).default(0),
  errorMessage: z.string().optional(),
  completedAt: z.string().datetime().optional(),
});
export type SearchJobsProgressPayload = z.infer<typeof SearchJobsProgressPayloadSchema>;

// 3. video.frames.raw
export const VideoFramesRawPayloadSchema = z.object({
  frameId: z.string().min(1),
  cameraId: z.string().min(1),
  sequenceNumber: z.number().int().min(0),
  frameS3Key: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  capturedAt: z.string().datetime(),
  fps: z.number().positive().default(5),
});
export type VideoFramesRawPayload = z.infer<typeof VideoFramesRawPayloadSchema>;

// 4. detections.person
export const DetectionsPersonPayloadSchema = z.object({
  detectionId: z.string().min(1),
  cameraId: z.string().min(1),
  frameId: z.string().min(1),
  capturedAt: z.string().datetime(),
  personBbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  personScore: z.number().min(0).max(1),
  cropS3Key: z.string().min(1),
  bytetrackId: z.number().int().optional(),
});
export type DetectionsPersonPayload = z.infer<typeof DetectionsPersonPayloadSchema>;

// 5. embeddings.generated
// Strict Separation: kind is 'face' OR 'reid'. Never mixed or concatenated.
export const EmbeddingsGeneratedPayloadSchema = z.object({
  embeddingId: z.string().min(1),
  kind: z.nativeEnum(EmbeddingKind),
  caseId: z.string().optional(),
  cameraId: z.string().min(1),
  frameId: z.string().min(1),
  capturedAt: z.string().datetime(),
  cropS3Key: z.string().min(1),
  /** Mandatory model version stored with every embedding record */
  model_version: z.string().min(1),
  pineconeId: z.string().min(1),
  pineconeIndex: z.string().min(1),
  vectorDimension: z.number().int().positive(),
  detectionScore: z.number().min(0).max(1),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  bytetrackId: z.number().int().optional(),
});
export type EmbeddingsGeneratedPayload = z.infer<typeof EmbeddingsGeneratedPayloadSchema>;

// 6. candidates.scored
export const CandidatesScoredPayloadSchema = z.object({
  candidateId: z.string().min(1),
  caseId: z.string().min(1),
  searchJobId: z.string().uuid().optional(),
  cameraId: z.string().min(1),
  frameTimestamp: z.string().datetime(),
  faceScore: z.number().min(0).max(1).optional(),
  reidScore: z.number().min(0).max(1).optional(),
  fusedRank: z.number().int().positive(),
  confidenceBand: z.nativeEnum(ConfidenceBand),
  thumbnailKey: z.string().min(1),
  cropKey: z.string().min(1),
});
export type CandidatesScoredPayload = z.infer<typeof CandidatesScoredPayloadSchema>;

// 7. sightings.created
// UI Wording rule: displayLabel must strictly be "Possible match".
export const SightingsCreatedPayloadSchema = z.object({
  sightingId: z.string().min(1),
  caseId: z.string().min(1),
  cameraId: z.string().min(1),
  detectedAt: z.string().datetime(),
  thumbnailKey: z.string().min(1),
  confidenceBand: z.nativeEnum(ConfidenceBand),
  displayLabel: z.literal('Possible match'),
  status: z.nativeEnum(SightingStatus).default(SightingStatus.PENDING_REVIEW),
  faceEmbeddingId: z.string().optional(),
  reidEmbeddingId: z.string().optional(),
});
export type SightingsCreatedPayload = z.infer<typeof SightingsCreatedPayloadSchema>;

// 8. journeys.updated
export const JourneySightingPointSchema = z.object({
  sightingId: z.string().min(1),
  cameraId: z.string().min(1),
  timestamp: z.string().datetime(),
  confidenceBand: z.nativeEnum(ConfidenceBand),
});

export const JourneysUpdatedPayloadSchema = z.object({
  journeyId: z.string().min(1),
  caseId: z.string().min(1),
  personId: z.string().optional(),
  cameraSequence: z.array(z.string().min(1)),
  sightings: z.array(JourneySightingPointSchema),
  lastSeenCameraId: z.string().min(1),
  lastSeenAt: z.string().datetime(),
});
export type JourneysUpdatedPayload = z.infer<typeof JourneysUpdatedPayloadSchema>;

// 9. alerts.created
export const AlertDestinationType = {
  WEBHOOK: 'webhook',
  EMAIL: 'email',
  UI: 'ui',
} as const;
export type AlertDestinationType = (typeof AlertDestinationType)[keyof typeof AlertDestinationType];

export const AlertsCreatedPayloadSchema = z.object({
  alertId: z.string().min(1),
  caseId: z.string().min(1),
  sightingId: z.string().min(1),
  message: z.string().min(1).max(2000),
  confidenceBand: z.nativeEnum(ConfidenceBand),
  destination: z.object({
    type: z.nativeEnum(AlertDestinationType),
    target: z.string().min(1),
  }),
});
export type AlertsCreatedPayload = z.infer<typeof AlertsCreatedPayloadSchema>;

// 10. Dead Letter Queue (*.dlq) payload
export const DeadLetterQueuePayloadSchema = z.object({
  originalTopic: z.string().min(1),
  failedAt: z.string().datetime(),
  errorReason: z.string().min(1),
  stackTrace: z.string().optional(),
  retryCount: z.number().int().min(0),
  originalEvent: z.unknown(),
});
export type DeadLetterQueuePayload = z.infer<typeof DeadLetterQueuePayloadSchema>;
