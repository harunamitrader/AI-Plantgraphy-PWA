import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useRuntimeStatus } from "../../../app/hooks/useRuntimeStatus";
import { formatElapsedSeconds } from "../../../app/utils/time";
import {
  deleteObservation,
  getObservation,
  loadObservationImages,
  updateObservationManualCorrection,
} from "../../../storage/repositories/observationsRepository";
import type { Observation } from "../../../types/domain";
import { buildPlantFromObservation } from "../../plants/services/generation";
import { startObservationAnalysis } from "../services/analysis";

type ObservationImageView = {
  id: string;
  url: string;
  kind: "original" | "thumbnail";
};

type CandidateView = {
  commonNameJa: string | null;
  scientificName: string | null;
  confidence: number | null;
  reason: string;
};

type SummaryView = {
  commonNameJa: string | null;
  scientificName: string | null;
  confidence: number | null;
  candidates: CandidateView[];
  visibleFeatures: string[];
  uncertaintyNotes: string;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function toText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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

function normalizeCandidate(value: unknown): CandidateView | null {
  const item = asRecord(value);
  const commonNameJa = toText(item.commonNameJa ?? item.common_name_ja ?? item.common_name ?? item.plant_name);
  const scientificName = toText(item.scientificName ?? item.scientific_name);
  const confidence = toNumber(item.confidence);
  const reason = toText(item.reason) ?? "";

  if (!commonNameJa && !scientificName && confidence === null && !reason) {
    return null;
  }

  return { commonNameJa, scientificName, confidence, reason };
}

function normalizeSummary(rawResult: unknown | null): SummaryView {
  const root = asRecord(rawResult);
  const identification = asRecord(root.plant_identification ?? root.plantIdentification);
  const details = asRecord(root.observation_details ?? root.observationDetails);
  const base = Object.keys(identification).length > 0 ? identification : root;
  const candidates = collectCandidateSources(root, identification);
  const visibleFeatures = [
    ...collectTexts(root.visibleFeatures ?? root.visible_features),
    ...collectTexts(root.characteristics),
    ...collectTexts(details.characteristics),
  ];

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
    scientificName: toText(root.scientificName ?? root.scientific_name ?? base.scientificName ?? base.scientific_name),
    confidence: toNumber(root.confidence ?? base.confidence),
    candidates,
    visibleFeatures: Array.from(new Set(visibleFeatures)).slice(0, 12),
    uncertaintyNotes:
      toText(root.uncertaintyNotes ?? root.uncertainty_notes ?? base.uncertaintyNotes ?? base.uncertainty_notes) ?? "",
  };
}

function collectCandidateSources(root: Record<string, unknown>, identification: Record<string, unknown>) {
  return [root.candidates, root.ai_candidates, identification.candidates]
    .flatMap((source) => (Array.isArray(source) ? source : []))
    .map(normalizeCandidate)
    .filter((candidate): candidate is CandidateView => candidate !== null);
}

