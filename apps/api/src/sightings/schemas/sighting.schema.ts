import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SightingReviewStatus =
  | 'pending'
  | 'locked'
  | 'pending_second_review'
  | 'confirmed'
  | 'rejected'
  | 'need_evidence';

export type SightingDocument = Sighting & Document;

@Schema({ collection: 'sightings', timestamps: true })
export class Sighting {
  @Prop({ required: true, unique: true })
  id: string; // e.g. 'sight_01'

  @Prop({ required: true })
  caseId: string;

  @Prop({ required: true })
  caseNumber: string;

  @Prop({ required: true })
  personName: string;

  @Prop({ required: true })
  cameraId: string;

  @Prop({ required: true })
  cameraLocation: string;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
    },
    _id: false,
  })
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };

  @Prop({ type: [Number], required: false })
  coordinates?: [number, number]; // [lng, lat]

  @Prop({ required: true })
  timestamp: string; // ISO 8601

  @Prop({ required: true, enum: ['low', 'medium', 'high'] })
  confidence: 'low' | 'medium' | 'high';

  // Feature space separation: Face and Re-ID embeddings are separate metric spaces
  @Prop({ required: true, min: 0, max: 1 })
  faceScore: number;

  @Prop({ required: true, min: 0, max: 1 })
  reidScore: number;

  @Prop({ required: true, min: 0, max: 1 })
  temporalScore: number;

  @Prop({ required: true, min: 0, max: 1 })
  cameraPlausibility: number;

  @Prop({ required: true, min: 0, max: 1 })
  fusedScore: number;

  @Prop({ required: true })
  frameUrl: string;

  @Prop({ required: true })
  thumbnailUrl: string;

  @Prop({ required: true })
  referencePhotoUrl: string;

  @Prop({ type: [Number], required: true })
  bbox: number[]; // [x, y, w, h]

  @Prop({
    required: true,
    enum: [
      'pending',
      'locked',
      'pending_second_review',
      'confirmed',
      'rejected',
      'need_evidence',
    ],
    default: 'pending',
  })
  status: SightingReviewStatus;

  @Prop({ default: '' })
  reviewNotes: string;

  @Prop({ default: '' })
  reviewedBy: string;

  @Prop({ default: null })
  reviewedAt: string;

  // Two-person verification rule support
  @Prop({ default: null })
  firstReviewerId: string;

  @Prop({ default: null })
  firstReviewedAt: string;

  @Prop({ default: null })
  secondReviewerId: string;

  @Prop({ default: null })
  secondReviewedAt: string;

  // Rejection reason code
  @Prop({
    default: null,
    enum: [
      null,
      'different_person',
      'clothing_mismatch',
      'poor_lighting',
      'occlusion',
      'insufficient_resolution',
      'other',
    ],
  })
  rejectReasonCode: string;

  // Reviewer lock fields
  @Prop({ default: null })
  lockedBy: string;

  @Prop({ default: null })
  lockedAt: string;

  // Retention purge indicator
  @Prop({ default: false })
  isPurged: boolean;

  // Promotion of verified sighting to reference
  @Prop({
    default: 'none',
    enum: ['none', 'pending_approval', 'promoted', 'rejected'],
  })
  promotionStatus: 'none' | 'pending_approval' | 'promoted' | 'rejected';

  @Prop({ default: null })
  promotedToReferenceId: string;

  @Prop({ default: null })
  promotionRequestedBy: string;

  @Prop({ default: null })
  promotionRequestedAt: string;

  @Prop({ default: null })
  promotionApprovedBy: string;

  @Prop({ default: null })
  promotionApprovedAt: string;

  // Embedding / Model Versioning invariant
  @Prop({ required: true, default: 'v1.0' })
  model_version: string;

  @Prop({ default: false })
  seed?: boolean;

  @Prop({ default: '' })
  seedKey?: string;
}

export const SightingSchema = SchemaFactory.createForClass(Sighting);

// Compound index for cursor-based pagination
SightingSchema.index({ location: '2dsphere' }, { sparse: true });
SightingSchema.index({ caseId: 1, timestamp: -1 });
SightingSchema.index({ status: 1 });
SightingSchema.index({ fusedScore: -1 });
