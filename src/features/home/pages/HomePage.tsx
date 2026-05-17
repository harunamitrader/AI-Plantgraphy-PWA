import { Link } from "react-router-dom";
import { useInstallPrompt } from "../../../app/hooks/useInstallPrompt";
import { useRuntimeStatus } from "../../../app/hooks/useRuntimeStatus";
import { useSettingsStore } from "../../settings/store/useSettingsStore";

export function HomePage() {
  const apiKey = useSettingsStore((state) => state.apiKey);
  const runtime = useRuntimeStatus();
  const install = useInstallPrompt();
  const assetBase = import.meta.env.BASE_URL;

  return (
    <>
      <section className="page-hero compact-hero">
        <div>
          <img
            className="hero-brand-image"
            src={`${assetBase}brand/ai-plantgraphy-header.jpg`}
            alt="AI Plantgraphy"
          />
          <p className="eyebrow">Local-first PWA</p>
          <h1>AI Plantgraphy</h1>
          <p>写真、観察履歴、図鑑データを端末内に保存し、API キーだけで植物を解析します。</p>
          <div className="hero-actions">
            <Link className="cta-button" to="/upload">
              観察を追加
            </Link>
            <Link className="secondary-button" to="/settings">
              設定を確認
            </Link>
            {install.canInstall ? (
              <button
                className="ghost-button"
                type="button"
                disabled={install.isPrompting}
                onClick={() => void install.promptInstall()}
              >
                {install.isPrompting ? "案内中..." : "PWA をインストール"}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">初期状態</p>
            <h2>{runtime.aiReady ? "準備OK" : "要確認"}</h2>
          </div>
          <span className={apiKey ? "status-badge" : "status-badge is-danger"}>
            {apiKey ? "API キー設定済み" : "API キー未設定"}
          </span>
        </div>
        <p className="status-copy">
          {runtime.aiBlockedReason ?? "オンラインで、AI解析と図鑑生成をそのまま使えます。"}
        </p>
      </section>

      <section className="card-grid">
        <article className="placeholder-card">
          <p className="eyebrow">Step 1</p>
          <h3>アプリとして入れる</h3>
          <p>
            {install.isInstalled
              ? "この端末にはすでにインストールされています。"
              : install.canInstall
                ? "インストールボタンから追加できます。"
                : "Android Chrome では右上メニューからホーム画面に追加できます。"}
          </p>
        </article>
        <article className="placeholder-card">
          <p className="eyebrow">Step 2</p>
          <h3>API キーを保存</h3>
          <p>Gemini API キーとモデルは端末内に保存され、以後そのまま使えます。</p>
        </article>
        <article className="placeholder-card">
          <p className="eyebrow">Step 3</p>
          <h3>観察して図鑑化</h3>
          <p>観察、解析、図鑑生成、再生成、バックアップまで端末内中心で動きます。</p>
        </article>
      </section>

      <section className="panel stack">
        <div>
          <p className="eyebrow">Checklist</p>
          <h2>実機確認の前提</h2>
        </div>
        <div className="card-grid">
          <article className="placeholder-card">
            <h3>1. インストール状態</h3>
            <p>{install.isInstalled ? "OK" : "未確認"}</p>
          </article>
          <article className="placeholder-card">
            <h3>2. API キー</h3>
            <p>{apiKey ? "保存済み" : "未設定"}</p>
          </article>
          <article className="placeholder-card">
            <h3>3. 通信状態</h3>
            <p>{runtime.isOnline ? "オンライン" : "オフライン"}</p>
          </article>
        </div>
      </section>
    </>
  );
}
