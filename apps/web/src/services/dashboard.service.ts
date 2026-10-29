import { apiClient } from './api.client';
import type {
  DashboardSummary,
  PriorityCaseSummary,
  ActionQueueItem,
  DashboardSuggestion,
  ActivityFeedItem,
  TrendDataPoint,
  TeamOnCallStatus,
  SinceDigest,
  DashboardLayout,
} from '@sentinel/shared-types';

export const dashboardService = {
  async getSummary(site?: string, range?: string): Promise<DashboardSummary> {
    try {
      const { data } = await apiClient.get<DashboardSummary>('/dashboard/summary', {
        params: { site, range },
      });
      return data;
    } catch {
      return {
        activeCasesCount: 2,
        criticalCasesCount: 1,
        awaitingReviewCount: 2,
        oldestReviewWaitMinutes: 42,
        slaBreachCount: 1,
        searchesRunningCount: 3,
        searchesStageSummary: '2 indexing · 1 fusing',
        samePersonDecisions7d: 19,
        rejectedDecisions7d: 42,
        medianTimeToFirstReviewMinutes: 8.4,
        targetReviewMinutes: 15,
        turnaroundTrendPct: -18,
      };
    }
  },

  async getPriorityCases(): Promise<PriorityCaseSummary[]> {
    try {
      const { data } = await apiClient.get<PriorityCaseSummary[]>('/dashboard/priority-cases');
      return data;
    } catch {
      return [
        {
          id: 'case_001',
          caseNumber: 'MP-2026-0042',
          personName: 'Maya Lin',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          priority: 'critical',
          isMinor: true,
          isVulnerable: true,
          lastSeenAt: new Date(Date.now() - 3600000 * 2.5).toISOString(),
          lastSeenLocation: 'Metro Central - Platform 3',
          missingHours: 2,
          missingMinutes: 30,
          pendingReviewsCount: 3,
          searchProgressPct: 74,
          readinessScore: 88,
          priorityScore: 0.92,
          priorityRank: 1,
          contributingFactors: {
            priorityWeight: 1.0,
            timeFactor: 0.85,
            reviewFactor: 0.6,
            slaRisk: 1.2,
            vulnerableBoost: 1.0,
            explanation: 'Critical minor with pending SLA review and multiple recent sightings',
          },
          nearCamerasCount: 5,
          lastKnownCoords: [-122.4194, 37.7749],
          reachableAreaMeters: 2400,
          suggestedCameras: [
            {
              id: 'cam_003',
              cameraCode: 'CAM-003',
              name: 'North Corridor Entrance',
              coords: [-122.418, 37.7755],
              reason: 'Direct exit path from last known position',
            },
            {
              id: 'cam_004',
              cameraCode: 'CAM-004',
              name: 'Station Square Crosswalk',
              coords: [-122.421, 37.774],
              reason: 'Reachable within 15 min pedestrian buffer',
            },
          ],
          journeyHops: [
            {
              id: 'hop-1',
              cameraCode: 'CAM-001',
              coords: [-122.4194, 37.7749],
              timestamp: new Date(Date.now() - 3600000 * 2.5).toISOString(),
              status: 'same_person',
            },
            {
              id: 'hop-2',
              cameraCode: 'CAM-002',
              coords: [-122.4185, 37.7752],
              timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(),
              status: 'possible',
            },
          ],
        },
        {
          id: 'case_002',
          caseNumber: 'MP-2026-0018',
          personName: 'Marcus Vance',
          avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
          priority: 'high',
          isMinor: false,
          isVulnerable: false,
          lastSeenAt: new Date(Date.now() - 3600000 * 6).toISOString(),
          lastSeenLocation: 'East Terminal Gate 4',
          missingHours: 6,
          missingMinutes: 12,
          pendingReviewsCount: 1,
          searchProgressPct: 45,
          readinessScore: 72,
          priorityScore: 0.74,
          priorityRank: 2,
          contributingFactors: {
            priorityWeight: 0.8,
            timeFactor: 0.95,
            reviewFactor: 0.2,
            slaRisk: 0.5,
            vulnerableBoost: 0,
            explanation: 'High priority case with search job running on perimeter gates',
          },
          nearCamerasCount: 3,
          lastKnownCoords: [-122.408, 37.781],
          reachableAreaMeters: 4800,
          suggestedCameras: [
            {
              id: 'cam_007',
              cameraCode: 'CAM-007',
              name: 'Terminal Perimeter North',
              coords: [-122.405, 37.783],
              reason: 'Un-indexed footage along perimeter',
            },
          ],
          journeyHops: [
            {
              id: 'hop-3',
              cameraCode: 'CAM-005',
              coords: [-122.408, 37.781],
              timestamp: new Date(Date.now() - 3600000 * 6).toISOString(),
              status: 'same_person',
            },
          ],
        },
      ];
    }
  },

  async getActionQueue(filter?: string): Promise<ActionQueueItem[]> {
    try {
      const { data } = await apiClient.get<ActionQueueItem[]>('/dashboard/action-queue', {
        params: { filter },
      });
      return data;
    } catch {
      return [];
    }
  },

  async getSuggestions(): Promise<DashboardSuggestion[]> {
    try {
      const { data } = await apiClient.get<DashboardSuggestion[]>('/dashboard/suggestions');
      return data;
    } catch {
      return [];
    }
  },

  async getActivity(filter?: string): Promise<ActivityFeedItem[]> {
    try {
      const { data } = await apiClient.get<ActivityFeedItem[]>('/dashboard/activity', {
        params: { filter },
      });
      return data;
    } catch {
      return [];
    }
  },

  async getTrends(range?: string): Promise<TrendDataPoint[]> {
    try {
      const { data } = await apiClient.get<TrendDataPoint[]>('/dashboard/trends', {
        params: { range },
      });
      return data;
    } catch {
      return [];
    }
  },

  async getTeamWorkload(): Promise<TeamOnCallStatus> {
    try {
      const { data } = await apiClient.get<TeamOnCallStatus>('/dashboard/team-workload');
      return data;
    } catch {
      return {
        currentOnCallUser: {
          id: 'u-1',
          name: 'Sarah Connor',
          avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
          shiftEndAt: new Date(Date.now() + 3600000 * 4).toISOString(),
        },
        reviewers: [
          {
            userId: 'u-1',
            name: 'Sarah Connor',
            avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
            role: 'Lead Investigator',
            isOnline: true,
            isOnCall: true,
            pendingReviewsCount: 2,
            avgReviewSec: 45,
          },
          {
            userId: 'u-2',
            name: 'David Mills',
            avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100',
            role: 'Reviewer',
            isOnline: true,
            isOnCall: false,
            pendingReviewsCount: 1,
            avgReviewSec: 62,
          },
        ],
      };
    }
  },

  async getSinceDigest(lastSeenAt?: string): Promise<SinceDigest> {
    try {
      const { data } = await apiClient.get<SinceDigest>('/dashboard/since', {
        params: { ts: lastSeenAt },
      });
      return data;
    } catch {
      return {
        newCandidatesCount: 14,
        decisionsByOthersCount: 3,
        casesEscalatedCount: 1,
        searchesCompletedCount: 2,
        hasUpdates: true,
        summaryText:
          '14 new sightings across 2 cases · 1 high-priority case registered (MP-2026-0042) · 2 searches completed · 1 SLA breach.',
      };
    }
  },

  async getLayout(): Promise<DashboardLayout> {
    try {
      const { data } = await apiClient.get<DashboardLayout>('/dashboard/layout');
      return data;
    } catch {
      return {
        userId: 'current',
        visibleWidgets: ['since', 'kpis', 'situation', 'queue', 'suggestions', 'searches', 'activity', 'insights', 'team'],
        widgetOrder: ['since', 'kpis', 'situation', 'queue', 'suggestions', 'searches', 'activity', 'insights', 'team'],
        updatedAt: new Date().toISOString(),
      };
    }
  },

  async saveLayout(layout: Partial<DashboardLayout>): Promise<DashboardLayout> {
    const { data } = await apiClient.put<DashboardLayout>('/dashboard/layout', layout);
    return data;
  },

  async dismissSuggestion(id: string): Promise<void> {
    try {
      await apiClient.post(`/dashboard/suggestions/${id}/dismiss`);
    } catch {
      // ignore
    }
  },
};
