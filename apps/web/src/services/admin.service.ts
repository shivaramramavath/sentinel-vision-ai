import { apiClient } from './api.client';
import type {
  AdminUserRecord,
  RbacPermissionMatrix,
  InvestigationTeam,
  RegisteredAiModel,
  ThresholdProfile,
  ImpactPreviewResult,
  QueueLagTelemetry,
  RetentionPolicy,
  AdminAuditEntry,
  ServiceHealthStatus,
} from '@sentinel/shared-types';

export const adminService = {
  // USERS
  async getUsers(): Promise<AdminUserRecord[]> {
    try {
      const { data } = await apiClient.get<AdminUserRecord[]>('/admin/users');
      return data;
    } catch {
      return [];
    }
  },

  async inviteUser(payload: { email: string; role: string; department: string; changeReason: string }): Promise<AdminUserRecord> {
    const { data } = await apiClient.post<AdminUserRecord>('/admin/users/invite', payload);
    return data;
  },

  async updateUserRole(
    userId: string,
    role: string,
    changeReason: string,
    secondAdminApprovalEmail?: string,
  ): Promise<AdminUserRecord> {
    const { data } = await apiClient.post<AdminUserRecord>(`/admin/users/${userId}/role`, {
      role,
      changeReason,
      secondAdminApprovalEmail,
    });
    return data;
  },

  async resetMfa(userId: string, changeReason: string): Promise<any> {
    const { data } = await apiClient.post(`/admin/users/${userId}/mfa-reset`, { changeReason });
    return data;
  },

  async revokeSessions(userId: string, changeReason: string): Promise<any> {
    const { data } = await apiClient.post(`/admin/users/${userId}/revoke-sessions`, { changeReason });
    return data;
  },

  // ROLES
  async getRoles(): Promise<RbacPermissionMatrix[]> {
    try {
      const { data } = await apiClient.get<RbacPermissionMatrix[]>('/admin/roles');
      return data;
    } catch {
      return [];
    }
  },

  // TEAMS
  async getTeams(): Promise<InvestigationTeam[]> {
    try {
      const { data } = await apiClient.get<InvestigationTeam[]>('/admin/teams');
      return data;
    } catch {
      return [];
    }
  },

  // MODELS
  async getModels(): Promise<RegisteredAiModel[]> {
    try {
      const { data } = await apiClient.get<RegisteredAiModel[]>('/admin/models');
      return data;
    } catch {
      return [];
    }
  },

  async setShadowModel(modelId: string, changeReason: string): Promise<RegisteredAiModel> {
    const { data } = await apiClient.post<RegisteredAiModel>(`/admin/models/${modelId}/shadow`, { changeReason });
    return data;
  },

  async promoteModel(modelId: string, changeReason: string): Promise<RegisteredAiModel> {
    const { data } = await apiClient.post<RegisteredAiModel>(`/admin/models/${modelId}/promote`, { changeReason });
    return data;
  },

  // THRESHOLDS
  async getThresholds(): Promise<ThresholdProfile[]> {
    try {
      const { data } = await apiClient.get<ThresholdProfile[]>('/admin/thresholds');
      return data;
    } catch {
      return [];
    }
  },

  async previewImpact(profileId: string): Promise<ImpactPreviewResult> {
    const { data } = await apiClient.post<ImpactPreviewResult>('/admin/thresholds/preview-impact', { profileId });
    return data;
  },

  async activateThreshold(
    profileId: string,
    changeReason: string,
    secondAdminApproval?: string,
  ): Promise<ThresholdProfile> {
    const { data } = await apiClient.post<ThresholdProfile>('/admin/thresholds/activate', {
      profileId,
      changeReason,
      secondAdminApproval,
    });
    return data;
  },

  // QUEUES
  async getQueues(): Promise<QueueLagTelemetry[]> {
    try {
      const { data } = await apiClient.get<QueueLagTelemetry[]>('/admin/queues');
      return data;
    } catch {
      return [];
    }
  },

  // INTEGRATIONS
  async getIntegrations(): Promise<Record<string, any>> {
    try {
      const { data } = await apiClient.get('/admin/integrations');
      return data;
    } catch {
      return {};
    }
  },

  // RETENTION
  async getRetention(): Promise<RetentionPolicy[]> {
    try {
      const { data } = await apiClient.get<RetentionPolicy[]>('/admin/retention');
      return data;
    } catch {
      return [];
    }
  },

  async previewRetentionDeletion(dataClass: string, newDays: number): Promise<{ itemsPurged: number; storageFreedGb: number }> {
    const { data } = await apiClient.post('/admin/retention/preview-deletion', { dataClass, newDays });
    return data;
  },

  // AUDIT LOG
  async getAuditLog(params?: { actor?: string; action?: string; search?: string }): Promise<AdminAuditEntry[]> {
    try {
      const { data } = await apiClient.get<AdminAuditEntry[]>('/admin/audit', { params });
      return data;
    } catch {
      return [];
    }
  },

  // SYSTEM HEALTH
  async getSystemHealth(): Promise<ServiceHealthStatus[]> {
    try {
      const { data } = await apiClient.get<ServiceHealthStatus[]>('/admin/health');
      return data;
    } catch {
      return [];
    }
  },
};
