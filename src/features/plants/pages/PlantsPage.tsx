import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useRuntimeStatus } from "../../../app/hooks/useRuntimeStatus";
import { formatElapsedSeconds } from "../../../app/utils/time";
import { loadImageAsset } from "../../../storage/repositories/imagesRepository";
import { startManualPlantGeneration } from "../services/generation";
import {
  createQueuedPlantGeneration,
  loadPlants,
  type PlantGenerationRequest,
} from "../../../storage/repositories/plantsRepository";
import type { Plant } from "../../../types/domain";

type PlantFilter = "all" | "ready" | "in_progress" | "failed";

function formatGenerationStatus(plant: Plant) {
  if (plant.profileGenerationStatus === "queued") {
    return "生成中";
  }
  if (plant.profileGenerationStatus === "analyzing") {
    return "解析中";
  }
  if (plant.profileGenerationStatus === "analysis_failed") {
    return "失敗";
  }
  return "完成";
}

function getStatusBadgeClassName(plant: Plant) {
  return plant.profileGenerationStatus === "analysis_failed"
    ? "status-badge is-danger"
    : "status-badge";
}

function formatCreatedFrom(createdFrom: Plant["createdFrom"]) {
  return createdFrom === "manual" ? "手動作成" : "観察由来";
}

function formatObservationCount(count: number) {
  return `観察 ${count}件`;
}

function getPlantElapsedEnd(plant: Plant) {
  return plant.profileGenerationStatus === "queued" || plant.profileGenerationStatus === "analyzing"
    ? null
    : plant.profileGenerationUpdatedAt ?? plant.updatedAt;
}

function summarizeProfile(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return "図鑑本文はこれから生成されます。";
  }
  return trimmed.length > 68 ? `${trimmed.slice(0, 68)}...` : trimmed;
}

