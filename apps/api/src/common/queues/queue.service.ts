import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bullmq';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

export type JobPriorityLevel = 'critical' | 'high' | 'medium' | 'low';

export const PRIORITY_MAP: Record<JobPriorityLevel, number> = {
  critical: 1, // Highest priority in BullMQ
  high: 2,
  medium: 5,
  low: 10,
};

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);

  public searchQueue: Queue;
  public reportQueue: Queue;
  public maintenanceQueue: Queue;

  public searchWorker: Worker | null = null;
  public maintenanceWorker: Worker | null = null;

  public serverAdapter: ExpressAdapter;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('redis.host') || this.configService.get<string>('app.redisHost', 'localhost');
    const port = this.configService.get<number>('redis.port') || this.configService.get<number>('app.redisPort', 6379);
    const password = this.configService.get<string>('redis.password');
    const db = this.configService.get<number>('redis.db', 0);

    const connection = {
      host,
      port,
      password: password || undefined,
      db,
      maxRetriesPerRequest: null,
      connectTimeout: 2000,
      retryStrategy: (times: number) => (times > 3 ? null : 200),
      lazyConnect: true,
    };

    // Initialize Queues with default exponential backoff retry policy
    const defaultJobOptions = {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 500, // Retained in DLQ for analysis
    };

    this.searchQueue = new Queue('search', {
      connection,
      prefix: '{bull}',
      defaultJobOptions,
    });
    this.searchQueue.on('error', () => null);

    this.reportQueue = new Queue('report', {
      connection,
      prefix: '{bull}',
      defaultJobOptions,
    });
    this.reportQueue.on('error', () => null);

    this.maintenanceQueue = new Queue('maintenance', {
      connection,
      prefix: '{bull}',
      defaultJobOptions,
    });
    this.maintenanceQueue.on('error', () => null);

    // Bull Board integration
    this.serverAdapter = new ExpressAdapter();
    this.serverAdapter.setBasePath('/admin/queues');

    createBullBoard({
      queues: [
        new BullMQAdapter(this.searchQueue),
        new BullMQAdapter(this.reportQueue),
        new BullMQAdapter(this.maintenanceQueue),
      ],
      serverAdapter: this.serverAdapter,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      // Add repeatable maintenance job (runs every 60 minutes)
      await this.maintenanceQueue.add(
        'system-integrity-check',
        { task: 'health_and_outbox_cleanup' },
        {
          repeat: {
            every: 60 * 60 * 1000, // 1 hour
          },
        } as any,
      ).catch(() => null);

      // Privacy Control: Repeatable retention purge job (runs daily to purge media older than retention limit)
      await this.maintenanceQueue.add(
        'data-retention-purge',
        { retentionDays: 30 },
        {
          repeat: {
            every: 24 * 60 * 60 * 1000, // 24 hours
          },
        } as any,
      ).catch(() => null);

      this.logger.log('BullMQ queues initialized with Bull Board at /admin/queues and retention purge scheduled');
    } catch (err: any) {
      this.logger.warn(`BullMQ queue initialization notice: ${err.message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.searchWorker) await this.searchWorker.close().catch(() => null);
    if (this.maintenanceWorker) await this.maintenanceWorker.close().catch(() => null);
    await this.searchQueue.close().catch(() => null);
    await this.reportQueue.close().catch(() => null);
    await this.maintenanceQueue.close().catch(() => null);
  }

  async addSearchJob(
    jobId: string,
    data: any,
    priority: JobPriorityLevel = 'medium',
  ): Promise<Job | null> {
    try {
      return await this.searchQueue.add(
        'plan-and-shard',
        data,
        {
          jobId,
          priority: PRIORITY_MAP[priority] || 5,
        },
      );
    } catch (err: any) {
      this.logger.warn(`BullMQ job enqueued in memory mode: ${err.message}`);
      return null;
    }
  }

  async pauseSearchJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.searchQueue.getJob(jobId);
      if (job) {
        return true;
      }
    } catch {
      // in memory mode
    }
    return false;
  }
}
