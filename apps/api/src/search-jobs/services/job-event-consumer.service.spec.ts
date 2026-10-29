import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JobEventConsumerService } from './job-event-consumer.service';
import { RedisService } from '../../common/redis/redis.service';
import { SearchJobsService } from '../search-jobs.service';
import { NotificationsGateway } from '../../notifications/notifications.gateway';
import { Sighting } from '../../sightings/schemas/sighting.schema';
import { Evidence } from '../../evidence/schemas/evidence.schema';
import { EvidenceService } from '../../evidence/evidence.service';
import { ConfigService } from '@nestjs/config';
import { EventTopics } from '@sentinel/shared-types';

describe('JobEventConsumerService (Idempotency & Candidate Ingestion)', () => {
  let service: JobEventConsumerService;
  let redisService: RedisService;
  let searchJobsService: SearchJobsService;
  let notificationsGateway: NotificationsGateway;

  const seenKeys = new Set<string>();

  class MockModel {
    data: any;
    save: any;

    constructor(data: any) {
      this.data = data;
      this.save = jest.fn().mockImplementation(() => Promise.resolve(this.data));
    }
  }

  beforeEach(async () => {
    seenKeys.clear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobEventConsumerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(['localhost:9092']),
          },
        },
        {
          provide: RedisService,
          useValue: {
            setnx: jest.fn().mockImplementation((key: string) => {
              if (seenKeys.has(key)) return Promise.resolve(false);
              seenKeys.add(key);
              return Promise.resolve(true);
            }),
          },
        },
        {
          provide: SearchJobsService,
          useValue: {
            updateJobProgress: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: NotificationsGateway,
          useValue: {
            broadcastCandidateSighting: jest.fn(),
            broadcastAlert: jest.fn(),
            broadcastJourneyUpdated: jest.fn(),
          },
        },
        {
          provide: EvidenceService,
          useValue: {
            computeSha256: jest.fn().mockReturnValue('mock_sha256_hash'),
          },
        },
        {
          provide: getModelToken(Sighting.name),
          useValue: MockModel,
        },
        {
          provide: getModelToken(Evidence.name),
          useValue: MockModel,
        },
      ],
    }).compile();

    service = module.get<JobEventConsumerService>(JobEventConsumerService);
    redisService = module.get<RedisService>(RedisService);
    searchJobsService = module.get<SearchJobsService>(SearchJobsService);
    notificationsGateway = module.get<NotificationsGateway>(NotificationsGateway);
  });

  it('should process event and reject duplicate event via Redis SETNX idempotency', async () => {
    const envelope = {
      eventId: 'evt_unique_123',
      type: 'search.jobs.progress',
      version: '1.0',
      occurredAt: new Date().toISOString(),
      correlationId: 'corr_01',
      payload: {
        jobId: 'job_01',
        completedDelta: 1,
      },
    };

    // First delivery -> processed
    const firstResult = await service.processIncomingEvent(EventTopics.SEARCH_JOBS_PROGRESS, envelope);
    expect(firstResult).toBe(true);
    expect(searchJobsService.updateJobProgress).toHaveBeenCalledWith('job_01', 1, 0, 0);

    // Second delivery (replay/retry from Kafka) -> dropped as duplicate
    const secondResult = await service.processIncomingEvent(EventTopics.SEARCH_JOBS_PROGRESS, envelope);
    expect(secondResult).toBe(false);
  });

  it('should ingest candidate sighting with separated face/reid metrics and emit via Socket.IO', async () => {
    const candidateEnvelope = {
      eventId: 'evt_cand_999',
      type: 'candidates.scored',
      version: '1.0',
      occurredAt: new Date().toISOString(),
      correlationId: 'corr_cand',
      caseId: 'case_101',
      cameraId: 'cam_003',
      payload: {
        jobId: 'job_01',
        caseId: 'case_101',
        cameraId: 'cam_003',
        faceScore: 0.89,
        reidScore: 0.86,
        fusedScore: 0.88,
        frameUrl: 'https://example.com/frame.jpg',
        model_version: 'v1.0',
      },
    };

    const ingested = await service.processIncomingEvent(EventTopics.CANDIDATES_SCORED, candidateEnvelope);
    expect(ingested).toBe(true);
    expect(notificationsGateway.broadcastCandidateSighting).toHaveBeenCalled();
  });
});
