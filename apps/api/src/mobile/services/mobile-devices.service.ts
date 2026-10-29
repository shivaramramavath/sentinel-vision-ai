import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { MobileDevice, MobileDeviceDocument } from '../schemas/mobile-device.schema';
import { StreamSession, StreamSessionDocument } from '../schemas/stream-session.schema';
import { MobileUser, MobileUserDocument } from '../schemas/mobile-user.schema';
import { Camera, CameraDocument } from '../../cameras/schemas/camera.schema';
import { RedisService } from '../../common/redis/redis.service';
import { KafkaService } from '../../common/kafka/kafka.service';
import { NotificationsGateway } from '../../notifications/notifications.gateway';
import { AuditService } from '../../audit/audit.service';
import {
  MobileAddDeviceDto,
  SessionHeartbeatDto,
} from '@sentinel/shared-types';

@Injectable()
export class MobileDevicesService {
  private readonly logger = new Logger(MobileDevicesService.name);
  private readonly mobileSecret: string;
  private readonly turnSecret: string;
  private readonly mediaBaseUrl: string;

  constructor(
    @InjectModel(MobileDevice.name) private readonly mobileDeviceModel: Model<MobileDeviceDocument>,
    @InjectModel(StreamSession.name) private readonly streamSessionModel: Model<StreamSessionDocument>,
    @InjectModel(MobileUser.name) private readonly mobileUserModel: Model<MobileUserDocument>,
    @InjectModel(Camera.name) private readonly cameraModel: Model<CameraDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly kafkaService: KafkaService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly auditService: AuditService,
  ) {
    this.mobileSecret = this.configService.get<string>(
      'app.jwtMobileSecret',
      'sentinel-mobile-realm-secret-2026',
    );
    this.turnSecret = this.configService.get<string>(
      'app.turnSecret',
      'sentinel-coturn-shared-secret-2026',
    );
    this.mediaBaseUrl = this.configService.get<string>(
      'app.mediaBaseUrl',
      'http://localhost:8889',
    ).replace(/\/+$/, '');
  }

  private hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  async getProfile(mobileUserId: string) {
    const user = await this.mobileUserModel.findOne({ mobileUserId });
    if (!user) throw new NotFoundException('Mobile operator not found');

    return {
      mobileUserId: user.mobileUserId,
      fullName: user.fullName,
      email: user.email,
      phoneE164: user.phoneE164,
      status: user.status,
      siteIds: user.siteIds,
      consent: user.consent,
      createdAt: user.get('createdAt'),
    };
  }

  async addDevice(mobileUserId: string, dto: MobileAddDeviceDto) {
    const user = await this.mobileUserModel.findOne({ mobileUserId });
    if (!user || user.status !== 'active') {
      throw new ForbiddenException('Only active mobile operators can register streaming devices');
    }

    const deviceId = `mdev_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const cameraId = `cam_mob_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
    const rawDeviceKey = randomBytes(32).toString('hex');
    const deviceKeyHash = this.hashSecret(rawDeviceKey);

    const primarySiteId = user.siteIds[0] || 'site_primary';

    // 1. Create matching Camera record in MongoDB
    const camera = new this.cameraModel({
      id: cameraId,
      name: `Mobile: ${dto.label} (${user.fullName.split(' ')[0]})`,
      sourceType: 'mobile_webrtc',
      status: 'offline',
      mounting: 'mobile',
      siteId: primarySiteId,
      zone: 'Zone Mobile Broadcasters',
      locationName: 'Dynamic Mobile Stream',
      latitude: 17.3850,
      longitude: 78.4867,
      location: {
        type: 'Point',
        coordinates: [78.4867, 17.3850],
      },
      coords: [17.3850, 78.4867],
      mediaPath: `cam/${cameraId}`,
      aiPolicy: {
        enabled: true,
        sampleFps: 2.0,
        minDetectionConf: 0.65,
      },
      retentionPolicy: {
        retentionDays: 14,
        recordMode: 'continuous',
      },
      authorization: {
        statutoryLegalBasis: 'Statutory Operational Directive',
        consentConfirmed: true,
        authorizedOfficerName: user.fullName,
        authorizedAt: new Date().toISOString(),
      },
    });

    await camera.save();

    // 2. Create MobileDevice record
    const device = new this.mobileDeviceModel({
      deviceId,
      mobileUserId,
      cameraId,
      label: dto.label.trim(),
      platform: dto.platform,
      browser: dto.browser,
      deviceKeyHash,
      status: 'approved', // auto-approved for verified active operators
      defaultFacing: dto.defaultFacing,
      shareGps: dto.shareGps,
    });

    await device.save();

    await this.auditService.recordLog({
      action: 'MOBILE_DEVICE_ADDED',
      actor: {
        userId: mobileUserId,
        email: user.email,
        role: 'mobile_operator',
      },
      entity: {
        type: 'mobile_device',
        id: deviceId,
      },
      correlationId: `corr_${Date.now()}`,
      metadata: { deviceId, cameraId, label: dto.label, shareGps: dto.shareGps },
    });

    // Return deviceId and raw one-time deviceKey for IndexedDB storage
    return {
      deviceId,
      cameraId,
      label: device.label,
      status: device.status,
      deviceKey: rawDeviceKey,
      defaultFacing: device.defaultFacing,
      shareGps: device.shareGps,
    };
  }

