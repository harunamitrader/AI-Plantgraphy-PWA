import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_MODEL } from "../../../app/constants";
import type { AppSettings } from "../../../types/domain";

type SettingsState = AppSettings & {
  setApiKey: (apiKey: string) => void;
  setModel: (model: string) => void;
  addLocationLabel: (label: string) => void;
  removeLocationLabel: (label: string) => void;
  replaceAll: (settings: AppSettings) => void;
  reset: () => void;
};

const defaults: AppSettings = {
  apiProvider: "gemini",
  apiKey: "",
  model: DEFAULT_MODEL,
  locationLabels: ["自宅", "自宅庭", "近所", "公園"],
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults,
      setApiKey: (apiKey) => set({ apiKey }),
      setModel: (model) => set({ model }),
      addLocationLabel: (label) =>
        set((state) => {
          const cleaned = label.trim();
          if (!cleaned || state.locationLabels.includes(cleaned)) {
            return state;
          }
          return { locationLabels: [...state.locationLabels, cleaned] };
        }),
      removeLocationLabel: (label) =>
        set((state) => ({
          locationLabels: state.locationLabels.filter((item) => item !== label),
        })),
      replaceAll: (settings) => set(settings),
      reset: () => set(defaults),
    }),
    {
      name: "ai-plantgraphy-pwa-settings",
    },
  ),
);
