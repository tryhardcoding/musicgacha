// ============================================================
// MusicGacha - Gacha Module
// ガチャロジック (パック管理, レアリティ抽選, ジャンル検索)
// ============================================================

import { fetchCardFromGenre, fetchCardFromTop200, getTop200ChartDate, getTop200Tracks } from './api.js';
import { createCard } from './card.js';
import { consumePack, addCardToCollection, getPackData, isGoldPack, getTop200Data, addTop200Obtained, syncTop200WithNewChart } from './storage.js';
import { renderPackOpening } from './pack-animation.js';
import { t } from './i18n.js';
import { getPacksConfig } from './data-loader.js';

// ---- Rarity Rates ----

const NORMAL_RATES = [
    { rarity: 'C', weight: 40 },
    { rarity: 'UC', weight: 25 },
    { rarity: 'R', weight: 18 },
    { rarity: 'SR', weight: 10 },
    { rarity: 'UR', weight: 5 },
    { rarity: 'LR', weight: 2 },
];

const GOLD_RATES = [
    { rarity: 'R', weight: 40 },
    { rarity: 'SR', weight: 30 },
    { rarity: 'UR', weight: 20 },
    { rarity: 'LR', weight: 10 },
];

const GOD_RATES = [
    { rarity: 'UR', weight: 60 },
    { rarity: 'LR', weight: 40 },
];

// ゴッドパック確率 (1/200)
const GOD_PACK_CHANCE = 1 / 200;
// デバッグ: true にすると常にゴッドパック
const DEBUG_FORCE_GOD_PACK = false;

// ---- Hint Rarity (ホバー示唆) ----

const RARITY_ORDER = ['C', 'UC', 'R', 'SR', 'UR', 'LR'];

/**
 * パック内の最高レアリティから示唆レアリティを計算
 * @param {string[]} rarities - パック内カードのレアリティ配列
 * @returns {string|null} 示唆レアリティ (null = 示唆なし)
 */
function calculateHintRarity(rarities) {
    // 最高レアリティを取得
    let maxIdx = 0;
    for (const r of rarities) {
        const idx = RARITY_ORDER.indexOf(r);
        if (idx > maxIdx) maxIdx = idx;
    }

    // R未満（C, UC）は示唆対象外
    if (maxIdx < 2) return null;

    const roll = Math.random();

    if (roll < 0.70) {
        // 70%: 示唆なし
        return null;
    } else if (roll < 0.80) {
        // 10%: 1段下の示唆
        const hintIdx = Math.max(maxIdx - 1, 2); // R以上を保証
        return RARITY_ORDER[hintIdx];
    } else if (roll < 0.85) {
        // 5%: 2段下の示唆
        const hintIdx = Math.max(maxIdx - 2, 2); // R以上を保証
        return RARITY_ORDER[hintIdx];
    } else {
        // 15%: 正確な示唆
        return RARITY_ORDER[maxIdx];
    }
}

// ---- Packs Config (共通キャッシュ経由) ----

let packsConfig = null;

async function loadPacksConfig() {
    if (packsConfig) return packsConfig;
    packsConfig = await getPacksConfig();
    return packsConfig;
}

// ---- Rarity Roll ----

function rollRarity(isGold = false, isGod = false) {
    const rates = isGod ? GOD_RATES : (isGold ? GOLD_RATES : NORMAL_RATES);
    const totalWeight = rates.reduce((sum, r) => sum + r.weight, 0);
    let roll = Math.random() * totalWeight;

    for (const rate of rates) {
        roll -= rate.weight;
        if (roll <= 0) return rate.rarity;
    }

    return rates[rates.length - 1].rarity;
}

/**
 * ゴッドパック判定
 */
function isGodPack() {
    if (DEBUG_FORCE_GOD_PACK) return true;
    return Math.random() < GOD_PACK_CHANCE;
}

// ---- Pack Opening ----

/**
 * パックを開封 - メインのガチャフロー
 * @param {string} packType - パックタイプ (standard, jpop, kpop, etc.)
 */
