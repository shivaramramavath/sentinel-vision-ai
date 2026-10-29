import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Worker, Job, Queue } from 'bullmq';
import { createHash } from 'crypto';
import { EMAIL_QUEUE_NAME, EMAIL_DLQ_NAME, EmailJobData } from './email.queue';
import { emailTemplates } from './templates';
import { MailTransport, MAIL_TRANSPORT } from './transport/mail-transport.interface';
import { EmailLog, EmailLogDocument } from './schemas/email-log.schema';

@Injectable()
export class EmailProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailProcessor.name);
  private worker: Worker | null = null;
  private dlq: Queue | null = null;

  constructor(
    private readonly configService: ConfigService,
    @Inject(MAIL_TRANSPORT) private readonly mailTransport: MailTransport,
    @InjectModel(EmailLog.name) private readonly emailLogModel: Model<EmailLogDocument>,
  ) {}

  private hashEmail(email: string): string {
    return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  }

  async onModuleInit(): Promise<void> {
    const host = this.configService.get<string>('app.redisHost', 'localhost');
    const port = this.configService.get<number>('app.redisPort', 6379);

    const connection = {
      host,
      port,
      maxRetriesPerRequest: null,
      connectTimeout: 2000,
      retryStrategy: (times: number) => (times > 3 ? null : 200),
      lazyConnect: true,
    };

    // DLQ Queue
    this.dlq = new Queue(EMAIL_DLQ_NAME, { connection });

    // BullMQ Worker for Email processing
    this.worker = new Worker<EmailJobData>(
      EMAIL_QUEUE_NAME,
      async (job: Job<EmailJobData>) => this.processJob(job),
      {
        connection,
        concurrency: 5,
        limiter: {
          max: 20,
          duration: 1000, // max 20 emails per second
        },
      },
    );

    this.worker.on('failed', async (job, err) => {
      if (job) {
        this.logger.error(
          `Job ${job.id} for template [${job.data.templateId}] failed (attempt ${job.attemptsMade}/${job.opts.attempts}): ${err.message}`,
        );

        if (job.attemptsMade >= (job.opts.attempts || 5)) {
          // Route to Dead Letter Queue
          await this.dlq?.add('failed-email', {
            ...job.data,
            originalJobId: job.id,
            error: err.message,
            stack: err.stack,
            failedAt: new Date().toISOString(),
          });

          // Mark as dead_letter in EmailLog
          const recipientHash = this.hashEmail(job.data.recipientEmail);
          await this.emailLogModel.updateOne(
            { idempotencyKey: job.data.idempotencyKey || `${job.id}_${recipientHash}` },
            {
              $set: {
                status: 'dead_letter',
                errorCode: err.name || 'MAX_ATTEMPTS_EXCEEDED',
                lastError: err.message,
                attempts: job.attemptsMade,
              },
            },
          );
        }
      }
    });

    this.worker.on('error', (err) => {
      this.logger.warn(`Email worker background notice: ${err.message}`);
    });

    this.logger.log('BullMQ Email Worker initialized and listening on queue "email"');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) await this.worker.close().catch(() => null);
    if (this.dlq) await this.dlq.close().catch(() => null);
  }

  private async processJob(job: Job<EmailJobData>): Promise<{ messageId: string }> {
    const { templateId, data, recipientEmail, recipientName, idempotencyKey, tags } = job.data;
    const recipientHash = this.hashEmail(recipientEmail);
    const resolvedIdempotencyKey = idempotencyKey || `${job.id}_${recipientHash}`;

    // 1. Idempotency Check: if already sent, skip duplicate dispatch
    const existingLog = await this.emailLogModel.findOne({ idempotencyKey: resolvedIdempotencyKey });
    if (existingLog && existingLog.status === 'sent') {
      this.logger.log(`Idempotent email skip | key=${resolvedIdempotencyKey} template=${templateId}`);
      return { messageId: existingLog.messageId || 'idempotent_cached' };
    }

    // 2. Render Template
    const templateFn = (emailTemplates as any)[templateId];
    if (!templateFn) {
      throw new Error(`Email template [${templateId}] does not exist.`);
    }

    const rendered = templateFn(data);

    // 3. Dispatch through MailTransport
    try {
      const result = await this.mailTransport.sendEmail({
        recipient: {
          email: recipientEmail,
          name: recipientName,
        },
        subject: rendered.subject,
        htmlContent: rendered.htmlContent,
        textContent: rendered.textContent,
        tags: tags || [templateId],
        idempotencyKey: resolvedIdempotencyKey,
      });

      // 4. Update EmailLog on success
      await this.emailLogModel.findOneAndUpdate(
        { idempotencyKey: resolvedIdempotencyKey },
        {
          $set: {
            templateId,
            recipientHash,
            status: 'sent',
            messageId: result.messageId,
            attempts: job.attemptsMade,
            sentAt: new Date(),
          },
        },
        { upsert: true, new: true },
      );

      return result;
    } catch (err: any) {
      // Record failure attempt in EmailLog without storing bodies
      await this.emailLogModel.findOneAndUpdate(
        { idempotencyKey: resolvedIdempotencyKey },
        {
          $set: {
            templateId,
            recipientHash,
            status: 'failed',
            errorCode: err.code || err.statusCode || 'SEND_ERROR',
            lastError: err.message,
            attempts: job.attemptsMade,
          },
        },
        { upsert: true, new: true },
      );

      throw err; // Rethrow so BullMQ exponential retry triggers
    }
  }
}
