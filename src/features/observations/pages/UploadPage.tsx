import { useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useSettingsStore } from "../../settings/store/useSettingsStore";
import { useRuntimeStatus } from "../../../app/hooks/useRuntimeStatus";
import { createObservation } from "../../../storage/repositories/observationsRepository";
import { startObservationAnalysis } from "../services/analysis";

export function UploadPage() {
  const navigate = useNavigate();
  const runtime = useRuntimeStatus();
  const locationLabels = useSettingsStore((state) => state.locationLabels);
  const [files, setFiles] = useState<File[]>([]);
  const [capturedAt, setCapturedAt] = useState("");
  const [locationLabel, setLocationLabel] = useState(locationLabels[0] ?? "");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files ?? []).slice(0, 3);
    setFiles(nextFiles);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const observation = await createObservation({
        note,
        locationLabel,
        capturedAt: capturedAt || null,
        files,
      });
      if (runtime.aiReady) {
        setNotice("観察を保存しました。AI解析を開始しています。");
        void startObservationAnalysis(observation.id);
      } else {
        setNotice(
          runtime.aiBlockedReason
            ? `観察は保存しました。${runtime.aiBlockedReason} 確認待ちからあとで再解析できます。`
            : "観察を保存しました。確認待ちからあとで解析できます。",
        );
      }
      navigate(`/observations/${observation.id}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "観察の保存に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel stack">
      <div>
        <p className="eyebrow">Upload</p>
        <h2>観察を追加</h2>
        <p className="status-copy">
          画像 1〜3 枚、撮影日、場所、メモを端末内に保存します。保存後は一覧と確認待ちに反映されます。
        </p>
        {runtime.aiBlockedReason ? <p className="status-copy">{runtime.aiBlockedReason}</p> : null}
      </div>

      <form className="field-grid" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="observation-files">画像</label>
          <input id="observation-files" type="file" accept="image/*" multiple onChange={handleFileChange} />
          <p className="field-help">{files.length} 枚選択中</p>
        </div>

        <div className="field">
          <label htmlFor="captured-at">撮影日</label>
          <input
            id="captured-at"
            type="date"
            value={capturedAt}
            onChange={(event) => setCapturedAt(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="location-label">場所</label>
          <select id="location-label" value={locationLabel} onChange={(event) => setLocationLabel(event.target.value)}>
            {locationLabels.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="observation-note">メモ</label>
          <textarea
            id="observation-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="見つけた場所、気づいた特徴など"
          />
        </div>

        <div className="panel-actions">
          <button className="cta-button" type="submit" disabled={busy}>
            {busy ? "保存中..." : "観察を保存する"}
          </button>
        </div>
      </form>

      {notice ? <p className="status-copy">{notice}</p> : null}
    </section>
  );
}
