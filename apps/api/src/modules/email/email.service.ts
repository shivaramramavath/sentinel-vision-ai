import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { createHash } from 'crypto';
import { EMAIL_QUEUE_NAME, EMAIL_DEFAULT_JOB_OPTIONS, EmailJobData } from './email.queue';
import { TemplateId, TemplateData } from './templates';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private emailQueue: Queue;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('redis.host') || this.configService.get<string>('app.redisHost', 'localhost');
    const port = this.configService.get<number>('redis.port') || this.configService.get<number>('app.redisPort', 6379);
    const password = this.configService.get<string>('redis.password');
    const db = this.configService.get<number>('redis.db', 0);

    this.emailQueue = new Queue(EMAIL_QUEUE_NAME, {
      connection: {
        host,
        port,
        password: password || undefined,
        db,
        maxRetriesPerRequest: null,
      },
      prefix: '{bull}',
      defaultJobOptions: EMAIL_DEFAULT_JOB_OPTIONS,
    });
    this.emailQueue.on('error', () => null);
  }

  /**
   * The sole public entry point for all application modules to send emails.
   * Enqueues job to BullMQ and returns immediately without blocking HTTP requests.
   */
  async enqueue<T extends TemplateId>(
    templateId: T,
    data: TemplateData<T>,
    options?: {
      recipientEmail?: string;
      recipientName?: string;
      idempotencyKey?: string;
      tags?: string[];
      delay?: number;
    },
  ): Promise<{ jobId: string }> {
    const recipientEmail = options?.recipientEmail || (data as any)?.email;
    const recipientName = options?.recipientName || (data as any)?.name;

    if (!recipientEmail) {
      throw new Error(`Email recipient is required to enqueue template [${templateId}].`);
    }

    const emailDomain = recipientEmail.includes('@') ? recipientEmail.split('@')[1] : 'unknown';
    const emailHash = createHash('sha256').update(recipientEmail.trim().toLowerCase()).digest('hex');

    const idempotencyKey =
      options?.idempotencyKey ||
      createHash('sha256')
        .update(`${templateId}_${emailHash}_${Date.now()}`)
        .digest('hex');

    const jobData: EmailJobData<T> = {
      templateId,
      data,
      recipientEmail,
      recipientName,
      idempotencyKey,
      tags: options?.tags || [templateId],
    };

    const job = await this.emailQueue.add('send-email', jobData, {
      jobId: idempotencyKey,
      delay: options?.delay,
    });

    this.logger.log(`Enqueued email [${templateId}] | jobId=${job.id} recipientDomain=@${emailDomain}`);

    return { jobId: String(job.id) };
  }

  getQueue(): Queue {
    return this.emailQueue;
  }
}
