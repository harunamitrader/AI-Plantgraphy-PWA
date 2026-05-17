import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useRuntimeStatus } from "../../../app/hooks/useRuntimeStatus";
import { formatElapsedSeconds } from "../../../app/utils/time";
import { requestStopObservationAnalysis, startObservationAnalysis } from "../../observations/services/analysis";
import {
  loadObservations,
  markObservationReviewed,
} from "../../../storage/repositories/observationsRepository";
import { loadPlants } from "../../../storage/repositories/plantsRepository";
import type { Observation, Plant } from "../../../types/domain";
import {
  buildPlantFromObservation,
  requestStopPlantGeneration,
  startManualPlantGeneration,
} from "../../plants/services/generation";

function isReviewPlant(plant: Plant) {
  return plant.profileGenerationStatus !== null;
}

function isReviewObservation(observation: Observation) {
  return (
    observation.status === "queued" ||
    observation.status === "analyzing" ||
    observation.status === "needs_review" ||
    observation.status === "analysis_failed"
  );
}

function formatObservationStatus(status: Observation["status"]) {
  switch (status) {
    case "queued":
      return "保存済み";
    case "analyzing":
      return "解析中";
    case "needs_review":
      return "確認待ち";
    case "analysis_failed":
      return "失敗";
    case "analyzed":
      return "解析済み";
    default:
      return status;
  }
}

function getObservationElapsedEnd(observation: Observation) {
  return observation.status === "queued" || observation.status === "analyzing" ? null : observation.updatedAt;
}

function getPlantElapsedEnd(plant: Plant) {
  return plant.profileGenerationStatus === "queued" || plant.profileGenerationStatus === "analyzing"
    ? null
    : plant.profileGenerationUpdatedAt ?? plant.updatedAt;
}

