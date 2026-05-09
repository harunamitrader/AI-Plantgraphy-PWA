# AI-Plantgraphy PWA 実装計画

## 1. 目的

本書は、`C:\Users\sgmxk\Desktop\AI\repos\local\AI-Plantgraphy-PWA\docs\SPECIFICATION.md` を実装へ落とすための具体計画を定義する。

前提は次の通り。

- 別リポジトリ、別プロジェクトとして実装する
- `PWA` として成立させる
- 導入手順は `インストール + APIキー入力` だけを目標にする
- 既存の `C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy` から流用できる考え方、文言、JSON 契約、画面構成は積極的に流用する
- ただし、サーバー前提の実装はそのまま持ち込まず、クライアント完結PWA向けに置き換える

---

## 2. 実装方針

### 2.1 基本戦略

1. 既存 AI-Plantgraphy の UI/要件/プロンプト契約を棚卸しする
2. PWA で成立しない部分を切り分ける
3. クライアントローカル保存版として再設計する
4. 先に縦切りで最低限動くものを作る
5. その後に解析・図鑑・バックアップを積み上げる

### 2.2 実装の優先順位

1. アプリ基盤
2. 設定と API キー保存
3. 観察追加とローカル保存
4. AI 解析
5. 図鑑
6. バックアップ / 復元
7. 仕上げ

### 2.3 流用方針

流用対象は「コード」よりも次を優先する。

- 画面構成
- 状態遷移
- 文言
- JSON 契約
- 正規化ルール
- 失敗時の扱い
- 既存図鑑判定ルール

---

## 3. 流用マップ

### 3.1 そのまま参考にできるもの

- 画面構成
  - `C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy\docs\app\index.html`
  - `C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy\docs\app\upload.html`
  - `C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy\docs\app\observations.html`
  - `C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy\docs\app\observation.html`
  - `C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy\docs\app\plants.html`
  - `C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy\docs\app\plant.html`
  - `C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy\docs\app\review.html`
  - `C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy\docs\app\settings.html`
- PWA 配信の考え方
  - `C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy\docs\app\manifest.webmanifest`
- 解析契約と正規化ルール
  - `C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy\server\app\services\gemini_cli.py`
  - `C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy\skills\plant-json-identifier\references\output-contract.md`

### 3.2 ロジックだけ流用するもの

- 結果 JSON の正規化
- 候補整形
- visible features 整形
- uncertainty_notes の補完
- 既存図鑑の重複判定ルール
- 和名から図鑑生成するときの学名確認フロー
- 低信頼時は止める判断

### 3.3 設計だけ流用し、実装は作り直すもの

- DB
  - 既存: SQLite
  - 新規: IndexedDB
- 画像保存
  - 既存: ファイルシステム
  - 新規: IndexedDB Blob / OPFS
- 解析進行管理
  - 既存: サーバー側メモリ管理
  - 新規: ブラウザ側ジョブ管理
- 強制停止
  - 既存: プロセス kill
  - 新規: `AbortController`
- エクスポート
  - 既存: サーバーで ZIP 作成
  - 新規: ブラウザ内 ZIP 作成

### 3.4 流用しないもの

- `C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy\server\app\main.py`
  - FastAPI 前提のため、そのままは使わない
- `C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy\server\app\db.py`
  - SQLite 前提のため、そのままは使わない
- `C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy\server\app\services\connectivity.py`
  - 自宅PC接続前提のため不要
- `discord_notify.py`
  - 初期スコープ外

---

## 4. 成果物

### 4.1 アプリ実装成果物

- Vite + React + TypeScript プロジェクト
- PWA 設定
- IndexedDB レイヤー
- 観察機能
- 図鑑機能
- Gemini API クライアント
- ZIP エクスポート / インポート

### 4.2 ドキュメント成果物

