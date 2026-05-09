# AI-Plantgraphy PWA データモデル

## 1. 目的

本書は、`C:\Users\sgmxk\Desktop\AI\repos\local\AI-Plantgraphy-PWA\docs\SPECIFICATION.md` と `C:\Users\sgmxk\Desktop\AI\repos\local\AI-Plantgraphy-PWA\docs\ARCHITECTURE.md` を実装するための、具体的なデータモデルと IndexedDB スキーマを定義する。

## 2. 設計方針

- 正本データはすべて端末ローカルに持つ
- UI 表示専用の派生値は、保存時に持ちすぎず必要時に導出する
- 既存 AI-Plantgraphy の概念を保ちながら、SQLite ではなく IndexedDB 向けに再構成する
- 将来のエクスポート/インポートを考慮して、各エンティティに `schemaVersion` を持たせる

## 3. エンティティ一覧

- `AppSettings`
- `Observation`
- `Plant`
- `ImageAsset`
- `AnalysisJob`
- `ExportManifest`

## 4. AppSettings

### 4.1 用途

アプリ全体の設定を保存する。

### 4.2 フィールド

```ts
type AppSettings = {
  id: "app-settings";
  schemaVersion: 1;
  apiProvider: "gemini";
  apiKey: string;
  model: string;
  locationLabels: string[];
  createdAt: string;
  updatedAt: string;
};
```

### 4.3 補足

- `apiKey` は初期実装では平文保存
- 将来暗号化を入れる余地は残すが、初期スコープ外

## 5. Observation

### 5.1 用途

植物観察の最小単位。

### 5.2 フィールド

```ts
type ObservationStatus =
  | "queued"
  | "analyzing"
  | "analyzed"
  | "needs_review"
  | "analysis_failed";

type Observation = {
  id: string;
  schemaVersion: 1;
  plantId: string | null;
  status: ObservationStatus;
  capturedAt: string | null;
  receivedAt: string;
  note: string;
  locationLabel: string;
  latitude: number | null;
  longitude: number | null;
  imageIds: string[];
  confidence: number | null;
  rawResult: AnalysisResult | null;
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
};
```

### 5.3 制約

- `imageIds.length` は `1..3`
- `confidence` は `0.0..1.0` か `null`
- `status === "analysis_failed"` のとき `errorMessage` が入りうる

### 5.4 派生値

保存しないもの:

- `displayName`
- `statusLabel`
- `confidencePercent`
- `observedLabel`

これらは UI 側で導出する。

## 6. Plant

### 6.1 用途

図鑑カード、および観察群の集約。

### 6.2 フィールド

```ts
type PlantCreatedFrom = "observation" | "manual";

type Plant = {
  id: string;
  schemaVersion: 1;
  displayName: string;
  commonNameJa: string | null;
  scientificName: string | null;
  aliases: string[];
  basicProfileText: string;
  visualAppealText: string;
  careNotes: string;
  representativeImageId: string | null;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
  observationCount: number;
  userCorrected: boolean;
  createdFrom: PlantCreatedFrom;
  createdAt: string;
  updatedAt: string;
};
```

### 6.3 重複判定ルール

- `scientificName` が完全一致すれば同一候補
- 見つからなければ `commonNameJa` の完全一致で同一候補
- 手動図鑑生成では、既存候補が見つかったら新規作成しない

### 6.4 制約

- `displayName` は必須
- `observationCount` は 0 以上
- 手動作成植物は `observationCount = 0` を許容する

## 7. ImageAsset

### 7.1 用途

観察画像とサムネイルを保持する。

### 7.2 フィールド

```ts
type ImageAsset = {
  id: string;
  schemaVersion: 1;
  kind: "original" | "thumbnail";
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
  sourceObservationId: string | null;
  createdAt: string;
};
```

### 7.3 補足

- サムネイルは別レコードで持つ
- `sourceObservationId` は画像の所有元追跡に使う

## 8. AnalysisResult

### 8.1 用途

AI 解析の生に近い構造化結果。

### 8.2 フィールド

```ts
type Candidate = {
  commonNameJa: string | null;
  scientificName: string | null;
  confidence: number;
  reason: string;
};

type AnalysisTiming = {
  copyImagesSeconds?: number;
  apiCallSeconds?: number;
  parseSeconds?: number;
  profileFillSeconds?: number;
  totalSeconds?: number;
  imageCount?: number;
  model?: string;
};

type AnalysisResult = {
  commonNameJa: string | null;
  scientificName: string | null;
  confidence: number | null;
  candidates: Candidate[];
  aiCandidates?: Candidate[];
  visibleFeatures: string[];
  uncertaintyNotes: string;
  basicProfileText?: string;
  visualAppealText?: string;
  careNotes?: string;
  geminiModel?: string;
  analysisTiming?: AnalysisTiming;
  userCorrected?: boolean;
};
```

