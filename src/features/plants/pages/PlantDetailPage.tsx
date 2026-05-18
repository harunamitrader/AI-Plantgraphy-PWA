import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useRuntimeStatus } from "../../../app/hooks/useRuntimeStatus";
import { formatElapsedSeconds } from "../../../app/utils/time";
import { loadImageAsset } from "../../../storage/repositories/imagesRepository";
import { loadObservationImages, loadObservationsByPlantId } from "../../../storage/repositories/observationsRepository";
import { getPlant } from "../../../storage/repositories/plantsRepository";
import type { Observation, Plant } from "../../../types/domain";
import { deletePlantWithRelations, requestStopPlantGeneration, startManualPlantGeneration } from "../services/generation";

type RelatedPhoto = {
  id: string;
  observationId: string;
  url: string;
  capturedAt: string | null;
};

function getPlantElapsedEnd(plant: Plant) {
  return plant.profileGenerationStatus === "queued" || plant.profileGenerationStatus === "analyzing"
    ? null
    : plant.profileGenerationUpdatedAt ?? plant.updatedAt;
}

function formatObservationDate(observation: Observation) {
  return observation.capturedAt || observation.createdAt.slice(0, 10);
}

function formatConfidence(confidence: number | null) {
  return confidence === null ? "信頼度 不明" : `信頼度 ${Math.round(confidence * 100)}%`;
}

