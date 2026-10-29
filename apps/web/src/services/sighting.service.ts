import { Sighting } from '@/types';
import { apiClient } from './api.client';

export interface HardNegative {
  id: string;
  sightingId: string;
  caseId: string;
  actor: string;
  reasonCode: string;
  notes: string;
  flaggedAt: string;
  suppressUntil?: string;
  matchScore: number;
  personName: string;
  cameraName: string;
}

export const sightingService = {
  async getAll(caseId?: string): Promise<Sighting[]> {
    const res = await apiClient.get<Sighting[]>('/sightings', {
      params: caseId ? { caseId } : undefined,
    });
    return res.data;
  },

  async getHardNegatives(caseId?: string): Promise<any[]> {
    const res = await apiClient.get<any[]>('/sightings/hard-negatives', {
      params: caseId ? { caseId } : undefined,
    });
    return res.data;
  },

  async review(
    id: string,
    status: Sighting['status'],
    notes?: string,
    rejectReasonCode?: string,
  ): Promise<Sighting> {
    const res = await apiClient.post<Sighting>(`/sightings/${id}/decision`, {
      decision: status === 'confirmed_sighting' ? 'confirmed' : status === 'rejected' ? 'rejected' : 'possible',
      reasonCode: rejectReasonCode,
      notes,
    });
    return res.data;
  },

  async promoteToReference(id: string, notes?: string): Promise<any> {
    const res = await apiClient.post(`/sightings/${id}/promote-to-reference`, { notes });
    return res.data;
  },
};
