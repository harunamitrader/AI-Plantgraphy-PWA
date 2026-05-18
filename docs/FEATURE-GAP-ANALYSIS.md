# AI-Plantgraphy 既存版と PWA 版の機能差分

作成日: 2026-05-17
更新日: 2026-05-19

## 目的

既存の `AI-Plantgraphy` でできることのうち、`AI-Plantgraphy-PWA` でまだできないこと、または仕様上あえて置き換わっていることを整理する。

対象:

- 既存版: `C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy`
- PWA版: `C:\Users\sgmxk\Desktop\AI\repos\local\AI-Plantgraphy-PWA`

## 結論

PWA版は `インストール + APIキー入力` だけで使う目的には近づいているが、既存版の運用機能をすべて置き換える段階ではない。

特に差が大きいのは以下。

- 図鑑詳細の観察履歴と複数写真表示
- 診断、接続ガイド、ログ、Discord通知などの保守機能
- 既存SQLite/画像からPWA形式への移行

一方で、PWA版では自宅PC、Tailscale、Gemini CLI、FastAPIが不要になるため、それらに依存する機能は同じ形で移植する必要はない。

## 差分一覧

| 分類 | 既存版でできること | PWA版の現状 | 影響 | 優先度 |
| --- | --- | --- | --- | --- |
| 観察追加 | 連続カメラ、通常カメラ、写真選択を分けて使える | 対応済み | 旧版に近い撮影導線になった | 低 |
| 観察追加 | 画像候補をプレビューし、1〜3枚を選択できる | 対応済み | 送信前に選択を確認できる | 低 |
| 観察追加 | 送信前に画像をブラウザ側で軽量化する | 対応済み。保存画像は長辺1280px以内、サムネイルは480px以内へJPEG化 | 保存量とAPI送信量を抑えやすい | 低 |
| 観察詳細 | 候補名、候補理由、見えている特徴、不確実な点を画面表示 | 対応済み | 解析結果を画面上で確認できる | 低 |
| 観察詳細 | 候補から植物名・学名を修正欄へ反映できる | 対応済み | 低信頼解析を手動補正しやすい | 低 |
| 観察詳細 | 植物名、学名、メモ、場所ラベルを手動修正できる | 対応済み | 誤判定を手動で復旧できる | 低 |
| 観察詳細 | 観察を削除でき、画像も削除される | 対応済み | 不要データを画面から削除できる | 低 |
| 観察詳細 | 再解析ボタンがある | 対応済み | 詳細から直接復旧できる | 低 |
| 観察詳細 | 解析中の強制停止ボタンがある | 対応済み。停止要求後に戻った結果は保存しない | 長時間実行を止められる | 低 |
| 解析堅牢性 | スキーマ違反時に再試行し、別スキーマも正規化する | 対応済み。観察解析は救済正規化と1回再試行を行う | 軽量モデルの崩れたJSONを救済しやすい | 低 |
| 解析堅牢性 | Gemini CLIの空応答・非JSON応答に再試行する | 対応済み。PWA版はGemini APIの空応答・非JSON・空項目時に簡素プロンプトで1回再試行する | 図鑑項目欠落や解析失敗を減らせる | 低 |
| 図鑑生成 | 図鑑項目が欠けた場合に補完生成する | 対応済み。本文3項目が空なら1回再生成する | 手入れメモなどの空欄を減らせる | 低 |
| 図鑑詳細 | 新しいものから最大12枚の関連写真を表示 | 代表画像1枚のみ | 成長・季節変化を見返しにくい | 中 |
| 図鑑詳細 | 観察履歴を表示する | 観察履歴リストなし | 図鑑から観察へ戻りにくい | 高 |
| 図鑑詳細 | 図鑑生成時間と生成JSONを表示 | 生成JSONは表示。生成時間も一部表示 | ほぼ対応済み | 低 |
| 図鑑一覧 | 代表画像、植物名、学名、検索 | 対応済み | 旧版と大きな差なし | 低 |
| 確認待ち | 観察と図鑑の生成中・失敗を集約 | 対応済み | 旧版と大きな差なし | 低 |
| 確認待ち | 検索 | 未実装 | 件数が増えると探しにくい | 中 |
| 設定 | 場所ラベル管理 | 対応済み | 旧版と大きな差なし | 低 |
| 設定 | Geminiモデル候補を旧版と同程度に管理 | PWA独自の候補のみ | モデル選択の幅や表記が異なる可能性 | 中 |
| 診断 | Gemini CLI、DB、画像フォルダ、ログ、Tailscaleを診断 | 端末内PWAのため同等診断なし | PWAでは不要な項目も多いが、APIキー/保存容量診断は必要 | 中 |
| 接続 | Tailscale HTTPS URL、LAN URL、QRコード表示 | 不要。GitHub Pages URLだけで起動 | PWAでは仕様差 | 対応不要 |
| 未送信 | PC停止中に下書き保存し、後でPCへ送信 | PWAは最初から端末内保存 | 仕様差。未送信概念は不要 | 対応不要 |
| バックアップ | PC側SQLiteと画像をzip化し、PCにも保存 | PWA内データをzipで書き出し/読み込み | 目的は対応。ただし既存版形式とは互換なし | 中 |
| 移行 | 既存SQLite/画像をそのまま利用 | 移行スクリプトなし | 旧版ユーザーのデータ移行ができない | 高 |
| ログ | `data/logs/server.log` に解析・通知・エラーを記録 | 永続ログなし | 実機トラブル時の原因追跡が難しい | 中 |
| Discord通知 | 解析完了・失敗をWebhook通知 | 未実装 | 通知運用をしている場合は代替なし | 低 |
| PC管理画面 | 保守用HTML、診断、バックアップ、設定 | PWA単体の画面のみ | PWAでは基本不要 | 対応不要 |
| セキュリティ | アプリパスワード + Tailscale前提 | ユーザーAPIキーを端末保存 | 仕様差。APIキー保護は弱い | 継続注意 |

