# AI-Plantgraphy PWA

AI-Plantgraphy PWA は、植物観察と植物図鑑を `PWA` として提供する新規プロジェクトです。

目的は、既存の AI-Plantgraphy より導入負荷を大きく下げ、ユーザーが `インストール + APIキー入力` だけで使い始められるようにすることです。

このプロジェクトは、次の前提で設計します。

- 自宅PCや常時稼働サーバーを使わない
- GitHub Pages などの静的ホスティングで配信する
- 観察、図鑑、画像、設定はユーザー端末内に保存する
- LLM API はユーザーが設定した API キーで直接呼び出す

## 主要ドキュメント

- 仕様書: [docs/SPECIFICATION.md](docs/SPECIFICATION.md)
- アーキテクチャ: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- テスト計画: [docs/TEST-PLAN.md](docs/TEST-PLAN.md)
- 実機確認チェックリスト: [docs/REAL-DEVICE-CHECKLIST.md](docs/REAL-DEVICE-CHECKLIST.md)
- 実装計画: [docs/IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md)
- データモデル: [docs/DATA-MODEL.md](docs/DATA-MODEL.md)
- 画面ワイヤー: [docs/UI-WIREFRAME.md](docs/UI-WIREFRAME.md)
- 既存版との差分: [docs/FEATURE-GAP-ANALYSIS.md](docs/FEATURE-GAP-ANALYSIS.md)
- 旧版からの移行: [docs/MIGRATION.md](docs/MIGRATION.md)

## プロダクト方針

- 観察追加から解析完了までを Android だけで完結させる
- 画像解析や図鑑生成は軽量モデルでも壊れにくい JSON 契約で行う
- 学名が曖昧なときは誤生成するより止める
- 同期よりも導入の手軽さを優先する

## 現在の実装状況

- PWA インストール導線
- API キー設定
- 観察追加
- 観察解析
- 図鑑自動生成
- 和名からの手動図鑑生成
- 観察からの図鑑生成 / 再生成
- 図鑑削除
- 確認待ちハブ
- エクスポート / インポート
- 診断表示
- 永続ログ表示
- 旧版データ移行スクリプト
- オフライン時 / API キー未設定時の安全な案内

## 技術方針

- `React + TypeScript + Vite`
- `vite-plugin-pwa`
- `IndexedDB` を主要データストアにする
- 画像はまず `IndexedDB Blob` で持ち、必要なら `OPFS` へ拡張する
- LLM プロバイダは初期段階では Gemini API を優先する

## リポジトリ構成案

```text
AI-Plantgraphy-PWA/
  docs/
    SPECIFICATION.md
    ARCHITECTURE.md
    TEST-PLAN.md
  src/
    app/
    features/
    services/
    storage/
    types/
  public/
    icons/
    manifest.webmanifest
```

## 開発メモ

- 実装は `React + TypeScript + Vite` の構成で進めています
- データ保存は `IndexedDB` を中心に組み、画像も端末内で保持します
- Gemini API はクライアントから直接呼び出します
- 旧版 `AI-Plantgraphy` で有効だった JSON 正規化や進行状態の維持は、必要なものから順次移植しています

## 注意事項

- この設計では API キーをクライアント端末に保存するため、バックエンド保護型より安全性は低いです
- 一般大規模公開を目指す場合は、別途バックエンド保護型への再設計を検討してください
