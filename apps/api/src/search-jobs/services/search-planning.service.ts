import { Injectable } from '@nestjs/common';

export interface SearchShard {
  shardId: string;
  jobId: string;
  caseId: string;
  cameraId: string;
  windowStart: string; // ISO 8601
  windowEnd: string;   // ISO 8601
  referencePhotoUrl: string;
  minConfidence: number;
  model_version: string;
}

@Injectable()
export class SearchPlanningService {
  /**
   * Slices search scope into discrete (cameraId x 5-minute time window) shards.
   * Parallelism = number of generated shards.
   */
  generateShards(params: {
    jobId: string;
    caseId: string;
    cameraScope: string[];
    timeRangeHours: number;
    referencePhotoUrl: string;
    minConfidence: number;
    referenceTime?: Date;
  }): SearchShard[] {
    const windowSliceMs = 5 * 60 * 1000; // 5 minutes in milliseconds
    const now = params.referenceTime ? params.referenceTime.getTime() : Date.now();
    const durationMs = Math.max(1, params.timeRangeHours) * 60 * 60 * 1000;
    const searchStartMs = now - durationMs;

    const shards: SearchShard[] = [];

    // Ensure we have at least one camera
    const cameras = params.cameraScope.length > 0 ? params.cameraScope : ['cam_001'];

    for (const cameraId of cameras) {
      let currentSliceStart = searchStartMs;
      while (currentSliceStart < now) {
        const currentSliceEnd = Math.min(currentSliceStart + windowSliceMs, now);
        const shardId = `${params.jobId}_${cameraId}_${currentSliceStart}`;

        shards.push({
          shardId,
          jobId: params.jobId,
          caseId: params.caseId,
          cameraId,
          windowStart: new Date(currentSliceStart).toISOString(),
          windowEnd: new Date(currentSliceEnd).toISOString(),
          referencePhotoUrl: params.referencePhotoUrl,
          minConfidence: params.minConfidence,
          model_version: 'v1.0',
        });

        currentSliceStart += windowSliceMs;
      }
    }

    return shards;
  }
}
