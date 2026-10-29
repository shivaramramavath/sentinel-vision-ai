import { CaseFilterParams } from '../api/cases.api';
import { CameraFilterParams } from '../api/cameras.api';
import { SightingFilterParams } from '../api/sightings.api';
import { EvidenceFilterParams } from '../api/evidence.api';
import { AlertFilterParams } from '../api/alerts.api';

export const keys = {
  counts: (scope?: string) => ['counts', scope || 'global'] as const,

  cases: {
    all: ['cases'] as const,
    list: (filters?: CaseFilterParams) => [...keys.cases.all, 'list', filters] as const,
    detail: (id: string) => [...keys.cases.all, 'detail', id] as const,
    overview: (id: string) => [...keys.cases.all, 'overview', id] as const,
    references: (id: string) => [...keys.cases.detail(id), 'references'] as const,
    journeyGeoJson: (id: string) => [...keys.cases.detail(id), 'journey-geojson'] as const,
    possibleArea: (id: string, at?: string) => [...keys.cases.detail(id), 'possible-area', at] as const,
  },

  cameras: {
    all: ['cameras'] as const,
    list: (filters?: CameraFilterParams) => [...keys.cameras.all, 'list', filters] as const,
    detail: (id: string) => [...keys.cameras.all, 'detail', id] as const,
    geojson: (siteId?: string, status?: string) => [...keys.cameras.all, 'geojson', siteId, status] as const,
    topology: ['cameras', 'topology'] as const,
    nearby: (lat: number, lng: number, radiusM?: number) => [...keys.cameras.all, 'nearby', lat, lng, radiusM] as const,
    gaps: (id: string) => [...keys.cameras.detail(id), 'gaps'] as const,
  },

  sightings: {
    all: ['sightings'] as const,
    list: (filters?: SightingFilterParams) => [...keys.sightings.all, 'list', filters] as const,
    detail: (id: string) => [...keys.sightings.all, 'detail', id] as const,
    case: (caseId: string) => [...keys.sightings.all, 'case', caseId] as const,
    hardNegatives: ['sightings', 'hard-negatives'] as const,
  },

  journeys: {
    all: ['journeys'] as const,
    detail: (caseId: string) => [...keys.journeys.all, 'case', caseId] as const,
    alternatives: (caseId: string) => [...keys.journeys.all, 'alternatives', caseId] as const,
  },

  searchJobs: {
    all: ['searchJobs'] as const,
    list: (caseId?: string) => [...keys.searchJobs.all, 'list', caseId] as const,
    detail: (id: string) => [...keys.searchJobs.all, 'detail', id] as const,
  },

  evidence: {
    all: ['evidence'] as const,
    list: (filters?: EvidenceFilterParams) => [...keys.evidence.all, 'list', filters] as const,
    detail: (id: string) => [...keys.evidence.all, 'detail', id] as const,
    integrity: ['evidence', 'integrity'] as const,
  },

  alerts: {
    all: ['alerts'] as const,
    list: (filters?: AlertFilterParams) => [...keys.alerts.all, 'list', filters] as const,
    summary: ['alerts', 'summary'] as const,
  },

  reports: {
    all: ['reports'] as const,
    list: (caseId?: string) => [...keys.reports.all, 'list', caseId] as const,
    templates: ['reports', 'templates'] as const,
  },

  dashboard: {
    summary: (site?: string, range?: string) => ['dashboard', 'summary', site, range] as const,
    priorityCases: (limit?: number) => ['dashboard', 'priorityCases', limit] as const,
  },

  users: {
    all: ['users'] as const,
    me: ['users', 'me'] as const,
  },
};
