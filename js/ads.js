// ============================================================
// MusicGacha - Ads Module
// i-mobile 広告統合 & リワード広告管理
// ============================================================

import { addPacks, getPackData } from './storage.js';

// ---- i-mobile Ad Config ----
const IMOBILE_CONFIG = {
    pid: 40644,
    pc: {
        mid: 591287,
        homeBanner: { asid: 1925457, elementId: 'im-0575e7d34ae149e49683feba2b4c3848', type: 'banner', display: 'inline' },
        collectionBanner: { asid: 1925458, elementId: 'im-c96599839f57449a90a5f7eaf1120592', type: 'banner', display: 'inline' },
        rewardedAd: { asid: 1925459, elementId: 'im-844f2c69ae494feb8ba2d09239047dac', type: 'banner', display: 'inline' },
        packResultBanner: { asid: 1925545, elementId: 'im-ddf2974ecf5d447592acb8a36c6e2d7b', type: 'banner', display: 'inline' },
        modalBanner: { asid: 1925546, elementId: 'im-710639c064e345cbb23f6f91b68f3b24', type: 'banner', display: 'inline' },
    },
    sp: {
        mid: 591288,
        homeBanner: { asid: 1925460, elementId: 'im-ca22b6ac099f483d83e9ace9474cad54', type: 'banner', display: 'inline' },
        collectionBanner: { asid: 1925461, elementId: 'im-b00425ea41db4901b4cc3f78193b4cd5', type: 'banner', display: 'inline' },
        rewardedAd: { asid: 1925462, elementId: 'im-3d1fe6202c794611b5a677b49de61c0f', type: 'banner', display: 'inline' },
        packResultBanner: { asid: 1925547, elementId: 'im-9b7a78541056472c8cf575cf13ee9602', type: 'banner', display: 'inline' },
        modalBanner: { asid: 1925548, elementId: 'im-69b5867f7c264c95af436a84c8a74504', type: 'banner', display: 'inline' },
    },
};

// ---- Constants ----
const AD_REWARD_KEY = 'musicgacha_ad_reward';
const COOLDOWN_MS = 5 * 60 * 1000; // 5分
const MAX_DAILY_WATCHES = 5;
const REWARD_PACKS = 1;
const REWARDED_AD_COUNTDOWN = 5; // 秒



// ---- Device Detection ----

function isMobile() {
    return window.innerWidth <= 767;
}

function getDeviceConfig() {
    return isMobile() ? IMOBILE_CONFIG.sp : IMOBILE_CONFIG.pc;
}

// ---- i-mobile Script Loading ----

let imobileScriptLoaded = false;

/**
 * i-mobileのspot.jsを1回だけ読み込む
 */
