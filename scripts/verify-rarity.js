/**
 * songs.json のレアリティ整合性検証スクリプト (stored rarity版)
 */
const fs = require('fs');
const path = require('path');

const songsPath = path.join(__dirname, '..', 'data', 'songs.json');
const data = JSON.parse(fs.readFileSync(songsPath, 'utf-8'));
const packs = data.packs;

// 各パックのレアリティ分布
for (const [packId, tracks] of Object.entries(packs)) {
    const dist = {};
    for (const t of tracks) {
        dist[t.rarity] = (dist[t.rarity] || 0) + 1;
    }
    const line = ['LR', 'UR', 'SR', 'R', 'UC', 'C'].map(r => `${r}:${dist[r] || 0}`).join(' ');
    console.log(`${packId} (${tracks.length}): ${line}`);
}

// パック間の整合性チェック
const songRarities = {};
for (const [packId, tracks] of Object.entries(packs)) {
    if (packId === 'standard') continue;
    for (const t of tracks) {
        const key = `${t.artist.toLowerCase()}::${t.name.toLowerCase()}`;
        if (!songRarities[key]) songRarities[key] = {};
        songRarities[key][packId] = t.rarity;
    }
}

let crossPackSongs = 0;
let mismatchCount = 0;
const mismatches = [];

for (const [key, packMap] of Object.entries(songRarities)) {
    const packIds = Object.keys(packMap);
    if (packIds.length > 1) {
        crossPackSongs++;
        const rarities = new Set(Object.values(packMap));
        if (rarities.size > 1) {
            mismatchCount++;
            if (mismatches.length < 5) mismatches.push({ song: key, packs: packMap });
        }
    }
}

console.log(`\nCross-pack songs: ${crossPackSongs}`);
console.log(`Rarity mismatches: ${mismatchCount}`);
if (mismatches.length > 0) {
    for (const m of mismatches) {
        console.log(`  ${m.song}: ${JSON.stringify(m.packs)}`);
    }
}
