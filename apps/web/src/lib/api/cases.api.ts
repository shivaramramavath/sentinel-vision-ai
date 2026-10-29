import { http } from './http';
import { Case, CaseSchema } from '@/types';

export interface CaseFilterParams {
  status?: string;
  priority?: string;
  search?: string;
}

export interface CaseOverview {
  case: Case;
  readinessScore: number;
  reviewCounts: {
    pending: number;
    confirmed: number;
    rejected: number;
  };
  hopsCount: number;
  lastActivityAt?: string;
}

export const casesApi = {
  list: async (params?: CaseFilterParams): Promise<Case[]> => {
    const res = await http.get<Case[]>('/cases', { params });
    if (process.env.NODE_ENV !== 'production' && Array.isArray(res.data)) {
      res.data.forEach((c) => {
        const parsed = CaseSchema.safeParse(c);
        if (!parsed.success) {
          console.warn(`Case validation warning for ${c.id}:`, parsed.error.issues);
        }
      });
    }
    return res.data;
  },

  get: async (id: string): Promise<Case> => {
    const res = await http.get<Case>(`/cases/${id}`);
    if (process.env.NODE_ENV !== 'production') {
      const parsed = CaseSchema.safeParse(res.data);
      if (!parsed.success) {
        console.warn(`Case validation warning for ${id}:`, parsed.error.issues);
      }
    }
    return res.data;
  },

  getOverview: async (id: string): Promise<CaseOverview> => {
    const res = await http.get<CaseOverview>(`/cases/${id}/overview`);
    return res.data;
  },

  create: async (data: any): Promise<Case> => {
    const res = await http.post<Case>('/cases', data);
    return res.data;
  },

  updateStatus: async (id: string, status: string, notes?: string): Promise<Case> => {
    const res = await http.patch<Case>(`/cases/${id}/status`, { status, notes });
    return res.data;
  },

  getJourneyGeoJson: async (id: string): Promise<any> => {
    const res = await http.get(`/cases/${id}/journey/geojson`);
    return res.data;
  },

  getPossibleArea: async (id: string, at?: string): Promise<any> => {
    const res = await http.get(`/cases/${id}/possible-area`, { params: { at } });
    return res.data;
  },

  getReferences: async (id: string): Promise<any[]> => {
    const res = await http.get(`/cases/${id}/references/history`);
    return res.data;
  },
};
