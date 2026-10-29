import { apiClient } from './api.client';
import { ReferenceImageUI } from '@/types/missing-person';

export const referenceService = {
  async getByCaseId(caseId: string): Promise<ReferenceImageUI[]> {
    const res = await apiClient.get<ReferenceImageUI[]>(`/references?caseId=${caseId}`);
    return res.data;
  },

  async presign(data: { caseId: string; filename: string; mimeType: string }) {
    const res = await apiClient.post('/references/presign', data);
    return res.data;
  },

  async register(formData: FormData): Promise<ReferenceImageUI> {
    const res = await apiClient.post<ReferenceImageUI>('/references', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async patch(id: string, data: Partial<ReferenceImageUI>): Promise<ReferenceImageUI> {
    const res = await apiClient.patch<ReferenceImageUI>(`/references/${id}`, data);
    return res.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/references/${id}`);
  },

  async replace(id: string, formData: FormData): Promise<ReferenceImageUI> {
    const res = await apiClient.post<ReferenceImageUI>(`/references/${id}/replace`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async reprocess(id: string, data: { cropBox?: any; forceReExtract?: boolean }): Promise<ReferenceImageUI> {
    const res = await apiClient.post<ReferenceImageUI>(`/references/${id}/reprocess`, data);
    return res.data;
  },
};
