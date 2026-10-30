import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { StorageService } from '../storage.service';
import { CloudinaryStorageProvider } from '../providers/cloudinary-storage.provider';
import { MinioStorageProvider } from '../providers/minio-storage.provider';
import { MediaAsset } from '../schemas/media-asset.schema';
import { AuditService } from '../../../audit/audit.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Readable } from 'stream';

describe('StorageService', () => {
  let service: StorageService;
  let mockAssetModel: any;
  let mockAuditService: any;
  let mockCloudinaryProvider: any;
  let mockMinioProvider: any;

  const sampleAsset = {
    assetId: 'ast_test_123',
    provider: 'cloudinary',
    publicId: 'sentinel/test/cases/case_01/references/ref_01',
    resourceType: 'image',
    deliveryType: 'authenticated',
    version: 1,
    format: 'jpg',
    bytes: 2048,
    sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    context: { kind: 'reference', caseId: 'case_01' },
    status: 'active',
    legalHold: false,
    save: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    mockAssetModel = {
      findOne: jest.fn().mockImplementation((query) => {
        if (query.$or) {
          return Promise.resolve(sampleAsset);
        }
        return Promise.resolve(null);
      }),
      findOneAndUpdate: jest.fn().mockResolvedValue(sampleAsset),
    };

    mockAuditService = {
      recordLog: jest.fn().mockResolvedValue(true),
    };

    mockCloudinaryProvider = {
      name: 'cloudinary',
      upload: jest.fn().mockResolvedValue(sampleAsset),
      getSignedUrl: jest.fn().mockResolvedValue({
        url: 'https://res.cloudinary.com/test/image/authenticated/s--xyz--/sample.jpg',
        expiresAt: new Date(Date.now() + 300000),
      }),
      getOriginalStream: jest.fn().mockResolvedValue(Readable.from(['mock-original-bytes'])),
      delete: jest.fn().mockResolvedValue(undefined),
      usage: jest.fn().mockResolvedValue({
        plan: 'Standard',
        usedStorageBytes: 1000000,
        maxStorageBytes: 25000000000,
        storagePercent: 0.004,
        bandwidthBytesMonth: 500000,
      }),
    };

    mockMinioProvider = {
      name: 'minio',
      upload: jest.fn().mockResolvedValue({ ...sampleAsset, provider: 'minio' }),
      getSignedUrl: jest.fn().mockResolvedValue({
        url: 'http://localhost:9000/test/sample.jpg',
        expiresAt: new Date(Date.now() + 300000),
      }),
      getOriginalStream: jest.fn().mockResolvedValue(Readable.from(['mock-minio-bytes'])),
      delete: jest.fn().mockResolvedValue(undefined),
      usage: jest.fn().mockResolvedValue({
        plan: 'MinIO Local',
        usedStorageBytes: 500000,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                'app.storageDriver': 'cloudinary',
                'app.cloudinaryMaxImageMb': 25,
                'app.cloudinaryMaxVideoMb': 100,
              };
              return config[key] !== undefined ? config[key] : defaultValue;
            }),
          },
        },
        {
          provide: CloudinaryStorageProvider,
          useValue: mockCloudinaryProvider,
        },
        {
          provide: MinioStorageProvider,
          useValue: mockMinioProvider,
        },
        {
          provide: getModelToken(MediaAsset.name),
          useValue: mockAssetModel,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  describe('Upload Flow & MIME Verification', () => {
    it('should reject unwhitelisted MIME types for asset kind', async () => {
      await expect(
        service.upload({
          kind: 'reference',
          entityId: 'ref_invalid',
          mimeType: 'application/x-executable',
          buffer: Buffer.from('binary-data'),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate and upload valid reference image buffer', async () => {
      // 1x1 valid transparent PNG buffer
      const pngBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        'base64',
      );

      const result = await service.upload({
        kind: 'reference',
        entityId: 'ref_valid_01',
        caseId: 'case_01',
        mimeType: 'image/png',
        buffer: pngBuffer,
        uploadedBy: 'investigator@sentinel.gov',
      });

      expect(result).toBeDefined();
      expect(mockCloudinaryProvider.upload).toHaveBeenCalled();
      expect(mockAuditService.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'MEDIA_ASSET_UPLOADED',
        }),
      );
    });
  });

  describe('Signed Delivery URLs & Access Auditing', () => {
    it('should generate signed delivery URL and log MEDIA_SIGNED_URL_ISSUED audit event', async () => {
      const res = await service.getSignedUrl(
        'ast_test_123',
        { purpose: 'view' },
        { email: 'sarah@sentinel.gov', role: 'Investigator' },
      );

      expect(res.url).toContain('cloudinary.com');
      expect(res.expiresAt).toBeDefined();
      expect(mockAuditService.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'MEDIA_SIGNED_URL_ISSUED',
          actor: expect.objectContaining({ email: 'sarah@sentinel.gov' }),
        }),
      );
    });

    it('should throw NotFoundException when asset is missing', async () => {
      mockAssetModel.findOne.mockResolvedValueOnce(null);

      await expect(
        service.getSignedUrl('missing_asset_id', { purpose: 'view' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Legal Hold Deletion Protection', () => {
    it('should reject deletion when asset is under statutory legal hold', async () => {
      const heldAsset = {
        ...sampleAsset,
        legalHold: true,
      };
      mockAssetModel.findOne.mockResolvedValueOnce(heldAsset);

      await expect(service.delete('ast_test_123')).rejects.toThrow(ForbiddenException);
      expect(mockCloudinaryProvider.delete).not.toHaveBeenCalled();
    });

    it('should allow deletion and record audit log when legal hold is false', async () => {
      mockAssetModel.findOne.mockResolvedValueOnce({
        ...sampleAsset,
        legalHold: false,
        save: jest.fn().mockResolvedValue(true),
      });

      await service.delete('ast_test_123', { email: 'admin@sentinel.gov' });

      expect(mockCloudinaryProvider.delete).toHaveBeenCalled();
      expect(mockAuditService.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'MEDIA_ASSET_DELETED',
        }),
      );
    });
  });

  describe('Original Stream Access (AI Workers & Integrity Verification)', () => {
    it('should return uncompressed original stream without transformations', async () => {
      const res = await service.getOriginalStream('ast_test_123');

      expect(res.stream).toBeDefined();
      expect(res.asset.assetId).toBe('ast_test_123');
    });
  });
});
