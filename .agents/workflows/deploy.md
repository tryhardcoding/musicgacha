---
description: MusicGachaを本番環境にデプロイする
---

# MusicGacha デプロイワークフロー

## 手順

// turbo
1. `node scripts/bump-version.js` を実行する。これにより以下が自動で行われる:
   - `sw.js` の `CACHE_VERSION` を +1 バンプ
   - `index.html` と `js/app.js` 内の `?v=YYYYMMDD[a-z]` を更新
   - BOM（Byte Order Mark）の検出・除去

// turbo
2. `git status --short` で変更ファイルを確認する。

3. 変更内容を適切なコミットメッセージで `git add -A; git commit -m "<message>"` する。コミットメッセージは英語で、変更内容を簡潔に記述する。SWキャッシュバンプとバージョンパラメータ更新は本体の変更と同一コミットに含める。

4. `git push origin master` でデプロイする。

## 重要な注意事項

- **キャッシュバージョンのバンプは必須**。忘れるとService Workerの更新サイクルが起きない。
- **バージョンパラメータの更新は必須**。JS/CSSは24時間CDNキャッシュされるが、バージョンパラメータが変わるとCDNに別URLとして認識されるため即時反映される。
- HTMLは `no-cache` なので常にサーバーから最新版を取得する。
- `sw.js` も `no-cache` なのでブラウザが常に最新をチェックする。
- デプロイ対象ブランチは `master`。
- Cloudflare Pages が自動的にビルド・デプロイを行う。

## 禁止事項

- **PowerShell の `Set-Content` でソースコードを書き換えてはならない**。Windows PowerShell 5.x の `-Encoding UTF8` はUTF-8 BOM を挿入し、HTML/JSの解析を破壊する。ファイル編集は必ず `node scripts/bump-version.js` またはエディタツール（replace_file_content等）を使うこと。