import { http } from './http';
import { SearchJob, SearchJobSchema } from '@/types';

export const searchJobsApi = {
  list: async (caseId?: string): Promise<SearchJob[]> => {
    const res = await http.get<SearchJob[]>('/search-jobs', {
      params: { caseId },
    });
    if (process.env.NODE_ENV !== 'production' && Array.isArray(res.data)) {
      res.data.forEach((j) => {
        const parsed = SearchJobSchema.safeParse(j);
        if (!parsed.success) {
          console.warn(`SearchJob validation warning for ${j.id}:`, parsed.error.issues);
        }
      });
    }
    return res.data;
  },

  get: async (id: string): Promise<SearchJob> => {
    const res = await http.get<SearchJob>(`/search-jobs/${id}`);
    if (process.env.NODE_ENV !== 'production') {
      const parsed = SearchJobSchema.safeParse(res.data);
      if (!parsed.success) {
        console.warn(`SearchJob validation warning for ${id}:`, parsed.error.issues);
      }
    }
    return res.data;
  },

  create: async (dto: any): Promise<SearchJob> => {
    const res = await http.post<SearchJob>('/search-jobs', dto);
    return res.data;
  },

  pause: async (id: string): Promise<SearchJob> => {
    const res = await http.post<SearchJob>(`/search-jobs/${id}/pause`);
    return res.data;
  },

  cancel: async (id: string): Promise<SearchJob> => {
    const res = await http.delete<SearchJob>(`/search-jobs/${id}`);
    return res.data;
  },
};
