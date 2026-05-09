# AI-Plantgraphy PWA アーキテクチャ

## 1. 目的

本書は、`C:\Users\sgmxk\Desktop\AI\repos\local\AI-Plantgraphy-PWA\docs\SPECIFICATION.md` を実装に落とすための構成方針をまとめる。

対象は、次の条件を満たす PWA である。

- Android で快適に動く
- `インストール + APIキー入力` だけで利用開始できる
- サーバーなしで運用できる
- 観察、図鑑、画像を端末内に保存できる

## 2. 全体構成

### 2.1 レイヤー

1. UI レイヤー
2. アプリケーションレイヤー
3. ドメインレイヤー
4. ストレージレイヤー
5. 外部API レイヤー

### 2.2 役割

- UI レイヤー
  - ページ、フォーム、一覧、モーダル、進捗表示
- アプリケーションレイヤー
  - 観察追加、解析実行、図鑑生成、エクスポートなどのユースケース
- ドメインレイヤー
  - Observation、Plant、ImageAsset、Settings の整形とバリデーション
- ストレージレイヤー
  - IndexedDB への保存、読み出し、更新
- 外部API レイヤー
  - Gemini API 呼び出し

## 3. 推奨ディレクトリ構成

```text
src/
  app/
    routes/
    providers/
    store/
  features/
    observations/
      components/
      pages/
      hooks/
      services/
    plants/
      components/
      pages/
      hooks/
      services/
    settings/
      components/
      pages/
    backup/
      services/
  services/
    ai/
    images/
    export/
    import/
  storage/
    db/
    repositories/
  types/
  utils/
```

## 4. 主要モジュール

### 4.1 SettingsService

責務:

- API キー保存
- モデル保存
- プロバイダ保存
- 場所ラベル保存

保存先:

- IndexedDB もしくは localStorage

方針:

- API キーは UI に常時平文表示しない
- 入力済みかどうかだけ明確に示す

### 4.2 ObservationRepository

責務:

- 観察一覧取得
- 観察詳細取得
- 観察追加
- 観察更新
- 観察削除

保存対象:

- メタデータ
- rawResult
- status
- timing

### 4.3 PlantRepository

責務:

- 図鑑一覧取得
- 図鑑詳細取得
- 図鑑作成
- 図鑑更新
- 図鑑削除
- 既存図鑑判定

### 4.4 ImageRepository

責務:

- 画像保存
- 画像取得
- 画像削除
- サムネイル生成

初期方針:

- 画像 Blob を IndexedDB 保存
- 画像数や容量問題が出たら OPFS 導入を検討

### 4.5 AnalysisService

責務:

- 観察画像のAI解析
- JSON スキーマ検証
- 再試行
- 失敗処理

仕様:

- 画像から植物候補を構造化JSONで取得
- スキーマ違反時は 1 回だけ再試行
- 低信頼時は `needs_review`
- 異常終了時は `analysis_failed`

### 4.6 PlantGenerationService

責務:

- 観察から図鑑生成
- 和名から図鑑生成
- 既存図鑑チェック
- 学名の曖昧性ガード

ルール:

- 手動図鑑生成の入力は和名のみ
- 和名一致か学名一致で既存図鑑ありとみなす
- AI が学名を十分に特定できなければ作成しない

### 4.7 BackupService

責務:

- ZIP エクスポート
- ZIP インポート
- バージョン整合確認

## 5. 画面構成

### 5.1 画面一覧

- ホーム
- 図鑑一覧
- 図鑑詳細
- 観察一覧
- 観察詳細
- 観察追加
- 確認待ち一覧
- 設定
- バックアップ / 復元

### 5.2 状態遷移

- 観察追加
  - `queued`
  - `analyzing`
  - `analyzed`
  - `needs_review`
  - `analysis_failed`

### 5.3 強制停止

PWA では OS プロセスを kill するのではなく、アプリ内ジョブを中断する。

実装方針:

- `AbortController` を使って fetch を停止する
- UI 側状態を `analysis_failed` に遷移させる
- 中断理由を保存する

## 6. ストレージ設計

### 6.1 IndexedDB データベース案

DB 名:

- `ai-plantgraphy-pwa`

object stores:

- `settings`
- `observations`
- `plants`
- `images`
- `jobs`

### 6.2 observations store

key:

- `id`

indexes:

- `status`
- `createdAt`
- `plantId`

### 6.3 plants store

key:

- `id`

indexes:

- `displayName`
- `commonNameJa`
- `scientificName`
- `updatedAt`

### 6.4 images store

key:

- `id`

fields:

- blob
- mimeType
- width
- height
- createdAt

## 7. AI 呼び出し設計

### 7.1 基本方針

- ブラウザから Gemini API を直接呼ぶ
- API キーはユーザー端末内保存
- 複数モデルを選べるようにするが、初期選択肢は少なく保つ

### 7.2 解析プロンプト設計

要件:

- 短い
- 軽量モデルで破綻しにくい
- JSON 契約を先頭に置く
- 禁止キーを明示する

### 7.3 手動図鑑生成

二段階に分ける。

1. 和名から学名を特定
2. 学名が十分確定したら本文生成

この分割で、誤った学名や誤った本文を抑える。

## 8. UI 状態管理

### 8.1 候補

- React Context + reducer
- Zustand

推奨:

- Zustand

理由:

- IndexedDB 同期状態を扱いやすい
- 観察ジョブや進捗管理を分離しやすい

### 8.2 キャッシュ

- 一覧と詳細は IndexedDB を正本とする
- メモリ状態は表示高速化用のキャッシュとする

## 9. PWA 実装方針

### 9.1 Service Worker

役割:

- アプリシェルのキャッシュ
- オフライン時の画面維持
- バージョン更新時の再配信

### 9.2 オフライン対応

オンライン必須:

- AI 解析
- 図鑑生成

オフライン可:

- 閲覧
- 削除
- 手動修正
- エクスポート

## 10. セキュリティ方針

### 10.1 API キー

- 端末内保存
- UI でマスク表示
- コピー導線は必要時のみ

### 10.2 XSS 対策

- ユーザー入力は HTML として描画しない
- innerHTML の乱用を避ける
- markdown 表示は初期スコープ外

## 11. エラー処理方針

### 11.1 失敗の扱い

- 失敗は silent にしない
- 状態を明確に残す
- 復旧導線を同じ画面に置く

### 11.2 代表メッセージ

- API キーが未設定です
- API 呼び出しに失敗しました
- 学名を十分に特定できませんでした
- 既存の図鑑があります
- 解析を強制停止しました

## 12. 将来拡張の余地

### 12.1 追加候補

- 端末間同期
- 複数 LLM プロバイダ
- タグ分類
- マップ表示
- カレンダー表示
- 共有用エクスポート

### 12.2 拡張方針

初期リリースでは拡張性を過剰に作り込まず、モジュール境界だけ整える。

---

このアーキテクチャは、「サーバー不要」「PWA 完結」「導入が軽い」という制約を優先した設計である。
