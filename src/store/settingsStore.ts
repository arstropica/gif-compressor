import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { CompressionOptions } from "@/api/types";

interface SettingsState {
  globalOptions: CompressionOptions;
  queueConcurrency: number;
  setGlobalOptions: (options: Partial<CompressionOptions>) => void;
  setQueueConcurrency: (value: number) => void;
  resetToDefaults: () => void;
}

const DEFAULT_OPTIONS: CompressionOptions = {
  compression_level: 75,
  drop_frames: "none",
  reduce_colors: false,
  number_of_colors: 256,
  optimize_transparency: true,
  undo_optimizations: false,
  resize_enabled: false,
  target_width: null,
  target_height: null,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      globalOptions: DEFAULT_OPTIONS,
      queueConcurrency: 2,

      setGlobalOptions: (options) =>
        set((state) => ({
          globalOptions: { ...state.globalOptions, ...options },
        })),

      setQueueConcurrency: (value) =>
        set({ queueConcurrency: Math.max(1, Math.min(10, value)) }),

      resetToDefaults: () =>
        set({
          globalOptions: DEFAULT_OPTIONS,
          queueConcurrency: 2,
        }),
    }),
    {
      name: "gif-compressor-settings",
    },
  ),
);

export { DEFAULT_OPTIONS };
