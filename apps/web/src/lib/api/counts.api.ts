import { http } from './http';
import { CountsResponse, CountsResponseSchema } from '@/types';

export const countsApi = {
  get: async (scope = 'global'): Promise<CountsResponse> => {
    const res = await http.get<CountsResponse>('/counts', {
      params: { scope },
    });
    if (process.env.NODE_ENV !== 'production') {
      const parsed = CountsResponseSchema.safeParse(res.data);
      if (!parsed.success) {
        console.warn('Counts validation warning:', parsed.error.issues);
      }
    }
    return res.data;
  },
};
