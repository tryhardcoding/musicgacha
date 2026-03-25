// ============================================================
// MusicGacha - Achievements Module
// 実績システム（定義・判定・解放・報酬）
// ============================================================

import { getCollection, getPackData, getTop200Data, getFavorites, recoverPacks } from './storage.js';
import { icon, refreshIcons } from './icons.js';
import { t } from './i18n.js';
import { getStorageSuffix } from './region.js';

// ---- Storage ----

function getStorageKey() {
    return 'musicgacha_achievements' + getStorageSuffix();
}

function getAchievementData() {
    try {
        const raw = localStorage.getItem(getStorageKey());
        if (!raw) return { unlocked: {}, dailyBonusCount: 0, completedTop200Dates: [], usedPackTypes: [], sharedCount: 0, transferSendCount: 0, transferReceiveCount: 0, goldPackCount: 0, godPackCount: 0 };
        return JSON.parse(raw);
    } catch {
        return { unlocked: {}, dailyBonusCount: 0, completedTop200Dates: [], usedPackTypes: [], sharedCount: 0, transferSendCount: 0, transferReceiveCount: 0, goldPackCount: 0, godPackCount: 0 };
    }
}

function saveAchievementData(data) {
    try {
        localStorage.setItem(getStorageKey(), JSON.stringify(data));
    } catch (e) {
        console.error('[Achievements] Failed to save:', e);
    }
}

// ---- Reward ----
// recoverPacks() を使用: current < max → maxまで回復, current >= max → +1

// ---- Achievement Definitions ----

const CATEGORIES = [
    { id: 'collection', name: () => t('ach.cat.collection') || 'Collection', icon: 'library' },
    { id: 'pack', name: () => t('ach.cat.pack') || 'Pack Opening', icon: 'package' },
    { id: 'rarity', name: () => t('ach.cat.rarity') || 'Rarity', icon: 'star' },
    { id: 'top200', name: () => t('ach.cat.top200') || 'TOP200 Challenge', icon: 'trophy' },
    { id: 'artist', name: () => t('ach.cat.artist') || 'Artist', icon: 'mic' },
    { id: 'social', name: () => t('ach.cat.social') || 'Social', icon: 'share-2' },
    { id: 'dedication', name: () => t('ach.cat.dedication') || 'Dedication', icon: 'flame' },
];

