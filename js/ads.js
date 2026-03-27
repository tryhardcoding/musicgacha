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
// addPacks(10) を使用: 広告視聴で常に +10 パック付与
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
 * ※ 古いリロードタグは除去して蓄積を防止
 */
function reloadIMobileScript() {
    // 前回の再読込タグを削除（初回ロード分は保持、蓄積防止）
    const oldReloads = document.querySelectorAll('script[data-imobile-reload="true"]');
    oldReloads.forEach(s => s.remove());

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://imp-adedge.i-mobile.co.jp/script/v1/spot.js?20220104';
    script.dataset.imobileReload = 'true';
    document.head.appendChild(script);
}

// スケーリングは init.js に一本化（二重実行によるガタつき防止）

/**
 * 広告未配信時にコンテナが黒ボックスとして表示されるのを防ぐ
 * display: none ではなく visibility + height で制御し、
 * レイアウトシフト（ガタつき）を防止する。
 * 広告が検出されたらチェックを停止する。
 * @param {HTMLElement} container - 広告コンテナ
 */
function hideEmptyAdContainer(container) {
    if (!container) return;

    let resolved = false;
    const checkAndHide = () => {
        if (resolved) return;

        const hasCreative = container.querySelector('[data-imobile-creative-width]');
        const hasVisibleIframe = container.querySelector('iframe[src]:not([src=""])');

        if (hasCreative || hasVisibleIframe) {
            // 広告あり → 表示を確保して監視終了
            container.style.visibility = '';
            container.style.overflow = '';
            resolved = true;
            return;
        }

        // 広告なし → レイアウトシフトを起こさず非表示化
        container.style.minHeight = '0';
        container.style.visibility = 'hidden';
        container.style.overflow = 'hidden';
    };

    // i-mobileの広告レンダリングは非同期なので複数回チェック
    setTimeout(checkAndHide, 3000);
    setTimeout(checkAndHide, 6000);
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

    // 広告未配信時の空コンテナ（黒ボックス）を隠す
    hideEmptyAdContainer(container);
    // スケーリングは init.js 側で一元管理
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
 * 広告視聴が可能かチェック（制限なし）
 * @returns {{ canWatch: boolean }}
 */
export function canWatchAd() {
    return { canWatch: true };
}

/**
 * 広告視聴を記録しパックを付与
 * @returns {{ success: boolean, newPackCount: number }}
 */
function recordAdWatch() {
    const packData = addPacks(10);

    return {
        success: true,
        newPackCount: packData.current,
        added: 10,
    };
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
                    <h3 class="rewarded-ad-title">${window.MusicGacha?.t?.('ads.showing') || 'Showing ad...'}</h3>
                    <p class="rewarded-ad-desc">${window.MusicGacha?.t?.('ads.watchToRecover') || 'Watch to recover packs'}</p>
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
                    ✕ ${window.MusicGacha?.t?.('ads.closeAndRecover') || 'Close and recover packs'}
                </button>
            </div>
        `;
        document.body.appendChild(overlay);

        // 動的に追加したLucideアイコンをレンダリング
        if (window.lucide && window.lucide.createIcons) {
            window.lucide.createIcons({ nodes: [overlay] });
        }

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

        const countdownEl = overlay.querySelector('#rewarded-ad-countdown');
        const progressEl = overlay.querySelector('#rewarded-ad-progress-fill');
        const closeBtn = overlay.querySelector('#rewarded-ad-close');

        // プログレスバーはCSS animationで駆動（JSのsetIntervalに依存しない）
        // カウントダウン開始を遅延し、spot.jsのメインスレッドブロックを回避
        setTimeout(() => {
            // CSSアニメーションでプログレスバーを5秒かけて0%→100%に
            if (progressEl) {
                progressEl.style.transition = 'none';
                progressEl.style.width = '0%';
                // 次フレームでtransitionを有効化してアニメーション開始
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        progressEl.style.transition = `width ${REWARDED_AD_COUNTDOWN}s linear`;
                        progressEl.style.width = '100%';
                    });
                });
            }

            // タイムスタンプベースのカウントダウン（setInterval非依存）
            const startTime = Date.now();
            const tick = () => {
                const elapsed = (Date.now() - startTime) / 1000;
                const remaining = Math.ceil(REWARDED_AD_COUNTDOWN - elapsed);

                if (remaining <= 0) {
                    // カウントダウン完了
                    if (countdownEl) countdownEl.textContent = '✓';
                    if (closeBtn) closeBtn.style.display = '';
                    closeBtn.addEventListener('click', () => {
                        overlay.remove();
                        const result = recordAdWatch();
                        resolve(result);
                    }, { once: true });
                } else {
                    if (countdownEl) countdownEl.textContent = remaining;
                    requestAnimationFrame(tick);
                }
            };
            requestAnimationFrame(tick);
        }, 1500); // spot.jsの読込・DOM処理が完了するまで待機
    });
}

// ---- Ad Button State Management ----

/**
 * 広告ボタンの表示状態を更新
 */
export function updateAdButton() {
    const btn = document.getElementById('btn-ad-pack');
    if (!btn) return;

    const textSpan = btn.querySelector('span:last-child') || btn.querySelector('[data-i18n]');
    if (textSpan) {
        textSpan.textContent = window.MusicGacha?.t?.('home.watchAd') || 'Watch ad for a pack';
    }

    btn.classList.remove('ad-cooldown');
    btn.classList.add('ad-ready');
    btn.disabled = false;
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

    // スケーリングは init.js 側で一元管理
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
