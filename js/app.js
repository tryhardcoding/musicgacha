// ============================================================
// MusicGacha - App Module
// アプリ初期化・画面ルーティング・UIイベント管理
// ============================================================

import { initStorage, getPackData, getNextRegenTime, canClaimDailyBonus, claimDailyBonus, resetAllData, getSetting, setSetting, getUniqueCardCount, getTotalCardCount, addPacks, getTop200Data, getTop200Remaining, getCollection } from './storage.js';
import { initI18n, setLanguage, t, applyTranslations } from './i18n.js';
import { getTop200Tracks } from './api.js';
import { getRegion, setRegion, REGIONS, getRegionConfig } from './region.js';
import { getPacksConfig } from './data-loader.js';
import './gacha.js?v=20260320b'; // ガチャモジュール（グローバル参照にopenPackを登録）
import { initCollection, renderCollection, refreshCollection } from './collection.js';
import { initShareHandler } from './transfer.js';
import { initAds, showRewardedAd, updateAdButton, refreshModalBannerAd } from './ads.js?v=20260320';
import { icon, refreshIcons } from './icons.js';
import { sharePackResult, shareCollectionStats } from './share-sns.js?v=20260320b';
import { invalidateCache } from './data-loader.js';
import { checkAchievements, getAchievementStats, renderAchievementModal, trackDailyBonus } from './achievements.js';
import { getAmazonMusicUnlimitedUrl } from './affiliate.js';

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
        initCollection();
        refreshCollection(); // TOP200ビューも含めて再描画
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

    // TOP200 チャレンジカード更新
    updateTop200ChallengeCard();

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

    // Amazon Music PR - ユーザーの収集実績と連動 + リージョン対応URL
    const amazonUnlimitedUrl = getAmazonMusicUnlimitedUrl();
    const amazonTitle = document.getElementById('amazon-music-title');
    if (amazonTitle) {
        amazonTitle.textContent = uniqueCount > 0
            ? t('home.amazonTitleWithCount', { count: uniqueCount })
            : t('home.amazonTitle');
    }
    // PRバナーのhrefをロケールに応じて動的設定
    const amazonPrHome = document.getElementById('amazon-music-pr');
    if (amazonPrHome) amazonPrHome.href = amazonUnlimitedUrl;
    const amazonPrPack = document.getElementById('amazon-music-pr-pack');
    if (amazonPrPack) amazonPrPack.href = amazonUnlimitedUrl;

    // パック結果画面のAmazon Music PRタイトルも更新
    const amazonTitlePack = document.getElementById('amazon-music-title-pack');
    if (amazonTitlePack) {
        amazonTitlePack.textContent = uniqueCount > 0
            ? t('pack.amazonTitleWithCount', { count: uniqueCount })
            : t('pack.amazonTitle');
    }

    // 実績ボタンのカウント更新
    updateAchievementButton();
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

