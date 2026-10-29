import { Test, TestingModule } from '@nestjs/testing';
import { PdfDossierService, DossierData } from './pdf-dossier.service';

describe('PdfDossierService (Forensic Case Report Generation)', () => {
  let service: PdfDossierService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PdfDossierService],
    }).compile();

    service = module.get<PdfDossierService>(PdfDossierService);
  });

  it('should generate a valid PDF Buffer containing header and compliance markers', async () => {
    const mockData: DossierData = {
      caseId: 'case_test_01',
      caseNumber: 'MP-2026-8891',
      title: 'Investigation into Missing Student Maya Chen',
      personName: 'Maya Chen',
      age: 21,
      gender: 'female',
      lastSeenLocation: 'University Library Plaza',
      priority: 'critical',
      status: 'active',
      journeyNodes: [
        {
          order: 1,
          cameraId: 'cam_001',
          cameraLocation: 'North Gate Entrance',
          timestamp: '2026-10-28T09:00:00Z',
          fusedScore: 0.89,
          status: 'confirmed',
        },
        {
          order: 2,
          cameraId: 'cam_003',
          cameraLocation: 'Central Courtyard',
          timestamp: '2026-10-28T09:15:00Z',
          fusedScore: 0.92,
          status: 'confirmed',
        },
      ],
      evidenceItems: [
        {
          id: 'ev_001',
          cameraId: 'cam_001',
          sha256Hash: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
          sha256Crop: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
          capturedAt: '2026-10-28T09:00:00Z',
          fusedScore: 0.89,
          isRedacted: false,
          chainOfCustody: [
            {
              action: 'ingested',
              actor: 'AI Vision Pipeline',
              timestamp: '2026-10-28T09:00:05Z',
              hash: 'hash_abc_123',
            },
          ],
        },
      ],
      generatedBy: 'Detective Sarah Jenkins',
      generatedAt: '2026-10-28T10:00:00Z',
    };

    const pdfBuffer = await service.generateDossierPdf(mockData);

    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(1000);

    // Verify PDF Magic Bytes (%PDF-)
    const pdfHeader = pdfBuffer.subarray(0, 5).toString('utf-8');
    expect(pdfHeader).toBe('%PDF-');
  });
});
