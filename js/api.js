// ============================================================
// MusicGacha - API Module
// songs.json / top200-daily.json 事前取得データのみで動作
// ============================================================

// ---- Song Pool (Last.fm事前取得データ) ----
let songPool = null;

async function loadSongPool() {
    if (songPool) return songPool;

    try {
        const response = await fetch('./data/songs.json');
        const data = await response.json();
        songPool = data.packs;
        console.log('[API] Song pool loaded:', Object.entries(songPool).map(([k, v]) => `${k}: ${v.length}`).join(', '));
        return songPool;
    } catch (error) {
        console.error('[API] Failed to load song pool:', error);
        return null;
    }
}

// ---- Hash Function ----

function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash;
}

// ---- Fixed Rarity from Track ID ----

/**
 * 曲の一意キー（アーティスト+曲名）からハッシュで固定レアリティを決定
 * 同じ曲は常に同じレアリティになる
 */
function getFixedRarity(artist, trackName) {
    const key = `${artist}::${trackName}`;
    const hash = Math.abs(hashCode(key)) % 100;
    if (hash < 2) return 'LR';    // 2%
    if (hash < 7) return 'UR';    // 5%
    if (hash < 17) return 'SR';   // 10%
    if (hash < 35) return 'R';    // 18%
    if (hash < 60) return 'UC';   // 25%
    return 'C';                    // 40%
}

// ---- Main: パック設定からカードデータを取得 ----

/**
 * パック設定に基づいてsongs.jsonから曲を選び、カードデータを返す
 * @param {Object} packConfig - packs.jsonの1パック分 { id, ... }
 * @param {string} rarity - レアリティコード (LR, UR, SR, R, UC, C)
 * @returns {Promise<Object>} カードデータ
 */
export async function fetchCardFromGenre(packConfig, rarity) {
    try {
        // 1. Song Pool読み込み
        await loadSongPool();

        if (!songPool || !songPool[packConfig.id]) {
            console.warn(`[API] No song pool for pack: ${packConfig.id}`);
            return createFallbackCard(rarity);
        }

        const tracks = songPool[packConfig.id];

        // 2. レアリティに一致する曲を取得（songs.jsonに事前付与済み）
        const RARITY_FALLBACK = ['LR', 'UR', 'SR', 'R', 'UC', 'C'];
        let tierTracks = tracks.filter(t => t.rarity === rarity);

        // フォールバック: 該当レアリティの曲がない場合、1段階下を探す
        if (tierTracks.length === 0) {
            const idx = RARITY_FALLBACK.indexOf(rarity);
            for (let i = idx + 1; i < RARITY_FALLBACK.length; i++) {
                tierTracks = tracks.filter(t => t.rarity === RARITY_FALLBACK[i]);
                if (tierTracks.length > 0) break;
            }
        }

        // それでもなければ全曲から
        if (tierTracks.length === 0) tierTracks = tracks;

        const selectedTrack = tierTracks[Math.floor(Math.random() * tierTracks.length)];

        // 3. 事前取得データからカードデータを生成
        const coverUrl = selectedTrack.artworkUrl || null;
        const year = selectedTrack.releaseDate
            ? parseInt(selectedTrack.releaseDate.substring(0, 4), 10)
            : null;

        return {
            id: selectedTrack.itunesTrackId ? String(selectedTrack.itunesTrackId) : `pool-${hashCode(`${selectedTrack.artist}::${selectedTrack.name}`)}`,
            title: selectedTrack.name,
            artist: selectedTrack.artist,
            originalName: selectedTrack.name,
            originalArtist: selectedTrack.artist,
            album: selectedTrack.collectionName || 'Unknown Album',
            year,
            genre: selectedTrack.primaryGenreName || 'Unknown',
            duration: selectedTrack.trackTimeMillis ? Math.round(selectedTrack.trackTimeMillis / 1000) : 200,
            listeners: selectedTrack.playcount || 0,
            coverUrl,
            previewUrl: selectedTrack.previewUrl || null,
            trackViewUrl: selectedTrack.trackViewUrl || selectedTrack.url || null,
            rarity,
        };
    } catch (error) {
        console.error(`[API] Failed to fetch card data:`, error);
        return createFallbackCard(rarity);
    }
}

/**
 * フォールバックカード生成
 */
