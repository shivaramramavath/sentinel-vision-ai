import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SystemAlertDocument = SystemAlert & Document;

@Schema({ collection: 'alerts', timestamps: true })
export class SystemAlert {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ default: 'general' })
  dedupeKey: string;

  @Prop({ default: 1 })
  occurrenceCount: number;

  @Prop({ required: true })
  type: string; // 'detection' | 'camera' | 'system' | 'case' | 'queue'

  @Prop({ default: 'warning' })
  severity: string; // 'critical' | 'warning' | 'info'

  @Prop({ default: 'new' })
  status: string; // 'new' | 'acknowledged' | 'assigned' | 'snoozed' | 'resolved'

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ required: true })
  timestamp: string;

  @Prop({ default: false })
  read: boolean;

  @Prop({ default: null })
  caseId?: string;

  @Prop({ default: null })
  caseNumber?: string;

  @Prop({ default: null })
  personName?: string;

  @Prop({ default: null })
  sightingId?: string;

  @Prop({ default: null })
  cameraId?: string;

  @Prop({ default: null })
  cameraCode?: string;

  @Prop({ default: null })
  locationName?: string;

  @Prop({ default: null })
  candidateCropUrl?: string;

  @Prop({ default: null })
  referenceCropUrl?: string;

  @Prop({ default: null })
  fusedScore?: number;

  @Prop({ default: null })
  assigneeId?: string;

  @Prop({ default: null })
  assigneeName?: string;

  @Prop({ default: null })
  snoozedUntil?: string;

  @Prop({ default: null })
  slaDueAt?: string;

  @Prop({ default: false })
  isEscalated: boolean;

  @Prop({ default: null })
  resolutionNote?: string;

  @Prop({ default: false })
  seed?: boolean;

  @Prop({ default: '' })
  seedKey?: string;
}

export const SystemAlertSchema = SchemaFactory.createForClass(SystemAlert);

SystemAlertSchema.index({ status: 1 });
SystemAlertSchema.index({ severity: 1 });
SystemAlertSchema.index({ dedupeKey: 1 });
SystemAlertSchema.index({ timestamp: -1 });
