import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CasePriority = 'critical' | 'high' | 'medium' | 'low';
export type CaseStatus = 'active' | 'resolved' | 'archived' | 'closed';

export type CaseDocument = Case & Document;

@Schema({ _id: false })
export class PhotoProvenance {
  @Prop({
    required: true,
    enum: ['official_id', 'family_photo', 'cctv_crop', 'public_appeal'],
    default: 'family_photo',
  })
  source: string;

  @Prop({ required: true, default: true })
  verifiedReal: boolean;

  @Prop({ default: 'Investigator' })
  verifiedBy: string;

  @Prop({ required: true })
  fileHashSha256: string;
}

@Schema({ _id: false })
export class ReferencePhoto {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  url: string;

  @Prop({ default: 'frontal' })
  type: string;

  @Prop({ default: 0.95 })
  qualityScore: number;

  @Prop({ default: false })
  isSynthetic: boolean; // Invariant: MUST be false. Generative/synthetic photos are strictly prohibited.

  @Prop({ type: PhotoProvenance, required: true })
  provenance: PhotoProvenance;

  @Prop({ default: () => new Date().toISOString() })
  uploadedAt: string;

  @Prop({ default: 'v1.0' })
  model_version: string;
}

@Schema({ _id: false })
export class ReferenceVersionAudit {
  @Prop({ required: true })
  version: number;

  @Prop({ type: [ReferencePhoto], default: [] })
  photos: ReferencePhoto[];

  @Prop({ required: true })
  action: 'add' | 'remove' | 'replace' | 'initial';

  @Prop({ required: true })
  changedBy: string;

  @Prop({ default: () => new Date().toISOString() })
  updatedAt: string;

  @Prop({ default: '' })
  reason: string;
}

@Schema({ _id: false })
export class ReporterInfo {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  relationship: string;

  @Prop({ default: '' })
  phoneEncrypted?: string;
}

@Schema({ _id: false })
export class AuthorityRecord {
  @Prop({ required: true })
  name: string; // e.g. "Metropolitan Police Service - Missing Persons Unit"

  @Prop({ required: true })
  firOrCaseNumber: string; // Official FIR or case identifier

  @Prop({ default: '' })
  officerBadge?: string;
}

@Schema({ _id: false })
export class StatutoryConsent {
  @Prop({ required: true, default: false })
  confirmed: boolean; // Must be true before AI search can be triggered

  @Prop({ default: () => new Date().toISOString() })
  confirmedAt: string;

  @Prop({ default: 'Lawful Custody / Missing Persons Act Statutory Duty' })
  legalBasis: string;
}

@Schema({ _id: false })
export class RegistrationAuth {
  @Prop({ type: ReporterInfo, required: true })
  reporter: ReporterInfo;

  @Prop({ type: AuthorityRecord, required: true })
  authority: AuthorityRecord;

  @Prop({ type: StatutoryConsent, required: true })
  consent: StatutoryConsent;
}

@Schema({ _id: false })
export class EncryptedMinimalPii {
  @Prop({ default: '' })
  nationalIdEncrypted?: string;

  @Prop({ default: '' })
  contactPhoneEncrypted?: string;

  @Prop({ default: '' })
  addressEncrypted?: string;

  @Prop({ default: '' })
  medicalNotesEncrypted?: string;
}

@Schema({ collection: 'cases', timestamps: true })
export class Case {
  @Prop({ required: true, unique: true, trim: true })
  caseNumber: string;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true })
  personName: string;

  @Prop({ required: true, min: 0 })
  age: number;

  @Prop({ required: true, enum: ['male', 'female', 'other', 'unknown'] })
  gender: string;

  @Prop({ required: true })
  lastSeenLocation: string;

  @Prop({ required: true })
  lastSeenAt: string;

  @Prop({ default: () => new Date().toISOString() })
  reportedAt: string;

  @Prop({
    required: true,
    enum: ['critical', 'high', 'medium', 'low'],
    default: 'medium',
  })
  priority: CasePriority;

  @Prop({
    required: true,
    enum: ['active', 'resolved', 'archived', 'closed'],
    default: 'active',
  })
  status: CaseStatus;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: '' })
  lastSeenWearing: string;

  @Prop({ default: 'Unassigned' })
  assignedOfficer: string;

  @Prop({ default: 0 })
  sightingsCount: number;

  // Rule 1: Reference set versioning
  @Prop({ default: 1 })
  referenceSetVersion: number;

  @Prop({ type: [ReferencePhoto], default: [] })
  referencePhotos: ReferencePhoto[];

  @Prop({ type: [ReferenceVersionAudit], default: [] })
  referenceVersionHistory: ReferenceVersionAudit[];

  // Rule 2 & 3: Minor and Vulnerable flags
  @Prop({ default: false })
  isMinor: boolean;

  @Prop({ default: false })
  isVulnerable: boolean;

  @Prop({ default: '' })
  vulnerabilityDetailsEncrypted?: string;

  // Rule 3: Statutory registration authorization
  @Prop({ type: RegistrationAuth, required: false })
  registrationAuth?: RegistrationAuth;

  // Rule 4: Field-level encrypted minimal PII
  @Prop({ type: EncryptedMinimalPii, required: false })
  encryptedPii?: EncryptedMinimalPii;

  @Prop({ type: [String], default: [] })
  accessList: string[]; // List of user IDs permitted if restricted

  @Prop({ default: null })
  closedAt: string;

  @Prop({ default: null })
  closedBy: string;

  @Prop({ default: '' })
  closureNotes: string;

  @Prop({ default: false })
  seed?: boolean;

  @Prop({ default: '' })
  seedKey?: string;
}

export const CaseSchema = SchemaFactory.createForClass(Case);

// Required indexes
CaseSchema.index({ status: 1, priority: 1 });
CaseSchema.index({ createdAt: -1 });
CaseSchema.index({ isMinor: 1, isVulnerable: 1 });
CaseSchema.index({ 'registrationAuth.authority.firOrCaseNumber': 1 });
