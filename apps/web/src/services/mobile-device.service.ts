import { mobileApiClient } from './mobile-api.client';
import {
  MobileAddDeviceDto,
  SessionHeartbeatDto,
} from '@sentinel/shared-types';

export interface StartSessionResponse {
  sessionId: string;
  cameraId: string;
  whipUrl: string;
  publishToken: string;
  iceServers: RTCIceServer[];
  constraints: {
    idealWidth: number;
    idealHeight: number;
    maxFps: number;
    maxBitrateKbps: number;
    h264Preferred: boolean;
  };
  serverTimeMs: number;
}

export const mobileDeviceService = {
  async listDevices() {
    const res = await mobileApiClient.get<any[]>('/mobile/devices');
    return res.data;
  },

  async addDevice(data: MobileAddDeviceDto) {
    const res = await mobileApiClient.post<{
      deviceId: string;
      cameraId: string;
      label: string;
      status: string;
      deviceKey: string;
      defaultFacing: string;
      shareGps: boolean;
    }>('/mobile/devices', data);
    return res.data;
  },

  async updateDevice(deviceId: string, data: any) {
    const res = await mobileApiClient.patch(`/mobile/devices/${deviceId}`, data);
    return res.data;
  },

  async deleteDevice(deviceId: string) {
    const res = await mobileApiClient.delete(`/mobile/devices/${deviceId}`);
    return res.data;
  },

  async startSession(deviceId: string, deviceKey?: string) {
    const res = await mobileApiClient.post<StartSessionResponse>(
      `/mobile/devices/${deviceId}/sessions`,
      { deviceKey },
    );
    return res.data;
  },

  async refreshToken(sessionId: string) {
    const res = await mobileApiClient.post<{
      publishToken: string;
      expiresInSeconds: number;
    }>(`/mobile/sessions/${sessionId}/token-refresh`);
    return res.data;
  },

  async sendHeartbeat(sessionId: string, telemetry: SessionHeartbeatDto) {
    const res = await mobileApiClient.post<{ status: string; serverTimeMs: number }>(
      `/mobile/sessions/${sessionId}/heartbeat`,
      telemetry,
    );
    return res.data;
  },

  async stopSession(sessionId: string) {
    const res = await mobileApiClient.post<{ success: boolean }>(
      `/mobile/sessions/${sessionId}/stop`,
    );
    return res.data;
  },

  async getServerTime() {
    const res = await mobileApiClient.get<{ serverTimeMs: number }>('/mobile/time');
    return res.data;
  },
};