export async function openPack(packType = 'standard', autoTap = false) {
    // パック設定読み込み
    await loadPacksConfig();

    if (!packsConfig) {
        window.MusicGacha?.showToast?.(t('toast.apiError'), 'error');
        return;
    }

    // パック設定を取得
    const packConfig = packsConfig.find(p => p.id === packType) || packsConfig[0];

    // パック消費チェック
    const packData = consumePack();
    if (!packData) {
        window.MusicGacha?.showToast?.(t('toast.noPacks'), 'error');
        window.MusicGacha?.navigateTo?.('home');
        return;
    }

    // ゴールドパック判定
    const gold = isGoldPack();
    const packNumber = packData.totalOpened;

    // ゴッドパック判定（ゴールドより優先）
    const god = isGodPack();
    if (god) {
        console.log('[Gacha] ⚡ GOD PACK activated!');
    }

    // ローディング表示
    window.MusicGacha?.showLoading?.();

    try {
        // Top 200パックの場合は専用ロジック
        if (packType === 'top200') {
            // チャート日付の同期チェック
            const chartDate = await getTop200ChartDate();
            const tracks = await getTop200Tracks();
            if (chartDate && tracks.length > 0) {
                const syncResult = syncTop200WithNewChart(chartDate, tracks);
                if (syncResult.removed > 0) {
                    console.log(`[Gacha] Top 200 chart synced: kept ${syncResult.kept}, removed ${syncResult.removed}`);
                }
            }

            // 取得済みキーをSetに変換
            const top200Data = getTop200Data();
            const obtainedKeys = new Set(top200Data.obtainedKeys);

            // 6枚のレアリティを先にロール
            const effectiveGold = god ? false : gold;
            const rolledRarities = [];
            for (let i = 0; i < 6; i++) {
                rolledRarities.push(rollRarity(effectiveGold, god));
            }

            // 示唆レアリティを計算（ゴッドパックは専用演出のため示唆なし）
            const hintRarity = god ? null : calculateHintRarity(rolledRarities);

            // 6枚のカードデータを並列で取得
            const cardPromises = rolledRarities.map(rarity =>
                fetchCardFromTop200(obtainedKeys, rarity).then(rawData => {
                    const card = createCard(rawData, packNumber);
                    card.isNew = !isCardOwned(card.id);
                    addCardToCollection(card);

                    // Top 200の取得記録
                    if (rawData.top200Key) {
                        addTop200Obtained(rawData.top200Key);
                        obtainedKeys.add(rawData.top200Key); // 同パック内の重複防止
                    }
                    if (rawData.chartRank) {
                        card.chartRank = rawData.chartRank;
                    }

                    return card;
                })
            );

            const cardsPromise = Promise.all(cardPromises);
            // カードデータ取得Promiseを保存（シェアボタン早押し対応）
            window.MusicGacha._packResultPromise = cardsPromise.then(cards => {
                const result = { cards, packType, isGold: gold, isGod: god };
                window.MusicGacha._lastPackResult = result;
                return result;
            });

            await renderPackOpening(cardsPromise, gold, autoTap, god, hintRarity);
            window.MusicGacha?.updateHomeScreen?.();
            return;
        }

        // 通常パック: 6枚のレアリティを先にロール
        const effectiveGold = god ? false : gold;
        const rolledRarities = [];
        for (let i = 0; i < 6; i++) {
            rolledRarities.push(rollRarity(effectiveGold, god));
        }

        // 示唆レアリティを計算（ゴッドパックは専用演出のため示唆なし）
        const hintRarity = god ? null : calculateHintRarity(rolledRarities);

        const cardPromises = rolledRarities.map(rarity =>
            fetchCardFromGenre(packConfig, rarity).then(rawData => {
                const card = createCard(rawData, packNumber);
                card.isNew = !isCardOwned(card.id);
                addCardToCollection(card);
                return card;
            })
        );

        // カードデータの Promise をまとめる
        const cardsPromise = Promise.all(cardPromises);
        // カードデータ取得Promiseを保存（シェアボタン早押し対応）
        window.MusicGacha._packResultPromise = cardsPromise.then(cards => {
            const result = { cards, packType, isGold: gold, isGod: god };
            window.MusicGacha._lastPackResult = result;
            return result;
        });

        // パック画面をすぐに表示（APIの完了を待たずに）
        await renderPackOpening(cardsPromise, gold, autoTap, god, hintRarity);

        // ホーム画面更新
        window.MusicGacha?.updateHomeScreen?.();

    } catch (error) {
        console.error('[Gacha] Pack opening failed:', error);
        window.MusicGacha?.hideLoading?.();
        window.MusicGacha?.showToast?.(t('toast.apiError'), 'error');
    }
}

/**
 * カードが既にコレクションにあるかチェック
 */
function isCardOwned(cardId) {
    const collection = JSON.parse(localStorage.getItem('musicgacha_collection') || '[]');
    return collection.some(c => c.id === cardId);
}

// グローバル参照に登録
if (typeof window !== 'undefined') {
    window.MusicGacha = window.MusicGacha || {};
    window.MusicGacha.openPack = openPack;
}
