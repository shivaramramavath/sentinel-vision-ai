import { useQuery } from '@tanstack/react-query';
import { countsQueryOptions } from '@/lib/query/options';

export function useCounts(scope = 'global') {
  return useQuery(countsQueryOptions(scope));
}
