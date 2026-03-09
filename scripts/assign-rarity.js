/**
 * songs.json の各曲にレアリティを付与するスクリプト
 * 
 * - 「人気度スコア」= max(listeners, playcount) で算出
 *   （Last.fm の listeners はユニークリスナー数、playcount は再生回数）
 *   （日本の曲は listeners が低めだが playcount が高い傾向があるため、大きい方を採用）
 * - Apple Chart曲（source: apple_chart_*）はチャート順位に基づくレアリティ
 * - 複数パックに存在する曲は最高レアリティに統一
 * - songs.json に rarity フィールドを追加して上書き保存
 * 
 * 使い方: node scripts/assign-rarity.js
 */

const fs = require('fs');
const path = require('path');

// ---- 人気度スコアベースのレアリティ閾値 ----
// スコア = max(listeners, playcount)
const POPULARITY_TIERS = [
    { rarity: 'LR', minScore: 2000000 },   // 200万+ : グローバルヒット / 国民的大ヒット
    { rarity: 'UR', minScore: 500000 },     // 50万+ : メジャーヒット
    { rarity: 'SR', minScore: 100000 },     // 10万+ : 有名曲
    { rarity: 'R', minScore: 30000 },      // 3万+  : 人気曲
    { rarity: 'UC', minScore: 5000 },       // 5千+  : 知られている曲
    { rarity: 'C', minScore: 0 },          // それ以下: ニッチ
];

// Apple Chart順位ベースのレアリティ（listenersもplaycountも無い曲用）
const CHART_RANK_TIERS = [
    { rarity: 'LR', maxRank: 10 },
    { rarity: 'UR', maxRank: 30 },
    { rarity: 'SR', maxRank: 60 },
    { rarity: 'R', maxRank: 100 },
    { rarity: 'UC', maxRank: 150 },
    { rarity: 'C', maxRank: Infinity },
];

const RARITY_ORDER = { LR: 6, UR: 5, SR: 4, R: 3, UC: 2, C: 1 };

function getPopularityScore(track) {
    const listeners = track.listeners || 0;
    const playcount = track.playcount || 0;
    return Math.max(listeners, playcount);
}

function getRarityByScore(score) {
    for (const tier of POPULARITY_TIERS) {
        if (score >= tier.minScore) {
            return tier.rarity;
        }
    }
    return 'C';
}

function getRarityByChartRank(rank) {
    for (const tier of CHART_RANK_TIERS) {
        if (rank <= tier.maxRank) {
            return tier.rarity;
        }
    }
    return 'C';
}

function main() {
    const songsPath = path.join(__dirname, '..', 'data', 'songs.json');
    const data = JSON.parse(fs.readFileSync(songsPath, 'utf-8'));
    const packs = data.packs;

    // Step 1: 全パック・全曲のレアリティを算出し、曲ごとの最高レアリティを記録
    const globalRarity = {};  // key: "artist_lower::name_lower" → highest rarity

    for (const [packId, tracks] of Object.entries(packs)) {
        for (const track of tracks) {
            const key = `${track.artist.toLowerCase()}::${track.name.toLowerCase()}`;

            let rarity;
            const score = getPopularityScore(track);

            if (track.source && track.source.startsWith('apple_chart_') && track.rank && score === 0) {
                // Apple Chart曲でスコアが無い場合: チャート順位ベース
                rarity = getRarityByChartRank(track.rank);
            } else {
                // 通常: 人気度スコアベース
                rarity = getRarityByScore(score);
            }

            if (!globalRarity[key] || RARITY_ORDER[rarity] > RARITY_ORDER[globalRarity[key]]) {
                globalRarity[key] = rarity;
            }
        }
    }

    // Step 2: 全曲にレアリティフィールドを付与（最高レアリティで統一）
    let totalAssigned = 0;

    for (const [packId, tracks] of Object.entries(packs)) {
        for (const track of tracks) {
            const key = `${track.artist.toLowerCase()}::${track.name.toLowerCase()}`;
            track.rarity = globalRarity[key];
            totalAssigned++;
        }
    }

    // Step 3: 保存
    fs.writeFileSync(songsPath, JSON.stringify(data, null, 2), 'utf-8');

    // レポート
    console.log('=== Rarity Assignment Report (Popularity Score) ===');
    console.log(`Score = max(listeners, playcount)`);
    console.log(`Total songs across all packs: ${totalAssigned}`);
    console.log(`Unique songs (by key): ${Object.keys(globalRarity).length}`);

    console.log('\nRarity distribution (global unique):');
    const globalDist = {};
    for (const r of Object.values(globalRarity)) {
        globalDist[r] = (globalDist[r] || 0) + 1;
    }
    for (const r of ['LR', 'UR', 'SR', 'R', 'UC', 'C']) {
        const count = globalDist[r] || 0;
        const pct = ((count / Object.keys(globalRarity).length) * 100).toFixed(1);
        console.log(`  ${r}: ${count} (${pct}%)`);
    }

    // パックごとのレアリティ分布
    console.log('\nPer-pack rarity distribution:');
    for (const [packId, tracks] of Object.entries(packs)) {
        const dist = {};
        for (const t of tracks) {
            dist[t.rarity] = (dist[t.rarity] || 0) + 1;
        }
        const line = ['LR', 'UR', 'SR', 'R', 'UC', 'C'].map(r => `${r}:${dist[r] || 0}`).join(' ');
        console.log(`  ${packId}: ${line} (total: ${tracks.length})`);
    }

    // 有名曲の確認
    console.log('\nSpot-check (famous songs):');
    const spotCheck = ['lemon', 'マリーゴールド', 'pretender', 'ドライフラワー', '残酷な天使のテーゼ', '千本桜', 'kickback', 'idol'];
    for (const name of spotCheck) {
        for (const [packId, tracks] of Object.entries(packs)) {
            const match = tracks.find(t => t.name.toLowerCase().includes(name.toLowerCase()));
            if (match) {
                const score = getPopularityScore(match);
                console.log(`  "${match.name}" (${match.artist}) → ${match.rarity} [score: ${score.toLocaleString()}]`);
                break;
            }
        }
    }

    console.log('\nDone! songs.json updated with popularity-based rarity fields.');
}

main();
