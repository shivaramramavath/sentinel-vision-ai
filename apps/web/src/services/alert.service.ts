import { apiClient } from './api.client';
import type {
  AlertEvent,
  AlertsSummary,
  AlertRule,
  DispatchChannel,
  OnCallShift,
} from '@sentinel/shared-types';

export const alertService = {
  async getSummary(): Promise<AlertsSummary> {
    try {
      const { data } = await apiClient.get<AlertsSummary>('/alerts/summary');
      return data;
    } catch {
      return {
        unreadCount: 4,
        criticalCount: 1,
        warningCount: 3,
        activeStormCount: 0,
        topRecent: [],
      };
    }
  },

  async getAll(params?: {
    status?: string;
    severity?: string;
    type?: string;
    caseId?: string;
    search?: string;
  }): Promise<AlertEvent[]> {
    try {
      const { data } = await apiClient.get<AlertEvent[]>('/alerts', { params });
      return data;
    } catch {
      return [];
    }
  },

  async markAsRead(id: string): Promise<void> {
    await apiClient.patch(`/alerts/${id}/read`);
  },

  async acknowledge(id: string): Promise<AlertEvent> {
    const { data } = await apiClient.post<AlertEvent>(`/alerts/${id}/ack`);
    return data;
  },

  async assign(id: string, assigneeId: string, assigneeName: string): Promise<AlertEvent> {
    const { data } = await apiClient.post<AlertEvent>(`/alerts/${id}/assign`, { assigneeId, assigneeName });
    return data;
  },

  async snooze(id: string, durationMinutes = 60): Promise<AlertEvent> {
    const { data } = await apiClient.post<AlertEvent>(`/alerts/${id}/snooze`, { durationMinutes });
    return data;
  },

  async resolve(id: string, note: string): Promise<AlertEvent> {
    const { data } = await apiClient.post<AlertEvent>(`/alerts/${id}/resolve`, { note });
    return data;
  },

  async escalate(id: string): Promise<AlertEvent> {
    const { data } = await apiClient.post<AlertEvent>(`/alerts/${id}/escalate`);
    return data;
  },

  async bulkAction(action: 'ack' | 'resolve' | 'snooze', alertIds: string[]): Promise<{ count: number }> {
    const { data } = await apiClient.post('/alerts/bulk-action', { action, alertIds });
    return data;
  },

  async getRules(): Promise<AlertRule[]> {
    try {
      const { data } = await apiClient.get<AlertRule[]>('/alerts/rules');
      return data;
    } catch {
      return [];
    }
  },

  async createRule(dto: Partial<AlertRule>): Promise<AlertRule> {
    const { data } = await apiClient.post<AlertRule>('/alerts/rules', dto);
    return data;
  },

  async testRule(id: string): Promise<{ ruleId: string; simulatedEventsCount: number; sampleMatches: string[] }> {
    const { data } = await apiClient.post(`/alerts/rules/${id}/test`);
    return data;
  },

  async getChannels(): Promise<DispatchChannel[]> {
    try {
      const { data } = await apiClient.get<DispatchChannel[]>('/alerts/channels');
      return data;
    } catch {
      return [];
    }
  },

  async createChannel(dto: Partial<DispatchChannel>): Promise<DispatchChannel> {
    const { data } = await apiClient.post<DispatchChannel>('/alerts/channels', dto);
    return data;
  },

  async testChannel(id: string): Promise<{ success: boolean; latencyMs: number; statusMessage: string }> {
    const { data } = await apiClient.post(`/alerts/channels/${id}/test`);
    return data;
  },

  async getOnCall(): Promise<OnCallShift[]> {
    try {
      const { data } = await apiClient.get<OnCallShift[]>('/alerts/oncall');
      return data;
    } catch {
      return [];
    }
  },

  async overrideOnCall(officerId: string): Promise<OnCallShift> {
    const { data } = await apiClient.post<OnCallShift>('/alerts/oncall/override', { officerId });
    return data;
  },
};
