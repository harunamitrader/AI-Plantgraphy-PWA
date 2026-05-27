import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useRuntimeStatus } from "../../../app/hooks/useRuntimeStatus";
import { formatElapsedSeconds } from "../../../app/utils/time";
import { requestStopObservationAnalysis, startObservationAnalysis } from "../../observations/services/analysis";
import { loadJobs } from "../../../storage/repositories/jobsRepository";
import {
  loadObservations,
  markObservationReviewed,
} from "../../../storage/repositories/observationsRepository";
import { loadPlants } from "../../../storage/repositories/plantsRepository";
import type { AnalysisJob, Observation, Plant } from "../../../types/domain";
import {
  buildPlantFromObservation,
  requestStopPlantGeneration,
  startManualPlantGeneration,
} from "../../plants/services/generation";

type ReviewKindFilter = "all" | "plant" | "observation";
type ReviewStateFilter = "all" | "in_progress" | "needs_review" | "failed";

type ReviewObservationSummary = {
  commonNameJa: string | null;
  scientificName: string | null;
  uncertaintyNotes: string;
  candidateTexts: string[];
};

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

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function toText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeCandidateText(value: unknown) {
  const item = asRecord(value);
  const commonNameJa = toText(item.commonNameJa ?? item.common_name_ja ?? item.common_name ?? item.plant_name);
  const scientificName = toText(item.scientificName ?? item.scientific_name);
  const reason = toText(item.reason);
  const confidence = toNumber(item.confidence);

  return [commonNameJa, scientificName, reason, confidence !== null ? `${Math.round(confidence * 100)}%` : null]
    .filter((item): item is string => Boolean(item))
    .join(" ");
}

function normalizeObservationSummary(rawResult: unknown | null): ReviewObservationSummary {
  const root = asRecord(rawResult);
  const identification = asRecord(root.plant_identification ?? root.plantIdentification);
  const base = Object.keys(identification).length > 0 ? identification : root;
  const candidateTexts = [root.candidates, root.ai_candidates, identification.candidates]
    .flatMap((source) => (Array.isArray(source) ? source : []))
    .map(normalizeCandidateText)
    .filter((item) => item.length > 0);

  return {
    commonNameJa: toText(
      root.commonNameJa ??
        root.common_name_ja ??
        root.common_name ??
        root.plant_name ??
        base.commonNameJa ??
        base.common_name_ja ??
        base.common_name ??
        base.plant_name,
    ),
    scientificName: toText(
      root.scientificName ?? root.scientific_name ?? base.scientificName ?? base.scientific_name,
    ),
    uncertaintyNotes:
      toText(root.uncertaintyNotes ?? root.uncertainty_notes ?? base.uncertaintyNotes ?? base.uncertainty_notes) ??
      "",
    candidateTexts,
  };
}

function matchesPlantStateFilter(plant: Plant, stateFilter: ReviewStateFilter) {
  if (stateFilter === "all") {
    return true;
  }
  if (stateFilter === "in_progress") {
    return plant.profileGenerationStatus === "queued" || plant.profileGenerationStatus === "analyzing";
  }
  if (stateFilter === "failed") {
    return plant.profileGenerationStatus === "analysis_failed";
  }
  return false;
}

function matchesObservationStateFilter(observation: Observation, stateFilter: ReviewStateFilter) {
  if (stateFilter === "all") {
    return true;
  }
  if (stateFilter === "in_progress") {
    return observation.status === "queued" || observation.status === "analyzing";
  }
  if (stateFilter === "needs_review") {
    return observation.status === "needs_review";
  }
  return observation.status === "analysis_failed";
}

