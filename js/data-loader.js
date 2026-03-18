// ============================================================
// MusicGacha - Data Loader Module
// 全データファイルの一元キャッシュ管理
// 同一URLへの並行リクエストを自動デデュプリケーション
// ============================================================

const cache = {};
const pendingRequests = {};

/**
 * データファイルをキャッシュ付きで取得
 * 同一URLへの並行リクエストがあれば1つにまとめる
 * @param {string} url - fetch先URL
 * @returns {Promise<any>} パース済みJSON
 */
async function fetchCached(url) {
    // キャッシュヒット
    if (cache[url]) return cache[url];

    // 同一URLへの進行中リクエストがあれば待つ（デデュプ）
    if (pendingRequests[url]) return pendingRequests[url];

    // 新規リクエスト
    const promise = fetch(url)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
            return res.json();
        })
        .then(data => {
            cache[url] = data;
            delete pendingRequests[url];
            return data;
        })
        .catch(err => {
            delete pendingRequests[url];
            throw err;
        });

    pendingRequests[url] = promise;
    return promise;
}

// ---- 公開API ----

/** songs.json のパックデータを取得 */
export async function getSongPool() {
    try {
        const data = await fetchCached('./data/songs.json');
        return data.packs;
    } catch (error) {
        console.error('[DataLoader] Failed to load song pool:', error);
        return null;
    }
}

/** top200-daily.json のデータを取得 */
export async function getTop200Daily() {
    try {
        return await fetchCached('./data/top200-daily.json');
    } catch (error) {
        console.error('[DataLoader] Failed to load Top 200 data:', error);
        return null;
    }
}

/** genres.json のジャンルデータを取得 */
export async function getGenreData() {
    try {
        const data = await fetchCached('./data/genres.json');
        return data.genres;
    } catch (error) {
        console.error('[DataLoader] Failed to load genre data:', error);
        return {};
    }
}

/** packs.json のパック設定を取得 */
export async function getPacksConfig() {
    try {
        const data = await fetchCached('./data/packs.json');
        return data.packs;
    } catch (error) {
        console.error('[DataLoader] Failed to load packs config:', error);
        return null;
    }
}
