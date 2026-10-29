import { z } from 'zod';

export const MissingPersonStatusSchema = z.enum([
  'draft',
  'active',
  'under_verification',
  'found',
  'closed',
  'suspended',
]);

export const MissingPersonPrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const GeoPointSchema = z.object({
  type: z.literal('Point').default('Point'),
  coordinates: z.tuple([z.number(), z.number()]),
});

export const ApproxAgeRangeSchema = z.object({
  min: z.number().default(0),
  max: z.number().default(100),
});

export const PersonIdentitySchema = z.object({
  fullName: z.string(),
  aliases: z.array(z.string()).default([]),
  gender: z.enum(['male', 'female', 'other', 'unknown']).default('unknown'),
  dob: z.string().optional(),
  approxAgeRange: ApproxAgeRangeSchema.default({ min: 0, max: 100 }),
  nationality: z.string().optional(),
  languages: z.array(z.string()).default([]),
});

export const PersonPhysicalSchema = z.object({
  heightCm: z.number().optional(),
  build: z.string().default('medium'),
  hair: z.string().default('unknown'),
  eyes: z.string().default('unknown'),
  skinTone: z.string().optional(),
  distinguishingMarks: z.array(z.string()).default([]),
  glasses: z.boolean().default(false),
  beard: z.boolean().default(false),
});

export const PersonVulnerabilitySchema = z.object({
  isMinor: z.boolean().default(false),
  medicalNotesEncrypted: z.string().optional(),
  mentalHealthFlag: z.boolean().default(false),
  requiresUrgentPriority: z.boolean().default(false),
});

export const LastSeenRecordSchema = z.object({
  ts: z.string(),
  locationText: z.string(),
  coordinates: GeoPointSchema,
  cameraId: z.string().optional(),
  direction: z.string().optional(),
  accompaniedBy: z.string().optional(),
  circumstances: z.string().optional(),
  recordedAt: z.string().optional(),
  recordedBy: z.string().optional(),
  source: z.string().optional(),
});

export const ClothingItemSchema = z.object({
  type: z.string(),
  colour: z.string(),
  pattern: z.string().optional(),
  brand: z.string().optional(),
});

export const ClothingAccessorySchema = z.object({
  type: z.string(),
  colour: z.string(),
});

export const LastSeenClothingSchema = z.object({
  items: z.array(ClothingItemSchema).default([]),
  accessories: z.array(ClothingAccessorySchema).default([]),
  footwear: z.string().optional(),
  carriedItems: z.array(z.string()).default([]),
});

export const PersonReporterSchema = z.object({
  name: z.string(),
  relation: z.string(),
  phoneEncrypted: z.string().optional(),
  emailEncrypted: z.string().optional(),
  contactPreference: z.enum(['phone', 'email', 'in_person']).default('phone'),
});

export const PersonAuthoritySchema = z.object({
  reportNumber: z.string(),
  station: z.string(),
  officerName: z.string(),
  authorizedBy: z.string(),
  authorizedAt: z.string(),
  legalBasisNote: z.string(),
});

export const SearchPolicySchema = z.object({
  defaultMinConfidence: z.number().default(0.75),
  defaultTimeWindowHours: z.number().default(24),
  autoSearchOnUpdate: z.boolean().default(true),
});

export const FieldDiffHistorySchema = z.object({
  at: z.string(),
  actor: z.string(),
  before: z.record(z.any()),
  after: z.record(z.any()),
  changedFields: z.array(z.string()),
});

export const MissingPersonSchema = z.object({
  personId: z.string(),
  caseId: z.string(),
  status: MissingPersonStatusSchema.default('draft'),
  identity: PersonIdentitySchema,
  physical: PersonPhysicalSchema.default({}),
  vulnerability: PersonVulnerabilitySchema.default({}),
  lastSeen: LastSeenRecordSchema,
  lastSeenHistory: z.array(LastSeenRecordSchema).default([]),
  lastSeenClothing: LastSeenClothingSchema.default({}),
  reporter: PersonReporterSchema,
  authority: PersonAuthoritySchema,
  priority: MissingPersonPrioritySchema.default('medium'),
  computedPriorityScore: z.number().default(50),
  searchPolicy: SearchPolicySchema.default({}),
  referenceSetVersion: z.number().default(1),
  version: z.number().default(1),
  history: z.array(FieldDiffHistorySchema).default([]),
  createdBy: z.string().default('system'),
  closedAt: z.string().optional(),
  closureReason: z.string().optional(),
});

export type MissingPersonStatus = z.infer<typeof MissingPersonStatusSchema>;
export type MissingPersonPriority = z.infer<typeof MissingPersonPrioritySchema>;
export type MissingPerson = z.infer<typeof MissingPersonSchema>;
export type LastSeenRecord = z.infer<typeof LastSeenRecordSchema>;
