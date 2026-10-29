import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CameraTopologyDocument = CameraTopology & Document;

@Schema({ collection: 'camera_topology', timestamps: true })
export class CameraTopology {
  @Prop({ required: true })
  fromCamera: string; // cameraId

  @Prop({ required: true })
  toCamera: string; // cameraId

  @Prop({ required: true, min: 0 })
  minTravelSec: number;

  @Prop({ required: true, min: 0 })
  maxTravelSec: number;

  @Prop({ default: 100 })
  distanceMeters: number;

  @Prop({ default: 1.0 })
  transitionProb: number;

  @Prop({ default: 'lognormal' })
  distributionType: string;

  // Learned empirical parameters (Welford's algorithm)
  @Prop({ default: 0 })
  sampleCount: number;

  @Prop({ default: 0 })
  meanTravelSec: number;

  @Prop({ default: 0 })
  m2TravelSec: number;

  @Prop({ default: 0 })
  stdTravelSec: number;

  @Prop({ default: false })
  seed?: boolean;

  @Prop({ default: '' })
  seedKey?: string;
}

export const CameraTopologySchema = SchemaFactory.createForClass(CameraTopology);

CameraTopologySchema.index({ fromCamera: 1, toCamera: 1 }, { unique: true });
CameraTopologySchema.index({ fromCamera: 1 });
CameraTopologySchema.index({ toCamera: 1 });
