import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  searchJobsListQueryOptions,
  searchJobDetailQueryOptions,
} from '@/lib/query/options';
import { searchJobsApi } from '@/lib/api/search-jobs.api';
import { keys } from '@/lib/query/keys';

export function useSearchJobs(caseId?: string) {
  return useQuery(searchJobsListQueryOptions(caseId));
}

export function useSearchJob(id: string) {
  return useQuery(searchJobDetailQueryOptions(id));
}

export function useCreateSearchJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: any) => searchJobsApi.create(dto),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: keys.searchJobs.all });
      if (job?.caseId) {
        queryClient.invalidateQueries({ queryKey: keys.searchJobs.list(job.caseId) });
      }
    },
  });
}

export function usePauseSearchJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => searchJobsApi.pause(id),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: keys.searchJobs.all });
      if (job?.id) {
        queryClient.invalidateQueries({ queryKey: keys.searchJobs.detail(job.id) });
      }
    },
  });
}
