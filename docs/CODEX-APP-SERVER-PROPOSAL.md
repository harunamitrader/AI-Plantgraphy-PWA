# Codex App Server 組み込み可能性調査と仕様案

作成日: 2026-05-19

## 結論

`AI-Plantgraphy-PWA` に Codex App Server を組み込む場合、GitHub Pages 上の純粋なPWAだけで完結する方式は現実的ではない。

理由:

- Codex App Server は `codex app-server` として動くローカル/ホスト側プロセスであり、ブラウザ上のJavaScriptから直接起動できない。
- PWAはローカルファイル、任意プロセス、標準入出力、OS認証ストアにアクセスできない。
- App Server のWebSocket transportは公式に experimental / unsupported とされている。
- 公式ドキュメントは、共有ネットワークや公開ネットワークにApp Server transportを直接公開しないよう明記している。

一方で、ユーザー各自のCodexアカウントを使う構成は可能性がある。現実的な構成は、PWA本体に加えて、ユーザー端末またはユーザー管理ホスト上で小さなローカルブリッジを起動する方式。

## 公式情報の確認

確認日: 2026-05-19

参照元:

- OpenAI Developers: Codex App Server
  - https://developers.openai.com/codex/app-server
- OpenAI Developers: Codex Authentication
  - https://developers.openai.com/codex/auth
- OpenAI Developers: Codex Remote connections
  - https://developers.openai.com/codex/remote-connections
- OpenAI Engineering Blog: Unlocking the Codex harness
  - https://openai.com/index/unlocking-the-codex-harness/
- ローカル確認: `codex-cli 0.130.0`

確認できた事実:

- Codex App Server は、Codex VS Code extension などのリッチクライアントを支えるインターフェース。
- 認証、会話履歴、承認、ストリーミングされたagent eventを扱うための深い統合向け。
- Protocol はJSON-RPC系で、`stdio`、WebSocket、Unix socketをサポートする。
- `stdio` がデフォルト。
- WebSocketは experimental / unsupported。
- WebSocketを非loopbackへ公開する場合は認証設定が必要。
- App Serverは `initialize` 後に thread / turn を開始し、イベント通知を読み続ける。
- App Serverは承認要求をクライアントへ送るため、UI側でコマンド実行やファイル変更の許可/拒否を扱う必要がある。
- CodexはChatGPTログインとAPIキー認証に対応する。CLIとIDE extensionは両方に対応する。
- Codex cloudはChatGPTログインが必要。
- Codex CLI/IDEはログイン情報をローカルにキャッシュする。
- Remote connectionsの公式ドキュメントは、App Server transportを共有/公開ネットワークへ直接公開しないよう明記している。

## できること / できないこと

### できる可能性があること

- ユーザーが自分のPC/Mac/LinuxホストでCodex CLIにログインする。
- 同じホストで `codex app-server` またはローカルブリッジを起動する。
- PWAからローカルブリッジへ接続し、Codexに自然言語タスクを投げる。
- ユーザーのCodexログイン状態、モデル、レート制限、承認ポリシーを利用する。
- Codexのストリーミング出力、承認要求、エラーをPWAに表示する。

### できない、または避けるべきこと

- GitHub PagesのPWAだけで `codex app-server` を起動する。
- Android ChromeだけでCodex App Serverをローカルプロセスとして動かす。
- App Serverをインターネットへ直接公開する。
- PWAがユーザーのChatGPTログイン情報やCodex認証トークンを直接管理する。
- 植物画像解析の通常処理をCodexに置き換える。

## 推奨構成

### 方針

Codex App Server は植物同定APIとして使わない。PWA本体の植物解析は引き続きGemini APIを主系統にする。

Codex連携は、以下の補助機能に限定する。

- アプリ内データの点検
- 解析失敗ログの整理
- バックアップzipの調査
- プロンプト改善案の作成
- 図鑑テキストの校正
- OSS公開時のREADME/issue/変更履歴作成支援

### 構成案A: ローカルブリッジ方式

対象:

- PC/Macを持つユーザー
- 既にCodex CLIを使えるユーザー
- 開発者または上級ユーザー

