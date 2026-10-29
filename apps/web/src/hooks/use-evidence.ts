import { useQuery } from '@tanstack/react-query';
import { evidenceListQueryOptions } from '@/lib/query/options';
import { EvidenceFilterParams } from '@/lib/api/evidence.api';

export function useEvidence(filters?: EvidenceFilterParams) {
  return useQuery(evidenceListQueryOptions(filters));
}
