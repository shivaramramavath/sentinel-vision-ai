import { queryOptions } from '@tanstack/react-query';
import { keys } from './keys';
import { countsApi } from '../api/counts.api';
import { dashboardApi } from '../api/dashboard.api';
import { casesApi, CaseFilterParams } from '../api/cases.api';
import { camerasApi, CameraFilterParams } from '../api/cameras.api';
import { sightingsApi, SightingFilterParams } from '../api/sightings.api';
import { journeysApi } from '../api/journeys.api';
import { searchJobsApi } from '../api/search-jobs.api';
import { evidenceApi, EvidenceFilterParams } from '../api/evidence.api';
import { alertsApi, AlertFilterParams } from '../api/alerts.api';
import { reportsApi } from '../api/reports.api';
import { usersApi } from '../api/users.api';

export const countsQueryOptions = (scope = 'global') =>
  queryOptions({
    queryKey: keys.counts(scope),
    queryFn: () => countsApi.get(scope),
  });

export const dashboardSummaryQueryOptions = (site?: string, range?: string) =>
  queryOptions({
    queryKey: keys.dashboard.summary(site, range),
    queryFn: () => dashboardApi.getSummary(site, range),
  });

export const dashboardPriorityCasesQueryOptions = (limit = 5) =>
  queryOptions({
    queryKey: keys.dashboard.priorityCases(limit),
    queryFn: () => dashboardApi.getPriorityCases(limit),
  });

export const casesListQueryOptions = (filters?: CaseFilterParams) =>
  queryOptions({
    queryKey: keys.cases.list(filters),
    queryFn: () => casesApi.list(filters),
  });

export const caseDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: keys.cases.detail(id),
    queryFn: () => casesApi.get(id),
    enabled: Boolean(id),
  });

export const caseOverviewQueryOptions = (id: string) =>
  queryOptions({
    queryKey: keys.cases.overview(id),
    queryFn: () => casesApi.getOverview(id),
    enabled: Boolean(id),
  });

export const caseJourneyGeoJsonQueryOptions = (id: string) =>
  queryOptions({
    queryKey: keys.cases.journeyGeoJson(id),
    queryFn: () => casesApi.getJourneyGeoJson(id),
    enabled: Boolean(id),
  });

export const casePossibleAreaQueryOptions = (id: string, at?: string) =>
  queryOptions({
    queryKey: keys.cases.possibleArea(id, at),
    queryFn: () => casesApi.getPossibleArea(id, at),
    enabled: Boolean(id),
  });

export const camerasListQueryOptions = (filters?: CameraFilterParams) =>
  queryOptions({
    queryKey: keys.cameras.list(filters),
    queryFn: () => camerasApi.list(filters),
  });

export const cameraDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: keys.cameras.detail(id),
    queryFn: () => camerasApi.get(id),
    enabled: Boolean(id),
  });

export const cameraGeoJsonQueryOptions = (siteId?: string, status?: string) =>
  queryOptions({
    queryKey: keys.cameras.geojson(siteId, status),
    queryFn: () => camerasApi.getGeoJson(siteId, status),
  });

export const cameraTopologyQueryOptions = () =>
  queryOptions({
    queryKey: keys.cameras.topology,
    queryFn: () => camerasApi.getTopology(),
  });

export const sightingsListQueryOptions = (filters?: SightingFilterParams) =>
  queryOptions({
    queryKey: keys.sightings.list(filters),
    queryFn: () => sightingsApi.list(filters),
  });

export const journeyForCaseQueryOptions = (caseId: string) =>
  queryOptions({
    queryKey: keys.journeys.detail(caseId),
    queryFn: () => journeysApi.get(caseId),
    enabled: Boolean(caseId),
  });

export const searchJobsListQueryOptions = (caseId?: string) =>
  queryOptions({
    queryKey: keys.searchJobs.list(caseId),
    queryFn: () => searchJobsApi.list(caseId),
  });

export const searchJobDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: keys.searchJobs.detail(id),
    queryFn: () => searchJobsApi.get(id),
    enabled: Boolean(id),
  });

export const evidenceListQueryOptions = (filters?: EvidenceFilterParams) =>
  queryOptions({
    queryKey: keys.evidence.list(filters),
    queryFn: () => evidenceApi.list(filters),
  });

export const alertsListQueryOptions = (filters?: AlertFilterParams) =>
  queryOptions({
    queryKey: keys.alerts.list(filters),
    queryFn: () => alertsApi.list(filters),
  });

export const reportsListQueryOptions = (caseId?: string) =>
  queryOptions({
    queryKey: keys.reports.list(caseId),
    queryFn: () => reportsApi.list(caseId),
  });

export const usersListQueryOptions = () =>
  queryOptions({
    queryKey: keys.users.all,
    queryFn: () => usersApi.list(),
  });

export const currentUserQueryOptions = () =>
  queryOptions({
    queryKey: keys.users.me,
    queryFn: () => usersApi.me(),
    staleTime: 60 * 1000,
  });