- `README.md`
- `docs\SPECIFICATION.md`
- `docs\ARCHITECTURE.md`
- `docs\TEST-PLAN.md`
- `docs\IMPLEMENTATION-PLAN.md`
- `docs\DATA-MODEL.md`
- `docs\UI-WIREFRAME.md`

---

## 5. フェーズ計画

## Phase 0: 設計固定

### 目的

実装前に、データモデル・画面構成・技術選定を固定する。

### 作業

- 仕様書レビュー
- アーキテクチャレビュー
- IndexedDB スキーマ定義
- 画面遷移の確認
- Gemini API 直呼び可否の前提確認

### 成果物

- `docs\DATA-MODEL.md`
- `docs\UI-WIREFRAME.md`

### 検証

- 実装に必要な不明点が残っていない
- 主要ユースケースが図で説明できる

---

## Phase 1: プロジェクト基盤

### 目的

PWA として起動する最低限の土台を作る。

### 作業

- Vite プロジェクト初期化
- React + TypeScript 導入
- ESLint / Prettier / Vitest 導入
- PWA プラグイン設定
- ルーティング導入
- デザイントークン作成
- アプリシェル作成

### 既存流用元

- ナビゲーション構成
  - `C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy\docs\app\*.html`
- PWA manifest の考え方
  - `C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy\docs\app\manifest.webmanifest`

### 成果物

