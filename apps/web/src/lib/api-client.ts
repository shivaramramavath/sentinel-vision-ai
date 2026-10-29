import axios from 'axios';
import { env } from '@/env';

export const apiClient = axios.create({
  baseURL: `${env.NEXT_PUBLIC_API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Will handle redirect to login in Phase 7 (auth)
      console.warn('Unauthorized — please log in');
    }
    return Promise.reject(error);
  },
);
