/**
 * songs.json / top200-daily.json の各曲に iTunes メタデータ（previewUrl等）を追加するスクリプト
 * 
 * 使い方:
 *   node scripts/enrich-itunes-data.js                      (songs.json全曲を差分更新)
 *   node scripts/enrich-itunes-data.js --force              (既存データも再取得)
 *   node scripts/enrich-itunes-data.js --limit 20           (最初の20曲のみ)
 *   node scripts/enrich-itunes-data.js --dry-run --limit 5  (書き込みせず5曲テスト)
 *   node scripts/enrich-itunes-data.js --top200             (top200-daily.jsonも更新)
 * 
 * iTunes Search API: 約20回/分のレート制限あり → 3秒間隔で安全にリクエスト
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ---- 設定 ----
const ITUNES_API = 'https://itunes.apple.com/search';
const RATE_LIMIT_MS = 3000; // 3秒間隔（20回/分以内、余裕を持って）
const REQUEST_TIMEOUT_MS = 15000; // 15秒タイムアウト

// ---- 除外設定 ----
const EXCLUDED_TITLE_KEYWORDS = ['instrumental'];
const EXCLUDED_ARTISTS = [
    '鷺巣詩郎', '増田俊郎', '菅野よう子', '久石譲',
    'Yoshihisa Hirano and Hideki Taniuchi', 'Dolce Triade',
    'Fehér Adrienn és Németh Attila', '天門', 'シエナ・ウインド・オーケストラ',
    '大島ミチル', '岩崎琢', 'Mutoh Yoshiaki', '梶浦由記',
    'Hyakkoku Hajime', 'The Seatbelts',
];

function isExcludedResult(track) {
    if (!track) return false;
    const name = (track.trackName || '').toLowerCase();
    const artist = (track.artistName || '').toLowerCase();
    if (EXCLUDED_TITLE_KEYWORDS.some(kw => name.includes(kw.toLowerCase()))) return true;
    if (EXCLUDED_ARTISTS.some(a => a.toLowerCase() === artist)) return true;
    return false;
}

// ---- ユーティリティ ----
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Request timeout')), REQUEST_TIMEOUT_MS);

        https.get(url, (res) => {
            if (res.statusCode === 403 || res.statusCode === 429) {
                clearTimeout(timer);
                reject(new Error(`Rate limited (HTTP ${res.statusCode})`));
                return;
            }
            if (res.statusCode !== 200) {
                clearTimeout(timer);
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                clearTimeout(timer);
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`JSON parse error: ${e.message}`));
                }
            });
            res.on('error', (err) => {
                clearTimeout(timer);
                reject(err);
            });
        }).on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

// ---- マッチングロジック（api.js の lookupITunes と同一ロジック）----

// アクセント記号等を除去
function stripDiacritics(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// アーティスト名のファジーマッチング
function fuzzyArtistMatch(itunesArtist, searchArtist) {
    const a = stripDiacritics(itunesArtist || '');
    const b = stripDiacritics(searchArtist);
    const normSep = (s) => s.replace(/[・、×,&+\-\/\\]/g, ' ').replace(/\s+/g, ' ').trim();
    const aNorm = normSep(a);
    const bNorm = normSep(b);
    if (aNorm.includes(bNorm) || bNorm.includes(aNorm)) return true;
    if (a.includes(b) || b.includes(a)) return true;
    const split = (s) => s.split(/[\s,&+\-()\[\].:・、×\/]+/).filter(t => t.length >= 3);
    return split(a).some(ta => split(b).some(tb => ta.includes(tb) || tb.includes(ta)));
}

// inst/カラオケ版をde-prioritize
function isVariant(s) {
    const name = (s.trackName || '').toLowerCase();
    const album = (s.collectionName || '').toLowerCase();
    return /\binst\.?\b|\binstrumental\b|\bkaraoke\b|\bカラオケ\b|\boff\s*vocal\b|\blive\b|\bライブ\b/.test(name)
        || /\blive\b|\bライブ\b/.test(album);
}

/**
 * iTunes Search API で曲を検索しベストマッチを返す
 */
