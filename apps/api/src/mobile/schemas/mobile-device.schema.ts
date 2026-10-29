import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { MobileDeviceStatus } from '@sentinel/shared-types';

export type MobileDeviceDocument = MobileDevice & Document;

@Schema({ collection: 'mobile_devices', timestamps: true })
export class MobileDevice {
  @Prop({ required: true, unique: true, index: true })
  deviceId: string;

  @Prop({ required: true, index: true })
  mobileUserId: string;

  @Prop({ required: true, index: true })
  cameraId: string;

  @Prop({ required: true, trim: true })
  label: string;

  @Prop({ default: 'unknown' })
  platform: string;

  @Prop({ default: 'unknown' })
  browser: string;

  @Prop({ required: true })
  deviceKeyHash: string;

  @Prop({
    type: String,
    enum: ['pending_approval', 'approved', 'revoked'],
    default: 'approved',
    index: true,
  })
  status: MobileDeviceStatus;

  @Prop()
  approvedBy?: string;

  @Prop()
  approvedAt?: Date;

  @Prop()
  lastSeenAt?: Date;

  @Prop({ type: String, enum: ['environment', 'user'], default: 'environment' })
  defaultFacing: 'environment' | 'user';

  @Prop({ default: false })
  shareGps: boolean;
}

export const MobileDeviceSchema = SchemaFactory.createForClass(MobileDevice);
