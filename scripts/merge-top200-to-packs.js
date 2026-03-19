/**
 * Top 200 チャートの曲を songs.json の各パックにマージするスクリプト
 * 
 * - top200-daily.json を読み取り、各曲を iTunes で検索してジャンル情報を取得
 * - ジャンルに基づいて適切なパック (jpop, kpop, anime, hiphop, western 等) に振り分け
 * - songs.json にマージ（既存曲は playcount を更新、新規曲は追加）
 * - 重複チェック: iTunes trackId ベース + artist::name キーの両方で照合
 * 
 * 使い方: node scripts/merge-top200-to-packs.js
 * 
 * 前提: node scripts/fetch-kworb-top200.js で top200-daily.json が最新であること
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ---- iTunes ジャンル → パック マッピング ----
// iTunes primaryGenreName で振り分ける
const GENRE_TO_PACK = {
    'J-Pop': 'jpop',
    'J-ポップ': 'jpop',
    '歌謡曲': 'jpop',
    'Japanese Pop': 'jpop',
    'Enka': 'jpop',
    'K-Pop': 'kpop',
    'Korean Pop': 'kpop',
    'Anime': 'anime',
    'アニメ': 'anime',
    'Soundtrack': 'anime',        // アニメ/ゲーム系サントラが多い
    'Hip-Hop/Rap': 'hiphop',
    'Hip Hop/Rap': 'hiphop',
    'ヒップホップ/ラップ': 'hiphop',
    'Pop': 'western',             // 日本アーティストなら後で jpop に上書き
    'Rock': 'western',
    'R&B/Soul': 'western',
    'Electronic': 'western',
    'Dance': 'western',
    'Alternative': 'western',
    'Latin': 'western',
    'Country': 'western',
    'Metal': 'western',
    'Classical': 'western',
    'Reggae': 'western',
};

// 日本語文字を含むかチェック（ひらがな、カタカナ、漢字）
function hasJapanese(str) {
    return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(str);
}

// ハングルを含むかチェック
function hasKorean(str) {
    return /[\uAC00-\uD7AF\u1100-\u11FF]/.test(str);
}

// ---- iTunes API ----

const ITUNES_BASE = 'https://itunes.apple.com';

const ITUNES_INTERVAL_MS = 1200; // iTunes API間隔（レートリミット対策）

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJSONRaw(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode === 429 || res.statusCode === 403) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
            res.on('error', reject);
        }).on('error', reject);
    });
}

// リトライ付きfetchJSON（429/403時に指数バックオフ）
async function fetchJSON(url, maxRetries = 3) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fetchJSONRaw(url);
        } catch (e) {
            if ((e.message.includes('429') || e.message.includes('403')) && attempt < maxRetries) {
                const delay = ITUNES_INTERVAL_MS * Math.pow(2, attempt + 1); // 2.4s, 4.8s, 9.6s
                console.log(`    ⏳ レートリミット、${delay}ms待機 (リトライ ${attempt + 1}/${maxRetries})`);
                await sleep(delay);
                continue;
            }
            throw e;
        }
    }
}

/**
 * iTunes で曲を検索し、ジャンル情報付きで返す
 * @param {string} trackName 
 * @param {string} artistName 
 * @returns {Promise<Object|null>}
 */
