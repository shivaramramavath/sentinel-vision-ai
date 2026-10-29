import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';

export interface JobProgressData {
  jobId: string;
  status: string;
  totalShards: number;
  completedShards: number;
  failedShards: number;
  candidatesFound: number;
  percentComplete: number;
  etaSeconds: number;
  startedAt: number;
  updatedAt: number;
}

@Injectable()
export class JobProgressService {
  private readonly logger = new Logger(JobProgressService.name);
  private readonly inMemoryProgress = new Map<string, JobProgressData>();

  constructor(private readonly redisService: RedisService) {}

  private calculateProgress(data: Omit<JobProgressData, 'percentComplete' | 'etaSeconds'>): JobProgressData {
    const total = Math.max(1, data.totalShards);
    const completed = data.completedShards;
    const percentComplete = Math.min(100, Math.floor((completed / total) * 100));

    const now = Date.now();
    const elapsedMs = now - data.startedAt;
    let etaSeconds = 0;

    if (completed > 0 && completed < total) {
      const avgMsPerShard = elapsedMs / completed;
      const remainingShards = total - completed;
      etaSeconds = Math.max(0, Math.round((remainingShards * avgMsPerShard) / 1000));
    } else if (completed === 0) {
      etaSeconds = Math.round(total * 1.5); // estimated 1.5s per shard
    }

    return {
      ...data,
      percentComplete,
      etaSeconds,
    };
  }

  async initializeJobProgress(
    jobId: string,
    totalShards: number,
    status = 'planning',
  ): Promise<JobProgressData> {
    const now = Date.now();
    const initial: JobProgressData = {
      jobId,
      status,
      totalShards,
      completedShards: 0,
      failedShards: 0,
      candidatesFound: 0,
      percentComplete: 0,
      etaSeconds: Math.round(totalShards * 1.5),
      startedAt: now,
      updatedAt: now,
    };

    this.inMemoryProgress.set(jobId, initial);
    return initial;
  }

  async recordShardProgress(
    jobId: string,
    completedDelta = 1,
    failedDelta = 0,
    candidatesFoundDelta = 0,
    newStatus?: string,
  ): Promise<JobProgressData> {
    let current = this.inMemoryProgress.get(jobId);
    if (!current) {
      current = await this.initializeJobProgress(jobId, 10, 'running');
    }

    current.completedShards += completedDelta;
    current.failedShards += failedDelta;
    current.candidatesFound += candidatesFoundDelta;
    if (newStatus) {
      current.status = newStatus;
    }
    current.updatedAt = Date.now();

    const computed = this.calculateProgress(current);
    this.inMemoryProgress.set(jobId, computed);
    return computed;
  }

  async getJobProgress(jobId: string): Promise<JobProgressData | null> {
    return this.inMemoryProgress.get(jobId) || null;
  }
}
