import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { AnalysisJob, AppSettings, Observation, Plant } from "../../types/domain";

export const APP_DB_NAME = "ai-plantgraphy-pwa";
export const APP_DB_VERSION = 1;

export const STORE_NAMES = {
  settings: "settings",
  observations: "observations",
  plants: "plants",
  images: "images",
  jobs: "jobs",
} as const;

export type ImageAsset = {
  id: string;
  kind: "original" | "thumbnail";
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
  sourceObservationId: string | null;
  createdAt: string;
};

export interface AppDatabaseSchema extends DBSchema {
  settings: {
    key: string;
    value: AppSettings & { id: string; schemaVersion: 1; createdAt: string; updatedAt: string };
  };
  observations: {
    key: string;
    value: Observation & { schemaVersion: 1 };
    indexes: {
      "by-status": Observation["status"];
      "by-createdAt": string;
      "by-updatedAt": string;
      "by-plantId": string;
    };
  };
  plants: {
    key: string;
    value: Plant & { schemaVersion: 1; aliases: string[] };
    indexes: {
      "by-displayName": string;
      "by-commonNameJa": string;
      "by-scientificName": string;
      "by-updatedAt": string;
    };
  };
  images: {
    key: string;
    value: ImageAsset;
    indexes: {
      "by-sourceObservationId": string;
      "by-kind": ImageAsset["kind"];
    };
  };
  jobs: {
    key: string;
    value: AnalysisJob;
    indexes: {
      "by-observationId": string;
      "by-updatedAt": number;
    };
  };
}

let databasePromise: Promise<IDBPDatabase<AppDatabaseSchema>> | null = null;

export function getAppDb() {
  if (!databasePromise) {
    databasePromise = openDB<AppDatabaseSchema>(APP_DB_NAME, APP_DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE_NAMES.settings)) {
          database.createObjectStore(STORE_NAMES.settings, { keyPath: "id" });
        }

        if (!database.objectStoreNames.contains(STORE_NAMES.observations)) {
          const store = database.createObjectStore(STORE_NAMES.observations, { keyPath: "id" });
          store.createIndex("by-status", "status");
          store.createIndex("by-createdAt", "createdAt");
          store.createIndex("by-updatedAt", "updatedAt");
          store.createIndex("by-plantId", "plantId");
        }

        if (!database.objectStoreNames.contains(STORE_NAMES.plants)) {
          const store = database.createObjectStore(STORE_NAMES.plants, { keyPath: "id" });
          store.createIndex("by-displayName", "displayName");
          store.createIndex("by-commonNameJa", "commonNameJa");
          store.createIndex("by-scientificName", "scientificName");
          store.createIndex("by-updatedAt", "updatedAt");
        }

        if (!database.objectStoreNames.contains(STORE_NAMES.images)) {
          const store = database.createObjectStore(STORE_NAMES.images, { keyPath: "id" });
          store.createIndex("by-sourceObservationId", "sourceObservationId");
          store.createIndex("by-kind", "kind");
        }

        if (!database.objectStoreNames.contains(STORE_NAMES.jobs)) {
          const store = database.createObjectStore(STORE_NAMES.jobs, { keyPath: "id" });
          store.createIndex("by-observationId", "observationId");
          store.createIndex("by-updatedAt", "updatedAt");
        }
      },
    });
  }
  return databasePromise;
}

export async function ensureAppDbReady() {
  await getAppDb();
}

export function appDbStatusText() {
  return "IndexedDB のストアを初期化済みです。次は repository 層で観察・図鑑・画像を保存します。";
}
