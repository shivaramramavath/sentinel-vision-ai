import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth.store';
import { env } from '@/env';

export interface ApiProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  invalidParams?: Array<{ name: string; reason: string }>;
  [key: string]: unknown;
}

export class ApiError extends Error {
  public status: number;
  public details: ApiProblemDetails;

  constructor(status: number, message: string, details: ApiProblemDetails = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

const getBaseUrl = (): string => {
  const base = env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  return base.endsWith('/api/v1') ? base : `${base.replace(/\/$/, '')}/api/v1`;
};

export const http = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor: attach bearer token and correlation ID
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Correlation ID
  if (config.headers && !config.headers['X-Request-Id']) {
    const requestId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    config.headers['X-Request-Id'] = requestId;
  }

  return config;
});

// Response interceptor: silent refresh on 401 and RFC 7807 normalization
let activeRefreshPromise: Promise<boolean> | null = null;

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiProblemDetails | any>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (!originalRequest) {
      return Promise.reject(normalizeError(error));
    }

    const url = originalRequest.url || '';
    const isAuthEndpoint =
      url.includes('/auth/refresh') ||
      url.includes('/auth/login') ||
      url.includes('/auth/logout');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      if (!activeRefreshPromise) {
        activeRefreshPromise = useAuthStore.getState().refreshSession().finally(() => {
          activeRefreshPromise = null;
        });
      }

      try {
        const refreshed = await activeRefreshPromise;
        if (refreshed) {
          const newToken = useAuthStore.getState().accessToken;
          if (newToken && originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return http(originalRequest);
        }
      } catch {
        // Refresh failed, proceed to rejection
      }

      // If refresh failed and in browser, redirect to login
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(normalizeError(error));
  },
);

function normalizeError(error: AxiosError<ApiProblemDetails | any>): ApiError {
  if (error instanceof ApiError) return error;

  const status = error.response?.status || 500;
  const data = error.response?.data;

  if (data && typeof data === 'object') {
    const message = data.detail || data.message || data.title || error.message || 'An unexpected error occurred';
    return new ApiError(status, Array.isArray(message) ? message.join(', ') : message, {
      type: data.type,
      title: data.title || error.message,
      status,
      detail: data.detail || (typeof data.message === 'string' ? data.message : undefined),
      instance: data.instance || error.config?.url,
      invalidParams: data.invalidParams || data.errors,
    });
  }

  return new ApiError(status, error.message || 'Network error', {
    title: 'Network error',
    status,
    detail: error.message,
    instance: error.config?.url,
  });
}
