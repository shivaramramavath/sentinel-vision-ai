import { z } from 'zod';

/**
 * Standard Event Envelope for all Sentinel Vision AI asynchronous messaging.
 *
 * Requirements:
 * - `eventId`: Globally unique event identifier (UUID v4) used by Redis SETNX for consumer idempotency deduplication.
 * - `type`: Canonical event type name (e.g., 'video.frames.raw', 'detections.person').
 * - `version`: Schema version for evolutionary compatibility (e.g. '1.0').
 * - `occurredAt`: ISO-8601 UTC timestamp.
 * - `correlationId`: Distributed tracing & correlation token across service boundaries.
 * - `caseId`: Optional missing-person case identifier.
 * - `cameraId`: Optional camera stream identifier. CRITICAL: When present, this is used as the Kafka partition key.
 * - `payload`: Type-specific event data payload.
 */
export const EventEnvelopeSchema = z.object({
  eventId: z.string().uuid(),
  type: z.string().min(1),
  version: z.string().default('1.0'),
  occurredAt: z.string().datetime(),
  correlationId: z.string().min(1),
  caseId: z.string().optional(),
  cameraId: z.string().optional(),
  payload: z.unknown(),
});

export type EventEnvelope<T = unknown> = {
  eventId: string;
  type: string;
  version: string;
  occurredAt: string;
  correlationId: string;
  caseId?: string;
  cameraId?: string;
  payload: T;
};

/**
 * Helper factory to generate a strictly typed envelope Zod schema.
 */
export function createEventEnvelopeSchema<T extends z.ZodTypeAny>(payloadSchema: T) {
  return z.object({
    eventId: z.string().uuid(),
    type: z.string().min(1),
    version: z.string().default('1.0'),
    occurredAt: z.string().datetime(),
    correlationId: z.string().min(1),
    caseId: z.string().optional(),
    cameraId: z.string().optional(),
    payload: payloadSchema,
  });
}
