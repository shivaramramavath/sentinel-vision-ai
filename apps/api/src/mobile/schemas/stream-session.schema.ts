import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type StreamSessionDocument = StreamSession & Document;

@Schema({ _id: false })
export class StreamSessionStats {
  @Prop({ default: 0 })
  avgBitrateKbps: number;

  @Prop({ default: 0 })
  avgRttMs: number;

  @Prop({ default: 0 })
  reconnects: number;

  @Prop({ default: 100 })
  minBattery: number;
}

@Schema({ collection: 'stream_sessions', timestamps: true })
export class StreamSession {
  @Prop({ required: true, unique: true, index: true })
  sessionId: string;

  @Prop({ required: true, index: true })
  deviceId: string;

  @Prop({ required: true, index: true })
  cameraId: string;

  @Prop({ required: true, index: true })
  mobileUserId: string;

  @Prop({ required: true, default: () => new Date(), index: true })
  startedAt: Date;

  @Prop()
  endedAt?: Date;

  @Prop()
  endReason?: string;

  @Prop({ required: true, unique: true, index: true })
  publishTokenJti: string;

  @Prop({ default: 'node-01' })
  nodeId: string;

  @Prop({ type: StreamSessionStats, default: () => ({ avgBitrateKbps: 0, avgRttMs: 0, reconnects: 0, minBattery: 100 }) })
  stats: StreamSessionStats;

  @Prop()
  gpsTrackRef?: string;
}

export const StreamSessionSchema = SchemaFactory.createForClass(StreamSession);
