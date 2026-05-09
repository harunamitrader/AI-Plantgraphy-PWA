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
import type { Observation } from "../../../types/domain";
import type { ObservationAnalysisResult } from "../../../services/ai/geminiClient";

function normalizeObservationResult(value: unknown): ObservationAnalysisResult | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const commonNameJa =
    typeof record.commonNameJa === "string"
      ? record.commonNameJa
      : typeof record.common_name === "string"
        ? record.common_name
        : null;
  if (!commonNameJa) {
    return null;
  }

  return {
    commonNameJa,
    scientificName: typeof record.scientificName === "string" ? record.scientificName : null,
    confidence: typeof record.confidence === "number" ? record.confidence : null,
    candidates: Array.isArray(record.candidates) ? (record.candidates as ObservationAnalysisResult["candidates"]) : [],
    visibleFeatures: Array.isArray(record.visibleFeatures)
      ? record.visibleFeatures.filter((item): item is string => typeof item === "string")
      : Array.isArray(record.visible_features)
        ? record.visible_features.filter((item): item is string => typeof item === "string")
        : [],
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
  });

  await updatePlantGenerationStatus(plantId, {
    profileGenerationStatus: "analyzing",
    profileGenerationStartedAt: plant.profileGenerationStartedAt ?? new Date().toISOString(),
    profileGenerationUpdatedAt: new Date().toISOString(),
    profileGenerationErrorMessage: null,
  });

  try {
    const result = await generatePlantProfileWithGemini(
      {
        commonNameJa: plant.commonNameJa ?? plant.displayName,
        scientificName: plant.scientificName,
      },
      settings,
    );

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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "図鑑生成に失敗しました。";
    await markPlantGenerationFailed(plantId, errorMessage);
    await updateJob(job.id, {
      phase: "failed",
      label: "図鑑生成に失敗しました",
      percent: 100,
      errorMessage,
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
}
