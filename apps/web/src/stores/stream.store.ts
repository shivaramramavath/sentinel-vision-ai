import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type StreamStatus = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'stopped';
export type CameraFacing = 'environment' | 'user';
export type StreamResolution = 'auto' | '720p' | '480p';

export interface StreamStats {
  bitrateKbps: number;
  rttMs: number;
  fps: number;
  battery: number;
  charging: boolean;
  gpsAccuracyM?: number;
  latitude?: number;
  longitude?: number;
}

interface StreamState {
  sessionId: string | null;
  cameraId: string | null;
  status: StreamStatus;
  facingMode: CameraFacing;
  resolution: StreamResolution;
  isMuted: boolean;
  durationSeconds: number;
  stats: StreamStats;
  errorMessage: string | null;

  setSession: (sessionId: string | null, cameraId: string | null) => void;
  setStatus: (status: StreamStatus) => void;
  setFacingMode: (facing: CameraFacing) => void;
  setResolution: (resolution: StreamResolution) => void;
  setIsMuted: (isMuted: boolean) => void;
  incrementDuration: () => void;
  resetDuration: () => void;
  updateStats: (partial: Partial<StreamStats>) => void;
  setError: (msg: string | null) => void;
  resetStream: () => void;
}

export const useStreamStore = create<StreamState>()(
  devtools(
    (set) => ({
      sessionId: null,
      cameraId: null,
      status: 'idle',
      facingMode: 'environment',
      resolution: 'auto',
      isMuted: true,
      durationSeconds: 0,
      stats: {
        bitrateKbps: 0,
        rttMs: 0,
        fps: 0,
        battery: 100,
        charging: false,
      },
      errorMessage: null,

      setSession: (sessionId, cameraId) => set({ sessionId, cameraId }),
      setStatus: (status) => set({ status }),
      setFacingMode: (facingMode) => set({ facingMode }),
      setResolution: (resolution) => set({ resolution }),
      setIsMuted: (isMuted) => set({ isMuted }),
      incrementDuration: () => set((s) => ({ durationSeconds: s.durationSeconds + 1 })),
      resetDuration: () => set({ durationSeconds: 0 }),
      updateStats: (partial) =>
        set((s) => ({ stats: { ...s.stats, ...partial } })),
      setError: (errorMessage) => set({ errorMessage }),
      resetStream: () =>
        set({
          sessionId: null,
          cameraId: null,
          status: 'idle',
          durationSeconds: 0,
          errorMessage: null,
        }),
    }),
    { name: 'SentinelStreamStore' },
  ),
);
