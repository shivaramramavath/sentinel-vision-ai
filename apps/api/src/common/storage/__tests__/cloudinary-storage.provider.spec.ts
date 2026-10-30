import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CloudinaryStorageProvider } from '../providers/cloudinary-storage.provider';
import { ForbiddenException } from '@nestjs/common';
import { MediaAsset } from '../schemas/media-asset.schema';

describe('CloudinaryStorageProvider', () => {
  let provider: CloudinaryStorageProvider;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CloudinaryStorageProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                'app.cloudinaryCloudName': 'sentinel-test',
                'app.cloudinaryApiKey': 'test-key',
                'app.cloudinaryApiSecret': 'test-secret',
                'app.cloudinaryRootFolder': 'sentinel/test',
                'app.cloudinarySignedUrlTtlSeconds': 300,
              };
              return config[key] !== undefined ? config[key] : defaultValue;
            }),
          },
        },
      ],
    }).compile();

    provider = module.get<CloudinaryStorageProvider>(CloudinaryStorageProvider);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('Deterministic Public ID Mapping', () => {
    it('should map reference kinds to cases/{caseId}/references', () => {
      const res = provider.buildPublicId({
        kind: 'reference',
        caseId: 'case_001',
        entityId: 'ref_001',
        mimeType: 'image/jpeg',
      });
      expect(res.folder).toBe('sentinel/test/cases/case_001/references');
      expect(res.publicId).toBe('sentinel/test/cases/case_001/references/ref_001');
      expect(res.resourceType).toBe('image');
    });

    it('should map crop kinds to cases/{caseId}/crops', () => {
      const res = provider.buildPublicId({
        kind: 'crop',
        caseId: 'case_001',
        entityId: 'crop_001',
        mimeType: 'image/jpeg',
      });
      expect(res.folder).toBe('sentinel/test/cases/case_001/crops');
      expect(res.publicId).toBe('sentinel/test/cases/case_001/crops/crop_001');
      expect(res.resourceType).toBe('image');
    });

    it('should map frame kinds to cases/{caseId}/evidence', () => {
      const res = provider.buildPublicId({
        kind: 'frame',
        caseId: 'case_001',
        entityId: 'ev_001',
        mimeType: 'image/jpeg',
      });
      expect(res.folder).toBe('sentinel/test/cases/case_001/evidence');
      expect(res.publicId).toBe('sentinel/test/cases/case_001/evidence/ev_001');
      expect(res.resourceType).toBe('image');
    });

    it('should map clip kinds to cases/{caseId}/clips with video resourceType', () => {
      const res = provider.buildPublicId({
        kind: 'clip',
        caseId: 'case_001',
        entityId: 'clip_001',
        mimeType: 'video/mp4',
      });
      expect(res.folder).toBe('sentinel/test/cases/case_001/clips');
      expect(res.publicId).toBe('sentinel/test/cases/case_001/clips/clip_001');
      expect(res.resourceType).toBe('video');
    });

    it('should map report kinds to reports with raw resourceType', () => {
      const res = provider.buildPublicId({
        kind: 'report',
        entityId: 'rep_001',
        mimeType: 'application/pdf',
      });
      expect(res.folder).toBe('sentinel/test/reports');
      expect(res.publicId).toBe('sentinel/test/reports/rep_001');
      expect(res.resourceType).toBe('raw');
    });

    it('should map avatar kinds to avatars', () => {
      const res = provider.buildPublicId({
        kind: 'avatar',
        entityId: 'usr_001',
        mimeType: 'image/png',
      });
      expect(res.folder).toBe('sentinel/test/avatars');
      expect(res.publicId).toBe('sentinel/test/avatars/usr_001');
      expect(res.resourceType).toBe('image');
    });
  });

  describe('Signed Delivery URLs', () => {
    const mockAsset: MediaAsset = {
      assetId: 'ast_001',
      provider: 'cloudinary',
      publicId: 'sentinel/test/cases/case_001/evidence/ev_001',
      resourceType: 'image',
      deliveryType: 'authenticated',
      version: 1,
      format: 'jpg',
      bytes: 1024,
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      folder: 'sentinel/test/cases/case_001/evidence',
      tags: ['sentinel', 'case:case_001'],
      context: { caseId: 'case_001', kind: 'frame' },
      status: 'ready',
      uploadedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      legalHold: false,
    };

    it('should generate signed delivery URL with expiration timestamp', async () => {
      const res = await provider.getSignedUrl(mockAsset, { purpose: 'view' });
      expect(res.url).toBeDefined();
      expect(res.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should support thumbnail transform purpose', async () => {
      const res = await provider.getSignedUrl(mockAsset, { purpose: 'thumbnail' });
      expect(res.url).toBeDefined();
      expect(res.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should support download purpose', async () => {
      const res = await provider.getSignedUrl(mockAsset, { purpose: 'download' });
      expect(res.url).toBeDefined();
    });
  });

  describe('Legal Hold Deletion Protection', () => {
    it('should throw ForbiddenException if asset is under legal hold', async () => {
      const heldAsset: MediaAsset = {
        assetId: 'ast_held',
        provider: 'cloudinary',
        publicId: 'sentinel/test/cases/case_001/evidence/ev_held',
        resourceType: 'image',
        deliveryType: 'authenticated',
        version: 1,
        format: 'jpg',
        bytes: 1024,
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        folder: 'sentinel/test/cases/case_001/evidence',
        tags: ['hold'],
        context: { caseId: 'case_001' },
        status: 'ready',
        uploadedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        legalHold: true,
      };

      await expect(provider.delete(heldAsset)).rejects.toThrow(ForbiddenException);
    });
  });
});
