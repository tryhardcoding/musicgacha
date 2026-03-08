// ============================================================
// MusicGacha - App Module
// アプリ初期化・画面ルーティング・UIイベント管理
// ============================================================

import { initStorage, getPackData, getNextRegenTime, canClaimDailyBonus, claimDailyBonus, resetAllData, getSetting, setSetting, getUniqueCardCount, getTotalCardCount, addPacks, getTop200Data, getTop200Remaining } from './storage.js';
import { initI18n, setLanguage, t, applyTranslations } from './i18n.js';
import { getTop200Tracks } from './api.js';
import './gacha.js'; // ガチャモジュール（グローバル参照にopenPackを登録）
import { initCollection, renderCollection } from './collection.js';
import { initShareHandler } from './transfer.js';
import { initAds, showRewardedAd, updateAdButton, startCooldownTimer } from './ads.js';

// ---- Screen Routing ----

const screens = ['home', 'pack', 'collection', 'settings'];
let currentScreen = 'home';
let selectedPackType = 'standard';

function showScreen(screenId) {
    if (!screens.includes(screenId)) screenId = 'home';

    // パック画面から離れたら試聴音声を停止＆開封セッションをキャンセル
    if (screenId !== 'pack') {
        if (window.MusicGacha?.stopPreview) {
            window.MusicGacha.stopPreview();
        }
        if (window.MusicGacha?.cancelPackSession) {
            window.MusicGacha.cancelPackSession();
        }
    }

    screens.forEach(id => {
        const el = document.getElementById(`screen-${id}`);
        if (el) {
            el.classList.toggle('active', id === screenId);
        }
    });

    // ナビゲーション更新
    document.querySelectorAll('.nav-item').forEach(item => {
        const target = item.getAttribute('data-screen');
        item.classList.toggle('active', target === screenId);
    });

    currentScreen = screenId;

    // 画面固有の初期化
    if (screenId === 'home') {
        updateHomeScreen();
    } else if (screenId === 'collection') {
        updateCollectionScreen();
        initCollection(); // Added based on instruction text
        renderCollection(); // Added based on provided code edit
    }
}

export function navigateTo(screenId) {
    showScreen(screenId);
    if (screenId !== 'pack') {
        window.location.hash = screenId;
    }
}

// ---- Home Screen Updates ----

let regenTimerInterval = null;

function updateHomeScreen() {
    const packData = getPackData();

    // パック残数
    const currentEl = document.getElementById('pack-count-current');
    if (currentEl) currentEl.textContent = packData.current;

    // 開封ボタン
    const btnOpen = document.getElementById('btn-open-pack');
    if (btnOpen) {
        btnOpen.disabled = packData.current <= 0;
        const textEl = btnOpen.querySelector('.btn-open-pack-text');
        if (textEl) {
            textEl.textContent = packData.current > 0 ? t('home.openPack') : t('home.noPacks');
        }
    }

    // ゴールドパック進捗
    const progress = packData.totalOpened % 10;
    const goldFill = document.getElementById('gold-pack-fill');
    const goldLabel = document.getElementById('gold-pack-label');
    if (goldFill) goldFill.style.width = `${(progress / 10) * 100}%`;
    if (goldLabel) goldLabel.textContent = t('home.goldPackProgress', { current: progress });

    // デイリーボーナス
    const bonusCard = document.getElementById('daily-bonus-card');
    const btnBonus = document.getElementById('btn-daily-bonus');
    const canClaim = canClaimDailyBonus();
    if (bonusCard) bonusCard.classList.toggle('claimed', !canClaim);
    if (btnBonus) {
        btnBonus.disabled = !canClaim;
        btnBonus.textContent = canClaim ? t('home.claim') : t('home.dailyBonusClaimed');
    }

    // 収集進捗
    const uniqueCount = getUniqueCardCount();
    const totalCount = getTotalCardCount();
    const progressText = document.getElementById('progress-ring-text');
    const progressTotal = document.getElementById('progress-total');
    if (progressText) progressText.textContent = uniqueCount;
    if (progressTotal) progressTotal.textContent = `${totalCount} / ∞`;

    // リジェンタイマー
    updateRegenTimer();

    // Top 200 進捗表示
    updateTop200Progress();
}

