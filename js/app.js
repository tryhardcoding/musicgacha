// ============================================================
// MusicGacha - App Module
// アプリ初期化�E画面ルーチE��ング・UIイベント管琁E
// ============================================================

import { initStorage, getPackData, getNextRegenTime, canClaimDailyBonus, claimDailyBonus, resetAllData, getSetting, setSetting, getUniqueCardCount, getTotalCardCount, addPacks, getTop200Data, getTop200Remaining, getCollection } from './storage.js';
import { initI18n, setLanguage, t, applyTranslations } from './i18n.js';
import { getTop200Tracks } from './api.js';
import { getRegion, setRegion, REGIONS, getRegionConfig, getFlagUrl } from './region.js';
import { getPacksConfig } from './data-loader.js';
import './gacha.js?v=20260329d'; // ガチャモジュール�E�グローバル参�EにopenPackを登録�E�E
import { initCollection, renderCollection, refreshCollection, resetCollectionState } from './collection.js';
import { initShareHandler } from './transfer.js';
import { initAds, showRewardedAd, updateAdButton, refreshModalBannerAd } from './ads.js?v=20260329d';
import { icon, refreshIcons } from './icons.js';
import { sharePackResult, shareCollectionStats } from './share-sns.js?v=20260329d';
import { invalidateCache } from './data-loader.js';
import { checkAchievements, getAchievementStats, renderAchievementModal, trackDailyBonus } from './achievements.js';
import { getAmazonMusicUnlimitedUrl } from './affiliate.js';
import { trackPackOpen, trackShareEvent, trackViewCollection, trackDailyBonus as trackDailyBonusGA, trackRegionChange } from './analytics.js';

// ---- Screen Routing ----

const screens = ['home', 'pack', 'collection'];
let currentScreen = 'home';
let selectedPackType = 'top200';