async function updateTop200ChallengeCard() {
    const card = document.getElementById('top200-challenge-card');
    if (!card) return;

    // 現在のチャートトラックと照合して正確なobtained数をカウント
    // コレクション画面(collection.js)と同じロジック: obtainedKeys AND コレクション内にカードが存在
    const chartTracks = await getTop200Tracks();
    const top200Data = getTop200Data();
    const obtainedSet = new Set(top200Data.obtainedKeys);
    const total = chartTracks.length || 200;

    // コレクション内のカードをキーでルックアップ
    const collection = getCollection();
    const collectionKeySet = new Set();
    for (const c of collection) {
        const artist = (c.originalArtist || c.artist || '').toLowerCase();
        const title = (c.originalName || c.title || '').toLowerCase();
        collectionKeySet.add(`${artist}::${title}`);
    }

    let obtained = 0;
    for (const track of chartTracks) {
        const key = `${track.artist.toLowerCase()}::${track.name.toLowerCase()}`;
        if (obtainedSet.has(key) && collectionKeySet.has(key)) obtained++;
    }
    const percentage = Math.min((obtained / total) * 100, 100);
    const remaining = total - obtained;

    // マイルストーンデータ
    const milestones = [
        { threshold: 0, title: t('milestone.debut'), iconName: 'music' },
        { threshold: 50, title: t('milestone.silver'), iconName: 'disc-3' },
        { threshold: 100, title: t('milestone.gold'), iconName: 'disc-3' },
        { threshold: 150, title: t('milestone.platinum'), iconName: 'disc-3' },
        { threshold: 200, title: t('milestone.diamond'), iconName: 'diamond' }
    ];

    let currentMilestone = milestones[0];
    let nextMilestone = milestones[1];
    for (let i = milestones.length - 1; i >= 0; i--) {
        if (obtained >= milestones[i].threshold) {
            currentMilestone = milestones[i];
            nextMilestone = milestones[i + 1] || null;
            break;
        }
    }

    let milestoneHtml = `<span class="milestone-badge milestone-badge-current"><i data-lucide="${currentMilestone.iconName}"></i> ${currentMilestone.title}</span>`;
    if (nextMilestone) {
        milestoneHtml += `<span class="milestone-badge milestone-badge-next">${t('milestone.nextLabel')}: <i data-lucide="${nextMilestone.iconName}"></i> ${nextMilestone.title} (${nextMilestone.threshold}${t('milestone.songs')})</span>`;
    }

    let ctaText;
    if (remaining === 0) {
        ctaText = t('top200.complete');
    } else if (remaining <= 10) {
        ctaText = t('top200.remaining', { remaining });
    } else if (remaining <= 50) {
        ctaText = t('top200.almostThere', { remaining });
    } else {
        ctaText = t('top200.remaining', { remaining });
    }

    // ホーム版 + パック結果版 の両方を更新
    const suffixes = ['', '-pack'];
    for (const suffix of suffixes) {
        const ringFill = document.getElementById(`top200-ring-fill${suffix}`);
        const ringNumber = document.getElementById(`top200-ring-number${suffix}`);
        if (ringFill) {
            const circumference = 2 * Math.PI * 52;
            const offset = circumference - (percentage / 100) * circumference;
            ringFill.style.strokeDashoffset = offset;
        }
        if (ringNumber) ringNumber.textContent = obtained;

        const barFill = document.getElementById(`top200-challenge-bar-fill${suffix}`);
        const percentEl = document.getElementById(`top200-challenge-percent${suffix}`);
        if (barFill) barFill.style.width = `${percentage}%`;
        if (percentEl) percentEl.textContent = `${Math.round(percentage)}%`;

        const milestoneEl = document.getElementById(`top200-challenge-milestone${suffix}`);
        if (milestoneEl) milestoneEl.innerHTML = milestoneHtml;

        const ctaEl = document.getElementById(`top200-challenge-cta${suffix}`);
        if (ctaEl) ctaEl.textContent = ctaText;
    }

    refreshIcons();
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
    // コレクション画面と同じロジック: obtainedKeys AND コレクション内にカードが存在
    const top200Data = getTop200Data();
    const obtainedSet = new Set(top200Data.obtainedKeys);
    const collection = getCollection();
    const collectionKeySet = new Set();
    for (const c of collection) {
        const artist = (c.originalArtist || c.artist || '').toLowerCase();
        const title = (c.originalName || c.title || '').toLowerCase();
        collectionKeySet.add(`${artist}::${title}`);
    }
    let obtained = 0;
    for (const track of chartTracks) {
        const key = `${track.artist.toLowerCase()}::${track.name.toLowerCase()}`;
        if (obtainedSet.has(key) && collectionKeySet.has(key)) obtained++;
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
        packImage.src = `assets/pack-${packType}.webp`;
    }
}

