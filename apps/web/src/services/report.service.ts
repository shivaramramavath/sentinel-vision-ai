import { SystemReport } from '@/types';
import { apiClient } from './api.client';

export const reportService = {
  async getAll(): Promise<SystemReport[]> {
    const res = await apiClient.get<SystemReport[]>('/reports');
    return res.data;
  },

  async generate(caseId: string, title: string, format: 'PDF' | 'CSV'): Promise<SystemReport> {
    const res = await apiClient.post<SystemReport>('/reports', {
      caseId,
      title,
      format,
    });
    return res.data;
  },
};