export function ReviewPage() {
  const navigate = useNavigate();
  const runtime = useRuntimeStatus();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function refresh() {
      const [plantRecords, observationRecords] = await Promise.all([loadPlants(), loadObservations()]);
      if (mounted) {
        setPlants(plantRecords.filter(isReviewPlant));
        setObservations(observationRecords.filter(isReviewObservation));
      }
    }

    void refresh();

    const timer = window.setInterval(() => {
      setNow(Date.now());
      void refresh();
    }, 1000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const plantCounts = useMemo(() => {
    return {
      queued: plants.filter((plant) => plant.profileGenerationStatus === "queued").length,
      analyzing: plants.filter((plant) => plant.profileGenerationStatus === "analyzing").length,
      failed: plants.filter((plant) => plant.profileGenerationStatus === "analysis_failed").length,
    };
  }, [plants]);

  const observationCounts = useMemo(() => {
    return {
      queued: observations.filter((item) => item.status === "queued").length,
      analyzing: observations.filter((item) => item.status === "analyzing").length,
      needsReview: observations.filter((item) => item.status === "needs_review").length,
      failed: observations.filter((item) => item.status === "analysis_failed").length,
    };
  }, [observations]);

  async function refreshLists() {
    const [plantRecords, observationRecords] = await Promise.all([loadPlants(), loadObservations()]);
    setPlants(plantRecords.filter(isReviewPlant));
    setObservations(observationRecords.filter(isReviewObservation));
  }

  async function runAction(key: string, action: () => Promise<void>, successMessage: string) {
    setBusyKey(key);
    try {
      await action();
      setNotice(successMessage);
      await refreshLists();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "処理に失敗しました。");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className="panel stack">
      <div>
        <p className="eyebrow">Review</p>
        <h2>確認待ち</h2>
        <p className="status-copy">
          生成中・確認待ち・失敗中をまとめて確認し、その場で再解析や図鑑再生成を実行できます。
        </p>
        {runtime.aiBlockedReason ? <p className="status-copy">{runtime.aiBlockedReason}</p> : null}
      </div>

      {notice ? <p className="status-copy">{notice}</p> : null}

      <div className="status-grid">
        <article className="placeholder-card">
          <p className="eyebrow">図鑑</p>
          <h3>{plantCounts.queued + plantCounts.analyzing}件</h3>
          <p className="status-copy">
            生成中 {plantCounts.queued + plantCounts.analyzing} / 失敗 {plantCounts.failed}
          </p>
        </article>
        <article className="placeholder-card">
          <p className="eyebrow">観察</p>
          <h3>
            {observationCounts.queued +
              observationCounts.analyzing +
              observationCounts.needsReview +
              observationCounts.failed}
            件
          </h3>
          <p className="status-copy">
            保存済み {observationCounts.queued} / 解析中 {observationCounts.analyzing} / 確認待ち{" "}
            {observationCounts.needsReview} / 失敗 {observationCounts.failed}
          </p>
        </article>
      </div>

      <div className="stack">
        {plants.map((plant) => {
          const actionKey = `plant-${plant.id}`;
          return (
            <article className="placeholder-card" key={actionKey}>
              <div className="metric">
                <div>
                  <p className="eyebrow">Plant</p>
                  <h3>{plant.displayName || plant.commonNameJa || "名称未設定"}</h3>
                </div>
                <span className="status-badge">
                  {plant.profileGenerationStatus === "analysis_failed"
                    ? "失敗"
                    : plant.profileGenerationStatus === "analyzing"
                      ? "解析中"
                      : "生成中"}
                </span>
              </div>
              <p className="status-copy">
                {formatElapsedSeconds(plant.profileGenerationStartedAt, now, getPlantElapsedEnd(plant)) ??
                  "経過時間なし"}
              </p>
              <div className="panel-actions">
                <button
                  className="cta-button"
                  type="button"
                  disabled={busyKey === actionKey || !runtime.aiReady}
                  onClick={() =>
                    void runAction(
                      actionKey,
                      () => startManualPlantGeneration(plant.id),
                      "図鑑再生成を開始しました。",
                    )
                  }
                >
                  {busyKey === actionKey ? "処理中..." : "図鑑を再生成する"}
                </button>
                {plant.profileGenerationStatus === "queued" || plant.profileGenerationStatus === "analyzing" ? (
                  <button
                    className="danger-button"
                    type="button"
                    disabled={busyKey === `${actionKey}-stop`}
                    onClick={() =>
                      void runAction(
                        `${actionKey}-stop`,
                        () => requestStopPlantGeneration(plant.id),
                        "図鑑生成を停止しました。",
                      )
                    }
                  >
                    {busyKey === `${actionKey}-stop` ? "停止中..." : "停止する"}
                  </button>
                ) : null}
                <Link className="ghost-button" to={`/plants/${plant.id}`}>
                  図鑑詳細へ
                </Link>
              </div>
            </article>
          );
        })}

        {observations.map((observation) => {
          const actionKey = `observation-${observation.id}`;
          return (
            <article className="placeholder-card" key={actionKey}>
              <div className="metric">
                <div>
                  <p className="eyebrow">Observation</p>
                  <h3>{observation.locationLabel || "場所未設定"}</h3>
                </div>
                <span className="status-badge">{formatObservationStatus(observation.status)}</span>
              </div>
              <p className="status-copy">
                {formatElapsedSeconds(observation.createdAt, now, getObservationElapsedEnd(observation)) ??
                  "経過時間なし"}
              </p>
              <p className="status-copy">{observation.errorMessage || "エラーはありません。"}</p>
              <div className="panel-actions">
                {observation.status !== "analyzing" ? (
                  <button
                    className="cta-button"
                    type="button"
                    disabled={busyKey === actionKey || !runtime.aiReady}
                    onClick={() =>
                      void runAction(
                        actionKey,
                        () => startObservationAnalysis(observation.id),
                        "観察の再解析を開始しました。",
                      )
                    }
                  >
                    {busyKey === actionKey ? "処理中..." : "再解析する"}
                  </button>
                ) : null}
                {observation.status === "analyzing" ? (
                  <button
                    className="danger-button"
                    type="button"
                    disabled={busyKey === `${actionKey}-stop`}
                    onClick={() =>
                      void runAction(
                        `${actionKey}-stop`,
                        () => requestStopObservationAnalysis(observation.id),
                        "観察解析を停止しました。",
                      )
                    }
                  >
                    {busyKey === `${actionKey}-stop` ? "停止中..." : "停止する"}
                  </button>
                ) : null}
                {observation.status === "needs_review" ? (
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={busyKey === `${actionKey}-reviewed`}
                    onClick={() =>
                      void runAction(
                        `${actionKey}-reviewed`,
                        async () => {
                          await markObservationReviewed(observation.id);
                          if (observation.plantId) {
                            navigate(`/plants/${observation.plantId}`);
                          }
                        },
                        "観察を確認済みにしました。",
                      )
                    }
                  >
                    {busyKey === `${actionKey}-reviewed` ? "処理中..." : "確認済みにする"}
                  </button>
                ) : null}
                {observation.rawResult ? (
                  <button
                    className="ghost-button"
                    type="button"
                    disabled={busyKey === `${actionKey}-plant` || !runtime.aiReady}
                    onClick={() =>
                      void runAction(
                        `${actionKey}-plant`,
                        async () => {
                          const plant = await buildPlantFromObservation(observation.id);
                          if (plant) {
                            navigate(`/plants/${plant.id}`);
                          } else {
                            throw new Error("解析結果から図鑑化できる植物名を取り出せませんでした。");
                          }
                        },
                        "この観察から図鑑を生成しました。",
                      )
                    }
                  >
                    {busyKey === `${actionKey}-plant`
                      ? "処理中..."
                      : observation.plantId
                        ? "この観察から図鑑を再生成"
                        : "この観察から図鑑を生成"}
                  </button>
                ) : null}
                <Link className="ghost-button" to={`/observations/${observation.id}`}>
                  観察詳細へ
                </Link>
              </div>
            </article>
          );
        })}

        {plants.length === 0 && observations.length === 0 ? (
          <article className="placeholder-card">
            <h3>確認待ちはまだありません</h3>
            <p>図鑑の生成中や観察の確認待ちがここに集まります。</p>
          </article>
        ) : null}
      </div>
    </section>
  );
}
