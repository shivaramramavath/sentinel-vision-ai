import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsGateway } from './notifications.gateway';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../common/redis/redis.service';

describe('NotificationsGateway (Realtime Map Events & 250ms Coalescing)', () => {
  let gateway: NotificationsGateway;
  let mockServer: any;
  let mockRedisService: any;

  beforeEach(async () => {
    const emitFn = jest.fn();
    mockServer = {
      to: jest.fn().mockReturnValue({ emit: emitFn }),
      emit: emitFn,
    };

    mockRedisService = {
      geoAdd: jest.fn().mockResolvedValue(1),
      geoSearch: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsGateway,
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn().mockResolvedValue({ email: 'officer@sentinel.gov' }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    gateway = module.get<NotificationsGateway>(NotificationsGateway);
    gateway.server = mockServer;
  });

  afterEach(() => {
    gateway.onModuleDestroy();
  });

  it('should handle room subscription messages: join:site, leave:site, join:case, leave:case', () => {
    const mockSocket: any = {
      id: 'sock_123',
      join: jest.fn(),
      leave: jest.fn(),
    };

    const joinSiteRes = gateway.handleJoinSite(mockSocket, { siteId: 'site_terminal1' });
    expect(mockSocket.join).toHaveBeenCalledWith('site:site_terminal1');
    expect(joinSiteRes?.room).toBe('site:site_terminal1');

    const leaveSiteRes = gateway.handleLeaveSite(mockSocket, { siteId: 'site_terminal1' });
    expect(mockSocket.leave).toHaveBeenCalledWith('site:site_terminal1');
    expect(leaveSiteRes?.room).toBe('site:site_terminal1');

    const joinCaseRes = gateway.handleJoinCase(mockSocket, { caseId: 'case_456' });
    expect(mockSocket.join).toHaveBeenCalledWith('case:case_456');
    expect(joinCaseRes?.room).toBe('case:case_456');

    const leaveCaseRes = gateway.handleLeaveCase(mockSocket, { caseId: 'case_456' });
    expect(mockSocket.leave).toHaveBeenCalledWith('case:case_456');
    expect(leaveCaseRes?.room).toBe('case:case_456');
  });

  it('should coalesce high-frequency camera.health pulses for the same camera into latest state', async () => {
    // 3 rapid pulses for cam_001 with varying fps/peopleCount
    gateway.queueCameraHealth({
      cameraId: 'cam_001',
      status: 'LIVE',
      fps: 15,
      peopleCount: 4,
      updatedAt: '2026-10-28T10:00:00.000Z',
      siteId: 'site_terminal1',
    });
    gateway.queueCameraHealth({
      cameraId: 'cam_001',
      status: 'LIVE',
      fps: 22,
      peopleCount: 7,
      updatedAt: '2026-10-28T10:00:00.100Z',
      siteId: 'site_terminal1',
    });
    gateway.queueCameraHealth({
      cameraId: 'cam_001',
      status: 'LIVE',
      fps: 30,
      peopleCount: 12,
      updatedAt: '2026-10-28T10:00:00.200Z',
      siteId: 'site_terminal1',
    });

    // Pulse for different camera
    gateway.queueCameraHealth({
      cameraId: 'cam_002',
      status: 'DEGRADED',
      fps: 10,
      peopleCount: 2,
      updatedAt: '2026-10-28T10:00:00.220Z',
      siteId: 'site_terminal1',
    });

    // Flush coalesced batch
    await gateway.flushCoalescedEvents();

    const siteRoom = mockServer.to('site:site_terminal1');
    // Expect exactly 2 emissions to site room (one per unique camera), with latest state for cam_001
    expect(siteRoom.emit).toHaveBeenCalledWith('camera.health', expect.objectContaining({
      cameraId: 'cam_001',
      fps: 30,
      peopleCount: 12,
    }));
    expect(siteRoom.emit).toHaveBeenCalledWith('camera.health', expect.objectContaining({
      cameraId: 'cam_002',
      fps: 10,
      status: 'DEGRADED',
    }));
  });

  it('should coalesce track.updated events and update Redis GEO', async () => {
    // Rapid bounding box movements for track_88
    gateway.queueTrackUpdated({
      trackId: 'track_88',
      cameraId: 'cam_001',
      caseId: 'case_456',
      siteId: 'site_terminal1',
      bbox: [100, 100, 50, 120],
      ts: '2026-10-28T10:00:00.050Z',
      coordinates: [78.4865, 17.385],
    });
    gateway.queueTrackUpdated({
      trackId: 'track_88',
      cameraId: 'cam_001',
      caseId: 'case_456',
      siteId: 'site_terminal1',
      bbox: [110, 105, 52, 122],
      ts: '2026-10-28T10:00:00.150Z',
      coordinates: [78.4868, 17.3852],
    });

    await gateway.flushCoalescedEvents();

    const caseRoom = mockServer.to('case:case_456');
    expect(caseRoom.emit).toHaveBeenCalledWith('track.updated', expect.objectContaining({
      trackId: 'track_88',
      bbox: [110, 105, 52, 122],
      coordinates: [78.4868, 17.3852],
    }));

    // Verify Redis GEO was updated with latest track position
    expect(mockRedisService.geoAdd).toHaveBeenCalledWith('geo:tracks', 78.4868, 17.3852, 'track_88');
    expect(mockRedisService.geoAdd).toHaveBeenCalledWith('geo:tracks:site_terminal1', 78.4868, 17.3852, 'track_88');
  });

  it('should flush sighting.created and journey.updated events to proper case rooms', async () => {
    gateway.queueSightingCreated({
      sightingId: 'sight_099',
      caseId: 'case_777',
      cameraId: 'cam_003',
      coordinates: [78.487, 17.384],
      score: 0.94,
      ts: '2026-10-28T10:05:00Z',
    });

    gateway.queueJourneyUpdated({
      caseId: 'case_777',
      hops: [
        {
          sequence: 1,
          sightingId: 'sight_099',
          cameraId: 'cam_003',
          coordinates: [78.487, 17.384],
          timestamp: '2026-10-28T10:05:00Z',
          score: 0.94,
          status: 'confirmed',
        },
      ],
    });

    await gateway.flushCoalescedEvents();

    const caseRoom = mockServer.to('case:case_777');
    expect(caseRoom.emit).toHaveBeenCalledWith('sighting.created', expect.objectContaining({
      sightingId: 'sight_099',
      score: 0.94,
    }));
    expect(caseRoom.emit).toHaveBeenCalledWith('journey.updated', expect.objectContaining({
      caseId: 'case_777',
      hops: expect.arrayContaining([expect.objectContaining({ sequence: 1 })]),
    }));
  });
});
