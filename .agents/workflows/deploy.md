---
description: MusicGachaを本番環境にデプロイする
---

# MusicGacha デプロイワークフロー

## 手順

1. `sw.js` の `CACHE_VERSION` を自動バンプする。現在のバージョン番号を読み取り、数値部分を +1 する（例: `musicgacha-v16` → `musicgacha-v17`）。

// turbo
2. `git status --short` で変更ファイルを確認する。

3. 変更内容を適切なコミットメッセージで `git add -A; git commit -m "<message>"` する。コミットメッセージは英語で、変更内容を簡潔に記述する。SWキャッシュバンプは本体の変更と同一コミットに含める。

4. `git push origin master` でデプロイする。

## 注意事項

- **キャッシュバージョンのバンプは必須**。これを忘れるとユーザーのブラウザが古いService Workerキャッシュを返し続け、変更が反映されない。
- デプロイ対象ブランチは `master`。
- Cloudflare Pages が自動的にビルド・デプロイを行う。