function showScreen(screenId) {
    if (!screens.includes(screenId)) screenId = 'home';

    // パック画面から離れたら試聴音声を停止�E�E��封セチE��ョンをキャンセル
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

    // 画面固有�E初期匁E
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

    // 開封�Eタン
    const btnOpen = document.getElementById('btn-open-pack');
    if (btnOpen) {
        btnOpen.disabled = packData.current <= 0;
        const textEl = btnOpen.querySelector('.btn-open-pack-text');
        if (textEl) {
            textEl.textContent = packData.current > 0 ? t('home.openPack') : t('home.noPacks');
        }
    }

    // ゴールドパチE��進捁E
    const progress = packData.totalOpened % 10;
    const goldFill = document.getElementById('gold-pack-fill');
    const goldLabel = document.getElementById('gold-pack-label');
    if (goldFill) goldFill.style.width = `${(progress / 10) * 100}%`;
    if (goldLabel) goldLabel.textContent = t('home.goldPackProgress', { current: progress });

    // チE��リーボ�Eナス
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

    // 収集進捁E
    const uniqueCount = getUniqueCardCount();
    const totalCount = getTotalCardCount();
    const progressText = document.getElementById('progress-ring-text');
    const progressTotal = document.getElementById('progress-total');
    if (progressText) progressText.textContent = uniqueCount;
    if (progressTotal) progressTotal.textContent = `${totalCount} / ∞`;

    // リジェンタイマ�E
    updateRegenTimer();

    // Top 200 進捗表示
    updateTop200Progress();

    // Amazon Music PR - ユーザーの収集実績と連勁E+ リージョン対応URL
    const amazonUnlimitedUrl = getAmazonMusicUnlimitedUrl();
    const amazonTitle = document.getElementById('amazon-music-title');
    if (amazonTitle) {
        amazonTitle.textContent = uniqueCount > 0
            ? t('home.amazonTitleWithCount', { count: uniqueCount })
            : t('home.amazonTitle');
    }
    // PRバナーのhrefをロケールに応じて動的設宁E
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
        // パック数を毎tick再計算！EecalculatePacksで自動回復される！E
        const packData = getPackData();
        const currentEl = document.getElementById('pack-count-current');
        if (currentEl) currentEl.textContent = packData.current;

        const ms = getNextRegenTime();
        if (ms === null) {
            // 満タン - タイマ�E不要E
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
    // obtainedKeysのみで判定（ガチャ取得時に記録されたキー）
    const chartTracks = await getTop200Tracks();
    const top200Data = getTop200Data();
    const obtainedSet = new Set(top200Data.obtainedKeys);
    const total = chartTracks.length || 200;

    let obtained = 0;
    for (const track of chartTracks) {
        const key = `${track.artist.toLowerCase()}::${track.name.toLowerCase()}`;
        if (obtainedSet.has(key)) obtained++;
    }
    const percentage = Math.min((obtained / total) * 100, 100);
    const remaining = total - obtained;

    // マイルスト�EンチE�Eタ
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

    // ホ�Eム牁E+ パック結果牁Eの両方を更新
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

    // 今日のチャート�E200曲を取征E
    const chartTracks = await getTop200Tracks();
    const total = chartTracks.length || 200;

    // 今日のチャートの曲キーとobtainedKeysの一致数をカウント
    // obtainedKeysのみで判定
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
    // フェーズ3で実裁E
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

    // TOP200チャレンジカーチEクリチE���E��Eーム + パック結果�E�E
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

    // チE��リーボ�Eナス
    const btnBonus = document.getElementById('btn-daily-bonus');
    if (btnBonus) {
        btnBonus.addEventListener('click', () => {
            const result = claimDailyBonus();
            if (result) {
                trackDailyBonus();
                trackDailyBonusGA();
                showToast(t('toast.dailyBonus'), 'success');
                updateHomeScreen();
            }
        });
    }

    // 庁E��パックボタン�E�リワード庁E���E�E
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
                trackShareEvent('x_text', 'pack_result');
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
            trackShareEvent('x_text', 'collection');
        });
    }

    // もう1パック開ける�Eタン
    const btnOpenAnother = document.getElementById('btn-open-another');
    if (btnOpenAnother) {
        btnOpenAnother.addEventListener('click', async () => {
            navigateTo('pack');
            if (window.MusicGacha && window.MusicGacha.openPack) {
                await window.MusicGacha.openPack(selectedPackType);
            }
        });
    }

    // ホ�Eムに戻る�Eタン
    const btnViewCollection = document.getElementById('btn-view-collection');
    if (btnViewCollection) {
        btnViewCollection.addEventListener('click', () => {
            navigateTo('home');
        });
    }

    // 設宁E 言語�Eり替ぁE
    const langSelect = document.getElementById('setting-language');
    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            const lang = e.target.value;
            setSetting('language', lang);
            setLanguage(lang);
            updateHomeScreen();
        });
    }

    // リージョン刁E��ボタン�E�ドロチE�Eダウン選択式！E
    const countryBtn = document.getElementById('country-btn');
    if (countryBtn) {
        countryBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleRegionDropdown();
        });
    }


    // 設宁E チE�EタリセチE���E�E段階確認！E
    const btnReset = document.getElementById('btn-reset-data');
    if (btnReset) {
        btnReset.addEventListener('click', async (e) => {
            e.preventDefault();

            // 第1段隁E 基本確誁E
            const step1 = await showConfirmDialog(t('dialog.resetMessage'));
            if (!step1) return;

            // 第2段隁E 復允E��可の警呁E
            const step2 = await showConfirmDialog(t('dialog.resetStep2'));
            if (!step2) return;

            // 第3段隁E コレクション数の提示
            const uniqueCount = getUniqueCardCount();
            const totalCount = getTotalCardCount();
            const step3 = await showConfirmDialog(
                t('dialog.resetStep3', { unique: uniqueCount, total: totalCount })
            );
            if (!step3) return;

            // 第4段隁E 最終確誁E
            const step4 = await showConfirmDialog(t('dialog.resetFinal'));
            if (!step4) return;

            resetAllData();
            showToast(t('toast.dataReset'), 'info');
            updateHomeScreen();
            updateCollectionScreen();
        });
    }

    // パックカルーセル - クリチE��で直接開封E+ ドラチE��スクロール
    const carousel = document.getElementById('pack-carousel');
    const track = document.getElementById('pack-carousel-track');
    if (carousel && track) {
        // -- ドラチE��スクロール --
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

        // -- クリチE��で直接開封E--
        track.addEventListener('click', async (e) => {
            if (hasDragged) return; // ドラチE��後�EクリチE��無効
            const item = e.target.closest('.pack-item');
            if (!item) return;
            const packType = item.getAttribute('data-pack');
            if (!packType) return;

            // パック残数チェチE��
            const packData = getPackData();
            if (packData.current <= 0) {
                showToast(t('toast.noPacks'), 'info');
                return;
            }

            // 選択状態を保孁E
            selectedPackType = packType;
            setSetting('selectedPack', packType);

            // パック画像を刁E��替ぁE
            updatePackImage(packType);

            // 直接開封E
            navigateTo('pack');
            if (window.MusicGacha && window.MusicGacha.openPack) {
                await window.MusicGacha.openPack(packType);
            }
        });
    }

    // 設宁E 自動パチE��開封トグル
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
        // 初回アクセス時�E即座にlocalStorageに保存（音が鳴るよぁE��する�E�E
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
            // カード単体�E生�E音量も連勁E
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
            // iOS対忁E audio.mutedを使用�E�Eudio.volumeはiOSで無効�E�E
            if (window.MusicGacha?.setPreviewMuted) {
                window.MusicGacha.setPreviewMuted(isMuted);
            }
            if (!isMuted && window.MusicGacha?.setPreviewVolume) {
                window.MusicGacha.setPreviewVolume(vol / 100);
            }
            // カード単体�E生�Eミュートも連勁E
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

    // モーダル背景クリチE��で閉じめE
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

    // ハッシュルーチE��ング
    window.addEventListener('hashchange', () => {
        const screen = window.location.hash.replace('#', '') || 'home';
        showScreen(screen);
    });

    // 実績ボタン�E��Eーム + ヘッダー�E�E
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

    // 実績モーダル閉じめE
    const achClose = document.getElementById('achievement-modal-close');
    if (achClose) {
        achClose.addEventListener('click', () => {
            const modal = document.getElementById('achievement-modal');
            if (modal) modal.style.display = 'none';
        });
    }

    // 実績モーダル背景クリチE��で閉じめE
    const achModal = document.getElementById('achievement-modal');
    if (achModal) {
        achModal.addEventListener('click', (e) => {
            if (e.target === achModal) achModal.style.display = 'none';
        });
    }

    // Escキーでモーダルを閉じる�E�ECユーザー向けUX改喁E��E
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;

        // カード詳細モーダル
        const cardModal = document.getElementById('card-detail-modal');
        if (cardModal && cardModal.style.display !== 'none') {
            cardModal.style.display = 'none';
            if (window.MusicGacha?.stopCardPreview) {
                window.MusicGacha.stopCardPreview();
            }
            return;
        }

        // 実績モーダル
        const achModalEl = document.getElementById('achievement-modal');
        if (achModalEl && achModalEl.style.display !== 'none') {
            achModalEl.style.display = 'none';
            return;
        }

        // 共有受取モーダル
        const shareModal = document.getElementById('share-receive-modal');
        if (shareModal && shareModal.style.display !== 'none') {
            shareModal.style.display = 'none';
            history.replaceState(null, '', window.location.pathname);
            return;
        }

        // リージョンドロチE�Eダウン
        const dropdown = document.getElementById('region-dropdown');
        if (dropdown) {
            dropdown.remove();
            return;
        }
    });
}

