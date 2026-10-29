import { z } from 'zod';
import { CaseStatus, Sex } from '../enums';

export const PhotoProvenanceSchema = z.object({
  source: z.enum(['official_id', 'family_photo', 'cctv_crop', 'public_appeal']).default('family_photo'),
  verifiedReal: z.boolean().default(true),
  verifiedBy: z.string().default('Investigator'),
  fileHashSha256: z.string(),
});

export const ReferencePhotoSchema = z.object({
  id: z.string(),
  url: z.string(),
  type: z.string().default('frontal'),
  qualityScore: z.number().default(0.95),
  isSynthetic: z.literal(false).default(false),
  provenance: PhotoProvenanceSchema,
  uploadedAt: z.string(),
  model_version: z.string().default('v1.0'),
});

export const ReferenceVersionAuditSchema = z.object({
  version: z.number(),
  photos: z.array(ReferencePhotoSchema),
  action: z.enum(['add', 'remove', 'replace', 'initial']),
  changedBy: z.string(),
  updatedAt: z.string(),
  reason: z.string().optional(),
});

export const StatutoryConsentSchema = z.object({
  confirmed: z.boolean().default(true),
  confirmedAt: z.string(),
  legalBasis: z.string(),
});

export const AuthorityRecordSchema = z.object({
  name: z.string(),
  firOrCaseNumber: z.string(),
  officerBadge: z.string().optional(),
});

export const ReporterInfoSchema = z.object({
  name: z.string(),
  relationship: z.string(),
  phoneEncrypted: z.string().optional(),
});

export const RegistrationAuthSchema = z.object({
  reporter: ReporterInfoSchema,
  authority: AuthorityRecordSchema,
  consent: StatutoryConsentSchema,
});

export const EncryptedMinimalPiiSchema = z.object({
  nationalIdEncrypted: z.string().optional(),
  contactPhoneEncrypted: z.string().optional(),
  addressEncrypted: z.string().optional(),
  medicalNotesEncrypted: z.string().optional(),
});

export const PersonDescriptionSchema = z.object({
  age: z.number().int().min(0).max(150).optional(),
  sex: z.nativeEnum(Sex).optional(),
  heightCm: z.number().min(50).max(250).optional(),
  buildNotes: z.string().max(500).optional(),
  lastSeenWearing: z.string().max(500).optional(),
  distinguishingFeatures: z.string().max(1000).optional(),
  lastSeenLocation: z.string().max(500).optional(),
  lastSeenAt: z.coerce.date().optional(),
});

export const CreateCaseSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  personName: z.string().min(1).max(200),
  personDescription: PersonDescriptionSchema.optional(),
  reportedBy: z.string().min(1).max(200),
  reportedAt: z.coerce.date().optional(),
  contactInfo: z.string().max(500).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  isVulnerable: z.boolean().optional(),
  vulnerabilityDetails: z.string().optional(),
  nationalId: z.string().optional(),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  medicalNotes: z.string().optional(),
  firOrCaseNumber: z.string().optional(),
  authorityName: z.string().optional(),
  consentConfirmed: z.boolean().optional(),
});

export const UpdateCaseSchema = CreateCaseSchema.partial().extend({
  status: z.nativeEnum(CaseStatus).optional(),
});

export const CaseSchema = CreateCaseSchema.extend({
  id: z.string(),
  caseNumber: z.string().optional(),
  status: z.nativeEnum(CaseStatus).default(CaseStatus.ACTIVE),
  referencePhotoKeys: z.array(z.string()).default([]),
  referenceSetVersion: z.number().default(1),
  referencePhotos: z.array(ReferencePhotoSchema).default([]),
  referenceVersionHistory: z.array(ReferenceVersionAuditSchema).default([]),
  isMinor: z.boolean().default(false),
  isVulnerable: z.boolean().default(false),
  vulnerabilityDetailsEncrypted: z.string().optional(),
  registrationAuth: RegistrationAuthSchema.optional(),
  encryptedPii: EncryptedMinimalPiiSchema.optional(),
  accessList: z.array(z.string()).default([]),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  createdBy: z.string(),
});

export type PhotoProvenance = z.infer<typeof PhotoProvenanceSchema>;
export type ReferencePhoto = z.infer<typeof ReferencePhotoSchema>;
export type ReferenceVersionAudit = z.infer<typeof ReferenceVersionAuditSchema>;
export type RegistrationAuth = z.infer<typeof RegistrationAuthSchema>;
export type EncryptedMinimalPii = z.infer<typeof EncryptedMinimalPiiSchema>;
export type PersonDescription = z.infer<typeof PersonDescriptionSchema>;
export type CreateCaseDto = z.infer<typeof CreateCaseSchema>;
export type UpdateCaseDto = z.infer<typeof UpdateCaseSchema>;
export type Case = z.infer<typeof CaseSchema>;
