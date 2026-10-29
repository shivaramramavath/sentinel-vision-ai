import { Case } from '@/types';
import { apiClient } from './api.client';

export const caseService = {
  async getAll(): Promise<Case[]> {
    const res = await apiClient.get<Case[]>('/cases');
    return res.data;
  },

  async getById(id: string): Promise<Case | undefined> {
    const res = await apiClient.get<Case>(`/cases/${id}`);
    return res.data;
  },

  async create(data: Partial<Case>): Promise<Case> {
    const res = await apiClient.post<Case>('/cases', data);
    return res.data;
  },

  async update(id: string, updates: Partial<Case>): Promise<Case> {
    const res = await apiClient.patch<Case>(`/cases/${id}`, updates);
    return res.data;
  },
};
