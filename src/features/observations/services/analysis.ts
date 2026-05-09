import { analyzeObservationWithGemini } from "../../../services/ai/geminiClient";
import { useSettingsStore } from "../../settings/store/useSettingsStore";
import {
  createOrUpdateJob,
  updateJob,
} from "../../../storage/repositories/jobsRepository";
import {
  getObservation,
  setObservationStatus,
} from "../../../storage/repositories/observationsRepository";
import { attachPlantToObservationIfPossible } from "../../plants/services/generation";

const REVIEW_THRESHOLD = 0.65;

export async function startObservationAnalysis(observationId: string) {
  const observation = await getObservation(observationId);
  if (!observation) {
    throw new Error("観察が見つかりません。");
  }

  const settings = useSettingsStore.getState();
  const job = await createOrUpdateJob({
    kind: "observation-analysis",
    observationId,
    plantId: null,
    phase: "analyzing",
    label: "観察を解析しています",
    percent: 10,
  });

  await setObservationStatus(observationId, {
    status: "analyzing",
    errorMessage: "",
  });

  if (!settings.apiKey) {
    const errorMessage = "Gemini API キーが設定されていません。";
    await setObservationStatus(observationId, {
      status: "analysis_failed",
      errorMessage,
    });
    await updateJob(job.id, {
      phase: "failed",
      percent: 100,
      label: "解析に失敗しました",
      errorMessage,
    });
    return;
  }

  try {
    const result = await analyzeObservationWithGemini(observation, settings);
    const status = result.confidence !== null && result.confidence >= REVIEW_THRESHOLD ? "analyzed" : "needs_review";
    await setObservationStatus(observationId, {
      status,
      confidence: result.confidence,
      rawResult: result,
      errorMessage: status === "needs_review" ? "信頼度が基準未満です。" : "",
    });
    if (status === "analyzed") {
      const updatedObservation = await getObservation(observationId);
      if (updatedObservation) {
        try {
          await attachPlantToObservationIfPossible(updatedObservation);
        } catch {
          // 観察解析自体は成功しているので、図鑑生成失敗で観察状態までは巻き戻さない。
        }
      }
    }
    await updateJob(job.id, {
      phase: "finished",
      percent: 100,
      label: "解析が完了しました",
      errorMessage: null,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "解析に失敗しました。";
    await setObservationStatus(observationId, {
      status: "analysis_failed",
      errorMessage,
    });
    await updateJob(job.id, {
      phase: "failed",
      percent: 100,
      label: "解析に失敗しました",
      errorMessage,
    });
  }
}
