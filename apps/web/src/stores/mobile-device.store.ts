import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { mobileDeviceService } from '@/services/mobile-device.service';

export interface MobileDeviceItem {
  deviceId: string;
  cameraId: string;
  label: string;
  platform: string;
  browser: string;
  status: 'pending_approval' | 'approved' | 'revoked';
  defaultFacing: 'environment' | 'user';
  shareGps: boolean;
  lastSeenAt?: string;
  createdAt: string;
}

interface MobileDeviceState {
  devices: MobileDeviceItem[];
  activeDeviceId: string | null;
  isLoading: boolean;
  loadDevices: () => Promise<void>;
  setActiveDeviceId: (deviceId: string) => void;
  getStoredDeviceKey: (deviceId: string) => string | null;
  storeDeviceKey: (deviceId: string, key: string) => void;
}

export const useMobileDeviceStore = create<MobileDeviceState>()(
  devtools(
    (set, get) => ({
      devices: [],
      activeDeviceId: null,
      isLoading: false,

      loadDevices: async () => {
        set({ isLoading: true });
        try {
          const list = await mobileDeviceService.listDevices();
          set({ devices: list, isLoading: false });
          if (list.length > 0 && !get().activeDeviceId) {
            // Select first approved device
            const firstApproved = list.find((d) => d.status === 'approved') || list[0];
            set({ activeDeviceId: firstApproved.deviceId });
          }
        } catch (err) {
          set({ isLoading: false });
        }
      },

      setActiveDeviceId: (deviceId) => set({ activeDeviceId: deviceId }),

      getStoredDeviceKey: (deviceId) => {
        if (typeof window === 'undefined') return null;
        try {
          return localStorage.getItem(`sentinel:mdev:${deviceId}`);
        } catch {
          return null;
        }
      },

      storeDeviceKey: (deviceId, key) => {
        if (typeof window === 'undefined') return;
        try {
          localStorage.setItem(`sentinel:mdev:${deviceId}`, key);
        } catch {
          // ignore
        }
      },
    }),
    { name: 'SentinelMobileDeviceStore' },
  ),
);