async function searchITunes(trackName, artistName) {
    const query = encodeURIComponent(`${artistName} ${trackName}`);
    const url = `${ITUNES_API}?term=${query}&media=music&entity=song&limit=10&country=JP`;

    const result = await fetchJSON(url);
    const songs = (result.results || []).filter(s => !isExcludedResult(s));

    // inst./カラオケ版を後方に
    songs.sort((a, b) => (isVariant(a) ? 1 : 0) - (isVariant(b) ? 1 : 0));

    const normalizedTrack = stripDiacritics(trackName);
    const trackMatches = (s) =>
        stripDiacritics(s.trackName || '').includes(normalizedTrack.substring(0, 10));

    // マッチング優先順位（api.js と同一）
    const match = songs.find(s =>
        fuzzyArtistMatch(s.artistName, artistName) && trackMatches(s)
    ) || songs.find(s =>
        fuzzyArtistMatch(s.artistName, artistName)
    ) || (() => {
        const trackHit = songs.find(s => trackMatches(s));
        if (!trackHit) return null;
        const sameArtistCount = songs.filter(s => s.artistId === trackHit.artistId).length;
        return sameArtistCount >= 2 ? trackHit : null;
    })() || (() => {
        const trackHit = songs.find(s => trackMatches(s));
        return trackHit || null;
    })() || (() => {
        return songs.length > 0 ? songs[0] : null;
    })() || null;

    return match;
}

// ---- メイン処理 ----

async function enrichSongsJson(options) {
    const songsPath = path.join(__dirname, '..', 'data', 'songs.json');
    const data = JSON.parse(fs.readFileSync(songsPath, 'utf-8'));
    const packs = data.packs;

    // 全曲をフラットなリストに（重複排除）
    const allTracks = [];
    const seenKeys = new Set();
    const trackRefs = []; // { packId, index } のリスト（書き戻し用）

    for (const [packId, tracks] of Object.entries(packs)) {
        for (let i = 0; i < tracks.length; i++) {
            const t = tracks[i];
            const key = `${(t.artist || '').toLowerCase()}::${(t.name || '').toLowerCase()}`;
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                allTracks.push({ track: t, key, refs: [{ packId, index: i }] });
            } else {
                // 重複曲: 同じ参照を追加
                const existing = allTracks.find(a => a.key === key);
                if (existing) existing.refs.push({ packId, index: i });
            }
        }
    }

    console.log(`\n=== iTunes Data Enrichment ===`);
    console.log(`Total unique tracks: ${allTracks.length}`);
    console.log(`Rate limit: ${RATE_LIMIT_MS}ms interval`);
    if (options.dryRun) console.log(`DRY RUN: No files will be written`);
    if (options.force) console.log(`FORCE: Re-fetching existing data`);

    // フィルタリング: previewUrl が既にあるものはスキップ（--force でない場合）
    let targets = allTracks;
    if (!options.force) {
        targets = allTracks.filter(item => !item.track.previewUrl);
        console.log(`Tracks needing enrichment: ${targets.length} (${allTracks.length - targets.length} already have previewUrl)`);
    }

    // --limit
    if (options.limit > 0) {
        targets = targets.slice(0, options.limit);
        console.log(`Limited to: ${targets.length} tracks`);
    }

    let success = 0, failed = 0, skipped = 0;
    let rateLimitHits = 0;

    for (let i = 0; i < targets.length; i++) {
        const item = targets[i];
        const { track } = item;

        // 進捗表示
        if (i % 10 === 0 || i === targets.length - 1) {
            const pct = ((i / targets.length) * 100).toFixed(1);
            console.log(`  [${i + 1}/${targets.length}] (${pct}%) Hits: ${success}, Miss: ${failed}, Rate limits: ${rateLimitHits}`);
        }

        try {
            const itunesData = await searchITunes(track.name, track.artist);

            if (itunesData) {
                // メタデータを更新
                const enrichedData = {
                    previewUrl: itunesData.previewUrl || null,
                    trackViewUrl: itunesData.trackViewUrl || null,
                    itunesTrackId: itunesData.trackId || null,
                    collectionName: itunesData.collectionName || null,
                    primaryGenreName: itunesData.primaryGenreName || null,
                    trackTimeMillis: itunesData.trackTimeMillis || null,
                };

                // artworkUrl がない場合のみ補完
                if (!track.artworkUrl && itunesData.artworkUrl100) {
                    enrichedData.artworkUrl = itunesData.artworkUrl100.replace('100x100bb', '600x600bb');
                }

                // releaseDate がない場合のみ補完
                if (!track.releaseDate && itunesData.releaseDate) {
                    enrichedData.releaseDate = itunesData.releaseDate.substring(0, 10);
                }

                // 全参照先のトラックに反映
                for (const ref of item.refs) {
                    Object.assign(packs[ref.packId][ref.index], enrichedData);
                }

                success++;
            } else {
                failed++;
            }
        } catch (err) {
            if (err.message.includes('Rate limited')) {
                rateLimitHits++;
                console.warn(`  ⚠ Rate limited! Waiting 60s before retry...`);
                await sleep(60000); // 60秒待機
                i--; // リトライ
                continue;
            }
            console.warn(`  ✗ Error for "${track.name}" by ${track.artist}: ${err.message}`);
            failed++;
        }

        // レート制限（最後以外）
        if (i < targets.length - 1) {
            await sleep(RATE_LIMIT_MS);
        }
    }

    console.log(`\n=== Results ===`);
    console.log(`  Success: ${success}/${targets.length}`);
    console.log(`  Failed:  ${failed}/${targets.length}`);
    console.log(`  Hit rate: ${targets.length > 0 ? ((success / targets.length) * 100).toFixed(1) : 0}%`);

    if (!options.dryRun && success > 0) {
        // songs.json に書き戻し
        data.enrichedAt = new Date().toISOString();
        fs.writeFileSync(songsPath, JSON.stringify(data, null, 2), 'utf-8');
        console.log(`\nSaved to ${songsPath}`);
    }

    return { success, failed };
}

