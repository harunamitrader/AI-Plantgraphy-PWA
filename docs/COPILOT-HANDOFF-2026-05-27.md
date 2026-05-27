# Copilot引継ぎ資料

作成日: 2026-05-27

## 対象リポジトリ

`C:\Users\sgmxk\Desktop\AI\repos\local\AI-Plantgraphy-PWA`

## プロジェクト概要

`AI-Plantgraphy-PWA` は、既存の `AI-Plantgraphy` を「Androidスマホ + PWA + ユーザー自身のAPIキー」で使えるようにする別プロジェクト。

目的:

- 自宅PC、Tailscale、FastAPI、Gemini CLIを不要にする。
- GitHub Pagesなどの静的ホスティングで配信する。
- 観察、画像、図鑑、設定、ログをユーザー端末内のIndexedDBに保存する。
- Gemini APIはユーザーが設定したAPIキーでクライアントから直接呼び出す。
- 導入手順を `インストール + APIキー入力` に近づける。

## 現在の状態

主要機能は実装済み。

- PWAインストール導線
- APIキー/モデル/場所ラベル設定
- 観察追加
- カメラ撮影、写真選択、画像プレビュー、1〜3枚選択
- 画像リサイズ/圧縮保存
- 観察解析
- 解析中の経過秒表示
- 解析完了後の経過秒停止
- 観察解析の強制停止
- 候補、信頼度、見えている特徴、不確実な点、解析JSON表示
- 手動補正
- 観察削除
- 図鑑自動生成
- 名前から図鑑生成
- 観察から図鑑生成/再生成
- 図鑑再生成
- 図鑑削除
- 図鑑生成JSON/生成時間表示
- 図鑑詳細の関連写真/観察履歴表示
- 確認待ちハブ
- バックアップzipの書き出し/読み込み
- 旧版データ移行スクリプト
- 診断表示
- 永続ログ表示/削除
- Codex App Server連携の調査・仕様案

## 直近コミット

最新コミット:

- `01d144b Add Codex app server integration proposal`

直近の主な流れ:

- `01d144b` Codex App Server連携案を追加
- `db3cf45` 実機確認チェックリストを追加
- `62519e0` 永続ログ機能を追加
- `566b10e` PWA診断表示を追加
- `78e8105` 旧版データ移行ツールを追加
- `2ce5060` 図鑑詳細に観察履歴を追加
- `1877cea` Gemini応答正規化を強化
- `fdcc82e` 解析停止と候補補正を追加

## 重要ドキュメント

最初に読むべき資料:

- `README.md`
- `docs/SPECIFICATION.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA-MODEL.md`
- `docs/FEATURE-GAP-ANALYSIS.md`
- `docs/REAL-DEVICE-CHECKLIST.md`
- `docs/TEST-PLAN.md`

必要に応じて読む資料:

- `docs/MIGRATION.md`
- `docs/CODEX-APP-SERVER-PROPOSAL.md`
- `docs/UI-WIREFRAME.md`
- `docs/IMPLEMENTATION-PLAN.md`

## 技術スタック

- React
- TypeScript
- Vite
- React Router
- Zustand
- IndexedDB via `idb`
- `vite-plugin-pwa`
- `jszip`

コマンド:

```powershell
npm run dev
npm run lint
npm run build
npm run preview
```

## 主要ファイル

ルーティング/全体:

- `src/app/AppRouter.tsx`
- `src/app/layout/AppShell.tsx`
- `src/app/styles.css`
- `src/app/constants.ts`

観察:

- `src/features/observations/pages/UploadPage.tsx`
- `src/features/observations/pages/ObservationsPage.tsx`
- `src/features/observations/pages/ObservationDetailPage.tsx`
- `src/features/observations/services/analysis.ts`

図鑑:

- `src/features/plants/pages/PlantsPage.tsx`
- `src/features/plants/pages/PlantDetailPage.tsx`
- `src/features/plants/services/generation.ts`

確認待ち:

- `src/features/review/pages/ReviewPage.tsx`

設定/診断/バックアップ:

- `src/features/settings/pages/SettingsPage.tsx`
- `src/features/settings/store/useSettingsStore.ts`
- `src/features/backup/pages/BackupPage.tsx`
- `src/services/diagnostics/diagnostics.ts`
- `src/services/backup/backup.ts`

AI:

- `src/services/ai/geminiClient.ts`
- `src/services/ai/plantProfileClient.ts`

IndexedDB:

- `src/storage/db/appDb.ts`
- `src/storage/repositories/observationsRepository.ts`
- `src/storage/repositories/plantsRepository.ts`
- `src/storage/repositories/imagesRepository.ts`
- `src/storage/repositories/jobsRepository.ts`
- `src/storage/repositories/logsRepository.ts`
- `src/storage/repositories/settingsRepository.ts`

型:

- `src/types/domain.ts`

移行:

- `scripts/migrate_legacy_export.py`

## 設計上の重要方針

### 1. PWA単体利用を優先する

通常利用ではPCサーバーを前提にしない。外部サービスはGemini APIのみ。