// ---- Region Management ----

function updateRegionDisplay() {
    const region = getRegion();
    const countryBtn = document.getElementById('country-btn');
    if (countryBtn) {
        // 国旗画像を表示�E�Elagcdn.com CDN�E�E
        const flagEl = countryBtn.querySelector('.country-flag');
        if (flagEl) {
            flagEl.src = getFlagUrl(region);
            flagEl.alt = region.toUpperCase();
        }

        const codeEl = countryBtn.querySelector('.country-code');
        if (codeEl) codeEl.textContent = region.toUpperCase();

        // 初期非表示からの復帰�E�国旗フラチE��ュ防止�E�E
        countryBtn.style.visibility = '';
    }
}

/** リージョン選択ドロチE�Eダウンを表示/非表示 */
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

        const flagImg = document.createElement('img');
        flagImg.className = 'region-flag-img';
        flagImg.src = getFlagUrl(key);
        flagImg.alt = key.toUpperCase();
        flagImg.width = 20;
        flagImg.height = 15;
        flagImg.loading = 'lazy';
        item.appendChild(flagImg);

        const labelSpan = document.createElement('span');
        labelSpan.textContent = config.label;
        item.appendChild(labelSpan);

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

    // 外�EクリチE��で閉じめE
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

    // チE�Eタ取得を先に行い、DOM更新は最後に一括で実行！ELS防止�E�E
    const packsConfig = await getPacksConfig();
    if (!packsConfig) return;

    const fragment = document.createDocumentFragment();
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

        fragment.appendChild(btn);
    }

    // 一括swap: クリアと追加を連続実行し、E回�Ereflowで完亁E
    track.innerHTML = '';
    track.appendChild(fragment);

    // F5リロード時にブラウザがスクロール位置を復允E��てTOP200が端に来る�Eを防止
    track.scrollLeft = 0;
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
    trackRegionChange(newRegion);

    // リージョンに応じて言語も刁E��
    const config = REGIONS[newRegion];
    if (config && config.language) {
        setSetting('language', config.language);
        setLanguage(config.language);
    }

    invalidateCache();
    initStorage();

    await buildPackCarousel();

    updateRegionDisplay();

    // ホ�Eム画面に遷移
    navigateTo('home');
    updateHomeScreen();

    selectedPackType = 'top200';
    setSetting('selectedPack', 'top200');
    updatePackImage('top200');

    if (currentScreen === 'collection') {
        resetCollectionState();
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
    // ブラウザの自動スクロール復允E��無効化！ELS防止�E�E
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);

    // ストレージ初期匁E
    initStorage();

    // 設定読み込み: 保存済み言語がなければリージョンの言語をチE��ォルトに
    const detectedRegion = getRegion();
    const detectedLang = REGIONS[detectedRegion]?.language || 'ja';
    const settings = {
        language: getSetting('language') || detectedLang,
    };

    // i18n初期匁E+ <html lang> 動的更新
    initI18n(settings.language);
    setLanguage(settings.language);

    // 設定画面の初期値セチE��
    const langSelect = document.getElementById('setting-language');
    if (langSelect) langSelect.value = settings.language;

    // パック選択�E復允E
    const savedPack = getSetting('selectedPack') || 'top200';
    selectedPackType = savedPack;

    // パック画像�E初期設宁E
    updatePackImage(savedPack);

    // 自動開封トグルの復允E
    const autoOpenToggle = document.getElementById('setting-auto-open');
    if (autoOpenToggle) {
        autoOpenToggle.checked = getSetting('autoOpen') === true;
    }

    // リージョン表示の初期匁E
    updateRegionDisplay();

    // パックカルーセルを動皁E��成！Ewaitで完亁E��征E��ことでスクロール位置の正しいリセチE��を保証�E�E
    await buildPackCarousel();



    // イベントハンドラ設宁E
    setupEventListeners();

    // 初期画面表示
    const hash = window.location.hash.replace('#', '') || 'home';
    showScreen(hash);

    // グローバル参�E�E�他モジュールから呼び出し用�E�E
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

    // 庁E��シスチE��初期匁E
    initAds();

    // Lucideアイコン初期匁E
    refreshIcons();

    // SVGグラチE�Eション定義を注入
    injectTop200Gradient();

    // 初回アクセス時�E音声注意トースチE
    if (!getSetting('firstVisitDone')) {
        setSetting('firstVisitDone', true);
        setTimeout(() => {
            showToast(t('toast.soundHint'), 'info', 5000);
        }, 1500);
    }

    // タブ復帰時にチE�EタキャチE��ュを更新�E�Eop200-daily.jsonを�E取得！E
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            const config = getRegionConfig();
            invalidateCache(config.top200File);
            updateHomeScreen();
            if (currentScreen === 'collection') refreshCollection();
        }
    });

    // 初期化完亁E loading状態を解除して即座に表示
    document.body.classList.remove('loading');

    console.log('[MusicGacha] App initialized');
}

// DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
