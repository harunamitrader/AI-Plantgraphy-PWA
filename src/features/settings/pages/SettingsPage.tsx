import { useEffect, useState } from "react";
import { useInstallPrompt } from "../../../app/hooks/useInstallPrompt";
import { useRuntimeStatus } from "../../../app/hooks/useRuntimeStatus";
import { MODEL_OPTIONS } from "../../../app/constants";
import {
  formatBytes,
  getDiagnosticsSummary,
  type DiagnosticsSummary,
} from "../../../services/diagnostics/diagnostics";
import { useSettingsStore } from "../store/useSettingsStore";

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

  useEffect(() => {
    let mounted = true;

    async function refreshDiagnostics() {
      const next = await getDiagnosticsSummary();
      if (mounted) {
        setDiagnostics(next);
      }
    }

    void refreshDiagnostics();

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

  return (
    <section className="stack">
      <section className="page-hero">
        <p className="eyebrow">Settings</p>
        <h2>API キーと基本設定</h2>
        <p>
          初期実装では API キーとモデルをローカルに保存します。観察や図鑑の本保存先は次の段階で
          IndexedDB に切り替えます。
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
