import { DEFAULT_MODEL } from "../../../app/constants";
import type { AppSettings } from "../../../types/domain";
import {
  DEFAULT_OBSERVATION_PRIMARY_PROMPT,
  DEFAULT_OBSERVATION_RETRY_PROMPT,
  DEFAULT_OBSERVATION_SYSTEM_PROMPT,
  DEFAULT_PLANT_PRIMARY_PROMPT,
  DEFAULT_PLANT_RETRY_PROMPT,
  DEFAULT_PLANT_SYSTEM_PROMPT,
} from "../../../services/ai/promptDefaults";

export const defaultSettings: AppSettings = {
  apiProvider: "gemini",
  apiKey: "",
  model: DEFAULT_MODEL,
  locationLabels: ["自宅", "自宅庭", "近所", "公園"],
  observationSystemPrompt: DEFAULT_OBSERVATION_SYSTEM_PROMPT,
  observationPrimaryPrompt: DEFAULT_OBSERVATION_PRIMARY_PROMPT,
  observationRetryPrompt: DEFAULT_OBSERVATION_RETRY_PROMPT,
  plantSystemPrompt: DEFAULT_PLANT_SYSTEM_PROMPT,
  plantPrimaryPrompt: DEFAULT_PLANT_PRIMARY_PROMPT,
  plantRetryPrompt: DEFAULT_PLANT_RETRY_PROMPT,
};

export function normalizeSettings(settings?: Partial<AppSettings> | null): AppSettings {
  const locationLabels =
    settings?.locationLabels
      ?.map((label) => label.trim())
      .filter((label, index, items) => label.length > 0 && items.indexOf(label) === index) ?? [];

  return {
    ...defaultSettings,
    ...settings,
    locationLabels: locationLabels.length > 0 ? locationLabels : defaultSettings.locationLabels,
    observationSystemPrompt: settings?.observationSystemPrompt ?? defaultSettings.observationSystemPrompt,
    observationPrimaryPrompt: settings?.observationPrimaryPrompt ?? defaultSettings.observationPrimaryPrompt,
    observationRetryPrompt: settings?.observationRetryPrompt ?? defaultSettings.observationRetryPrompt,
    plantSystemPrompt: settings?.plantSystemPrompt ?? defaultSettings.plantSystemPrompt,
    plantPrimaryPrompt: settings?.plantPrimaryPrompt ?? defaultSettings.plantPrimaryPrompt,
    plantRetryPrompt: settings?.plantRetryPrompt ?? defaultSettings.plantRetryPrompt,
  };
}