function updateAchievementButton() {
    const stats = getAchievementStats();
    const countEl = document.getElementById('achievement-btn-count');
    if (countEl) {
        countEl.textContent = `${stats.unlocked}/${stats.total}`;
    }
    const headerCountEl = document.getElementById('achievement-header-count');
    if (headerCountEl) {
        headerCountEl.textContent = `${stats.unlocked}`;
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

    // TOP200チャレンジカード クリック（ホーム + パック結果）
    const challengeCards = document.querySelectorAll('#top200-challenge-card, #top200-challenge-card-pack');
    challengeCards.forEach(card => {
        card.addEventListener('click', () => {
            navigateTo('collection');
            setTimeout(() => {
                const top200Tab = document.querySelector('[data-pack-filter="top200"]');
                if (top200Tab) top200Tab.click();
            }, 100);
        });
    });

    // デイリーボーナス
    const btnBonus = document.getElementById('btn-daily-bonus');
    if (btnBonus) {
        btnBonus.addEventListener('click', () => {
            const result = claimDailyBonus();
            if (result) {
                trackDailyBonus();
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
                showToast(t('toast.packReward'), 'success');
                updateHomeScreen();
                updateAdButton();
            } else if (result.error) {
                showToast(result.error, 'info');
            }
        });
    }

    // パック結果をXでシェアボタン
    const btnSharePack = document.getElementById('btn-share-pack-result');
    if (btnSharePack) {
        btnSharePack.addEventListener('click', () => {
            const result = window.MusicGacha?._lastPackResult;
            if (result && result.cards) {
                sharePackResult(result.cards, result.packType, result.isGold, result.isGod);
            } else {
                showToast(t('toast.noShareData'), 'info');
            }
        });
    }

    // コレクションをXでシェアボタン
    const btnShareCollection = document.getElementById('btn-share-collection');
    if (btnShareCollection) {
        btnShareCollection.addEventListener('click', () => {
            const collection = JSON.parse(localStorage.getItem('musicgacha_collection') || '[]');
            const rarityCounts = {};
            const seen = new Set();
            for (const card of collection) {
                if (!seen.has(card.id)) {
                    seen.add(card.id);
                    rarityCounts[card.rarity] = (rarityCounts[card.rarity] || 0) + 1;
                }
            }
            shareCollectionStats({
                uniqueCount: seen.size,
                totalCount: collection.length,
                rarityCounts,
            });
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

    // リージョン切替ボタン（ドロップダウン選択式）
    const countryBtn = document.getElementById('country-btn');
    if (countryBtn) {
        countryBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleRegionDropdown();
        });
    }


    // 設定: データリセット（4段階確認）
    const btnReset = document.getElementById('btn-reset-data');
    if (btnReset) {
        btnReset.addEventListener('click', async (e) => {
            e.preventDefault();

            // 第1段階: 基本確認
            const step1 = await showConfirmDialog(t('dialog.resetMessage'));
            if (!step1) return;

            // 第2段階: 復元不可の警告
            const step2 = await showConfirmDialog(t('dialog.resetStep2'));
            if (!step2) return;

            // 第3段階: コレクション数の提示
            const uniqueCount = getUniqueCardCount();
            const totalCount = getTotalCardCount();
            const step3 = await showConfirmDialog(
                t('dialog.resetStep3', { unique: uniqueCount, total: totalCount })
            );
            if (!step3) return;

            // 第4段階: 最終確認
            const step4 = await showConfirmDialog(t('dialog.resetFinal'));
            if (!step4) return;

            resetAllData();
            showToast(t('toast.dataReset'), 'info');
            updateHomeScreen();
            updateCollectionScreen();
        });
    }

    // パックカルーセル - クリックで直接開封 + ドラッグスクロール
    const carousel = document.getElementById('pack-carousel');
    const track = document.getElementById('pack-carousel-track');
    if (carousel && track) {
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

    const modalClose = document.getElementById('modal-close');
    if (modalClose) {
        modalClose.addEventListener('click', () => {
            const modal = document.getElementById('card-detail-modal');
            if (modal) modal.style.display = 'none';
            // 再生中の音声を停止
            if (window.MusicGacha?.stopCardPreview) {
                window.MusicGacha.stopCardPreview();
            }
        });
    }

    // モーダル背景クリックで閉じる
    const modalOverlay = document.getElementById('card-detail-modal');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.style.display = 'none';
                // 再生中の音声を停止
                if (window.MusicGacha?.stopCardPreview) {
                    window.MusicGacha.stopCardPreview();
                }
            }
        });
    }

    // ハッシュルーティング
    window.addEventListener('hashchange', () => {
        const screen = window.location.hash.replace('#', '') || 'home';
        showScreen(screen);
    });

    // 実績ボタン（ホーム + ヘッダー）
    const openAchievementModal = () => {
        const modal = document.getElementById('achievement-modal');
        if (modal) {
            modal.style.display = '';
            renderAchievementModal();
        }
    };

    const btnAchievements = document.getElementById('btn-achievements');
    if (btnAchievements) {
        btnAchievements.addEventListener('click', openAchievementModal);
    }

    const btnAchievementsHeader = document.getElementById('btn-achievements-header');
    if (btnAchievementsHeader) {
        btnAchievementsHeader.addEventListener('click', openAchievementModal);
    }

    // 実績モーダル閉じる
    const achClose = document.getElementById('achievement-modal-close');
    if (achClose) {
        achClose.addEventListener('click', () => {
            const modal = document.getElementById('achievement-modal');
            if (modal) modal.style.display = 'none';
        });
    }

    // 実績モーダル背景クリックで閉じる
    const achModal = document.getElementById('achievement-modal');
    if (achModal) {
        achModal.addEventListener('click', (e) => {
            if (e.target === achModal) achModal.style.display = 'none';
        });
    }
}

