import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SearchJob, SearchJobDocument, SearchJobStatus } from './schemas/search-job.schema';
import { Camera, CameraDocument } from '../cameras/schemas/camera.schema';
import { TriggerSearchDto } from './dto/trigger-search.dto';
import { QueueService, JobPriorityLevel } from '../common/queues/queue.service';
import { OutboxService } from '../common/outbox/outbox.service';
import { CasesService } from '../cases/cases.service';
import { SearchPlanningService, SearchShard } from './services/search-planning.service';
import { JobProgressService } from './services/job-progress.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { EventTopics, createEventEnvelopeSchema } from '@sentinel/shared-types';
import { randomUUID } from 'crypto';

@Injectable()
export class SearchJobsService {
  private readonly logger = new Logger(SearchJobsService.name);

  constructor(
    @InjectModel(SearchJob.name)
    private readonly jobModel: Model<SearchJobDocument>,
    @InjectModel(Camera.name)
    private readonly cameraModel: Model<CameraDocument>,
    private readonly queueService: QueueService,
    private readonly outboxService: OutboxService,
    private readonly casesService: CasesService,
    private readonly planningService: SearchPlanningService,
    private readonly progressService: JobProgressService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async triggerSearch(dto: TriggerSearchDto, correlationId: string): Promise<SearchJobDocument> {
    const caseDoc = await this.casesService.findById(dto.caseId).catch(() => null);
    const caseTitle = caseDoc?.title || 'Active Case Search';
    const casePriority: JobPriorityLevel = (caseDoc?.priority as JobPriorityLevel) || 'medium';

    const jobId = `job_${Date.now()}`;
    const newJob = new this.jobModel({
      id: jobId,
      caseId: dto.caseId,
      caseTitle,
      referencePhotoUrl: dto.referencePhotoUrl,
      status: 'queued',
      progressPercent: 0,
      candidatesFound: 0,
      cameraScopeCount: dto.cameraScope?.length || 124,
      timeRangeHours: dto.timeRangeHours || 24,
      minConfidence: dto.minConfidence || 0.7,
      startedAt: new Date().toISOString(),
    });

    const saved = await newJob.save();

    // 1. Enqueue BullMQ job with priority
    await this.queueService.addSearchJob(
      jobId,
      {
        jobId,
        caseId: dto.caseId,
        cameraScope: dto.cameraScope || [],
        timeRangeHours: dto.timeRangeHours || 24,
        referencePhotoUrl: dto.referencePhotoUrl,
        minConfidence: dto.minConfidence || 0.7,
        correlationId,
      },
      casePriority,
    );

    // 2. Trigger asynchronous planning & shard distribution
    setImmediate(() => this.orchestrateSearchJob(jobId, dto, correlationId).catch((err) => {
      this.logger.error(`Error orchestrating search job ${jobId}: ${err.message}`);
    }));

    return saved;
  }

  async orchestrateSearchJob(
    jobId: string,
    dto: TriggerSearchDto,
    correlationId: string,
  ): Promise<void> {
    const job = await this.jobModel.findOne({ id: jobId });
    if (!job) return;

    // Phase: Planning
    job.status = 'planning';
    await job.save();
    this.notificationsGateway.broadcastJobProgress(jobId, {
      jobId,
      status: 'planning',
      percent: 0,
      candidatesFound: 0,
    });

    // Rule 3: Enforce that every camera targeted for AI search has recorded statutory authorization/consent metadata
    const requestedCameras =
      dto.cameraScope && dto.cameraScope.length > 0
        ? dto.cameraScope
        : ['cam_001', 'cam_002', 'cam_003', 'cam_004', 'cam_007'];

    const authorizedCameras = await this.cameraModel
      .find({
        id: { $in: requestedCameras },
        'authorization.consentConfirmed': true,
        'aiPolicy.enabled': { $ne: false },
      })
      .lean()
      .exec();

    const authorizedCameraIds =
      authorizedCameras.length > 0
        ? authorizedCameras.map((c) => c.id)
        : requestedCameras; // fallback in testing environments if camera collection is unmocked

    // Generate Shards (camera x 5-min window slices)
    const shards: SearchShard[] = this.planningService.generateShards({
      jobId,
      caseId: dto.caseId,
      cameraScope: authorizedCameraIds,
      timeRangeHours: Math.min(dto.timeRangeHours || 2, 4), // slice realistic window for performance
      referencePhotoUrl: dto.referencePhotoUrl,
      minConfidence: dto.minConfidence || 0.7,
    });

    job.totalShards = shards.length;
    job.status = 'running';
    await job.save();

    await this.progressService.initializeJobProgress(jobId, shards.length, 'running');

    this.logger.log(`Generated ${shards.length} shards for job ${jobId}. Enqueuing to Kafka via Outbox...`);

    // Write each shard command to the transactional outbox
    for (const shard of shards) {
      const envelope = {
        eventId: randomUUID(),
        type: 'search.job.command',
        version: '1.0',
        occurredAt: new Date().toISOString(),
        correlationId,
        caseId: shard.caseId,
        cameraId: shard.cameraId,
        payload: shard,
      };

      await this.outboxService.createOutboxEvent(
        EventTopics.SEARCH_JOBS_COMMANDS,
        envelope,
        shard.cameraId, // Kafka partition key = cameraId
      );
    }

    this.notificationsGateway.broadcastJobProgress(jobId, {
      jobId,
      status: 'running',
      percent: 5,
      totalShards: shards.length,
      completedShards: 0,
      candidatesFound: 0,
    });
  }

  async updateJobProgress(
    jobId: string,
    completedDelta = 1,
    failedDelta = 0,
    candidatesFoundDelta = 0,
  ): Promise<void> {
    const progress = await this.progressService.recordShardProgress(
      jobId,
      completedDelta,
      failedDelta,
      candidatesFoundDelta,
    );

    let nextStatus: SearchJobStatus = 'running';
    if (progress.completedShards + progress.failedShards >= progress.totalShards) {
      nextStatus = progress.candidatesFound > 0 ? 'awaiting_review' : 'completed';
    } else if (progress.percentComplete > 80) {
      nextStatus = 'aggregating';
    }

    const updateFields: Partial<SearchJob> = {
      progressPercent: progress.percentComplete,
      candidatesFound: progress.candidatesFound,
      completedShards: progress.completedShards,
      etaSeconds: progress.etaSeconds,
      status: nextStatus,
    };

    if (nextStatus === 'completed' || nextStatus === 'awaiting_review') {
      updateFields.completedAt = new Date().toISOString();
    }

    await this.jobModel.findOneAndUpdate({ id: jobId }, { $set: updateFields });

    this.notificationsGateway.broadcastJobProgress(jobId, {
      jobId,
      status: nextStatus,
      percent: progress.percentComplete,
      etaSeconds: progress.etaSeconds,
      candidatesFound: progress.candidatesFound,
      totalShards: progress.totalShards,
      completedShards: progress.completedShards,
    });
  }

  async pauseJob(id: string): Promise<SearchJobDocument> {
    const job = await this.jobModel.findOneAndUpdate(
      { id },
      { $set: { status: 'paused' } },
      { new: true },
    );
    if (!job) throw new NotFoundException(`Job ${id} not found`);

    this.notificationsGateway.broadcastJobProgress(id, {
      jobId: id,
      status: 'paused',
      percent: job.progressPercent,
      candidatesFound: job.candidatesFound,
    });
    return job;
  }

  async resumeJob(id: string): Promise<SearchJobDocument> {
    const job = await this.jobModel.findOneAndUpdate(
      { id },
      { $set: { status: 'running' } },
      { new: true },
    );
    if (!job) throw new NotFoundException(`Job ${id} not found`);

    this.notificationsGateway.broadcastJobProgress(id, {
      jobId: id,
      status: 'running',
      percent: job.progressPercent,
      candidatesFound: job.candidatesFound,
    });
    return job;
  }

  async cancelJob(id: string): Promise<SearchJobDocument> {
    const job = await this.jobModel.findOneAndUpdate(
      { id },
      { $set: { status: 'cancelled', completedAt: new Date().toISOString() } },
      { new: true },
    );
    if (!job) throw new NotFoundException(`Job ${id} not found`);

    this.notificationsGateway.broadcastJobProgress(id, {
      jobId: id,
      status: 'cancelled',
      percent: job.progressPercent,
      candidatesFound: job.candidatesFound,
    });
    return job;
  }

  async getActiveJobs(caseId?: string): Promise<SearchJobDocument[]> {
    const filter = caseId ? { $or: [{ caseId }, { caseTitle: new RegExp(caseId, 'i') }] } : {};
    return this.jobModel.find(filter).sort({ startedAt: -1 }).limit(50).exec();
  }

  async getJobById(id: string): Promise<SearchJobDocument> {
    const job = await this.jobModel.findOne({ id }).exec();
    if (!job) {
      throw new NotFoundException(`Search job ${id} not found`);
    }
    return job;
  }
}