async function lookupITunes(trackName, artistName) {
    // 検索クエリ構築
    const query = `${trackName} ${artistName}`;
    const url = `${ITUNES_BASE}/search?term=${encodeURIComponent(query)}&country=JP&media=music&entity=song&limit=10`;

    try {
        const data = await fetchJSON(url);
        if (!data.results || data.results.length === 0) return null;

        const artistLower = artistName.toLowerCase();
        const trackLower = trackName.toLowerCase();

        // アクセント記号等を除去
        function stripDiacritics(str) {
            return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC');
        }

        // アーティスト名のファジーマッチ
        function fuzzyArtistMatch(itunesArtist, searchArtist) {
            const a = stripDiacritics(itunesArtist.toLowerCase());
            const b = stripDiacritics(searchArtist.toLowerCase());
            if (a === b) return true;
            if (a.includes(b) || b.includes(a)) return true;
            // 区切り文字を統一して比較
            const normSep = s => s.replace(/[・×,、&＆]/g, ' ').replace(/\s+/g, ' ').trim();
            if (normSep(a) === normSep(b)) return true;
            // トークンベースマッチ（3文字以上の共通トークン2つ以上）
            const split = s => normSep(s).split(' ').filter(t => t.length >= 3);
            const tokensA = split(a);
            const tokensB = split(b);
            const common = tokensA.filter(t => tokensB.some(tb => tb.includes(t) || t.includes(tb)));
            if (common.length >= 2) return true;
            return false;
        }

        // inst./カラオケ版を後方に
        function isVariant(s) {
            const l = s.toLowerCase();
            return l.includes('instrumental') || l.includes('karaoke') || l.includes('off vocal')
                || /\blive\b/.test(l) || l.includes('ライブ');
        }

        // best matchを選ぶ
        const sorted = data.results
            .filter(r => r.kind === 'song')
            .sort((a, b) => {
                const aVar = isVariant(a.trackName || '');
                const bVar = isVariant(b.trackName || '');
                if (aVar !== bVar) return aVar ? 1 : -1;
                return 0;
            });

        // アーティスト名 + 曲名で最良マッチを探す
        for (const result of sorted) {
            const itunesArtist = result.artistName || '';
            const itunesTrack = (result.trackName || '').toLowerCase();

            if (fuzzyArtistMatch(itunesArtist, artistName)) {
                if (itunesTrack.includes(trackLower) || trackLower.includes(itunesTrack)) {
                    return result;
                }
            }
        }

        // 曲名だけでマッチ（アーティスト名が大幅に違う場合のフォールバック）
        for (const result of sorted) {
            const itunesTrack = (result.trackName || '').toLowerCase();
            if (itunesTrack === trackLower) {
                return result;
            }
        }

        return null;
    } catch (e) {
        console.warn(`  iTunes lookup failed for "${trackName}" by "${artistName}": ${e.message}`);
        return null;
    }
}

/**
 * iTunesジャンルとアーティスト名からパックを判定
 */
function determinePackId(itunesData, originalArtist) {
    if (!itunesData) {
        // iTunes情報なし: アーティスト名の文字種から推定
        if (hasKorean(originalArtist)) return 'kpop';
        return 'jpop'; // デフォルト: 日本チャートなのでjpop
    }

    const genre = itunesData.primaryGenreName || '';
    let packId = GENRE_TO_PACK[genre] || null;

    // ジャンルが Pop/Rock/Alternative等で日本語アーティストの場合は jpop に
    if (packId === 'western') {
        const artistName = itunesData.artistName || originalArtist;
        if (hasJapanese(artistName)) {
            packId = 'jpop';
        } else if (hasKorean(artistName)) {
            packId = 'kpop';
        }
    }

    // K-Pop の日本語版も kpop に
    if (genre.includes('K-Pop') || genre.includes('Korean')) {
        packId = 'kpop';
    }

    // マッチしなかった場合のデフォルト
    if (!packId) {
        const artistName = itunesData.artistName || originalArtist;
        if (hasKorean(artistName)) return 'kpop';
        if (hasJapanese(artistName)) return 'jpop';
        return 'jpop'; // 日本チャートなのでデフォルトjpop
    }

    return packId;
}

/**
 * 既存 songs.json から重複チェック用のインデックスを構築
 * - keyIndex: "artist_lower::name_lower" → { packId, index }
 * - idIndex: iTunes trackIdベースの "lastfm-xxxx" や 数値ID → { packId, index }
 */
function buildDeduplicationIndex(songsData) {
    const keyIndex = new Map();  // "artist::name" → { packId, idx }
    const urlIndex = new Map();  // artworkUrl → { packId, idx } (アートワークURLで重複検知)

    for (const [packId, tracks] of Object.entries(songsData)) {
        if (packId === 'standard') continue; // standardは全パックのマージなので除外

        tracks.forEach((track, idx) => {
            // artist::name キーで登録
            const key = `${track.artist.toLowerCase()}::${track.name.toLowerCase()}`;
            if (!keyIndex.has(key)) {
                keyIndex.set(key, { packId, idx });
            }

            // artworkUrlでも登録（同じ曲は同じアートワークを持つ）
            if (track.artworkUrl) {
                if (!urlIndex.has(track.artworkUrl)) {
                    urlIndex.set(track.artworkUrl, { packId, idx });
                }
            }
        });
    }

    return { keyIndex, urlIndex };
}

