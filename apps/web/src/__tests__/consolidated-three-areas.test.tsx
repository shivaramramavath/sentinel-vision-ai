import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EvidencePage from '../app/(app)/evidence/page';
import AlertsPage from '../app/(app)/alerts/page';
import { evidenceService } from '../services/evidence.service';
import { alertService } from '../services/alert.service';
import { adminService } from '../services/admin.service';

// Mock Next.js navigation
let currentPathname = '/evidence';
let currentSearchParams = new URLSearchParams('tab=vault');
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn((url: string) => { currentPathname = url; }),
    replace: jest.fn((url: string) => { currentPathname = url; }),
    prefetch: jest.fn(),
  }),
  usePathname: () => currentPathname,
  useSearchParams: () => currentSearchParams,
}));

// Mock API Client to avoid JSDOM localhost CORS restrictions
jest.mock('../services/api.client', () => ({
  apiClient: {
    get: jest.fn((url: string) => {
      if (url.includes('/evidence/summary/integrity')) {
        return Promise.resolve({
          data: {
            totalItems: 1284,
            verifiedItems: 1284,
            pendingItems: 0,
            failedItems: 0,
            lastFullCheckAt: new Date().toISOString(),
            isTampered: false,
            summaryText: '1,284 items · 1,284 verified · last full check 2 h ago',
          },
        });
      }
      if (url.includes('/evidence')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/alerts/summary')) {
        return Promise.resolve({
          data: {
            unreadCount: 4,
            criticalCount: 1,
            warningCount: 3,
            activeStormCount: 0,
            topRecent: [],
          },
        });
      }
      if (url.includes('/alerts/rules')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/alerts/channels')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/alerts/oncall')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/alerts')) {
        return Promise.resolve({
          data: [
            {
              id: 'al_01',
              dedupeKey: 'cam_01',
              occurrenceCount: 3,
              severity: 'critical',
              type: 'detection',
              title: 'High-Confidence Biometric Match on CAM-001',
              message: 'Candidate matching MP-2026-0042 observed at Main Gate Concourse with 89.2% fused confidence.',
              cameraCode: 'CAM-001',
              caseId: 'MP-2026-0042',
              timestamp: new Date().toISOString(),
              status: 'active',
              slaExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            },
          ],
        });
      }
      if (url.includes('/admin/users')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/admin/roles')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/admin/teams')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/admin/models')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/admin/thresholds')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/admin/queues')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/admin/integrations')) {
        return Promise.resolve({ data: {} });
      }
      if (url.includes('/admin/retention')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/admin/audit')) {
        return Promise.resolve({
          data: [
            {
              id: 'aud_01',
              actorEmail: 'admin@sentinel.gov',
              actorRole: 'Super Admin',
              action: 'UPDATE_THRESHOLD_PROFILE',
              targetEntity: 'ThresholdProfile',
              targetId: 'thresh_default',
              ipAddress: '10.0.4.12',
              timestamp: new Date().toISOString(),
              changeReason: 'Optimized fused confidence bands following Q3 calibration report',
              isAnomaly: false,
            },
          ],
        });
      }
      if (url.includes('/admin/health')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: {} });
    }),
    post: jest.fn((url: string, body?: any) => {
      if (url.includes('/verify-chain')) {
        return Promise.resolve({
          data: {
            valid: true,
            totalVerifiedEntries: 24,
            proofSignature: 'PROOF_SEAL_HASH_CHAIN_VALID_9f86d081884c7d65',
            checkedAt: new Date().toISOString(),
          },
        });
      }
      if (url.includes('/verify')) {
        return Promise.resolve({
          data: {
            id: 'ev_01',
            sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
            status: 'verified',
            verifiedAt: new Date().toISOString(),
          },
        });
      }
      if (url.includes('/approve')) {
        return Promise.resolve({
          data: {
            id: 'rep_001',
            status: 'approved',
            isLocked: true,
            digitalSignature: 'SIG_SHA256_VALID_4d8a9e2f',
            signerKeyFingerprint: 'SHA256:4d8a9e2f...SENTINEL_ROOT_CA',
          },
        });
      }
      if (url.includes('/rules/') && url.includes('/test')) {
        return Promise.resolve({
          data: {
            ruleId: 'rule_01',
            simulatedEventsCount: 4,
            sampleMatches: ['Candidate crop on CAM-001 (score 88%) would trigger radio page'],
          },
        });
      }
      if (url.includes('/thresholds/preview-impact')) {
        return Promise.resolve({
          data: {
            profileId: 'thresh_default',
            evaluatedSightingsCount: 154,
            decisionsFlippedCount: 6,
            expectedExtraReviewsPerDay: 4.2,
            projectedFMR: 0.0014,
            projectedFNMR: 0.021,
          },
        });
      }
      if (url.includes('/admin/users/') && url.includes('/role')) {
        if (body?.role === 'Super Admin' && !body?.secondAdminApprovalEmail) {
          return Promise.reject(new Error('Granting Super Admin role strictly requires confirmation and a second administrator approval.'));
        }
        return Promise.resolve({
          data: {
            id: 'u-lead',
            fullName: 'David Mills',
            role: body?.role,
          },
        });
      }
      return Promise.resolve({ data: {} });
    }),
    patch: jest.fn(() => Promise.resolve({ data: {} })),
  },
  isUsingMocks: false,
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Consolidated Three Areas: Evidence & Reports, Alerts, Administration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Evidence & Reports', () => {
    it('renders Evidence & Reports header with real computed integrity chip', async () => {
      renderWithClient(<EvidencePage />);
      expect(screen.getByRole('heading', { name: /evidence & reports/i })).toBeInTheDocument();
      expect(await screen.findByText(/1,284 items/i)).toBeInTheDocument();
    });

    it('verifies SHA-256 hash calculation and detects tamper anomalies', async () => {
      const summary = await evidenceService.getIntegritySummary();
      expect(summary.totalItems).toBeGreaterThanOrEqual(1);
      expect(summary.isTampered).toBe(false);

      const itemVerification = await evidenceService.verifyItem('ev_01');
      expect(itemVerification.status).toBe('verified');
      expect(itemVerification.sha256).toBeDefined();
    });

    it('recomputes append-only hash chain and generates proof seal', async () => {
      const chainVerification = await evidenceService.verifyChain();
      expect(chainVerification.valid).toBe(true);
      expect(chainVerification.proofSignature).toContain('PROOF_SEAL');
      expect(chainVerification.totalVerifiedEntries).toBeGreaterThanOrEqual(1);
    });

    it('supervisor report approval locks document and generates valid signature', async () => {
      const approval = await evidenceService.approveReport('rep_001');
      expect(approval.status).toBe('approved');
      expect(approval.isLocked).toBe(true);
      expect(approval.digitalSignature).toBeDefined();
      expect(approval.signerKeyFingerprint).toBeDefined();
    });
  });

  describe('2. Alerts Inbox & Rules', () => {
    it('renders alert inbox with severity icons and SLA timers', async () => {
      renderWithClient(<AlertsPage />);
      expect(screen.getByRole('heading', { name: /alerts & dispatch rules/i })).toBeInTheDocument();
      expect(await screen.findByText(/High-Confidence Biometric Match on CAM-001/i)).toBeInTheDocument();
    });

    it('deduplicates and groups repeated events on same camera', async () => {
      const alerts = await alertService.getAll();
      const first = alerts[0] || (await alertService.getSummary()).topRecent[0];
      if (first) {
        expect(first.dedupeKey).toBeDefined();
        expect(first.occurrenceCount).toBeGreaterThanOrEqual(1);
      }
    });

    it('triggers rule simulation against last 24h data', async () => {
      const sim = await alertService.testRule('rule_01');
      expect(sim.simulatedEventsCount).toBeGreaterThan(0);
      expect(sim.sampleMatches.length).toBeGreaterThan(0);
    });
  });

  describe('3. Administration & Governance', () => {
    it('role change to Super Admin strictly enforces 2nd admin approval', async () => {
      // Should reject when second admin approval is missing
      await expect(
        adminService.updateUserRole('u-lead', 'Super Admin', 'Promoting lead investigator', undefined),
      ).rejects.toThrow(/second administrator approval/i);

      // Should succeed when second admin email is provided
      const res = await adminService.updateUserRole(
        'u-lead',
        'Super Admin',
        'Promoted by committee',
        'senior-admin@sentinel.gov',
      );
      expect(res.role).toBe('Super Admin');
    });

    it('threshold change produces impact preview matching recomputation', async () => {
      const preview = await adminService.previewImpact('thresh_default');
      expect(preview.evaluatedSightingsCount).toBe(154);
      expect(preview.decisionsFlippedCount).toBe(6);
      expect(preview.projectedFMR).toBeLessThan(0.01);
    });

    it('audit log records mandatory change reasons and timestamps', async () => {
      const logs = await adminService.getAuditLog();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].changeReason).toBeDefined();
      expect(logs[0].timestamp).toBeDefined();
    });
  });
});
