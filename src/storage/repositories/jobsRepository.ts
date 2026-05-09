import { getAppDb } from "../db/appDb";
import type { AnalysisJob, JobKind, JobPhase } from "../../types/domain";

const SCHEMA_VERSION = 1;

type PersistedJobRecord = AnalysisJob & {
  schemaVersion: 1;
};

type CreateJobInput = {
  kind: JobKind;
  observationId: string | null;
  plantId: string | null;
  phase: JobPhase;
  label: string;
  percent: number;
  cancelRequested?: boolean;
  errorMessage?: string | null;
  startedAt?: number;
};

function createJobId(kind: JobKind, observationId: string | null, plantId: string | null) {
  if (kind === "observation-analysis" && observationId) {
    return `observation-${observationId}`;
  }
  if (kind === "plant-generation" && plantId) {
    return `plant-${plantId}`;
  }
  return crypto.randomUUID();
}

export async function loadJobs() {
  const database = await getAppDb();
  const records = await database.getAll("jobs");
  return records.sort((left, right) => right.updatedAt - left.updatedAt);
}

export async function loadJobByObservationId(observationId: string) {
  const database = await getAppDb();
  return database.getFromIndex("jobs", "by-observationId", observationId);
}

export async function loadJobByPlantId(plantId: string) {
  const database = await getAppDb();
  const records = await database.getAll("jobs");
  return records.find((record) => record.plantId === plantId) ?? null;
}

export async function createOrUpdateJob(input: CreateJobInput) {
  const database = await getAppDb();
  const now = Date.now();
  const existing = input.observationId
    ? await loadJobByObservationId(input.observationId)
    : input.plantId
      ? await loadJobByPlantId(input.plantId)
      : null;

  const record: PersistedJobRecord = {
    id: existing?.id ?? createJobId(input.kind, input.observationId, input.plantId),
    schemaVersion: SCHEMA_VERSION,
    kind: input.kind,
    observationId: input.observationId,
    plantId: input.plantId,
    phase: input.phase,
    label: input.label,
    percent: input.percent,
    startedAt: existing?.startedAt ?? input.startedAt ?? now,
    updatedAt: now,
    cancelRequested: input.cancelRequested ?? existing?.cancelRequested ?? false,
    errorMessage: input.errorMessage ?? existing?.errorMessage ?? null,
  };

  await database.put("jobs", record);
  return record;
}

export async function updateJob(jobId: string, patch: Partial<AnalysisJob>) {
  const database = await getAppDb();
  const existing = await database.get("jobs", jobId);
  if (!existing) {
    return null;
  }

  const now = Date.now();
  const record: PersistedJobRecord = {
    ...existing,
    ...patch,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: now,
    cancelRequested: patch.cancelRequested ?? existing.cancelRequested,
    errorMessage: patch.errorMessage ?? existing.errorMessage ?? null,
  };

  await database.put("jobs", record);
  return record;
}

export async function deleteJob(jobId: string) {
  const database = await getAppDb();
  await database.delete("jobs", jobId);
}
