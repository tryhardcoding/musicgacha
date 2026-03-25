---
description: MusicGachaを本番環境にデプロイする
---

# MusicGacha デプロイワークフロー

## 手順

1. `sw.js` の `CACHE_VERSION` を自動バンプする。現在のバージョン番号を読み取り、数値部分を +1 する（例: `musicgacha-v18` → `musicgacha-v19`）。

2. `index.html` 内のバージョンパラメータ `?v=YYYYMMDD[a-z]` を全て更新する。対象は以下:
   - `index.css?v=...`
   - `js/sw-bootstrap.js?v=...`
   - `js/init.js?v=...`
   - `js/app.js?v=...`

3. `js/app.js` 内のESモジュール import 文のバージョンパラメータも同じ値に更新する（全14行の `?v=...` 部分）。

// turbo
4. `git status --short` で変更ファイルを確認する。

5. 変更内容を適切なコミットメッセージで `git add -A; git commit -m "<message>"` する。コミットメッセージは英語で、変更内容を簡潔に記述する。SWキャッシュバンプとバージョンパラメータ更新は本体の変更と同一コミットに含める。

6. `git push origin master` でデプロイする。

## 重要な注意事項

- **キャッシュバージョンのバンプは必須**。忘れるとService Workerの更新サイクルが起きない。
- **バージョンパラメータの更新は必須**。JS/CSSは24時間CDNキャッシュされるが、バージョンパラメータが変わるとCDNに別URLとして認識されるため即時反映される。
- HTMLは `no-cache` なので常にサーバーから最新版を取得する。
- `sw.js` も `no-cache` なのでブラウザが常に最新をチェックする。
- デプロイ対象ブランチは `master`。
- Cloudflare Pages が自動的にビルド・デプロイを行う。
