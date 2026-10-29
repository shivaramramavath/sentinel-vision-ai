import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  casesListQueryOptions,
  caseDetailQueryOptions,
  caseOverviewQueryOptions,
  caseJourneyGeoJsonQueryOptions,
  casePossibleAreaQueryOptions,
} from '@/lib/query/options';
import { casesApi, CaseFilterParams } from '@/lib/api/cases.api';
import { keys } from '@/lib/query/keys';

export function useCases(filters?: CaseFilterParams) {
  return useQuery(casesListQueryOptions(filters));
}

export function useCase(id: string) {
  return useQuery(caseDetailQueryOptions(id));
}

export function useCaseOverview(id: string) {
  return useQuery(caseOverviewQueryOptions(id));
}

export function useCaseJourneyGeoJson(id: string) {
  return useQuery(caseJourneyGeoJsonQueryOptions(id));
}

export function useCasePossibleArea(id: string, at?: string) {
  return useQuery(casePossibleAreaQueryOptions(id, at));
}

export function useCreateCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => casesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.cases.all });
      queryClient.invalidateQueries({ queryKey: keys.counts('global') });
    },
  });
}

export function useUpdateCaseStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      casesApi.updateStatus(id, status, notes),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: keys.cases.detail(updated.id) });
      queryClient.invalidateQueries({ queryKey: keys.cases.all });
      queryClient.invalidateQueries({ queryKey: keys.counts('global') });
    },
  });
}
