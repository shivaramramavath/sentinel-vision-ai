import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { CamerasService } from './cameras.service';
import { Camera, SourceType } from './schemas/camera.schema';
import { CameraTopology } from './schemas/camera-topology.schema';
import { VideoSegment } from './schemas/video-segment.schema';
import { RedisService } from '../common/redis/redis.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { KafkaService } from '../common/kafka/kafka.service';
import { MediaMtxControlService } from '../media/services/mediamtx-control.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { decryptRtspUrl } from '../common/crypto/camera-crypto.util';

describe('CamerasService', () => {
  let service: CamerasService;
  let mockCameraModel: any;
  let mockTopologyModel: any;
  let mockRedisService: any;
  let mockNotificationsGateway: any;
  let mockKafkaService: any;
  let mockMediaMtxControlService: any;
  let mockConfigService: any;
  let mockJwtService: any;
  let mockVideoSegmentModel: any;

  const mockCameras = [
    {
      id: 'cam_origin',
      cameraId: 'cam_origin',
      name: 'Origin Concourse Gate',
      locationName: 'Central Concourse',
      latitude: 17.3850,
      longitude: 78.4867,
      headingDeg: 90,
      fovDeg: 75,
      status: 'online',
      ingest: { mediaPath: 'cam/cam_origin' },
      health: { fps: 30, bitrate: 4096, packetLoss: 0 },
      updatedAt: new Date(Date.now() - 100000).toISOString(),
    },
    {
      id: 'cam_north_facing',
      cameraId: 'cam_north_facing',
      name: 'North Corridor (Facing South)',
      locationName: 'North Corridor',
      latitude: 17.3860, // ~111m north
      longitude: 78.4867,
      headingDeg: 180, // Facing south -> directly faces oncoming northbound pedestrian!
      fovDeg: 75,
      status: 'online',
      ingest: { mediaPath: 'cam/cam_north_facing' },
    },
    {
      id: 'cam_north_away',
      cameraId: 'cam_north_away',
      name: 'North Corridor (Facing North)',
      locationName: 'North Corridor Exit',
      latitude: 17.3860, // ~111m north
      longitude: 78.4867,
      headingDeg: 0, // Facing north -> facing away from oncoming northbound pedestrian
      fovDeg: 75,
      status: 'online',
    },
    {
      id: 'cam_far_away',
      cameraId: 'cam_far_away',
      name: 'Remote Perimeter',
      locationName: 'External Road',
      latitude: 17.4300, // ~5000m away
      longitude: 78.4867,
      headingDeg: 180,
      fovDeg: 75,
      status: 'online',
    },
  ];

  beforeEach(async () => {
    // Make mockCameraModel both callable as a constructor and with static query methods
    mockCameraModel = jest.fn().mockImplementation((dto) => {
      const doc: any = {
        ...dto,
        id: dto.id || dto.cameraId || `cam_${Date.now()}`,
        save: jest.fn().mockImplementation(async () => doc),
      };
      return doc;
    });

    mockCameraModel.find = jest.fn().mockImplementation((query) => {
      let results = [...mockCameras];
      if (query?.id?.$ne) {
        results = results.filter((c) => c.id !== query.id.$ne);
      }
      return {
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(results),
        }),
      };
    });

    mockCameraModel.findOne = jest.fn().mockImplementation((query) => {
      const match = mockCameras.find((c) => c.id === query.id || c.cameraId === query.id);
      return {
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(match || null),
        }),
        exec: jest.fn().mockResolvedValue(match || null),
      };
    });

    mockCameraModel.findOneAndUpdate = jest.fn().mockImplementation((query, update) => {
      const match = mockCameras.find((c) => c.id === query.id);
      const updated = { ...match, ...update.$set };
      return Promise.resolve(updated);
    });

    mockCameraModel.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });

    const topologyStorage = new Map<string, any>();

    mockTopologyModel = jest.fn().mockImplementation((dto) => {
      const doc: any = {
        ...dto,
      };
      doc.save = jest.fn().mockImplementation(() => {
        topologyStorage.set(`${doc.fromCamera}->${doc.toCamera}`, doc);
        return Promise.resolve(doc);
      });
      return doc;
    });

    mockTopologyModel.findOne = jest.fn().mockImplementation((query) => {
      const key = `${query.fromCamera}->${query.toCamera}`;
      const found = topologyStorage.get(key) || null;
      return {
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(found),
        }),
        exec: jest.fn().mockResolvedValue(found),
      };
    });

    const redisStore = new Map<string, string>();

    mockRedisService = {
      geoAdd: jest.fn().mockResolvedValue(1),
      geoSearch: jest.fn().mockResolvedValue([]),
      get: jest.fn().mockImplementation((key: string) => Promise.resolve(redisStore.get(key) || null)),
      set: jest.fn().mockImplementation((key: string, val: string) => {
        redisStore.set(key, val);
        return Promise.resolve();
      }),
      del: jest.fn().mockImplementation((key: string) => {
        redisStore.delete(key);
        return Promise.resolve(1);
      }),
      delByPattern: jest.fn().mockResolvedValue(undefined),
      getClient: jest.fn().mockReturnValue({
        lrange: jest.fn().mockResolvedValue([
          JSON.stringify({ timestamp: new Date().toISOString(), status: 'online', fps: 30, bitrate: 4096 }),
        ]),
      }),
    };

    mockNotificationsGateway = {
      queueCameraHealth: jest.fn(),
      queueTrackUpdated: jest.fn(),
      broadcastCameraStatus: jest.fn(),
    };

    mockKafkaService = {
      publishEvent: jest.fn().mockResolvedValue(true),
    };

    mockMediaMtxControlService = {
      addCameraPath: jest.fn().mockResolvedValue(true),
      patchCameraPath: jest.fn().mockResolvedValue(true),
      removeCameraPath: jest.fn().mockResolvedValue(true),
      listActivePaths: jest.fn().mockResolvedValue([]),
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string, def: any) => {
        if (key === 'app.cameraSecretKey') return 'sentinel-camera-master-aes-key-32b';
        if (key === 'app.jwtSecret') return 'test-jwt-secret';
        if (key === 'app.mediamtxRtspBase') return 'rtsp://localhost:8554';
        if (key === 'app.mediamtxWebrtcBase') return 'http://localhost:8889';
        if (key === 'app.mediamtxHlsBase') return 'http://localhost:8888';
        return def;
      }),
    };

    mockJwtService = {
      signAsync: jest.fn().mockResolvedValue('mock-signed-playback-jwt'),
      verifyAsync: jest.fn().mockResolvedValue({ sub: 'user_1' }),
    };

    mockVideoSegmentModel = {
      create: jest.fn().mockImplementation((dto) => Promise.resolve({ ...dto, _id: 'mock_seg_1' })),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CamerasService,
        { provide: getModelToken(Camera.name), useValue: mockCameraModel },
        { provide: getModelToken(CameraTopology.name), useValue: mockTopologyModel },
        { provide: getModelToken(VideoSegment.name), useValue: mockVideoSegmentModel },
        { provide: RedisService, useValue: mockRedisService },
        { provide: NotificationsGateway, useValue: mockNotificationsGateway },
        { provide: KafkaService, useValue: mockKafkaService },
        { provide: MediaMtxControlService, useValue: mockMediaMtxControlService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<CamerasService>(CamerasService);
  });

  describe('S_camera Geographic Plausibility & Hard Constraints', () => {
    it('should return S_camera = 0.0 when dt < distance / 3.0 m/s (hard sprinting constraint)', async () => {
      const plausibilityTooFast = await service.calculatePlausibility(
        'cam_origin',
        'cam_north_facing',
        40.0,
        300.0,
      );
      expect(plausibilityTooFast).toBe(0.0);

      const borderlineTooFast = await service.calculatePlausibility(
        'cam_origin',
        'cam_north_facing',
        99.0,
        300.0,
      );
      expect(borderlineTooFast).toBe(0.0);
    });

    it('should compute high plausibility around expected walking time (distance / 1.4 m/s)', async () => {
      const plausibilityNominal = await service.calculatePlausibility(
        'cam_origin',
        'cam_north_facing',
        100.0,
        140.0,
      );
      expect(plausibilityNominal).toBeGreaterThanOrEqual(0.95);
    });

    it('should update transition distribution via Welford learning and persist new empirical mean and std', async () => {
      await service.learnTransition('cam_origin', 'cam_north_facing', 80.0, 111.0);
      await service.learnTransition('cam_origin', 'cam_north_facing', 84.0, 111.0);
      await service.learnTransition('cam_origin', 'cam_north_facing', 78.0, 111.0);
      await service.learnTransition('cam_origin', 'cam_north_facing', 82.0, 111.0);

      const edge = await mockTopologyModel.findOne({
        fromCamera: 'cam_origin',
        toCamera: 'cam_north_facing',
      }).exec();

      expect(edge).toBeDefined();
      expect(edge.sampleCount).toBe(4);
      expect(edge.meanTravelSec).toBeCloseTo(81.0, 0);
      expect(edge.stdTravelSec).toBeLessThan(10.0);
    });
  });

  describe('Next Cameras to Search Ranking', () => {
    it('should rank cameras in reachable area, giving higher rank to cameras facing the oncoming walking direction', async () => {
      const ranked = await service.rankNextCameras('cam_origin', undefined, 2000);

      expect(ranked.length).toBe(2);

      const [first, second] = ranked;
      expect(first.cameraId).toBe('cam_north_facing');
      expect(first.facesWalkingDirection).toBe(true);

      expect(second.cameraId).toBe('cam_north_away');
      expect(second.facesWalkingDirection).toBe(false);

      expect(first.rankScore).toBeGreaterThan(second.rankScore);
    });
  });

  describe('Flow A: CCTV Ingestion, Connection Probe & Cryptographic Storage', () => {
    it('should probe connection successfully for mock RTSP URLs', async () => {
      const result = await service.testConnection({
        rtspUrl: 'rtsp://127.0.0.1:8554/mock/stream',
      });

      expect(result.reachable).toBe(true);
      expect(result.codec).toBe('h264');
      expect(result.fps).toBe(30);
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
    });

    it('should throw BadRequestException if consentConfirmed is false or missing', async () => {
      await expect(
        service.create({
          name: 'Gate Camera Non-compliant',
          sourceType: SourceType.CCTV_RTSP,
          coordinates: [78.4867, 17.385],
          rtspUrl: 'rtsp://admin:pass@192.168.1.100:554/live',
          authorization: {
            consentConfirmed: false,
            purpose: 'Testing',
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should encrypt RTSP credentials at rest using AES-256-GCM and register with MediaMTX', async () => {
      const rawRtsp = 'rtsp://admin:secretPass123@192.168.1.100:554/live';
      const created = await service.create({
        id: 'cam_test_secure',
        name: 'Secure Perimeter Camera',
        sourceType: SourceType.CCTV_RTSP,
        coordinates: [78.4867, 17.385],
        rtspUrl: rawRtsp,
        aiPolicy: { enabled: true, sampleFps: 2.0, minDetectionConf: 0.65 },
        authorization: {
          consentConfirmed: true,
          authorizedBy: 'commander@sentinel.gov',
          purpose: 'Secure perimeter monitoring',
        },
      });

      expect(created).toBeDefined();
      expect(created.ingest).toBeDefined();
      expect(created.ingest.rtspUrlEncrypted).toBeDefined();
      expect(created.ingest.rtspUrlEncrypted).not.toContain('secretPass123');

      // Verify that the encrypted RTSP decrypts back to original credentials
      const decrypted = decryptRtspUrl(created.ingest.rtspUrlEncrypted!, 'sentinel-camera-master-aes-key-32b');
      expect(decrypted).toBe(rawRtsp);

      // Verify stream key hash was generated
      expect(created.ingest.streamKeyHash).toBeDefined();
      expect(created.ingest.streamKeyHash?.length).toBe(64); // SHA-256 hex length

      // Verify MediaMTX control service was called with the path
      expect(mockMediaMtxControlService.addCameraPath).toHaveBeenCalledWith(
        'cam/cam_test_secure',
        rawRtsp,
        false,
      );

      // Verify Redis GEO was updated
      expect(mockRedisService.geoAdd).toHaveBeenCalledWith('geo:cameras', 78.4867, 17.385, 'cam_test_secure');
    });
  });

  describe('Mobile Telemetry & Coordinates', () => {
    it('should update mobile telemetry, emit track update event, and update Redis GEO', async () => {
      const result = await service.updateMobileTelemetry('cam_origin', {
        coordinates: [78.4900, 17.3900],
        heading: 135,
        battery: 0.72,
        networkType: '5G',
      });

      expect(result.success).toBe(true);
      expect(result.coordinates).toEqual([78.4900, 17.3900]);
      expect(mockRedisService.geoAdd).toHaveBeenCalledWith('geo:cameras', 78.4900, 17.3900, 'cam_origin');
      expect(mockNotificationsGateway.queueTrackUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          trackId: 'mob_cam_origin',
          cameraId: 'cam_origin',
          coordinates: [78.4900, 17.3900],
        }),
      );
    });
  });

  describe('Flow C: Bulk CSV Import with Dry-Run Validation', () => {
    const sampleCsv = `name,rtspUrl,latitude,longitude,siteId
Camera Entrance A,rtsp://192.168.1.101:554/live,17.3855,78.4870,site_hq
Camera Lobby B,rtsp://192.168.1.102:554/live,17.3860,78.4875,site_hq
Invalid Camera,http://invalid-url.com,999.0,999.0,site_hq`;

    it('should validate CSV rows and return structured report in dryRun mode without writing to DB', async () => {
      const report = await service.bulkImport({
        csvData: sampleCsv,
        dryRun: true,
      });

      expect(report.dryRun).toBe(true);
      expect(report.totalRows).toBe(3);
      expect(report.validCount).toBe(2);
      expect(report.errorCount).toBe(1); // 1 row with invalid RTSP URL
      expect(report.sampleValidRows?.length).toBe(2);
    });

    it('should commit valid rows when dryRun is false', async () => {
      const validCsv = `name,rtspUrl,latitude,longitude,siteId
Camera West 1,rtsp://192.168.1.110:554/live,17.3851,78.4868,site_hq
Camera West 2,rtsp://192.168.1.111:554/live,17.3852,78.4869,site_hq`;

      const result = await service.bulkImport({
        csvData: validCsv,
        dryRun: false,
      });

      expect(result.dryRun).toBe(false);
      expect(result.totalRows).toBe(2);
      expect(result.committedCount).toBe(2);
      expect(result.errorCount).toBe(0);
    });
  });

  describe('Playback Token Generation & Health History', () => {
    it('should generate a short-lived signed JWT for stream playback scoped to camera path', async () => {
      const tokenResult = await service.generatePlaybackToken('cam_origin', 'operator_test');

      expect(tokenResult.token).toBe('mock-signed-playback-jwt');
      expect(tokenResult.expiresInSeconds).toBe(60);
      expect(tokenResult.webrtcUrl).toBeDefined();
      expect(tokenResult.hlsUrl).toBeDefined();
      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'operator_test',
          cameraId: 'cam_origin',
          path: 'cam/cam_origin',
          action: 'read',
        }),
        expect.objectContaining({ expiresIn: '60s' }),
      );
    });

    it('should retrieve health history from Redis time series', async () => {
      const history = await service.getHealthHistory('cam_origin');

      expect(history.cameraId).toBe('cam_origin');
      expect(history.historyCount).toBe(1);
      expect(history.history[0].fps).toBe(30);
    });
  });

  describe('Video Rules & Compliance Invariants', () => {
    it('Rule 3: should reject enabling AI search if recorded consent or authorization metadata is missing', async () => {
      mockCameraModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          id: 'cam_unauthorized',
          aiPolicy: { enabled: false },
          authorization: { consentConfirmed: false },
          save: jest.fn(),
        }),
      });

      await expect(
        service.update('cam_unauthorized', { aiPolicy: { enabled: true } as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Rule 4: should resolve mobile camera dynamic coordinates at historical sighting timestamp', () => {
      const mobileCam = {
        id: 'mob_cam_01',
        isMovable: true,
        mounting: 'mobile',
        location: { coordinates: [78.4900, 17.3890] },
        locationHistory: [
          { coordinates: [78.4860, 17.3850], timestamp: new Date('2026-10-28T12:00:00Z') },
          { coordinates: [78.4880, 17.3870], timestamp: new Date('2026-10-28T12:15:00Z') },
          { coordinates: [78.4900, 17.3890], timestamp: new Date('2026-10-28T12:30:00Z') },
        ],
      };

      const coordAt1214 = service.resolveCameraCoordinatesAtTime(mobileCam, new Date('2026-10-28T12:14:00Z'));
      expect(coordAt1214).toEqual([78.4880, 17.3870]);

      const coordAt1201 = service.resolveCameraCoordinatesAtTime(mobileCam, new Date('2026-10-28T12:01:00Z'));
      expect(coordAt1201).toEqual([78.4860, 17.3850]);
    });

    it('Rule 5: should apply camera clock offsets in cross-camera plausibility transition calculation', async () => {
      mockCameraModel.findOne
        .mockReturnValueOnce({
          lean: () => ({
            exec: jest.fn().mockResolvedValue({
              id: 'cam_a',
              longitude: 78.4867,
              latitude: 17.3850,
              health: { clockOffsetMs: -5000 },
            }),
          }),
        })
        .mockReturnValueOnce({
          lean: () => ({
            exec: jest.fn().mockResolvedValue({
              id: 'cam_b',
              longitude: 78.4867,
              latitude: 17.3860, // ~111m away
              health: { clockOffsetMs: 0 },
            }),
          }),
        });

      // At distance 111m, walking speed 1.4 m/s => expected ~79s.
      // With raw dt = 74s and net clock offset +5s, effective dt = 79s, yielding peak plausibility ~1.0
      const plausibility = await service.calculatePlausibility('cam_a', 'cam_b', 74.0, 111.0);
      expect(plausibility).toBeGreaterThan(0.9);
    });
  });
});

