import { Camera } from '@/types';
import { apiClient } from './api.client';

export interface OnvifDevice {
  deviceId?: string;
  ip: string;
  ipAddress?: string;
  port: number;
  manufacturer: string;
  model: string;
  serialNumber?: string;
  firmwareVersion?: string;
  firmware?: string;
  rtspEndpoint: string;
  snapshotEndpoint?: string;
  supportsPtz: boolean;
  profiles: Array<{ name: string; token: string; encoding: string; resolution: string }>;
}

export interface ConnectionProbeResult {
  reachable: boolean;
  codec: string;
  width: number;
  height: number;
  fps: number;
  bitrateKbps: number;
  hasAudio: boolean;
  warning?: string;
  snapshotBase64?: string;
}

export interface MobilePairingResponse {
  cameraId: string;
  token: string;
  expiresAt: string;
  pairingUrl: string;
  qrCodeDataUrl: string;
}

export interface PairingExchangeResult {
  cameraId: string;
  streamKey: string;
  whipUrl: string;
  rtmpUrl: string;
  mediaPath: string;
  expiresAt: string;
}

export interface PlaybackTokenResult {
  cameraId: string;
  token: string;
  expiresInSeconds: number;
  webrtcUrl: string;
  hlsUrl: string;
}

export interface BulkImportResult {
  dryRun: boolean;
  totalRows: number;
  validCount?: number;
  committedCount?: number;
  errorCount: number;
  errors: Array<{ row: number; field: string; error: string }>;
  warnings: Array<{ row: number; field: string; warning: string }>;
  cameras?: Camera[];
}

export interface BandwidthBudgetResult {
  totalBandwidthMbps: number;
  dailyStorageGb: number;
  totalStorageGb: number;
  recommendedNodes: number;
  bitrateTierSummary: {
    lowTierCameras: number;
    medTierCameras: number;
    highTierCameras: number;
    uhdTierCameras: number;
  };
  storageByTierGb: {
    hotGb: number;
    warmGb: number;
    coldGb: number;
  };
  warnings: string[];
}

export interface BandwidthReportResult {
  totalBandwidthMbps: number;
  totalStorageGb: number;
  nodes: Array<{
    nodeId: string;
    cameraCount: number;
    currentBandwidthMbps: number;
    capacityMbps: number;
    utilizationPercent: number;
    storageUsedGb: number;
    storageCapacityGb: number;
    storageUtilizationPercent: number;
    status: 'healthy' | 'warning' | 'critical';
  }>;
  retentionBreakdown: {
    hotStorageGb: number;
    warmStorageGb: number;
    coldStorageGb: number;
    retentionDays: number;
  };
  topCamerasByBitrate: Array<{
    cameraId: string;
    name: string;
    bitrateMbps: number;
    codec: string;
    recordingMode: string;
  }>;
}

export interface TimelineInterval {
  id: string;
  start: string;
  end: string;
  durationSec: number;
  tier: 'hot' | 'warm' | 'cold' | 'evidence';
  motionScore: number;
  hasGap?: boolean;
}

export interface TimelineGap {
  start: string;
  end: string;
  durationSec: number;
  reason?: string;
}

export interface MotionMarker {
  time: string;
  score: number;
}

export interface CameraTimeline {
  cameraId: string;
  from: string;
  to: string;
  totalSegments: number;
  coveredIntervals: TimelineInterval[];
  gaps: TimelineGap[];
  motionMarkers: MotionMarker[];
}

export interface ExportClipRequest {
  from: string;
  to: string;
  caseId?: string;
  faceBlur?: boolean;
  watermark?: boolean;
  notes?: string;
  purpose?: string;
}

export interface ExportClipResponse {
  exportId: string;
  cameraId: string;
  from: string;
  to: string;
  faceBlur: boolean;
  segmentsCovered: number;
  downloadUrl: string;
  expiresInSec: number;
  status: 'processing' | 'completed' | 'failed';
}

export interface StorageReport {
  summary: {
    totalCameras: number;
    grandTotalStorageGb: number;
    hotStorageGb: number;
    warmStorageGb: number;
    evidenceStorageGb: number;
  };
  cameras: Array<{
    cameraId: string;
    cameraName: string;
    siteId: string;
    retentionDays: number;
    recordMode: string;
    totalSegments: number;
    hotStorageGb: number;
    warmStorageGb: number;
    evidenceStorageGb: number;
    totalStorageGb: number;
    earliestSegmentAt: string | null;
    latestSegmentAt: string | null;
  }>;
}

