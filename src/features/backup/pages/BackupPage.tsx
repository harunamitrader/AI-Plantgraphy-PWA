import { useEffect, useRef, useState } from "react";
import { appDbStatusText } from "../../../storage/db/appDb";
import { createBackupZip, getBackupSummary, importBackupZip } from "../../../services/backup/backup";
import { addLog } from "../../../storage/repositories/logsRepository";
import {
  formatBytes,
  getDiagnosticsSummary,
  type DiagnosticsSummary,
} from "../../../services/diagnostics/diagnostics";

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function BackupPage() {
  const [summary, setSummary] = useState({
    settings: 0,
    observations: 0,
    plants: 0,
    jobs: 0,
    images: 0,
    logs: 0,
  });
  const [diagnostics, setDiagnostics] = useState<DiagnosticsSummary | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;

    async function refresh() {
      const next = await getBackupSummary();
      if (mounted) {
        setSummary(next);
        setDiagnostics(await getDiagnosticsSummary());
      }
    }

    void refresh();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleExport() {
    setBusy(true);
    try {
      const blob = await createBackupZip();
      downloadBlob(blob, `ai-plantgraphy-pwa-backup-${new Date().toISOString().slice(0, 10)}.zip`);
      await addLog({
        severity: "info",
        source: "backup",
        message: "バックアップを書き出しました。",
        details: { bytes: blob.size },
      });
      setSummary(await getBackupSummary());
      setDiagnostics(await getDiagnosticsSummary());
      setNotice("バックアップを書き出しました。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "バックアップの書き出しに失敗しました。";
      await addLog({
        severity: "error",
        source: "backup",
        message,
      });
      setNotice(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setBusy(true);
    try {
      const manifest = await importBackupZip(file);
      await addLog({
        severity: "info",
        source: "backup",
        message: "バックアップを復元しました。",
        details: { fileName: file.name, counts: manifest.counts },
      });
      const next = await getBackupSummary();
      setSummary(next);
      setDiagnostics(await getDiagnosticsSummary());
      setNotice("バックアップを復元しました。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "バックアップの復元に失敗しました。";
      await addLog({
        severity: "error",
        source: "backup",
        message,
        details: { fileName: file.name },
      });
      setNotice(message);
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  return (
    <section className="page-columns">
      <article className="panel stack">
        <div>
          <p className="eyebrow">Backup</p>
          <h2>バックアップと復元</h2>
          <p className="status-copy">
            ZIP で観察、図鑑、画像、ジョブ、設定をまとめて持ち出せます。端末依存を補うための安全策です。
          </p>
        </div>
        <div className="panel-actions">
          <button className="cta-button" type="button" onClick={handleExport} disabled={busy}>
            ZIP を書き出す
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            ZIP を読み込む
          </button>
          <input ref={fileInputRef} type="file" accept=".zip" hidden onChange={handleImport} />
        </div>
        {notice ? <p className="status-copy">{notice}</p> : null}
      </article>
      <article className="panel stack">
        <div>
          <p className="eyebrow">Storage</p>
          <h2>現在の基盤</h2>
          <p className="status-copy">{appDbStatusText()}</p>
        </div>
        <div className="status-grid">
          <article className="placeholder-card">
            <p className="eyebrow">Settings</p>
            <h3>{summary.settings}件</h3>
          </article>
          <article className="placeholder-card">
            <p className="eyebrow">Observations</p>
            <h3>{summary.observations}件</h3>
          </article>
          <article className="placeholder-card">
            <p className="eyebrow">Plants</p>
            <h3>{summary.plants}件</h3>
          </article>
          <article className="placeholder-card">
            <p className="eyebrow">Images</p>
            <h3>{summary.images}件</h3>
          </article>
          <article className="placeholder-card">
            <p className="eyebrow">Logs</p>
            <h3>{summary.logs}件</h3>
          </article>
        </div>
        <div className="status-grid">
          <article className="placeholder-card">
            <p className="eyebrow">Usage</p>
            <h3>{formatBytes(diagnostics?.storage.usageBytes ?? null)}</h3>
            <p className="status-copy">
              保存上限 {formatBytes(diagnostics?.storage.quotaBytes ?? null)}
              {diagnostics?.storage.usagePercent !== null && diagnostics?.storage.usagePercent !== undefined
                ? ` / ${diagnostics.storage.usagePercent}%`
                : ""}
            </p>
          </article>
          <article className="placeholder-card">
            <p className="eyebrow">Image Size</p>
            <h3>{formatBytes(diagnostics?.storage.imageBytes ?? null)}</h3>
            <p className="status-copy">画像レコード合計</p>
          </article>
          <article className="placeholder-card">
            <p className="eyebrow">API</p>
            <h3>{diagnostics?.settings.hasApiKey ? "設定済み" : "未設定"}</h3>
            <p className="status-copy">{diagnostics?.settings.model ?? "モデル未確認"}</p>
          </article>
        </div>
      </article>
    </section>
  );
}
