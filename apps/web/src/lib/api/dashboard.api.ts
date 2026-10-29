import { http } from './http';
import { DashboardSummary } from '@/types';

export const dashboardApi = {
  getSummary: async (site?: string, range?: string): Promise<DashboardSummary> => {
    const res = await http.get<DashboardSummary>('/dashboard/summary', {
      params: { site, range },
    });
    return res.data;
  },

  getPriorityCases: async (limit = 5): Promise<any[]> => {
    const res = await http.get<any[]>('/dashboard/priority-cases', {
      params: { limit },
    });
    return res.data;
  },
};
