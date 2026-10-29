import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../common/redis/redis.service';
import {
  CameraHealthEvent,
  TrackUpdatedEvent,
  MapSightingCreatedEvent as SightingCreatedEvent,
  JourneyUpdatedEvent,
} from '@sentinel/shared-types';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server: Server;

  // High-frequency coalescing buffers (250 ms window)
  private readonly pendingCameraHealth = new Map<string, CameraHealthEvent>();
  private readonly pendingTracks = new Map<string, TrackUpdatedEvent>();
  private readonly pendingSightings: SightingCreatedEvent[] = [];
  private readonly pendingJourneys = new Map<string, JourneyUpdatedEvent>();
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly COALESCE_INTERVAL_MS = 250;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  onModuleInit() {
    this.flushTimer = setInterval(() => {
      this.flushCoalescedEvents().catch((err) => {
        this.logger.error(`Error flushing coalesced map events: ${err.message}`);
      });
    }, this.COALESCE_INTERVAL_MS);
    this.logger.log(`Realtime map event coalescer started (interval: ${this.COALESCE_INTERVAL_MS} ms)`);
  }

  onModuleDestroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  async handleConnection(client: Socket) {
    try {
      // JWT-authenticated handshake (extract from auth object or query params)
      const token =
        client.handshake.auth?.token ||
        (client.handshake.query?.token as string);

      if (token) {
        const secret = this.configService.get<string>(
          'app.jwtSecret',
          'dev-secret-change-in-production',
        );
        const payload = await this.jwtService.verifyAsync(token, { secret });
        client.data.user = payload;
        this.logger.log(`Authenticated WS client connected: ${client.id} (${payload.email})`);
      } else {
        // Fallback for dev / unauthenticated monitors
        client.data.user = { role: 'Viewer', email: 'guest@sentinel.local' };
        this.logger.log(`WS client connected (guest/unauthenticated): ${client.id}`);
      }

      // Default join to dashboard room
      client.join('dashboard');
    } catch (err: any) {
      this.logger.warn(`WS connection auth error: ${err.message}. Disconnecting client ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`WebSocket client disconnected: ${client.id}`);
  }

  // =========================================================================
  // Room Subscription Handlers (per site, per case, per job)
  // =========================================================================

  @SubscribeMessage('join:site')
  handleJoinSite(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { siteId: string },
  ) {
    if (data?.siteId) {
      const room = `site:${data.siteId}`;
      client.join(room);
      this.logger.log(`Client ${client.id} joined room ${room}`);
      return { status: 'joined', room };
    }
  }

  @SubscribeMessage('leave:site')
  handleLeaveSite(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { siteId: string },
  ) {
    if (data?.siteId) {
      const room = `site:${data.siteId}`;
      client.leave(room);
      this.logger.log(`Client ${client.id} left room ${room}`);
      return { status: 'left', room };
    }
  }

  @SubscribeMessage('join:case')
  handleJoinCase(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { caseId: string },
  ) {
    if (data?.caseId) {
      const room = `case:${data.caseId}`;
      client.join(room);
      this.logger.log(`Client ${client.id} joined room ${room}`);
      return { status: 'joined', room };
    }
  }

  @SubscribeMessage('leave:case')
  handleLeaveCase(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { caseId: string },
  ) {
    if (data?.caseId) {
      const room = `case:${data.caseId}`;
      client.leave(room);
      this.logger.log(`Client ${client.id} left room ${room}`);
      return { status: 'left', room };
    }
  }

  @SubscribeMessage('join:job')
  handleJoinJob(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { jobId: string },
  ) {
    if (data?.jobId) {
      const room = `job:${data.jobId}`;
      client.join(room);
      this.logger.log(`Client ${client.id} joined room ${room}`);
      return { status: 'joined', room };
    }
  }

  // =========================================================================
  // High-Frequency Coalesced Enqueue Methods
  // =========================================================================

  /**
   * Queues a camera health telemetry pulse.
   * Multiple pulses for the same cameraId within 250ms are coalesced into the latest state.
   */
  queueCameraHealth(event: CameraHealthEvent) {
    this.pendingCameraHealth.set(event.cameraId, event);
  }

  /**
   * Queues a spatial track coordinate update (e.g. ByteTrack bounding box / coordinate).
   * Multiple updates for the same trackId within 250ms are coalesced into the latest state.
   */
  queueTrackUpdated(event: TrackUpdatedEvent) {
    this.pendingTracks.set(String(event.trackId), event);
  }

  /**
   * Queues a candidate biometric sighting event.
   */
  queueSightingCreated(event: SightingCreatedEvent) {
    this.pendingSightings.push(event);
  }

  /**
   * Queues a multi-camera journey trajectory update.
   */
  queueJourneyUpdated(event: JourneyUpdatedEvent) {
    this.pendingJourneys.set(event.caseId, event);
  }

  /**
   * Flushes all coalesced map events every 250 ms to prevent UI thrashing.
   * Emits to site and case rooms, and updates Redis GEO index.
   */
  async flushCoalescedEvents(): Promise<void> {
    if (!this.server) return;

    // 1. Flush camera.health
    if (this.pendingCameraHealth.size > 0) {
      const healthBatch = Array.from(this.pendingCameraHealth.values());
      this.pendingCameraHealth.clear();

      for (const event of healthBatch) {
        if (event.siteId) {
          this.server.to(`site:${event.siteId}`).emit('camera.health', event);
        }
        this.server.to('dashboard').emit('camera.health', event);
      }
    }

    // 2. Flush track.updated & maintain Redis GEO
    if (this.pendingTracks.size > 0) {
      const tracksBatch = Array.from(this.pendingTracks.values());
      this.pendingTracks.clear();

      for (const event of tracksBatch) {
        if (event.siteId) {
          this.server.to(`site:${event.siteId}`).emit('track.updated', event);
        }
        if (event.caseId) {
          this.server.to(`case:${event.caseId}`).emit('track.updated', event);
        }
        this.server.to('dashboard').emit('track.updated', event);

        // Store latest track position in Redis GEO for rapid spatial queries
        if (event.coordinates && event.coordinates.length === 2) {
          const [lng, lat] = event.coordinates;
          const memberId = String(event.trackId);
          this.redisService.geoAdd('geo:tracks', lng, lat, memberId).catch(() => {});
          if (event.siteId) {
            this.redisService.geoAdd(`geo:tracks:${event.siteId}`, lng, lat, memberId).catch(() => {});
          }
        }
      }
    }

    // 3. Flush sighting.created
    if (this.pendingSightings.length > 0) {
      const sightingsBatch = [...this.pendingSightings];
      this.pendingSightings.length = 0;

      for (const event of sightingsBatch) {
        if (event.caseId) {
          this.server.to(`case:${event.caseId}`).emit('sighting.created', event);
        }
        if (event.siteId) {
          this.server.to(`site:${event.siteId}`).emit('sighting.created', event);
        }
        this.server.to('dashboard').emit('sighting.created', event);
      }
    }

    // 4. Flush journey.updated
    if (this.pendingJourneys.size > 0) {
      const journeysBatch = Array.from(this.pendingJourneys.values());
      this.pendingJourneys.clear();

      for (const event of journeysBatch) {
        if (event.caseId) {
          this.server.to(`case:${event.caseId}`).emit('journey.updated', event);
        }
        this.server.to('dashboard').emit('journey.updated', event);
      }
    }
  }

  // =========================================================================
  // Standard Broadcast Helpers (backwards compatible & hooked to coalescer)
  // =========================================================================

  broadcastJobProgress(jobId: string, progress: any) {
    this.server?.to(`job:${jobId}`).emit('search.jobs.progress', progress);
    this.server?.to('dashboard').emit('search.jobs.progress', progress);
  }

  broadcastCandidateSighting(caseId: string, candidate: any) {
    // Legacy broadcast
    this.server?.to(`case:${caseId}`).emit('candidates.scored', candidate);
    this.server?.to('dashboard').emit('sighting.new', candidate);

    // Also queue formal sighting.created realtime map event
    const coordinates: [number, number] = candidate.location?.coordinates ??
      candidate.coordinates ?? [78.4865, 17.385];

    this.queueSightingCreated({
      sightingId: candidate.id || candidate.sightingId || `sight_${Date.now()}`,
      caseId,
      cameraId: candidate.cameraId || 'unknown_cam',
      siteId: candidate.siteId || 'site_primary',
      coordinates,
      score: candidate.fusedScore ?? candidate.score ?? 0.85,
      ts: candidate.timestamp ?? new Date().toISOString(),
    });
  }

  broadcastJourneyUpdated(caseId: string, journey: any) {
    this.server?.to(`case:${caseId}`).emit('journeys.updated', journey);
    this.server?.to('dashboard').emit('journeys.updated', journey);

    const hops = Array.isArray(journey.hops)
      ? journey.hops
      : Array.isArray(journey.cameraSequence)
      ? journey.cameraSequence.map((node: any, idx: number) => ({
          sequence: idx + 1,
          sightingId: node.sightingId || `hop_${idx + 1}`,
          cameraId: node.cameraId,
          coordinates: [node.coords?.[1] ?? 0, node.coords?.[0] ?? 0] as [number, number],
          timestamp: node.timestamp || new Date().toISOString(),
          score: node.similarityScore ?? 0.85,
          status: node.verified ? 'confirmed' : 'pending',
        }))
      : [];

    this.queueJourneyUpdated({
      caseId,
      hops,
    });
  }

  broadcastAlert(alert: any) {
    this.server?.to('dashboard').emit('alert.new', alert);
    if (alert.caseId) {
      this.server?.to(`case:${alert.caseId}`).emit('alert.new', alert);
    }
  }

  broadcastCameraStatus(
    cameraId: string,
    status: string,
    fps = 30,
    peopleCount = 0,
    siteId = 'site_primary',
  ) {
    this.server?.to('dashboard').emit('camera.status', { cameraId, status });

    // Queue formal camera.health event
    this.queueCameraHealth({
      cameraId,
      status: (status.toUpperCase() as any) || 'LIVE',
      fps,
      peopleCount,
      updatedAt: new Date().toISOString(),
      siteId,
    });
  }

  @SubscribeMessage('ping')
  handlePing(): string {
    return 'pong';
  }
}
