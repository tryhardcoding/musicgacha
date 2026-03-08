/**
 * songs.json のレアリティ分析スクリプト
 */
const fs = require('fs');
const path = require('path');

const songsPath = path.join(__dirname, '..', 'data', 'songs.json');
const data = JSON.parse(fs.readFileSync(songsPath, 'utf-8'));

const RARITY_TIERS = {
    LR: { startPct: 0, endPct: 2 },
    UR: { startPct: 2, endPct: 7 },
    SR: { startPct: 7, endPct: 17 },
    R: { startPct: 17, endPct: 35 },
    UC: { startPct: 35, endPct: 60 },
    C: { startPct: 60, endPct: 100 },
};

const packs = data.packs;

for (const [packId, tracks] of Object.entries(packs)) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Pack: ${packId} (${tracks.length} tracks)`);
    console.log(`${'='.repeat(60)}`);

    for (const [rarity, tier] of Object.entries(RARITY_TIERS)) {
        const start = Math.floor(tracks.length * tier.startPct / 100);
        const end = Math.floor(tracks.length * tier.endPct / 100);
        const tierTracks = tracks.slice(start, Math.max(end, start + 1));

        const firstTrack = tierTracks[0];
        const lastTrack = tierTracks[tierTracks.length - 1];

        console.log(`\n  [${rarity}] index ${start}-${end - 1} (${tierTracks.length} tracks)`);
        console.log(`    Playcount range: ${lastTrack?.playcount || '?'} ~ ${firstTrack?.playcount || '?'}`);

        // 3曲例を表示（先頭、中間、末尾）
        const examples = [];
        if (tierTracks.length >= 1) examples.push(tierTracks[0]);
        if (tierTracks.length >= 3) examples.push(tierTracks[Math.floor(tierTracks.length / 2)]);
        if (tierTracks.length >= 2) examples.push(tierTracks[tierTracks.length - 1]);

        for (const t of examples) {
            console.log(`    - "${t.name}" by ${t.artist} (playcount: ${t.playcount})`);
        }
    }
}

// パック間で同じ曲が異なるレアリティになるかチェック
console.log(`\n${'='.repeat(60)}`);
console.log(`Cross-pack rarity consistency check`);
console.log(`${'='.repeat(60)}`);

// 各パックで全曲のレアリティを記録
const songRarities = {}; // key: "artist::name", value: { packId: rarity }

for (const [packId, tracks] of Object.entries(packs)) {
    if (packId === 'standard') continue; // standardは全マージなのでスキップ

    for (const [rarity, tier] of Object.entries(RARITY_TIERS)) {
        const start = Math.floor(tracks.length * tier.startPct / 100);
        const end = Math.floor(tracks.length * tier.endPct / 100);
        const tierTracks = tracks.slice(start, Math.max(end, start + 1));

        for (const t of tierTracks) {
            const key = `${t.artist.toLowerCase()}::${t.name.toLowerCase()}`;
            if (!songRarities[key]) songRarities[key] = {};
            songRarities[key][packId] = rarity;
        }
    }
}

// 複数パックに存在する曲を探す
let crossPackSongs = 0;
let mismatchCount = 0;
const mismatches = [];

for (const [key, packs] of Object.entries(songRarities)) {
    const packIds = Object.keys(packs);
    if (packIds.length > 1) {
        crossPackSongs++;
        const rarities = new Set(Object.values(packs));
        if (rarities.size > 1) {
            mismatchCount++;
            if (mismatches.length < 15) {
                mismatches.push({ song: key, packs });
            }
        }
    }
}

console.log(`\n  Total songs appearing in multiple packs: ${crossPackSongs}`);
console.log(`  Songs with DIFFERENT rarity across packs: ${mismatchCount}`);
if (mismatches.length > 0) {
    console.log(`\n  Examples of rarity mismatches:`);
    for (const m of mismatches) {
        const parts = Object.entries(m.packs).map(([p, r]) => `${p}=${r}`).join(', ');
        console.log(`    - ${m.song} → ${parts}`);
    }
}
