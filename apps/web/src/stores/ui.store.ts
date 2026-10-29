import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  cmdKOpen: boolean;
  setCmdKOpen: (open: boolean) => void;
  activeCaseId: string | null;
  setActiveCaseId: (id: string | null) => void;
  wallMode: boolean;
  setWallMode: (enabled: boolean) => void;
  notificationOpen: boolean;
  setNotificationOpen: (open: boolean) => void;
  dashboardMapCollapsed: boolean;
  setDashboardMapCollapsed: (collapsed: boolean) => void;
  toggleDashboardMapCollapsed: () => void;
}

export const useUiStore = create<UiState>()(
  devtools(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      cmdKOpen: false,
      setCmdKOpen: (open) => set({ cmdKOpen: open }),

      activeCaseId: 'case_001',
      setActiveCaseId: (id) => set({ activeCaseId: id }),

      wallMode: false,
      setWallMode: (enabled) => set({ wallMode: enabled }),

      notificationOpen: false,
      setNotificationOpen: (open) => set({ notificationOpen: open }),

      dashboardMapCollapsed: false,
      setDashboardMapCollapsed: (collapsed) => set({ dashboardMapCollapsed: collapsed }),
      toggleDashboardMapCollapsed: () => set((s) => ({ dashboardMapCollapsed: !s.dashboardMapCollapsed })),
    }),
    { name: 'SentinelUiStore' },
  ),
);