function updateRegenTimer() {
    if (regenTimerInterval) {
        clearInterval(regenTimerInterval);
        regenTimerInterval = null;
    }

    const timerEl = document.getElementById('pack-regen-timer');
    if (!timerEl) return;

    const remaining = getNextRegenTime();

    if (remaining === null || remaining <= 0) {
        timerEl.textContent = '';
        return;
    }

    function tick() {
        const ms = getNextRegenTime();
        if (ms === null || ms <= 0) {
            timerEl.textContent = '';
            clearInterval(regenTimerInterval);
            regenTimerInterval = null;
            // パック更新
            updateHomeScreen();
            return;
        }
        const sec = Math.ceil(ms / 1000);
        timerEl.textContent = t('home.regenIn', { time: `${sec}s` });
    }

    tick();
    regenTimerInterval = setInterval(tick, 1000);
}

async function updateTop200Progress() {
    const progressEl = document.getElementById('top200-progress');
    if (!progressEl) return;

    // Top 200パック選択時のみ表示
    if (selectedPackType !== 'top200') {
        progressEl.style.display = 'none';
        return;
    }

    progressEl.style.display = '';

    // 今日のチャートの200曲を取得
    const chartTracks = await getTop200Tracks();
    const total = chartTracks.length || 200;

    // 今日のチャートの曲キーとobtainedKeysの一致数をカウント
    const top200Data = getTop200Data();
    const obtainedSet = new Set(top200Data.obtainedKeys);
    let obtained = 0;
    for (const track of chartTracks) {
        const key = `${track.artist.toLowerCase()}::${track.name.toLowerCase()}`;
        if (obtainedSet.has(key)) obtained++;
    }

    const remaining = total - obtained;
    const percentage = (obtained / total) * 100;

    const countEl = document.getElementById('top200-progress-count');
    const fillEl = document.getElementById('top200-progress-fill');

    if (countEl) {
        if (remaining === 0) {
            countEl.textContent = t('home.top200Complete');
        } else {
            countEl.textContent = t('home.top200Progress', { remaining });
        }
    }
    if (fillEl) {
        fillEl.style.width = `${percentage}%`;
    }
}

function updatePackImage(packType) {
    const packImage = document.querySelector('#pack-visual .pack-image');
    if (packImage) {
        packImage.src = `assets/pack-${packType}.png`;
    }
}

function updateCollectionScreen() {
    // フェーズ3で実装
    const uniqueCount = getUniqueCardCount();
    const totalCount = getTotalCardCount();

    const statTotal = document.getElementById('stat-total');
    const statUnique = document.getElementById('stat-unique');
    if (statTotal) statTotal.textContent = `${totalCount}${t('collection.songs')}`;
    if (statUnique) statUnique.textContent = `${uniqueCount}${t('collection.types')}`;
}

// ---- Toast System ----

export function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-out');
        toast.addEventListener('animationend', () => toast.remove());
    }, duration);
}

// ---- Dialog System ----

export function showConfirmDialog(message) {
    return new Promise((resolve) => {
        const dialog = document.getElementById('confirm-dialog');
        const msgEl = document.getElementById('dialog-message');
        const btnCancel = document.getElementById('dialog-cancel');
        const btnConfirm = document.getElementById('dialog-confirm');

        if (!dialog || !msgEl) return resolve(false);

        msgEl.textContent = message;
        dialog.style.display = '';

        function cleanup() {
            dialog.style.display = 'none';
            btnCancel.removeEventListener('click', onCancel);
            btnConfirm.removeEventListener('click', onConfirm);
        }

        function onCancel() { cleanup(); resolve(false); }
        function onConfirm() { cleanup(); resolve(true); }

        btnCancel.addEventListener('click', onCancel);
        btnConfirm.addEventListener('click', onConfirm);
    });
}

// ---- Loading ----

export function showLoading() {
    const el = document.getElementById('loading-overlay');
    if (el) el.style.display = '';
}

export function hideLoading() {
    const el = document.getElementById('loading-overlay');
    if (el) el.style.display = 'none';
}

// ---- Event Handlers ----

