import { Camera, CameraTopologyTransition, CameraHealth, CameraStatus } from '@/types';

export function deriveCameraStatus(
  health?: CameraHealth,
  isDisabled?: boolean,
  isRegistering?: boolean,
): CameraStatus {
  if (isDisabled) return 'disabled';
  if (isRegistering) return 'registering';
  if (!health) return 'offline';
  const now = Date.now();
  const lastFrameTs = health.lastFrameAt ? new Date(health.lastFrameAt).getTime() : 0;
  const timeSinceLastFrameSec = (now - lastFrameTs) / 1000;
  if (timeSinceLastFrameSec > 10 || health.fps === 0) {
    return 'offline';
  }
  if (health.fps < 15 || health.packetLoss >= 5 || health.latencyMs > 300) {
    return 'degraded';
  }
  return 'live';
}

export interface CameraFilterOptions {
  status?: string;
  siteId?: string;
  floor?: number | 'all';
  sourceType?: string;
  q?: string;
  aiOnly?: boolean;
  recordingOnly?: boolean;
  mobileOnly?: boolean;
}

export const filterCameras = (
  cameras: Camera[],
  filters?: CameraFilterOptions,
): Camera[] => {
  return cameras.filter((c) => {
    if (filters?.status && filters.status !== 'all' && c.status?.toLowerCase() !== filters.status.toLowerCase()) return false;
    if (filters?.siteId && filters.siteId !== 'all' && c.siteId !== filters.siteId) return false;
    if (filters?.floor !== undefined && filters.floor !== 'all' && c.floor !== filters.floor) return false;
    if (filters?.sourceType && filters.sourceType !== 'all' && c.sourceType !== filters.sourceType) return false;
    if (filters?.aiOnly && !c.aiPolicy?.enabled) return false;
    if (filters?.recordingOnly && (!c.recordPolicy?.mode || c.recordPolicy.mode === 'off')) return false;
    if (filters?.mobileOnly && c.sourceType !== 'mobile_webrtc' && c.sourceType !== 'mobile_rtmp') return false;

    if (filters?.q) {
      const q = filters.q.toLowerCase();
      const match =
        (c.cameraCode || '').toLowerCase().includes(q) ||
        (c.name || '').toLowerCase().includes(q) ||
        (c.locationName || '').toLowerCase().includes(q) ||
        (c.zone || '').toLowerCase().includes(q) ||
        (c.rtspUrl || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });
};

export const findCameraById = (cameras: Camera[], idOrCode?: string): Camera | undefined => {
  if (!idOrCode) return undefined;
  return cameras.find((c) => c.id === idOrCode || (c as any).cameraId === idOrCode || c.cameraCode === idOrCode);
};

export const getUnplacedCameras = (cameras: Camera[]): Camera[] => {
  return cameras.filter((c) => !c.coords || c.coords[0] === 0 || typeof c.latitude !== 'number');
};

export const getSitesFromCameras = (cameras: Camera[]): { id: string; name: string; count: number }[] => {
  const map = new Map<string, { id: string; name: string; count: number }>();
  cameras.forEach((c) => {
    if (c.siteId && c.siteId !== 'site_unplaced') {
      const existing = map.get(c.siteId);
      if (existing) {
        existing.count++;
      } else {
        map.set(c.siteId, { id: c.siteId, name: c.siteName || c.locationName || c.siteId, count: 1 });
      }
    }
  });
  return Array.from(map.values());
};
