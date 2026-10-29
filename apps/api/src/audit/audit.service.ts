import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

export interface CreateAuditLogParams {
  actor: {
    userId: string;
    email: string;
    role: string;
  };
  action: string;
  entity: {
    type: string;
    id: string;
  };
  ipAddress?: string;
  userAgent?: string;
  correlationId: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
  ) {}

  async recordLog(params: CreateAuditLogParams): Promise<AuditLogDocument> {
    const log = new this.auditLogModel({
      actor: params.actor,
      action: params.action,
      entity: params.entity,
      ipAddress: params.ipAddress || 'unknown',
      userAgent: params.userAgent || 'unknown',
      correlationId: params.correlationId,
      metadata: params.metadata || {},
      at: new Date(),
    });

    const saved = await log.save();
    this.logger.log(
      `[Audit] Action=${params.action} Entity=${params.entity.type}:${params.entity.id} Actor=${params.actor.email} CorrelationId=${params.correlationId}`,
    );
    return saved;
  }

  async getRecentLogs(limit = 100): Promise<AuditLogDocument[]> {
    return this.auditLogModel.find().sort({ at: -1 }).limit(limit).exec();
  }

  async getLogsByEntity(type: string, id: string): Promise<AuditLogDocument[]> {
    return this.auditLogModel
      .find({ 'entity.type': type, 'entity.id': id })
      .sort({ at: -1 })
      .exec();
  }

  async getLogsByActor(userId: string): Promise<AuditLogDocument[]> {
    return this.auditLogModel
      .find({ 'actor.userId': userId })
      .sort({ at: -1 })
      .exec();
  }
}
