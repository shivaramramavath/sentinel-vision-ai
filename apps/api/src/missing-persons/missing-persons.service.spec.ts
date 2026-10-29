import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { MissingPersonsService } from './missing-persons.service';
import { MissingPerson } from './schemas/missing-person.schema';
import { ReferenceImage } from '../references/schemas/reference-image.schema';
import { ReferenceSetsService } from '../reference-sets/reference-sets.service';
import { KafkaService } from '../common/kafka/kafka.service';

describe('MissingPersonsService', () => {
  let service: MissingPersonsService;
  let mockMissingPersonModel: any;
  let mockReferenceImageModel: any;
  let mockReferenceSetsService: any;
  let mockKafkaService: any;

  const createMockDoc = (data: any = {}) => ({
    _id: '507f1f77bcf86cd799439011',
    personId: 'mp_chen01',
    caseId: 'case_chen01',
    status: 'draft',
    version: 1,
    referenceSetVersion: 1,
    identity: {
      fullName: 'Maya Chen',
      aliases: ['May'],
      gender: 'female',
      approxAgeRange: { min: 14, max: 15 },
    },
    physical: {
      heightCm: 155,
      build: 'slender',
      distinguishingMarks: ['scar above eye'],
    },
    vulnerability: {
      isMinor: true,
      medicalNotesEncrypted: 'aabb:ccdd:eeff',
      mentalHealthFlag: false,
      requiresUrgentPriority: true,
    },
    lastSeen: {
      ts: '2026-10-28T09:00:00Z',
      locationText: 'Central Concourse Platform 2',
      coordinates: { type: 'Point', coordinates: [78.4867, 17.385] },
    },
    lastSeenHistory: [
      {
        ts: '2026-10-28T09:00:00Z',
        locationText: 'Central Concourse Platform 2',
        coordinates: { type: 'Point', coordinates: [78.4867, 17.385] },
      },
    ],
    lastSeenClothing: {
      items: [{ type: 'hoodie', colour: 'yellow' }],
      accessories: [],
      footwear: 'sneakers',
      carriedItems: [],
    },
    reporter: {
      name: 'David Chen',
      relation: 'Father',
      phoneEncrypted: '1122:3344:5566',
    },
    authority: {
      reportNumber: 'FIR-2026-8839',
      station: 'Central Precinct',
      authorizedBy: 'Det. Vance',
      authorizedAt: '2026-10-28T09:30:00Z',
    },
    priority: 'high',
    computedPriorityScore: 85,
    searchPolicy: {
      defaultMinConfidence: 0.75,
      defaultTimeWindowHours: 24,
      autoSearchOnUpdate: true,
    },
    history: [],
    ...data,
    toObject(this: any) {
      return { ...this };
    },
    save: jest.fn().mockImplementation(function (this: any) {
      return Promise.resolve(this);
    }),
  });

  beforeEach(async () => {
    mockMissingPersonModel = jest.fn().mockImplementation((dto) => createMockDoc(dto));
    mockMissingPersonModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([createMockDoc()]),
      }),
    });
    mockMissingPersonModel.findOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(createMockDoc()),
    });

    mockReferenceImageModel = {
      find: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    };

    mockReferenceSetsService = {
      syncReferenceSet: jest.fn().mockResolvedValue({}),
      evaluateReadiness: jest.fn().mockResolvedValue({
        readinessScore: 88,
        breakdown: {},
        recommendations: [],
      }),
    };

    mockKafkaService = {
      publishEvent: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MissingPersonsService,
        { provide: getModelToken(MissingPerson.name), useValue: mockMissingPersonModel },
        { provide: getModelToken(ReferenceImage.name), useValue: mockReferenceImageModel },
        { provide: ReferenceSetsService, useValue: mockReferenceSetsService },
        { provide: KafkaService, useValue: mockKafkaService },
      ],
    }).compile();

    service = module.get<MissingPersonsService>(MissingPersonsService);
  });

  describe('Optimistic Concurrency Control (If-Match)', () => {
    it('should update document and increment version when If-Match matches current version', async () => {
      const doc = createMockDoc({ version: 2 });
      mockMissingPersonModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(doc),
      });

      const updated = await service.patch(
        'mp_chen01',
        { priority: 'critical' },
        '2', // If-Match: "2"
        'officer_lead',
      );

      expect(updated.version).toBe(3);
      expect(updated.priority).toBe('critical');
      expect(updated.history).toHaveLength(1);
      expect(updated.history[0].changedFields).toContain('priority');
    });

    it('should throw 409 Conflict when If-Match header differs from document version', async () => {
      const doc = createMockDoc({ version: 3 });
      mockMissingPersonModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(doc),
      });

      await expect(
        service.patch('mp_chen01', { priority: 'low' }, '2'), // Expected 2, actual 3
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Submit Dossier Validation', () => {
    it('should transition status from draft to active when all statutory conditions and references are met', async () => {
      const doc = createMockDoc({ status: 'draft' });
      mockMissingPersonModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(doc),
      });

      mockReferenceImageModel.find.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          {
            referenceId: 'ref_face_01',
            type: 'face_front',
            analysis: { face: { usable: true, detected: true } },
          },
        ]),
      });

      const submitted = await service.submit('mp_chen01', 'officer_lead');

      expect(submitted.status).toBe('active');
      expect(submitted.history[0].changedFields).toContain('status');
      expect(mockReferenceSetsService.syncReferenceSet).toHaveBeenCalled();
    });

    it('should reject submit if no usable face or body references exist', async () => {
      const doc = createMockDoc({ status: 'draft' });
      mockMissingPersonModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(doc),
      });

      mockReferenceImageModel.find.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([]), // No references
      });

      await expect(service.submit('mp_chen01')).rejects.toThrow(BadRequestException);
    });
  });

  describe('Update Last-Seen Rules', () => {
    it('should append to lastSeenHistory, update current lastSeen, compute reachable area, and trigger auto-search', async () => {
      const doc = createMockDoc();
      mockMissingPersonModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(doc),
      });

      const result = await service.addLastSeen(
        'mp_chen01',
        {
          ts: '2026-10-28T11:00:00Z',
          locationText: 'North Concourse Gate 4',
          coordinates: { type: 'Point', coordinates: [78.4912, 17.3891] },
          circumstances: 'Observed alighting from metro coach',
        },
        'field_officer',
      );

      expect(result.missingPerson.lastSeenHistory.length).toBe(2);
      expect(result.missingPerson.lastSeen.locationText).toBe('North Concourse Gate 4');
      expect(result.possibleArea.type).toBe('Feature');
      expect(result.possibleArea.geometry.type).toBe('Polygon');
      expect(result.autoSearchTriggered).toBe(true);

      expect(mockKafkaService.publishEvent).toHaveBeenCalledWith(
        'search.jobs.enqueue',
        expect.objectContaining({
          type: 'search.job.auto_triggered',
        }),
        'case_chen01',
      );
    });
  });

  describe('Status Transitions & Case Closure', () => {
    it('should record closureReason, closedAt, and publish case.status.closed event on found/closed', async () => {
      const doc = createMockDoc({ status: 'active' });
      mockMissingPersonModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(doc),
      });

      const closed = await service.updateStatus('mp_chen01', {
        status: 'found',
        reason: 'Safely recovered at family residence',
      });

      expect(closed.status).toBe('found');
      expect(closed.closedAt).toBeDefined();
      expect(closed.closureReason).toBe('Safely recovered at family residence');

      expect(mockKafkaService.publishEvent).toHaveBeenCalledWith(
        'case.events',
        expect.objectContaining({
          type: 'case.status.closed',
        }),
        'case_chen01',
      );
    });
  });
});
