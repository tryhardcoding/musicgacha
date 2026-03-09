// ============================================================
// MusicGacha - API Module
// Last.fm事前取得データ + iTunes Search API ハイブリッド
// ============================================================

// ---- Constants ----
// iOS SafariがiTunes APIへの直接アクセスをブロックするため、
// Cloudflare Pages Functionプロキシを経由（同一ドメイン＝CORS問題なし）
const IS_LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const ITUNES_BASE = IS_LOCAL ? 'https://itunes.apple.com' : '/api/itunes';

// ---- Rate Limiter ----
class RateLimiter {
    constructor(intervalMs = 1200) {
        this.intervalMs = intervalMs;
        this.queue = [];
        this.processing = false;
    }

    async enqueue(fn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ fn, resolve, reject });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.processing || this.queue.length === 0) return;
        this.processing = true;

        while (this.queue.length > 0) {
            const { fn, resolve, reject } = this.queue.shift();
            try {
                const result = await fn();
                resolve(result);
            } catch (err) {
                reject(err);
            }
            if (this.queue.length > 0) {
                await new Promise(r => setTimeout(r, this.intervalMs));
            }
        }

        this.processing = false;
    }
}

// iTunes: 20回/分
const itunesLimiter = new RateLimiter(500);

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

// ---- Rarity ----
// songs.json の各曲には事前に rarity フィールドが付与されている
// パック間で同じ曲は最高レアリティに統一済み

// ---- iTunes Lookup Cache ----
// key: "artist::title", value: { iTunesData, fetchedAt }
const itunesCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30分

// ---- iTunes API 利用可否フラグ ----
// iOS Safari等でiTunes APIが完全にブロックされる環境では、
// 最初の失敗時にフラグを立てて以降の呼び出しをスキップ（10秒×6枚=60秒待ち回避）
let itunesAvailable = true;
let itunesCheckDone = false;

// ---- Fetch Helpers ----

// JSONP カウンター（一意なコールバック名生成用）
let jsonpCounter = 0;

/**
 * JSONP方式でJSONデータを取得（CORS回避）
 * iTunes APIはcallbackパラメータをサポート → scriptタグで読み込む
 * iOS Safari等でfetchがブロックされる問題を根本解決
 */
function fetchJSONP(url, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        const callbackName = `_itunesCallback_${Date.now()}_${jsonpCounter++}`;
        const separator = url.includes('?') ? '&' : '?';
        const scriptUrl = `${url}${separator}callback=${callbackName}`;

        const script = document.createElement('script');
        let settled = false;

        // タイムアウト
        const timer = setTimeout(() => {
            if (!settled) {
                settled = true;
                cleanup();
                reject(new Error(`JSONP timeout: ${url}`));
            }
        }, timeoutMs);

        // クリーンアップ
        function cleanup() {
            clearTimeout(timer);
            delete window[callbackName];
            if (script.parentNode) script.parentNode.removeChild(script);
        }

        // コールバック関数をwindowに登録
        window[callbackName] = (data) => {
            if (!settled) {
                settled = true;
                cleanup();
                resolve(data);
            }
        };

        // エラーハンドリング
        script.onerror = () => {
            if (!settled) {
                settled = true;
                cleanup();
                reject(new Error(`JSONP load failed: ${url}`));
            }
        };

        script.src = scriptUrl;
        document.head.appendChild(script);
    });
}

/**
 * JSONデータを取得
 * - itunes.apple.com直アクセス（ローカル開発）→ JSONP方式
 * - プロキシ経由（/api/itunes）→ 通常fetch（同一ドメイン）
 * - その他 → 通常fetch
 */
