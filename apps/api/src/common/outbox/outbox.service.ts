import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OutboxEvent, OutboxEventDocument } from './schemas/outbox-event.schema';
import { KafkaService } from '../kafka/kafka.service';
import { EventEnvelope } from '@sentinel/shared-types';

@Injectable()
export class OutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxService.name);
  private relayTimer: NodeJS.Timeout | null = null;
  private isRelaying = false;

  constructor(
    @InjectModel(OutboxEvent.name)
    private readonly outboxModel: Model<OutboxEventDocument>,
    private readonly kafkaService: KafkaService,
  ) {}

  onModuleInit(): void {
    // Start background relay loop every 1 second
    this.relayTimer = setInterval(() => {
      this.relayPendingEvents().catch((err) => {
        this.logger.error(`Error in outbox relay loop: ${err.message}`);
      });
    }, 1000);
    // Unref timer so it doesn't block shutdown
    this.relayTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.relayTimer) {
      clearInterval(this.relayTimer);
      this.relayTimer = null;
    }
  }

  async createOutboxEvent<T>(
    topic: string,
    envelope: EventEnvelope<T>,
    partitionKey?: string,
  ): Promise<OutboxEventDocument> {
    const key = partitionKey || envelope.cameraId || envelope.caseId || envelope.correlationId || '';
    const event = new this.outboxModel({
      eventId: envelope.eventId,
      topic,
      partitionKey: key,
      payload: envelope,
      status: 'pending',
      retryCount: 0,
    });
    const saved = await event.save();
    // Trigger immediate relay asynchronously
    setImmediate(() => this.relayPendingEvents().catch(() => null));
    return saved;
  }

  async relayPendingEvents(batchSize = 25): Promise<number> {
    if (this.isRelaying) return 0;
    this.isRelaying = true;

    try {
      const pendingEvents = await this.outboxModel
        .find({ status: 'pending' })
        .sort({ createdAt: 1 })
        .limit(batchSize)
        .exec();

      if (pendingEvents.length === 0) {
        return 0;
      }

      let publishedCount = 0;

      for (const event of pendingEvents) {
        try {
          const success = await this.kafkaService.publishEvent(
            event.topic,
            event.payload as any,
            event.partitionKey,
          );

          if (success) {
            event.status = 'published';
            event.publishedAt = new Date();
            await event.save();
            publishedCount++;
          } else {
            // Apply exponential backoff with jitter
            event.retryCount += 1;
            const jitterMs = Math.floor(Math.random() * 500);
            const backoffMs = Math.min(1000 * Math.pow(2, event.retryCount) + jitterMs, 30000);
            event.lastError = `Kafka delivery deferred, backoff: ${backoffMs}ms`;
            if (event.retryCount >= 10) {
              event.status = 'failed';
            }
            await event.save();
          }
        } catch (err: any) {
          event.retryCount += 1;
          event.lastError = err.message;
          if (event.retryCount >= 10) {
            event.status = 'failed';
          }
          await event.save();
        }
      }

      return publishedCount;
    } finally {
      this.isRelaying = false;
    }
  }
}