const ACHIEVEMENTS = [
    // ---- コレクション系 (8) ----
    { id: 'first_card', category: 'collection', icon: 'music', get name() { return t('ach.first_card.name'); }, get desc() { return t('ach.first_card.desc'); }, check: (ctx) => ctx.uniqueCount >= 1 },
    { id: 'collector_10', category: 'collection', icon: 'disc', get name() { return t('ach.collector_10.name'); }, get desc() { return t('ach.collector_10.desc'); }, check: (ctx) => ctx.uniqueCount >= 10 },
    { id: 'collector_50', category: 'collection', icon: 'disc-3', get name() { return t('ach.collector_50.name'); }, get desc() { return t('ach.collector_50.desc'); }, check: (ctx) => ctx.uniqueCount >= 50 },
    { id: 'collector_100', category: 'collection', icon: 'medal', get name() { return t('ach.collector_100.name'); }, get desc() { return t('ach.collector_100.desc'); }, check: (ctx) => ctx.uniqueCount >= 100 },
    { id: 'collector_300', category: 'collection', icon: 'gem', get name() { return t('ach.collector_300.name'); }, get desc() { return t('ach.collector_300.desc'); }, check: (ctx) => ctx.uniqueCount >= 300 },
    { id: 'collector_500', category: 'collection', icon: 'crown', get name() { return t('ach.collector_500.name'); }, get desc() { return t('ach.collector_500.desc'); }, check: (ctx) => ctx.uniqueCount >= 500 },
    { id: 'collector_1000', category: 'collection', icon: 'sparkles', get name() { return t('ach.collector_1000.name'); }, get desc() { return t('ach.collector_1000.desc'); }, check: (ctx) => ctx.uniqueCount >= 1000 },
    { id: 'duplicate_10', category: 'collection', icon: 'copy', get name() { return t('ach.duplicate_10.name'); }, get desc() { return t('ach.duplicate_10.desc'); }, check: (ctx) => ctx.maxDuplicate >= 10 },

    // ---- パック開封系 (6) ----
    { id: 'pack_1', category: 'pack', icon: 'package', get name() { return t('ach.pack_1.name'); }, get desc() { return t('ach.pack_1.desc'); }, check: (ctx) => ctx.totalOpened >= 1 },
    { id: 'pack_10', category: 'pack', icon: 'package-open', get name() { return t('ach.pack_10.name'); }, get desc() { return t('ach.pack_10.desc'); }, check: (ctx) => ctx.totalOpened >= 10 },
    { id: 'pack_50', category: 'pack', icon: 'boxes', get name() { return t('ach.pack_50.name'); }, get desc() { return t('ach.pack_50.desc'); }, check: (ctx) => ctx.totalOpened >= 50 },
    { id: 'pack_100', category: 'pack', icon: 'warehouse', get name() { return t('ach.pack_100.name'); }, get desc() { return t('ach.pack_100.desc'); }, check: (ctx) => ctx.totalOpened >= 100 },
    { id: 'pack_500', category: 'pack', icon: 'factory', get name() { return t('ach.pack_500.name'); }, get desc() { return t('ach.pack_500.desc'); }, check: (ctx) => ctx.totalOpened >= 500 },
    { id: 'pack_1000', category: 'pack', icon: 'bot', get name() { return t('ach.pack_1000.name'); }, get desc() { return t('ach.pack_1000.desc'); }, check: (ctx) => ctx.totalOpened >= 1000 },

    // ---- レアリティ系 (6) ----
    { id: 'rarity_r_10', category: 'rarity', icon: 'circle-dot', get name() { return t('ach.rarity_r_10.name'); }, get desc() { return t('ach.rarity_r_10.desc'); }, check: (ctx) => ctx.rarityCounts.R >= 20 },
    { id: 'rarity_sr_5', category: 'rarity', icon: 'star', get name() { return t('ach.rarity_sr_5.name'); }, get desc() { return t('ach.rarity_sr_5.desc'); }, check: (ctx) => ctx.rarityCounts.SR >= 20 },
    { id: 'rarity_ur_3', category: 'rarity', icon: 'flame', get name() { return t('ach.rarity_ur_3.name'); }, get desc() { return t('ach.rarity_ur_3.desc'); }, check: (ctx) => ctx.rarityCounts.UR >= 20 },
    { id: 'rarity_lr', category: 'rarity', icon: 'rainbow', get name() { return t('ach.rarity_lr.name'); }, get desc() { return t('ach.rarity_lr.desc'); }, check: (ctx) => ctx.rarityCounts.LR >= 20 },
    { id: 'gold_pack', category: 'rarity', icon: 'sparkle', get name() { return t('ach.gold_pack.name'); }, get desc() { return t('ach.gold_pack.desc'); }, check: (ctx) => ctx.goldPackCount >= 1 },
    { id: 'god_pack', category: 'rarity', icon: 'zap', get name() { return t('ach.god_pack.name'); }, get desc() { return t('ach.god_pack.desc'); }, check: (ctx) => ctx.godPackCount >= 1 },

    // ---- TOP200チャレンジ系 (9) ----
    { id: 'top200_10', category: 'top200', icon: 'target', get name() { return t('ach.top200_10.name'); }, get desc() { return t('ach.top200_10.desc'); }, check: (ctx) => ctx.top200Obtained >= 10 },
    { id: 'top200_50', category: 'top200', icon: 'award', get name() { return t('ach.top200_50.name'); }, get desc() { return t('ach.top200_50.desc'); }, check: (ctx) => ctx.top200Obtained >= 50 },
    { id: 'top200_100', category: 'top200', icon: 'trophy', get name() { return t('ach.top200_100.name'); }, get desc() { return t('ach.top200_100.desc'); }, check: (ctx) => ctx.top200Obtained >= 100 },
    { id: 'top200_150', category: 'top200', icon: 'shield-check', get name() { return t('ach.top200_150.name'); }, get desc() { return t('ach.top200_150.desc'); }, check: (ctx) => ctx.top200Obtained >= 150 },
    { id: 'top200_200', category: 'top200', icon: 'diamond', get name() { return t('ach.top200_200.name'); }, get desc() { return t('ach.top200_200.desc'); }, check: (ctx) => ctx.top200Obtained >= 200 },
    { id: 'top200_complete_1', category: 'top200', icon: 'calendar-check', get name() { return t('ach.top200_complete_1.name'); }, get desc() { return t('ach.top200_complete_1.desc'); }, check: (ctx) => ctx.completedTop200Days >= 1 },
    { id: 'top200_complete_3', category: 'top200', icon: 'calendar-clock', get name() { return t('ach.top200_complete_3.name'); }, get desc() { return t('ach.top200_complete_3.desc'); }, check: (ctx) => ctx.completedTop200Days >= 3 },
    { id: 'top200_complete_7', category: 'top200', icon: 'calendar-plus', get name() { return t('ach.top200_complete_7.name'); }, get desc() { return t('ach.top200_complete_7.desc'); }, check: (ctx) => ctx.completedTop200Days >= 7 },
    { id: 'top200_complete_30', category: 'top200', icon: 'crown', get name() { return t('ach.top200_complete_30.name'); }, get desc() { return t('ach.top200_complete_30.desc'); }, check: (ctx) => ctx.completedTop200Days >= 30 },

    // ---- アーティスト系 (5) ----
    { id: 'artist_3', category: 'artist', icon: 'mic', get name() { return t('ach.artist_3.name'); }, get desc() { return t('ach.artist_3.desc'); }, check: (ctx) => ctx.maxArtistSongs >= 3 },
    { id: 'artist_5', category: 'artist', icon: 'mic-vocal', get name() { return t('ach.artist_5.name'); }, get desc() { return t('ach.artist_5.desc'); }, check: (ctx) => ctx.maxArtistSongs >= 5 },
    { id: 'artist_10', category: 'artist', icon: 'heart', get name() { return t('ach.artist_10.name'); }, get desc() { return t('ach.artist_10.desc'); }, check: (ctx) => ctx.maxArtistSongs >= 10 },
    { id: 'artist_20', category: 'artist', icon: 'heart-handshake', get name() { return t('ach.artist_20.name'); }, get desc() { return t('ach.artist_20.desc'); }, check: (ctx) => ctx.maxArtistSongs >= 20 },
    { id: 'diverse_artists_20', category: 'artist', icon: 'users', get name() { return t('ach.diverse_artists_20.name'); }, get desc() { return t('ach.diverse_artists_20.desc'); }, check: (ctx) => ctx.uniqueArtists >= 100 },

    // ---- ソーシャル系 (3) ----
    { id: 'share_first', category: 'social', icon: 'share-2', get name() { return t('ach.share_first.name'); }, get desc() { return t('ach.share_first.desc'); }, check: (ctx) => ctx.sharedCount >= 1 },
    { id: 'transfer_send', category: 'social', icon: 'send', get name() { return t('ach.transfer_send.name'); }, get desc() { return t('ach.transfer_send.desc'); }, check: (ctx) => ctx.transferSendCount >= 1 },
    { id: 'transfer_receive', category: 'social', icon: 'mail', get name() { return t('ach.transfer_receive.name'); }, get desc() { return t('ach.transfer_receive.desc'); }, check: (ctx) => ctx.transferReceiveCount >= 1 },

    // ---- やりこみ系 (5) ----
    { id: 'daily_7', category: 'dedication', icon: 'calendar-days', get name() { return t('ach.daily_7.name'); }, get desc() { return t('ach.daily_7.desc'); }, check: (ctx) => ctx.dailyBonusCount >= 7 },
    { id: 'daily_30', category: 'dedication', icon: 'calendar-check-2', get name() { return t('ach.daily_30.name'); }, get desc() { return t('ach.daily_30.desc'); }, check: (ctx) => ctx.dailyBonusCount >= 30 },
    { id: 'all_packs', category: 'dedication', icon: 'layers', get name() { return t('ach.all_packs.name'); }, get desc() { return t('ach.all_packs.desc'); }, check: (ctx) => ctx.usedPackTypes >= 8 },
    { id: 'rarity_complete', category: 'dedication', icon: 'layout-grid', get name() { return t('ach.rarity_complete.name'); }, get desc() { return t('ach.rarity_complete.desc'); }, check: (ctx) => ctx.rarities.size >= 6 },
    { id: 'achievement_all', category: 'dedication', icon: 'badge-check', get name() { return t('ach.achievement_all.name'); }, get desc() { return t('ach.achievement_all.desc'); }, check: (ctx) => ctx.unlockedCount >= ACHIEVEMENTS.length - 1 },
];

