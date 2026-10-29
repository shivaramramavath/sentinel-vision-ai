import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { User } from '@/types';
import { authService, userService } from '@/services';

export interface LoginResultState {
  success: boolean;
  mfaRequired?: boolean;
  error?: string;
}

interface AuthState {
  user: User | null;
  /** Access token held ONLY in memory (Zustand state) */
  accessToken: string | null;
  isAuthenticated: boolean;
  isCheckingAuth: boolean;
  login: (email: string, pass: string, mfaCode?: string) => Promise<LoginResultState>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  setUserRole: (role: User['role']) => void;
  setUser: (user: User | null) => void;
}

// In-flight singleton promise to guarantee only one refresh request at any time
let activeRefreshPromise: Promise<boolean> | null = null;

export const useAuthStore = create<AuthState>()(
  devtools(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isCheckingAuth: true,

      login: async (email: string, pass: string, mfaCode?: string): Promise<LoginResultState> => {
        try {
          const data = await authService.login(email, pass, mfaCode);
          if (data.mfaRequired) {
            return { success: false, mfaRequired: true };
          }

          let user = data.user;
          if (!user && data.accessToken) {
            try {
              user = await userService.getCurrentUser();
            } catch {
              // Non-blocking fallback
            }
          }

          set({
            user: user || null,
            accessToken: data.accessToken || null,
            isAuthenticated: !!data.accessToken,
            isCheckingAuth: false,
          });
          return { success: !!data.accessToken };
        } catch (err: any) {
          const message =
            err?.response?.data?.message ||
            err?.message ||
            'Invalid credentials or unauthorized access level';
          return { success: false, error: message };
        }
      },

      logout: async () => {
        try {
          await authService.logout();
        } catch {
          // Ignore network errors during logout
        }
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isCheckingAuth: false,
        });
      },

      refreshSession: async () => {
        // Return existing in-flight request to prevent duplicate concurrent calls
        if (activeRefreshPromise) {
          return activeRefreshPromise;
        }

        activeRefreshPromise = (async () => {
          try {
            const data = await authService.refreshToken();
            let user = data.user;
            if (!user && data.accessToken) {
              try {
                user = await userService.getCurrentUser();
              } catch {
                // Non-blocking fallback
              }
            }

            set({
              user: user || null,
              accessToken: data.accessToken,
              isAuthenticated: true,
              isCheckingAuth: false,
            });
            return true;
          } catch (err: any) {
            const status = err?.response?.status;
            if (status === 401) {
              // Definitive unauthorized (no cookie, expired token, revoked session)
              set({
                user: null,
                accessToken: null,
                isAuthenticated: false,
                isCheckingAuth: false,
              });
              return false;
            }

            // Network errors, server errors (5xx), or timeouts:
            // Do NOT treat as definitive proof that session is invalid.
            set({
              isCheckingAuth: false,
            });
            return false;
          } finally {
            activeRefreshPromise = null;
          }
        })();

        return activeRefreshPromise;
      },

      setUserRole: (role) => {
        const u = get().user;
        if (u) {
          set({ user: { ...u, role } });
        }
      },

      setUser: (user) => {
        set({ user });
      },
    }),
    { name: 'SentinelAuthStore' },
  ),
);
