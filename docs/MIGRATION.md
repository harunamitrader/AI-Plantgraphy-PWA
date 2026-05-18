# 旧版 AI-Plantgraphy から PWA 版への移行

更新日: 2026-05-19

## 目的

旧版 `AI-Plantgraphy` の `plants.sqlite` と `images/` を、PWA版のバックアップzipへ変換する。

変換後のzipは、PWA版の `バックアップと復元` 画面から `ZIP を読み込む` で復元できる。

## 対応する入力

### 1. 旧版エクスポートzip

旧版のエクスポート機能で作ったzipをそのまま指定する。

```powershell
python scripts\migrate_legacy_export.py `
  --legacy-zip C:\path\to\ai-plantgraphy-export.zip `
  --output C:\path\to\ai-plantgraphy-pwa-import.zip
```

### 2. 旧版のDBと画像フォルダ

旧版リポジトリの `data\plants.sqlite` と `data\images` を指定する。

```powershell
python scripts\migrate_legacy_export.py `
  --db C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy\data\plants.sqlite `
  --images-dir C:\Users\sgmxk\Desktop\AI\repos\github\harunamitrader\AI-Plantgraphy\data\images `
  --output C:\tmp\ai-plantgraphy-pwa-import.zip
```

`--images-dir` を省略した場合は、`plants.sqlite` と同じ階層の `images` を探す。

## 復元手順

1. PWA版を開く。
2. `バックアップ` を開く。
3. `ZIP を読み込む` を押す。
4. 変換後の `ai-plantgraphy-pwa-import.zip` を選ぶ。

注意: PWA版の復元は現在の端末内データを置き換える。必要なら先にPWA版で `ZIP を書き出す` を実行して退避する。

## 変換内容

- 旧版 `plants` はPWA版 `plants` へ変換する。
- 旧版 `observations` はPWA版 `observations` へ変換する。
- 旧版の観察画像はPWA版 `images` へ変換する。
- PWA表示用に、同じ画像データから `original` と `thumbnail` の2レコードを作る。
- 旧版の `raw_result_json` と `profile_raw_json` はJSONとして読める場合だけ移行する。
- 旧版の実行中ジョブは移行しない。
- APIキーなどの設定は移行しない。

## 既知の制限

- 画像のリサイズは行わない。旧版画像をそのままzipへ入れる。
- 画像の幅・高さメタデータは `0` として移行する。表示には影響しない。
- 画像パスがDBにもzipにも見つからない場合、その画像だけスキップする。
- PWA版へ読み込むと、既存のPWA端末内データは置き換わる。
