import { useSettingsStore } from "../../settings/store/useSettingsStore";
import { generatePlantProfileWithGemini } from "../../../services/ai/plantProfileClient";
import { loadAnalysisImagesForObservation } from "../../../storage/repositories/imagesRepository";
import {
  createOrUpdateJob,
  deleteJob,
  loadJobByPlantId,
  updateJob,
} from "../../../storage/repositories/jobsRepository";
import {
  deletePlantRecord,
  finishPlantGeneration,
  getPlant,
  markPlantGenerationFailed,
  saveCompletedPlantProfile,
  updatePlantGenerationStatus,
} from "../../../storage/repositories/plantsRepository";
import {
  clearPlantLinks,
  getObservation,
  setObservationStatus,
} from "../../../storage/repositories/observationsRepository";
import { addLog } from "../../../storage/repositories/logsRepository";
import type { Observation } from "../../../types/domain";
import type { ObservationAnalysisResult } from "../../../services/ai/geminiClient";

function toText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function collectTexts(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectTexts);
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(collectTexts);
  }
  const text = toText(value);
  return text ? [text] : [];
}

function normalizeObservationResult(value: unknown): ObservationAnalysisResult | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const identification =
    record.plant_identification && typeof record.plant_identification === "object"
      ? (record.plant_identification as Record<string, unknown>)
      : record.plantIdentification && typeof record.plantIdentification === "object"
        ? (record.plantIdentification as Record<string, unknown>)
        : record;
  const observationDetails =
    record.observation_details && typeof record.observation_details === "object"
      ? (record.observation_details as Record<string, unknown>)
      : record.observationDetails && typeof record.observationDetails === "object"
        ? (record.observationDetails as Record<string, unknown>)
        : {};
  const commonNameJa =
    toText(record.commonNameJa) ??
    toText(record.common_name_ja) ??
    toText(record.common_name) ??
    toText(record.plant_name) ??
    toText(identification.commonNameJa) ??
    toText(identification.common_name_ja) ??
    toText(identification.common_name) ??
    toText(identification.plant_name);
  if (!commonNameJa) {
    return null;
  }

  return {
    commonNameJa,
    scientificName:
      toText(record.scientificName) ??
      toText(record.scientific_name) ??
      toText(identification.scientificName) ??
      toText(identification.scientific_name),
    confidence: typeof record.confidence === "number" ? record.confidence : null,
    candidates: Array.isArray(record.candidates) ? (record.candidates as ObservationAnalysisResult["candidates"]) : [],
    visibleFeatures: Array.isArray(record.visibleFeatures)
      ? record.visibleFeatures.filter((item): item is string => typeof item === "string")
      : Array.isArray(record.visible_features)
        ? record.visible_features.filter((item): item is string => typeof item === "string")
        : collectTexts(record.characteristics ?? observationDetails.characteristics),
    uncertaintyNotes:
      typeof record.uncertaintyNotes === "string"
        ? record.uncertaintyNotes
        : typeof record.uncertainty_notes === "string"
          ? record.uncertainty_notes
          : "",
    basicProfileText:
      typeof record.basicProfileText === "string"
        ? record.basicProfileText
        : typeof record.basic_profile_text === "string"
          ? record.basic_profile_text
          : "",
    visualAppealText:
      typeof record.visualAppealText === "string"
        ? record.visualAppealText
        : typeof record.visual_appeal_text === "string"
          ? record.visual_appeal_text
          : "",
    careNotes:
      typeof record.careNotes === "string"
        ? record.careNotes
        : typeof record.care_notes === "string"
          ? record.care_notes
          : "",
    geminiModel:
      typeof record.geminiModel === "string"
        ? record.geminiModel
        : typeof record.gemini_model === "string"
          ? record.gemini_model
          : "",
    analysisTiming: {
      imageCount: 0,
      model: "",
      totalSeconds: 0,
    },
  };
}