  async listDevices(mobileUserId: string) {
    const devices = await this.mobileDeviceModel
      .find({ mobileUserId, status: { $ne: 'revoked' } })
      .sort({ createdAt: -1 });

    return devices.map((d) => ({
      deviceId: d.deviceId,
      cameraId: d.cameraId,
      label: d.label,
      platform: d.platform,
      browser: d.browser,
      status: d.status,
      defaultFacing: d.defaultFacing,
      shareGps: d.shareGps,
      lastSeenAt: d.lastSeenAt,
      createdAt: d.get('createdAt'),
    }));
  }

  async updateDevice(
    mobileUserId: string,
    deviceId: string,
    dto: Partial<{ label: string; defaultFacing: 'environment' | 'user'; shareGps: boolean }>,
  ) {
    const device = await this.mobileDeviceModel.findOne({ deviceId, mobileUserId });
    if (!device) throw new NotFoundException('Device not found');

    if (dto.label) device.label = dto.label.trim();
    if (dto.defaultFacing) device.defaultFacing = dto.defaultFacing;
    if (typeof dto.shareGps === 'boolean') device.shareGps = dto.shareGps;

    await device.save();
    return { success: true, device };
  }

  async deleteDevice(mobileUserId: string, deviceId: string) {
    const device = await this.mobileDeviceModel.findOne({ deviceId, mobileUserId });
    if (!device) throw new NotFoundException('Device not found');

    device.status = 'revoked';
    await device.save();

    // Revoke any active sessions
    await this.streamSessionModel.updateMany(
      { deviceId, endedAt: { $exists: false } },
      { endedAt: new Date(), endReason: 'device_revoked' },
    );

    return { success: true };
  }

