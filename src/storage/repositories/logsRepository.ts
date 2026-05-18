import { getAppDb } from "../db/appDb";
import type { AppLog, AppLogSeverity, AppLogSource } from "../../types/domain";

const SCHEMA_VERSION = 1;

type PersistedLogRecord = AppLog & {
  schemaVersion: 1;
};

export type CreateLogInput = {
  severity: AppLogSeverity;
  source: AppLogSource;
  message: string;
  observationId?: string | null;
  plantId?: string | null;
  jobId?: string | null;
  details?: unknown | null;
};

export async function addLog(input: CreateLogInput) {
  const database = await getAppDb();
  const record: PersistedLogRecord = {
    id: crypto.randomUUID(),
    schemaVersion: SCHEMA_VERSION,
    severity: input.severity,
    source: input.source,
    message: input.message,
    observationId: input.observationId ?? null,
    plantId: input.plantId ?? null,
    jobId: input.jobId ?? null,
    details: input.details ?? null,
    createdAt: new Date().toISOString(),
  };

  await database.put("logs", record);
  return record;
}

export async function loadLogs(limit = 80) {
  const database = await getAppDb();
  const logs = await database.getAllFromIndex("logs", "by-createdAt");
  return logs.sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, limit);
}

export async function clearLogs() {
  const database = await getAppDb();
  await database.clear("logs");
}
