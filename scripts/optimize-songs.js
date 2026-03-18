#!/usr/bin/env node
// ============================================================
// MusicGacha - songs.json 最適化スクリプト
// フロントエンドで不要なフィールドを除去してファイルサイズを削減
//
// 使い方: node scripts/optimize-songs.js
// 結果:   data/songs.json を直接更新（バックアップは自動作成）
// ============================================================

const fs = require('fs');
const path = require('path');

const SONGS_PATH = path.join(__dirname, '..', 'data', 'songs.json');
const BACKUP_PATH = path.join(__dirname, '..', 'data', 'songs.json.pre-optimize');

// ---- フロントエンドで必要なフィールド ----
// 各フィールドの使用箇所:
//   name            → api.js (曲名), collection.js (フィルタ)
//   artist          → api.js (アーティスト名), collection.js (フィルタ)
//   artworkUrl      → api.js L92 (カバー画像)
//   rarity          → api.js L75 (レアリティフィルタ)
//   previewUrl      → api.js L109 (試聴音声)
//   trackViewUrl    → api.js L106 (iTunes リンク)
//   url             → api.js L106 (trackViewUrl のフォールバック)
//   itunesTrackId   → api.js L98 (カードID)
//   collectionName  → api.js L103 (アルバム名)
//   primaryGenreName→ api.js L105 (ジャンル名)
//   trackTimeMillis → api.js L106 (曲長)
//   releaseDate     → api.js L93 (リリース年)
//   playcount       → api.js L107 (listeners → ATK計算)
const KEEP_FIELDS = new Set([
    'name',
    'artist',
    'artworkUrl',
    'rarity',
    'previewUrl',
    'trackViewUrl',
    'url',
    'itunesTrackId',
    'collectionName',
    'primaryGenreName',
    'trackTimeMillis',
    'releaseDate',
    'playcount',
]);

// ---- 除去されるフィールド ----
// bestChartRank   → フロントエンドで未使用（ビルドスクリプト用）
// itunesSearched  → フロントエンドで未使用（enrichスクリプト用）
// mbid            → 0件、未使用

function main() {
    console.log('=== songs.json 最適化 ===');

    // 読み込み
    const raw = fs.readFileSync(SONGS_PATH, 'utf8');
    const data = JSON.parse(raw);
    const originalSize = Buffer.byteLength(raw, 'utf8');

    console.log(`元ファイルサイズ: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);

    // 除去されるフィールドの統計
    const removedFieldStats = {};
    let totalTracks = 0;

    // 最適化
    const optimized = {
        fetchedAt: data.fetchedAt,
        version: data.version,
        packs: {},
    };

    for (const [packId, tracks] of Object.entries(data.packs)) {
        optimized.packs[packId] = tracks.map(track => {
            totalTracks++;
            const clean = {};
            for (const [key, value] of Object.entries(track)) {
                if (KEEP_FIELDS.has(key)) {
                    // null/undefined/空文字のフィールドも省略
                    if (value !== null && value !== undefined && value !== '') {
                        clean[key] = value;
                    }
                } else {
                    removedFieldStats[key] = (removedFieldStats[key] || 0) + 1;
                }
            }
            return clean;
        });
    }

    // 結果をコンパクトJSONで出力（インデントなし）
    const optimizedJson = JSON.stringify(optimized);
    const optimizedSize = Buffer.byteLength(optimizedJson, 'utf8');

    // バックアップ作成
    if (!fs.existsSync(BACKUP_PATH)) {
        fs.copyFileSync(SONGS_PATH, BACKUP_PATH);
        console.log(`バックアップ作成: ${path.basename(BACKUP_PATH)}`);
    }

    // 書き込み
    fs.writeFileSync(SONGS_PATH, optimizedJson);

    // 統計表示
    console.log(`\n最適化結果:`);
    console.log(`  トラック数: ${totalTracks}`);
    console.log(`  元サイズ:   ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  新サイズ:   ${(optimizedSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  削減量:     ${((originalSize - optimizedSize) / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  削減率:     ${((1 - optimizedSize / originalSize) * 100).toFixed(1)}%`);

    if (Object.keys(removedFieldStats).length > 0) {
        console.log(`\n除去されたフィールド:`);
        for (const [field, count] of Object.entries(removedFieldStats).sort((a, b) => b[1] - a[1])) {
            console.log(`  ${field}: ${count}件`);
        }
    }
}

main();
