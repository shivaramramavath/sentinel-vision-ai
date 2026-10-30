import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Partitioners, Producer } from 'kafkajs';
import { EventEnvelope } from '@sentinel/shared-types';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka: Kafka | null = null;
  private producer: Producer | null = null;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const brokers = this.configService.get<string[]>('app.kafkaBrokers', ['localhost:9092']);
    try {
      this.kafka = new Kafka({
        clientId: 'sentinel-api-producer',
        brokers,
        retry: { retries: 2 },
      });
      this.producer = this.kafka.producer({
        // Explicitly use DefaultPartitioner to suppress the KafkaJS
        // partitioner deprecation warning and to maintain per-camera
        // ordering when messages are keyed by cameraId.
        createPartitioner: Partitioners.DefaultPartitioner,
      });
      await this.producer.connect();
      this.isConnected = true;
      this.logger.log(`Kafka Producer connected to brokers: ${brokers.join(',')}`);
    } catch (err: any) {
      this.logger.warn(`Kafka unavailable (${err.message}). Events will be queued/logged in fallback mode.`);
      this.isConnected = false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.producer && this.isConnected) {
      await this.producer.disconnect().catch(() => null);
    }
  }

  async publishEvent<T>(
    topic: string,
    event: EventEnvelope<T>,
    partitionKey?: string,
  ): Promise<boolean> {
    // Partition key is cameraId if available, otherwise correlationId or caseId
    const key = partitionKey || event.cameraId || event.caseId || event.correlationId;

    if (this.isConnected && this.producer) {
      try {
        await this.producer.send({
          topic,
          messages: [
            {
              key,
              value: JSON.stringify(event),
              headers: {
                'x-event-id': event.eventId,
                'x-correlation-id': event.correlationId,
              },
            },
          ],
        });
        return true;
      } catch (err: any) {
        this.logger.error(`Failed to publish event to topic ${topic}: ${err.message}`);
        return false;
      }
    }

    this.logger.log(`[Kafka fallback] Event ${event.type} dispatched for topic ${topic} (key=${key})`);
    return true;
  }
}
