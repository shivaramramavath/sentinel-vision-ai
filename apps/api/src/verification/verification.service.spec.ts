import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { SightingsService } from '../sightings/sightings.service';
import { CasesService } from '../cases/cases.service';
import { CamerasService } from '../cameras/cameras.service';
import { RedisService } from '../common/redis/redis.service';
import { Sighting } from '../sightings/schemas/sighting.schema';
import { VerificationLabel } from './schemas/verification-label.schema';

describe('VerificationService (Workflow, Two-Person Rule & Reviewer Lock)', () => {
  let service: VerificationService;
  let redisService: RedisService;
  let casesService: CasesService;

  let mockSightingDoc: any;
  let mockLabelModel: any;
  let mockSightingModel: any;

  beforeEach(async () => {
    mockSightingDoc = {
      id: 'sight_test_01',
      caseId: 'case_crit_01',
      status: 'pending',
      fusedScore: 0.88,
      faceScore: 0.89,
      reidScore: 0.85,
      temporalScore: 0.90,
      cameraPlausibility: 0.95,
      confidence: 'high',
      cameraId: 'cam_001',
      model_version: 'sentinel-fusion-v1.0.0',
      firstReviewerId: null,
      save: jest.fn().mockImplementation(() => Promise.resolve(mockSightingDoc)),
    };

    mockSightingModel = {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSightingDoc),
      }),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([mockSightingDoc]),
            }),
          }),
        }),
      }),
    };

    mockLabelModel = {
      create: jest.fn().mockResolvedValue(true),
      find: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    };

    const redisLocks = new Map<string, string>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationService,
        {
          provide: SightingsService,
          useValue: {
            review: jest.fn(),
          },
        },
        {
          provide: CasesService,
          useValue: {
            findById: jest.fn().mockResolvedValue({
              id: 'case_crit_01',
              priority: 'critical',
            }),
            incrementSightingsCount: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: CamerasService,
          useValue: {
            learnTransition: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: RedisService,
          useValue: {
            setnx: jest.fn().mockImplementation(async (k: string, v: string) => {
              if (redisLocks.has(k)) return false;
              redisLocks.set(k, v);
              return true;
            }),
            get: jest.fn().mockImplementation(async (k: string) => redisLocks.get(k) || null),
            del: jest.fn().mockImplementation(async (k: string) => {
              redisLocks.delete(k);
              return true;
            }),
          },
        },
        {
          provide: getModelToken(Sighting.name),
          useValue: mockSightingModel,
        },
        {
          provide: getModelToken(VerificationLabel.name),
          useValue: mockLabelModel,
        },
      ],
    }).compile();

    service = module.get<VerificationService>(VerificationService);
    redisService = module.get<RedisService>(RedisService);
    casesService = module.get<CasesService>(CasesService);
  });

  describe('Distributed Reviewer Lock', () => {
    it('should acquire lock when free', async () => {
      const res = await service.acquireLock('sight_test_01', 'rev_1', 'alice@sentinel.gov');
      expect(res.status).toBe('locked');
      expect(res.lockedBy).toBe('alice@sentinel.gov');
      expect(mockSightingDoc.status).toBe('locked');
    });

    it('should reject concurrent lock attempt by another reviewer (409 Conflict)', async () => {
      await service.acquireLock('sight_test_01', 'rev_1', 'alice@sentinel.gov');

      await expect(
        service.acquireLock('sight_test_01', 'rev_2', 'bob@sentinel.gov'),
      ).rejects.toThrow(ConflictException);
    });

    it('should release lock cleanly and restore pending state', async () => {
      await service.acquireLock('sight_test_01', 'rev_1', 'alice@sentinel.gov');
      const release = await service.releaseLock('sight_test_01', 'alice@sentinel.gov');
      expect(release.status).toBe('unlocked');
      expect(mockSightingDoc.status).toBe('pending');
    });
  });

  describe('Reject Validation', () => {
    it('should throw BadRequestException if rejectReasonCode is missing on reject', async () => {
      await expect(
        service.verifySighting(
          'sight_test_01',
          { status: 'rejected', notes: 'Subject mismatch' },
          'rev_1',
          'alice@sentinel.gov',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if notes are empty on reject', async () => {
      await expect(
        service.verifySighting(
          'sight_test_01',
          { status: 'rejected', rejectReasonCode: 'different_person', notes: '' },
          'rev_1',
          'alice@sentinel.gov',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Two-Person Rule on High/Critical Priority Cases', () => {
    it('should transition to pending_second_review on first confirmation', async () => {
      const res = await service.verifySighting(
        'sight_test_01',
        { status: 'confirmed', notes: 'Facial features align with reference photo' },
        'rev_1',
        'alice@sentinel.gov',
      );

      expect(res.status).toBe('pending_second_review');
      expect(res.firstReviewerId).toBe('alice@sentinel.gov');
      expect(casesService.incrementSightingsCount).not.toHaveBeenCalled();
    });

    it('should prevent self-approval by the same reviewer (Two-Person rule violation)', async () => {
      mockSightingDoc.firstReviewerId = 'alice@sentinel.gov';
      mockSightingDoc.status = 'pending_second_review';

      await expect(
        service.verifySighting(
          'sight_test_01',
          { status: 'confirmed', notes: 'I confirm again' },
          'rev_1',
          'alice@sentinel.gov', // Same reviewer!
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should transition to confirmed when second distinct reviewer confirms', async () => {
      mockSightingDoc.firstReviewerId = 'alice@sentinel.gov';
      mockSightingDoc.status = 'pending_second_review';

      const res = await service.verifySighting(
        'sight_test_01',
        { status: 'confirmed', notes: 'Secondary review confirms possible match' },
        'rev_2',
        'bob@sentinel.gov', // Distinct second reviewer!
      );

      expect(res.status).toBe('confirmed');
      expect(res.secondReviewerId).toBe('bob@sentinel.gov');
      expect(casesService.incrementSightingsCount).toHaveBeenCalledWith('case_crit_01');
      expect(mockLabelModel.create).toHaveBeenCalled();
    });
  });
});
