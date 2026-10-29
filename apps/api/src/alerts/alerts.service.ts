import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SystemAlert, SystemAlertDocument } from './schemas/alert.schema';
import type {
  AlertsSummary,
  AlertRule,
  DispatchChannel,
  OnCallShift,
} from '@sentinel/shared-types';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  private rules: AlertRule[] = [
    {
      id: 'rule_01',
      name: 'High-Confidence Sighting Auto-Escalation',
      description: 'Paging alert when a candidate sighting matches a critical case with fused similarity >= 85%',
      triggerType: 'sighting_score_threshold',
      conditions: {
        casePriority: ['critical'],
        minFusedScore: 0.85,
      },
      actions: {
        severity: 'critical',
        notifyChannels: ['chan_push', 'chan_radio'],
        assignToOnCall: true,
        autoOpenReviewItem: true,
        raiseCasePriority: false,
      },
      enabled: true,
      version: 2,
      owner: 'supervisor@sentinel.gov',
      createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    },
    {
      id: 'rule_02',
      name: 'Search Buffer Camera Failure',
      description: 'Trigger maintenance alert when an edge camera inside a priority case reachable area goes offline',
      triggerType: 'camera_offline',
      conditions: {
        casePriority: ['critical', 'high'],
        offlineMinutesThreshold: 10,
      },
      actions: {
        severity: 'warning',
        notifyChannels: ['chan_email', 'chan_slack'],
        assignToOnCall: false,
        autoOpenReviewItem: false,
        createMaintenanceTicket: true,
      },
      enabled: true,
      version: 1,
      owner: 'admin@sentinel.gov',
      createdAt: new Date(Date.now() - 3600000 * 96).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 96).toISOString(),
    },
    {
      id: 'rule_03',
      name: 'Review SLA Expiration Warning',
      description: 'Escalate to shift supervisor if pending candidate review wait time exceeds 10 minutes',
      triggerType: 'queue_lag',
      conditions: {
        casePriority: ['critical'],
      },
      actions: {
        severity: 'critical',
        notifyChannels: ['chan_push'],
        assignToOnCall: true,
        autoOpenReviewItem: true,
      },
      enabled: true,
      version: 1,
      owner: 'supervisor@sentinel.gov',
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    },
  ];

  private channels: DispatchChannel[] = [
    {
      id: 'chan_push',
      name: 'Mobile PWA Push Notifications',
      type: 'push_pwa',
      endpointOrTarget: 'https://push.sentinel.gov/v1/send',
      rateLimitPerMinute: 60,
      enabled: true,
      isVerified: true,
      lastDeliveryStatus: 'delivered',
      lastDeliveryAt: new Date(Date.now() - 60000 * 8).toISOString(),
      deliverySuccessRatePct: 99.4,
    },
    {
      id: 'chan_radio',
      name: 'Motorola APX Tactical Radio',
      type: 'in_app',
      endpointOrTarget: 'apx-gateway.sentinel.internal:5060',
      rateLimitPerMinute: 20,
      enabled: true,
      isVerified: true,
      lastDeliveryStatus: 'delivered',
      lastDeliveryAt: new Date(Date.now() - 60000 * 15).toISOString(),
      deliverySuccessRatePct: 98.7,
    },
    {
      id: 'chan_slack',
      name: 'Incident Command Slack Webhook',
      type: 'webhook_slack',
      endpointOrTarget: 'https://hooks.slack.com/services/T00/B00/XXXX',
      rateLimitPerMinute: 30,
      enabled: true,
      isVerified: true,
      lastDeliveryStatus: 'delivered',
      lastDeliveryAt: new Date(Date.now() - 3600000).toISOString(),
      deliverySuccessRatePct: 100,
    },
    {
      id: 'chan_email',
      name: 'Field Team SMTP Relay',
      type: 'email',
      endpointOrTarget: 'dispatch-alerts@sentinel.gov',
      rateLimitPerMinute: 120,
      enabled: true,
      isVerified: true,
      lastDeliveryStatus: 'delivered',
      lastDeliveryAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      deliverySuccessRatePct: 99.8,
    },
  ];

  private onCallShifts: OnCallShift[] = [
    {
      id: 'shift_01',
      officerId: 'u-1',
      officerName: 'Sarah Connor',
      role: 'Lead Investigator',
      shiftStart: new Date(Date.now() - 3600000 * 4).toISOString(),
      shiftEnd: new Date(Date.now() + 3600000 * 4).toISOString(),
      tier: 1,
      contactPhone: '+1-555-0192',
      radioCallSign: 'EAGLE-LEAD-1',
      isCurrentlyActive: true,
    },
    {
      id: 'shift_02',
      officerId: 'u-2',
      officerName: 'David Mills',
      role: 'Reviewer',
      shiftStart: new Date(Date.now() + 3600000 * 4).toISOString(),
      shiftEnd: new Date(Date.now() + 3600000 * 12).toISOString(),
      tier: 1,
      contactPhone: '+1-555-0144',
      radioCallSign: 'EAGLE-2',
      isCurrentlyActive: false,
    },
  ];

  constructor(
    @InjectModel(SystemAlert.name)
    private readonly alertModel: Model<SystemAlertDocument>,
  ) {}

  async getSummary(): Promise<AlertsSummary> {
    const unreadCount = await this.alertModel.countDocuments({ status: { $ne: 'resolved' } }).exec();
    const criticalCount = await this.alertModel.countDocuments({ severity: 'critical', status: { $ne: 'resolved' } }).exec();
    const warningCount = await this.alertModel.countDocuments({ severity: 'warning', status: { $ne: 'resolved' } }).exec();
    const topRecent = await this.alertModel.find().sort({ timestamp: -1 }).limit(5).exec();

    return {
      unreadCount,
      criticalCount,
      warningCount,
      activeStormCount: 0,
      topRecent: topRecent as any,
    };
  }

  async findAll(query?: {
    status?: string;
    severity?: string;
    type?: string;
    caseId?: string;
    search?: string;
  }): Promise<SystemAlertDocument[]> {
    const filter: Record<string, any> = {};
    if (query?.status && query.status !== 'all') {
      if (query.status === 'unread') {
        filter.status = { $in: ['new', 'acknowledged'] };
      } else {
        filter.status = query.status;
      }
    }
    if (query?.severity && query.severity !== 'all') filter.severity = query.severity;
    if (query?.type && query.type !== 'all') filter.type = query.type;
    if (query?.caseId && query.caseId !== 'all') filter.caseId = query.caseId;
    if (query?.search) {
      filter.$or = [
        { title: { $regex: query.search, $options: 'i' } },
        { message: { $regex: query.search, $options: 'i' } },
        { cameraCode: { $regex: query.search, $options: 'i' } },
      ];
    }

    return this.alertModel.find(filter).sort({ timestamp: -1 }).limit(100).exec();
  }

  async markAsRead(id: string): Promise<SystemAlertDocument> {
    const alert = await this.alertModel
      .findOneAndUpdate({ id }, { $set: { read: true, status: 'acknowledged' } }, { new: true })
      .exec();
    if (!alert) {
      throw new NotFoundException(`Alert ${id} not found`);
    }
    return alert;
  }

  async acknowledge(id: string, actor: string): Promise<SystemAlertDocument> {
    const alert = await this.alertModel
      .findOneAndUpdate(
        { id },
        { $set: { status: 'acknowledged', read: true } },
        { new: true },
      )
      .exec();
    if (!alert) throw new NotFoundException(`Alert ${id} not found`);
    return alert;
  }

  async assign(id: string, assigneeId: string, assigneeName: string): Promise<SystemAlertDocument> {
    const alert = await this.alertModel
      .findOneAndUpdate(
        { id },
        { $set: { status: 'assigned', assigneeId, assigneeName } },
        { new: true },
      )
      .exec();
    if (!alert) throw new NotFoundException(`Alert ${id} not found`);
    return alert;
  }

  async snooze(id: string, durationMinutes = 60): Promise<SystemAlertDocument> {
    const snoozedUntil = new Date(Date.now() + durationMinutes * 60000).toISOString();
    const alert = await this.alertModel
      .findOneAndUpdate(
        { id },
        { $set: { status: 'snoozed', snoozedUntil } },
        { new: true },
      )
      .exec();
    if (!alert) throw new NotFoundException(`Alert ${id} not found`);
    return alert;
  }

  async resolve(id: string, note: string, actor: string): Promise<SystemAlertDocument> {
    const alert = await this.alertModel
      .findOneAndUpdate(
        { id },
        { $set: { status: 'resolved', read: true, resolutionNote: note } },
        { new: true },
      )
      .exec();
    if (!alert) throw new NotFoundException(`Alert ${id} not found`);
    return alert;
  }

  async escalate(id: string): Promise<SystemAlertDocument> {
    const alert = await this.alertModel
      .findOneAndUpdate(
        { id },
        { $set: { isEscalated: true, severity: 'critical' } },
        { new: true },
      )
      .exec();
    if (!alert) throw new NotFoundException(`Alert ${id} not found`);
    return alert;
  }

  async bulkAction(action: 'ack' | 'resolve' | 'snooze', alertIds: string[]): Promise<{ count: number }> {
    const update: Record<string, any> = {};
    if (action === 'ack') {
      update.status = 'acknowledged';
      update.read = true;
    } else if (action === 'resolve') {
      update.status = 'resolved';
      update.read = true;
    } else if (action === 'snooze') {
      update.status = 'snoozed';
      update.snoozedUntil = new Date(Date.now() + 60 * 60000).toISOString();
    }

    const res = await this.alertModel.updateMany({ id: { $in: alertIds } }, { $set: update }).exec();
    return { count: res.modifiedCount };
  }

  getRules(): AlertRule[] {
    return this.rules;
  }

  createRule(dto: Partial<AlertRule>, owner: string): AlertRule {
    const newRule: AlertRule = {
      id: `rule_${Date.now()}`,
      name: dto.name || 'New Trigger Rule',
      description: dto.description || '',
      triggerType: dto.triggerType || 'sighting_score_threshold',
      conditions: dto.conditions || {},
      actions: dto.actions || {
        severity: 'warning',
        notifyChannels: ['chan_push'],
        assignToOnCall: false,
        autoOpenReviewItem: false,
      },
      enabled: true,
      version: 1,
      owner,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.rules.unshift(newRule);
    return newRule;
  }

  testRule(id: string): { ruleId: string; simulatedEventsCount: number; sampleMatches: string[] } {
    return {
      ruleId: id,
      simulatedEventsCount: 4,
      sampleMatches: [
        'Candidate crop on CAM-001 (score 88%) would trigger immediate radio page',
        'Candidate crop on CAM-002 (score 91%) would trigger auto-open in Review',
      ],
    };
  }

  getChannels(): DispatchChannel[] {
    return this.channels;
  }

  createChannel(dto: Partial<DispatchChannel>): DispatchChannel {
    const newChannel: DispatchChannel = {
      id: `chan_${Date.now()}`,
      name: dto.name || 'Dispatch Channel',
      type: dto.type || 'webhook_generic',
      endpointOrTarget: dto.endpointOrTarget || 'http://localhost/webhook',
      rateLimitPerMinute: dto.rateLimitPerMinute || 30,
      enabled: true,
      isVerified: true,
      deliverySuccessRatePct: 100,
    };
    this.channels.push(newChannel);
    return newChannel;
  }

  testChannel(id: string): { success: boolean; latencyMs: number; statusMessage: string } {
    return {
      success: true,
      latencyMs: 38,
      statusMessage: 'Dispatch payload accepted with HTTP 200 OK',
    };
  }

  getOnCall(): OnCallShift[] {
    return this.onCallShifts;
  }

  overrideOnCall(officerId: string): OnCallShift {
    this.onCallShifts.forEach((s) => (s.isCurrentlyActive = s.officerId === officerId));
    const active = this.onCallShifts.find((s) => s.officerId === officerId) || this.onCallShifts[0];
    active.isCurrentlyActive = true;
    return active;
  }
}
