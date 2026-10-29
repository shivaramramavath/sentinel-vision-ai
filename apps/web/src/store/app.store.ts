import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface AppState {
  /** Currently selected case ID for the active operator session */
  activeCaseId: string | null;
  setActiveCaseId: (id: string | null) => void;

  /** Whether the real-time sighting feed is enabled */
  sightingFeedEnabled: boolean;
  setSightingFeedEnabled: (enabled: boolean) => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    (set) => ({
      activeCaseId: null,
      setActiveCaseId: (id) => set({ activeCaseId: id }, false, 'setActiveCaseId'),

      sightingFeedEnabled: true,
      setSightingFeedEnabled: (enabled) =>
        set({ sightingFeedEnabled: enabled }, false, 'setSightingFeedEnabled'),
    }),
    { name: 'SentinelVisionStore' },
  ),
);
