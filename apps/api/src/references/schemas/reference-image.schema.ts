import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ReferenceImageType =
  | 'face_front'
  | 'face_left'
  | 'face_right'
  | 'face_profile'
  | 'face_other'
  | 'full_body_front'
  | 'full_body_back'
  | 'full_body_side'
  | 'last_seen_clothing'
  | 'distinguishing_mark'
  | 'cctv_crop_verified'
  | 'other';

export type ReferenceSource =
  | 'family_upload'
  | 'police'
  | 'social_media'
  | 'cctv_verified'
  | 'other';

export type AnalysisStatus =
  | 'uploaded'
  | 'processing'
  | 'ready'
  | 'rejected'
  | 'needs_review'
  | 'failed';

export type PoseBin =
  | 'front'
  | 'front_left'
  | 'left'
  | 'back_left'
  | 'back'
  | 'back_right'
  | 'right'
  | 'front_right';

export type ReferenceImageDocument = ReferenceImage & Document;

@Schema({ _id: false })
export class BoundingBox {
  @Prop({ required: true })
  x: number;

  @Prop({ required: true })
  y: number;

  @Prop({ required: true })
  width: number;

  @Prop({ required: true })
  height: number;
}

@Schema({ _id: false })
export class SizePx {
  @Prop({ default: 0 })
  width: number;

  @Prop({ default: 0 })
  height: number;
}

@Schema({ _id: false })
export class FaceOcclusion {
  @Prop({ default: false })
  mask: boolean;

  @Prop({ default: false })
  sunglasses: boolean;

  @Prop({ default: false })
  hand: boolean;

  @Prop({ default: false })
  hat: boolean;
}

@Schema({ _id: false })
export class FaceAnalysis {
  @Prop({ default: false })
  detected: boolean;

  @Prop({ default: 0 })
  quality: number; // 0-1

  @Prop({ default: 0 })
  blur: number; // 0 = sharp, 1 = severely blurred

  @Prop({ type: SizePx, default: () => ({ width: 0, height: 0 }) })
  sizePx: SizePx;

  @Prop({ type: [Number], default: [0, 0, 0] })
  yawPitchRoll: [number, number, number];

  @Prop({ type: FaceOcclusion, default: () => ({ mask: false, sunglasses: false, hand: false, hat: false }) })
  occlusion: FaceOcclusion;

  @Prop({ default: 0.8 })
  illumination: number;

  @Prop({ default: true })
  usable: boolean;
}

@Schema({ _id: false })
export class BodyAnalysis {
  @Prop({ default: false })
  detected: boolean;

  @Prop({ default: 0 })
  completeness: number; // 0-1

  @Prop({ default: 'standing' })
  pose: string;

  @Prop({ type: SizePx, default: () => ({ width: 0, height: 0 }) })
  resolution: SizePx;

  @Prop({ default: true })
  usable: boolean;
}

@Schema({ _id: false })
export class ReferenceSubject {
  @Prop({ type: BoundingBox, default: null })
  selectedFaceBox?: BoundingBox;

  @Prop({ type: BoundingBox, default: null })
  selectedPersonBox?: BoundingBox;

  @Prop({ default: 1 })
  faceCountDetected: number;

  @Prop({ default: 1 })
  personCountDetected: number;
}

@Schema({ _id: false })
export class ImageAnalysis {
  @Prop({
    required: true,
    enum: ['uploaded', 'processing', 'ready', 'rejected', 'needs_review', 'failed'],
    default: 'uploaded',
  })
  status: AnalysisStatus;

  @Prop({ type: FaceAnalysis, default: null })
  face?: FaceAnalysis;

  @Prop({ type: BodyAnalysis, default: null })
  body?: BodyAnalysis;

  @Prop({
    enum: [
      'front',
      'front_left',
      'left',
      'back_left',
      'back',
      'back_right',
      'right',
      'front_right',
    ],
    default: 'front',
  })
  poseBin?: PoseBin;

  @Prop({ type: [String], default: [] })
  rejectReasons: string[];

  @Prop({ type: [String], default: [] })
  warnings: string[];
}

@Schema({ _id: false })
export class EmbeddingVectorMeta {
  @Prop({ required: true })
  vectorId: string;

  @Prop({ default: 'sentinel-face-v2' })
  model: string;

  @Prop({ default: 'v2.0' })
  modelVersion: string;
}

@Schema({ _id: false })
export class ReferenceEmbeddings {
  @Prop({ type: EmbeddingVectorMeta, default: null })
  face?: EmbeddingVectorMeta;

  @Prop({ type: EmbeddingVectorMeta, default: null })
  reid?: EmbeddingVectorMeta;
}

@Schema({ collection: 'reference_images', timestamps: true })
export class ReferenceImage {
  @Prop({ required: true, unique: true, index: true })
  referenceId: string;

  @Prop({ required: true, index: true })
  caseId: string;

  @Prop({ required: true, index: true })
  personId: string;

  @Prop({ required: true, default: 1 })
  setVersionAdded: number;

  @Prop({ default: null })
  setVersionRemoved?: number;

  @Prop({
    required: true,
    enum: [
      'face_front',
      'face_left',
      'face_right',
      'face_profile',
      'face_other',
      'full_body_front',
      'full_body_back',
      'full_body_side',
      'last_seen_clothing',
      'distinguishing_mark',
      'cctv_crop_verified',
      'other',
    ],
    default: 'face_front',
  })
  type: ReferenceImageType;

  @Prop({
    required: true,
    enum: ['family_upload', 'police', 'social_media', 'cctv_verified', 'other'],
    default: 'family_upload',
  })
  source: ReferenceSource;

  @Prop({ default: null })
  photoTakenAt?: string;

  @Prop({ required: true, default: 'Investigator' })
  uploadedBy: string;

  @Prop({ default: () => new Date().toISOString() })
  uploadedAt: string;

  @Prop({ required: true })
  originalUri: string;

  @Prop({ required: true })
  normalizedUri: string;

  @Prop({ required: true })
  thumbnailUri: string;

  @Prop({ required: true, index: true })
  sha256: string;

  @Prop({ required: true, index: true })
  pHash: string;

  @Prop({ required: true, default: true })
  exifStripped: boolean;

  @Prop({ type: ReferenceSubject, default: () => ({ faceCountDetected: 1, personCountDetected: 1 }) })
  subject: ReferenceSubject;

  @Prop({ type: ImageAnalysis, default: () => ({ status: 'ready', rejectReasons: [], warnings: [] }) })
  analysis: ImageAnalysis;

  @Prop({ type: ReferenceEmbeddings, default: () => ({}) })
  embeddings: ReferenceEmbeddings;

  @Prop({ default: false })
  isPrimary: boolean;

  @Prop({ default: 0.95 })
  consistencyScore?: number; // similarity to the rest of the set

  @Prop({ default: null })
  approvedBy?: string;

  @Prop({ default: null, index: true })
  deletedAt?: string;
}

export const ReferenceImageSchema = SchemaFactory.createForClass(ReferenceImage);

ReferenceImageSchema.index({ caseId: 1, deletedAt: 1 });
ReferenceImageSchema.index({ personId: 1, deletedAt: 1 });
ReferenceImageSchema.index({ sha256: 1, caseId: 1 });
