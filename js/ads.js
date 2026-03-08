// ============================================================
// MusicGacha - Ads Module
// Google AdSense 統合 & リワード広告管理
// ============================================================

import { isAdSenseConfigured, getAdSenseClientId } from './affiliate.js';
import { addPacks, getPackData } from './storage.js';

// ---- Constants ----
const AD_REWARD_KEY = 'musicgacha_ad_reward';
const COOLDOWN_MS = 5 * 60 * 1000; // 5分
const MAX_DAILY_WATCHES = 5;
const REWARD_PACKS = 1;

// ---- AdSense Initialization ----

let adSenseLoaded = false;

/**
 * AdSenseスクリプトを動的に読み込み
 */
function loadAdSenseScript() {
    if (adSenseLoaded || !isAdSenseConfigured()) return;

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${getAdSenseClientId()}`;
    script.crossOrigin = 'anonymous';
    script.onerror = () => {
        console.warn('[Ads] AdSense script blocked or failed to load');
        showAdPlaceholders();
    };
    script.onload = () => {
        adSenseLoaded = true;
        console.log('[Ads] AdSense script loaded');
        initBannerAds();
    };
    document.head.appendChild(script);
}

/**
 * バナー広告を初期化
 */
function initBannerAds() {
    if (!adSenseLoaded) return;

    try {
        const adContainers = document.querySelectorAll('.ad-container ins.adsbygoogle');
        adContainers.forEach(() => {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        });
    } catch (e) {
        console.warn('[Ads] Banner ad init failed:', e.message);
    }
}

/**
 * 広告ブロッカー検知時にプレースホルダーを表示
 */
function showAdPlaceholders() {
    const containers = document.querySelectorAll('.ad-container');
    containers.forEach(container => {
        if (!container.querySelector('.ad-placeholder')) {
            container.innerHTML = '<div class="ad-placeholder">広告を表示できませんでした</div>';
        }
    });
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
 * AdSense未設定時はダミーフローで動作（開発・テスト用）
 * @returns {Promise<{success: boolean, newPackCount?: number, remaining?: number, error?: string}>}
 */
export async function showRewardedAd() {
    const check = canWatchAd();
    if (!check.canWatch) {
        return { success: false, error: check.reason };
    }

    // AdSense が設定済みかつロード済みの場合 → 実広告を表示
    if (isAdSenseConfigured() && adSenseLoaded) {
        try {
            const result = await showAdSenseRewardedAd();
            if (result.completed) {
                return recordAdWatch();
            }
            return { success: false, error: '広告の視聴が完了しませんでした' };
        } catch (e) {
            console.warn('[Ads] Rewarded ad error, falling back to dummy:', e.message);
            // フォールバック: ダミーフロー
        }
    }

    // ダミーリワードフロー（AdSense未設定時）
    return await showDummyRewardedAd();
}

/**
 * AdSense リワード広告を表示（実装はAdSense設定完了後に本番化）
 * GPT (Google Publisher Tag) 経由でリワード広告を表示
 */
async function showAdSenseRewardedAd() {
    // NOTE: 実際のAdSense/Ad Manager リワード広告は
    // Google Publisher Tag (GPT) の RewardedSlotReadyEvent 等を使用
    // ここでは将来の実装のためのスケルトン
    return new Promise((resolve) => {
        console.log('[Ads] AdSense rewarded ad would play here');
        // 将来的にはGPT APIを使用:
        // googletag.cmd.push(() => { ... })
        resolve({ completed: true });
    });
}

/**
 * ダミーリワード広告（開発用）
 * 3秒のカウントダウンでシミュレート
 */
function showDummyRewardedAd() {
    return new Promise((resolve) => {
        // ダミー広告モーダル表示
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'dummy-ad-overlay';
        overlay.style.zIndex = '99999';
        overlay.innerHTML = `
            <div style="background: var(--bg-secondary, #1a1a2e); border: 1px solid rgba(255,255,255,0.1); 
                        border-radius: 16px; padding: 40px; text-align: center; max-width: 360px; width: 90%;">
                <div style="font-size: 3rem; margin-bottom: 16px;">📺</div>
                <h3 style="color: #fff; font-size: 1.2rem; margin-bottom: 8px;">広告を視聴中...</h3>
                <p style="color: #888; font-size: 0.85rem; margin-bottom: 24px;">
                    視聴完了でパック1個を獲得できます
                </p>
                <div id="dummy-ad-countdown" style="font-size: 2rem; font-weight: bold; 
                     background: linear-gradient(135deg, #8b5cf6, #ec4899);
                     -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                     margin-bottom: 16px;">3</div>
                <div style="height: 4px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden;">
                    <div id="dummy-ad-progress" style="height: 100%; width: 0%; 
                         background: linear-gradient(90deg, #8b5cf6, #ec4899);
                         transition: width 1s linear;"></div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        let countdown = 3;
        const countdownEl = overlay.querySelector('#dummy-ad-countdown');
        const progressEl = overlay.querySelector('#dummy-ad-progress');

        // プログレスバー開始
        requestAnimationFrame(() => {
            progressEl.style.width = '33%';
        });

        const timer = setInterval(() => {
            countdown--;
            if (countdownEl) countdownEl.textContent = countdown;
            if (progressEl) progressEl.style.width = `${((3 - countdown) / 3) * 100}%`;

            if (countdown <= 0) {
                clearInterval(timer);
                setTimeout(() => {
                    overlay.remove();
                    const result = recordAdWatch();
                    resolve(result);
                }, 500);
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

// ---- Initialization ----

/**
 * 広告システムを初期化
 */
export function initAds() {
    // AdSenseスクリプト読み込み
    loadAdSenseScript();

    // 広告ボタンの初期状態設定
    updateAdButton();

    console.log('[Ads] Ad system initialized',
        isAdSenseConfigured() ? '(AdSense configured)' : '(AdSense not configured - using dummy mode)');
}
