import { missingPersonService } from '@/services/missing-person.service';
import { apiClient } from '@/services/api.client';

jest.mock('@/services/api.client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('Missing Persons Service & Logic', () => {
  const mockPerson: any = {
    personId: 'mp_2026_001',
    caseId: 'case_001',
    status: 'active',
    identity: {
      fullName: 'Maya Lin',
      aliases: ['May'],
      gender: 'female',
    },
    vulnerability: {
      isMinor: true,
    },
    lastSeen: {
      locationText: 'Central Transit Hub',
      ts: '2026-10-28T09:15:00Z',
    },
    lastSeenHistory: [
      { locationText: 'Central Transit Hub', ts: '2026-10-28T09:15:00Z' },
    ],
    version: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should list all missing persons dossiers', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: [mockPerson] });
    const list = await missingPersonService.getAll();
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]).toHaveProperty('personId');
    expect(list[0].identity.fullName).toBe('Maya Lin');
  });

  it('should retrieve a dossier by ID', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: mockPerson });
    const person = await missingPersonService.getById('mp_2026_001');
    expect(person).toBeDefined();
    expect(person?.identity.fullName).toBe('Maya Lin');
    expect(person?.vulnerability.isMinor).toBe(true);
  });

  it('should calculate biometric search readiness', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      data: {
        score: 85,
        tier: 'READY',
        breakdown: { faceQuality: 90 },
        recommendations: ['Optimal profile coverage'],
      },
    });
    const readiness = await missingPersonService.getReadiness('mp_2026_001');
    expect(readiness.score).toBeGreaterThanOrEqual(80);
    expect(readiness.tier).toBe('READY');
    expect(readiness.breakdown.faceQuality).toBeDefined();
    expect(readiness.recommendations.length).toBeGreaterThan(0);
  });

  it('should detect potential duplicate cases for human review', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      data: [{ matchCaseId: 'case_002', similarity: 0.92 }],
    });
    const duplicates = await missingPersonService.getDuplicates('ref_001');
    expect(duplicates.length).toBeGreaterThan(0);
    expect(duplicates[0]).toHaveProperty('matchCaseId');
    expect(duplicates[0].similarity).toBeGreaterThan(0.8);
  });

  it('should append sighting to history and update lastSeen', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: {
        ...mockPerson,
        lastSeen: { locationText: 'Jurong East Transit Interchange' },
        lastSeenHistory: [
          mockPerson.lastSeen,
          { locationText: 'Jurong East Transit Interchange' },
        ],
      },
    });
    const updated = await missingPersonService.addLastSeen('mp_2026_001', {
      ts: new Date().toISOString(),
      locationText: 'Jurong East Transit Interchange',
      coordinates: [103.74, 1.33],
      direction: 'Westward',
      triggerSearch: true,
    });
    expect(updated.lastSeen.locationText).toBe('Jurong East Transit Interchange');
    expect(updated.lastSeenHistory.length).toBeGreaterThanOrEqual(2);
  });
});
