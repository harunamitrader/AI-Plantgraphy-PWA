import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadObservations } from "../../../storage/repositories/observationsRepository";
import type { Observation } from "../../../types/domain";

type ObservationFilter = "all" | Observation["status"];

function formatConfidence(confidence: number | null) {
  if (confidence === null) {
    return "信頼度 未判定";
  }
  return `信頼度 ${Math.round(confidence * 100)}%`;
}

function extractVisibleFeatures(rawResult: unknown) {
  if (!rawResult || typeof rawResult !== "object") {
    return [];
  }

  const record = rawResult as Record<string, unknown>;
  const candidates = Array.isArray(record.visibleFeatures)
    ? record.visibleFeatures
    : Array.isArray(record.visible_features)
      ? record.visible_features
      : [];

  return candidates
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, 3);
}

function summarizeNote(note: string) {
  const trimmed = note.trim();
  if (!trimmed) {
    return "メモなし";
  }
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}...` : trimmed;
}

function formatObservationStatus(status: Observation["status"]) {
  switch (status) {
    case "queued":
      return "保存済み";
    case "analyzing":
      return "解析中";
    case "analyzed":
      return "解析済み";
    case "needs_review":
      return "確認待ち";
    case "analysis_failed":
      return "失敗";
    default:
      return status;
  }
}

export function ObservationsPage() {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ObservationFilter>("all");

  useEffect(() => {
    let mounted = true;

    async function refresh() {
      const records = await loadObservations();
      if (mounted) {
        setObservations(records);
      }
    }

    void refresh();

    const timer = window.setInterval(() => {
      void refresh();
    }, 1000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const filteredObservations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return observations.filter((observation) => {
      const matchesFilter = filter === "all" ? true : observation.status === filter;
      const matchesQuery = normalizedQuery
        ? [
            observation.locationLabel,
            observation.note,
            observation.capturedAt ?? "",
            observation.createdAt.slice(0, 10),
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery)
        : true;
      return matchesFilter && matchesQuery;
    });
  }, [filter, observations, query]);

  return (
    <section className="panel stack">
      <div className="metric">
        <div>
          <p className="eyebrow">Observations</p>
          <h2>観察一覧</h2>
        </div>
        <strong>
          {filteredObservations.length}/{observations.length}件
        </strong>
      </div>

      <div className="panel-actions">
        <Link className="cta-button" to="/upload">
          観察を追加
        </Link>
        <Link className="secondary-button" to="/review">
          確認待ちを見る
        </Link>
      </div>

      <div className="field-grid">
        <div className="field">
          <label htmlFor="observation-search">検索</label>
          <input
            id="observation-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="場所、メモ、日付で検索"
          />
        </div>
        <div className="field">
          <label htmlFor="observation-filter">状態</label>
          <select
            id="observation-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value as ObservationFilter)}
          >
            <option value="all">すべて</option>
            <option value="queued">保存済み</option>
            <option value="analyzing">解析中</option>
            <option value="analyzed">解析済み</option>
            <option value="needs_review">確認待ち</option>
            <option value="analysis_failed">失敗</option>
          </select>
        </div>
      </div>

      <div className="card-grid">
        {filteredObservations.length > 0 ? (
          filteredObservations.map((observation) => {
            const visibleFeatures = extractVisibleFeatures(observation.rawResult);
            return (
              <article className="placeholder-card" key={observation.id}>
                <p className="eyebrow">Observation</p>
                <h3>{observation.locationLabel || "場所未設定"}</h3>
                <div className="card-meta">
                  <span className="status-badge">{formatObservationStatus(observation.status)}</span>
                  <span className={observation.plantId ? "status-badge" : "status-badge is-danger"}>
                    {observation.plantId ? "図鑑あり" : "図鑑なし"}
                  </span>
                </div>
                <p className="status-copy">
                  {observation.capturedAt ? observation.capturedAt : observation.createdAt.slice(0, 10)}
                </p>
                <p className="status-copy">{formatConfidence(observation.confidence)}</p>
                <p className="card-summary">{summarizeNote(observation.note)}</p>
                {visibleFeatures.length > 0 ? (
                  <div className="card-meta">
                    {visibleFeatures.map((feature) => (
                      <span className="card-chip" key={feature}>
                        {feature}
                      </span>
                    ))}
                  </div>
                ) : null}
                <Link className="ghost-button" to={`/observations/${observation.id}`}>
                  詳細を見る
                </Link>
              </article>
            );
          })
        ) : observations.length === 0 ? (
          <article className="placeholder-card">
            <h3>観察がまだありません</h3>
            <p>画像を追加すると、この一覧に保存されます。</p>
          </article>
        ) : (
          <article className="placeholder-card">
            <h3>該当する観察がありません</h3>
            <p>検索語や状態フィルタを変えてみてください。</p>
          </article>
        )}
      </div>
    </section>
  );
}