/**
 * 曲が既に songs.json に存在するか多角的にチェック
 * @returns {{ found: boolean, packId?: string, idx?: number }}
 */
function checkDuplicate(dedup, kworkArtist, kworbName, itunesData) {
    // 1. 元のkworb名でチェック
    const kworbKey = `${kworkArtist.toLowerCase()}::${kworbName.toLowerCase()}`;
    if (dedup.keyIndex.has(kworbKey)) {
        return { found: true, ...dedup.keyIndex.get(kworbKey) };
    }

    // 2. iTunes名でチェック（表記揺れ対応: "Kenshi Yonezu" vs "米津玄師"）
    if (itunesData) {
        const itunesKey = `${(itunesData.artistName || '').toLowerCase()}::${(itunesData.trackName || '').toLowerCase()}`;
        if (dedup.keyIndex.has(itunesKey)) {
            return { found: true, ...dedup.keyIndex.get(itunesKey) };
        }

        // 3. アートワークURLでチェック（同じ曲=同じアルバムアート）
        if (itunesData.artworkUrl100) {
            const artUrl = itunesData.artworkUrl100.replace('100x100bb', '600x600bb');
            if (dedup.urlIndex.has(artUrl)) {
                return { found: true, ...dedup.urlIndex.get(artUrl) };
            }
        }
    }

    return { found: false };
}

// ---- Main ----

