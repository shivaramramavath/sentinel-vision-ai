import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MissingPersonStatus =
  | 'draft'
  | 'active'
  | 'under_verification'
  | 'found'
  | 'closed'
  | 'suspended';

export type MissingPersonPriority = 'low' | 'medium' | 'high' | 'critical';

export type MissingPersonDocument = MissingPerson & Document;

@Schema({ _id: false })
export class GeoPoint {
  @Prop({ type: String, enum: ['Point'], default: 'Point' })
  type: 'Point';

  @Prop({ type: [Number], required: true })
  coordinates: [number, number]; // [lng, lat]
}

@Schema({ _id: false })
export class ApproxAgeRange {
  @Prop({ type: Number, default: 0 })
  min: number;

  @Prop({ type: Number, default: 100 })
  max: number;
}

@Schema({ _id: false })
export class PersonIdentity {
  @Prop({ required: true, default: '' })
  fullName: string;

  @Prop({ type: [String], default: [] })
  aliases: string[];

  @Prop({ enum: ['male', 'female', 'other', 'unknown'], default: 'unknown' })
  gender: string;

  @Prop({ default: null })
  dob?: string;

  @Prop({ type: ApproxAgeRange, default: () => ({ min: 0, max: 100 }) })
  approxAgeRange: ApproxAgeRange;

  @Prop({ default: '' })
  nationality?: string;

  @Prop({ type: [String], default: [] })
  languages: string[];
}

@Schema({ _id: false })
export class PersonPhysical {
  @Prop({ default: null })
  heightCm?: number;

  @Prop({ default: 'medium' })
  build: string;

  @Prop({ default: 'unknown' })
  hair: string;

  @Prop({ default: 'unknown' })
  eyes: string;

  @Prop({ default: '' })
  skinTone?: string;

  @Prop({ type: [String], default: [] })
  distinguishingMarks: string[]; // scars, tattoos, birthmarks

  @Prop({ default: false })
  glasses: boolean;

  @Prop({ default: false })
  beard: boolean;
}

@Schema({ _id: false })
export class PersonVulnerability {
  @Prop({ default: false })
  isMinor: boolean;

  @Prop({ default: '' })
  medicalNotesEncrypted?: string;

  @Prop({ default: false })
  mentalHealthFlag: boolean;

  @Prop({ default: false })
  requiresUrgentPriority: boolean;
}

@Schema({ _id: false })
export class LastSeenRecord {
  @Prop({ required: true, default: () => new Date().toISOString() })
  ts: string;

  @Prop({ required: true, default: '' })
  locationText: string;

  @Prop({ type: GeoPoint, default: () => ({ type: 'Point', coordinates: [78.4867, 17.385] }) })
  coordinates: GeoPoint;

  @Prop({ default: null })
  cameraId?: string;

  @Prop({ default: '' })
  direction?: string;

  @Prop({ default: '' })
  accompaniedBy?: string;

  @Prop({ default: '' })
  circumstances?: string;

  @Prop({ default: () => new Date().toISOString() })
  recordedAt?: string;

  @Prop({ default: 'System' })
  recordedBy?: string;

  @Prop({ default: 'initial_report' })
  source?: string;
}

@Schema({ _id: false })
export class ClothingItem {
  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  colour: string;

  @Prop({ default: '' })
  pattern?: string;

  @Prop({ default: '' })
  brand?: string;
}

@Schema({ _id: false })
export class ClothingAccessory {
  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  colour: string;
}

@Schema({ _id: false })
export class LastSeenClothing {
  @Prop({ type: [ClothingItem], default: [] })
  items: ClothingItem[];

  @Prop({ type: [ClothingAccessory], default: [] })
  accessories: ClothingAccessory[];

  @Prop({ default: '' })
  footwear: string;

  @Prop({ type: [String], default: [] })
  carriedItems: string[];
}

@Schema({ _id: false })
export class PersonReporter {
  @Prop({ required: true, default: 'Confidential Reporter' })
  name: string;

