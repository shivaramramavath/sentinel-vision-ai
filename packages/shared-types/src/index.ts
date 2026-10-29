// Enums
export * from './enums';

// Unified Domain Schemas & Types (Single Source of Truth)
export * from './schemas/domain.schema';

// Additional Schemas & DTOs
export type {
  CreateCaseDto,
  UpdateCaseDto,
  PhotoProvenance,
  ReferenceVersionAudit,
  RegistrationAuth,
  EncryptedMinimalPii,
  PersonDescription,
} from './schemas/case.schema';
export {
  PhotoProvenanceSchema,
  ReferenceVersionAuditSchema,
  StatutoryConsentSchema,
  AuthorityRecordSchema,
  ReporterInfoSchema,
  RegistrationAuthSchema,
  EncryptedMinimalPiiSchema,
  PersonDescriptionSchema,
  CreateCaseSchema,
  UpdateCaseSchema,
} from './schemas/case.schema';

export * from './schemas/missing-person.schema';

export type {
  CameraLocation,
  CreateCameraDto,
  UpdateCameraDto,
} from './schemas/camera.schema';
export {
  CameraLocationSchema,
  CreateCameraSchema,
  UpdateCameraSchema,
} from './schemas/camera.schema';

export * from './schemas/embedding.schema';

export { ReviewSightingSchema } from './schemas/sighting.schema';
export type { ReviewSightingDto } from './schemas/sighting.schema';

export * from './schemas/alert.schema';

export {
  SearchRequestSchema,
  SearchResultItemSchema,
  SearchResponseSchema,
} from './schemas/search.schema';
export type {
  SearchRequest,
  SearchResultItem,
  SearchResponse,
} from './schemas/search.schema';

export * from './schemas/mobile.schema';

export * from './schemas/dashboard.schema';

export * from './schemas/evidence-reports.schema';
export * from './schemas/alerts-inbox.schema';
export * from './schemas/admin-management.schema';

// Kafka Event Envelopes, Topics, and Payloads
export * from './events/index';
export * from './events/map-events';

// Legacy Kafka events interface for backwards compatibility
export * from './kafka-events';
