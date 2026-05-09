import { getAppDb } from "../db/appDb";
import type { Plant } from "../../types/domain";

const SCHEMA_VERSION = 1;

type PersistedPlantRecord = Plant & {
  schemaVersion: 1;
  aliases: string[];
};

export type PlantGenerationRequest = {
  commonNameJa: string;
  scientificName?: string | null;
  aliases?: string[];
};

export type CompletePlantProfileInput = {
  commonNameJa: string;
  scientificName: string | null;
  basicProfileText: string;
  visualAppealText: string;
  careNotes: string;
  profileGeneratedJson: unknown;
  profileGenerationSeconds: number;
  createdFrom: "observation" | "manual";
  incrementObservationCount?: boolean;
  representativeImageId?: string | null;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function createDisplayName(commonNameJa: string, scientificName?: string | null) {
  const common = normalizeText(commonNameJa);
  const scientific = normalizeText(scientificName);
  if (common && scientific) {
    return `${common} (${scientific})`;
  }
  return common || scientific;
}

function createPlantRecord(
  id: string,
  request: PlantGenerationRequest,
  now: string,
  existing?: PersistedPlantRecord | null,
): PersistedPlantRecord {
  const commonNameJa = normalizeText(request.commonNameJa) || null;
  const scientificName = normalizeText(request.scientificName) || null;

  return {
    id,
    schemaVersion: SCHEMA_VERSION,
    displayName:
      createDisplayName(commonNameJa ?? "", scientificName) ||
      existing?.displayName ||
      commonNameJa ||
      scientificName ||
      "",
    commonNameJa: commonNameJa ?? existing?.commonNameJa ?? null,
    scientificName: scientificName ?? existing?.scientificName ?? null,
    basicProfileText: existing?.basicProfileText ?? "",
    visualAppealText: existing?.visualAppealText ?? "",
    careNotes: existing?.careNotes ?? "",
    profileGeneratedJson: existing?.profileGeneratedJson ?? null,
    profileGenerationSeconds: existing?.profileGenerationSeconds ?? null,
    profileGenerationStatus: "queued",
    profileGenerationStartedAt: now,
    profileGenerationUpdatedAt: now,
    profileGenerationErrorMessage: null,
    observationCount: existing?.observationCount ?? 0,
    createdFrom: existing?.createdFrom ?? "manual",
    updatedAt: now,
    aliases: request.aliases ?? existing?.aliases ?? [],
    representativeImageId: existing?.representativeImageId ?? null,
  };
}

function sortByUpdatedAtDesc(left: PersistedPlantRecord, right: PersistedPlantRecord) {
  return right.updatedAt.localeCompare(left.updatedAt);
}

export async function loadPlants() {
  const database = await getAppDb();
  const plants = await database.getAll("plants");
  return plants.sort(sortByUpdatedAtDesc);
}

export async function getPlant(plantId: string) {
  const database = await getAppDb();
  return database.get("plants", plantId);
}

export async function findExistingPlantByName(commonNameJa: string, scientificName?: string | null) {
  const common = normalizeText(commonNameJa);
  const scientific = normalizeText(scientificName);
  const plants = await loadPlants();

  if (scientific) {
    const scientificMatch = plants.find((plant) => normalizeText(plant.scientificName) === scientific);
    if (scientificMatch) {
      return scientificMatch;
    }
  }

  if (common) {
    const commonMatch = plants.find((plant) => normalizeText(plant.commonNameJa) === common);
    if (commonMatch) {
      return commonMatch;
    }
  }

  return null;
}

export async function createQueuedPlantGeneration(request: PlantGenerationRequest) {
  const commonNameJa = normalizeText(request.commonNameJa);
  if (!commonNameJa) {
    throw new Error("植物名を入力してください。");
  }

  const existing = await findExistingPlantByName(commonNameJa, request.scientificName);
  if (existing) {
    return { kind: "exists" as const, plant: existing };
  }

  const database = await getAppDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const record = createPlantRecord(id, request, now);
  await database.put("plants", record);
  return { kind: "created" as const, plant: record };
}

export async function updatePlantGenerationStatus(
  plantId: string,
  patch: Partial<
    Pick<
      PersistedPlantRecord,
      | "basicProfileText"
      | "visualAppealText"
      | "careNotes"
      | "profileGeneratedJson"
      | "profileGenerationSeconds"
      | "profileGenerationStatus"
      | "profileGenerationStartedAt"
      | "profileGenerationUpdatedAt"
      | "profileGenerationErrorMessage"
      | "displayName"
      | "commonNameJa"
      | "scientificName"
      | "representativeImageId"
    >
  >,
) {
  const database = await getAppDb();
  const existing = await database.get("plants", plantId);
  if (!existing) {
    return null;
  }

  const updatedAt = new Date().toISOString();
  const next: PersistedPlantRecord = {
    ...existing,
    ...patch,
    updatedAt,
    schemaVersion: SCHEMA_VERSION,
    aliases: existing.aliases ?? [],
    representativeImageId: patch.representativeImageId ?? existing.representativeImageId ?? null,
    profileGenerationStatus: patch.profileGenerationStatus ?? existing.profileGenerationStatus,
    profileGenerationStartedAt: patch.profileGenerationStartedAt ?? existing.profileGenerationStartedAt,
    profileGenerationUpdatedAt: patch.profileGenerationUpdatedAt ?? updatedAt,
    profileGenerationErrorMessage:
      patch.profileGenerationErrorMessage ?? existing.profileGenerationErrorMessage ?? null,
  };

  await database.put("plants", next);
  return next;
}

export async function markPlantGenerationFailed(plantId: string, errorMessage: string) {
  return updatePlantGenerationStatus(plantId, {
    profileGenerationStatus: "analysis_failed",
    profileGenerationErrorMessage: errorMessage,
    profileGenerationUpdatedAt: new Date().toISOString(),
  });
}

export async function finishPlantGeneration(
  plantId: string,
  payload: Pick<
    PersistedPlantRecord,
    "basicProfileText" | "visualAppealText" | "careNotes" | "profileGeneratedJson" | "profileGenerationSeconds"
  >,
) {
  return updatePlantGenerationStatus(plantId, {
    ...payload,
    profileGenerationStatus: null,
    profileGenerationErrorMessage: null,
    profileGenerationStartedAt: null,
    profileGenerationUpdatedAt: new Date().toISOString(),
  });
}

export async function listPlantsForReview() {
  const plants = await loadPlants();
  return plants.filter((plant) => plant.profileGenerationStatus !== null);
}

export async function saveCompletedPlantProfile(input: CompletePlantProfileInput) {
  const database = await getAppDb();
  const commonNameJa = normalizeText(input.commonNameJa);
  if (!commonNameJa) {
    throw new Error("植物名がありません。");
  }

  const existing = await findExistingPlantByName(commonNameJa, input.scientificName);
  const now = new Date().toISOString();
  const observationCount =
    (existing?.observationCount ?? 0) + (input.incrementObservationCount ? 1 : 0);

  const record: PersistedPlantRecord = {
    id: existing?.id ?? crypto.randomUUID(),
    schemaVersion: SCHEMA_VERSION,
    displayName: createDisplayName(commonNameJa, input.scientificName) || existing?.displayName || commonNameJa,
    commonNameJa,
    scientificName: normalizeText(input.scientificName) || null,
    basicProfileText: input.basicProfileText.trim(),
    visualAppealText: input.visualAppealText.trim(),
    careNotes: input.careNotes.trim(),
    profileGeneratedJson: input.profileGeneratedJson,
    profileGenerationSeconds: input.profileGenerationSeconds,
    profileGenerationStatus: null,
    profileGenerationStartedAt: null,
    profileGenerationUpdatedAt: now,
    profileGenerationErrorMessage: null,
    observationCount,
    createdFrom: existing?.createdFrom ?? input.createdFrom,
    updatedAt: now,
    aliases: existing?.aliases ?? [],
    representativeImageId: input.representativeImageId ?? existing?.representativeImageId ?? null,
  };

  await database.put("plants", record);
  return record;
}

export async function deletePlantRecord(plantId: string) {
  const database = await getAppDb();
  await database.delete("plants", plantId);
}