function buildPlantSearchText(plant: Plant, job: AnalysisJob | null) {
  return [
    plant.displayName,
    plant.commonNameJa ?? "",
    plant.scientificName ?? "",
    plant.profileGenerationErrorMessage ?? "",
    job?.label ?? "",
    job?.errorMessage ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function buildObservationSearchText(
  observation: Observation,
  summary: ReviewObservationSummary,
  job: AnalysisJob | null,
) {
  return [
    summary.commonNameJa ?? "",
    summary.scientificName ?? "",
    summary.uncertaintyNotes,
    summary.candidateTexts.join(" "),
    observation.locationLabel,
    observation.note,
    observation.errorMessage,
    job?.label ?? "",
    job?.errorMessage ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

export function ReviewPage() {
  const navigate = useNavigate();
  const runtime = useRuntimeStatus();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [jobs, setJobs] = useState<AnalysisJob[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<ReviewKindFilter>("all");
  const [stateFilter, setStateFilter] = useState<ReviewStateFilter>("all");

  useEffect(() => {
    let mounted = true;

    async function refresh() {
      const [plantRecords, observationRecords, jobRecords] = await Promise.all([
        loadPlants(),
        loadObservations(),
        loadJobs(),
      ]);
      if (mounted) {
        setPlants(plantRecords.filter(isReviewPlant));
        setObservations(observationRecords.filter(isReviewObservation));
        setJobs(jobRecords);
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

  const plantJobsById = useMemo(
    () =>
      new Map(
        jobs
          .filter((job): job is AnalysisJob & { plantId: string } => typeof job.plantId === "string")
          .map((job) => [job.plantId, job]),
      ),
    [jobs],
  );

  const observationJobsById = useMemo(
    () =>
      new Map(
        jobs
          .filter((job): job is AnalysisJob & { observationId: string } => typeof job.observationId === "string")
          .map((job) => [job.observationId, job]),
      ),
    [jobs],
  );

  const filteredPlants = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return plants.filter((plant) => {
      if (kindFilter === "observation") {
        return false;
      }
      if (!matchesPlantStateFilter(plant, stateFilter)) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return buildPlantSearchText(plant, plantJobsById.get(plant.id) ?? null).includes(normalizedQuery);
    });
  }, [kindFilter, plantJobsById, plants, query, stateFilter]);

  const filteredObservations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return observations.filter((observation) => {
      if (kindFilter === "plant") {
        return false;
      }
      if (!matchesObservationStateFilter(observation, stateFilter)) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      const summary = normalizeObservationSummary(observation.rawResult);
      return buildObservationSearchText(
        observation,
        summary,
        observationJobsById.get(observation.id) ?? null,
      ).includes(normalizedQuery);
    });
  }, [kindFilter, observationJobsById, observations, query, stateFilter]);

  const plantCounts = useMemo(() => {
    return {
      queued: filteredPlants.filter((plant) => plant.profileGenerationStatus === "queued").length,
      analyzing: filteredPlants.filter((plant) => plant.profileGenerationStatus === "analyzing").length,
      failed: filteredPlants.filter((plant) => plant.profileGenerationStatus === "analysis_failed").length,
    };
  }, [filteredPlants]);

  const observationCounts = useMemo(() => {
    return {
      queued: filteredObservations.filter((item) => item.status === "queued").length,
      analyzing: filteredObservations.filter((item) => item.status === "analyzing").length,
      needsReview: filteredObservations.filter((item) => item.status === "needs_review").length,
      failed: filteredObservations.filter((item) => item.status === "analysis_failed").length,
    };
  }, [filteredObservations]);

  const totalCount = plants.length + observations.length;
  const filteredCount = filteredPlants.length + filteredObservations.length;

  async function refreshLists() {
    const [plantRecords, observationRecords, jobRecords] = await Promise.all([
      loadPlants(),
      loadObservations(),
      loadJobs(),
    ]);
    setPlants(plantRecords.filter(isReviewPlant));
    setObservations(observationRecords.filter(isReviewObservation));
    setJobs(jobRecords);
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
      <div className="metric">
        <div>
          <p className="eyebrow">Review</p>
          <h2>確認待ち</h2>
          <p className="status-copy">
            生成中・確認待ち・失敗中をまとめて確認し、その場で再解析や図鑑再生成を実行できます。
          </p>
          {runtime.aiBlockedReason ? <p className="status-copy">{runtime.aiBlockedReason}</p> : null}
        </div>
        <strong>
          {filteredCount}/{totalCount}件
        </strong>
      </div>

      {notice ? <p className="status-copy">{notice}</p> : null}

      <div className="field-grid">
        <div className="field">
          <label htmlFor="review-search">検索</label>
          <input
            id="review-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="植物名、学名、場所、メモ、エラーで検索"
          />
        </div>
        <div className="field">
          <label htmlFor="review-kind-filter">種別</label>
          <select
            id="review-kind-filter"
            value={kindFilter}
            onChange={(event) => setKindFilter(event.target.value as ReviewKindFilter)}
          >
            <option value="all">すべて</option>
            <option value="observation">観察</option>
            <option value="plant">図鑑</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="review-state-filter">状態</label>
          <select
            id="review-state-filter"
            value={stateFilter}
            onChange={(event) => setStateFilter(event.target.value as ReviewStateFilter)}
          >
            <option value="all">すべて</option>
            <option value="in_progress">生成中・解析中</option>
            <option value="needs_review">確認待ち</option>
            <option value="failed">失敗</option>
          </select>
        </div>
      </div>

      <div className="status-grid">
        <article className="placeholder-card">
          <p className="eyebrow">図鑑</p>
          <h3>
            {filteredPlants.length}/{plants.length}件
          </h3>
          <p className="status-copy">
            生成中 {plantCounts.queued + plantCounts.analyzing} / 失敗 {plantCounts.failed}
          </p>
        </article>
        <article className="placeholder-card">
          <p className="eyebrow">観察</p>
          <h3>
            {filteredObservations.length}/{observations.length}件
          </h3>
          <p className="status-copy">
            保存済み {observationCounts.queued} / 解析中 {observationCounts.analyzing} / 確認待ち{" "}
            {observationCounts.needsReview} / 失敗 {observationCounts.failed}
          </p>
        </article>
      </div>

      <div className="stack">
        {filteredPlants.map((plant) => {
          const actionKey = `plant-${plant.id}`;
          const job = plantJobsById.get(plant.id) ?? null;
          const plantError = plant.profileGenerationErrorMessage ?? job?.errorMessage ?? "";
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
              <p className="status-copy">{plant.scientificName ?? "学名未設定"}</p>
              {job?.label ? <p className="status-copy">{job.label}</p> : null}
              {plantError ? <p className="status-copy">{plantError}</p> : null}
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

        {filteredObservations.map((observation) => {
          const actionKey = `observation-${observation.id}`;
          const summary = normalizeObservationSummary(observation.rawResult);
          const job = observationJobsById.get(observation.id) ?? null;
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
              <p className="status-copy">
                {[summary.commonNameJa ?? "植物名未判定", summary.scientificName ?? "学名未判定"].join(" / ")}
              </p>
              {job?.label ? <p className="status-copy">{job.label}</p> : null}
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

        {filteredCount === 0 ? (
          <article className="placeholder-card">
            <h3>{totalCount === 0 ? "確認待ちはまだありません" : "該当する項目がありません"}</h3>
            <p>
              {totalCount === 0
                ? "図鑑の生成中や観察の確認待ちがここに集まります。"
                : "検索語や種別・状態フィルタを変えてみてください。"}
            </p>
          </article>
        ) : null}
      </div>
    </section>
  );
}
