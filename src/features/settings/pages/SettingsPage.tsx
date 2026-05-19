import { useEffect, useState } from "react";
import { useInstallPrompt } from "../../../app/hooks/useInstallPrompt";
import { useRuntimeStatus } from "../../../app/hooks/useRuntimeStatus";
import { MODEL_OPTIONS } from "../../../app/constants";
import {
  formatBytes,
  getDiagnosticsSummary,
  type DiagnosticsSummary,
} from "../../../services/diagnostics/diagnostics";
import { clearLogs, loadLogs } from "../../../storage/repositories/logsRepository";
import type { AppLog } from "../../../types/domain";
import { useSettingsStore } from "../store/useSettingsStore";

function formatLogDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ja-JP");
}

function severityLabel(severity: AppLog["severity"]) {
  if (severity === "error") {
    return "エラー";
  }
  if (severity === "warning") {
    return "警告";
  }
  return "情報";
}

export function SettingsPage() {
  const runtime = useRuntimeStatus();
  const install = useInstallPrompt();
  const apiKey = useSettingsStore((state) => state.apiKey);
  const model = useSettingsStore((state) => state.model);
  const locationLabels = useSettingsStore((state) => state.locationLabels);
  const setApiKey = useSettingsStore((state) => state.setApiKey);
  const setModel = useSettingsStore((state) => state.setModel);
  const addLocationLabel = useSettingsStore((state) => state.addLocationLabel);
  const removeLocationLabel = useSettingsStore((state) => state.removeLocationLabel);
  const reset = useSettingsStore((state) => state.reset);
  const [draftLabel, setDraftLabel] = useState("");
  const [diagnostics, setDiagnostics] = useState<DiagnosticsSummary | null>(null);
  const [logs, setLogs] = useState<AppLog[]>([]);
  const [logNotice, setLogNotice] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function refreshStatus() {
      const [nextDiagnostics, nextLogs] = await Promise.all([getDiagnosticsSummary(), loadLogs()]);
      if (mounted) {
        setDiagnostics(nextDiagnostics);
        setLogs(nextLogs);
      }
    }

    void refreshStatus();

    return () => {
      mounted = false;
    };
  }, [apiKey, model, locationLabels]);

  function submitLabel() {
    if (!draftLabel.trim()) {
      return;
    }
    addLocationLabel(draftLabel);
    setDraftLabel("");
  }

  async function handleClearLogs() {
    await clearLogs();
    setLogs([]);
    setLogNotice("ログを削除しました。");
    setDiagnostics(await getDiagnosticsSummary());
  }

  return (
    <section className="stack">
      <section className="page-hero">
        <p className="eyebrow">Settings</p>
        <h2>API キーと基本設定</h2>
        <p>
          API キー、モデル、場所ラベル、観察、図鑑、画像、ログはこの端末内に保存します。
        </p>
        <p className="status-copy">
          {runtime.aiBlockedReason ?? "現在はオンラインで、AI 機能をそのまま使えます。"}
        </p>
        <p className="status-copy">
          {install.isInstalled
            ? "この端末にはアプリとしてインストール済みです。"
            : "Android Chrome では、設定後にホーム画面へ追加してアプリ化できます。"}
        </p>
      </section>

      <section className="panel stack">
        <div>
          <p className="eyebrow">Diagnostics</p>
          <h2>診断</h2>
          <p className="status-copy">PWA版で必要な端末内保存、APIキー、バックアップ対象を確認します。</p>
        </div>
        <div className="status-grid">
          <article className="placeholder-card">
            <p className="eyebrow">API</p>
            <h3>{diagnostics?.settings.hasApiKey ? "設定済み" : "未設定"}</h3>
            <p className="status-copy">{diagnostics?.settings.model ?? model}</p>
          </article>
          <article className="placeholder-card">
            <p className="eyebrow">Storage</p>
            <h3>{formatBytes(diagnostics?.storage.usageBytes ?? null)}</h3>
            <p className="status-copy">
              上限 {formatBytes(diagnostics?.storage.quotaBytes ?? null)}
              {diagnostics?.storage.usagePercent !== null && diagnostics?.storage.usagePercent !== undefined
                ? ` / ${diagnostics.storage.usagePercent}%`
                : ""}
            </p>
          </article>
          <article className="placeholder-card">
            <p className="eyebrow">Images</p>
            <h3>{diagnostics?.storage.imageCount ?? 0}件</h3>
            <p className="status-copy">{formatBytes(diagnostics?.storage.imageBytes ?? null)}</p>
          </article>
          <article className="placeholder-card">
            <p className="eyebrow">Backup</p>
            <h3>{diagnostics?.backup.exportableRecords ?? 0}件</h3>
            <p className="status-copy">バックアップ対象レコード</p>
          </article>
          <article className="placeholder-card">
            <p className="eyebrow">Logs</p>
            <h3>{diagnostics?.storage.logCount ?? 0}件</h3>
            <p className="status-copy">端末内の履歴</p>
          </article>
        </div>
      </section>

      <section className="panel stack">
        <div>
          <p className="eyebrow">Logs</p>
          <h2>ログ</h2>
          <p className="status-copy">解析、図鑑生成、バックアップの最新履歴を端末内に保存します。</p>
        </div>
        <div className="panel-actions">
          <button className="ghost-button" type="button" onClick={handleClearLogs} disabled={logs.length === 0}>
            ログを削除
          </button>
        </div>
        {logNotice ? <p className="status-copy">{logNotice}</p> : null}
        <div className="log-list">
          {logs.length > 0 ? (
            logs.map((log) => (
              <article className={`log-row is-${log.severity}`} key={log.id}>
                <div className="log-row-header">
                  <span className="status-badge">{severityLabel(log.severity)}</span>
                  <span className="status-copy">{log.source}</span>
                  <span className="status-copy">{formatLogDate(log.createdAt)}</span>
                </div>
                <strong>{log.message}</strong>
                {log.observationId || log.plantId || log.jobId ? (
                  <p className="status-copy">
                    {log.observationId ? `観察: ${log.observationId} ` : ""}
                    {log.plantId ? `図鑑: ${log.plantId} ` : ""}
                    {log.jobId ? `ジョブ: ${log.jobId}` : ""}
                  </p>
                ) : null}
              </article>
            ))
          ) : (
            <p className="status-copy">ログはまだありません。</p>
          )}
        </div>
      </section>

      <section className="panel stack">
        <div className="field-grid">
          <div className="field">
            <label htmlFor="apiKey">Gemini API キー</label>
            <input
              id="apiKey"
              type="password"
              placeholder="AIza..."
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="model">利用モデル</label>
            <select id="model" value={model} onChange={(event) => setModel(event.target.value)}>
              {MODEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="locationLabel">場所ラベルを追加</label>
          <div className="settings-actions">
            <input
              id="locationLabel"
              type="text"
              placeholder="例: 自宅庭"
              value={draftLabel}
              onChange={(event) => setDraftLabel(event.target.value)}
            />
            <button className="secondary-button" type="button" onClick={submitLabel}>
              追加
            </button>
          </div>
        </div>

        <div className="status-grid">
          {locationLabels.map((label) => (
            <button
              key={label}
              className="ghost-button"
              type="button"
              onClick={() => removeLocationLabel(label)}
            >
              {label} を削除
            </button>
          ))}
        </div>

        <div className="panel-actions">
          <button className="ghost-button" type="button" onClick={reset}>
            設定を初期化
          </button>
        </div>
      </section>
    </section>
  );
}