export function PlantDetailPage() {
  const navigate = useNavigate();
  const runtime = useRuntimeStatus();
  const { plantId } = useParams();
  const [plant, setPlant] = useState<Plant | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [relatedObservations, setRelatedObservations] = useState<Observation[]>([]);
  const [relatedPhotos, setRelatedPhotos] = useState<RelatedPhoto[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function refresh() {
      if (!plantId) {
        return;
      }
      const record = await getPlant(plantId);
      if (mounted) {
        setPlant(record ?? null);
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
  }, [plantId]);

  useEffect(() => {
    let mounted = true;
    let objectUrl: string | null = null;

    async function refreshImage() {
      if (!plant?.representativeImageId) {
        if (mounted) {
          setImageUrl(null);
        }
        return;
      }

      const image = await loadImageAsset(plant.representativeImageId);
      if (!image) {
        if (mounted) {
          setImageUrl(null);
        }
        return;
      }

      objectUrl = URL.createObjectURL(image.blob);
      if (mounted) {
        setImageUrl(objectUrl);
      } else {
        URL.revokeObjectURL(objectUrl);
      }
    }

    void refreshImage();

    return () => {
      mounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [plant]);

  useEffect(() => {
    let mounted = true;
    const objectUrls: string[] = [];

    async function refreshRelatedContent() {
      if (!plantId) {
        return;
      }

      const observations = await loadObservationsByPlantId(plantId);
      const photoEntries = (
        await Promise.all(
          observations.map(async (observation) => {
            const images = await loadObservationImages(observation.id);
            return images
              .filter((image) => image.kind === "thumbnail")
              .map((image) => {
                const url = URL.createObjectURL(image.blob);
                objectUrls.push(url);
                return {
                  id: image.id,
                  observationId: observation.id,
                  url,
                  capturedAt: observation.capturedAt,
                } satisfies RelatedPhoto;
              });
          }),
        )
      )
        .flat()
        .slice(0, 12);

      if (mounted) {
        setRelatedObservations(observations);
        setRelatedPhotos(photoEntries);
      } else {
        objectUrls.forEach((url) => URL.revokeObjectURL(url));
      }
    }

    void refreshRelatedContent();

    return () => {
      mounted = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [plantId]);

  return (
    <section className="panel stack">
      <div>
        <p className="eyebrow">Plant</p>
        <h2>図鑑詳細</h2>
        <p className="status-copy">対象 ID: {plantId ?? "未指定"}</p>
      </div>

      {plant ? (
        <>
          <div className="card-grid">
            <article className="placeholder-card">
              {imageUrl ? <img className="observation-image" src={imageUrl} alt={plant.displayName || "図鑑画像"} /> : null}
              <h3>{plant.displayName || plant.commonNameJa || "名称未設定"}</h3>
              <p className="status-copy">{plant.scientificName ?? "学名未確定"}</p>
              <div className="card-meta">
                <span className="card-chip">{plant.createdFrom === "manual" ? "手動作成" : "観察由来"}</span>
                <span className="card-chip">観察 {relatedObservations.length || plant.observationCount}件</span>
              </div>
              <p className="status-copy">
                {plant.profileGenerationStatus === null
                  ? "生成完了"
                  : `${plant.profileGenerationStatus} / ${
                      formatElapsedSeconds(plant.profileGenerationStartedAt, now, getPlantElapsedEnd(plant)) ??
                      "経過時間なし"
                    }`}
              </p>
              {plant.profileGenerationSeconds !== null ? (
                <p className="status-copy">生成時間 {plant.profileGenerationSeconds.toFixed(1)}秒</p>
              ) : null}
            </article>
            <article className="placeholder-card">
              <h3>アクション</h3>
              <p>再生成はここから実行できます。生成中状態は確認待ちにも反映されます。</p>
              {runtime.aiBlockedReason ? <p className="status-copy">{runtime.aiBlockedReason}</p> : null}
              <div className="panel-actions">
                <button
                  className="cta-button"
                  type="button"
                  disabled={busy || !runtime.aiReady}
                  onClick={async () => {
                    if (!plant) {
                      return;
                    }
                    if (!runtime.aiReady) {
                      setNotice(runtime.aiBlockedReason ?? "AI 機能を使う準備ができていません。");
                      return;
                    }
                    setBusy(true);
                    setNotice("図鑑を再生成しています。");
                    try {
                      await startManualPlantGeneration(plant.id);
                      setNotice("図鑑再生成を開始しました。");
                    } catch (error) {
                      setNotice(error instanceof Error ? error.message : "図鑑再生成に失敗しました。");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? "再生成中..." : "図鑑内容を再生成する"}
                </button>
                {plant.profileGenerationStatus === "analyzing" || plant.profileGenerationStatus === "queued" ? (
                  <button
                    className="danger-button"
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      if (!plant) {
                        return;
                      }
                      setBusy(true);
                      setNotice("図鑑生成の停止を要求しています。");
                      try {
                        await requestStopPlantGeneration(plant.id);
                        setNotice("図鑑生成を停止しました。");
                      } catch (error) {
                        setNotice(error instanceof Error ? error.message : "図鑑生成の停止に失敗しました。");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    図鑑生成を停止する
                  </button>
                ) : null}
                <button
                  className="ghost-button"
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    if (!plant) {
                      return;
                    }
                    setBusy(true);
                    setNotice("図鑑を削除しています。");
                    try {
                      await deletePlantWithRelations(plant.id);
                      navigate("/plants");
                    } catch (error) {
                      setNotice(error instanceof Error ? error.message : "図鑑削除に失敗しました。");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  図鑑を削除する
                </button>
              </div>
            </article>
          </div>
          {notice ? <p className="status-copy">{notice}</p> : null}

          <article className="placeholder-card">
            <p className="eyebrow">Photos</p>
            <h3>関連写真</h3>
            {relatedPhotos.length > 0 ? (
              <div className="plant-photo-grid">
                {relatedPhotos.map((photo) => (
                  <Link className="plant-photo-card" key={photo.id} to={`/observations/${photo.observationId}`}>
                    <img src={photo.url} alt="関連観察画像" />
                    <span>{photo.capturedAt ?? "日付未設定"}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p>この図鑑に紐付いた観察写真はまだありません。</p>
            )}
          </article>

          <article className="placeholder-card">
            <p className="eyebrow">PROFILE</p>
            <h3>基本的な特徴</h3>
            <p>{plant.basicProfileText || "未入力です。"}</p>
          </article>
          <article className="placeholder-card">
            <p className="eyebrow">APPEARANCE</p>
            <h3>見た目の特徴と魅力</h3>
            <p>{plant.visualAppealText || "未入力です。"}</p>
          </article>
          <article className="placeholder-card">
            <p className="eyebrow">CARE</p>
            <h3>手入れメモ</h3>
            <p>{plant.careNotes || "未入力です。"}</p>
          </article>
          <details className="placeholder-card">
            <summary>生成JSONを表示</summary>
            <pre className="status-copy">{JSON.stringify(plant.profileGeneratedJson ?? null, null, 2)}</pre>
          </details>
          <article className="placeholder-card">
            <p className="eyebrow">Timeline</p>
            <h3>観察履歴</h3>
            {relatedObservations.length > 0 ? (
              <div className="timeline-list">
                {relatedObservations.map((observation) => (
                  <Link className="timeline-row" key={observation.id} to={`/observations/${observation.id}`}>
                    <strong>{formatObservationDate(observation)}</strong>
                    <span>{observation.locationLabel || "場所未設定"}</span>
                    <span className="status-copy">
                      {observation.status} / {formatConfidence(observation.confidence)}
                    </span>
                    {observation.note ? <span className="status-copy">{observation.note}</span> : null}
                  </Link>
                ))}
              </div>
            ) : (
              <p>この図鑑に紐付いた観察履歴はまだありません。</p>
            )}
          </article>
          <Link className="ghost-button" to="/plants">
            図鑑一覧へ戻る
          </Link>
        </>
      ) : (
        <article className="placeholder-card">
          <h3>図鑑が見つかりません</h3>
          <p>図鑑一覧から再度開いてください。</p>
        </article>
      )}
    </section>
  );
}