function formatConfidence(confidence: number | null) {
  if (confidence === null) {
    return "不明";
  }
  return `${Math.round(confidence * 100)}%`;
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

export function ObservationDetailPage() {
  const navigate = useNavigate();
  const runtime = useRuntimeStatus();
  const { observationId } = useParams();
  const [observation, setObservation] = useState<Observation | null>(null);
  const [images, setImages] = useState<ObservationImageView[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const formObservationIdRef = useRef<string | null>(null);
  const [manualCommonName, setManualCommonName] = useState("");
  const [manualScientificName, setManualScientificName] = useState("");
  const [manualLocation, setManualLocation] = useState("");
  const [manualNote, setManualNote] = useState("");

  function initializeManualForm(record: Observation) {
    if (formObservationIdRef.current === record.id) {
      return;
    }

    const nextSummary = normalizeSummary(record.rawResult);
    formObservationIdRef.current = record.id;
    setManualCommonName(nextSummary.commonNameJa ?? "");
    setManualScientificName(nextSummary.scientificName ?? "");
    setManualLocation(record.locationLabel);
    setManualNote(record.note);
  }

  useEffect(() => {
    let mounted = true;
    const objectUrls: string[] = [];

    async function refresh() {
      if (!observationId) {
        return;
      }

      const record = await getObservation(observationId);
      const imageRecords = await loadObservationImages(observationId);
      const nextImages = imageRecords.map((image) => {
        const url = URL.createObjectURL(image.blob);
        objectUrls.push(url);
        return { id: image.id, url, kind: image.kind };
      });

      if (mounted) {
        setObservation(record ?? null);
        setImages(nextImages);
        if (record) {
          initializeManualForm(record);
        }
      } else {
        objectUrls.forEach((url) => URL.revokeObjectURL(url));
      }
    }

    void refresh();

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      mounted = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      window.clearInterval(timer);
    };
  }, [observationId]);

  useEffect(() => {
    let mounted = true;

    async function refreshObservation() {
      if (!observationId) {
        return;
      }

      const record = await getObservation(observationId);
      if (mounted) {
        setObservation(record ?? null);
        if (record) {
          initializeManualForm(record);
        }
      }
    }

    void refreshObservation();

    const timer = window.setInterval(() => {
      setNow(Date.now());
      void refreshObservation();
    }, 1000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [observationId]);

  const previewImages = useMemo(
    () => images.filter((image) => image.kind === "thumbnail"),
    [images],
  );
  const summary = useMemo(() => normalizeSummary(observation?.rawResult ?? null), [observation?.rawResult]);

  async function refreshCurrentObservation() {
    if (!observationId) {
      return;
    }
    const record = await getObservation(observationId);
    setObservation(record ?? null);
  }

  async function handleReanalysis() {
    if (!observation) {
      return;
    }
    if (!runtime.aiReady) {
      setNotice(runtime.aiBlockedReason ?? "AI 機能を使う準備ができていません。");
      return;
    }

    setBusy(true);
    setNotice("観察を再解析しています。");
    try {
      await startObservationAnalysis(observation.id);
      await refreshCurrentObservation();
      setNotice("観察の再解析が完了しました。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "観察の再解析に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function handleManualCorrection() {
    if (!observation) {
      return;
    }

    setBusy(true);
    setNotice("手動補正を保存しています。");
    try {
      const updated = await updateObservationManualCorrection(observation.id, {
        commonNameJa: manualCommonName,
        scientificName: manualScientificName,
        locationLabel: manualLocation,
        note: manualNote,
      });
      setObservation(updated);
      setNotice("手動補正を保存しました。必要ならこの観察から図鑑を生成してください。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "手動補正に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function handleBuildPlant() {
    if (!observation) {
      return;
    }
    if (!runtime.aiReady) {
      setNotice(runtime.aiBlockedReason ?? "AI 機能を使う準備ができていません。");
      return;
    }

    setBusy(true);
    setNotice(
      observation.plantId
        ? "この観察をもとに図鑑を再生成しています。"
        : "この観察をもとに図鑑を生成しています。",
    );
    try {
      const plant = await buildPlantFromObservation(observation.id);
      if (plant) {
        setNotice("図鑑を生成しました。");
        navigate(`/plants/${plant.id}`);
      } else {
        setNotice("解析結果から図鑑化できる植物名を取り出せませんでした。");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "図鑑生成に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!observation) {
      return;
    }
    const confirmed = window.confirm("この観察を削除します。保存した画像も削除されます。");
    if (!confirmed) {
      return;
    }

    setBusy(true);
    try {
      await deleteObservation(observation.id);
      navigate("/observations");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "観察の削除に失敗しました。");
      setBusy(false);
    }
  }

  return (
    <section className="panel stack">
      <div>
        <p className="eyebrow">Observation</p>
        <h2>観察詳細</h2>
        <p className="status-copy">対象 ID: {observationId ?? "未指定"}</p>
      </div>

      {observation ? (
        <>
          <div className="card-grid">
            <article className="placeholder-card">
              <h3>{observation.locationLabel || "場所未設定"}</h3>
              <p className="status-copy">{formatObservationStatus(observation.status)}</p>
              <p className="status-copy">{observation.capturedAt ?? observation.createdAt}</p>
              <p className="status-copy">
                {formatElapsedSeconds(observation.createdAt, now, getObservationElapsedEnd(observation)) ??
                  "経過時間なし"}
              </p>
              {observation.errorMessage ? <p className="status-copy">{observation.errorMessage}</p> : null}
            </article>
            <article className="placeholder-card">
              <h3>メモ</h3>
              <p>{observation.note || "メモはありません。"}</p>
            </article>
          </div>

          <div className="card-grid">
            {previewImages.map((image) => (
              <article className="placeholder-card" key={image.id}>
                <img className="observation-image" src={image.url} alt="観察画像" />
              </article>
            ))}
          </div>

          <article className="placeholder-card">
            <p className="eyebrow">Identity</p>
            <h3>解析結果</h3>
            <p className="status-copy">信頼度 {formatConfidence(observation.confidence ?? summary.confidence)}</p>
            <p>{summary.commonNameJa || "植物名未確定"}</p>
            <p className="status-copy">{summary.scientificName || "学名未確定"}</p>
          </article>

          <div className="card-grid">
            <article className="placeholder-card">
              <p className="eyebrow">Features</p>
              <h3>見えている特徴</h3>
              <div className="panel-actions">
                {summary.visibleFeatures.length > 0 ? (
                  summary.visibleFeatures.map((feature) => (
                    <span className="card-chip" key={feature}>
                      {feature}
                    </span>
                  ))
                ) : (
                  <span className="card-chip">特徴メモなし</span>
                )}
              </div>
            </article>
            <article className="placeholder-card">
              <p className="eyebrow">Notes</p>
              <h3>不確実な点</h3>
              <p>{summary.uncertaintyNotes || "不確実な点は記録されていません。"}</p>
            </article>
          </div>

          <article className="placeholder-card">
            <p className="eyebrow">Candidates</p>
            <h3>候補</h3>
            {summary.candidates.length > 0 ? (
              <div className="stack">
                {summary.candidates.map((candidate, index) => (
                  <div className="candidate-row" key={`${candidate.commonNameJa ?? "candidate"}-${index}`}>
                    <strong>{candidate.commonNameJa || "名称未設定"}</strong>
                    <span className="status-copy">
                      {candidate.scientificName || "学名未設定"} / {formatConfidence(candidate.confidence)}
                    </span>
                    {candidate.reason ? <span className="status-copy">{candidate.reason}</span> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="status-copy">候補はありません。</p>
            )}
          </article>

          <article className="placeholder-card">
            <p className="eyebrow">Actions</p>
            <h3>再解析・図鑑生成</h3>
            <p>
              解析が不十分な場合は再解析できます。植物名を手動補正した後でも、この観察から図鑑を生成できます。
            </p>
            {runtime.aiBlockedReason ? <p className="status-copy">{runtime.aiBlockedReason}</p> : null}
            <div className="panel-actions">
              <button
                className="cta-button"
                type="button"
                disabled={busy || observation.status === "analyzing" || !runtime.aiReady}
                onClick={() => void handleReanalysis()}
              >
                {busy ? "処理中..." : "観察を再解析する"}
              </button>
              {observation.rawResult ? (
                <button
                  className="secondary-button"
                  type="button"
                  disabled={busy || !runtime.aiReady}
                  onClick={() => void handleBuildPlant()}
                >
                  {busy
                    ? "生成中..."
                    : observation.plantId
                      ? "この観察から図鑑を再生成する"
                      : "この観察から図鑑を生成する"}
                </button>
              ) : null}
              {observation.plantId ? (
                <Link className="ghost-button" to={`/plants/${observation.plantId}`}>
                  関連図鑑を見る
                </Link>
              ) : null}
            </div>
          </article>

          <article className="placeholder-card">
            <p className="eyebrow">Correction</p>
            <h3>手動補正</h3>
            <div className="field-grid">
              <label className="field">
                <span>植物名</span>
                <input
                  value={manualCommonName}
                  onChange={(event) => setManualCommonName(event.target.value)}
                  placeholder="例: ヒトリシズカ"
                />
              </label>
              <label className="field">
                <span>学名</span>
                <input
                  value={manualScientificName}
                  onChange={(event) => setManualScientificName(event.target.value)}
                  placeholder="例: Chloranthus quadrifolius"
                />
              </label>
              <label className="field">
                <span>場所</span>
                <input value={manualLocation} onChange={(event) => setManualLocation(event.target.value)} />
              </label>
              <label className="field">
                <span>メモ</span>
                <textarea rows={3} value={manualNote} onChange={(event) => setManualNote(event.target.value)} />
              </label>
            </div>
            <div className="panel-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={busy}
                onClick={() => void handleManualCorrection()}
              >
                手動補正を保存する
              </button>
            </div>
          </article>

          {notice ? <p className="status-copy">{notice}</p> : null}

          {observation.rawResult ? (
            <details className="placeholder-card">
              <summary>解析JSONを表示</summary>
              <pre className="status-copy">{JSON.stringify(observation.rawResult, null, 2)}</pre>
            </details>
          ) : null}

          <article className="placeholder-card danger-card">
            <p className="eyebrow">Delete</p>
            <h3>この観察を削除</h3>
            <p>観察レコードと保存画像を削除します。関連図鑑は削除しません。</p>
            <div className="panel-actions">
              <button className="danger-button" type="button" disabled={busy} onClick={() => void handleDelete()}>
                観察を削除する
              </button>
            </div>
          </article>

          <Link className="ghost-button" to="/observations">
            観察一覧へ戻る
          </Link>
        </>
      ) : (
        <article className="placeholder-card">
          <h3>観察が見つかりません</h3>
          <p>観察一覧から再度開いてください。</p>
        </article>
      )}
    </section>
  );
}