// ---- Region Management ----

function updateRegionDisplay() {
    const region = getRegion();
    const countryBtn = document.getElementById('country-btn');
    if (countryBtn) {
        const codeEl = countryBtn.querySelector('.country-code');
        if (codeEl) codeEl.textContent = region.toUpperCase();
    }
}

/** リージョン選択ドロップダウンを表示/非表示 */
function toggleRegionDropdown() {
    let dropdown = document.getElementById('region-dropdown');
    if (dropdown) {
        dropdown.remove();
        return;
    }
    dropdown = document.createElement('div');
    dropdown.id = 'region-dropdown';
    dropdown.className = 'region-dropdown';

    const currentRegion = getRegion();
    for (const [key, config] of Object.entries(REGIONS)) {
        const item = document.createElement('button');
        item.className = 'region-dropdown-item' + (key === currentRegion ? ' active' : '');
        item.textContent = config.label;
        item.addEventListener('click', () => {
            dropdown.remove();
            switchRegion(key);
        });
        dropdown.appendChild(item);
    }

    const countryBtn = document.getElementById('country-btn');
    if (countryBtn) {
        countryBtn.parentElement.style.position = 'relative';
        countryBtn.parentElement.appendChild(dropdown);
    }

    // 外側クリックで閉じる
    setTimeout(() => {
        const closeHandler = (e) => {
            if (!dropdown.contains(e.target) && e.target !== countryBtn && !countryBtn.contains(e.target)) {
                dropdown.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        document.addEventListener('click', closeHandler);
    }, 10);
}

async function buildPackCarousel() {
    const track = document.getElementById('pack-carousel-track');
    if (!track) return;

    track.innerHTML = '';

    const packsConfig = await getPacksConfig();
    if (!packsConfig) return;

    for (const pack of packsConfig) {
        const btn = document.createElement('button');
        btn.className = 'pack-item';
        btn.setAttribute('data-pack', pack.id);

        if (pack.isDaily) {
            const badge = document.createElement('span');
            badge.className = 'pack-badge';
            badge.textContent = t('pack.recommended');
            btn.appendChild(badge);
        }

        const img = document.createElement('img');
        img.className = 'pack-item-img';
        img.src = `assets/pack-${pack.id}.webp`;
        img.alt = t(`pack.${pack.id}`) || pack.id;
        img.draggable = false;
        btn.appendChild(img);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'pack-item-name';
        nameSpan.setAttribute('data-i18n', `pack.${pack.id}`);
        nameSpan.textContent = t(`pack.${pack.id}`) || pack.id;
        btn.appendChild(nameSpan);

        track.appendChild(btn);
    }

    // F5リロード時にブラウザがスクロール位置を復元してTOP200が端に来るのを防止
    // 構築完了後にスクロール位置をリセット
    track.scrollLeft = 0;
    // ブラウザの自動スクロール復元より後にもリセット（非同期復元対策）
    requestAnimationFrame(() => {
        track.scrollLeft = 0;
    });

    buildCollectionTabs(packsConfig);
}

function buildCollectionTabs(packsConfig) {
    const tabsContainer = document.getElementById('pack-filter-tabs');
    if (!tabsContainer) return;

    tabsContainer.innerHTML = '';

    const allTab = document.createElement('button');
    allTab.className = 'pack-filter-tab active';
    allTab.setAttribute('data-pack-filter', 'all');
    allTab.textContent = t('collection.allTab');
    tabsContainer.appendChild(allTab);

    const top200Tab = document.createElement('button');
    top200Tab.className = 'pack-filter-tab pack-filter-tab-top200';
    top200Tab.setAttribute('data-pack-filter', 'top200');
    top200Tab.innerHTML = '<i data-lucide="trophy"></i> Top 200';
    tabsContainer.appendChild(top200Tab);

    const packIcons = {
        jpop: 'flower-2', kpop: 'gem', vocaloid: 'mic', anime: 'sparkles',
        hiphop: 'headphones', western: 'globe', standard: 'music',
        pop: 'music', country: 'music', rock: 'guitar', dance: 'disc-3',
        alternative: 'zap', rnb: 'heart',
    };

    for (const pack of packsConfig) {
        if (pack.id === 'top200') continue;
        if (pack.id === 'standard') continue;
        const tab = document.createElement('button');
        tab.className = 'pack-filter-tab';
        tab.setAttribute('data-pack-filter', pack.id);
        const iconName = packIcons[pack.id] || 'music';
        tab.innerHTML = `<i data-lucide="${iconName}"></i> ${t(`pack.${pack.id}`) || pack.id}`;
        tabsContainer.appendChild(tab);
    }

    refreshIcons();
}

async function switchRegion(newRegion) {
    if (newRegion === getRegion()) return;

    setRegion(newRegion);

    // リージョンに応じて言語も切替
    const config = REGIONS[newRegion];
    if (config && config.language) {
        setSetting('language', config.language);
        setLanguage(config.language);
    }

    invalidateCache();
    initStorage();

    await buildPackCarousel();

    updateRegionDisplay();
    updateHomeScreen();

    selectedPackType = 'top200';
    setSetting('selectedPack', 'top200');
    updatePackImage('top200');

    if (currentScreen === 'collection') {
        initCollection();
        refreshCollection();
    }

    refreshIcons();
    console.log(`[App] Region switched to: ${newRegion}`);
}

// ---- SVG Gradient Injection for Top200 Ring ----
function injectTop200Gradient() {
    const svg = document.querySelector('.top200-ring');
    if (!svg) return;
    // Check if gradient already injected
    if (document.getElementById('top200-gradient')) return;
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
        <linearGradient id="top200-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fbbf24" />
            <stop offset="50%" stop-color="#f59e0b" />
            <stop offset="100%" stop-color="#ef4444" />
        </linearGradient>
    `;
    svg.insertBefore(defs, svg.firstChild);
}

// ---- Initialization ----

async function init() {
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

    // リージョン表示の初期化
    updateRegionDisplay();

    // パックカルーセルを動的生成（awaitで完了を待つことでスクロール位置の正しいリセットを保証）
    await buildPackCarousel();



    // イベントハンドラ設定
    setupEventListeners();

    // 初期画面表示
    const hash = window.location.hash.replace('#', '') || 'home';
    showScreen(hash);

    // グローバル参照（他モジュールから呼び出し用）
    window.MusicGacha = window.MusicGacha || {};
    window.MusicGacha.navigateTo = navigateTo;
    window.MusicGacha.showToast = showToast;
    window.MusicGacha.t = t;
    window.MusicGacha.showLoading = showLoading;
    window.MusicGacha.hideLoading = hideLoading;
    window.MusicGacha.showConfirmDialog = showConfirmDialog;
    window.MusicGacha.updateHomeScreen = updateHomeScreen;
    window.MusicGacha.refreshModalBannerAd = refreshModalBannerAd;
    window.MusicGacha.invalidateDataCache = () => {
        invalidateCache();
        updateHomeScreen();
        if (currentScreen === 'collection') refreshCollection();
    };
    window.MusicGacha.isAutoOpenEnabled = () => getSetting('autoOpen') === true;
    window.MusicGacha.switchRegion = switchRegion;
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

    // SVGグラデーション定義を注入
    injectTop200Gradient();

    // 初回アクセス時の音声注意トースト
    if (!getSetting('firstVisitDone')) {
        setSetting('firstVisitDone', true);
        setTimeout(() => {
            showToast(t('toast.soundHint'), 'info', 5000);
        }, 1500);
    }

    // タブ復帰時にデータキャッシュを更新（top200-daily.jsonを再取得）
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            const config = getRegionConfig();
            invalidateCache(config.top200File);
            updateHomeScreen();
            if (currentScreen === 'collection') refreshCollection();
        }
    });

    console.log('[MusicGacha] App initialized');
}

// DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
