/**
 * Kafka topic names and event payload types.
 * Shared between apps/api (producer) and apps/inference (consumer).
 */

export const KafkaTopics = {
  FRAMES_RAW: 'frames.raw',
  DETECTIONS_PERSON: 'detections.person',
  EMBEDDINGS_FACE: 'embeddings.face',
  EMBEDDINGS_REID: 'embeddings.reid',
  SIGHTINGS_CREATED: 'sightings.created',
  ALERTS_DISPATCH: 'alerts.dispatch',
} as const;

export type KafkaTopic = (typeof KafkaTopics)[keyof typeof KafkaTopics];

/** Emitted when a raw frame is extracted from a camera stream */
export interface FrameRawEvent {
  frameId: string;
  cameraId: string;
  capturedAt: string; // ISO-8601
  frameS3Key: string; // MinIO key for the raw frame JPEG
  sequenceNumber: number;
}

/** Emitted when YOLO detects one or more persons in a frame */
export interface PersonDetectionEvent {
  detectionId: string;
  cameraId: string;
  frameId: string;
  capturedAt: string;
  /** Bounding box [x1, y1, x2, y2] in pixel coordinates */
  personBbox: [number, number, number, number];
  personScore: number;
  bytetrackId?: number;
  cropS3Key: string;
}

/** Emitted after face embedding is computed */
export interface FaceEmbeddingEvent {
  embeddingId: string;
  cameraId: string;
  frameId: string;
  capturedAt: string;
  cropS3Key: string;
  faceBbox: [number, number, number, number];
  faceScore: number;
  model_version: string;
  /** Vector written to Pinecone already — payload is metadata only */
  pineconeId: string;
}

/** Emitted after Re-ID embedding is computed */
export interface ReidEmbeddingEvent {
  embeddingId: string;
  cameraId: string;
  frameId: string;
  capturedAt: string;
  cropS3Key: string;
  personBbox: [number, number, number, number];
  model_version: string;
  pineconeId: string;
  bytetrackId?: number;
}

/** Emitted when a new sighting is created for operator review */
export interface SightingCreatedEvent {
  sightingId: string;
  caseId: string;
  cameraId: string;
  detectedAt: string;
  thumbnailKey: string;
  confidenceBand: 'low' | 'medium' | 'high';
}