function createFallbackCard(rarity) {
    return {
        id: `fallback-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: 'Unknown Track',
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        year: null,
        genre: 'Unknown',
        duration: 180 + Math.floor(Math.random() * 120),
        listeners: Math.floor(Math.random() * 4900000) + 100000,
        coverUrl: null,
        previewUrl: null,
        trackViewUrl: null,
        rarity,
    };
}

// ---- Top 200 Daily Chart ----

let top200Data = null;

async function loadTop200Data() {
    if (top200Data) return top200Data;

    try {
        const response = await fetch('./data/top200-daily.json');
        top200Data = await response.json();
        console.log('[API] Top 200 data loaded:', top200Data.totalTracks, 'tracks, chart date:', top200Data.chartDate);
        return top200Data;
    } catch (error) {
        console.error('[API] Failed to load Top 200 data:', error);
        return null;
    }
}

/**
 * チャート順位からレアリティを決定
 * Top 10 = LR, Top 30 = UR, Top 60 = SR, Top 100 = R, Top 150 = UC, 残り = C
 */
function getRarityFromRank(rank) {
    if (rank <= 10) return 'LR';
    if (rank <= 30) return 'UR';
    if (rank <= 60) return 'SR';
    if (rank <= 100) return 'R';
    if (rank <= 150) return 'UC';
    return 'C';
}

/**
 * レアリティからチャート順位範囲を取得
 */
function getRankRangeFromRarity(rarity) {
    switch (rarity) {
        case 'LR': return { min: 1, max: 10 };
        case 'UR': return { min: 11, max: 30 };
        case 'SR': return { min: 31, max: 60 };
        case 'R': return { min: 61, max: 100 };
        case 'UC': return { min: 101, max: 150 };
        case 'C': return { min: 151, max: 200 };
        default: return { min: 1, max: 200 };
    }
}

/**
 * Top 200パックからカードデータを取得
 * @param {Set<string>} obtainedKeys - 取得済みの曲キーセット（進捗管理用）
 * @param {string} rarity - 抽選で決定されたレアリティ
 * @returns {Promise<Object>} カードデータ
 */
export async function fetchCardFromTop200(obtainedKeys, rarity) {
    try {
        const data = await loadTop200Data();
        if (!data || !data.tracks || data.tracks.length === 0) {
            console.warn('[API] No Top 200 data available');
            return createFallbackCard(rarity || 'C');
        }

        // 指定レアリティに対応するランク範囲のトラックをフィルタ
        const range = getRankRangeFromRarity(rarity);
        let candidates = data.tracks.filter(t => t.rank >= range.min && t.rank <= range.max);

        // 該当レアリティのトラックがない場合は全曲からフォールバック
        if (candidates.length === 0) {
            console.warn(`[API] No tracks found for rarity ${rarity}, falling back to all tracks`);
            candidates = data.tracks;
        }

        const selectedTrack = candidates[Math.floor(Math.random() * candidates.length)];
        const trackKey = `${selectedTrack.artist.toLowerCase()}::${selectedTrack.name.toLowerCase()}`;

        const coverUrl = selectedTrack.artworkUrl || null;
        const year = selectedTrack.releaseDate
            ? parseInt(selectedTrack.releaseDate.substring(0, 4), 10)
            : null;

        return {
            id: selectedTrack.itunesTrackId ? String(selectedTrack.itunesTrackId) : `top200-${hashCode(`${selectedTrack.artist}::${selectedTrack.name}`)}`,
            title: selectedTrack.name,
            artist: selectedTrack.artist,
            originalName: selectedTrack.name,
            originalArtist: selectedTrack.artist,
            album: selectedTrack.collectionName || 'Unknown Album',
            year,
            genre: selectedTrack.primaryGenreName || 'Unknown',
            duration: selectedTrack.trackTimeMillis ? Math.round(selectedTrack.trackTimeMillis / 1000) : 200,
            listeners: 10000000 - (selectedTrack.rank * 49000),
            coverUrl,
            previewUrl: selectedTrack.previewUrl || null,
            trackViewUrl: selectedTrack.trackViewUrl || null,
            rarity,
            chartRank: selectedTrack.rank,
            top200Key: trackKey,
            isComplete: false,
        };
    } catch (error) {
        console.error('[API] Failed to fetch Top 200 card:', error);
        return createFallbackCard('C');
    }
}

/**
 * Top 200データのチャート日付を返す
 */
export async function getTop200ChartDate() {
    const data = await loadTop200Data();
    return data?.chartDate || null;
}

/**
 * Top 200の全トラックリストを返す
 */
export async function getTop200Tracks() {
    const data = await loadTop200Data();
    return data?.tracks || [];
}
