import { createEventEnvelopeSchema } from './envelope';
import {
  AlertsCreatedPayloadSchema,
  CandidatesScoredPayloadSchema,
  DeadLetterQueuePayloadSchema,
  DetectionsPersonPayloadSchema,
  EmbeddingsGeneratedPayloadSchema,
  JourneysUpdatedPayloadSchema,
  SearchJobsCommandPayloadSchema,
  SearchJobsProgressPayloadSchema,
  SightingsCreatedPayloadSchema,
  VideoFramesRawPayloadSchema,
} from './payloads';

export * from './envelope';
export * from './topics';
export * from './payloads';

// Fully-typed event envelopes for every canonical topic:
export const SearchJobsCommandEnvelopeSchema = createEventEnvelopeSchema(SearchJobsCommandPayloadSchema);
export const SearchJobsProgressEnvelopeSchema = createEventEnvelopeSchema(SearchJobsProgressPayloadSchema);
export const VideoFramesRawEnvelopeSchema = createEventEnvelopeSchema(VideoFramesRawPayloadSchema);
export const DetectionsPersonEnvelopeSchema = createEventEnvelopeSchema(DetectionsPersonPayloadSchema);
export const EmbeddingsGeneratedEnvelopeSchema = createEventEnvelopeSchema(EmbeddingsGeneratedPayloadSchema);
export const CandidatesScoredEnvelopeSchema = createEventEnvelopeSchema(CandidatesScoredPayloadSchema);
export const SightingsCreatedEnvelopeSchema = createEventEnvelopeSchema(SightingsCreatedPayloadSchema);
export const JourneysUpdatedEnvelopeSchema = createEventEnvelopeSchema(JourneysUpdatedPayloadSchema);
export const AlertsCreatedEnvelopeSchema = createEventEnvelopeSchema(AlertsCreatedPayloadSchema);
export const DeadLetterQueueEnvelopeSchema = createEventEnvelopeSchema(DeadLetterQueuePayloadSchema);
