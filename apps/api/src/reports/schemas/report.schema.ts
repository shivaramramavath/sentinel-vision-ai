import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SystemReportDocument = SystemReport & Document;

@Schema({ collection: 'system_reports', timestamps: true })
export class SystemReport {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  caseId: string;

  @Prop({ required: true })
  title: string;

  @Prop({ default: 'investigation_summary' })
  type: string;

  @Prop({ required: true })
  generatedBy: string;

  @Prop({ default: () => new Date().toISOString() })
  generatedAt: string;

  @Prop({ required: true, enum: ['PDF', 'CSV'] })
  format: 'PDF' | 'CSV';

  @Prop({ default: '2.8 MB' })
  fileSize: string;

  @Prop({ default: '' })
  downloadUrl: string;

  @Prop({ default: false })
  seed?: boolean;

  @Prop({ default: '' })
  seedKey?: string;
}

export const SystemReportSchema = SchemaFactory.createForClass(SystemReport);

SystemReportSchema.index({ caseId: 1 });
SystemReportSchema.index({ generatedAt: -1 });