function setupEventListeners() {
    // ナビゲーション
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const screen = item.getAttribute('data-screen');
            navigateTo(screen);
        });
    });

    // パック開封ボタン
    const btnOpen = document.getElementById('btn-open-pack');
    if (btnOpen) {
        btnOpen.addEventListener('click', async () => {
            navigateTo('pack');
            if (window.MusicGacha && window.MusicGacha.openPack) {
                await window.MusicGacha.openPack(selectedPackType);
            }
        });
    }

    // デイリーボーナス
    const btnBonus = document.getElementById('btn-daily-bonus');
    if (btnBonus) {
        btnBonus.addEventListener('click', () => {
            const result = claimDailyBonus();
            if (result) {
                showToast(t('toast.dailyBonus'), 'success');
                updateHomeScreen();
            }
        });
    }

    // 広告パックボタン（リワード広告）
    const btnAd = document.getElementById('btn-ad-pack');
    if (btnAd) {
        btnAd.addEventListener('click', async () => {
            const result = await showRewardedAd();
            if (result.success) {
                showToast(`🎁 パック1個獲得！（残り${result.remaining}回）`, 'success');
                updateHomeScreen();
                updateAdButton();
                startCooldownTimer();
            } else if (result.error) {
                showToast(result.error, 'info');
            }
        });
    }

    // もう1パック開けるボタン
    const btnOpenAnother = document.getElementById('btn-open-another');
    if (btnOpenAnother) {
        btnOpenAnother.addEventListener('click', async () => {
            navigateTo('pack');
            if (window.MusicGacha && window.MusicGacha.openPack) {
                await window.MusicGacha.openPack(selectedPackType);
            }
        });
    }

    // コレクションを見るボタン
    const btnViewCollection = document.getElementById('btn-view-collection');
    if (btnViewCollection) {
        btnViewCollection.addEventListener('click', () => {
            navigateTo('collection');
        });
    }

    // ホームに戻るボタン
    const btnBackHome = document.getElementById('btn-back-home');
    if (btnBackHome) {
        btnBackHome.addEventListener('click', () => {
            navigateTo('home');
        });
    }

    // 設定: 言語切り替え
    const langSelect = document.getElementById('setting-language');
    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            const lang = e.target.value;
            setSetting('language', lang);
            setLanguage(lang);
            updateHomeScreen();
        });
    }


    // 設定: データリセット
    const btnReset = document.getElementById('btn-reset-data');
    if (btnReset) {
        btnReset.addEventListener('click', async () => {
            const confirmed = await showConfirmDialog(t('dialog.resetMessage'));
            if (confirmed) {
                resetAllData();
                showToast(t('toast.dataReset'), 'info');
                updateHomeScreen();
                updateCollectionScreen();
            }
        });
    }

    // パック選択カルーセル
    const packSelector = document.getElementById('pack-selector-scroll');
    if (packSelector) {
        packSelector.addEventListener('click', (e) => {
            const card = e.target.closest('.pack-card');
            if (!card) return;
            const packType = card.getAttribute('data-pack');
            if (!packType) return;

            // 選択状態を更新 & 保存
            selectedPackType = packType;
            setSetting('selectedPack', packType);
            packSelector.querySelectorAll('.pack-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');

            // パック画像を切り替え
            updatePackImage(packType);

            // Top 200 進捗表示の更新
            updateTop200Progress();
        });
    }

    // 設定: 自動パック開封トグル
    const autoOpenToggle = document.getElementById('setting-auto-open');
    if (autoOpenToggle) {
        autoOpenToggle.addEventListener('change', (e) => {
            setSetting('autoOpen', e.target.checked);
        });
    }

    // 音量コントロール
    const volumeSlider = document.getElementById('volume-slider');
    const volumeBtn = document.getElementById('volume-btn');
    const volumeIcon = document.getElementById('volume-icon');
    let isMuted = getSetting('muted') === true;

    function updateVolumeIcon(vol) {
        if (!volumeIcon) return;
        if (vol === 0 || isMuted) {
            volumeIcon.textContent = '🔇';
        } else if (vol < 33) {
            volumeIcon.textContent = '🔈';
        } else if (vol < 66) {
            volumeIcon.textContent = '🔉';
        } else {
            volumeIcon.textContent = '🔊';
        }
    }

    if (volumeSlider) {
        const savedVol = parseInt(getSetting('volume') ?? '50', 10);
        volumeSlider.value = savedVol;
        updateVolumeIcon(isMuted ? 0 : savedVol);

        volumeSlider.addEventListener('input', (e) => {
            const vol = parseInt(e.target.value, 10);
            isMuted = false;
            setSetting('muted', false);
            setSetting('volume', String(vol));
            updateVolumeIcon(vol);
            if (window.MusicGacha?.setPreviewVolume) {
                window.MusicGacha.setPreviewVolume(vol / 100);
            }
            // カード単体再生の音量も連動
            const cardAudio = window.MusicGacha?.getActiveCardAudio?.();
            if (cardAudio) cardAudio.volume = vol / 100;
        });
    }

    if (volumeBtn) {
        volumeBtn.addEventListener('click', () => {
            isMuted = !isMuted;
            setSetting('muted', isMuted);
            const vol = isMuted ? 0 : parseInt(volumeSlider?.value || '50', 10);
            updateVolumeIcon(vol);
            if (window.MusicGacha?.setPreviewVolume) {
                window.MusicGacha.setPreviewVolume(vol / 100);
            }
            // カード単体再生のミュートも連動
            const cardAudio = window.MusicGacha?.getActiveCardAudio?.();
            if (cardAudio) cardAudio.volume = vol / 100;
        });
    }

    // モーダルを閉じる
    const modalClose = document.getElementById('modal-close');
    if (modalClose) {
        modalClose.addEventListener('click', () => {
            const modal = document.getElementById('card-detail-modal');
            if (modal) modal.style.display = 'none';
        });
    }

    // モーダル背景クリックで閉じる
    const modalOverlay = document.getElementById('card-detail-modal');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.style.display = 'none';
            }
        });
    }

    // ハッシュルーティング
    window.addEventListener('hashchange', () => {
        const screen = window.location.hash.replace('#', '') || 'home';
        showScreen(screen);
    });
}

