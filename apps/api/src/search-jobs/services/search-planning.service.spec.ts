import { SearchPlanningService } from './search-planning.service';

describe('SearchPlanningService (Sharding Algorithm)', () => {
  let service: SearchPlanningService;

  beforeEach(() => {
    service = new SearchPlanningService();
  });

  it('should split 1 hour search across 2 cameras into 5-minute shards', () => {
    // 1 hour = 60 min -> 60 / 5 = 12 slices per camera * 2 cameras = 24 shards
    const fixedNow = new Date('2026-10-28T12:00:00Z');

    const shards = service.generateShards({
      jobId: 'job_test_01',
      caseId: 'case_test_01',
      cameraScope: ['cam_001', 'cam_002'],
      timeRangeHours: 1,
      referencePhotoUrl: 'https://example.com/photo.jpg',
      minConfidence: 0.75,
      referenceTime: fixedNow,
    });

    expect(shards.length).toBe(24);

    const firstShard = shards[0];
    expect(firstShard.jobId).toBe('job_test_01');
    expect(firstShard.caseId).toBe('case_test_01');
    expect(firstShard.cameraId).toBe('cam_001');
    expect(firstShard.model_version).toBe('v1.0');

    // 5-minute slice verification: 11:00 to 11:05
    const start = new Date(firstShard.windowStart).getTime();
    const end = new Date(firstShard.windowEnd).getTime();
    expect(end - start).toBe(5 * 60 * 1000);
  });
});
