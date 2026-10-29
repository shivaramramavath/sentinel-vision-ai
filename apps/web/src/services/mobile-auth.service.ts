import { mobileApiClient } from './mobile-api.client';
import {
  MobileRegisterDto,
  MobileVerifyDto,
  MobileLoginDto,
} from '@sentinel/shared-types';

export const mobileAuthService = {
  async register(data: MobileRegisterDto) {
    const res = await mobileApiClient.post<{ status: string; message: string }>(
      '/mobile/auth/register',
      data,
    );
    return res.data;
  },

  async verify(data: MobileVerifyDto) {
    const res = await mobileApiClient.post<{ status: string; message: string }>(
      '/mobile/auth/verify',
      data,
    );
    return res.data;
  },

  async resendOtp(email: string) {
    const res = await mobileApiClient.post<{ message: string }>(
      '/mobile/auth/resend-otp',
      { email },
    );
    return res.data;
  },

  async login(data: MobileLoginDto) {
    const res = await mobileApiClient.post<{
      accessToken: string;
      user: any;
    }>('/mobile/auth/login', data);
    return res.data;
  },

  async logout() {
    await mobileApiClient.post('/mobile/auth/logout');
  },

  async getProfile() {
    const res = await mobileApiClient.get('/mobile/me');
    return res.data;
  },
};
