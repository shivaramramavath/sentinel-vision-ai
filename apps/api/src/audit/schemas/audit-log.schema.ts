import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

@Schema({ _id: false })
export class AuditActor {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  role: string;
}

@Schema({ _id: false })
export class AuditEntity {
  @Prop({ required: true })
  type: string; // e.g. 'Evidence', 'Sighting', 'Case', 'User'

  @Prop({ required: true })
  id: string;
}

@Schema({ collection: 'audit_logs', timestamps: { createdAt: 'at', updatedAt: false } })
export class AuditLog {
  @Prop({ type: AuditActor, required: true })
  actor: AuditActor;

  @Prop({ required: true })
  action: string; // e.g. 'READ_EVIDENCE', 'VERIFY_SIGHTING', 'LOGIN', etc.

  @Prop({ type: AuditEntity, required: true })
  entity: AuditEntity;

  @Prop({ default: 'unknown' })
  ipAddress: string;

  @Prop({ default: 'unknown' })
  userAgent: string;

  @Prop({ required: true })
  correlationId: string;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({ default: () => new Date() })
  at: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// Immutable indexes for rapid querying
AuditLogSchema.index({ 'actor.userId': 1, at: -1 });
AuditLogSchema.index({ 'entity.type': 1, 'entity.id': 1, at: -1 });
AuditLogSchema.index({ at: -1 });
