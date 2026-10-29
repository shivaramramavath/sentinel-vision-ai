import { useQuery } from '@tanstack/react-query';
import {
  dashboardSummaryQueryOptions,
  dashboardPriorityCasesQueryOptions,
} from '@/lib/query/options';

export function useDashboardSummary(site?: string, range?: string) {
  return useQuery(dashboardSummaryQueryOptions(site, range));
}

export function useDashboardPriorityCases(limit = 5) {
  return useQuery(dashboardPriorityCasesQueryOptions(limit));
}
