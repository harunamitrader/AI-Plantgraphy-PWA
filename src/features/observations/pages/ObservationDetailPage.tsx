import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useRuntimeStatus } from "../../../app/hooks/useRuntimeStatus";
import { loadObservationImages, getObservation } from "../../../storage/repositories/observationsRepository";
import type { Observation } from "../../../types/domain";
import { buildPlantFromObservation } from "../../plants/services/generation";

type ObservationImageView = {
  id: string;
  url: string;
  kind: "original" | "thumbnail";
};

export function ObservationDetailPage() {
  const navigate = useNavigate();
  const runtime = useRuntimeStatus();
  const { observationId } = useParams();
  const [observation, setObservation] = useState<Observation | null>(null);
  const [images, setImages] = useState<ObservationImageView[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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
              <p className="status-copy">{observation.status}</p>
              <p className="status-copy">{observation.capturedAt ?? observation.createdAt}</p>
              <p className="status-copy">
                経過 {Math.max(0, Math.floor((now - new Date(observation.createdAt).getTime()) / 1000))}秒
              </p>
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
            <p className="eyebrow">State</p>
            <h3>進行管理</h3>
            <p>
              保存済みの観察として一覧と確認待ちに連携されています。AI 解析が進むとここに結果が表示されます。
            </p>
            {runtime.aiBlockedReason ? <p className="status-copy">{runtime.aiBlockedReason}</p> : null}
            <div className="panel-actions">
              {observation.plantId ? (
                <Link className="secondary-button" to={`/plants/${observation.plantId}`}>
                  関連図鑑を見る
                </Link>
              ) : null}
              {observation.rawResult ? (
                <button
                  className="cta-button"
                  type="button"
                  disabled={busy || !runtime.aiReady}
                  onClick={async () => {
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
                  }}
                >
                  {busy
                    ? "生成中..."
                    : observation.plantId
                      ? "この観察から図鑑を再生成する"
                      : "この観察から図鑑を生成する"}
                </button>
              ) : null}
            </div>
          </article>
          {notice ? <p className="status-copy">{notice}</p> : null}

          {observation.rawResult ? (
            <details className="placeholder-card">
              <summary>解析JSONを表示</summary>
              <pre className="status-copy">{JSON.stringify(observation.rawResult, null, 2)}</pre>
            </details>
          ) : null}

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