  @Prop({ required: true, default: 'Family' })
  relation: string;

  @Prop({ default: '' })
  phoneEncrypted?: string;

  @Prop({ default: '' })
  emailEncrypted?: string;

  @Prop({ enum: ['phone', 'email', 'in_person'], default: 'phone' })
  contactPreference: string;
}

@Schema({ _id: false })
export class PersonAuthority {
  @Prop({ required: true, default: '' })
  reportNumber: string; // FIR or police case number

  @Prop({ default: 'Central Police Station' })
  station: string;

  @Prop({ default: 'Lead Detective' })
  officerName: string;

  @Prop({ default: 'Station Supervisor' })
  authorizedBy: string;

  @Prop({ default: () => new Date().toISOString() })
  authorizedAt: string;

  @Prop({ default: 'Statutory Duty under Missing Persons Protection Act' })
  legalBasisNote: string;
}

@Schema({ _id: false })
export class SearchPolicy {
  @Prop({ default: 0.75 })
  defaultMinConfidence: number;

  @Prop({ default: 24 })
  defaultTimeWindowHours: number;

  @Prop({ default: true })
  autoSearchOnUpdate: boolean;
}

@Schema({ _id: false })
export class FieldDiffHistory {
  @Prop({ required: true })
  at: string;

  @Prop({ required: true })
  actor: string;

  @Prop({ type: Object, default: () => ({}) })
  before: Record<string, any>;

  @Prop({ type: Object, default: () => ({}) })
  after: Record<string, any>;

  @Prop({ type: [String], default: [] })
  changedFields: string[];
}

@Schema({ collection: 'missing_persons', timestamps: true })
export class MissingPerson {
  @Prop({ required: true, unique: true, index: true })
  personId: string;

  @Prop({ required: true, index: true })
  caseId: string; // 1:1 for now, designed for 1:N

  @Prop({
    required: true,
    enum: ['draft', 'active', 'under_verification', 'found', 'closed', 'suspended'],
    default: 'draft',
    index: true,
  })
  status: MissingPersonStatus;

  @Prop({ type: PersonIdentity, required: true })
  identity: PersonIdentity;

  @Prop({ type: PersonPhysical, default: () => ({}) })
  physical: PersonPhysical;

  @Prop({ type: PersonVulnerability, default: () => ({}) })
  vulnerability: PersonVulnerability;

  @Prop({ type: LastSeenRecord, required: true })
  lastSeen: LastSeenRecord;

  @Prop({ type: [LastSeenRecord], default: [] })
  lastSeenHistory: LastSeenRecord[];

  @Prop({ type: LastSeenClothing, default: () => ({ items: [], accessories: [], footwear: '', carriedItems: [] }) })
  lastSeenClothing: LastSeenClothing;

  @Prop({ type: PersonReporter, required: true })
  reporter: PersonReporter;

  @Prop({ type: PersonAuthority, required: true })
  authority: PersonAuthority;

  @Prop({
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true,
  })
  priority: MissingPersonPriority;

  @Prop({ default: 50 })
  computedPriorityScore: number;

  @Prop({ type: SearchPolicy, default: () => ({}) })
  searchPolicy: SearchPolicy;

  @Prop({ default: 1 })
  referenceSetVersion: number;

  @Prop({ default: 1 })
  version: number; // Optimistic concurrency integer checked against If-Match

  @Prop({ type: [FieldDiffHistory], default: [] })
  history: FieldDiffHistory[];

  @Prop({ default: 'system' })
  createdBy: string;

  @Prop({ default: null })
  closedAt?: string;

  @Prop({ default: '' })
  closureReason?: string;
}

export const MissingPersonSchema = SchemaFactory.createForClass(MissingPerson);

MissingPersonSchema.index({ 'lastSeen.coordinates': '2dsphere' });
MissingPersonSchema.index({ status: 1, priority: 1 });
MissingPersonSchema.index({ 'identity.fullName': 'text', 'identity.aliases': 'text' });
