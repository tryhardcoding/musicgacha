// ============================================================
// MusicGacha - Data Loader Module
// 全データファイルの一元キャッシュ管理
// TTL付きメモリキャッシュ + 同一URLへの並行リクエスト自動デデュプリケーション
// ============================================================

import { getRegionConfig } from './region.js';

// キャッシュエントリ: { data, timestamp }
const cache = {};
const pendingRequests = {};

// URL別TTL設定（ミリ秒）
const TTL_MAP = {
    'top200-daily': 5 * 60 * 1000,   // 5分
    'songs': 30 * 60 * 1000,          // 30分
    'packs': 60 * 60 * 1000,          // 1時間
    'genres': 60 * 60 * 1000,         // 1時間
};
const DEFAULT_TTL = 10 * 60 * 1000; // デフォルト10分

function getTTL(url) {
    for (const [key, ttl] of Object.entries(TTL_MAP)) {
        if (url.includes(key)) return ttl;
    }
    return DEFAULT_TTL;
}

/**
 * データファイルをTTL付きキャッシュで取得
 * 同一URLへの並行リクエストがあれば1つにまとめる
 * @param {string} url - fetch先URL
 * @returns {Promise<any>} パース済みJSON
 */
async function fetchCached(url) {
    // TTL付きキャッシュヒット判定
    const entry = cache[url];
    const ttl = getTTL(url);
    if (entry && (Date.now() - entry.timestamp) < ttl) {
        return entry.data;
    }

    // 同一URLへの進行中リクエストがあれば待つ（デデュプ）
    if (pendingRequests[url]) return pendingRequests[url];

    // 新規リクエスト
    const promise = fetch(url)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
            return res.json();
        })
        .then(data => {
            cache[url] = { data, timestamp: Date.now() };
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

/**
 * キャッシュを無効化する
 * @param {string} [url] - 特定のURLのキャッシュを無効化。省略すると全キャッシュをクリア
 */
export function invalidateCache(url) {
    if (url) {
        delete cache[url];
        console.log(`[DataLoader] Cache invalidated: ${url}`);
    } else {
        for (const key in cache) {
            delete cache[key];
        }
        console.log('[DataLoader] All cache invalidated');
    }
}

// ---- 公開API ----

/** songs.json のパックデータを取得（リージョン対応） */
export async function getSongPool() {
    try {
        const config = getRegionConfig();
        const data = await fetchCached(config.songsFile);
        return data.packs;
    } catch (error) {
        console.error('[DataLoader] Failed to load song pool:', error);
        return null;
    }
}

/** top200-daily.json のデータを取得（リージョン対応） */
export async function getTop200Daily() {
    try {
        const config = getRegionConfig();
        return await fetchCached(config.top200File);
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

/** packs.json のパック設定を取得（リージョン対応） */
export async function getPacksConfig() {
    try {
        const config = getRegionConfig();
        const data = await fetchCached(config.packsFile);
        return data.packs;
    } catch (error) {
        console.error('[DataLoader] Failed to load packs config:', error);
        // フォールバック: デフォルトのパック設定を返す
        console.warn('[DataLoader] Using fallback packs config');
        return [
            { id: 'standard', icon: '🎵', color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6, #ec4899)' },
            { id: 'top200', icon: '🏆', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)', isDaily: true }
        ];
    }
}
