import { SearchJob } from '@/types';
import { apiClient } from './api.client';

export const searchService = {
  async getAll(): Promise<SearchJob[]> {
    const res = await apiClient.get<SearchJob[]>('/search-jobs');
    return res.data;
  },

  async getActiveJobs(): Promise<SearchJob[]> {
    return this.getAll();
  },

  async triggerSearch(dto: {
    caseId?: string;
    referencePhotoUrl?: string;
    cameraScope?: string[];
    timeWindowHours?: number;
    minConfidence?: number;
  }): Promise<SearchJob> {
    const res = await apiClient.post<SearchJob>('/search-jobs', dto);
    return res.data;
  },

  async cancel(id: string): Promise<SearchJob> {
    const res = await apiClient.delete<SearchJob>(`/search-jobs/${id}`);
    return res.data;
  },
};
