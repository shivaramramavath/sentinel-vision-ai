import { DetailedJourney } from '@/types/tracking';
import { apiClient } from './api.client';

export const journeyService = {
  async getAlternativeJourneys(caseId: string): Promise<DetailedJourney[]> {
    const res = await apiClient.get<DetailedJourney[]>(`/cases/${caseId}/journeys`);
    return res.data || [];
  },

  async getJourneyById(caseId: string, journeyId: string): Promise<DetailedJourney> {
    const res = await apiClient.get<DetailedJourney>(`/cases/${caseId}/journeys/${journeyId}`);
    return res.data;
  },

  async confirmHop(caseId: string, sightingId: string, notes?: string): Promise<boolean> {
    await apiClient.post(`/sightings/${sightingId}/decision`, {
      decision: 'confirmed',
      notes: notes || 'Confirmed by investigator against reference set',
    });
    return true;
  },

  async rejectHop(caseId: string, sightingId: string, reason: string): Promise<boolean> {
    await apiClient.post(`/sightings/${sightingId}/decision`, {
      decision: 'rejected',
      notes: reason,
    });
    return true;
  },
};
