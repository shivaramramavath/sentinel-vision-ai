import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';
import { ConfigService } from '@nestjs/config';

describe('RedisService (Token Bucket Rate Limiting)', () => {
  let redisService: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('localhost'),
          },
        },
      ],
    }).compile();

    redisService = module.get<RedisService>(RedisService);
  });

  it('should consume tokens until bucket is depleted and then deny request', async () => {
    const key = 'test_bucket';
    const maxTokens = 3;
    const windowMs = 60000;

    // 1st consumption
    const first = await redisService.consumeRateLimitToken(key, maxTokens, windowMs);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(2);

    // 2nd consumption
    const second = await redisService.consumeRateLimitToken(key, maxTokens, windowMs);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(1);

    // 3rd consumption
    const third = await redisService.consumeRateLimitToken(key, maxTokens, windowMs);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);

    // 4th consumption: bucket depleted!
    const fourth = await redisService.consumeRateLimitToken(key, maxTokens, windowMs);
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
  });

  describe('Redis GEO Spatial Operations', () => {
    it('should add geospatial members and accurately search within radius', async () => {
      const geoKey = 'geo:test:cameras';

      // Coordinates around Hyderabad Central
      // cam1: [78.4867, 17.3850]
      // cam2: ~300m away [78.4895, 17.3850]
      // cam3: ~5000m away [78.5300, 17.3850]
      await redisService.geoAdd(geoKey, 78.4867, 17.385, 'cam_001');
      await redisService.geoAdd(geoKey, 78.4895, 17.385, 'cam_002');
      await redisService.geoAdd(geoKey, 78.53, 17.385, 'cam_far');

      // Search within 500m of cam_001
      const nearby = await redisService.geoSearch(geoKey, 78.4867, 17.385, 500);
      expect(nearby.length).toBe(2);
      expect(nearby[0].member).toBe('cam_001');
      expect(nearby[0].distance).toBeLessThan(10);
      expect(nearby[1].member).toBe('cam_002');
      expect(nearby[1].distance).toBeGreaterThan(100);
      expect(nearby[1].distance).toBeLessThan(500);

      // Verify cam_far is excluded from 500m search
      expect(nearby.some((m) => m.member === 'cam_far')).toBe(false);

      // Test geoPos
      const positions = await redisService.geoPos(geoKey, 'cam_001', 'cam_002', 'cam_unknown');
      expect(positions[0]).toBeDefined();
      expect(positions[0]![0]).toBeCloseTo(78.4867, 3);
      expect(positions[0]![1]).toBeCloseTo(17.385, 3);
      expect(positions[2]).toBeNull();
    });
  });
});
