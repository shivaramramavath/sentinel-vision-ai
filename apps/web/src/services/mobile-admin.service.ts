import { apiClient } from './api.client';
import { AdminCreateInviteDto } from '@sentinel/shared-types';

export const mobileAdminService = {
  async getUsers(status?: string) {
    const res = await apiClient.get<any[]>('/admin/mobile/users', {
      params: { status },
    });
    return res.data;
  },

  async updateUserStatus(
    userId: string,
    action: 'approve' | 'reject' | 'suspend' | 'reactivate',
  ) {
    const res = await apiClient.post(`/admin/mobile/users/${userId}/${action}`);
    return res.data;
  },

  async getDevices(status?: string) {
    const res = await apiClient.get<any[]>('/admin/mobile/devices', {
      params: { status },
    });
    return res.data;
  },

  async updateDeviceStatus(deviceId: string, action: 'approve' | 'revoke') {
    const res = await apiClient.post(`/admin/mobile/devices/${deviceId}/${action}`);
    return res.data;
  },

  async createInvite(data: AdminCreateInviteDto) {
    const res = await apiClient.post<{
      inviteId: string;
      inviteCode: string;
      registrationUrl: string;
      siteId: string;
      expiresAt: string;
      maxUses: number;
      autoApprove: boolean;
    }>('/admin/mobile/invites', data);
    return res.data;
  },

  async getInvites() {
    const res = await apiClient.get<any[]>('/admin/mobile/invites');
    return res.data;
  },

  async revokeInvite(inviteId: string) {
    const res = await apiClient.post(`/admin/mobile/invites/${inviteId}/revoke`);
    return res.data;
  },

  async getActiveSessions() {
    const res = await apiClient.get<any[]>('/admin/mobile/sessions/active');
    return res.data;
  },
};
