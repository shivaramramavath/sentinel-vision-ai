import { useQuery } from '@tanstack/react-query';
import { journeyForCaseQueryOptions } from '@/lib/query/options';

export function useJourney(caseId: string) {
  return useQuery(journeyForCaseQueryOptions(caseId));
}
