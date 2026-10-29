import { http } from './http';
import { SystemAlert, SystemAlertSchema } from '@/types';

export interface AlertFilterParams {
  status?: string;
  severity?: string;
  type?: string;
  caseId?: string;
  search?: string;
}

export const alertsApi = {
  list: async (params?: AlertFilterParams): Promise<SystemAlert[]> => {
    const res = await http.get<SystemAlert[]>('/alerts', { params });
    if (process.env.NODE_ENV !== 'production' && Array.isArray(res.data)) {
      res.data.forEach((a) => {
        const parsed = SystemAlertSchema.safeParse(a);
        if (!parsed.success) {
          console.warn(`Alert validation warning for ${a.id}:`, parsed.error.issues);
        }
      });
    }
    return res.data;
  },

  getSummary: async (): Promise<any> => {
    const res = await http.get('/alerts/summary');
    return res.data;
  },

  markRead: async (id: string): Promise<SystemAlert> => {
    const res = await http.patch<SystemAlert>(`/alerts/${id}/read`);
    return res.data;
  },

  acknowledge: async (id: string): Promise<SystemAlert> => {
    const res = await http.post<SystemAlert>(`/alerts/${id}/ack`);
    return res.data;
  },

  assign: async (id: string, assigneeId: string): Promise<SystemAlert> => {
    const res = await http.post<SystemAlert>(`/alerts/${id}/assign`, { assigneeId });
    return res.data;
  },
};
