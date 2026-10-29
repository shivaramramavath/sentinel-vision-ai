import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { EvidenceService } from './evidence.service';
import { Evidence } from './schemas/evidence.schema';

describe('EvidenceService (Cryptographic Integrity & Chain of Custody)', () => {
  let service: EvidenceService;
  let mockEvidenceDoc: any;
  let mockEvidenceModel: any;

  beforeEach(async () => {
    mockEvidenceDoc = {
      id: 'ev_sight_100',
      caseId: 'case_01',
      sightingId: 'sight_100',
      cameraId: 'cam_001',
      frameUrl: 'https://storage.sentinel/frames/frame_01.jpg',
      cropUrl: 'https://storage.sentinel/crops/crop_01.jpg',
      sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      chainOfCustody: [
        {
          action: 'ingested',
          actor: 'System AI Pipeline',
          timestamp: '2026-10-28T10:00:00Z',
          hash: 'initial_hash_123',
        },
      ],
      isRedacted: false,
      isPurged: false,
      save: jest.fn().mockImplementation(() => Promise.resolve(mockEvidenceDoc)),
    };

    mockEvidenceModel = {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockEvidenceDoc),
      }),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([mockEvidenceDoc]),
        }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvidenceService,
        {
          provide: getModelToken(Evidence.name),
          useValue: mockEvidenceModel,
        },
      ],
    }).compile();

    service = module.get<EvidenceService>(EvidenceService);
  });

  describe('Cryptographic Hashes', () => {
    it('should compute deterministic SHA-256 hash', () => {
      const hash1 = service.computeSha256('sentinel-frame-sample');
      const hash2 = service.computeSha256('sentinel-frame-sample');
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);
    });
  });

  describe('Chain of Custody', () => {
    it('should append an immutable custody entry with integrity hash', async () => {
      const updated = await service.recordCustodyEvent('ev_sight_100', 'viewed', 'alice@sentinel.gov');

      expect(updated.chainOfCustody.length).toBe(2);
      const latest = updated.chainOfCustody[1];
      expect(latest.action).toBe('viewed');
      expect(latest.actor).toBe('alice@sentinel.gov');
      expect(latest.hash.length).toBe(64);
      expect(mockEvidenceDoc.save).toHaveBeenCalled();
    });
  });

  describe('Privacy Controls (Redaction & Retention Purge)', () => {
    it('should mark evidence as redacted and log custody event', async () => {
      const updated = await service.redactEvidence('ev_sight_100', 'privacy_officer@sentinel.gov');

      expect(updated.isRedacted).toBe(true);
      expect(updated.chainOfCustody[updated.chainOfCustody.length - 1].action).toBe('redacted');
    });

    it('should purge media files under retention policy and log custody event', async () => {
      const updated = await service.purgeEvidence('ev_sight_100', 'retention_daemon');

      expect(updated.isPurged).toBe(true);
      expect(updated.frameUrl).toContain('PURGED');
      expect(updated.cropUrl).toContain('PURGED');
      expect(updated.chainOfCustody[updated.chainOfCustody.length - 1].action).toBe('purged');
    });
  });
});
