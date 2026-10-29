import { http } from './http';
import { EvidenceItem, EvidenceItemSchema } from '@/types';

export interface EvidenceFilterParams {
  caseId?: string;
  type?: string;
  integrityStatus?: string;
  isLegalHold?: boolean;
  search?: string;
}

export const evidenceApi = {
  list: async (params?: EvidenceFilterParams): Promise<EvidenceItem[]> => {
    const res = await http.get<EvidenceItem[]>('/evidence', {
      params: {
        ...params,
        isLegalHold: params?.isLegalHold !== undefined ? String(params.isLegalHold) : undefined,
      },
    });
    if (process.env.NODE_ENV !== 'production' && Array.isArray(res.data)) {
      res.data.forEach((e) => {
        const parsed = EvidenceItemSchema.safeParse(e);
        if (!parsed.success) {
          console.warn(`Evidence validation warning for ${e.id}:`, parsed.error.issues);
        }
      });
    }
    return res.data;
  },

  get: async (id: string): Promise<EvidenceItem> => {
    const res = await http.get<EvidenceItem>(`/evidence/${id}`);
    if (process.env.NODE_ENV !== 'production') {
      const parsed = EvidenceItemSchema.safeParse(res.data);
      if (!parsed.success) {
        console.warn(`Evidence validation warning for ${id}:`, parsed.error.issues);
      }
    }
    return res.data;
  },

  getIntegritySummary: async (): Promise<any> => {
    const res = await http.get('/evidence/summary/integrity');
    return res.data;
  },

  exportChainOfCustody: async (id: string): Promise<any> => {
    const res = await http.get(`/evidence/${id}/chain-of-custody/export`);
    return res.data;
  },

  recordCustodyEvent: async (id: string, dto: any): Promise<EvidenceItem> => {
    const res = await http.post<EvidenceItem>(`/evidence/${id}/custody-events`, dto);
    return res.data;
  },
};