export function PlantsPage() {
  const runtime = useRuntimeStatus();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PlantFilter>("all");

  useEffect(() => {
    let mounted = true;

    async function refresh() {
      const records = await loadPlants();
      if (mounted) {
        setPlants(records);
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

  useEffect(() => {
    let mounted = true;
    const objectUrls: string[] = [];

    async function refreshImageUrls() {
      const entries = await Promise.all(
        plants.map(async (plant) => {
          if (!plant.representativeImageId) {
            return [plant.id, ""] as const;
          }
          const image = await loadImageAsset(plant.representativeImageId);
          if (!image) {
            return [plant.id, ""] as const;
          }
          const url = URL.createObjectURL(image.blob);
          objectUrls.push(url);
          return [plant.id, url] as const;
        }),
      );

      if (!mounted) {
        objectUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      setImageUrls(
        Object.fromEntries(entries.filter((entry) => entry[1])),
      );
    }

    void refreshImageUrls();

    return () => {
      mounted = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [plants]);

  const inProgressPlants = useMemo(
    () =>
      plants.filter(
        (plant) =>
          plant.profileGenerationStatus === "queued" || plant.profileGenerationStatus === "analyzing",
      ),
    [plants],
  );

  const filteredPlants = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return plants.filter((plant) => {
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "ready"
            ? plant.profileGenerationStatus === null
            : filter === "in_progress"
              ? plant.profileGenerationStatus === "queued" || plant.profileGenerationStatus === "analyzing"
              : plant.profileGenerationStatus === "analysis_failed";
      const matchesQuery = normalizedQuery
        ? [plant.displayName, plant.commonNameJa ?? "", plant.scientificName ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery)
        : true;
      return matchesFilter && matchesQuery;
    });
  }, [filter, plants, query]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!runtime.aiReady) {
      setNotice(runtime.aiBlockedReason ?? "AI 機能を使う準備ができていません。");
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      setNotice("植物名を入力してください。");
      return;
    }

    setBusy(true);
    try {
      const request: PlantGenerationRequest = { commonNameJa: trimmed };
      const result = await createQueuedPlantGeneration(request);
      if (result.kind === "exists") {
        setNotice("既存の図鑑があります。");
        setPlants((current) =>
          [result.plant, ...current.filter((item) => item.id !== result.plant.id)].sort((a, b) =>
            b.updatedAt.localeCompare(a.updatedAt),
          ),
        );
      } else {
        setNotice("図鑑生成を登録しました。確認待ちで進行状況を確認できます。");
        setPlants((current) => [result.plant, ...current]);
        void startManualPlantGeneration(result.plant.id);
      }
      setName("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "図鑑生成の登録に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack">
      <article className="panel stack">
        <div>
          <p className="eyebrow">Library</p>
          <h2>名前から図鑑を生成</h2>
          <p className="status-copy">
            和名だけ入力して図鑑生成を登録します。生成中の図鑑はリロード後も確認待ちに残ります。
          </p>
          {runtime.aiBlockedReason ? <p className="status-copy">{runtime.aiBlockedReason}</p> : null}
        </div>
        <form className="field-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="plant-name">植物名</label>
            <input
              id="plant-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例: ヒトリシズカ"
            />
          </div>
          <div className="panel-actions">
            <button className="cta-button" type="submit" disabled={busy || !runtime.aiReady}>
              {busy ? "登録中..." : "図鑑を生成する"}
            </button>
            <Link className="secondary-button" to="/review">
              確認待ちを見る
            </Link>
          </div>
        </form>
        {notice ? <p className="status-copy">{notice}</p> : null}
      </article>

      <article className="panel stack">
        <div className="metric">
          <div>
            <p className="eyebrow">Inventory</p>
            <h2>図鑑一覧</h2>
          </div>
          <strong>
            {filteredPlants.length}/{plants.length}件
          </strong>
        </div>
        <div className="field-grid">
          <div className="field">
            <label htmlFor="plant-search">検索</label>
            <input
              id="plant-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="和名、学名、表示名で検索"
            />
          </div>
          <div className="field">
            <label htmlFor="plant-filter">状態</label>
            <select
              id="plant-filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value as PlantFilter)}
            >
              <option value="all">すべて</option>
              <option value="ready">生成完了</option>
              <option value="in_progress">生成中</option>
              <option value="failed">失敗</option>
            </select>
          </div>
        </div>
        {inProgressPlants.length > 0 ? (
          <div className="status-grid">
            {inProgressPlants.map((plant) => (
              <article className="placeholder-card" key={plant.id}>
                <p className="eyebrow">進行中</p>
                <h3>{plant.displayName || plant.commonNameJa || "名称未設定"}</h3>
                <p className="status-copy">{formatGenerationStatus(plant)}</p>
                <p className="status-copy">
                  {formatElapsedSeconds(plant.profileGenerationStartedAt, now) ?? "経過時間なし"}
                </p>
              </article>
            ))}
          </div>
        ) : null}
        <div className="card-grid">
          {filteredPlants.length > 0 ? (
            filteredPlants.map((plant) => (
              <article className="placeholder-card" key={plant.id}>
                {imageUrls[plant.id] ? (
                  <img className="observation-image" src={imageUrls[plant.id]} alt={plant.displayName || "図鑑画像"} />
                ) : null}
                <p className="eyebrow">図鑑</p>
                <h3>{plant.displayName || plant.commonNameJa || "名称未設定"}</h3>
                <p className="status-copy">{plant.scientificName ?? "学名未確定"}</p>
                <div className="card-meta">
                  <span className={getStatusBadgeClassName(plant)}>{formatGenerationStatus(plant)}</span>
                  <span className="card-chip">{formatCreatedFrom(plant.createdFrom)}</span>
                  <span className="card-chip">{formatObservationCount(plant.observationCount)}</span>
                </div>
                {plant.profileGenerationStatus ? (
                  <p className="status-copy">
                    {formatElapsedSeconds(plant.profileGenerationStartedAt, now, getPlantElapsedEnd(plant)) ??
                      "経過時間なし"}
                  </p>
                ) : plant.profileGenerationSeconds !== null ? (
                  <p className="status-copy">生成時間 {plant.profileGenerationSeconds.toFixed(1)}秒</p>
                ) : null}
                <p className="card-summary">{summarizeProfile(plant.basicProfileText)}</p>
                <Link className="ghost-button" to={`/plants/${plant.id}`}>
                  詳細を見る
                </Link>
              </article>
            ))
          ) : plants.length === 0 ? (
            <article className="placeholder-card">
              <h3>まだ図鑑がありません</h3>
              <p>和名を入力して最初の図鑑生成を登録してください。</p>
            </article>
          ) : (
            <article className="placeholder-card">
              <h3>該当する図鑑がありません</h3>
              <p>検索語や状態フィルタを変えてみてください。</p>
            </article>
          )}
        </div>
      </article>
    </section>
  );
}
