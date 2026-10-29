import { apiClient } from './api.client';
import { User } from '@/types';

export const userService = {
  /**
   * Fetch current authenticated user profile
   */
  async getCurrentUser(): Promise<User> {
    const res = await apiClient.get<User>('/auth/me');
    return res.data;
  },

  /**
   * Fetch system users list (for admin/reviewer panels)
   */
  async getUsers(): Promise<User[]> {
    const res = await apiClient.get<User[]>('/users');
    return res.data;
  },
};
