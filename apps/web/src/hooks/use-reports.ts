import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportsListQueryOptions } from '@/lib/query/options';
import { reportsApi } from '@/lib/api/reports.api';
import { keys } from '@/lib/query/keys';

export function useReports(caseId?: string) {
  return useQuery(reportsListQueryOptions(caseId));
}

export function useGenerateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { caseId: string; title: string; format: 'PDF' | 'CSV'; templateId?: string }) =>
      reportsApi.generate(data),
    onSuccess: (report) => {
      queryClient.invalidateQueries({ queryKey: keys.reports.all });
      if (report?.caseId) {
        queryClient.invalidateQueries({ queryKey: keys.reports.list(report.caseId) });
      }
    },
  });
}
