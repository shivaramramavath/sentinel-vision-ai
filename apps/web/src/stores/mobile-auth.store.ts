import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { MobileUser } from '@sentinel/shared-types';

interface MobileAuthState {
  user: MobileUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isCheckingAuth: boolean;
  setAuth: (user: MobileUser, accessToken: string) => void;
  clearAuth: () => void;
  setCheckingAuth: (isChecking: boolean) => void;
  refreshSession: () => Promise<boolean>;
}

export const useMobileAuthStore = create<MobileAuthState>()(
  devtools(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isCheckingAuth: true,

      setAuth: (user, accessToken) =>
        set({
          user,
          accessToken,
          isAuthenticated: true,
          isCheckingAuth: false,
        }),

      clearAuth: () =>
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isCheckingAuth: false,
        }),

      setCheckingAuth: (isChecking) => set({ isCheckingAuth: isChecking }),

      refreshSession: async () => {
        try {
          const res = await fetch('http://localhost:3001/api/v1/mobile/auth/refresh', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          });

          if (!res.ok) {
            get().clearAuth();
            return false;
          }

          const data = await res.json();
          if (data.accessToken) {
            set((state) => ({
              accessToken: data.accessToken,
              isAuthenticated: true,
              isCheckingAuth: false,
            }));
            return true;
          }
          get().clearAuth();
          return false;
        } catch {
          get().clearAuth();
          return false;
        }
      },
    }),
    { name: 'SentinelMobileAuthStore' },
  ),
);
