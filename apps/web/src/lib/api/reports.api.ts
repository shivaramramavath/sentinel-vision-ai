import { http } from './http';
import { SystemReport, SystemReportSchema } from '@/types';

export const reportsApi = {
  list: async (caseId?: string): Promise<SystemReport[]> => {
    const res = await http.get<SystemReport[]>('/reports', { params: { caseId } });
    if (process.env.NODE_ENV !== 'production' && Array.isArray(res.data)) {
      res.data.forEach((r) => {
        const parsed = SystemReportSchema.safeParse(r);
        if (!parsed.success) {
          console.warn(`Report validation warning for ${r.id}:`, parsed.error.issues);
        }
      });
    }
    return res.data;
  },

  getTemplates: async (): Promise<any[]> => {
    const res = await http.get<any[]>('/reports/templates');
    return res.data;
  },

  generate: async (data: { caseId: string; title: string; format: 'PDF' | 'CSV'; templateId?: string }): Promise<SystemReport> => {
    const res = await http.post<SystemReport>('/reports', data);
    return res.data;
  },
};
