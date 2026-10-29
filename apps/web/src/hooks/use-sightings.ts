import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sightingsListQueryOptions } from '@/lib/query/options';
import { sightingsApi, SightingFilterParams } from '@/lib/api/sightings.api';
import { keys } from '@/lib/query/keys';
import { Sighting } from '@/types';

export function useSightings(filters?: SightingFilterParams) {
  return useQuery(sightingsListQueryOptions(filters));
}

export function useDecideSighting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      decision,
      reasonCode,
      note,
    }: {
      id: string;
      decision: 'confirmed' | 'rejected' | 'possible';
      reasonCode?: string;
      note?: string;
    }) => sightingsApi.decide(id, decision, reasonCode, note),

    onMutate: async ({ id, decision }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: keys.sightings.all });

      // Snapshot previous sightings
      const previousSightings = queryClient.getQueriesData<Sighting[]>({
        queryKey: keys.sightings.all,
      });

      // Optimistically update
      queryClient.setQueriesData<Sighting[]>(
        { queryKey: keys.sightings.all },
        (old) => {
          if (!old) return old;
          return old.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status:
                    decision === 'confirmed'
                      ? ('confirmed_sighting' as const)
                      : decision === 'rejected'
                      ? ('rejected' as const)
                      : ('pending_review' as const),
                }
              : s,
          );
        },
      );

      return { previousSightings };
    },

    onError: (_err, _vars, context) => {
      if (context?.previousSightings) {
        context.previousSightings.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },

    onSettled: (updated) => {
      queryClient.invalidateQueries({ queryKey: keys.sightings.all });
      queryClient.invalidateQueries({ queryKey: keys.counts('global') });
      if (updated?.caseId) {
        queryClient.invalidateQueries({ queryKey: keys.counts(`case:${updated.caseId}`) });
        queryClient.invalidateQueries({ queryKey: keys.journeys.detail(updated.caseId) });
        queryClient.invalidateQueries({ queryKey: keys.cases.overview(updated.caseId) });
      }
    },
  });
}

export function usePromoteToReference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      sightingsApi.promoteToReference(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.cases.all });
      queryClient.invalidateQueries({ queryKey: keys.sightings.all });
    },
  });
}
