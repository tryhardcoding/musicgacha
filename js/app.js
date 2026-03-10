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
import { initAds, showRewardedAd, updateAdButton, startCooldownTimer, refreshModalBannerAd } from './ads.js';
import { icon, refreshIcons } from './icons.js';

// ---- Screen Routing ----

const screens = ['home', 'pack', 'collection'];
let currentScreen = 'home';
let selectedPackType = 'top200';

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
    if (screenId === 'home') {
        updateHomeScreen();
    }
}

// ---- Home Screen Updates ----

let regenTimerInterval = null;

function updateHomeScreen() {
    const packData = getPackData();

    // パック残数
    const currentEl = document.getElementById('pack-count-current');
    if (currentEl) currentEl.textContent = packData.current;

    // TOP200 収集枚数
    const top200El = document.getElementById('top200-collected');
    if (top200El) {
        const top200Data = getTop200Data();
        top200El.textContent = top200Data.obtainedKeys ? top200Data.obtainedKeys.length : 0;
    }

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
    if (bonusCard) {
        bonusCard.style.display = canClaim ? '' : 'none';
    }
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

    function tick() {
        // パック数を毎tick再計算（recalculatePacksで自動回復される）
        const packData = getPackData();
        const currentEl = document.getElementById('pack-count-current');
        if (currentEl) currentEl.textContent = packData.current;

        const ms = getNextRegenTime();
        if (ms === null) {
            // 満タン - タイマー不要
            timerEl.textContent = '';
            clearInterval(regenTimerInterval);
            regenTimerInterval = null;
            return;
        }
        const sec = Math.ceil(ms / 1000);
        timerEl.textContent = `${sec}s`;
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
                showToast(`パック1個獲得！（残り${result.remaining}回）`, 'success');
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

    // ホームに戻るボタン
    const btnViewCollection = document.getElementById('btn-view-collection');
    if (btnViewCollection) {
        btnViewCollection.addEventListener('click', () => {
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
        btnReset.addEventListener('click', async (e) => {
            e.preventDefault();
            const confirmed = await showConfirmDialog(t('dialog.resetMessage'));
            if (confirmed) {
                resetAllData();
                showToast(t('toast.dataReset'), 'info');
                updateHomeScreen();
                updateCollectionScreen();
            }
        });
    }

    // パックカルーセル - クリックで直接開封 + ドラッグスクロール + 無限ループ
    const carousel = document.getElementById('pack-carousel');
    const track = document.getElementById('pack-carousel-track');
    if (carousel && track) {
        // -- 無限ループ用にクローンを追加 --
        const origItems = Array.from(track.querySelectorAll('.pack-item'));
        // 後ろにクローンセットを追加
        origItems.forEach(item => {
            const clone = item.cloneNode(true);
            clone.classList.add('pack-clone');
            track.appendChild(clone);
        });
        // 前にクローンセットを追加（逆順でinsertBeforeすることで正しい順序を維持）
        [...origItems].reverse().forEach(item => {
            const clone = item.cloneNode(true);
            clone.classList.add('pack-clone');
            track.insertBefore(clone, track.firstChild);
        });

        // 初期スクロール位置を1セット分ずらす（クローン分）
        requestAnimationFrame(() => {
            const firstItem = origItems[0];
            const itemWidth = firstItem.offsetWidth + parseFloat(getComputedStyle(firstItem).marginLeft) + parseFloat(getComputedStyle(firstItem).marginRight);
            track.scrollLeft = itemWidth * origItems.length;
        });

        // -- 無限ループ: スクロール端で位置をリセット --
        let isResetting = false;
        track.addEventListener('scroll', () => {
            if (isResetting) return;
            const firstItem = origItems[0];
            const itemWidth = firstItem.offsetWidth + parseFloat(getComputedStyle(firstItem).marginLeft) + parseFloat(getComputedStyle(firstItem).marginRight);
            const setWidth = itemWidth * origItems.length;
            const maxScroll = track.scrollWidth - track.clientWidth;

            if (track.scrollLeft <= itemWidth * 0.5) {
                isResetting = true;
                track.scrollLeft += setWidth;
                isResetting = false;
            } else if (track.scrollLeft >= maxScroll - itemWidth * 0.5) {
                isResetting = true;
                track.scrollLeft -= setWidth;
                isResetting = false;
            }
        });

        // -- ドラッグスクロール --
        let isDragging = false;
        let dragStartX = 0;
        let dragScrollLeft = 0;
        let hasDragged = false;

        track.addEventListener('mousedown', (e) => {
            isDragging = true;
            hasDragged = false;
            dragStartX = e.pageX - track.offsetLeft;
            dragScrollLeft = track.scrollLeft;
            track.style.scrollBehavior = 'auto';
        });

        track.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const x = e.pageX - track.offsetLeft;
            const walk = (x - dragStartX) * 1.5;
            if (Math.abs(walk) > 5) hasDragged = true;
            track.scrollLeft = dragScrollLeft - walk;
        });

        const endDrag = () => { isDragging = false; };
        track.addEventListener('mouseup', endDrag);
        track.addEventListener('mouseleave', endDrag);

        // -- クリックで直接開封 --
        track.addEventListener('click', async (e) => {
            if (hasDragged) return; // ドラッグ後はクリック無効
            const item = e.target.closest('.pack-item');
            if (!item) return;
            const packType = item.getAttribute('data-pack');
            if (!packType) return;

            // パック残数チェック
            const packData = getPackData();
            if (packData.current <= 0) {
                showToast(t('toast.noPacks'), 'info');
                return;
            }

            // 選択状態を保存
            selectedPackType = packType;
            setSetting('selectedPack', packType);

            // パック画像を切り替え
            updatePackImage(packType);

            // 直接開封
            navigateTo('pack');
            if (window.MusicGacha && window.MusicGacha.openPack) {
                await window.MusicGacha.openPack(packType);
            }
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
        let iconName;
        if (vol === 0 || isMuted) {
            iconName = 'volume-x';
        } else if (vol < 33) {
            iconName = 'volume';
        } else if (vol < 66) {
            iconName = 'volume-1';
        } else {
            iconName = 'volume-2';
        }
        volumeIcon.innerHTML = icon(iconName, { size: 20 });
        refreshIcons();
    }

    if (volumeSlider) {
        const DEFAULT_VOLUME = 10;
        const savedVol = getSetting('volume') != null ? parseInt(getSetting('volume'), 10) : DEFAULT_VOLUME;
        volumeSlider.value = isNaN(savedVol) ? DEFAULT_VOLUME : savedVol;
        // 初回アクセス時は即座にlocalStorageに保存（音が鳴るようにする）
        if (getSetting('volume') == null) {
            setSetting('volume', String(DEFAULT_VOLUME));
        }
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
            if (window.MusicGacha?.setPreviewMuted) {
                window.MusicGacha.setPreviewMuted(false);
            }
            // カード単体再生の音量も連動
            const cardAudio = window.MusicGacha?.getActiveCardAudio?.();
            if (cardAudio) {
                cardAudio.volume = vol / 100;
                cardAudio.muted = false;
            }
        });
    }

    if (volumeBtn) {
        volumeBtn.addEventListener('click', () => {
            isMuted = !isMuted;
            setSetting('muted', isMuted);
            const vol = isMuted ? 0 : parseInt(volumeSlider?.value || '50', 10);
            updateVolumeIcon(vol);
            // iOS対応: audio.mutedを使用（audio.volumeはiOSで無効）
            if (window.MusicGacha?.setPreviewMuted) {
                window.MusicGacha.setPreviewMuted(isMuted);
            }
            if (!isMuted && window.MusicGacha?.setPreviewVolume) {
                window.MusicGacha.setPreviewVolume(vol / 100);
            }
            // カード単体再生のミュートも連動
            const cardAudio = window.MusicGacha?.getActiveCardAudio?.();
            if (cardAudio) {
                cardAudio.muted = isMuted;
                if (!isMuted) cardAudio.volume = vol / 100;
            }
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
    const savedPack = getSetting('selectedPack') || 'top200';
    selectedPackType = savedPack;

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
    window.MusicGacha.refreshModalBannerAd = refreshModalBannerAd;
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

    // Lucideアイコン初期化
    refreshIcons();

    // 初回アクセス時の音声注意トースト
    if (!getSetting('firstVisitDone')) {
        setSetting('firstVisitDone', true);
        setTimeout(() => {
            showToast('🔊 パック開封時に音楽が流れます。音量は右上で調整できます', 'info', 5000);
        }, 1500);
    }

    console.log('[MusicGacha] App initialized');
}

// DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
