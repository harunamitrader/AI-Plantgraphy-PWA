import { NavLink, Outlet } from "react-router-dom";
import { useInstallPrompt } from "../hooks/useInstallPrompt";
import { useRuntimeStatus } from "../hooks/useRuntimeStatus";

const navItems = [
  { to: "/", label: "ホーム", end: true },
  { to: "/plants", label: "図鑑" },
  { to: "/observations", label: "観察" },
  { to: "/upload", label: "追加" },
  { to: "/review", label: "確認待ち" },
  { to: "/settings", label: "設定" },
];

export function AppShell() {
  const runtime = useRuntimeStatus();
  const install = useInstallPrompt();

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand-block">
          <div className="brand-mark">AI</div>
          <div>
            <p className="eyebrow">PWA</p>
            <h1>AI Plantgraphy</h1>
          </div>
        </div>
        <nav className="site-nav" aria-label="主要メニュー">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              className={({ isActive }) => (isActive ? "nav-link is-active" : "nav-link")}
              to={item.to}
              end={item.end}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="runtime-strip" aria-live="polite">
          <span className={install.isInstalled ? "status-badge" : "status-badge is-danger"}>
            {install.isInstalled ? "インストール済み" : "ブラウザ表示"}
          </span>
          <span className={runtime.isOnline ? "status-badge" : "status-badge is-danger"}>
            {runtime.isOnline ? "オンライン" : "オフライン"}
          </span>
          <span className={runtime.hasApiKey ? "status-badge" : "status-badge is-danger"}>
            {runtime.hasApiKey ? "API キー設定済み" : "API キー未設定"}
          </span>
          {install.canInstall ? (
            <button
              className="secondary-button"
              type="button"
              disabled={install.isPrompting}
              onClick={() => void install.promptInstall()}
            >
              {install.isPrompting ? "案内中..." : "アプリとしてインストール"}
            </button>
          ) : null}
          {runtime.aiBlockedReason ? <p className="runtime-copy">{runtime.aiBlockedReason}</p> : null}
          {!install.isInstalled && !install.canInstall ? (
            <p className="runtime-copy">
              Android Chrome ではメニューの「ホーム画面に追加」からもインストールできます。
            </p>
          ) : null}
        </div>
      </header>
      <main className="page-frame">
        <Outlet />
      </main>
    </div>
  );
}
