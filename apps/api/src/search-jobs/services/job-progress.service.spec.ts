import { JobProgressService } from './job-progress.service';
import { RedisService } from '../../common/redis/redis.service';

describe('JobProgressService (Redis Progress Aggregation)', () => {
  let service: JobProgressService;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {};
    service = new JobProgressService(mockRedis as RedisService);
  });

  it('should calculate percent complete and ETA correctly across shards', async () => {
    const jobId = 'job_agg_01';
    const totalShards = 100;

    const initial = await service.initializeJobProgress(jobId, totalShards, 'planning');
    expect(initial.percentComplete).toBe(0);
    expect(initial.etaSeconds).toBe(150);

    // Record 25 shards completed
    const updated = await service.recordShardProgress(jobId, 25, 0, 2);
    expect(updated.completedShards).toBe(25);
    expect(updated.candidatesFound).toBe(2);
    expect(updated.percentComplete).toBe(25);

    // Record remaining 75 shards
    const finished = await service.recordShardProgress(jobId, 75, 0, 1, 'completed');
    expect(finished.completedShards).toBe(100);
    expect(finished.percentComplete).toBe(100);
    expect(finished.candidatesFound).toBe(3);
    expect(finished.status).toBe('completed');
  });
});
