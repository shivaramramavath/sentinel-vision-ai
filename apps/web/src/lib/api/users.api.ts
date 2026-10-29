import { http } from './http';
import { User, UserSchema } from '@/types';

export const usersApi = {
  list: async (): Promise<User[]> => {
    const res = await http.get<User[]>('/users');
    if (process.env.NODE_ENV !== 'production' && Array.isArray(res.data)) {
      res.data.forEach((u) => {
        const parsed = UserSchema.safeParse(u);
        if (!parsed.success) {
          console.warn(`User validation warning for ${u.id}:`, parsed.error.issues);
        }
      });
    }
    return res.data;
  },

  me: async (): Promise<User> => {
    const res = await http.get<User>('/auth/me');
    return res.data;
  },

  updateRole: async (id: string, role: string): Promise<User> => {
    const res = await http.patch<User>(`/users/${id}/role`, { role });
    return res.data;
  },
};