構成:

```text
AI-Plantgraphy-PWA on GitHub Pages
  |
  | HTTPS page -> localhost bridge
  v
Local bridge app
  |
  | stdio JSONL
  v
codex app-server
  |
  v
User's Codex login / API key / ChatGPT plan
```

役割:

- PWA:
  - Codex連携画面を表示する
  - ローカルブリッジURLと接続状態を保存する
  - 送信前にユーザーへデータ範囲を明示する
  - Codexの応答、承認要求、ログを表示する
- ローカルブリッジ:
  - `codex app-server` を子プロセスとして起動する
  - stdio JSONL と PWA向けHTTP/WebSocketを変換する
  - 接続トークンでPWAからのアクセスを保護する
  - PWAから送られた最小限のデータだけをCodexへ渡す
- Codex App Server:
  - thread / turn / approval / stream eventを処理する

利点:

- 公式推奨に近い `stdio` transportを使える。
- App Serverを公開ネットワークに晒さない。
- ユーザー各自のCodexログインをそのまま使える。
- PWAの主要機能は壊さず、任意の補助機能として追加できる。

欠点:

- `インストール + APIキー入力だけ` ではなくなる。
- ユーザーにCodex CLIとローカルブリッジの導入が必要。
- Androidスマホだけでは完結しない。

### 構成案B: Codex公式Remote connections誘導方式

対象:

- Codex App / ChatGPT mobile を使うユーザー
- PWA内統合より、Codex公式UIを使う方が許容できるユーザー

構成:

```text
AI-Plantgraphy-PWA
  |
  | backup zip / exported JSON
  v
User-controlled Codex App / ChatGPT mobile remote connection
```

役割:

- PWA:
  - Codexに渡すための診断パッケージをエクスポートする
  - Codex用プロンプトを生成する
- ユーザー:
  - Codex AppまたはChatGPT mobileのCodexからプロンプトとデータを使う

利点:

- PWAに危険なローカル通信を入れない。
- 実装が軽い。
- 公式のRemote connectionsの安全設計に乗りやすい。

欠点:

- PWA画面内でCodexのストリーミングUIを表示できない。
- 操作が別アプリに分かれる。

### 構成案C: サーバー側Codex SDK方式

対象:

- 将来的にAI-PlantgraphyをSaaS化する場合
- ユーザーごとのログイン管理をサーバーで扱う場合

構成:

```text
AI-Plantgraphy Web/PWA
  |
  v
AI-Plantgraphy backend
  |
  v
Codex SDK / Codex App Server
```

利点:

- PWAだけで画面体験を完結できる。
- Android単体でも使いやすい。

欠点:

- ユーザー各自のCodexアカウントで安全に動かす認証設計が重い。
- サーバー運用、課金、セキュリティ、利用規約確認が必要。
- 現在のローカルファーストPWA方針と大きくずれる。

現時点では非推奨。

## 推奨仕様案

初期実装は `構成案B` を先に作り、その後に `構成案A` を実験機能として追加する。

理由:

- PWAの導入簡単さを壊さない。
- Codex連携の価値を低リスクに検証できる。
- App ServerのWebSocketを直接使う前に、Codexに渡したいデータ形式とユースケースを固められる。

## Phase 1: Codex支援エクスポート

目的:

CodexをPWA内から直接操作せず、Codexへ渡しやすい診断パッケージを作る。

画面:

- `設定 > Codex支援`

機能:

- Codex用診断JSONを書き出す。
- Codex用プロンプトを生成する。
- 対象データを選べる。
  - 全体診断
  - 解析失敗だけ
  - 確認待ちだけ
  - 特定の観察
  - 特定の図鑑
- 個人情報や画像を含めるかを選べる。
- 出力前に含まれるデータ件数を表示する。

生成物:

- `ai-plantgraphy-codex-diagnostic-YYYY-MM-DD.zip`
  - `prompt.md`
  - `summary.json`
  - `observations.json`
  - `plants.json`
  - `logs.json`
  - 任意で画像サムネイル

Codex向けプロンプト例:

```text
AI-Plantgraphy PWAの診断データを確認してください。
目的は、解析失敗・図鑑生成失敗・重複・空欄の原因候補を整理し、ユーザーが次に行うべき操作と、アプリ側で修正すべき候補を分けて報告することです。

制約:
- データを勝手に変更しない。
- 画像やログに含まれる個人情報を出力しない。
- 推測と確認済み事実を分ける。
- 修正案は優先度順に出す。
```

## Phase 2: ローカルブリッジ実験

目的:

PWA画面からユーザー各自のCodex App Serverへ接続し、限定的な補助タスクを実行する。

追加配布物:

- `ai-plantgraphy-codex-bridge`
  - Node.jsまたはRustの小型ローカルサーバー
  - `codex app-server` を子プロセスとして起動
  - PWA向けに `http://127.0.0.1:<port>` または `ws://127.0.0.1:<port>` を提供

起動例:

```powershell
ai-plantgraphy-codex-bridge --port 49321 --token-file "$env:USERPROFILE\.ai-plantgraphy\bridge-token"
```

PWA設定項目:

- Codex連携を有効にする
- Bridge URL
- 接続トークン
- Codexモデル
- 送信可能データ範囲
- 自動実行を許可しない安全モード

安全仕様:

- 初期状態では無効。
- localhost以外への接続は警告を出す。
- PWAからCodexへ送るデータを毎回プレビューする。
- 画像はデフォルトで送らない。
- 承認要求はPWA画面に表示し、ユーザー操作なしで許可しない。
- shell/file変更系の承認は初期実装では常に拒否する。
- Codexに送る作業ディレクトリは空の一時ディレクトリを基本にする。
- PWAのIndexedDBデータを直接編集させない。

初期対応タスク:

- `ログを要約`
- `解析失敗の原因候補を整理`
- `図鑑空欄の改善案を作成`
- `選択した観察の再解析用プロンプト案を作成`
- `README/issue文案を作成`

初期非対応:

- PWAデータの自動書き換え
- 画像解析本体
- GitHubへの自動push
- shellコマンドの自動承認
- 公開ネットワーク経由の接続

## Phase 3: 深い統合

Phase 2の実験で価値が確認できた場合のみ検討する。

候補:

- Codex thread一覧の表示
- Codex応答のPWAログ保存
- 診断結果からGitHub issue下書き作成
- 旧版/PWA版の差分分析タスク起動
- バックアップzipをCodexに読み込ませたレポート生成

## リスク

### セキュリティ

Codexはローカルファイルやコマンド実行に関わる可能性がある。PWAからApp Serverを操作する場合、通常の植物図鑑アプリよりリスクが大きい。

対策:

- デフォルト無効
- localhost限定
- token必須
- 承認必須
- 一時ディレクトリ利用
- データ送信プレビュー

### 導入負荷

ローカルブリッジ方式は、PWAの当初目標である `インストール + APIキー入力だけ` から外れる。

対策:

- Codex連携は任意の上級者向け機能にする。
- 通常ユーザーの植物解析導線から切り離す。
- Phase 1のエクスポート方式を先に提供する。

### 公式API安定性

App Serverは公式ドキュメント化されているが、WebSocket transportは experimental / unsupported。生成TypeScript schemaもCodexバージョンに依存する。

対策:

- 初期はstdioをローカルブリッジ側で扱う。
- App Server schemaをbridge側に固定してバージョン管理する。
- PWAはbridge独自の安定APIだけを見る。

## 実装順

1. `Codex支援エクスポート` の仕様詳細化
2. `設定 > Codex支援` 画面の追加
3. 診断zipと `prompt.md` 生成
4. 実データでCodex Appへ手動投入して有用性確認
5. ローカルブリッジのPoC
6. bridgeとPWAの接続確認
7. 承認UIと安全制限の実装

## 採用判断

短期:

- Phase 1は採用してよい。
- Phase 2は実験機能としてなら採用余地あり。
- Phase 3は保留。

現在の推奨:

通常の植物解析機能はGemini APIのまま維持し、Codex App Serverは開発/診断/保守支援に限定する。
