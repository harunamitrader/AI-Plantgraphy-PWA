import { getBackupSummary } from "../backup/backup";
import { getAppDb, STORE_NAMES, type ImageAsset } from "../../storage/db/appDb";
import { useSettingsStore } from "../../features/settings/store/useSettingsStore";

export type DiagnosticsSummary = {
  settings: {
    hasApiKey: boolean;
    model: string;
    locationLabelCount: number;
  };
  runtime: {
    isOnline: boolean;
    isInstalled: boolean;
    storageEstimateSupported: boolean;
  };
  storage: {
    usageBytes: number | null;
    quotaBytes: number | null;
    usagePercent: number | null;
    imageBytes: number;
    imageCount: number;
    observationCount: number;
    plantCount: number;
    jobCount: number;
  };
  backup: {
    exportableRecords: number;
    lastCheckedAt: string;
  };
};

async function estimateStorage() {
  if (!navigator.storage?.estimate) {
    return { usageBytes: null, quotaBytes: null, usagePercent: null };
  }

  const estimate = await navigator.storage.estimate();
  const usageBytes = typeof estimate.usage === "number" ? estimate.usage : null;
  const quotaBytes = typeof estimate.quota === "number" ? estimate.quota : null;
  const usagePercent =
    usageBytes !== null && quotaBytes !== null && quotaBytes > 0
      ? Math.min(100, Math.round((usageBytes / quotaBytes) * 1000) / 10)
      : null;

  return { usageBytes, quotaBytes, usagePercent };
}

export async function getDiagnosticsSummary(): Promise<DiagnosticsSummary> {
  const database = await getAppDb();
  const settings = useSettingsStore.getState();
  const [storageEstimate, backupSummary, images] = await Promise.all([
    estimateStorage(),
    getBackupSummary(),
    database.getAll(STORE_NAMES.images) as Promise<ImageAsset[]>,
  ]);
  const imageBytes = images.reduce((total, image) => total + (image.byteSize || image.blob.size || 0), 0);
  const isStandalone = window.matchMedia?.("(display-mode: standalone)").matches || false;

  return {
    settings: {
      hasApiKey: Boolean(settings.apiKey.trim()),
      model: settings.model,
      locationLabelCount: settings.locationLabels.length,
    },
    runtime: {
      isOnline: navigator.onLine,
      isInstalled: isStandalone,
      storageEstimateSupported: Boolean(navigator.storage?.estimate),
    },
    storage: {
      ...storageEstimate,
      imageBytes,
      imageCount: backupSummary.images,
      observationCount: backupSummary.observations,
      plantCount: backupSummary.plants,
      jobCount: backupSummary.jobs,
    },
    backup: {
      exportableRecords:
        backupSummary.settings +
        backupSummary.observations +
        backupSummary.plants +
        backupSummary.jobs +
        backupSummary.images,
      lastCheckedAt: new Date().toISOString(),
    },
  };
}

export function formatBytes(value: number | null) {
  if (value === null) {
    return "不明";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  const units = ["KB", "MB", "GB"];
  let size = value / 1024;
  for (const unit of units) {
    if (size < 1024 || unit === "GB") {
      return `${Math.round(size * 10) / 10} ${unit}`;
    }
    size /= 1024;
  }
  return `${value} B`;
}