async function fetchJSON(url) {
    // iTunes直アクセスの場合のみJSONP（ローカル開発等）
    if (url.includes('itunes.apple.com')) {
        return fetchJSONP(url);
    }
    // プロキシ経由・その他は通常のfetch
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${url}`);
    }
    return response.json();
}

// ---- 除外設定（フロントエンド側） ----
const EXCLUDED_TITLE_KEYWORDS = ['instrumental'];
const EXCLUDED_ARTISTS_FRONT = ['鷺巣詩郎', '増田俊郎', '菅野よう子', '久石譲',
    'Yoshihisa Hirano and Hideki Taniuchi', 'Dolce Triade', 'Fehér Adrienn és Németh Attila', '天門', 'シエナ・ウインド・オーケストラ', '大島ミチル', '岩崎琢', 'Mutoh Yoshiaki', '梶浦由記', 'Hyakkoku Hajime', 'The Seatbelts'];

function isExcludedResult(track) {
    if (!track) return false;
    const name = (track.trackName || '').toLowerCase();
    const artist = (track.artistName || '').toLowerCase();
    if (EXCLUDED_TITLE_KEYWORDS.some(kw => name.includes(kw.toLowerCase()))) return true;
    if (EXCLUDED_ARTISTS_FRONT.some(a => a.toLowerCase() === artist)) return true;
    return false;
}

// ---- iTunes Lookup (曲名+アーティスト名で検索) ----

/**
 * 曲名とアーティスト名でiTunesを検索し、ジャケット・試聴URLを取得
 * @param {string} trackName - 曲名
 * @param {string} artistName - アーティスト名
 * @returns {Promise<Object|null>} iTunes楽曲データ or null
 */
async function lookupITunes(trackName, artistName) {
    // iTunes APIが使えない環境では即座にnullを返す（iOS Safari等）
    if (itunesCheckDone && !itunesAvailable) {
        return null;
    }

    const cacheKey = `${artistName.toLowerCase()}::${trackName.toLowerCase()}`;

    // キャッシュチェック
    const cached = itunesCache.get(cacheKey);
    if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL) {
        return cached.data;
    }

    return itunesLimiter.enqueue(async () => {
        try {
            const query = encodeURIComponent(`${artistName} ${trackName}`);
            const itunesPath = IS_LOCAL ? '/search' : '';
            const url = `${ITUNES_BASE}${itunesPath}?term=${query}&media=music&entity=song&limit=10&country=JP`;

            const result = await fetchJSON(url);
            const songs = (result.results || []).filter(s => !isExcludedResult(s));

            // inst./カラオケ版をボーカル版より後方に（完全除外ではなくde-prioritize）
            const isVariant = (s) => {
                const name = (s.trackName || '').toLowerCase();
                const album = (s.collectionName || '').toLowerCase();
                return /\binst\.?\b|\binstrumental\b|\bkaraoke\b|\bカラオケ\b|\boff\s*vocal\b|\blive\b|\bライブ\b/.test(name)
                    || /\blive\b|\bライブ\b/.test(album);
            };
            songs.sort((a, b) => (isVariant(a) ? 1 : 0) - (isVariant(b) ? 1 : 0));

            // ---- 正規化ヘルパー ----
            // アクセント記号等を除去（bôa → boa, café → cafe）
            const stripDiacritics = (str) =>
                str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

            // アーティスト名のファジーマッチング
            // Boa/bôa（アクセント）、Official髭男dism/Official HIGE DANdism（表記揺れ）に対応
            // 中島早貴, 萩原舞 / 中島早貴・萩原舞（区切り文字違い）に対応
            const fuzzyArtistMatch = (itunesArtist, searchArtist) => {
                const a = stripDiacritics(itunesArtist || '');
                const b = stripDiacritics(searchArtist);
                // 区切り文字を統一して比較（・、×、, などを全てスペースに正規化）
                const normSep = (s) => s.replace(/[・、×,&+\-\/\\]/g, ' ').replace(/\s+/g, ' ').trim();
                const aNorm = normSep(a);
                const bNorm = normSep(b);
                // 部分文字列マッチ（区切り文字正規化後）
                if (aNorm.includes(bNorm) || bNorm.includes(aNorm)) return true;
                // 元の文字列でも部分文字列マッチ
                if (a.includes(b) || b.includes(a)) return true;
                // トークンベースマッチ（3文字以上の共通トークン）
                const split = (s) => s.split(/[\s,&+\-()[\].:・、×\/]+/).filter(t => t.length >= 3);
                return split(a).some(ta => split(b).some(tb => ta.includes(tb) || tb.includes(ta)));
            };

            const normalizedTrack = stripDiacritics(trackName);
            const trackMatches = (s) =>
                stripDiacritics(s.trackName || '').includes(normalizedTrack.substring(0, 10));

            // ---- マッチング優先順位 ----
            // Priority 1: アーティスト名（ファジー）+ 曲名の両方が一致
            // Priority 2: アーティスト名（ファジー）のみ一致
            // Priority 3: 曲名一致 + artistId一貫性チェック
            //   → 同一artistIdの結果が2つ以上ある場合、iTunesがアーティストを正しく認識したと判断
            // Priority 4: 曲名一致（文字体系が異なるアーティスト名のフォールバック）
            //   → "natori"→"なとり" のようにローマ字/日本語で完全に異なる場合
            //   → 検索クエリにアーティスト名を含めているため、結果はiTunesが絞り込み済み
            // Priority 5: 検索結果の先頭を信頼（最終フォールバック）
            //   → iTunesの検索結果自体がクエリに対する最良マッチ
            const match = songs.find(s =>
                fuzzyArtistMatch(s.artistName, artistName) && trackMatches(s)
            ) || songs.find(s =>
                fuzzyArtistMatch(s.artistName, artistName)
            ) || (() => {
                const trackHit = songs.find(s => trackMatches(s));
                if (!trackHit) return null;
                // 同一アーティストの結果が複数あれば、iTunesがアーティストを正しく識別した証拠
                const sameArtistCount = songs.filter(s => s.artistId === trackHit.artistId).length;
                return sameArtistCount >= 2 ? trackHit : null;
            })() || (() => {
                // Priority 4: 曲名マッチのみ（アーティスト名が異なる文字体系の場合）
                const trackHit = songs.find(s => trackMatches(s));
                if (trackHit) return trackHit;
                return null;
            })() || (() => {
                // Priority 5: 検索結果があれば先頭を返す（iTunesの検索精度を信頼）
                return songs.length > 0 ? songs[0] : null;
            })() || null;

            // iTunes API利用可能を確認
            if (!itunesCheckDone) {
                itunesCheckDone = true;
                itunesAvailable = true;
                console.log('[API] iTunes API is available');
            }

            // キャッシュ保存
            itunesCache.set(cacheKey, { data: match, fetchedAt: Date.now() });

            return match;
        } catch (error) {
            // 最初の失敗時にiTunes APIを無効化（iOS Safari等のブロック対策）
            if (!itunesCheckDone) {
                itunesCheckDone = true;
                itunesAvailable = false;
                console.warn('[API] iTunes API blocked on this device. Using songs.json fallback.');
            }
            console.warn(`[API] iTunes lookup failed for "${trackName}" by ${artistName}:`, error.message);
            return null;
        }
    });
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
 * パック設定に基づいてsongs.jsonから曲を選び、iTunesでアートワーク等を補完
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

        // 3. iTunesで詳細データを取得（ジャケット、試聴URL等）
        const itunesData = await lookupITunes(selectedTrack.name, selectedTrack.artist);

        // 4. カードデータ生成
        // songs.jsonの事前取得artworkUrlをフォールバックとして利用
        const fallbackCoverUrl = selectedTrack.artworkUrl || null;
        const fallbackYear = selectedTrack.releaseDate
            ? parseInt(selectedTrack.releaseDate.substring(0, 4), 10)
            : null;
        const fallbackUrl = selectedTrack.url || null;

        if (itunesData) {
            const coverUrl = itunesData.artworkUrl100
                ? itunesData.artworkUrl100.replace('100x100bb', '600x600bb')
                : fallbackCoverUrl;
            const year = itunesData.releaseDate
                ? parseInt(itunesData.releaseDate.substring(0, 4), 10)
                : fallbackYear;

            return {
                id: String(itunesData.trackId),
                title: itunesData.trackName || selectedTrack.name,
                artist: itunesData.artistName || selectedTrack.artist,
                originalName: selectedTrack.name,
                originalArtist: selectedTrack.artist,
                album: itunesData.collectionName || 'Unknown Album',
                year,
                genre: itunesData.primaryGenreName || 'Unknown',
                duration: itunesData.trackTimeMillis ? Math.round(itunesData.trackTimeMillis / 1000) : 200,
                listeners: selectedTrack.playcount || 0,
                coverUrl,
                previewUrl: itunesData.previewUrl || null,
                trackViewUrl: itunesData.trackViewUrl || fallbackUrl,
                rarity,
            };
        }

        // iTunesに接続できなかった場合（songs.jsonデータで生成）
        console.warn(`[API] iTunes unavailable, using songs.json fallback for "${selectedTrack.name}"`);

        return {
            id: `pool-${hashCode(`${selectedTrack.artist}::${selectedTrack.name}`)}`,
            title: selectedTrack.name,
            artist: selectedTrack.artist,
            originalName: selectedTrack.name,
            originalArtist: selectedTrack.artist,
            album: 'Unknown Album',
            year: fallbackYear,
            genre: 'Unknown',
            duration: 200,
            listeners: selectedTrack.playcount || 0,
            coverUrl: fallbackCoverUrl,
            previewUrl: null,
            trackViewUrl: fallbackUrl,
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
 * 指定レアリティに対応するランク範囲の曲からランダムに選出、iTunesで詳細情報を補完
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

        // iTunesで詳細データを取得（リトライあり）
        let itunesData = await lookupITunes(selectedTrack.name, selectedTrack.artist);

        // リトライ1: アーティスト名の最初の部分だけで検索（"Kenshi Yonezu & Hikaru Utada" → "Kenshi Yonezu"）
        if (!itunesData && selectedTrack.artist.includes(' & ')) {
            const firstArtist = selectedTrack.artist.split(' & ')[0].trim();
            itunesData = await lookupITunes(selectedTrack.name, firstArtist);
        }
        if (!itunesData && selectedTrack.artist.includes(', ')) {
            const firstArtist = selectedTrack.artist.split(', ')[0].trim();
            itunesData = await lookupITunes(selectedTrack.name, firstArtist);
        }

        const trackKey = `${selectedTrack.artist.toLowerCase()}::${selectedTrack.name.toLowerCase()}`;

        if (itunesData) {
            const coverUrl = itunesData.artworkUrl100
                ? itunesData.artworkUrl100.replace('100x100bb', '600x600bb')
                : null;
            const year = itunesData.releaseDate
                ? parseInt(itunesData.releaseDate.substring(0, 4), 10)
                : null;

            return {
                id: String(itunesData.trackId),
                title: itunesData.trackName || selectedTrack.name,
                artist: itunesData.artistName || selectedTrack.artist,
                originalName: selectedTrack.name,
                originalArtist: selectedTrack.artist,
                album: itunesData.collectionName || 'Unknown Album',
                year,
                genre: itunesData.primaryGenreName || 'Unknown',
                duration: itunesData.trackTimeMillis ? Math.round(itunesData.trackTimeMillis / 1000) : 200,
                listeners: 10000000 - (selectedTrack.rank * 49000),
                coverUrl,
                previewUrl: itunesData.previewUrl || null,
                trackViewUrl: itunesData.trackViewUrl || null,
                rarity,
                chartRank: selectedTrack.rank,
                top200Key: trackKey,
                isComplete: false,
            };
        }

        // iTunesに接続できなかった場合（事前取得データで生成）
        console.warn(`[API] iTunes unavailable for Top200, using fallback for "${selectedTrack.name}"`);
        const fallbackCover = selectedTrack.artworkUrl || null;
        const fallbackYr = selectedTrack.releaseDate
            ? parseInt(selectedTrack.releaseDate.substring(0, 4), 10)
            : null;

        return {
            id: `top200-${hashCode(`${selectedTrack.artist}::${selectedTrack.name}`)}`,
            title: selectedTrack.name,
            artist: selectedTrack.artist,
            originalName: selectedTrack.name,
            originalArtist: selectedTrack.artist,
            album: 'Unknown Album',
            year: fallbackYr,
            genre: 'Unknown',
            duration: 200,
            listeners: 10000000 - (selectedTrack.rank * 49000),
            coverUrl: fallbackCover,
            previewUrl: null,
            trackViewUrl: selectedTrack.url || null,
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

