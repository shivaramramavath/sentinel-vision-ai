import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { MobileUser, MobileUserDocument } from '../schemas/mobile-user.schema';
import { MobileDevice, MobileDeviceDocument } from '../schemas/mobile-device.schema';
import { StreamSession, StreamSessionDocument } from '../schemas/stream-session.schema';
import { MobileInvite, MobileInviteDocument } from '../schemas/mobile-invite.schema';
import { Camera, CameraDocument } from '../../cameras/schemas/camera.schema';
import { AuditService } from '../../audit/audit.service';
import { NotificationsGateway } from '../../notifications/notifications.gateway';
import { AdminCreateInviteDto } from '@sentinel/shared-types';

@Injectable()
export class MobileAdminService {
  private readonly logger = new Logger(MobileAdminService.name);

  constructor(
    @InjectModel(MobileUser.name) private readonly mobileUserModel: Model<MobileUserDocument>,
    @InjectModel(MobileDevice.name) private readonly mobileDeviceModel: Model<MobileDeviceDocument>,
    @InjectModel(StreamSession.name) private readonly streamSessionModel: Model<StreamSessionDocument>,
    @InjectModel(MobileInvite.name) private readonly mobileInviteModel: Model<MobileInviteDocument>,
    @InjectModel(Camera.name) private readonly cameraModel: Model<CameraDocument>,
    private readonly auditService: AuditService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  private hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  async listUsers(status?: string) {
    const filter: Record<string, any> = {};
    if (status && status !== 'all') {
      filter.status = status;
    }
    const users = await this.mobileUserModel.find(filter).sort({ createdAt: -1 });
    return users.map((u) => ({
      mobileUserId: u.mobileUserId,
      fullName: u.fullName,
      email: u.email,
      phoneE164: u.phoneE164,
      status: u.status,
      siteIds: u.siteIds,
      invitedByInviteId: u.invitedByInviteId,
      consent: u.consent,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.get('createdAt'),
    }));
  }

  async updateUserStatus(
    mobileUserId: string,
    action: 'approve' | 'reject' | 'suspend' | 'reactivate',
    adminId = 'usr_admin',
  ) {
    const user = await this.mobileUserModel.findOne({ mobileUserId });
    if (!user) throw new NotFoundException('Mobile operator not found');

    const statusMap = {
      approve: 'active' as const,
      reject: 'rejected' as const,
      suspend: 'suspended' as const,
      reactivate: 'active' as const,
    };

    const newStatus = statusMap[action];
    user.status = newStatus;
    await user.save();

    await this.auditService.recordLog({
      action: `MOBILE_USER_${action.toUpperCase()}`,
      actor: {
        userId: adminId,
        email: 'admin@sentinel.gov',
        role: 'admin',
      },
      entity: {
        type: 'mobile_user',
        id: mobileUserId,
      },
      correlationId: `corr_${Date.now()}`,
      metadata: { mobileUserId, newStatus },
    });

    return { success: true, mobileUserId, status: newStatus };
  }

  async listDevices(status?: string) {
    const filter: Record<string, any> = {};
    if (status && status !== 'all') {
      filter.status = status;
    }
    const devices = await this.mobileDeviceModel.find(filter).sort({ createdAt: -1 });

    // Join operator names
    const userIds = [...new Set(devices.map((d) => d.mobileUserId))];
    const users = await this.mobileUserModel.find({ mobileUserId: { $in: userIds } });
    const userMap = new Map(users.map((u) => [u.mobileUserId, u]));

    return devices.map((d) => {
      const user = userMap.get(d.mobileUserId);
      return {
        deviceId: d.deviceId,
        mobileUserId: d.mobileUserId,
        operatorName: user?.fullName || 'Unknown Operator',
        operatorEmail: user?.email || '',
        cameraId: d.cameraId,
        label: d.label,
        platform: d.platform,
        browser: d.browser,
        status: d.status,
        defaultFacing: d.defaultFacing,
        shareGps: d.shareGps,
        lastSeenAt: d.lastSeenAt,
        createdAt: d.get('createdAt'),
      };
    });
  }

  async updateDeviceStatus(
    deviceId: string,
    action: 'approve' | 'revoke',
    adminId = 'usr_admin',
  ) {
    const device = await this.mobileDeviceModel.findOne({ deviceId });
    if (!device) throw new NotFoundException('Device not found');

    device.status = action === 'approve' ? 'approved' : 'revoked';
    if (action === 'approve') {
      device.approvedBy = adminId;
      device.approvedAt = new Date();
    }
    await device.save();

    if (action === 'revoke') {
      // Terminate any active sessions
      await this.streamSessionModel.updateMany(
        { deviceId, endedAt: { $exists: false } },
        { endedAt: new Date(), endReason: 'admin_revoked' },
      );
    }

    await this.auditService.recordLog({
      action: `MOBILE_DEVICE_${action.toUpperCase()}`,
      actor: {
        userId: adminId,
        email: 'admin@sentinel.gov',
        role: 'admin',
      },
      entity: {
        type: 'mobile_device',
        id: deviceId,
      },
      correlationId: `corr_${Date.now()}`,
      metadata: { deviceId, status: device.status },
    });

    return { success: true, deviceId, status: device.status };
  }

  async createInvite(dto: AdminCreateInviteDto, adminId = 'usr_admin') {
    const inviteId = `minv_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    // Generate human-friendly alphanumeric 8-char code (e.g. SENT-7A9B)
    const rawCode = `SENT-${randomBytes(3).toString('hex').toUpperCase()}`;
    const codeHash = this.hashSecret(rawCode);

    const expiresAt = new Date(Date.now() + (dto.expiresInHours || 72) * 3600 * 1000);

    const invite = new this.mobileInviteModel({
      inviteId,
      codeHash,
      siteId: dto.siteId,
      createdBy: adminId,
      expiresAt,
      maxUses: dto.maxUses || 10,
      usedCount: 0,
      autoApprove: dto.autoApprove || false,
      allowedEmailDomains: dto.allowedEmailDomains || [],
    });

    await invite.save();

    await this.auditService.recordLog({
      action: 'MOBILE_INVITE_CREATED',
      actor: {
        userId: adminId,
        email: 'admin@sentinel.gov',
        role: 'admin',
      },
      entity: {
        type: 'mobile_invite',
        id: inviteId,
      },
      correlationId: `corr_${Date.now()}`,
      metadata: { inviteId, siteId: dto.siteId, autoApprove: dto.autoApprove },
    });

    return {
      inviteId,
      inviteCode: rawCode,
      registrationUrl: `http://localhost:3000/m/register?invite=${rawCode}`,
      siteId: invite.siteId,
      expiresAt: invite.expiresAt,
      maxUses: invite.maxUses,
      autoApprove: invite.autoApprove,
    };
  }

