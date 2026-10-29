import { http } from './http';
import { DetailedJourney } from '@/types';

export const journeysApi = {
  get: async (caseId: string): Promise<DetailedJourney | null> => {
    if (!caseId) return null;
    const res = await http.get<DetailedJourney[]>(`/journeys`, {
      params: { caseId },
    });
    return Array.isArray(res.data) && res.data.length > 0 ? res.data[0] : null;
  },

  getByCaseId: async (caseId: string): Promise<DetailedJourney> => {
    const res = await http.get<DetailedJourney>(`/cases/${caseId}/journey`);
    return res.data;
  },

  getAlternatives: async (caseId: string): Promise<DetailedJourney[]> => {
    const res = await http.get<DetailedJourney[]>(`/cases/${caseId}/journeys`);
    return res.data;
  },

  getById: async (caseId: string, journeyId: string): Promise<DetailedJourney> => {
    const res = await http.get<DetailedJourney>(`/cases/${caseId}/journeys/${journeyId}`);
    return res.data;
  },
};