export async function startManualPlantGeneration(plantId: string) {
  const plant = await getPlant(plantId);
  if (!plant) {
    throw new Error("図鑑が見つかりません。");
  }

  const settings = useSettingsStore.getState();
  const job = await createOrUpdateJob({
    kind: "plant-generation",
    observationId: null,
    plantId,
    phase: "analyzing",
    label: "図鑑を生成しています",
    percent: 10,
    cancelRequested: false,
  });

  await updatePlantGenerationStatus(plantId, {
    profileGenerationStatus: "analyzing",
    profileGenerationStartedAt: plant.profileGenerationStartedAt ?? new Date().toISOString(),
    profileGenerationUpdatedAt: new Date().toISOString(),
    profileGenerationErrorMessage: null,
  });
  await addLog({
    severity: "info",
    source: "plant-generation",
    message: "図鑑生成を開始しました。",
    plantId,
    jobId: job.id,
    details: { model: settings.model, commonNameJa: plant.commonNameJa ?? plant.displayName },
  });

  try {
    const result = await generatePlantProfileWithGemini(
      {
        commonNameJa: plant.commonNameJa ?? plant.displayName,
        scientificName: plant.scientificName,
      },
      settings,
    );
    const latestJob = await loadJobByPlantId(plantId);
    if (latestJob?.cancelRequested) {
      await markPlantGenerationFailed(plantId, "図鑑生成を停止しました。");
      await updateJob(job.id, {
        phase: "failed",
        label: "図鑑生成を停止しました",
        percent: 100,
        errorMessage: "図鑑生成を停止しました。",
      });
      await addLog({
        severity: "warning",
        source: "plant-generation",
        message: "図鑑生成を停止しました。",
        plantId,
        jobId: job.id,
      });
      return;
    }

    const saved = await saveCompletedPlantProfile({
      commonNameJa: result.commonNameJa,
      scientificName: result.scientificName,
      basicProfileText: result.basicProfileText,
      visualAppealText: result.visualAppealText,
      careNotes: result.careNotes,
      profileGeneratedJson: result,
      profileGenerationSeconds: result.generationSeconds,
      createdFrom: plant.createdFrom,
    });

    if (saved.id !== plantId) {
      await finishPlantGeneration(plantId, {
        basicProfileText: saved.basicProfileText,
        visualAppealText: saved.visualAppealText,
        careNotes: saved.careNotes,
        profileGeneratedJson: saved.profileGeneratedJson,
        profileGenerationSeconds: saved.profileGenerationSeconds ?? result.generationSeconds,
      });
    } else {
      await finishPlantGeneration(plantId, {
        basicProfileText: result.basicProfileText,
        visualAppealText: result.visualAppealText,
        careNotes: result.careNotes,
        profileGeneratedJson: result,
        profileGenerationSeconds: result.generationSeconds,
      });
    }

    await updateJob(job.id, {
      phase: "finished",
      label: "図鑑生成が完了しました",
      percent: 100,
      errorMessage: null,
    });
    await addLog({
      severity: "info",
      source: "plant-generation",
      message: "図鑑生成が完了しました。",
      plantId: saved.id,
      jobId: job.id,
      details: { seconds: result.generationSeconds },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "図鑑生成に失敗しました。";
    await markPlantGenerationFailed(plantId, errorMessage);
    await updateJob(job.id, {
      phase: "failed",
      label: "図鑑生成に失敗しました",
      percent: 100,
      errorMessage,
    });
    await addLog({
      severity: "error",
      source: "plant-generation",
      message: errorMessage,
      plantId,
      jobId: job.id,
    });
  }
}

export async function buildPlantFromObservation(observationId: string) {
  const observation = await getObservation(observationId);
  if (!observation) {
    throw new Error("観察が見つかりません。");
  }

  const analysis = normalizeObservationResult(observation.rawResult);
  if (!analysis?.commonNameJa) {
    return null;
  }

  const settings = useSettingsStore.getState();
  const representativeImage = (await loadAnalysisImagesForObservation(observation.id))[0] ?? null;
  const result = await generatePlantProfileWithGemini(
    {
      commonNameJa: analysis.commonNameJa,
      scientificName: analysis.scientificName,
      visibleFeatures: analysis.visibleFeatures,
      observationNote: observation.note,
    },
    settings,
  );

  const plant = await saveCompletedPlantProfile({
    commonNameJa: result.commonNameJa,
    scientificName: result.scientificName,
    basicProfileText: result.basicProfileText,
    visualAppealText: result.visualAppealText,
    careNotes: result.careNotes,
    profileGeneratedJson: {
      profile: result,
      observationAnalysis: analysis,
    },
    profileGenerationSeconds: result.generationSeconds,
    createdFrom: "observation",
    incrementObservationCount: !observation.plantId,
    representativeImageId: representativeImage?.id ?? null,
  });

  await setObservationStatus(observation.id, {
    plantId: plant.id,
  });
  await addLog({
    severity: "info",
    source: "plant-generation",
    message: "観察から図鑑を生成しました。",
    observationId: observation.id,
    plantId: plant.id,
    details: { seconds: result.generationSeconds },
  });

  return plant;
}

export async function clearFinishedPlantJob(plantId: string) {
  const job = await createOrUpdateJob({
    kind: "plant-generation",
    observationId: null,
    plantId,
    phase: "finished",
    label: "図鑑生成が完了しました",
    percent: 100,
  });
  await deleteJob(job.id);
}

export async function requestStopPlantGeneration(plantId: string) {
  const plant = await getPlant(plantId);
  if (!plant) {
    throw new Error("図鑑が見つかりません。");
  }

  const job = await loadJobByPlantId(plantId);
  if (job) {
    await updateJob(job.id, {
      phase: "stopping",
      percent: job.percent,
      label: "図鑑生成を停止しています",
      cancelRequested: true,
      errorMessage: null,
    });
  }

  await markPlantGenerationFailed(plantId, "図鑑生成を停止しました。");
  await addLog({
    severity: "warning",
    source: "plant-generation",
    message: "図鑑生成の停止を要求しました。",
    plantId,
    jobId: job?.id ?? null,
  });
}

export async function attachPlantToObservationIfPossible(observation: Observation) {
  if (observation.status !== "analyzed") {
    return null;
  }
  return buildPlantFromObservation(observation.id);
}

export async function deletePlantWithRelations(plantId: string) {
  await clearPlantLinks(plantId);
  const job = await loadJobByPlantId(plantId);
  if (job) {
    await deleteJob(job.id);
  }
  await deletePlantRecord(plantId);
  await addLog({
    severity: "info",
    source: "plant-generation",
    message: "図鑑を削除しました。",
    plantId,
  });
}
