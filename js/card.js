// ============================================================
// MusicGacha - Card Module
// カードデータモデル・ステータス計算
// ============================================================

// ---- Rarity Config ----

export const RARITY_CONFIG = {
    LR: { name: 'Legend', multiplier: 8.0, color: 'rainbow', order: 6 },
    UR: { name: 'Ultra Rare', multiplier: 5.0, color: '#f59e0b', order: 5 },
    SR: { name: 'Super Rare', multiplier: 3.0, color: '#a855f7', order: 4 },
    R: { name: 'Rare', multiplier: 2.0, color: '#3b82f6', order: 3 },
    UC: { name: 'Uncommon', multiplier: 1.5, color: '#22c55e', order: 2 },
    C: { name: 'Common', multiplier: 1.0, color: '#6b7280', order: 1 },
};

export const MAX_STAT = 15000;

// ---- Stat Calculation ----

/**
 * ATK（人気度）を計算
 * @param {number} listeners - Last.fm listeners count
 * @param {string} rarity - レアリティコード
 * @returns {number}
 */
export function calculateATK(listeners, rarity) {
    const multiplier = RARITY_CONFIG[rarity]?.multiplier || 1.0;
    return Math.min(Math.round(listeners * multiplier / 1000), MAX_STAT);
}

/**
 * DEF（存在感）を計算
 * @param {number} durationSec - 曲の長さ（秒）
 * @param {string} rarity - レアリティコード
 * @returns {number}
 */
export function calculateDEF(durationSec, rarity) {
    const multiplier = RARITY_CONFIG[rarity]?.multiplier || 1.0;
    return Math.min(Math.round(durationSec * multiplier * 10), MAX_STAT);
}

// ---- Card Object Creation ----

/**
 * APIから取得した生データからカードオブジェクトを生成
 * @param {Object} rawData - fetchCardDataの戻り値
 * @param {number} packNumber - 何番目のパックか
 * @returns {Object} card
 */
export function createCard(rawData, packNumber) {
    const atk = calculateATK(rawData.listeners || 0, rawData.rarity);
    const def = calculateDEF(rawData.duration || 200, rawData.rarity);

    return {
        id: rawData.id,
        title: rawData.title,
        artist: rawData.artist,
        originalName: rawData.originalName || rawData.title,
        originalArtist: rawData.originalArtist || rawData.artist,
        album: rawData.album || 'Unknown Album',
        year: rawData.year || null,
        genre: rawData.genre || 'Unknown',
        duration: rawData.duration || 200,
        listeners: rawData.listeners || 0,
        atk,
        def,
        rarity: rawData.rarity,
        coverUrl: rawData.coverUrl || null,
        previewUrl: rawData.previewUrl || null,
        trackViewUrl: rawData.trackViewUrl || null,
        acquiredAt: new Date().toISOString(),
        packNumber,
        count: 1,
    };
}

/**
 * 曲の長さをフォーマット (秒 → M:SS)
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

/**
 * ステータス値を15000に対するパーセンテージで返す
 * @param {number} value
 * @returns {number} 0-100
 */
export function statPercentage(value) {
    return Math.min((value / MAX_STAT) * 100, 100);
}