// ---- Context Builder ----

function buildContext() {
    const collection = getCollection();
    const packData = getPackData();
    const top200Data = getTop200Data();
    const achData = getAchievementData();

    // ユニーク曲数
    const uniqueCount = collection.length;

    // 最大重複数
    let maxDuplicate = 0;
    for (const card of collection) {
        if ((card.count || 1) > maxDuplicate) maxDuplicate = card.count || 1;
    }

    // レアリティセット + レアリティ別カウント
    const rarities = new Set();
    const rarityCounts = { C: 0, UC: 0, R: 0, SR: 0, UR: 0, LR: 0 };
    for (const card of collection) {
        if (card.rarity) {
            rarities.add(card.rarity);
            rarityCounts[card.rarity] = (rarityCounts[card.rarity] || 0) + 1;
        }
    }

    // アーティスト別曲数
    const artistMap = new Map();
    for (const card of collection) {
        const artist = (card.originalArtist || card.artist || '').toLowerCase();
        if (artist) {
            artistMap.set(artist, (artistMap.get(artist) || 0) + 1);
        }
    }
    let maxArtistSongs = 0;
    for (const count of artistMap.values()) {
        if (count > maxArtistSongs) maxArtistSongs = count;
    }
    const uniqueArtists = artistMap.size;

    return {
        uniqueCount,
        maxDuplicate,
        totalOpened: packData.totalOpened || 0,
        rarities,
        rarityCounts,
        top200Obtained: top200Data.obtainedKeys?.length || 0,
        completedTop200Days: achData.completedTop200Dates?.length || 0,
        maxArtistSongs,
        uniqueArtists,
        dailyBonusCount: achData.dailyBonusCount || 0,
        usedPackTypes: achData.usedPackTypes?.length || 0,
        sharedCount: achData.sharedCount || 0,
        transferSendCount: achData.transferSendCount || 0,
        transferReceiveCount: achData.transferReceiveCount || 0,
        goldPackCount: achData.goldPackCount || 0,
        godPackCount: achData.godPackCount || 0,
        unlockedCount: Object.keys(achData.unlocked || {}).length,
    };
}

