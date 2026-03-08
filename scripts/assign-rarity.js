/**
 * songs.json の各曲にレアリティを付与するスクリプト
 * 
 * - Listener数（Last.fm）に基づいてレアリティを算出
 * - Apple Chart曲（source: apple_chart_*）はチャート順位に基づくレアリティ
 * - 複数パックに存在する曲は最高レアリティに統一
 * - songs.json に rarity フィールドを追加して上書き保存
 * 
 * 使い方: node scripts/assign-rarity.js
 */

const fs = require('fs');
const path = require('path');

// ---- Listener数ベースのレアリティ閾値 ----
const LISTENER_TIERS = [
    { rarity: 'LR', minListeners: 500000 },   // 50万+ : グローバルヒット
    { rarity: 'UR', minListeners: 200000 },    // 20万+ : メジャーヒット
    { rarity: 'SR', minListeners: 100000 },    // 10万+ : 有名曲
    { rarity: 'R', minListeners: 30000 },     // 3万+  : 人気曲
    { rarity: 'UC', minListeners: 10000 },     // 1万+  : 知られている曲
    { rarity: 'C', minListeners: 0 },         // それ以下: ニッチ
];

// Apple Chart順位ベースのレアリティ（playcountが擬似値の曲用）
const CHART_RANK_TIERS = [
    { rarity: 'LR', maxRank: 10 },
    { rarity: 'UR', maxRank: 30 },
    { rarity: 'SR', maxRank: 60 },
    { rarity: 'R', maxRank: 100 },
    { rarity: 'UC', maxRank: 150 },
    { rarity: 'C', maxRank: Infinity },
];

const RARITY_ORDER = { LR: 6, UR: 5, SR: 4, R: 3, UC: 2, C: 1 };

function getRarityByListeners(listeners) {
    for (const tier of LISTENER_TIERS) {
        if (listeners >= tier.minListeners) {
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
            if (track.source && track.source.startsWith('apple_chart_') && track.rank) {
                // Apple Chart曲: チャート順位ベース（listeners情報があればそちらを優先）
                if (track.listeners && track.listeners > 0) {
                    rarity = getRarityByListeners(track.listeners);
                } else {
                    rarity = getRarityByChartRank(track.rank);
                }
            } else {
                // Last.fm曲: Listener数ベース
                const listeners = track.listeners || track.playcount || 0;
                rarity = getRarityByListeners(listeners);
            }

            // Top200経由の曲: 過去最高順位ベースのレアリティも考慮し、高い方を採用
            if (track.bestChartRank) {
                const chartRarity = getRarityByChartRank(track.bestChartRank);
                if (RARITY_ORDER[chartRarity] > RARITY_ORDER[rarity]) {
                    rarity = chartRarity;
                }
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
    console.log('=== Rarity Assignment Report (Listener-based) ===');
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

    // Listener数の統計
    console.log('\nListener count statistics:');
    const allListeners = [];
    for (const tracks of Object.values(packs)) {
        for (const t of tracks) {
            allListeners.push(t.listeners || t.playcount || 0);
        }
    }
    allListeners.sort((a, b) => b - a);
    console.log(`  Max: ${allListeners[0]}`);
    console.log(`  Median: ${allListeners[Math.floor(allListeners.length / 2)]}`);
    console.log(`  Min: ${allListeners[allListeners.length - 1]}`);
    console.log(`  Zero count: ${allListeners.filter(l => l === 0).length}`);

    // 有名曲の確認
    console.log('\nSpot-check (famous songs):');
    const spotCheck = ['lemon', 'マリーゴールド', 'pretender', 'ドライフラワー'];
    for (const name of spotCheck) {
        const match = Object.entries(globalRarity).find(([k]) => k.includes(name.toLowerCase()));
        if (match) {
            console.log(`  "${name}" → ${match[1]}`);
        }
    }

    console.log('\nDone! songs.json updated with listener-based rarity fields.');
}

main();