async function enrichTop200(options) {
    const top200Path = path.join(__dirname, '..', 'data', 'top200-daily.json');
    if (!fs.existsSync(top200Path)) {
        console.log('top200-daily.json not found, skipping.');
        return;
    }

    const data = JSON.parse(fs.readFileSync(top200Path, 'utf-8'));
    const tracks = data.tracks || [];

    console.log(`\n=== Top 200 iTunes Data Enrichment ===`);
    console.log(`Total tracks: ${tracks.length}`);

    let targets = tracks;
    if (!options.force) {
        targets = tracks.filter(t => !t.previewUrl);
        console.log(`Tracks needing enrichment: ${targets.length}`);
    }

    if (options.limit > 0) {
        targets = targets.slice(0, options.limit);
        console.log(`Limited to: ${targets.length} tracks`);
    }

    let success = 0, failed = 0;

    for (let i = 0; i < targets.length; i++) {
        const track = targets[i];

        if (i % 10 === 0 || i === targets.length - 1) {
            const pct = ((i / targets.length) * 100).toFixed(1);
            console.log(`  [${i + 1}/${targets.length}] (${pct}%) "${track.name}" by ${track.artist}`);
        }

        try {
            let itunesData = await searchITunes(track.name, track.artist);

            // リトライ: & で分割
            if (!itunesData && track.artist.includes(' & ')) {
                const firstArtist = track.artist.split(' & ')[0].trim();
                itunesData = await searchITunes(track.name, firstArtist);
                if (itunesData) await sleep(RATE_LIMIT_MS);
            }
            if (!itunesData && track.artist.includes(', ')) {
                const firstArtist = track.artist.split(', ')[0].trim();
                itunesData = await searchITunes(track.name, firstArtist);
                if (itunesData) await sleep(RATE_LIMIT_MS);
            }

            if (itunesData) {
                track.previewUrl = itunesData.previewUrl || null;
                track.trackViewUrl = itunesData.trackViewUrl || null;
                track.itunesTrackId = itunesData.trackId || null;
                track.artworkUrl = itunesData.artworkUrl100
                    ? itunesData.artworkUrl100.replace('100x100bb', '600x600bb')
                    : null;
                track.collectionName = itunesData.collectionName || null;
                track.primaryGenreName = itunesData.primaryGenreName || null;
                track.trackTimeMillis = itunesData.trackTimeMillis || null;
                track.releaseDate = itunesData.releaseDate
                    ? itunesData.releaseDate.substring(0, 10)
                    : null;
                success++;
            } else {
                failed++;
            }
        } catch (err) {
            if (err.message.includes('Rate limited')) {
                console.warn(`  ⚠ Rate limited! Waiting 60s...`);
                await sleep(60000);
                i--;
                continue;
            }
            console.warn(`  ✗ Error for "${track.name}": ${err.message}`);
            failed++;
        }

        if (i < targets.length - 1) {
            await sleep(RATE_LIMIT_MS);
        }
    }

    console.log(`\n=== Top 200 Results ===`);
    console.log(`  Success: ${success}/${targets.length}`);
    console.log(`  Failed:  ${failed}/${targets.length}`);

    if (!options.dryRun && success > 0) {
        data.enrichedAt = new Date().toISOString();
        fs.writeFileSync(top200Path, JSON.stringify(data, null, 2), 'utf-8');
        console.log(`\nSaved to ${top200Path}`);
    }
}

// ---- CLI ----
async function main() {
    const args = process.argv.slice(2);
    const options = {
        dryRun: args.includes('--dry-run'),
        force: args.includes('--force'),
        top200: args.includes('--top200'),
        limit: 0,
    };

    const limitIdx = args.indexOf('--limit');
    if (limitIdx !== -1 && args[limitIdx + 1]) {
        options.limit = parseInt(args[limitIdx + 1], 10);
    }

    console.log('=== iTunes Data Enrichment Script ===');
    console.log(`Options: ${JSON.stringify(options)}`);

    // songs.json のエンリッチ
    await enrichSongsJson(options);

    // --top200 フラグがある場合、top200-daily.json もエンリッチ
    if (options.top200) {
        await enrichTop200(options);
    }

    console.log('\nDone!');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
