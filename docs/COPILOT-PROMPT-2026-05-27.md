# Copilot引継ぎ用プロンプト

以下をCopilotに貼り付けてください。

```text
あなたは AI-Plantgraphy-PWA の実装を引き継ぐエンジニアです。
返答と作業メモは日本語で書いてください。

対象リポジトリ:
C:\Users\sgmxk\Desktop\AI\repos\local\AI-Plantgraphy-PWA

まず以下の資料を読んで、現在の仕様と実装状況を把握してください。

- C:\Users\sgmxk\Desktop\AI\repos\local\AI-Plantgraphy-PWA\README.md
- C:\Users\sgmxk\Desktop\AI\repos\local\AI-Plantgraphy-PWA\docs\COPILOT-HANDOFF-2026-05-27.md
- C:\Users\sgmxk\Desktop\AI\repos\local\AI-Plantgraphy-PWA\docs\FEATURE-GAP-ANALYSIS.md
- C:\Users\sgmxk\Desktop\AI\repos\local\AI-Plantgraphy-PWA\docs\REAL-DEVICE-CHECKLIST.md
- C:\Users\sgmxk\Desktop\AI\repos\local\AI-Plantgraphy-PWA\docs\TEST-PLAN.md

プロジェクト概要:

AI-Plantgraphy-PWA は、既存の AI-Plantgraphy を PWA として作り直す別プロジェクトです。
目的は、自宅PC、Tailscale、FastAPI、Gemini CLIなしで、Androidスマホから「インストール + APIキー入力」だけで植物観察、AI解析、図鑑化、バックアップを使えるようにすることです。

現在の主要機能:

- PWAインストール導線
- APIキー/モデル/場所ラベル設定
- 観察追加
- カメラ撮影、写真選択、画像プレビュー、1〜3枚選択
- 画像リサイズ/圧縮保存
- 観察解析
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

重要な方針:

- 通常利用でPCサーバーを前提にしない。
- 観察、画像、図鑑、設定、ログはIndexedDBに保存する。
- Gemini APIはユーザーのAPIキーでクライアントから直接呼び出す。
- Discord通知は不要。実装しない。
- 既存AI-Plantgraphyの操作感とデザインに寄せる。
- Gemini向けプロンプトは軽量モデルでも壊れにくいよう、簡潔で堅牢にする。
- 生成/解析中、失敗、停止は確認待ちハブで追えるようにする。
- APIキーや個人情報をログやzipへ不用意に含めない。
- 大規模リファクタリングは避け、依頼された範囲に絞って外科的に変更する。

まず実行する確認:

```powershell
git status --short
npm run lint
npm run build
```

最初に取り組む推奨タスク:

確認待ち画面に検索/フィルタ機能を追加してください。

背景:

docs\FEATURE-GAP-ANALYSIS.md で、確認待ちの検索が未実装です。
観察や図鑑が増えると、解析失敗、生成中、確認待ちの項目を探しにくくなります。

対象ファイル候補:

- C:\Users\sgmxk\Desktop\AI\repos\local\AI-Plantgraphy-PWA\src\features\review\pages\ReviewPage.tsx
- 必要なら C:\Users\sgmxk\Desktop\AI\repos\local\AI-Plantgraphy-PWA\src\app\styles.css

実装仕様:

- 確認待ち画面に検索欄を追加する。
- 検索対象は、植物名、学名、場所、メモ、エラーメッセージ、ジョブラベルなど、画面上で探したい主要テキスト。
- 観察/図鑑の種別で絞り込める。
- 生成中/失敗/確認待ちなど状態で絞り込める。
- 件数表示は絞り込み後の件数に追従する。
- 既存のカード表示や操作ボタンは壊さない。
- 既存デザインに合わせる。新しい派手なUIにはしない。

完了条件:

- 確認待ち画面で検索/フィルタが使える。
- 観察項目と図鑑項目の両方が絞り込める。
- フィルタを解除すると元の一覧に戻る。
- npm run lint が成功する。
- npm run build が成功する。
- 変更内容、検証結果、残課題を日本語で報告する。

作業上の注意:

- IndexedDB schemaの変更は原則不要。
- Gemini APIやバックアップ形式は触らない。
- 関係ないファイルの整形変更は避ける。
- 既存のユーザーデータを消す処理は追加しない。
- 実装前に不明点があれば、選択肢つきで質問する。
```