- `src\app\`
- `public\manifest.webmanifest`
- `public\icons\`

### 検証

- ローカルで起動できる
- Android Chrome でホーム画面追加できる

---

## Phase 2: 設定とローカル保存基盤

### 目的

API キー、モデル、ローカルデータ保存の基盤を作る。

### 作業

- IndexedDB 初期化
- settings store 実装
- observations store 実装
- plants store 実装
- images store 実装
- API キー設定画面
- モデル設定画面
- 場所ラベル設定

### 既存流用元

- 設定項目
  - `C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy\docs\app\settings.html`
- 場所ラベル概念
  - `C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy\server\app\services\app_settings.py`

### 成果物

- `src\storage\`
- `src\features\settings\`

### 検証

- API キー保存後に再起動しても保持される
- 設定更新が反映される

---

## Phase 3: 観察追加と一覧

### 目的

画像付き観察をローカルに作成し、一覧と詳細で見られるようにする。

### 作業

- 画像選択
- 画像圧縮
- サムネイル生成
- 1〜3 枚観察保存
- 観察一覧
- 観察詳細
- 削除

### 既存流用元

- 観察追加UI
  - `C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy\docs\app\upload.html`
- 観察一覧UI
  - `C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy\docs\app\observations.html`
- 観察詳細UI
  - `C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy\docs\app\observation.html`
- 画像最適化の考え方
  - `C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy\server\app\services\image_store.py`

### 成果物

- `src\features\observations\`
- `src\services\images\`

### 検証

- 画像1〜3枚で観察追加できる
- 一覧と詳細に反映される
- 端末再起動後も残る

---

## Phase 4: Gemini API 接続と解析

### 目的

観察画像を LLM 解析し、観察結果を保存する。

### 作業

- Gemini API クライアント実装
- JSON スキーマ契約実装
- 解析リクエスト組み立て
- 応答パース
- 正規化ロジック移植
- スキーマ違反時の1回再試行
- 解析失敗処理
- 状態遷移と進捗表示
- 強制停止

### 既存流用元

- `C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy\server\app\services\gemini_cli.py`
- `C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy\skills\plant-json-identifier\references\output-contract.md`

### 実装方針

- Python 実装を TypeScript に移植する
- CLI 呼び出し部分は捨て、HTTP API 呼び出しに置換する
- `normalize_result()` 相当のロジックを最優先で再現する

### 成果物

- `src\services\ai\`
- `src\features\observations\services\analysis.ts`

### 検証

- 正常なJSON応答を保存できる
- 崩れたJSON応答でもリトライ後に回収できる
- 強制停止が効く

---

## Phase 5: 図鑑

### 目的

植物図鑑の一覧、詳細、再生成、削除、手動生成を作る。

### 作業

- 観察からの図鑑自動作成
- 図鑑一覧
- 図鑑詳細
- 図鑑再生成
- 図鑑削除
- 観察から図鑑再生成
- 名前から図鑑生成
- 既存図鑑の重複検知

### 既存流用元

- `C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy\docs\app\plants.html`
- `C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy\docs\app\plant.html`
- 図鑑重複判定ルール
  - 既存 `db.py` の学名優先 / 和名一致判定
- 手動図鑑生成の安全化ルール
  - 既存 `main.py` + `gemini_cli.py`

### 成果物

- `src\features\plants\`

### 検証

- 高信頼観察から図鑑ができる
- 重複作成しない
- 和名だけの手動生成で曖昧なら止まる

---

## Phase 6: バックアップ / 復元

### 目的

端末依存の弱点をエクスポート / インポートで補う。

### 作業

- JSON + 画像 ZIP 生成
- ZIP 読み込み
- バージョン確認
- 不正ZIP時のエラー処理

### 既存流用元

- `C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy\server\app\services\export_store.py`

### 成果物

- `src\services\export\`
- `src\services\import\`
- `src\features\backup\`

### 検証

- エクスポート後に初期化しても、インポートで復元できる

---

## Phase 7: 品質仕上げ

### 目的

導入導線、実機動作、性能、文言の完成度を上げる。

### 作業

- Android 実機確認
- オフライン確認
- ストレージ容量確認
- 画像圧縮見直し
- UI 文言調整
- エラー文言調整
- テスト追加

### 検証

- `docs\TEST-PLAN.md` の受け入れシナリオを全通しする

---

## 6. 優先実装順の短縮版

最短で「使えるもの」を出す順序は次の通り。

1. PWA シェル
2. 設定保存
3. 観察追加
4. 画像保存
5. Gemini 解析
6. 観察詳細
7. 図鑑自動生成
8. 図鑑詳細
9. 和名から手動図鑑生成
10. バックアップ / 復元

---

## 7. 技術タスク一覧

### 7.1 フロント基盤

- Vite セットアップ
- React Router
- Zustand
- Vitest
- Playwright
- vite-plugin-pwa

### 7.2 ローカル保存

- IndexedDB スキーマ作成
- Repository 実装
- Blob 保存

### 7.3 AI

- Gemini API ラッパー
- 出力契約ファイル移植
- 正規化関数移植

### 7.4 バックアップ

- JSZip か同等ライブラリ導入
- ZIP manifest 実装

---

## 8. リスクと対策

### 8.1 API キー漏えいリスク

対策:

- README と設定画面に前提を明記
- 個人利用向け前提をはっきりさせる

### 8.2 ブラウザ保存容量不足

対策:

- 画像圧縮
- 容量警告
- エクスポート導線

### 8.3 LLM 応答の揺れ

対策:

- 既存 JSON 契約を流用
- 再試行
- 正規化
- 低信頼時停止

### 8.4 実機依存差異

対策:

- Android Chrome 実機を基準に先に固める
- Safari 対応は後段で検討

---

## 9. 受け入れの目安

実装完了の目安は次の通り。

- Android で PWA インストール可能
- API キー入力後、自宅PCなしで観察追加から解析完了までできる
- 観察と図鑑が再起動後も残る
- 手動図鑑生成が和名だけで安全に動く
- 既存図鑑の重複生成を防げる
- ZIP バックアップと復元が成立する

---

## 10. 次に作るべきドキュメント

この計画の次に必要なのは次の 2 つ。

1. `C:\Users\sgmxk\Desktop\AI\repos\local\AI-Plantgraphy-PWA\docs\DATA-MODEL.md`
2. `C:\Users\sgmxk\Desktop\AI\repos\local\AI-Plantgraphy-PWA\docs\UI-WIREFRAME.md`

この2つがあると、実装開始時の迷いがかなり減る。