// ---- Check & Unlock ----

/**
 * 全実績をチェックし、新たに解放された実績を返す
 * @returns {Array} 新たに解放された実績のリスト
 */
export function checkAchievements() {
    const data = getAchievementData();
    const ctx = buildContext();
    const newlyUnlocked = [];

    for (const ach of ACHIEVEMENTS) {
        if (data.unlocked[ach.id]) continue; // 既に解放済み
        try {
            if (ach.check(ctx)) {
                data.unlocked[ach.id] = new Date().toISOString();
                newlyUnlocked.push(ach);
            }
        } catch (e) {
            console.warn(`[Achievements] Check failed for ${ach.id}:`, e);
        }
    }

    if (newlyUnlocked.length > 0) {
        saveAchievementData(data);

        // 報酬: 解放ごとにフル回復 or +1
        for (let i = 0; i < newlyUnlocked.length; i++) {
            const { added } = recoverPacks();
            const ach = newlyUnlocked[i];
            setTimeout(() => {
                if (window.MusicGacha?.showToast) {
                    window.MusicGacha.showToast(
                        t("ach.unlockedMsg", { name: ach.name, added }),
                        'success',
                        4000
                    );
                }
            }, i * 1500); // 1.5秒間隔で表示
        }

        // achievement_all の再チェック（他の実績解放後に条件が満たされる可能性）
        const allAch = ACHIEVEMENTS.find(a => a.id === 'achievement_all');
        if (allAch && !data.unlocked['achievement_all']) {
            const updatedCtx = { ...ctx, unlockedCount: Object.keys(data.unlocked).length };
            if (allAch.check(updatedCtx)) {
                data.unlocked['achievement_all'] = new Date().toISOString();
                saveAchievementData(data);
                const { added } = recoverPacks();
                setTimeout(() => {
                    if (window.MusicGacha?.showToast) {
                        window.MusicGacha.showToast(
                            `${t("ach.unlockedMsg", { name: t("ach.completeMaster") || "Complete Master", added })}`,
                            'success',
                            4000
                        );
                    }
                }, newlyUnlocked.length * 1500);
            }
        }

        console.log(`[Achievements] Unlocked ${newlyUnlocked.length}: ${newlyUnlocked.map(a => a.id).join(', ')}`);
    }

    return newlyUnlocked;
}

// ---- Event Tracking ----

/** ゴールドパック遭遇を記録 */
export function trackGoldPack() {
    const data = getAchievementData();
    data.goldPackCount = (data.goldPackCount || 0) + 1;
    saveAchievementData(data);
}

/** ゴッドパック遭遇を記録 */
export function trackGodPack() {
    const data = getAchievementData();
    data.godPackCount = (data.godPackCount || 0) + 1;
    saveAchievementData(data);
}

/** パック種別の使用を記録 */
export function trackPackType(packType) {
    const data = getAchievementData();
    if (!data.usedPackTypes) data.usedPackTypes = [];
    if (!data.usedPackTypes.includes(packType)) {
        data.usedPackTypes.push(packType);
        saveAchievementData(data);
    }
}

