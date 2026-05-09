import type { AppSettings } from "../../types/domain";
import { getAppDb } from "../db/appDb";

const SETTINGS_ID = "app-settings";

type PersistedSettings = AppSettings & {
  id: typeof SETTINGS_ID;
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
};

export async function loadSettingsRecord() {
  const database = await getAppDb();
  return database.get("settings", SETTINGS_ID);
}

export async function saveSettingsRecord(settings: AppSettings) {
  const database = await getAppDb();
  const existing = await database.get("settings", SETTINGS_ID);
  const now = new Date().toISOString();
  const record: PersistedSettings = {
    id: SETTINGS_ID,
    schemaVersion: 1,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    ...settings,
  };
  await database.put("settings", record);
  return record;
}
