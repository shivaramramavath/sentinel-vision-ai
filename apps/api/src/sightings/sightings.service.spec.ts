import { Test, TestingModule } from '@nestjs/testing';
import { SightingsService } from './sightings.service';
import { getModelToken } from '@nestjs/mongoose';
import { Sighting } from './schemas/sighting.schema';
import { HardNegative } from './schemas/hard-negative.schema';
import { CasesService } from '../cases/cases.service';
import { ReferencesService } from '../references/references.service';
import { MissingPersonsService } from '../missing-persons/missing-persons.service';
import { BadRequestException } from '@nestjs/common';

describe('SightingsService (Cursor Pagination & Verification Rules)', () => {
  let service: SightingsService;
  let sightingModelMock: any;
  let hardNegativeModelMock: any;
  let casesServiceMock: any;
  let referencesServiceMock: any;

  const mockSightings = [
    { id: 's_01', caseId: 'case_1', timestamp: '2026-10-28T10:00:00Z', confidence: 'high' },
    { id: 's_02', caseId: 'case_1', timestamp: '2026-10-28T09:30:00Z', confidence: 'medium' },
    { id: 's_03', caseId: 'case_1', timestamp: '2026-10-28T09:00:00Z', confidence: 'low' },
  ];

  beforeEach(async () => {
    sightingModelMock = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockSightings),
          }),
        }),
      }),
      findOne: jest.fn(),
    };

    hardNegativeModelMock = {
      create: jest.fn().mockResolvedValue({ id: 'neg_123' }),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
    };

    casesServiceMock = {
      incrementSightingsCount: jest.fn().mockResolvedValue(true),
      findById: jest.fn().mockResolvedValue({ id: 'case_1', priority: 'critical' }),
      addReferencePhoto: jest.fn().mockResolvedValue({}),
    };

    referencesServiceMock = {
      registerCctvCropReference: jest.fn().mockResolvedValue({ referenceId: 'ref_cctv_999' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SightingsService,
        {
          provide: getModelToken(Sighting.name),
          useValue: sightingModelMock,
        },
        {
          provide: getModelToken(HardNegative.name),
          useValue: hardNegativeModelMock,
        },
        {
          provide: CasesService,
          useValue: casesServiceMock,
        },
        {
          provide: ReferencesService,
          useValue: referencesServiceMock,
        },
        {
          provide: MissingPersonsService,
          useValue: {
            findById: jest.fn().mockResolvedValue({ personId: 'case_1', priority: 'critical' }),
          },
        },
      ],
    }).compile();

    service = module.get<SightingsService>(SightingsService);
  });

  it('should encode and decode cursor correctly', () => {
    const timestamp = '2026-10-28T12:00:00Z';
    const id = 'sight_100';

    const encoded = service.encodeCursor(timestamp, id);
    expect(typeof encoded).toBe('string');

    const decoded = service.decodeCursor(encoded);
    expect(decoded).toEqual({ t: timestamp, id });
  });

  it('should return null on malformed cursor', () => {
    const invalid = service.decodeCursor('invalid_non_json_string');
    expect(invalid).toBeNull();
  });

  it('should register rejected sightings as hard negatives', async () => {
    const mockSightingDoc: any = {
      id: 'sight_01',
      caseId: 'case_1',
      thumbnailUrl: 'https://minio/crops/crop1.jpg',
      model_version: 'v1.0',
      save: jest.fn().mockResolvedValue({ id: 'sight_01', status: 'rejected' }),
    };

    sightingModelMock.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockSightingDoc),
    });

    await service.review('sight_01', 'rejected', 'Different person with similar haircut', 'Det. Brody', 'different_person');

    expect(hardNegativeModelMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: 'case_1',
        sightingId: 'sight_01',
        rejectReasonCode: 'different_person',
        rejectedBy: 'Det. Brody',
      }),
    );
  });

  it('should enforce second approver rule on high-priority cases when promoting verified sighting', async () => {
    const mockSightingDoc: any = {
      id: 'sight_01',
      caseId: 'case_1',
      status: 'confirmed',
      promotionStatus: 'none',
      thumbnailUrl: 'https://minio/crops/crop1.jpg',
      fusedScore: 0.94,
      save: jest.fn().mockResolvedValue(true),
    };

    sightingModelMock.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockSightingDoc),
    });

    // Requester 1 calls promote
    const firstAttempt = await service.promoteToReference('sight_01', 'Insp. Vance');
    expect(firstAttempt.status).toBe('pending_approval');
    expect(firstAttempt.requiresSecondApprover).toBe(true);

    // Same requester cannot approve their own request
    mockSightingDoc.promotionStatus = 'pending_approval';
    mockSightingDoc.promotionRequestedBy = 'Insp. Vance';

    await expect(service.promoteToReference('sight_01', 'Insp. Vance')).rejects.toThrow(
      BadRequestException,
    );

    // Second approver approves
    const secondAttempt = await service.promoteToReference('sight_01', 'Supervisor Miller');
    expect(secondAttempt.status).toBe('promoted');
    expect(referencesServiceMock.registerCctvCropReference).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: 'case_1',
        sightingId: 'sight_01',
        qualityScore: 94,
      }),
    );
  });
});
