/**
 * Zustand slice for application settings.
 *
 * Manages font configuration, storage path readiness, and other
 * user-facing preferences surfaced through the Settings page.
 *
 * @module features/settings/state
 */

import type { StateCreator } from "zustand";

export interface SettingsSlice {
  fontFamily: string;
  fontSize: number;
  storagePath: string | null;
  isStorageReady: boolean;

  setFontFamily: (fontFamily: string) => void;
  setFontSize: (fontSize: number) => void;
  setStoragePath: (storagePath: string | null) => void;
  setStorageReady: (isStorageReady: boolean) => void;
}

/**
 * Creates the settings zustand slice.
 *
 * @param set - The zustand `set` function.
 * @returns The settings slice state and actions.
 */
export const createSettingsSlice: StateCreator<SettingsSlice> = (set) => ({
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: 13,
  storagePath: null,
  isStorageReady: false,

  setFontFamily: (fontFamily) => set({ fontFamily }),
  setFontSize: (fontSize) => set({ fontSize }),
  setStoragePath: (storagePath) => set({ storagePath }),
  setStorageReady: (isStorageReady) => set({ isStorageReady }),
});