## PWA版で優先して埋めるべき項目

### 1. 観察追加の実用性

対応済み。

実装済み:

- 選択画像のプレビュー
- 1〜3枚の選択切り替え
- 画像削除
- カメラ撮影導線
- 送信/解析前の画像リサイズと圧縮

対象ファイル:

- `C:\Users\sgmxk\Desktop\AI\repos\local\AI-Plantgraphy-PWA\src\features\observations\pages\UploadPage.tsx`
- `C:\Users\sgmxk\Desktop\AI\repos\local\AI-Plantgraphy-PWA\src\storage\repositories\imagesRepository.ts`

### 2. 観察詳細の復旧操作

対応済み。

実装済み:

- 候補一覧の表示
- 見えている特徴の表示
- 不確実な点の表示
- 手動修正フォーム
- 観察削除ボタン
- 詳細画面からの再解析
- 候補クリックで手動修正フォームへ反映
- 解析中の強制停止

対象ファイル:

- `C:\Users\sgmxk\Desktop\AI\repos\local\AI-Plantgraphy-PWA\src\features\observations\pages\ObservationDetailPage.tsx`
- `C:\Users\sgmxk\Desktop\AI\repos\local\AI-Plantgraphy-PWA\src\storage\repositories\observationsRepository.ts`
- `C:\Users\sgmxk\Desktop\AI\repos\local\AI-Plantgraphy-PWA\src\features\observations\services\analysis.ts`

### 3. Gemini応答の堅牢化

対応済み。旧版で実際に問題になった軽量モデルのJSON崩れ、入れ子JSON、空項目をPWA版でも救済する。

実装済み:

- 観察解析のスキーマ違反時の1回再試行
- 図鑑生成の空応答・非JSON応答時の再試行
- 図鑑項目欠落時の補完生成
- `common_name` / `plant_name` / `plant_identification` / `observation_details` の救済正規化強化
- 信頼度の `68` / `68%` / `0.68` 表記の正規化
- 候補理由が欠けた候補の救済
- 観察結果から図鑑化する時の入れ子JSON救済

対象ファイル:

- `C:\Users\sgmxk\Desktop\AI\repos\local\AI-Plantgraphy-PWA\src\services\ai\geminiClient.ts`
- `C:\Users\sgmxk\Desktop\AI\repos\local\AI-Plantgraphy-PWA\src\services\ai\plantProfileClient.ts`

### 4. 図鑑詳細の観察履歴

旧版の「同じ植物の成長や季節変化を見返す」価値に直結する。

実装候補:

- 図鑑詳細に関連観察リストを表示
- 関連観察のサムネイル、日付、信頼度、メモを表示
- 代表画像だけでなく関連写真を複数表示

対象ファイル:

- `C:\Users\sgmxk\Desktop\AI\repos\local\AI-Plantgraphy-PWA\src\features\plants\pages\PlantDetailPage.tsx`
- `C:\Users\sgmxk\Desktop\AI\repos\local\AI-Plantgraphy-PWA\src\storage\repositories\observationsRepository.ts`

### 5. 既存データ移行

旧版を使っているデータをPWA版へ持ち込めないと、実運用の切り替えが難しい。

実装候補:

- 旧版 `plants.sqlite` と `data/images` からPWAバックアップzipを作る変換スクリプト
- PWA側のインポート仕様との互換確認
- 移行手順書

対象候補:

- `C:\Users\sgmxk\Desktop\AI\repos\local\AI-Plantgraphy-PWA\scripts`
- `C:\Users\sgmxk\Desktop\AI\repos\local\AI-Plantgraphy-PWA\docs\MIGRATION.md`

## PWA版では同じ形で移植しない項目

以下は既存版のPCサーバー構成に依存しているため、PWA版では同じ形で実装しない。

| 既存版機能 | PWA版での扱い |
| --- | --- |
| Tailscale URL表示 | GitHub Pages URLで直接起動するため不要 |
| Tailscale Serve診断 | 不要 |
| PC管理画面 | 不要 |
| FastAPI health/bootstrap/connectivity | 不要 |
| アプリパスワード | 不要。代わりにGemini APIキーを端末保存 |
| PC側SQLiteバックアップ | PWA IndexedDBバックアップに置き換え |
| 未送信下書きからPCへ送信 | PWAでは端末内保存のため不要 |

## 実装順の提案

1. `図鑑詳細の観察履歴と複数写真表示`
2. `旧版データ移行スクリプト`
3. `保存容量・APIキー・バックアップの診断表示`
4. `Discord通知など任意機能`

この順番なら、PWA版を実機で使ったときの不足感を先に減らし、その後に旧版からの移行と保守性を詰められる。