### 2. データは端末内に置く

観察、画像、図鑑、設定、ログはIndexedDBへ保存する。ユーザーが必要ならzipでバックアップする。

### 3. 解析/生成状態は確認待ちに出す

観察解析、図鑑生成、失敗、停止は確認待ちハブに集約する。

### 4. 軽量モデルでも崩れにくくする

Gemini応答はJSON崩れ、入れ子、キー名揺れ、信頼度表記揺れを救済する。プロンプトは複雑にしすぎない。

### 5. 旧版の良い操作感に寄せる

デザイン、画面構成、観察/図鑑の見え方は既存 `AI-Plantgraphy` に寄せる。

### 6. Discord通知は不要

ユーザーが不要と明言済み。PWA版では実装対象外。

### 7. Codex App Serverは補助機能扱い

純PWAだけでCodex App Serverを直接動かすのは不可。将来的には診断zip/プロンプト出力を先に実装し、ローカルブリッジ方式は実験扱いにする。

## 既知の未対応/次候補

優先度順。

### 1. Android実機確認で出た不具合修正

`docs/REAL-DEVICE-CHECKLIST.md` に沿って確認し、実機で発生した問題を優先修正する。

特に見る点:

- PWAインストール
- APIキー保存
- カメラ起動
- 写真選択
- 観察解析
- 図鑑生成
- 生成中/停止/確認待ち表示
- IndexedDB保存
- バックアップzip
- オフライン閲覧

### 2. 確認待ち検索

`docs/FEATURE-GAP-ANALYSIS.md` で未実装扱い。件数が増えると探しにくくなるため、確認待ち画面に検索/絞り込みを追加する。

対象:

- `src/features/review/pages/ReviewPage.tsx`

想定仕様:

- 植物名、学名、場所、メモ、エラーメッセージで検索
- 観察/図鑑、生成中/失敗/確認待ちで簡易フィルタ

### 3. モデル候補の見直し

PWA独自のモデル候補のみ。GeminiのモデルIDは変わる可能性があるので、公式情報確認後に `src/app/constants.ts` を更新する。

注意:

- 古いモデルを消す場合は既存設定との互換を考える。
- ユーザーが手入力できる導線を残すか検討する。

### 4. GitHub ActionsのNode 20警告対応

GitHub Pages deploy時にNode.js 20 actions deprecated warningが出ていた。Actionsのバージョン/設定を確認し、必要なら更新する。

対象候補:

- `.github/workflows/*`

### 5. Codex支援エクスポート

`docs/CODEX-APP-SERVER-PROPOSAL.md` のPhase 1。

目的:

- Codexへ渡しやすい診断zipと `prompt.md` をPWAから生成する。

対象候補:

- `src/features/settings/pages/SettingsPage.tsx`
- `src/services/backup/backup.ts`
- 新規 `src/services/codexSupport/*`

### 6. ストレージ容量警告

画像が増えた場合の容量警告UIは未実装。

対象候補:

- `src/services/diagnostics/diagnostics.ts`
- `src/features/settings/pages/SettingsPage.tsx`
- `src/features/backup/pages/BackupPage.tsx`

## 実装時の注意

- 変更は小さく分ける。
- 依頼範囲外の大規模リファクタリングはしない。
- 既存のデザインに合わせる。
- `src/app/styles.css` の既存クラスを優先して使う。
- `IndexedDB` のschema versionを上げる場合は既存データ移行を壊さない。
- 画像や観察の既存データを勝手に消さない。
- APIキーや個人情報をログ/zipに不用意に含めない。
- Gemini API呼び出しのプロンプトを複雑にしすぎない。
- 実装後は最低限 `npm run lint` と `npm run build` を実行する。

## 推奨する次の作業

Copilotへ引き継ぐ最初のタスクとしては、以下が適切。

### タスクA: 確認待ち検索/フィルタの実装

理由:

- 既存の機能差分で明確に未実装。
- 実機確認前でもPC上で検証しやすい。
- 既存機能を壊すリスクが比較的低い。

完了条件:

- 確認待ち画面に検索欄がある。
- 観察/図鑑、生成中/失敗/確認待ちを絞り込める。
- 件数表示が絞り込み結果に追従する。
- `npm run lint` と `npm run build` が通る。

### タスクB: GitHub Actions Node 20警告対応

理由:

- Deploy自体は成功しているが、2026年中に問題化する可能性がある。

完了条件:

- GitHub Pages deployが成功する。
- Node 20 actions deprecated warningが解消、または対応不要理由を文書化する。

### タスクC: Codex支援エクスポートのPhase 1

理由:

- 将来的なCodex連携の低リスクな入口になる。

完了条件:

- 設定画面からCodex診断zipを書き出せる。
- zipに `prompt.md`、`summary.json`、必要最小限の観察/図鑑/ログJSONが入る。
- APIキーは含めない。

## 最終確認コマンド

```powershell
git status --short
npm run lint
npm run build
```

必要ならローカル起動:

```powershell
npm run dev -- --host 127.0.0.1 --port 5173
```
