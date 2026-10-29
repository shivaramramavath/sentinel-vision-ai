import { apiClient } from './api.client';
import { User } from '@/types';

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface LoginResult {
  accessToken?: string;
  user?: User;
  mfaRequired?: boolean;
}

export interface SessionInfo {
  id: string;
  ipHash: string;
  userAgent: string;
  lastSeenAt: string;
  isCurrent: boolean;
}

export interface IdentityInfo {
  provider: string;
  email?: string;
  linkedAt: string;
}

export const authService = {
  /**
   * Authenticate with email and password (with optional MFA token/recovery code)
   */
  async login(email: string, pass: string, mfaCode?: string): Promise<LoginResult> {
    const res = await apiClient.post<LoginResult>('/auth/login', {
      email,
      password: pass,
      mfaCode,
    });
    return res.data;
  },

  /**
   * Register a new account
   */
  async register(data: {
    name: string;
    email: string;
    password: string;
    inviteCode?: string;
  }): Promise<{ message: string; requiresVerification: boolean }> {
    const res = await apiClient.post<{ message: string; requiresVerification: boolean }>('/auth/register', data);
    return res.data;
  },

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<{ message: string; status: string }> {
    const res = await apiClient.post<{ message: string; status: string }>('/auth/verify-email', { token });
    return res.data;
  },

  /**
   * Resend verification email
   */
  async resendVerification(email: string): Promise<{ message: string }> {
    const res = await apiClient.post<{ message: string }>('/auth/resend-verification', { email });
    return res.data;
  },

  /**
   * Request password reset link
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const res = await apiClient.post<{ message: string }>('/auth/forgot-password', { email });
    return res.data;
  },

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const res = await apiClient.post<{ message: string }>('/auth/reset-password', {
      token,
      newPassword,
    });
    return res.data;
  },

  /**
   * Change password for logged-in user
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const res = await apiClient.post<{ message: string }>('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return res.data;
  },

  /**
   * Request silent session renewal via httpOnly refresh-token cookie
   */
  async refreshToken(): Promise<AuthResponse> {
    const res = await apiClient.post<AuthResponse>('/auth/refresh');
    return res.data;
  },

  /**
   * Terminate active server-side session and clear cookie
   */
  async logout(): Promise<void> {
    await apiClient.post('/auth/logout').catch(() => null);
  },

  /**
   * Terminate all sessions across all devices
   */
  async logoutAll(): Promise<void> {
    await apiClient.post('/auth/logout-all').catch(() => null);
  },

  /**
   * Initiate TOTP MFA setup
   */
  async setupMfa(): Promise<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }> {
    const res = await apiClient.post<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }>('/auth/mfa/setup');
    return res.data;
  },

  /**
   * Verify code and enable TOTP MFA
   */
  async enableMfa(code: string): Promise<{ recoveryCodes: string[] }> {
    const res = await apiClient.post<{ recoveryCodes: string[] }>('/auth/mfa/enable', { code });
    return res.data;
  },

  /**
   * Disable TOTP MFA
   */
  async disableMfa(code: string): Promise<{ message: string }> {
    const res = await apiClient.post<{ message: string }>('/auth/mfa/disable', { code });
    return res.data;
  },

  /**
   * Get active sessions
   */
  async getSessions(): Promise<SessionInfo[]> {
    const res = await apiClient.get<SessionInfo[]>('/auth/sessions');
    return res.data;
  },

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string): Promise<{ message: string }> {
    const res = await apiClient.delete<{ message: string }>(`/auth/sessions/${sessionId}`);
    return res.data;
  },

  /**
   * Get linked OAuth identities
   */
  async getIdentities(): Promise<IdentityInfo[]> {
    const res = await apiClient.get<IdentityInfo[]>('/auth/identities');
    return res.data;
  },

  /**
   * Unlink a linked OAuth identity
   */
  async unlinkIdentity(provider: 'google' | 'github'): Promise<{ message: string }> {
    const res = await apiClient.delete<{ message: string }>(`/auth/identities/${provider}`);
    return res.data;
  },
};
