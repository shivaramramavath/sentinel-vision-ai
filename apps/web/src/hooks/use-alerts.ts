import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsListQueryOptions } from '@/lib/query/options';
import { alertsApi, AlertFilterParams } from '@/lib/api/alerts.api';
import { keys } from '@/lib/query/keys';

export function useAlerts(filters?: AlertFilterParams) {
  return useQuery(alertsListQueryOptions(filters));
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => alertsApi.acknowledge(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.alerts.all });
      queryClient.invalidateQueries({ queryKey: keys.counts('global') });
    },
  });
}