/** SNSシェアを記録 */
export function trackShare() {
    const data = getAchievementData();
    data.sharedCount = (data.sharedCount || 0) + 1;
    saveAchievementData(data);
    checkAchievements();
}

/** カード送信を記録 */
export function trackTransferSend() {
    const data = getAchievementData();
    data.transferSendCount = (data.transferSendCount || 0) + 1;
    saveAchievementData(data);
    checkAchievements();
}

/** カード受取を記録 */
export function trackTransferReceive() {
    const data = getAchievementData();
    data.transferReceiveCount = (data.transferReceiveCount || 0) + 1;
    saveAchievementData(data);
    checkAchievements();
}

/** デイリーボーナス受取を記録 */
export function trackDailyBonus() {
    const data = getAchievementData();
    data.dailyBonusCount = (data.dailyBonusCount || 0) + 1;
    saveAchievementData(data);
    checkAchievements();
}

/** TOP200コンプリート日を記録 */
export function trackTop200Complete(date) {
    const data = getAchievementData();
    if (!data.completedTop200Dates) data.completedTop200Dates = [];
    if (!data.completedTop200Dates.includes(date)) {
        data.completedTop200Dates.push(date);
        saveAchievementData(data);
        checkAchievements();
    }
}

// ---- Query API ----

/** 全実績リストを取得 */
export function getAllAchievements() {
    return ACHIEVEMENTS;
}

/** カテゴリ一覧を取得 */
export function getCategories() {
    return CATEGORIES;
}

/** 解放済み実績のIDセットを取得 */
export function getUnlockedSet() {
    const data = getAchievementData();
    return new Set(Object.keys(data.unlocked || {}));
}

/** 解放済み実績数 / 全実績数 を取得 */
export function getAchievementStats() {
    const data = getAchievementData();
    const unlocked = Object.keys(data.unlocked || {}).length;
    return { unlocked, total: ACHIEVEMENTS.length };
}

/** 実績データをリセット */
export function resetAchievements() {
    localStorage.removeItem(getStorageKey());
}

// ---- Modal Rendering ----

/**
 * 実績モーダルの中身を描画
 */
export function renderAchievementModal() {
    const container = document.getElementById('achievement-list');
    if (!container) return;

    const unlockedSet = getUnlockedSet();
    const stats = getAchievementStats();
    container.innerHTML = '';

    // 統計ヘッダー
    const statsEl = document.createElement('div');
    statsEl.className = 'achievement-stats';
    statsEl.innerHTML = `
        <span class="achievement-stats-count">${stats.unlocked} / ${stats.total}</span>
        <span class="achievement-stats-label">${t("ach.unlocked")}</span>
        <div class="achievement-stats-bar">
            <div class="achievement-stats-bar-fill" style="width: ${(stats.unlocked / stats.total) * 100}%"></div>
        </div>
    `;
    container.appendChild(statsEl);

    // カテゴリ別に表示
    for (const cat of CATEGORIES) {
        const catAchs = ACHIEVEMENTS.filter(a => a.category === cat.id);
        if (catAchs.length === 0) continue;

        const section = document.createElement('div');
        section.className = 'achievement-category';

        const catHeader = document.createElement('div');
        catHeader.className = 'achievement-category-header';
        catHeader.innerHTML = `${icon(cat.icon, { size: 18 })} ${typeof cat.name === "function" ? cat.name() : cat.name}`;
        section.appendChild(catHeader);

        const grid = document.createElement('div');
        grid.className = 'achievement-grid';

        for (const ach of catAchs) {
            const isUnlocked = unlockedSet.has(ach.id);
            const card = document.createElement('div');
            card.className = `achievement-card ${isUnlocked ? 'achievement-unlocked' : 'achievement-locked'}`;

            card.innerHTML = `
                <div class="achievement-icon">${icon(ach.icon, { size: 24 })}</div>
                <div class="achievement-info">
                    <div class="achievement-name">${ach.name}</div>
                    <div class="achievement-desc">${ach.desc}</div>
                </div>
                ${isUnlocked ? `<div class="achievement-check">${icon('check', { size: 16 })}</div>` : ''}
            `;
            grid.appendChild(card);
        }

        section.appendChild(grid);
        container.appendChild(section);
    }

    refreshIcons();
}

// ---- Global Reference ----

if (typeof window !== 'undefined') {
    window.MusicGacha = window.MusicGacha || {};
    window.MusicGacha.checkAchievements = checkAchievements;
    window.MusicGacha.getAchievements = getAchievementStats;
    window.MusicGacha.renderAchievementModal = renderAchievementModal;
}
