import axios from 'axios';
import { useMobileAuthStore } from '@/stores/mobile-auth.store';
import { env } from '@/env';

export const mobileApiClient = axios.create({
  baseURL: `${env.NEXT_PUBLIC_API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor: inject memory-held mobile access token
mobileApiClient.interceptors.request.use((config) => {
  const token = useMobileAuthStore.getState().accessToken;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: silent refresh on 401 for protected mobile endpoints
mobileApiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) {
      return Promise.reject(error);
    }

    const url = originalRequest.url || '';
    const isAuthEndpoint =
      url.includes('/mobile/auth/refresh') ||
      url.includes('/mobile/auth/login') ||
      url.includes('/mobile/auth/logout');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;
      try {
        const refreshed = await useMobileAuthStore.getState().refreshSession();
        if (refreshed) {
          const newToken = useMobileAuthStore.getState().accessToken;
          if (newToken && originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return mobileApiClient(originalRequest);
        }
      } catch {
        useMobileAuthStore.getState().clearAuth();
      }
    }

    return Promise.reject(error);
  },
);
