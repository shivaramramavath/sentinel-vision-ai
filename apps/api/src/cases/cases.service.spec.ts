import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CasesService } from './cases.service';
import { Case } from './schemas/case.schema';
import { Sighting } from '../sightings/schemas/sighting.schema';
import { Camera } from '../cameras/schemas/camera.schema';
import { KafkaService } from '../common/kafka/kafka.service';
import { decryptField } from '../common/crypto/field-crypto.util';

describe('CasesService - Missing-Person Rules & Compliance', () => {
  let service: CasesService;
  let mockCaseModel: any;
  let mockSightingModel: any;
  let mockCameraModel: any;
  let mockKafkaService: any;

  const mockCaseDoc: any = {
    _id: '507f1f77bcf86cd799439011',
    caseNumber: 'MP-2026-1001',
    title: 'Search for Maya Chen',
    personName: 'Maya Chen',
    age: 14,
    gender: 'female',
    lastSeenLocation: 'Central Station Platform 3',
    lastSeenAt: '2026-10-28T09:00:00Z',
    status: 'active',
    priority: 'high',
    isMinor: true,
    isVulnerable: false,
    referenceSetVersion: 1,
    referencePhotos: [],
    referenceVersionHistory: [],
    registrationAuth: {
      reporter: { name: 'David Chen', relationship: 'Parent' },
      authority: { name: 'Metropolitan Police Dept', firOrCaseNumber: 'FIR-2026-9912' },
      consent: { confirmed: true, legalBasis: 'Statutory Missing Persons Duty' },
    },
    toObject() {
      return { ...this };
    },
    save: jest.fn().mockImplementation(function (this: any) {
      return Promise.resolve(this);
    }),
  };

  beforeEach(async () => {
    mockCaseModel = jest.fn().mockImplementation((dto) => {
      const doc = {
        ...dto,
        _id: '507f1f77bcf86cd799439011',
        toObject() {
          return { ...this };
        },
        save: jest.fn().mockResolvedValue({
          ...dto,
          _id: '507f1f77bcf86cd799439011',
          toObject() {
            return { ...this, _id: '507f1f77bcf86cd799439011' };
          },
        }),
      };
      return doc;
    });

    mockCaseModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockCaseDoc]),
      }),
    });

    mockCaseModel.findById = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockCaseDoc),
    });

    mockSightingModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      }),
    };

    mockCameraModel = {
      find: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    };

    mockKafkaService = {
      publishEvent: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CasesService,
        { provide: getModelToken(Case.name), useValue: mockCaseModel },
        { provide: getModelToken(Sighting.name), useValue: mockSightingModel },
        { provide: getModelToken(Camera.name), useValue: mockCameraModel },
        { provide: KafkaService, useValue: mockKafkaService },
      ],
    }).compile();

    service = module.get<CasesService>(CasesService);
  });

  describe('Rule 1: Reference Set Versioning & Pinecone Sync', () => {
    it('should increment referenceSetVersion and record old version in audit trail on add', async () => {
      const realPhoto: any = {
        id: 'ref_real_001',
        url: 'https://minio.local/ref_001.jpg',
        type: 'frontal',
        qualityScore: 0.95,
        isSynthetic: false,
        provenance: {
          source: 'official_id',
          verifiedReal: true,
          verifiedBy: 'Insp. Miller',
          fileHashSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        },
      };

      mockCaseDoc.referenceSetVersion = 1;
      mockCaseDoc.referencePhotos = [];
      mockCaseDoc.referenceVersionHistory = [];

      const result = await service.addReferencePhoto(
        '507f1f77bcf86cd799439011',
        realPhoto,
        'Insp. Miller',
        'Enrolled passport photo',
      );

      expect(mockCaseDoc.referenceSetVersion).toBe(2);
      expect(mockCaseDoc.referenceVersionHistory).toHaveLength(1);
      expect(mockCaseDoc.referenceVersionHistory[0].version).toBe(1);
      expect(mockCaseDoc.referenceVersionHistory[0].action).toBe('add');
      expect(mockCaseDoc.referenceVersionHistory[0].changedBy).toBe('Insp. Miller');

      // Verify Kafka event targeting new Pinecone namespace was published
      expect(mockKafkaService.publishEvent).toHaveBeenCalledWith(
        'case.events',
        expect.objectContaining({
          type: 'case.reference_set.updated',
          data: expect.objectContaining({
            newVersion: 2,
            previousVersion: 1,
            pineconeNamespace: 'case_507f1f77bcf86cd799439011_v2',
            retireNamespace: 'case_507f1f77bcf86cd799439011_v1',
          }),
        }),
        '507f1f77bcf86cd799439011',
      );
    });

    it('should increment referenceSetVersion and preserve audit trail on remove', async () => {
      mockCaseDoc.referenceSetVersion = 2;
      mockCaseDoc.referencePhotos = [
        {
          id: 'ref_real_001',
          url: 'https://minio.local/ref_001.jpg',
          type: 'frontal',
          qualityScore: 0.95,
          isSynthetic: false,
          provenance: { verifiedReal: true, fileHashSha256: 'abc123' },
        },
      ];
      mockCaseDoc.referenceVersionHistory = [
        { version: 1, photos: [], action: 'initial', changedBy: 'Admin' },
      ];

      await service.removeReferencePhoto(
        '507f1f77bcf86cd799439011',
        'ref_real_001',
        'Insp. Miller',
        'Revoked outdated photo',
      );

      expect(mockCaseDoc.referenceSetVersion).toBe(3);
      expect(mockCaseDoc.referencePhotos).toHaveLength(0);
      expect(mockCaseDoc.referenceVersionHistory).toHaveLength(2);
      expect(mockCaseDoc.referenceVersionHistory[1].version).toBe(2);
      expect(mockCaseDoc.referenceVersionHistory[1].action).toBe('remove');

      expect(mockKafkaService.publishEvent).toHaveBeenCalledWith(
        'case.events',
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'remove',
            newVersion: 3,
            previousVersion: 2,
            pineconeNamespace: 'case_507f1f77bcf86cd799439011_v3',
          }),
        }),
        '507f1f77bcf86cd799439011',
      );
    });
  });

  describe('Rule 2: Never Fabricate or Synthesize Faces with Generative Models', () => {
    it('should reject reference photo if marked synthetic or generative', async () => {
      const syntheticPhoto: any = {
        id: 'ref_fake_001',
        url: 'https://minio.local/synthetic_face.jpg',
        type: 'frontal',
        isSynthetic: true, // PROHIBITED
        provenance: {
          source: 'family_photo',
          verifiedReal: false,
          fileHashSha256: 'deadbeef',
        },
      };

      await expect(
        service.addReferencePhoto('507f1f77bcf86cd799439011', syntheticPhoto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject replacement if replacement photo is unverified or synthetic', async () => {
      const unverifiedPhoto: any = {
        id: 'ref_fake_002',
        url: 'https://minio.local/diffusion_crop.jpg',
        type: 'frontal',
        isSynthetic: false,
        provenance: {
          source: 'family_photo',
          verifiedReal: false, // Must be true
          fileHashSha256: 'fakehash',
        },
      };

      await expect(
        service.replaceReferencePhoto(
          '507f1f77bcf86cd799439011',
          'ref_real_001',
          unverifiedPhoto,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Rule 3: Registration Authorization & Minor/Vulnerable Flagging', () => {
    it('should automatically flag isMinor for age < 18 and record statutory consent', async () => {
      const created = await service.create({
        title: 'Disappearance of Lucas Gray',
        personName: 'Lucas Gray',
        age: 11,
        gender: 'male',
        lastSeenLocation: 'Oakwood Primary Gate',
        reporterName: 'Sarah Gray',
        reporterRelationship: 'Mother',
        firOrCaseNumber: 'FIR-2026-44120',
        consentConfirmed: true,
      });

      expect(created.isMinor).toBe(true);
      expect(created.registrationAuth.consent.confirmed).toBe(true);
      expect(created.registrationAuth.authority.firOrCaseNumber).toBe('FIR-2026-44120');
      expect(created.referenceSetVersion).toBe(1);
    });
  });

  describe('Rule 4: Minimal PII & Field-Level Encryption', () => {
    it('should encrypt sensitive national ID and medical notes at the field level', async () => {
      const secret =
        process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'sentinel-master-secret-key-32chars';

      const created = await service.create({
        title: 'Disappearance of Robert Hall',
        personName: 'Robert Hall',
        age: 72,
        gender: 'male',
        lastSeenLocation: 'Sunset Blvd Nursing Home',
        isVulnerable: true,
        vulnerabilityDetails: 'Severe Alzheimer and insulin-dependent diabetes',
        nationalId: 'ID-994-11-2094',
        contactPhone: '+1-555-901-2291',
      });

      expect(created.isVulnerable).toBe(true);
      // Ensure ciphertext is stored (format iv:authTag:cipher)
      expect(created.encryptedPii.nationalIdEncrypted).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
      expect(created.encryptedPii.contactPhoneEncrypted).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
      expect(created.vulnerabilityDetailsEncrypted).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);

      // Verify that decryption produces the exact original plaintext
      const decryptedId = decryptField(created.encryptedPii.nationalIdEncrypted, secret);
      expect(decryptedId).toBe('ID-994-11-2094');

      const decryptedMedNotes = decryptField(created.vulnerabilityDetailsEncrypted, secret);
      expect(decryptedMedNotes).toBe('Severe Alzheimer and insulin-dependent diabetes');
    });

    it('should redact sensitive PII when viewed by an unassigned user on a protected minor/vulnerable case', async () => {
      const protectedCase: any = {
        _id: '507f1f77bcf86cd799439099',
        personName: 'Lucas Gray',
        age: 10,
        isMinor: true,
        isVulnerable: false,
        assignedOfficer: 'officer_lead',
        accessList: ['officer_lead'],
        encryptedPii: {
          nationalIdEncrypted: 'aabbcc:ddeeff:112233',
          contactPhoneEncrypted: 'aabbcc:ddeeff:445566',
        },
        vulnerabilityDetailsEncrypted: 'aabbcc:ddeeff:778899',
        registrationAuth: {
          reporter: { name: 'Sarah Gray', phoneEncrypted: 'aabbcc:ddeeff:998877' },
        },
        toObject() {
          return { ...this };
        },
      };

      mockCaseModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(protectedCase),
      });

      // Unassigned viewer
      const unauthorizedUser = { id: 'unauthorized_analyst', role: 'Viewer' };
      const result = await service.findById('507f1f77bcf86cd799439099', unauthorizedUser);

      expect(result.encryptedPii.nationalIdEncrypted).toBe(
        '[REDACTED - SENSITIVE MINOR/VULNERABLE DOSSIER]',
      );
      expect(result.encryptedPii.contactPhoneEncrypted).toBe(
        '[REDACTED - SENSITIVE MINOR/VULNERABLE DOSSIER]',
      );
      expect(result.vulnerabilityDetailsEncrypted).toBe(
        '[REDACTED - SENSITIVE MINOR/VULNERABLE DOSSIER]',
      );
    });
  });
});