// ---- Initialization ----

function init() {
    // ストレージ初期化
    initStorage();

    // 設定読み込み
    const settings = {
        language: getSetting('language') || 'ja',
    };

    // i18n初期化
    initI18n(settings.language);

    // 設定画面の初期値セット
    const langSelect = document.getElementById('setting-language');
    if (langSelect) langSelect.value = settings.language;

    // パック選択の復元
    const savedPack = getSetting('selectedPack') || 'standard';
    selectedPackType = savedPack;
    const packCards = document.querySelectorAll('#pack-selector-scroll .pack-card');
    packCards.forEach(card => {
        card.classList.toggle('active', card.getAttribute('data-pack') === savedPack);
    });

    // パック画像の初期設定
    updatePackImage(savedPack);

    // 自動開封トグルの復元
    const autoOpenToggle = document.getElementById('setting-auto-open');
    if (autoOpenToggle) {
        autoOpenToggle.checked = getSetting('autoOpen') === true;
    }



    // イベントハンドラ設定
    setupEventListeners();

    // 初期画面表示
    const hash = window.location.hash.replace('#', '') || 'home';
    showScreen(hash);

    // グローバル参照（他モジュールから呼び出し用）
    window.MusicGacha = window.MusicGacha || {};
    window.MusicGacha.navigateTo = navigateTo;
    window.MusicGacha.showToast = showToast;
    window.MusicGacha.showLoading = showLoading;
    window.MusicGacha.hideLoading = hideLoading;
    window.MusicGacha.showConfirmDialog = showConfirmDialog;
    window.MusicGacha.updateHomeScreen = updateHomeScreen;
    window.MusicGacha.isAutoOpenEnabled = () => getSetting('autoOpen') === true;
    window.MusicGacha.triggerAutoOpen = async () => {
        navigateTo('pack');
        if (window.MusicGacha?.openPack) {
            await window.MusicGacha.openPack(selectedPackType, true);
        }
    };

    // 共有リンクの検知
    initShareHandler();

    // 広告システム初期化
    initAds();

    console.log('[MusicGacha] App initialized');
}

// DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
