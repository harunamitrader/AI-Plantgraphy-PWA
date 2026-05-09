import JSZip from "jszip";
import { useSettingsStore } from "../../features/settings/store/useSettingsStore";
import { getAppDb, STORE_NAMES, type ImageAsset } from "../../storage/db/appDb";
import type { AnalysisJob, AppSettings, Observation, Plant } from "../../types/domain";

const EXPORT_FORMAT = "ai-plantgraphy-pwa-export";
const EXPORT_VERSION = 1;

type BackupManifest = {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  counts: {
    settings: number;
    observations: number;
    plants: number;
    jobs: number;
    images: number;
  };
};

type ExportBundle = {
  manifest: BackupManifest;
  settings: AppSettings[];
  observations: Array<Observation & { schemaVersion: 1 }>;
  plants: Array<Plant & { schemaVersion: 1; aliases: string[]; representativeImageId: string | null }>;
  jobs: Array<AnalysisJob & { schemaVersion: 1 }>;
  images: ImageAsset[];
};

async function readStore<T>(storeName: string) {
  const database = await getAppDb();
  return database.getAll(storeName as never) as Promise<T[]>;
}

function hasSettings(value: AppSettings) {
  return Boolean(value.apiKey || value.model || value.locationLabels.length > 0);
}

export async function getBackupSummary() {
  const database = await getAppDb();
  const settings = useSettingsStore.getState();
  const settingsCount = hasSettings(settings) ? 1 : 0;
  const [observations, plants, jobs, images] = await Promise.all([
    database.count(STORE_NAMES.observations),
    database.count(STORE_NAMES.plants),
    database.count(STORE_NAMES.jobs),
    database.count(STORE_NAMES.images),
  ]);

  return { settings: settingsCount, observations, plants, jobs, images };
}

async function readBackupBundle(): Promise<ExportBundle> {
  const settings = useSettingsStore.getState();
  const [observations, plants, jobs, images] = await Promise.all([
    readStore<ExportBundle["observations"][number]>(STORE_NAMES.observations),
    readStore<ExportBundle["plants"][number]>(STORE_NAMES.plants),
    readStore<ExportBundle["jobs"][number]>(STORE_NAMES.jobs),
    readStore<ImageAsset>(STORE_NAMES.images),
  ]);

  return {
    manifest: {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      counts: {
        settings: hasSettings(settings) ? 1 : 0,
        observations: observations.length,
        plants: plants.length,
        jobs: jobs.length,
        images: images.length,
      },
    },
    settings: [settings],
    observations,
    plants,
    jobs,
    images,
  };
}

export async function createBackupZip() {
  const bundle = await readBackupBundle();
  const zip = new JSZip();
  const jsonOptions = { compression: "DEFLATE" as const };

  zip.file("manifest.json", JSON.stringify(bundle.manifest, null, 2), jsonOptions);
  zip.file("data/settings.json", JSON.stringify(bundle.settings, null, 2), jsonOptions);
  zip.file("data/observations.json", JSON.stringify(bundle.observations, null, 2), jsonOptions);
  zip.file("data/plants.json", JSON.stringify(bundle.plants, null, 2), jsonOptions);
  zip.file("data/jobs.json", JSON.stringify(bundle.jobs, null, 2), jsonOptions);

  for (const image of bundle.images) {
    const { blob, ...metadata } = image;
    zip.file(`images/${image.id}.json`, JSON.stringify(metadata, null, 2), jsonOptions);
    zip.file(`images/${image.id}.bin`, blob, { binary: true });
  }

  return zip.generateAsync({ type: "blob" });
}

async function clearStore(storeName: string) {
  const database = await getAppDb();
  await database.clear(storeName as never);
}

export async function importBackupZip(file: File) {
  const zip = await JSZip.loadAsync(file);
  const manifestEntry = zip.file("manifest.json");
  if (!manifestEntry) {
    throw new Error("manifest.json が見つかりません。");
  }

  const manifest = JSON.parse(await manifestEntry.async("string")) as BackupManifest;
  if (manifest.format !== EXPORT_FORMAT || manifest.version !== EXPORT_VERSION) {
    throw new Error("対応していないバックアップ形式です。");
  }

  const [settingsJson, observationsJson, plantsJson, jobsJson] = await Promise.all([
    zip.file("data/settings.json")?.async("string"),
    zip.file("data/observations.json")?.async("string"),
    zip.file("data/plants.json")?.async("string"),
    zip.file("data/jobs.json")?.async("string"),
  ]);

  const settings = JSON.parse(settingsJson ?? "[]") as AppSettings[];
  const observations = JSON.parse(observationsJson ?? "[]") as ExportBundle["observations"];
  const plants = JSON.parse(plantsJson ?? "[]") as ExportBundle["plants"];
  const jobs = JSON.parse(jobsJson ?? "[]") as ExportBundle["jobs"];

  await Promise.all([
    clearStore(STORE_NAMES.observations),
    clearStore(STORE_NAMES.plants),
    clearStore(STORE_NAMES.jobs),
    clearStore(STORE_NAMES.images),
  ]);

  const database = await getAppDb();
  await Promise.all([
    ...observations.map((record) => database.put(STORE_NAMES.observations, record)),
    ...plants.map((record) => database.put(STORE_NAMES.plants, record)),
    ...jobs.map((record) => database.put(STORE_NAMES.jobs, record)),
  ]);

  if (settings[0]) {
    useSettingsStore.getState().replaceAll(settings[0]);
  }

  const imageMetaEntries = Object.values(zip.files).filter(
    (entry) => entry.name.startsWith("images/") && entry.name.endsWith(".json"),
  );
  for (const entry of imageMetaEntries) {
    const meta = JSON.parse(await entry.async("string")) as Omit<ImageAsset, "blob">;
    const blobEntry = zip.file(`images/${meta.id}.bin`);
    if (!blobEntry) {
      continue;
    }
    const blob = await blobEntry.async("blob");
    await database.put(STORE_NAMES.images, { ...meta, blob });
  }

  return manifest;
}
