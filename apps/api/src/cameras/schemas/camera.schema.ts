import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum SourceType {
  CCTV_RTSP = 'cctv_rtsp',
  CCTV_ONVIF = 'cctv_onvif',
  MOBILE_WEBRTC = 'mobile_webrtc',
  MOBILE_RTMP = 'mobile_rtmp',
  USB_WEBCAM = 'usb_webcam',
  FILE_UPLOAD = 'file_upload',
}

export type CameraStatus =
  | 'registering'
  | 'online'
  | 'degraded'
  | 'offline'
  | 'disabled'
  | 'pending_pairing'
  | 'LIVE'; // Backwards compatibility alias for 'online'

export type MountingType = 'fixed' | 'mobile';
export type RecordMode = 'continuous' | 'motion' | 'event_only' | 'off';
export type RecordQuality = 'original' | 'economy';

@Schema({ _id: false })
export class IngestConfig {
  @Prop({ default: 'rtsp' })
  protocol: string;

  @Prop({ select: false }) // Excluded by default from database queries
  rtspUrlEncrypted?: string;

  @Prop({ select: false }) // Excluded by default from database queries
  streamKeyHash?: string;

  @Prop({ required: true, default: 'cam/default' })
  mediaPath: string; // e.g. "cam/{id}"

  @Prop({ default: 'node-edge-01' })
  assignedNode: string;
}

@Schema({ _id: false })
export class VideoProfile {
  @Prop({ default: 'h264' })
  codec: string;

  @Prop({ default: 1920 })
  width: number;

  @Prop({ default: 1080 })
  height: number;

  @Prop({ default: 30 })
  fps: number;

  @Prop({ default: 4096 })
  bitrateKbps: number;
}

@Schema({ _id: false })
export class ActiveHoursPolicy {
  @Prop({ default: '00:00' })
  from: string;

  @Prop({ default: '23:59' })
  to: string;
}

@Schema({ _id: false })
export class AiPolicy {
  @Prop({ default: true })
  enabled: boolean;

  @Prop({ default: 2.0 })
  sampleFps: number;

  @Prop({ default: 0.65 })
  minDetectionConf: number;

  @Prop({ type: ActiveHoursPolicy, required: false })
  activeHours?: ActiveHoursPolicy;
}

@Schema({ _id: false })
export class RecordPolicy {
  @Prop({ default: 'continuous', enum: ['continuous', 'motion', 'event_only', 'off'] })
  mode: RecordMode;

  @Prop({ default: 15 })
  segmentSec: number;

  @Prop({ default: 30 })
  retentionDays: number;

  @Prop({ default: 'original', enum: ['original', 'economy'] })
  quality: RecordQuality;
}

@Schema({ _id: false })
export class CameraAuthorization {
  @Prop({ required: true, default: true })
  consentConfirmed: boolean;

  @Prop({ default: 'Chief Intelligence Officer' })
  authorizedBy: string;

  @Prop({ default: Date.now })
  authorizedAt: Date;

  @Prop({ default: 'Surveillance & Public Safety Investigation' })
  purpose: string;

  @Prop({ default: 'Public Safety Act Section 14B & Judicial Warrant' })
  legalBasisNote: string;
}

@Schema({ _id: false })
export class CameraHealthState {
  @Prop({ default: Date.now })
  lastSeenAt: Date;

  @Prop({ default: Date.now })
  lastFrameAt: Date;

  @Prop({ default: 30 })
  fps: number;

  @Prop({ default: 4096 })
  bitrate: number;

  @Prop({ default: 0.0 })
  packetLoss: number;

  @Prop({ default: 45 })
  latencyMs: number;

  @Prop({ default: 0 })
  reconnects: number;

  @Prop({ default: 99.8 })
  uptimePercentage: number;

  @Prop({ default: 0 })
  clockOffsetMs: number;
}

@Schema({ _id: false })
export class RecordingGap {
  @Prop({ required: true, default: Date.now })
  startedAt: Date;

  @Prop({ required: false })
  endedAt?: Date;

  @Prop({ required: false })
  durationSec?: number;

  @Prop({ default: 'stream_offline' })
  reason: string;
}

@Schema({ _id: false })
export class MobileDeviceInfo {
  @Prop({ required: false })
  userAgent?: string;

  @Prop({ required: false })
  battery?: number;

  @Prop({ required: false })
  networkType?: string;
}

export type CameraDocument = Camera & Document;

