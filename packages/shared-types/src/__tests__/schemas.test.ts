import {
  CreateCaseSchema,
  CreateCameraSchema,
  EmbeddingKind,
  SightingSchema,
  SightingStatus,
  ConfidenceBand,
  SearchResponseSchema,
} from '../index';

describe('shared-types — schema validation', () => {
  describe('CreateCaseSchema', () => {
    it('should accept valid case data', () => {
      const result = CreateCaseSchema.safeParse({
        title: 'Missing Person: John Doe',
        personName: 'John Doe',
        reportedBy: 'Officer Smith',
        personDescription: {
          age: 35,
          sex: 'male',
          lastSeenWearing: 'Blue jacket, grey jeans',
        },
      });
      expect(result.success).toBe(true);
    });

    it('should reject title shorter than 3 chars', () => {
      const result = CreateCaseSchema.safeParse({
        title: 'AB',
        personName: 'John',
        reportedBy: 'Officer',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('CreateCameraSchema', () => {
    it('should accept valid camera data', () => {
      const result = CreateCameraSchema.safeParse({
        name: 'Main Gate Camera',
        rtspUrl: 'rtsp://192.168.1.100:554/stream',
        location: { label: 'Main Gate' },
        frameRateFps: 5,
      });
      expect(result.success).toBe(true);
    });

    it('should reject non-rtsp URL', () => {
      const result = CreateCameraSchema.safeParse({
        name: 'Camera',
        rtspUrl: 'http://192.168.1.100:554/stream',
        location: { label: 'Gate' },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('EmbeddingKind', () => {
    it('should have exactly two kinds — face and reid', () => {
      const kinds = Object.values(EmbeddingKind);
      expect(kinds).toHaveLength(2);
      expect(kinds).toContain('face');
      expect(kinds).toContain('reid');
    });

    it('face and reid kinds must be distinct strings', () => {
      expect(EmbeddingKind.FACE).not.toBe(EmbeddingKind.REID);
    });
  });

  describe('SightingSchema', () => {
    it('should default status to pending_review', () => {
      const result = SightingSchema.safeParse({
        id: 'sight_1',
        caseId: 'case_1',
        cameraId: 'cam_1',
        detectedAt: new Date(),
        createdAt: new Date(),
        confidenceBand: ConfidenceBand.MEDIUM,
        thumbnailKey: 'thumbnails/sight_1.jpg',
        frameTimestamp: new Date(),
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe(SightingStatus.PENDING_REVIEW);
      }
    });
  });

  describe('SearchResponseSchema', () => {
    it('displayLabel must always be "Possible match"', () => {
      const result = SearchResponseSchema.safeParse({
        searchId: 'search_1',
        caseId: 'case_1',
        queriedAt: new Date(),
        totalResults: 1,
        results: [
          {
            sightingId: 'sight_1',
            cameraId: 'cam_1',
            detectedAt: new Date(),
            thumbnailKey: 'thumbnails/sight_1.jpg',
            confidenceBand: 'high',
            displayLabel: 'Possible match',
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('displayLabel rejects anything other than "Possible match"', () => {
      const result = SearchResponseSchema.safeParse({
        searchId: 'search_1',
        caseId: 'case_1',
        queriedAt: new Date(),
        totalResults: 1,
        results: [
          {
            sightingId: 'sight_1',
            cameraId: 'cam_1',
            detectedAt: new Date(),
            thumbnailKey: 'thumbnails/sight_1.jpg',
            confidenceBand: 'high',
            displayLabel: 'Confirmed match', // must be rejected
          },
        ],
      });
      expect(result.success).toBe(false);
    });
  });
});
