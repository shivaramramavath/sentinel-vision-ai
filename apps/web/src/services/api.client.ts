import axios from 'axios';
import { useAuthStore } from '@/stores/auth.store';
import { env } from '@/env';

const getBaseUrl = (): string => {
  const base = env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  return base.endsWith('/api/v1') ? base : `${base.replace(/\/$/, '')}/api/v1`;
};

export const apiClient = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor: inject memory-held access token
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: silent refresh on 401 for protected endpoints
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) {
      return Promise.reject(error);
    }

    const url = originalRequest.url || '';
    const isAuthEndpoint =
      url.includes('/auth/refresh') ||
      url.includes('/auth/login') ||
      url.includes('/auth/logout');

    // Never trigger a silent refresh retry for auth endpoints themselves
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;
      try {
        const refreshed = await useAuthStore.getState().refreshSession();
        if (refreshed) {
          const newToken = useAuthStore.getState().accessToken;
          if (newToken && originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return apiClient(originalRequest);
        }
      } catch {
        // Refresh failed; let the error bubble through
      }
    }
    return Promise.reject(error);
  },
);
