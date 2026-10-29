import { apiClient } from './api.client';
import {
  MissingPerson,
  ReadinessScoreResult,
  FieldDiffHistory,
  DuplicateCaseMatch,
} from '@/types/missing-person';
import { PersonSearchResult, PhotoSearchCandidate } from '@/types/tracking';

export const missingPersonService = {
  async getAll(params?: { status?: string; priority?: string; search?: string }): Promise<MissingPerson[]> {
    const res = await apiClient.get<MissingPerson[]>('/missing-persons', { params });
    return res.data;
  },

  async getById(id: string): Promise<MissingPerson | undefined> {
    const res = await apiClient.get<MissingPerson>(`/missing-persons/${id}`);
    return res.data;
  },

  async create(data: Partial<MissingPerson>): Promise<MissingPerson> {
    const res = await apiClient.post<MissingPerson>('/missing-persons', data);
    return res.data;
  },

  async patch(id: string, data: Partial<MissingPerson>, ifMatch?: number): Promise<MissingPerson> {
    const headers: Record<string, string> = {};
    if (ifMatch !== undefined) {
      headers['if-match'] = String(ifMatch);
    }
    const res = await apiClient.patch<MissingPerson>(`/missing-persons/${id}`, data, { headers });
    return res.data;
  },

  async submit(id: string): Promise<MissingPerson> {
    const res = await apiClient.post<MissingPerson>(`/missing-persons/${id}/submit`);
    return res.data;
  },

  async addLastSeen(
    id: string,
    data: {
      ts: string;
      locationText: string;
      coordinates: [number, number];
      direction?: string;
      circumstances?: string;
      triggerSearch?: boolean;
    },
  ): Promise<MissingPerson> {
    const res = await apiClient.post<MissingPerson>(`/missing-persons/${id}/last-seen`, data);
    return res.data;
  },

  async updateStatus(
    id: string,
    data: {
      status: string;
      reason: string;
      verificationOfficer?: string;
      verificationNotes?: string;
    },
  ): Promise<MissingPerson> {
    const res = await apiClient.post<MissingPerson>(`/missing-persons/${id}/status`, data);
    return res.data;
  },

  async getReadiness(id: string): Promise<ReadinessScoreResult> {
    const res = await apiClient.get<ReadinessScoreResult>(`/missing-persons/${id}/readiness`);
    return res.data;
  },

  async getHistory(id: string): Promise<FieldDiffHistory[]> {
    const res = await apiClient.get<FieldDiffHistory[]>(`/missing-persons/${id}/history`);
    return res.data;
  },

  async getDuplicates(faceRefId?: string): Promise<DuplicateCaseMatch[]> {
    const res = await apiClient.get<DuplicateCaseMatch[]>('/missing-persons/duplicates', {
      params: { faceRefId },
    });
    return res.data;
  },

  async searchDossiers(params: {
    q?: string;
    status?: string;
    priority?: string;
    limit?: number;
  }): Promise<PersonSearchResult[]> {
    const res = await apiClient.get<PersonSearchResult[]>('/missing-persons/search', {
      params,
    });
    return res.data;
  },

  async searchByPhoto(
    photoUrl?: string,
    imageBase64?: string,
  ): Promise<{ candidates: PhotoSearchCandidate[] }> {
    const res = await apiClient.post<{ candidates: PhotoSearchCandidate[] }>('/missing-persons/search-by-photo', {
      photoUrl,
      imageBase64,
    });
    return res.data;
  },
};
