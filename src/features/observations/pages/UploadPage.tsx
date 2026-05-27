import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { currentDateInputValue } from "../../../app/utils/time";
import { useSettingsStore } from "../../settings/store/useSettingsStore";
import { useRuntimeStatus } from "../../../app/hooks/useRuntimeStatus";
import { createObservation } from "../../../storage/repositories/observationsRepository";
import { startObservationAnalysis } from "../services/analysis";

type PhotoCandidate = {
  id: string;
  file: File;
  url: string;
  selected: boolean;
};

function selectLastThree(candidates: PhotoCandidate[]) {
  const selectedIds = new Set(candidates.slice(-3).map((candidate) => candidate.id));
  return candidates.map((candidate) => ({
    ...candidate,
    selected: selectedIds.has(candidate.id),
  }));
}

async function createFileFromVideo(video: HTMLVideoElement) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) {
    throw new Error("カメラ映像を取得できませんでした。");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("撮影用キャンバスを初期化できませんでした。");
  }
  context.drawImage(video, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result);
      } else {
        reject(new Error("撮影画像の作成に失敗しました。"));
      }
    }, "image/jpeg", 0.9);
  });

  return new File([blob], `camera-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`, {
    type: "image/jpeg",
  });
}

export function UploadPage() {
  const navigate = useNavigate();
  const runtime = useRuntimeStatus();
  const locationLabels = useSettingsStore((state) => state.locationLabels);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const candidatesRef = useRef<PhotoCandidate[]>([]);
  const [candidates, setCandidates] = useState<PhotoCandidate[]>([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedAt, setCapturedAt] = useState(() => currentDateInputValue());
  const [locationLabel, setLocationLabel] = useState(locationLabels[0] ?? "");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    candidatesRef.current = candidates;
  }, [candidates]);

  useEffect(() => {
    return () => {
      stopCamera();
      candidatesRef.current.forEach((candidate) => URL.revokeObjectURL(candidate.url));
    };
  }, []);

  function addFiles(nextFiles: File[]) {
    const imageFiles = nextFiles.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      setNotice("画像ファイルを選択してください。");
      return;
    }

    setCandidates((current) =>
      selectLastThree([
        ...current,
        ...imageFiles.map((file) => ({
          id: crypto.randomUUID(),
          file,
          url: URL.createObjectURL(file),
          selected: false,
        })),
      ]),
    );
    setNotice("解析に使う画像を1〜3枚選択してください。追加直後は新しい3枚を選択します。");
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function toggleCandidate(candidateId: string) {
    setCandidates((current) => {
      const target = current.find((candidate) => candidate.id === candidateId);
      if (!target) {
        return current;
      }
      if (!target.selected && current.filter((candidate) => candidate.selected).length >= 3) {
        setNotice("解析に使える画像は最大3枚です。先に別の画像を外してください。");
        return current;
      }
      return current.map((candidate) =>
        candidate.id === candidateId ? { ...candidate, selected: !candidate.selected } : candidate,
      );
    });
  }

  function removeCandidate(candidateId: string) {
    setCandidates((current) => {
      const target = current.find((candidate) => candidate.id === candidateId);
      if (target) {
        URL.revokeObjectURL(target.url);
      }
      return current.filter((candidate) => candidate.id !== candidateId);
    });
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setNotice("このブラウザでは連続カメラを利用できません。通常カメラか写真選択を使ってください。");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      setNotice("カメラを起動しました。撮影するとプレビューに追加されます。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "カメラを起動できませんでした。");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }

  async function captureCameraPhoto() {
    if (!videoRef.current) {
      return;
    }
    try {
      const file = await createFileFromVideo(videoRef.current);
      addFiles([file]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "撮影に失敗しました。");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedFiles = candidates.filter((candidate) => candidate.selected).map((candidate) => candidate.file);
    setBusy(true);
    try {
      const observation = await createObservation({
        note,
        locationLabel,
        capturedAt: capturedAt || null,
        files: selectedFiles,
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
      stopCamera();
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
          <span className="form-label">画像</span>
          <div className="file-actions">
            <button className="cta-button" type="button" onClick={cameraActive ? stopCamera : startCamera}>
              {cameraActive ? "連続カメラを閉じる" : "連続カメラ"}
            </button>
            <button className="secondary-button" type="button" onClick={() => cameraInputRef.current?.click()}>
              通常カメラ
            </button>
            <button className="ghost-button" type="button" onClick={() => photoInputRef.current?.click()}>
              写真から選ぶ
            </button>
          </div>
          <input
            ref={cameraInputRef}
            className="hidden-file-input"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
          />
          <input
            ref={photoInputRef}
            className="hidden-file-input"
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
          />
          <p className="field-help">
            {candidates.filter((candidate) => candidate.selected).length} / {candidates.length} 枚選択中。保存時に長辺1280px以内へ圧縮します。
          </p>
        </div>

        <div className="camera-panel" hidden={!cameraActive}>
          <video ref={videoRef} playsInline autoPlay muted />
          <div className="camera-actions">
            <button className="cta-button" type="button" onClick={() => void captureCameraPhoto()}>
              撮影する
            </button>
            <button className="ghost-button" type="button" onClick={stopCamera}>
              閉じる
            </button>
          </div>
        </div>

        {candidates.length > 0 ? (
          <div className="preview-grid">
            {candidates.map((candidate, index) => (
              <article className={candidate.selected ? "preview-item is-selected" : "preview-item"} key={candidate.id}>
                <img src={candidate.url} alt={`候補画像 ${index + 1}`} />
                <div className="preview-controls">
                  <button className="preview-check" type="button" onClick={() => toggleCandidate(candidate.id)}>
                    {candidate.selected ? "選択中" : "選択"}
                  </button>
                  <button className="preview-remove" type="button" onClick={() => removeCandidate(candidate.id)}>
                    削除
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}

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
          <button
            className="cta-button"
            type="submit"
            disabled={busy || candidates.filter((candidate) => candidate.selected).length === 0}
          >
            {busy ? "解析を開始中..." : "解析する"}
          </button>
        </div>
      </form>

      {notice ? <p className="status-copy">{notice}</p> : null}
    </section>
  );
}
