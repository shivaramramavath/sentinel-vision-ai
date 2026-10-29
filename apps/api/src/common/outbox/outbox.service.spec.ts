import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { OutboxService } from './outbox.service';
import { OutboxEvent } from './schemas/outbox-event.schema';
import { KafkaService } from '../kafka/kafka.service';

describe('OutboxService (Transactional Outbox Pattern)', () => {
  let service: OutboxService;
  let kafkaService: KafkaService;

  const mockEvents: any[] = [];

  class MockOutboxModel {
    eventId: string;
    topic: string;
    partitionKey: string;
    payload: any;
    status: string;
    retryCount: number;
    publishedAt: any;
    lastError: any;

    constructor(data: any) {
      Object.assign(this, data);
    }

    save = jest.fn().mockImplementation(() => {
      mockEvents.push(this);
      return Promise.resolve(this);
    });

    static find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          exec: jest.fn().mockImplementation(() => Promise.resolve([...mockEvents])),
        }),
      }),
    });
  }

  beforeEach(async () => {
    mockEvents.length = 0;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxService,
        {
          provide: getModelToken(OutboxEvent.name),
          useValue: MockOutboxModel,
        },
        {
          provide: KafkaService,
          useValue: {
            publishEvent: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<OutboxService>(OutboxService);
    kafkaService = module.get<KafkaService>(KafkaService);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should create an outbox event with status pending and relay it to Kafka', async () => {
    const envelope = {
      eventId: 'evt_100',
      type: 'search.job.command',
      version: '1.0',
      occurredAt: new Date().toISOString(),
      correlationId: 'corr_test',
      cameraId: 'cam_001',
      payload: { jobId: 'job_1' },
    };

    const created = await service.createOutboxEvent('search.jobs.commands', envelope, 'cam_001');
    expect(created.status).toBe('pending');
    expect(created.topic).toBe('search.jobs.commands');

    // Trigger relay
    const publishedCount = await service.relayPendingEvents();
    expect(publishedCount).toBe(1);
    expect(created.status).toBe('published');
    expect(created.publishedAt).toBeDefined();
  });
});
