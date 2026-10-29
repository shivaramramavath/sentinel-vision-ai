import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EvidenceDocument = Evidence & Document;

@Schema({ _id: false })
export class CustodyEntry {
  @Prop({
    required: true,
  })
  action: string;

  @Prop({ required: true })
  actor: string;

  @Prop({ default: 'Investigator' })
  actorRole: string;

  @Prop({ required: true })
  timestamp: string;

  @Prop({ required: true })
  hash: string; // SHA-256(prevEntryHash + canonical payload)

  @Prop({ default: 'GENESIS_00000000000000000000000000000000' })
  prevEntryHash: string;

  @Prop({ default: '' })
  notes?: string;

  @Prop()
  caseId?: string;
}

@Schema({ _id: false })
export class EvidenceScores {
  @Prop({ required: true })
  faceScore: number;

  @Prop({ required: true })
  reidScore: number;

  @Prop({ required: true })
  temporalScore: number;

  @Prop({ required: true })
  cameraPlausibility: number;

  @Prop({ required: true })
  fusedScore: number;

  @Prop({ default: 'medium' })
  confidenceBand: string;
}

@Schema({ _id: false })
export class EvidenceModelVersions {
  @Prop({ default: 'adaface-ir50-v2' })
  faceModel: string;

  @Prop({ default: 'osnet-ain-x1.0-v1' })
  reidModel: string;

  @Prop({ default: 'sentinel-fusion-v1.0.0' })
  fusionModel: string;
}

@Schema({ collection: 'evidence', timestamps: true })
export class Evidence {
  @Prop({ required: true, unique: true })
  id: string; // e.g. 'ev_01'

  @Prop({ required: true })
  caseId: string;

  @Prop({ default: 'MP-2026-0042' })
  caseNumber: string;

  @Prop({ default: 'Maya Lin' })
  personName: string;

  @Prop({ default: 'Evidence Snapshot' })
  title: string;

  @Prop({ default: 'frame_snapshot' })
  type: string;

  @Prop({ default: 'sighting_01' })
  sightingId: string;

  @Prop({ required: true })
  cameraId: string;

  @Prop({ default: 'CAM-001' })
  cameraCode: string;

  @Prop({ default: 'Platform 3' })
  locationName: string;

  @Prop({ required: true })
  frameUrl: string;

  @Prop({ default: '' })
  cropUrl: string;

  @Prop({ default: '' })
  referenceImageUrl: string;

  @Prop({ required: true })
  sha256Hash: string; // Primary hash

  @Prop({ default: '' })
  sha256OriginalFrame: string;

  @Prop({ default: '' })
  sha256Crop: string;

  @Prop({ default: 'verified' })
  integrityStatus: string; // 'verified' | 'pending' | 'failed'

  @Prop({ default: () => new Date().toISOString() })
  lastVerifiedAt: string;

  @Prop({ default: false })
  isLegalHold: boolean;

  @Prop({ default: '' })
  legalHoldReason: string;

  @Prop({ default: '' })
  legalHoldPlacedBy: string;

  @Prop({ default: '' })
  legalHoldPlacedAt: string;

  @Prop({ default: false })
  isRedacted: boolean;

  @Prop({ default: '' })
  parentEvidenceId: string;

  @Prop({ default: false })
  isPurged: boolean;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: EvidenceScores, default: () => ({ faceScore: 0.91, reidScore: 0.88, temporalScore: 0.95, cameraPlausibility: 1.0, fusedScore: 0.89, confidenceBand: 'high' }) })
  scores: EvidenceScores;

  @Prop({ type: EvidenceModelVersions, default: () => ({ faceModel: 'adaface-ir50-v2', reidModel: 'osnet-ain-x1.0-v1', fusionModel: 'sentinel-fusion-v1.0.0' }) })
  modelVersions: EvidenceModelVersions;

  @Prop({ type: [CustodyEntry], default: [] })
  chainOfCustody: CustodyEntry[];

  @Prop({ required: true })
  capturedAt: string;

  @Prop({ default: 1048576 })
  fileSizeBytes: number;

  @Prop({ type: Object })
  derivedData?: Record<string, any>;

  @Prop({ default: false })
  seed?: boolean;

  @Prop({ default: '' })
  seedKey?: string;
}

export const EvidenceSchema = SchemaFactory.createForClass(Evidence);

EvidenceSchema.index({ caseId: 1 });
EvidenceSchema.index({ sightingId: 1 });
EvidenceSchema.index({ capturedAt: -1 });
EvidenceSchema.index({ integrityStatus: 1 });
EvidenceSchema.index({ isLegalHold: 1 });