async function main() {
    console.log('=== Top 200 → Songs.json マージツール ===\n');

    // 1. top200-daily.json の読み込み
    const top200Path = path.join(__dirname, '..', 'data', 'top200-daily.json');
    if (!fs.existsSync(top200Path)) {
        console.error('Error: top200-daily.json が見つかりません。先に fetch-kworb-top200.js を実行してください。');
        process.exit(1);
    }
    const top200 = JSON.parse(fs.readFileSync(top200Path, 'utf-8'));
    console.log(`Top 200 チャート日付: ${top200.chartDate}`);
    console.log(`曲数: ${top200.tracks.length}`);

    // 2. songs.json の読み込み
    const songsPath = path.join(__dirname, '..', 'data', 'songs.json');
    if (!fs.existsSync(songsPath)) {
        console.error('Error: songs.json が見つかりません。先に fetch-lastfm.js を実行してください。');
        process.exit(1);
    }
    const songsFile = JSON.parse(fs.readFileSync(songsPath, 'utf-8'));
    const packs = songsFile.packs;

    // 3. 重複チェック用インデックス構築
    const dedup = buildDeduplicationIndex(packs);
    console.log(`既存曲インデックス: ${dedup.keyIndex.size} keys, ${dedup.urlIndex.size} artwork URLs\n`);

    // 4. 各トラックを処理
    const stats = {
        total: 0,
        added: {},       // packId → count
        updated: 0,
        skippedDup: 0,
        iTunesMiss: 0,
    };

    for (const track of top200.tracks) {
        stats.total++;

        // iTunes API でジャンル情報を取得（レートリミット: 500ms間隔）
        let itunesData = await lookupITunes(track.name, track.artist);

        // リトライ: "Artist & Artist2" → "Artist" だけで検索
        if (!itunesData && track.artist.includes(' & ')) {
            const firstArtist = track.artist.split(' & ')[0].trim();
            itunesData = await lookupITunes(track.name, firstArtist);
        }
        if (!itunesData && track.artist.includes(', ')) {
            const firstArtist = track.artist.split(', ')[0].trim();
            itunesData = await lookupITunes(track.name, firstArtist);
        }

        await sleep(ITUNES_INTERVAL_MS); // iTunes APIレートリミット

        // 重複チェック
        const dupResult = checkDuplicate(dedup, track.artist, track.name, itunesData);

        // チャート順位ベースのplaycount（上位ほど高い）
        const playcount = Math.max(100000, 10000000 - (track.rank * 49000));

        if (dupResult.found) {
            // 既存曲: bestChartRankを更新（より良い順位を保持）
            const existingTrack = packs[dupResult.packId][dupResult.idx];
            const currentBest = existingTrack.bestChartRank || Infinity;
            if (track.rank < currentBest) {
                existingTrack.bestChartRank = track.rank;
                console.log(`  ★ #${track.rank} ${track.artist} - ${track.name} → ${dupResult.packId} (最高順位更新: ${currentBest === Infinity ? '新規' : currentBest} → ${track.rank})`);
                stats.updated++;
            }
            if (playcount > existingTrack.playcount) {
                existingTrack.playcount = playcount;
                existingTrack.source = 'top200_merge';
            } else {
                stats.skippedDup++;
            }
            continue;
        }

        // パック判定
        const packId = determinePackId(itunesData, track.artist);

        // 新規曲データ生成
        const newTrack = {
            name: itunesData ? (itunesData.trackName || track.name) : track.name,
            artist: itunesData ? (itunesData.artistName || track.artist) : track.artist,
            playcount,
            rank: track.rank,
            bestChartRank: track.rank,  // Top200での過去最高順位
            url: itunesData?.trackViewUrl || null,
            mbid: null,
            source: 'top200_merge',
            artworkUrl: itunesData?.artworkUrl100
                ? itunesData.artworkUrl100.replace('100x100bb', '600x600bb')
                : null,
            releaseDate: itunesData?.releaseDate
                ? itunesData.releaseDate.substring(0, 10)
                : null,
        };

        // パックに追加
        if (!packs[packId]) packs[packId] = [];
        packs[packId].push(newTrack);

        // 重複インデックスにも追加（同パック内での後続チェック用）
        const newKey = `${newTrack.artist.toLowerCase()}::${newTrack.name.toLowerCase()}`;
        const newIdx = packs[packId].length - 1;
        dedup.keyIndex.set(newKey, { packId, idx: newIdx });
        // kworb名でも登録
        const kworbKey = `${track.artist.toLowerCase()}::${track.name.toLowerCase()}`;
        dedup.keyIndex.set(kworbKey, { packId, idx: newIdx });
        if (newTrack.artworkUrl) {
            dedup.urlIndex.set(newTrack.artworkUrl, { packId, idx: newIdx });
        }

        stats.added[packId] = (stats.added[packId] || 0) + 1;
        console.log(`  + #${track.rank} ${track.artist} - ${track.name} → ${packId}`);

        if (!itunesData) {
            stats.iTunesMiss++;
            console.log(`    ⚠ iTunes未ヒット（デフォルト: ${packId}）`);
        }
    }

    // 5. Standard パックを再構築（全パックのマージ）
    console.log('\n=== Standard パック再構築 ===');
    const seenKeys = new Set();
    const allTracks = [];
    for (const [packId, tracks] of Object.entries(packs)) {
        if (packId === 'standard') continue;
        for (const t of tracks) {
            const key = `${t.artist.toLowerCase()}::${t.name.toLowerCase()}`;
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                allTracks.push(t);
            }
        }
    }
    allTracks.sort((a, b) => b.playcount - a.playcount);
    packs.standard = allTracks;
    console.log(`  Standard: ${allTracks.length} unique tracks`);

    // 6. 各パックをplaycountでソート
    for (const [packId, tracks] of Object.entries(packs)) {
        tracks.sort((a, b) => b.playcount - a.playcount);
    }

    // 7. 保存
    songsFile.packs = packs;
    songsFile.lastMergedTop200 = top200.chartDate;
    fs.writeFileSync(songsPath, JSON.stringify(songsFile, null, 2), 'utf-8');

    // 8. サマリー
    console.log('\n=== 結果サマリー ===');
    console.log(`処理曲数: ${stats.total}`);
    console.log(`新規追加:`);
    for (const [packId, count] of Object.entries(stats.added)) {
        console.log(`  ${packId}: +${count}`);
    }
    console.log(`playcount更新: ${stats.updated}`);
    console.log(`重複スキップ: ${stats.skippedDup}`);
    console.log(`iTunes未ヒット: ${stats.iTunesMiss}`);
    console.log('\nパック別曲数:');
    for (const [packId, tracks] of Object.entries(packs)) {
        console.log(`  ${packId}: ${tracks.length}`);
    }
    console.log(`\n保存先: ${songsPath}`);
    console.log('Done!');
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
