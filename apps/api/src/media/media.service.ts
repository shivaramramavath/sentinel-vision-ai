import {
  Injectable,
  Logger,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { CamerasService } from '../cameras/cameras.service';
import { KafkaService } from '../common/kafka/kafka.service';
import { RedisService } from '../common/redis/redis.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { MediaAuthDto, StreamStatusHookDto } from './dto/media-auth.dto';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly defaultStreamKey: string;
  private readonly jwtSecret: string;
  private readonly jwtMobileSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly camerasService: CamerasService,
    private readonly kafkaService: KafkaService,
    private readonly redisService: RedisService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {
    this.defaultStreamKey = this.configService.get<string>(
      'app.streamKey',
      'sentinel-stream-key-2026',
    );
    this.jwtSecret = this.configService.get<string>(
      'app.jwtSecret',
      'dev-secret-change-in-production',
    );
    this.jwtMobileSecret = this.configService.get<string>(
      'app.jwtMobileSecret',
      'sentinel-mobile-realm-secret-2026',
    );
  }

  /**
   * Validates MediaMTX external HTTP authentication requests.
   * Path pattern: cam/{cameraId}
   */
  async authenticateMediaRequest(dto: MediaAuthDto): Promise<{ status: string; cameraId: string }> {
    const rawPath = (dto.path || '').trim().replace(/^\/+/, '');
    const match = rawPath.match(/^cam\/([^/?#]+)/);

    if (!match) {
      this.logger.warn(`MediaMTX Auth rejected: Invalid path '${dto.path}' (Must follow cam/{cameraId})`);
      throw new ForbiddenException(`Invalid path format '${dto.path}'. Must follow cam/{cameraId}`);
    }

    const cameraId = match[1];

    // Parse query params if present (e.g. key=xyz&token=abc)
    const queryParams = new URLSearchParams(dto.query || '');
    const providedKey =
      dto.password ||
      queryParams.get('key') ||
      queryParams.get('streamKey') ||
      queryParams.get('token');

    // 1. Publishing Action (Cameras & Ingestion Encoders)
    if (dto.action === 'publish') {
      const isValidStreamKey =
        providedKey === this.defaultStreamKey ||
        (await this.verifyCameraStreamKey(cameraId, providedKey));

      const isValidJwt = providedKey ? await this.verifyJwtToken(providedKey) : false;
      const isValidMobileToken = providedKey
        ? await this.verifyMobilePublishToken(cameraId, providedKey)
        : false;

      if (!isValidStreamKey && !isValidJwt && !isValidMobileToken) {
        this.logger.warn(
          `MediaMTX Publish DENIED for camera '${cameraId}' from IP '${dto.ip}' (Invalid stream key/token)`,
        );
        throw new UnauthorizedException(`Invalid publish stream key for path ${dto.path}`);
      }

      this.logger.log(
        `MediaMTX Publish AUTHORIZED for camera '${cameraId}' via ${dto.protocol || 'stream'} from IP '${dto.ip}'`,
      );
      return { status: 'ok', cameraId };
    }

    // 2. Reading Action (WebRTC / HLS / RTSP Consumers, Frame-Sampler, Recorder)
    if (dto.action === 'read' || dto.action === 'playback') {
      // Allow internal services by token or localhost / internal docker IP
      const isInternal =
        providedKey === 'internal-service' ||
        providedKey === this.defaultStreamKey ||
        dto.ip === '127.0.0.1' ||
        dto.ip?.startsWith('172.') ||
        dto.ip?.startsWith('10.');

      if (isInternal) {
        return { status: 'ok', cameraId };
      }

      // External consumer (e.g. browser WebRTC player via WHEP or HLS)
      const isViewerAuthorized = providedKey ? await this.verifyJwtToken(providedKey) : false;
      if (!isViewerAuthorized) {
        this.logger.warn(
          `MediaMTX Read DENIED for camera '${cameraId}' from IP '${dto.ip}' (Missing or invalid viewer JWT)`,
        );
        throw new UnauthorizedException(`Unauthorized reader for camera path ${dto.path}`);
      }

      return { status: 'ok', cameraId };
    }

    // Default allow for API/metrics if not excluded
    return { status: 'ok', cameraId };
  }

  /**
   * Handles MediaMTX stream lifecycle hooks (runOnReady / runOnNotReady).
   * Updates camera status and publishes camera.status events to Kafka.
   */
  async handleStreamStatusHook(dto: StreamStatusHookDto): Promise<{ success: boolean }> {
    const isReady = dto.status === 'READY';
    this.logger.log(
      `MediaMTX Hook: Stream '${dto.path}' (Camera: ${dto.cameraId}) is now ${dto.status} [source: ${dto.sourceType || 'publisher'}]`,
    );

    // 1. Update Camera status in database & Redis
    try {
      await this.camerasService.updateCameraHealth({
        cameraId: dto.cameraId,
        status: isReady ? 'LIVE' : 'OFFLINE',
        fps: isReady ? 30 : 0,
        peopleCount: 0,
        updatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      this.logger.warn(`Could not update camera health for '${dto.cameraId}': ${err.message}`);
    }

    // 2. Publish camera.status event to Kafka
    const eventPayload = {
      cameraId: dto.cameraId,
      path: dto.path,
      status: isReady ? 'LIVE' : 'OFFLINE',
      sourceType: dto.sourceType || 'publisher',
      sourceId: dto.sourceId || '',
      timestamp: new Date().toISOString(),
    };

    try {
      await this.kafkaService.publishEvent('cameras.status', {
        eventId: randomUUID(),
        type: 'camera.status',
        occurredAt: new Date().toISOString(),
        correlationId: `corr_${Date.now()}`,
        version: '1.0',
        cameraId: dto.cameraId,
        payload: eventPayload,
      });
    } catch (err: any) {
      this.logger.error(`Failed to publish camera.status Kafka event: ${err.message}`);
    }

    // 3. Broadcast status change via WebSocket
    this.notificationsGateway.broadcastCameraStatus(
      dto.cameraId,
      isReady ? 'LIVE' : 'OFFLINE',
      isReady ? 30 : 0,
      0,
    );

    return { success: true };
  }

  private async verifyCameraStreamKey(cameraId: string, key?: string | null): Promise<boolean> {
    if (!key) return false;
    try {
      const camera = await this.camerasService.findById(cameraId);
      if (!camera) return false;
      // If camera has specific streamKey attribute, match it; otherwise match default
      const camKey = (camera as any).streamKey;
      return camKey ? camKey === key : false;
    } catch {
      return false;
    }
  }

  private async verifyJwtToken(token: string): Promise<boolean> {
    try {
      await this.jwtService.verifyAsync(token, { secret: this.jwtSecret });
      return true;
    } catch {
      return false;
    }
  }

  private async verifyMobilePublishToken(cameraId: string, token: string): Promise<boolean> {
    try {
      const payload: any = await this.jwtService.verifyAsync(token, {
        secret: this.jwtMobileSecret,
        audience: 'mobile',
      });

      if (payload.action !== 'publish') return false;
      if (payload.path !== `cam/${cameraId}` && payload.cameraId !== cameraId) return false;

      // Verify that JTI is active and not revoked in Redis
      if (payload.jti) {
        const storedCameraId = await this.redisService.get(`mobile:publish_jti:${payload.jti}`);
        if (!storedCameraId || storedCameraId !== cameraId) {
          this.logger.warn(`MediaMTX Publish rejected: JTI ${payload.jti} revoked or expired`);
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }
}