@Schema({
  collection: 'cameras',
  timestamps: true,
  toJSON: {
    transform: (_, ret: any) => {
      // Security Invariant: Never return encrypted credentials or stream keys in API responses
      if (ret.ingest) {
        delete ret.ingest.rtspUrlEncrypted;
        delete ret.ingest.streamKeyHash;
      }
      return ret;
    },
  },
})
export class Camera {
  @Prop({ required: true, unique: true })
  id: string; // e.g. 'cam_001'

  @Prop({ required: false })
  cameraId?: string; // alias for id

  @Prop({ required: false, default: '' })
  cameraCode?: string;

  @Prop({ default: false })
  seed?: boolean;

  @Prop({ default: '' })
  seedKey?: string;

  @Prop({ required: true })
  name: string;

  @Prop({ default: 'Metro Concourse' })
  locationName: string;

  @Prop({ required: true, default: 17.3850 })
  latitude: number;

  @Prop({ required: true, default: 78.4867 })
  longitude: number;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (val: number[]) => Array.isArray(val) && val.length === 2,
        message: 'Coordinates must be [longitude, latitude]',
      },
    },
    _id: false,
  })
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };

  @Prop({ default: 'site_primary' })
  siteId: string;

  @Prop({ default: 'bld_central' })
  buildingId: string;

  @Prop({ default: 1 })
  floor: number;

  @Prop({
    required: true,
    enum: Object.values(SourceType),
    default: SourceType.CCTV_RTSP,
  })
  sourceType: SourceType;

  @Prop({
    required: true,
    enum: ['registering', 'online', 'degraded', 'offline', 'disabled', 'pending_pairing', 'LIVE'],
    default: 'online',
  })
  status: CameraStatus;

  @Prop({ default: 0 })
  headingDeg: number;

  @Prop({ default: 75 })
  fovDeg: number;

  @Prop({ default: 35 })
  rangeM: number;

  @Prop({ default: 'fixed', enum: ['fixed', 'mobile'] })
  mounting: MountingType;

  @Prop({ default: false })
  isMovable: boolean;

  @Prop({ default: Date.now })
  locationUpdatedAt: Date;

  @Prop({
    type: [{ coordinates: { type: [Number], required: true }, timestamp: { type: Date, required: true } }],
    default: [],
    _id: false,
  })
  locationHistory: Array<{ coordinates: [number, number]; timestamp: Date }>;

  @Prop({ type: IngestConfig, default: () => ({ mediaPath: 'cam/cam_default', assignedNode: 'node-01', protocol: 'rtsp' }) })
  ingest: IngestConfig;

  @Prop({ type: VideoProfile, default: () => ({ codec: 'h264', width: 1920, height: 1080, fps: 30, bitrateKbps: 4096 }) })
  video: VideoProfile;

  @Prop({ type: AiPolicy, default: () => ({ enabled: true, sampleFps: 2.0, minDetectionConf: 0.65 }) })
  aiPolicy: AiPolicy;

  @Prop({ type: RecordPolicy, default: () => ({ mode: 'continuous', segmentSec: 15, retentionDays: 30, quality: 'original' }) })
  recordPolicy: RecordPolicy;

  @Prop({ type: CameraAuthorization, required: true, default: () => ({ consentConfirmed: true, authorizedBy: 'Chief Director', authorizedAt: new Date(), purpose: 'Public Safety Investigation', legalBasisNote: 'Statutory Authority' }) })
  authorization: CameraAuthorization;

  @Prop({ type: CameraHealthState, default: () => ({ lastSeenAt: new Date(), lastFrameAt: new Date(), fps: 30, bitrate: 4096, packetLoss: 0, latencyMs: 45, reconnects: 0, uptimePercentage: 99.8 }) })
  health: CameraHealthState;

  @Prop({ type: MobileDeviceInfo, required: false })
  deviceInfo?: MobileDeviceInfo;

  @Prop({ type: [RecordingGap], default: [] })
  recordingGaps: RecordingGap[];

  @Prop({ default: 'admin@sentinel.gov' })
  createdBy: string;

  // Backwards compatibility fields
  @Prop({ default: 'rtsp://mediamtx:8554/cam/default' })
  streamUrl: string;

  @Prop({ default: 30 })
  fps: number;

  @Prop({ default: 0 })
  peopleCount: number;

  @Prop({ default: 'Terminal North' })
  zone: string;
}

export const CameraSchema = SchemaFactory.createForClass(Camera);

CameraSchema.index({ location: '2dsphere' });
CameraSchema.index({ siteId: 1 });
CameraSchema.index({ sourceType: 1 });
CameraSchema.index({ status: 1 });
CameraSchema.index({ 'ingest.mediaPath': 1 });