export const cameraService = {
  async getAll(): Promise<Camera[]> {
    const res = await apiClient.get<Camera[]>('/cameras');
    return res.data;
  },

  async getById(id: string): Promise<Camera | undefined> {
    const res = await apiClient.get<Camera>(`/cameras/${id}`);
    return res.data;
  },

  async updateStatus(id: string, status: Camera['status']): Promise<Camera> {
    const res = await apiClient.patch<Camera>(`/cameras/${id}`, { status });
    return res.data;
  },

  async testConnection(rtspUrl: string): Promise<ConnectionProbeResult> {
    const res = await apiClient.post<ConnectionProbeResult>('/cameras/test-connection', { rtspUrl });
    return res.data;
  },

  async discoverOnvif(subnet?: string): Promise<OnvifDevice[]> {
    const res = await apiClient.post<OnvifDevice[]>('/cameras/discover/onvif', null, {
      params: subnet ? { subnet } : undefined,
    });
    return res.data;
  },

  async createCamera(data: Partial<Camera> & { coordinates: [number, number]; authorization: { consentConfirmed: boolean } }): Promise<Camera> {
    const res = await apiClient.post<Camera>('/cameras', data);
    return res.data;
  },

  async requestPairing(name: string, siteId = 'site_primary'): Promise<MobilePairingResponse> {
    const res = await apiClient.post<MobilePairingResponse>('/cameras/pairing', { name, siteId });
    return res.data;
  },

  async exchangePairing(token: string, deviceInfo: { userAgent: string; battery: number; networkType: string }): Promise<PairingExchangeResult> {
    const res = await apiClient.post<PairingExchangeResult>('/cameras/pairing/exchange', { token, deviceInfo });
    return res.data;
  },

  async getPlaybackToken(cameraId: string): Promise<PlaybackTokenResult | null> {
    const res = await apiClient.get<PlaybackTokenResult>(`/cameras/${cameraId}/playback-token`);
    return res.data;
  },

  async bulkImport(dto: { csvText: string; dryRun?: boolean; siteId?: string }): Promise<BulkImportResult> {
    const res = await apiClient.post<BulkImportResult>('/cameras/bulk-import', dto);
    return res.data;
  },

  async estimateBandwidth(dto: {
    cameraCount?: number;
    targetResolution?: '720p' | '1080p' | '4k';
    codec?: 'h264' | 'h265' | 'av1';
    avgBitrateKbps?: number;
    recordMode?: 'continuous' | 'motion' | 'off' | string;
    retentionDays?: number;
    motionDutyCycle?: number;
  }): Promise<BandwidthBudgetResult> {
    const res = await apiClient.post<BandwidthBudgetResult>('/cameras/bandwidth/estimate', dto);
    return res.data;
  },

  async getBandwidthReport(): Promise<BandwidthReportResult | null> {
    const res = await apiClient.get<BandwidthReportResult>('/cameras/bandwidth/report');
    return res.data;
  },

  async getHealthHistory(id: string) {
    const res = await apiClient.get(`/cameras/${id}/health`);
    return res.data;
  },

  async getRecordingGaps(id: string) {
    const res = await apiClient.get(`/cameras/${id}/gaps`);
    return res.data;
  },

  async syncClock(id: string, payload: { clientSendTs: number; reportedOffsetMs?: number }) {
    const res = await apiClient.post(`/cameras/${id}/clock-sync`, payload);
    return res.data;
  },

  async getSamplerMetrics(id: string) {
    const res = await apiClient.get(`/cameras/${id}/sampler-metrics`);
    return res.data;
  },

  async getTimeline(id: string, from?: string, to?: string): Promise<CameraTimeline> {
    const res = await apiClient.get<CameraTimeline>(`/cameras/${id}/timeline`, {
      params: { from, to },
    });
    return res.data;
  },

  async exportClip(id: string, req: ExportClipRequest): Promise<ExportClipResponse> {
    const res = await apiClient.post<ExportClipResponse>(`/cameras/${id}/clips/export`, req);
    return res.data;
  },

  async getStorageReport(): Promise<StorageReport> {
    const res = await apiClient.get<StorageReport>('/cameras/storage/report');
    return res.data;
  },

  getPlaybackPlaylistUrl(id: string, from?: string, to?: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return `${baseUrl}/cameras/${id}/playback/playlist.m3u8${queryString}`;
  },
};