### 8.3 既存コードとの対応

既存 `server/app/services/gemini_cli.py` の `normalize_result()` で扱っている概念を TypeScript 側へ移植する。

## 9. AnalysisJob

### 9.1 用途

ブラウザ側で実行中の解析状態を管理する。

### 9.2 フィールド

```ts
type AnalysisJob = {
  id: string;
  schemaVersion: 1;
  observationId: string;
  phase:
    | "queued"
    | "preparing"
    | "identifying"
    | "writing_profile"
    | "saving"
    | "finished"
    | "failed"
    | "stopping";
  label: string;
  percent: number;
  startedAt: number;
  updatedAt: number;
  cancelRequested: boolean;
};
```

### 9.3 補足

- 長期保存の対象ではなく、基本は一時状態
- 初期実装では IndexedDB ではなくメモリ + 軽い永続化でもよい
- ただしアプリ再読み込み後の停滞回収を考えるなら store 化する

## 10. ExportManifest

### 10.1 用途

ZIP エクスポート時のメタデータ。

### 10.2 フィールド

```ts
type ExportManifest = {
  format: "ai-plantgraphy-pwa-export";
  version: 1;
  exportedAt: string;
  observationCount: number;
  plantCount: number;
  imageCount: number;
};
```

## 11. IndexedDB スキーマ

### 11.1 DB 情報

```ts
dbName = "ai-plantgraphy-pwa";
dbVersion = 1;
```

### 11.2 Object Stores

#### settings

- keyPath: `id`

#### observations

- keyPath: `id`
- indexes:
  - `by-status`
  - `by-createdAt`
  - `by-updatedAt`
  - `by-plantId`

#### plants

- keyPath: `id`
- indexes:
  - `by-displayName`
  - `by-commonNameJa`
  - `by-scientificName`
  - `by-updatedAt`

#### images

- keyPath: `id`
- indexes:
  - `by-sourceObservationId`
  - `by-kind`

#### jobs

- keyPath: `id`
- indexes:
  - `by-observationId`
  - `by-updatedAt`

## 12. 生成・更新ルール

## 12.1 Observation 作成

- `id` は `obs-<timestamp>-<random>`
- `status = "queued"`
- `receivedAt = now`
- `plantId = null`

## 12.2 Observation 解析成功

- `rawResult` を保存
- `confidence` を保存
- `status` は confidence に応じて:
  - `confidence >= 0.65` -> `analyzed`
  - それ未満 -> `needs_review`

## 12.3 Plant 自動生成

- 高信頼観察から図鑑を作成
- 既存植物があれば紐づけて count 更新
- なければ新規作成

## 12.4 Plant 手動生成

- 入力は和名のみ
- 既存植物があれば新規作成しない
- 学名が十分特定できたときだけ新規作成

## 12.5 Plant 削除

- `Plant` レコード削除
- `Observation` は残す
- 関連 `plantId` は `null`

## 12.6 Observation から図鑑再生成

- 観察の `rawResult` があれば `Plant` を再構築可能
- `commonNameJa` か `scientificName` のどちらかが必要

## 13. バリデーション

### 13.1 Observation

- 画像0枚は不可
- 画像4枚以上は不可
- locationLabel は文字列
- note は長すぎる場合 UI 側で制限

### 13.2 Plant

- 手動作成時、`displayName` は必須
- `basicProfileText`、`visualAppealText`、`careNotes` は空をなるべく避ける

### 13.3 AnalysisResult

- `commonNameJa` / `scientificName` は `null` 許容
- `confidence` は `null` か `0..1`
- `visibleFeatures` は最大 5 件
- `candidates` は最大 3 件

## 14. TypeScript 実装指針

### 14.1 型定義場所

- `src/types/domain.ts`
- `src/types/ai.ts`
- `src/types/storage.ts`

### 14.2 正規化関数

候補:

- `normalizeAnalysisResult()`
- `normalizeCandidateList()`
- `normalizeVisibleFeatures()`
- `buildPlantFromObservation()`

## 15. 将来の拡張余地

- `provider` フィールド追加で複数 LLM 対応
- `tags` による分類
- `syncState` による将来同期
- `favorite` 追加

## 16. このモデルで先に実装する順

1. `AppSettings`
2. `ImageAsset`
3. `Observation`
4. `AnalysisResult`
5. `Plant`
6. `AnalysisJob`
7. `ExportManifest`

---

このデータモデルは、既存 AI-Plantgraphy のユースケースを保ちながら、PWA 向けローカル完結構成に移すための最小構成である。
