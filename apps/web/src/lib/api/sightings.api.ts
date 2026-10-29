import { http } from './http';
import { Sighting, SightingSchema } from '@/types';

export interface SightingFilterParams {
  caseId?: string;
  status?: string;
  cursor?: string;
  limit?: number;
}

export const sightingsApi = {
  list: async (params?: SightingFilterParams): Promise<Sighting[]> => {
    const res = await http.get<Sighting[]>('/sightings', { params });
    if (process.env.NODE_ENV !== 'production' && Array.isArray(res.data)) {
      res.data.forEach((s) => {
        const parsed = SightingSchema.safeParse(s);
        if (!parsed.success) {
          console.warn(`Sighting validation warning for ${s.id}:`, parsed.error.issues);
        }
      });
    }
    return res.data;
  },

  getForCase: async (caseId: string): Promise<Sighting[]> => {
    const res = await http.get<Sighting[]>(`/cases/${caseId}/sightings`);
    return res.data;
  },

  decide: async (
    id: string,
    decision: 'confirmed' | 'rejected' | 'possible',
    reasonCode?: string,
    note?: string,
  ): Promise<Sighting> => {
    const res = await http.post<Sighting>(`/sightings/${id}/decision`, {
      decision,
      reasonCode,
      note,
    });
    return res.data;
  },

  review: async (
    id: string,
    status: string,
    notes?: string,
    rejectReasonCode?: string,
  ): Promise<Sighting> => {
    const res = await http.post<Sighting>(`/sightings/${id}/review`, {
      status,
      notes,
      rejectReasonCode,
    });
    return res.data;
  },

  promoteToReference: async (id: string, notes?: string): Promise<any> => {
    const res = await http.post(`/sightings/${id}/promote-to-reference`, { notes });
    return res.data;
  },

  getHardNegatives: async (): Promise<any[]> => {
    const res = await http.get<any[]>('/sightings/hard-negatives');
    return res.data;
  },
};