function loadIMobileScript() {
    if (imobileScriptLoaded) return Promise.resolve();

    return new Promise((resolve) => {
        // 既にロード済みなら即resolve
        if (document.querySelector('script[src*="imp-adedge.i-mobile.co.jp"]')) {
            imobileScriptLoaded = true;
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://imp-adedge.i-mobile.co.jp/script/v1/spot.js?20220104';
        script.onload = () => {
            imobileScriptLoaded = true;
            console.log('[Ads] i-mobile script loaded');
            resolve();
        };
        script.onerror = () => {
            console.warn('[Ads] i-mobile script blocked or failed to load');
            resolve(); // エラーでも続行
        };
        document.head.appendChild(script);
    });
}

/**
 * spot.jsを再挿入してadsbyimobile配列を再スキャンさせる
 * i-mobileはロード時に1回だけ配列をスキャンするため、
 * 動的に追加した広告を表示するには再挿入が必要
 */
function reloadIMobileScript() {
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://imp-adedge.i-mobile.co.jp/script/v1/spot.js?20220104';
    document.head.appendChild(script);
}

/**
 * i-mobile広告タグをコンテナにセットする
 * @param {HTMLElement} container - 広告を入れるDOM要素
 * @param {Object} adConfig - { asid, elementId, type, display }
 */
function insertIMobileAd(container, adConfig) {
    if (!container) return;

    const config = getDeviceConfig();
    const mid = config === IMOBILE_CONFIG.pc ? IMOBILE_CONFIG.pc : IMOBILE_CONFIG.sp;

    // 既に挿入済みなら何もしない
    if (container.querySelector(`#${adConfig.elementId}`)) return;

    // コンテナをクリア
    container.innerHTML = '';

    // 広告用のdivを作成
    const adDiv = document.createElement('div');
    adDiv.id = adConfig.elementId;
    container.appendChild(adDiv);

    // i-mobileのpushを実行
    window.adsbyimobile = window.adsbyimobile || [];
    window.adsbyimobile.push({
        pid: IMOBILE_CONFIG.pid,
        mid: isMobile() ? IMOBILE_CONFIG.sp.mid : IMOBILE_CONFIG.pc.mid,
        asid: adConfig.asid,
        type: adConfig.type,
        display: adConfig.display,
        elementid: adConfig.elementId,
    });
}

// ---- Banner Ad Initialization ----

/**
 * バナー広告を初期化（ホーム・コレクション・パック結果・モーダル）
 */
function initBannerAds() {
    const config = getDeviceConfig();

    // ホームバナー
    const homeContainer = document.getElementById('ad-home-banner');
    if (homeContainer) {
        insertIMobileAd(homeContainer, config.homeBanner);
    }

    // コレクションバナー
    const collectionContainer = document.getElementById('ad-collection-banner');
    if (collectionContainer) {
        insertIMobileAd(collectionContainer, config.collectionBanner);
    }

    // パック開封結果バナー
    const packResultContainer = document.getElementById('ad-pack-result-banner');
    if (packResultContainer) {
        insertIMobileAd(packResultContainer, config.packResultBanner);
    }

    // モーダルバナー
    const modalContainer = document.getElementById('ad-modal-banner');
    if (modalContainer) {
        insertIMobileAd(modalContainer, config.modalBanner);
    }
}

// ---- Rewarded Ad State Management ----

/**
 * リワード広告データを取得
 * @returns {Object} { watchCount, lastWatchTime, dailyDate }
 */
function getAdRewardData() {
    try {
        const raw = localStorage.getItem(AD_REWARD_KEY);
        if (raw) {
            return JSON.parse(raw);
        }
    } catch (e) {
        console.warn('[Ads] Failed to read ad reward data:', e.message);
    }
    return { watchCount: 0, lastWatchTime: 0, dailyDate: null };
}

/**
 * リワード広告データを保存
 * @param {Object} data
 */
function saveAdRewardData(data) {
    try {
        localStorage.setItem(AD_REWARD_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('[Ads] Failed to save ad reward data:', e.message);
    }
}

/**
 * 広告視聴が可能かチェック
 * @returns {{ canWatch: boolean, reason?: string, nextAvailable?: number }}
 */
export function canWatchAd() {
    const data = getAdRewardData();
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];

    // 日付が変わったらカウントリセット
    if (data.dailyDate !== today) {
        data.watchCount = 0;
        data.dailyDate = today;
        saveAdRewardData(data);
    }

    // 1日の上限チェック
    if (data.watchCount >= MAX_DAILY_WATCHES) {
        return {
            canWatch: false,
            reason: `本日の視聴上限（${MAX_DAILY_WATCHES}回）に達しました`,
        };
    }

    // クールダウンチェック
    const elapsed = now - data.lastWatchTime;
    if (elapsed < COOLDOWN_MS) {
        const remaining = COOLDOWN_MS - elapsed;
        return {
            canWatch: false,
            reason: 'クールダウン中',
            nextAvailable: remaining,
        };
    }

    // パックが上限でないかチェック
    const packData = getPackData();
    if (packData.current >= 10) {
        return {
            canWatch: false,
            reason: 'パックが上限のため獲得できません',
        };
    }

    return { canWatch: true };
}

/**
 * 広告視聴を記録しパックを付与
 * @returns {{ success: boolean, newPackCount: number, remaining: number }}
 */
function recordAdWatch() {
    const data = getAdRewardData();
    const today = new Date().toISOString().split('T')[0];

    if (data.dailyDate !== today) {
        data.watchCount = 0;
        data.dailyDate = today;
    }

    data.watchCount++;
    data.lastWatchTime = Date.now();
    saveAdRewardData(data);

    // パック付与
    addPacks(REWARD_PACKS);
    const packData = getPackData();

    return {
        success: true,
        newPackCount: packData.current,
        remaining: MAX_DAILY_WATCHES - data.watchCount,
    };
}

/**
 * 残り視聴可能回数を取得
 * @returns {number}
 */
export function getRemainingAdWatches() {
    const data = getAdRewardData();
    const today = new Date().toISOString().split('T')[0];

    if (data.dailyDate !== today) {
        return MAX_DAILY_WATCHES;
    }

    return Math.max(0, MAX_DAILY_WATCHES - data.watchCount);
}

// ---- Rewarded Ad Flow ----

/**
 * リワード広告フローを開始
 * i-mobileのレクタングル広告をオーバーレイ内に表示し、
 * カウントダウン後に閉じるボタンを出してパックを付与する
 * @returns {Promise<{success: boolean, newPackCount?: number, remaining?: number, error?: string}>}
 */
export async function showRewardedAd() {
    const check = canWatchAd();
    if (!check.canWatch) {
        return { success: false, error: check.reason };
    }

    return await showIMobileRewardedAd();
}

/**
 * i-mobileリワード広告をオーバーレイ表示
 */
function showIMobileRewardedAd() {
    return new Promise((resolve) => {
        const config = getDeviceConfig();
        const adConfig = config.rewardedAd;

        // 毎回ユニークなIDを生成（spot.jsは同じIDを再処理しないため）
        const uniqueId = `im-rewarded-${Date.now()}`;

        // オーバーレイ作成
        const overlay = document.createElement('div');
        overlay.className = 'rewarded-ad-overlay';
        overlay.id = 'rewarded-ad-overlay';
        overlay.innerHTML = `
            <div class="rewarded-ad-content">
                <div class="rewarded-ad-header">
                    <span class="rewarded-ad-icon"><i data-lucide="monitor-play"></i></span>
                    <h3 class="rewarded-ad-title">広告を表示中...</h3>
                    <p class="rewarded-ad-desc">視聴完了でパック1個を獲得できます</p>
                </div>
                <div class="rewarded-ad-slot" id="rewarded-ad-slot">
                    <div id="${uniqueId}"></div>
                </div>
                <div class="rewarded-ad-countdown-area">
                    <div class="rewarded-ad-countdown" id="rewarded-ad-countdown">${REWARDED_AD_COUNTDOWN}</div>
                    <div class="rewarded-ad-progress-bar">
                        <div class="rewarded-ad-progress-fill" id="rewarded-ad-progress-fill"></div>
                    </div>
                </div>
                <button class="rewarded-ad-close" id="rewarded-ad-close" style="display:none;">
                    ✕ 閉じてパックを受け取る
                </button>
            </div>
        `;
        document.body.appendChild(overlay);

        // i-mobile広告を挿入（ユニークIDを使用）
        window.adsbyimobile = window.adsbyimobile || [];
        window.adsbyimobile.push({
            pid: IMOBILE_CONFIG.pid,
            mid: isMobile() ? IMOBILE_CONFIG.sp.mid : IMOBILE_CONFIG.pc.mid,
            asid: adConfig.asid,
            type: adConfig.type,
            display: adConfig.display,
            elementid: uniqueId,
        });
        // DOMが確実に準備された後にspot.jsを再スキャン
        setTimeout(() => reloadIMobileScript(), 50);
        let countdown = REWARDED_AD_COUNTDOWN;
        const countdownEl = overlay.querySelector('#rewarded-ad-countdown');
        const progressEl = overlay.querySelector('#rewarded-ad-progress-fill');
        const closeBtn = overlay.querySelector('#rewarded-ad-close');

        // 初期プログレス
        requestAnimationFrame(() => {
            if (progressEl) progressEl.style.width = `${(1 / REWARDED_AD_COUNTDOWN) * 100}%`;
        });

        const timer = setInterval(() => {
            countdown--;
            if (countdownEl) countdownEl.textContent = countdown;
            if (progressEl) progressEl.style.width = `${((REWARDED_AD_COUNTDOWN - countdown) / REWARDED_AD_COUNTDOWN) * 100}%`;

            if (countdown <= 0) {
                clearInterval(timer);
                // カウントダウン完了 → 閉じるボタン表示
                if (countdownEl) countdownEl.textContent = '✓';
                if (closeBtn) closeBtn.style.display = '';

                closeBtn.addEventListener('click', () => {
                    overlay.remove();
                    const result = recordAdWatch();
                    resolve(result);
                }, { once: true });
            }
        }, 1000);
    });
}

// ---- Ad Button State Management ----

/**
 * 広告ボタンの表示状態を更新
 */
export function updateAdButton() {
    const btn = document.getElementById('btn-ad-pack');
    if (!btn) return;

    const check = canWatchAd();
    const remaining = getRemainingAdWatches();

    // 残り回数を表示
    const textSpan = btn.querySelector('span:last-child') || btn.querySelector('[data-i18n]');
    if (textSpan) {
        if (check.canWatch) {
            textSpan.textContent = `広告を見てパックを獲得 (残り${remaining}回)`;
        } else if (check.nextAvailable) {
            const secs = Math.ceil(check.nextAvailable / 1000);
            const mins = Math.floor(secs / 60);
            const secsRem = secs % 60;
            textSpan.textContent = `クールダウン中 ${mins}:${String(secsRem).padStart(2, '0')}`;
        } else {
            textSpan.textContent = check.reason || '広告を視聴できません';
        }
    }

    // ボタン状態の切り替え
    btn.classList.remove('ad-ready', 'ad-cooldown');
    if (check.canWatch) {
        btn.classList.add('ad-ready');
        btn.disabled = false;
    } else {
        btn.classList.add('ad-cooldown');
        btn.disabled = true;
    }
}

// ---- Cooldown Timer ----

let cooldownTimerId = null;

/**
 * クールダウンタイマーを開始（ボタンを自動更新）
 */
export function startCooldownTimer() {
    if (cooldownTimerId) clearInterval(cooldownTimerId);

    cooldownTimerId = setInterval(() => {
        updateAdButton();

        // クールダウンが終了したらタイマー停止
        const check = canWatchAd();
        if (check.canWatch || !check.nextAvailable) {
            clearInterval(cooldownTimerId);
            cooldownTimerId = null;
        }
    }, 1000);
}


/**
 * モーダル表示時にバナー広告を再挿入
 */
export function refreshModalBannerAd() {
    const container = document.getElementById('ad-modal-banner');
    if (!container) return;
    container.innerHTML = '';

    const config = getDeviceConfig();
    const adConfig = config.modalBanner;
    const uniqueId = `im-modal-${Date.now()}`;

    const adDiv = document.createElement('div');
    adDiv.id = uniqueId;
    container.appendChild(adDiv);

    window.adsbyimobile = window.adsbyimobile || [];
    window.adsbyimobile.push({
        pid: IMOBILE_CONFIG.pid,
        mid: isMobile() ? IMOBILE_CONFIG.sp.mid : IMOBILE_CONFIG.pc.mid,
        asid: adConfig.asid,
        type: adConfig.type,
        display: adConfig.display,
        elementid: uniqueId,
    });
    setTimeout(() => reloadIMobileScript(), 50);
}

// ---- Initialization ----

/**
 * 広告システムを初期化
 */
export function initAds() {
    // 重要: 先にバナー広告の定義をpushしてからスクリプトを読み込む
    // i-mobileのspot.jsはロード時に1回だけadsbyimobile配列をスキャンするため
    initBannerAds();
    loadIMobileScript();

    // 広告ボタンの初期状態設定
    updateAdButton();

    // 画面リサイズ時にバナーを再初期化（PC↔スマホ切替対応）
    let resizeTimer = null;
    let lastIsMobile = isMobile();
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const currentIsMobile = isMobile();
            if (currentIsMobile !== lastIsMobile) {
                lastIsMobile = currentIsMobile;
                // PC/スマホが切り替わったらバナーを再挿入
                const homeContainer = document.getElementById('ad-home-banner');
                const collectionContainer = document.getElementById('ad-collection-banner');
                const packResultContainer = document.getElementById('ad-pack-result-banner');
                const modalContainer = document.getElementById('ad-modal-banner');
                if (homeContainer) homeContainer.innerHTML = '';
                if (collectionContainer) collectionContainer.innerHTML = '';
                if (packResultContainer) packResultContainer.innerHTML = '';
                if (modalContainer) modalContainer.innerHTML = '';
                // 配列をリセットして新しいデバイス用の設定のみにする
                window.adsbyimobile = [];
                initBannerAds();
                reloadIMobileScript();
            }
        }, 300);
    });

    console.log('[Ads] i-mobile ad system initialized');
}
