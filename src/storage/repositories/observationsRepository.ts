import { getAppDb } from "../db/appDb";
import { deleteImagesForObservation, loadImagesForObservation, saveObservationImages } from "./imagesRepository";
import type { Observation } from "../../types/domain";

const SCHEMA_VERSION = 1;

type PersistedObservationRecord = Observation & {
  schemaVersion: 1;
  receivedAt: string;
  rawResult: unknown;
  errorMessage: string;
};

export type CreateObservationInput = {
  note: string;
  locationLabel: string;
  capturedAt: string | null;
  files: File[];
};

function sortByUpdatedAtDesc(left: PersistedObservationRecord, right: PersistedObservationRecord) {
  return right.updatedAt.localeCompare(left.updatedAt);
}

export async function loadObservations() {
  const database = await getAppDb();
  const observations = await database.getAll("observations");
  return observations.sort(sortByUpdatedAtDesc);
}

export async function getObservation(observationId: string) {
  const database = await getAppDb();
  return database.get("observations", observationId);
}

export async function loadObservationImages(observationId: string) {
  return loadImagesForObservation(observationId);
}

export async function loadObservationsByPlantId(plantId: string) {
  const database = await getAppDb();
  const observations = await database.getAllFromIndex("observations", "by-plantId", plantId);
  return observations.sort(sortByUpdatedAtDesc);
}

export async function createObservation(input: CreateObservationInput) {
  const trimmedNote = input.note.trim();
  const trimmedLocation = input.locationLabel.trim();

  if (input.files.length < 1 || input.files.length > 3) {
    throw new Error("画像は1〜3枚で選択してください。");
  }

  if (!trimmedLocation) {
    throw new Error("場所を入力してください。");
  }

  const database = await getAppDb();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const { originalIds } = await saveObservationImages(input.files, id);

  const record: PersistedObservationRecord = {
    id,
    schemaVersion: SCHEMA_VERSION,
    plantId: null,
    status: "queued",
    capturedAt: input.capturedAt,
    receivedAt: now,
    note: trimmedNote,
    locationLabel: trimmedLocation,
    latitude: null,
    longitude: null,
    imageIds: originalIds,
    confidence: null,
    rawResult: null,
    errorMessage: "",
    createdAt: now,
    updatedAt: now,
  };

  await database.put("observations", record);
  return record;
}

export async function deleteObservation(observationId: string) {
  const database = await getAppDb();
  await deleteImagesForObservation(observationId);
  await database.delete("observations", observationId);
}

export async function setObservationStatus(
  observationId: string,
  patch: Partial<
    Pick<PersistedObservationRecord, "status" | "confidence" | "rawResult" | "errorMessage" | "plantId">
  >,
) {
  const database = await getAppDb();
  const existing = await database.get("observations", observationId);
  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();
  const next: PersistedObservationRecord = {
    ...existing,
    ...patch,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: now,
    errorMessage: patch.errorMessage ?? existing.errorMessage,
    confidence: patch.confidence ?? existing.confidence,
    rawResult: patch.rawResult ?? existing.rawResult,
    status: patch.status ?? existing.status,
    plantId: patch.plantId ?? existing.plantId,
  };
  await database.put("observations", next);
  return next;
}

export async function updateObservationManualCorrection(
  observationId: string,
  input: {
    commonNameJa: string;
    scientificName: string;
    locationLabel: string;
    note: string;
  },
) {
  const database = await getAppDb();
  const existing = await database.get("observations", observationId);
  if (!existing) {
    return null;
  }

  const commonNameJa = input.commonNameJa.trim();
  const scientificName = input.scientificName.trim();
  const locationLabel = input.locationLabel.trim();
  const note = input.note.trim();

  if (!commonNameJa && !scientificName) {
    throw new Error("植物名または学名を入力してください。");
  }

  if (!locationLabel) {
    throw new Error("場所を入力してください。");
  }

  const now = new Date().toISOString();
  const manualResult = {
    ...(existing.rawResult && typeof existing.rawResult === "object" ? existing.rawResult : {}),
    commonNameJa: commonNameJa || null,
    scientificName: scientificName || null,
    confidence: 1,
    candidates: [
      {
        commonNameJa: commonNameJa || null,
        scientificName: scientificName || null,
        confidence: 1,
        reason: "手動補正で確定しました。",
      },
    ],
    uncertaintyNotes: "",
    correctedManually: true,
    correctedAt: now,
  };

  const next: PersistedObservationRecord = {
    ...existing,
    schemaVersion: SCHEMA_VERSION,
    status: "analyzed",
    confidence: 1,
    rawResult: manualResult,
    errorMessage: "",
    locationLabel,
    note,
    updatedAt: now,
  };
  await database.put("observations", next);
  return next;
}

export async function clearPlantLinks(plantId: string) {
  const database = await getAppDb();
  const linkedObservations = await loadObservationsByPlantId(plantId);
  const now = new Date().toISOString();

  await Promise.all(
    linkedObservations.map((observation) =>
      database.put("observations", {
        ...observation,
        plantId: null,
        updatedAt: now,
      }),
    ),
  );

  return linkedObservations.length;
}

export async function markObservationReviewed(observationId: string) {
  return setObservationStatus(observationId, {
    status: "analyzed",
    errorMessage: "",
  });
}
