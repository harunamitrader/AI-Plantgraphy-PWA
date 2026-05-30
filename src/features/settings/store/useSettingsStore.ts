import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppSettings } from "../../../types/domain";
import { defaultSettings, normalizeSettings } from "./settingsDefaults";

type PromptField =
  | "observationSystemPrompt"
  | "observationPrimaryPrompt"
  | "observationRetryPrompt"
  | "plantSystemPrompt"
  | "plantPrimaryPrompt"
  | "plantRetryPrompt";

type SettingsState = AppSettings & {
  setApiKey: (apiKey: string) => void;
  setModel: (model: string) => void;
  setPrompt: (field: PromptField, value: string) => void;
  addLocationLabel: (label: string) => void;
  removeLocationLabel: (label: string) => void;
  replaceAll: (settings: AppSettings) => void;
  resetPrompts: () => void;
  reset: () => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,
      setApiKey: (apiKey) => set({ apiKey }),
      setModel: (model) => set({ model }),
      setPrompt: (field, value) => set({ [field]: value } as Pick<AppSettings, PromptField>),
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
      replaceAll: (settings) => set(normalizeSettings(settings)),
      resetPrompts: () =>
        set({
          observationSystemPrompt: defaultSettings.observationSystemPrompt,
          observationPrimaryPrompt: defaultSettings.observationPrimaryPrompt,
          observationRetryPrompt: defaultSettings.observationRetryPrompt,
          plantSystemPrompt: defaultSettings.plantSystemPrompt,
          plantPrimaryPrompt: defaultSettings.plantPrimaryPrompt,
          plantRetryPrompt: defaultSettings.plantRetryPrompt,
        }),
      reset: () => set(defaultSettings),
    }),
    {
      name: "ai-plantgraphy-pwa-settings",
      merge: (persistedState, currentState) =>
        ({
          ...currentState,
          ...normalizeSettings(persistedState as Partial<AppSettings> | null),
        }) satisfies SettingsState,
    },
  ),
);