  async startSession(mobileUserId: string, deviceId: string, clientDeviceKey?: string) {
    const user = await this.mobileUserModel.findOne({ mobileUserId });
    if (!user || user.status !== 'active') {
      throw new ForbiddenException('Mobile operator is not active');
    }

    const device = await this.mobileDeviceModel.findOne({ deviceId, mobileUserId });
    if (!device) throw new NotFoundException('Device not found');

    if (device.status !== 'approved') {
      throw new ForbiddenException(`Device is not approved to stream (Status: ${device.status})`);
    }

    // Optional device key binding validation
    if (clientDeviceKey) {
      const hash = this.hashSecret(clientDeviceKey);
      if (hash !== device.deviceKeyHash) {
        this.logger.warn(`Device key mismatch on session start for device ${deviceId}`);
      }
    }

    // Terminate existing active sessions for this device
    await this.streamSessionModel.updateMany(
      { deviceId, endedAt: { $exists: false } },
      { endedAt: new Date(), endReason: 'superseded_by_new_session' },
    );

    const sessionId = `msess_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const jti = randomUUID();

    // Generate 5-minute single-path WHIP Publish Token
    const publishToken = await this.jwtService.signAsync(
      {
        sub: user.mobileUserId,
        deviceId: device.deviceId,
        cameraId: device.cameraId,
        path: `cam/${device.cameraId}`,
        action: 'publish',
        jti,
        aud: 'mobile',
      },
      {
        secret: this.mobileSecret,
        expiresIn: '5m',
      },
    );

    // Register active JTI in Redis with 300s TTL
    await this.redisService.set(`mobile:publish_jti:${jti}`, device.cameraId, 300);

    // Create StreamSession
    const session = new this.streamSessionModel({
      sessionId,
      deviceId: device.deviceId,
      cameraId: device.cameraId,
      mobileUserId,
      startedAt: new Date(),
      publishTokenJti: jti,
      nodeId: 'node-01',
      stats: { avgBitrateKbps: 0, avgRttMs: 0, reconnects: 0, minBattery: 100 },
    });

    await session.save();

    // Generate ephemeral TURN credentials using coturn REST secret
    const turnUsername = `${Math.floor(Date.now() / 1000) + 600}:${sessionId}`;
    const turnPassword = createHash('sha1')
      .update(`${turnUsername}:${this.turnSecret}`)
      .digest('base64');

    const whipUrl = `${this.mediaBaseUrl}/cam/${device.cameraId}/whip?token=${publishToken}`;

    await this.auditService.recordLog({
      action: 'MOBILE_STREAM_STARTED',
      actor: {
        userId: mobileUserId,
        email: user.email,
        role: 'mobile_operator',
      },
      entity: {
        type: 'stream_session',
        id: sessionId,
      },
      correlationId: `corr_${Date.now()}`,
      metadata: { sessionId, deviceId, cameraId: device.cameraId },
    });

    return {
      sessionId,
      cameraId: device.cameraId,
      whipUrl,
      whipEndpoint: `/cam/${device.cameraId}/whip`,
      publishToken,
      expiresInSeconds: 300,
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        {
          urls: 'turn:localhost:3478?transport=udp',
          username: turnUsername,
          credential: turnPassword,
        },
      ],
      constraints: {
        idealWidth: 1280,
        idealHeight: 720,
        maxFps: 30,
        maxBitrateKbps: 1800,
        h264Preferred: true,
      },
      serverTimeMs: Date.now(),
    };
  }

  async refreshToken(sessionId: string, mobileUserId: string) {
    const session = await this.streamSessionModel.findOne({ sessionId, mobileUserId, endedAt: { $exists: false } });
    if (!session) throw new NotFoundException('Active stream session not found');

    const newJti = randomUUID();
    const publishToken = await this.jwtService.signAsync(
      {
        sub: mobileUserId,
        deviceId: session.deviceId,
        cameraId: session.cameraId,
        path: `cam/${session.cameraId}`,
        action: 'publish',
        jti: newJti,
        aud: 'mobile',
      },
      {
        secret: this.mobileSecret,
        expiresIn: '5m',
      },
    );

    // Register new JTI in Redis
    await this.redisService.set(`mobile:publish_jti:${newJti}`, session.cameraId, 300);

    return { publishToken, expiresInSeconds: 300 };
  }

  async heartbeat(sessionId: string, mobileUserId: string, dto: SessionHeartbeatDto) {
    const session = await this.streamSessionModel.findOne({ sessionId, mobileUserId });
    if (!session) throw new NotFoundException('Session not found');

    const device = await this.mobileDeviceModel.findOne({ deviceId: session.deviceId });
    if (!device || device.status === 'revoked') {
      throw new ForbiddenException('Device has been revoked. Broadcast terminating.');
    }

    // 1. Update session telemetry
    if (typeof dto.bitrateKbps === 'number' && !isNaN(dto.bitrateKbps)) {
      session.stats.avgBitrateKbps = dto.bitrateKbps;
    }
    if (typeof dto.rttMs === 'number' && !isNaN(dto.rttMs)) {
      session.stats.avgRttMs = dto.rttMs;
    }
    const batteryNum =
      typeof dto.battery === 'number'
        ? dto.battery
        : typeof (dto as any)?.battery?.level === 'number'
        ? (dto as any).battery.level
        : undefined;

    if (typeof batteryNum === 'number' && !isNaN(batteryNum)) {
      session.stats.minBattery = Math.min(session.stats.minBattery ?? 100, batteryNum);
    }
    await session.save();

    // 2. Update device last seen
    device.lastSeenAt = new Date();
    await device.save();

    // 3. Update Camera health in Redis and DB
    const healthPayload = {
      cameraId: session.cameraId,
      status: 'LIVE',
      fps: dto.fps,
      battery: dto.battery,
      charging: dto.charging,
      networkType: dto.networkType,
      rttMs: dto.rttMs,
      bitrateKbps: dto.bitrateKbps,
      updatedAt: new Date().toISOString(),
    };

    await this.redisService.set(`camera:health:${session.cameraId}`, JSON.stringify(healthPayload), 30);

    // 4. Update GPS location if shared
    if (device.shareGps && dto.gps) {
      await this.cameraModel.updateOne(
        { id: session.cameraId },
        {
          latitude: dto.gps.lat,
          longitude: dto.gps.lng,
          coords: [dto.gps.lat, dto.gps.lng],
        },
      );

      // Publish to WebSocket
      this.notificationsGateway.broadcastCameraStatus(
        session.cameraId,
        'LIVE',
        dto.fps,
        1,
      );
    }

    return { status: 'ok', serverTimeMs: Date.now() };
  }

  async stopSession(sessionId: string, mobileUserId: string) {
    const session = await this.streamSessionModel.findOne({ sessionId, mobileUserId });
    if (!session) throw new NotFoundException('Session not found');

    session.endedAt = new Date();
    session.endReason = 'operator_stopped';
    await session.save();

    // Remove JTI from Redis
    await this.redisService.del(`mobile:publish_jti:${session.publishTokenJti}`);

    // Set camera offline
    await this.cameraModel.updateOne({ id: session.cameraId }, { status: 'offline' });
    this.notificationsGateway.broadcastCameraStatus(session.cameraId, 'OFFLINE', 0, 0);

    return { success: true };
  }
}
