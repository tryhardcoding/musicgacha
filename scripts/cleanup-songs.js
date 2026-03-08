/**
 * songs.json から除外対象の楽曲を削除するスクリプト
 * - 除外アーティスト: 鷺巣詩郎, 増田俊郎
 * - 除外キーワード: instrumental (楽曲名に含まれる場合)
 */
const fs = require('fs');
const path = require('path');

const EXCLUDED_ARTISTS = ['鷺巣詩郎', '増田俊郎', '菅野よう子', '久石譲', 'Yoshihisa Hirano and Hideki Taniuchi', 'Dolce Triade', 'Fehér Adrienn és Németh Attila', '天門', 'シエナ・ウインド・オーケストラ', '大島ミチル', '岩崎琢', 'Mutoh Yoshiaki', '梶浦由記', 'Hyakkoku Hajime', 'The Seatbelts'];
const EXCLUDED_TITLE_KEYWORDS = ['instrumental'];

function isExcluded(track) {
    const artistLower = track.artist.toLowerCase();
    const nameLower = track.name.toLowerCase();
    if (EXCLUDED_ARTISTS.some(a => a.toLowerCase() === artistLower)) return true;
    if (EXCLUDED_TITLE_KEYWORDS.some(kw => nameLower.includes(kw.toLowerCase()))) return true;
    return false;
}

const songsPath = path.join(__dirname, '..', 'data', 'songs.json');
const data = JSON.parse(fs.readFileSync(songsPath, 'utf-8'));

let totalRemoved = 0;

for (const [packId, tracks] of Object.entries(data.packs)) {
    const before = tracks.length;
    data.packs[packId] = tracks.filter(t => !isExcluded(t));
    const removed = before - data.packs[packId].length;
    if (removed > 0) {
        console.log(`  ${packId}: ${removed} tracks removed (${before} -> ${data.packs[packId].length})`);
        totalRemoved += removed;
    }
}

console.log(`\nTotal removed: ${totalRemoved} tracks`);

fs.writeFileSync(songsPath, JSON.stringify(data, null, 2), 'utf-8');
console.log(`Saved to ${songsPath}`);