  async listInvites() {
    const invites = await this.mobileInviteModel.find().sort({ createdAt: -1 });
    return invites.map((inv) => ({
      inviteId: inv.inviteId,
      siteId: inv.siteId,
      createdBy: inv.createdBy,
      expiresAt: inv.expiresAt,
      maxUses: inv.maxUses,
      usedCount: inv.usedCount,
      autoApprove: inv.autoApprove,
      allowedEmailDomains: inv.allowedEmailDomains,
      revokedAt: inv.revokedAt,
      isExpired: new Date() > inv.expiresAt,
      isRevoked: Boolean(inv.revokedAt),
      createdAt: inv.get('createdAt'),
    }));
  }

  async revokeInvite(inviteId: string, adminId = 'usr_admin') {
    const invite = await this.mobileInviteModel.findOne({ inviteId });
    if (!invite) throw new NotFoundException('Invite not found');

    invite.revokedAt = new Date();
    await invite.save();

    await this.auditService.recordLog({
      action: 'MOBILE_INVITE_REVOKED',
      actor: {
        userId: adminId,
        email: 'admin@sentinel.gov',
        role: 'admin',
      },
      entity: {
        type: 'mobile_invite',
        id: inviteId,
      },
      correlationId: `corr_${Date.now()}`,
      metadata: { inviteId },
    });

    return { success: true, inviteId };
  }

  async getActiveSessions() {
    // Sessions without endedAt and started within last 4 hours
    const activeSessions = await this.streamSessionModel
      .find({
        endedAt: { $exists: false },
        startedAt: { $gt: new Date(Date.now() - 4 * 3600 * 1000) },
      })
      .sort({ startedAt: -1 });

    const userIds = activeSessions.map((s) => s.mobileUserId);
    const users = await this.mobileUserModel.find({ mobileUserId: { $in: userIds } });
    const userMap = new Map(users.map((u) => [u.mobileUserId, u]));

    const cameraIds = activeSessions.map((s) => s.cameraId);
    const cameras = await this.cameraModel.find({ id: { $in: cameraIds } });
    const cameraMap = new Map(cameras.map((c) => [c.id, c]));

    return activeSessions.map((s) => {
      const user = userMap.get(s.mobileUserId);
      const cam = cameraMap.get(s.cameraId) as any;
      return {
        sessionId: s.sessionId,
        deviceId: s.deviceId,
        cameraId: s.cameraId,
        cameraName: cam?.name || s.cameraId,
        mobileUserId: s.mobileUserId,
        operatorName: user?.fullName || 'Mobile Operator',
        operatorEmail: user?.email || '',
        startedAt: s.startedAt,
        stats: s.stats,
        thumbnailUrl: cam?.thumbnailUrl || 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=400&q=80',
        rttMs: s.stats.avgRttMs || 42,
        battery: s.stats.minBattery || 88,
        gps: cam?.latitude && cam?.longitude ? { lat: cam.latitude, lng: cam.longitude } : undefined,
      };
    });
  }
}
