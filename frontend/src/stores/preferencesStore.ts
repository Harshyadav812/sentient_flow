import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Per-browser UI preferences (Settings → Notifications / General).
 * Persisted to localStorage; nothing here is sent to the server.
 */
export interface Preferences {
  // Notifications
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
  notifyOnNodeError: boolean;
  desktopNotifications: boolean;

  // General
  showMinimap: boolean;
  showGrid: boolean;
  snapToGrid: boolean;
  openPaletteByDefault: boolean;
  confirmBeforeDelete: boolean;
  timestampFormat: 'relative' | 'absolute';
  sidebarCollapsed: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  notifyOnSuccess: true,
  notifyOnFailure: true,
  notifyOnNodeError: true,
  desktopNotifications: false,

  showMinimap: true,
  showGrid: true,
  snapToGrid: false,
  openPaletteByDefault: false,
  confirmBeforeDelete: true,
  timestampFormat: 'relative',
  sidebarCollapsed: false,
};

interface PreferencesState extends Preferences {
  set: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  reset: () => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFERENCES,
      set: (key, value) => set({ [key]: value } as Partial<Preferences>),
      reset: () =>
        set((s) => ({ ...DEFAULT_PREFERENCES, sidebarCollapsed: s.sidebarCollapsed })),
    }),
    { name: 'sentient-flow:preferences', version: 1 }
  )
);
