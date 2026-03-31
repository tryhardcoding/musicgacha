// ============================================================
// MusicGacha - App Module
// 繧｢繝励Μ蛻晄悄蛹厄ｿｽE逕ｻ髱｢繝ｫ繝ｼ繝・・ｽ・ｽ繝ｳ繧ｰ繝ｻUI繧､繝吶Φ繝育ｮ｡逅・
// ============================================================

import { initStorage, getPackData, getNextRegenTime, canClaimDailyBonus, claimDailyBonus, resetAllData, getSetting, setSetting, getUniqueCardCount, getTotalCardCount, addPacks, getTop200Data, getTop200Remaining, getCollection } from './storage.js';
import { initI18n, setLanguage, t, applyTranslations } from './i18n.js';
import { getTop200Tracks } from './api.js';
import { getRegion, setRegion, REGIONS, getRegionConfig, getFlagUrl } from './region.js';
import { getPacksConfig } from './data-loader.js';
import './gacha.js?v=20260331a'; // 繧ｬ繝√Ε繝｢繧ｸ繝･繝ｼ繝ｫ・ｽE・ｽ繧ｰ繝ｭ繝ｼ繝舌Ν蜿ゑｿｽE縺ｫopenPack繧堤匳骭ｲ・ｽE・ｽE
import { initCollection, renderCollection, refreshCollection, resetCollectionState } from './collection.js';
import { initShareHandler } from './transfer.js';
import { initAds, showRewardedAd, updateAdButton, refreshModalBannerAd } from './ads.js?v=20260331a';
import { icon, refreshIcons } from './icons.js';
import { sharePackResult, shareCollectionStats } from './share-sns.js?v=20260331a';
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

    // 繝代ャ繧ｯ逕ｻ髱｢縺九ｉ髮｢繧後◆繧芽ｩｦ閨ｴ髻ｳ螢ｰ繧貞●豁｢・ｽE・ｽE・ｽ・ｽ蟆√そ繝・・ｽ・ｽ繝ｧ繝ｳ繧偵く繝｣繝ｳ繧ｻ繝ｫ
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

    // 繝翫ン繧ｲ繝ｼ繧ｷ繝ｧ繝ｳ譖ｴ譁ｰ
    document.querySelectorAll('.nav-item').forEach(item => {
        const target = item.getAttribute('data-screen');
        item.classList.toggle('active', target === screenId);
    });

    currentScreen = screenId;

    // 逕ｻ髱｢蝗ｺ譛会ｿｽE蛻晄悄蛹・
    if (screenId === 'home') {
        updateHomeScreen();
    } else if (screenId === 'collection') {
        updateCollectionScreen();
        initCollection();
        refreshCollection(); // TOP200繝薙Η繝ｼ繧ょ性繧√※蜀肴緒逕ｻ
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

    // 繝代ャ繧ｯ谿区焚
    const currentEl = document.getElementById('pack-count-current');
    if (currentEl) currentEl.textContent = packData.current;

    // TOP200 繝√Ε繝ｬ繝ｳ繧ｸ繧ｫ繝ｼ繝画峩譁ｰ
    updateTop200ChallengeCard();

    // 髢句ｰ・ｿｽE繧ｿ繝ｳ
    const btnOpen = document.getElementById('btn-open-pack');
    if (btnOpen) {
        btnOpen.disabled = packData.current <= 0;
        const textEl = btnOpen.querySelector('.btn-open-pack-text');
        if (textEl) {
            textEl.textContent = packData.current > 0 ? t('home.openPack') : t('home.noPacks');
        }
    }

    // 繧ｴ繝ｼ繝ｫ繝峨ヱ繝・・ｽ・ｽ騾ｲ謐・
    const progress = packData.totalOpened % 10;
    const goldFill = document.getElementById('gold-pack-fill');
    const goldLabel = document.getElementById('gold-pack-label');
    if (goldFill) goldFill.style.width = `${(progress / 10) * 100}%`;
    if (goldLabel) goldLabel.textContent = t('home.goldPackProgress', { current: progress });

    // 繝・・ｽ・ｽ繝ｪ繝ｼ繝懶ｿｽE繝翫せ
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

    // 蜿朱寔騾ｲ謐・
    const uniqueCount = getUniqueCardCount();
    const totalCount = getTotalCardCount();
    const progressText = document.getElementById('progress-ring-text');
    const progressTotal = document.getElementById('progress-total');
    if (progressText) progressText.textContent = uniqueCount;
    if (progressTotal) progressTotal.textContent = `${totalCount} / 竏杼;

    // 繝ｪ繧ｸ繧ｧ繝ｳ繧ｿ繧､繝橸ｿｽE
    updateRegenTimer();

    // Top 200 騾ｲ謐苓｡ｨ遉ｺ
    updateTop200Progress();

    // Amazon Music PR - 繝ｦ繝ｼ繧ｶ繝ｼ縺ｮ蜿朱寔螳溽ｸｾ縺ｨ騾｣蜍・+ 繝ｪ繝ｼ繧ｸ繝ｧ繝ｳ蟇ｾ蠢弑RL
    const amazonUnlimitedUrl = getAmazonMusicUnlimitedUrl();
    const amazonTitle = document.getElementById('amazon-music-title');
    if (amazonTitle) {
        amazonTitle.textContent = uniqueCount > 0
            ? t('home.amazonTitleWithCount', { count: uniqueCount })
            : t('home.amazonTitle');
    }
    // PR繝舌リ繝ｼ縺ｮhref繧偵Ο繧ｱ繝ｼ繝ｫ縺ｫ蠢懊§縺ｦ蜍慕噪險ｭ螳・
    const amazonPrHome = document.getElementById('amazon-music-pr');
    if (amazonPrHome) amazonPrHome.href = amazonUnlimitedUrl;
    const amazonPrPack = document.getElementById('amazon-music-pr-pack');
    if (amazonPrPack) amazonPrPack.href = amazonUnlimitedUrl;

    // 繝代ャ繧ｯ邨先棡逕ｻ髱｢縺ｮAmazon Music PR繧ｿ繧､繝医Ν繧よ峩譁ｰ
    const amazonTitlePack = document.getElementById('amazon-music-title-pack');
    if (amazonTitlePack) {
        amazonTitlePack.textContent = uniqueCount > 0
            ? t('pack.amazonTitleWithCount', { count: uniqueCount })
            : t('pack.amazonTitle');
    }

    // 螳溽ｸｾ繝懊ち繝ｳ縺ｮ繧ｫ繧ｦ繝ｳ繝域峩譁ｰ
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
        // 繝代ャ繧ｯ謨ｰ繧呈ｯ師ick蜀崎ｨ育ｮ暦ｼ・ecalculatePacks縺ｧ閾ｪ蜍募屓蠕ｩ縺輔ｌ繧具ｼ・
        const packData = getPackData();
        const currentEl = document.getElementById('pack-count-current');
        if (currentEl) currentEl.textContent = packData.current;

        const ms = getNextRegenTime();
        if (ms === null) {
            // 貅繧ｿ繝ｳ - 繧ｿ繧､繝橸ｿｽE荳崎ｦ・
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

    // 迴ｾ蝨ｨ縺ｮ繝√Ε繝ｼ繝医ヨ繝ｩ繝・け縺ｨ辣ｧ蜷医＠縺ｦ豁｣遒ｺ縺ｪobtained謨ｰ繧偵き繧ｦ繝ｳ繝・
    // obtainedKeys縺ｮ縺ｿ縺ｧ蛻､螳夲ｼ医ぎ繝√Ε蜿門ｾ玲凾縺ｫ險倬鹸縺輔ｌ縺溘く繝ｼ・・
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

    // 繝槭う繝ｫ繧ｹ繝茨ｿｽE繝ｳ繝・・ｽE繧ｿ
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

    // 繝幢ｿｽE繝迚・+ 繝代ャ繧ｯ邨先棡迚・縺ｮ荳｡譁ｹ繧呈峩譁ｰ
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

    // Top 200繝代ャ繧ｯ驕ｸ謚樊凾縺ｮ縺ｿ陦ｨ遉ｺ
    if (selectedPackType !== 'top200') {
        progressEl.style.display = 'none';
        return;
    }

    progressEl.style.display = '';

    // 莉頑律縺ｮ繝√Ε繝ｼ繝茨ｿｽE200譖ｲ繧貞叙蠕・
    const chartTracks = await getTop200Tracks();
    const total = chartTracks.length || 200;

    // 莉頑律縺ｮ繝√Ε繝ｼ繝医・譖ｲ繧ｭ繝ｼ縺ｨobtainedKeys縺ｮ荳閾ｴ謨ｰ繧偵き繧ｦ繝ｳ繝・
    // obtainedKeys縺ｮ縺ｿ縺ｧ蛻､螳・
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
    // 繝輔ぉ繝ｼ繧ｺ3縺ｧ螳溯｣・
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
    // 繝翫ン繧ｲ繝ｼ繧ｷ繝ｧ繝ｳ
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const screen = item.getAttribute('data-screen');
            navigateTo(screen);
        });
    });

    // TOP200繝√Ε繝ｬ繝ｳ繧ｸ繧ｫ繝ｼ繝・繧ｯ繝ｪ繝・・ｽ・ｽ・ｽE・ｽ・ｽE繝ｼ繝 + 繝代ャ繧ｯ邨先棡・ｽE・ｽE
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

    // 繝・・ｽ・ｽ繝ｪ繝ｼ繝懶ｿｽE繝翫せ
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

    // 蠎・・ｽ・ｽ繝代ャ繧ｯ繝懊ち繝ｳ・ｽE・ｽ繝ｪ繝ｯ繝ｼ繝牙ｺ・・ｽ・ｽ・ｽE・ｽE
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

    // 繝代ャ繧ｯ邨先棡繧湛縺ｧ繧ｷ繧ｧ繧｢繝懊ち繝ｳ
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

    // 繧ｳ繝ｬ繧ｯ繧ｷ繝ｧ繝ｳ繧湛縺ｧ繧ｷ繧ｧ繧｢繝懊ち繝ｳ
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

    // 繧ゅ≧1繝代ャ繧ｯ髢九￠繧具ｿｽE繧ｿ繝ｳ
    const btnOpenAnother = document.getElementById('btn-open-another');
    if (btnOpenAnother) {
        btnOpenAnother.addEventListener('click', async () => {
            navigateTo('pack');
            if (window.MusicGacha && window.MusicGacha.openPack) {
                await window.MusicGacha.openPack(selectedPackType);
            }
        });
    }

    // 繝幢ｿｽE繝縺ｫ謌ｻ繧具ｿｽE繧ｿ繝ｳ
    const btnViewCollection = document.getElementById('btn-view-collection');
    if (btnViewCollection) {
        btnViewCollection.addEventListener('click', () => {
            navigateTo('home');
        });
    }

    // 險ｭ螳・ 險隱橸ｿｽE繧頑崛縺・
    const langSelect = document.getElementById('setting-language');
    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            const lang = e.target.value;
            setSetting('language', lang);
            setLanguage(lang);
            updateHomeScreen();
        });
    }

    // 繝ｪ繝ｼ繧ｸ繝ｧ繝ｳ蛻・・ｽ・ｽ繝懊ち繝ｳ・ｽE・ｽ繝峨Ο繝・・ｽE繝繧ｦ繝ｳ驕ｸ謚槫ｼ擾ｼ・
    const countryBtn = document.getElementById('country-btn');
    if (countryBtn) {
        countryBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleRegionDropdown();
        });
    }


    // 險ｭ螳・ 繝・・ｽE繧ｿ繝ｪ繧ｻ繝・・ｽ・ｽ・ｽE・ｽE谿ｵ髫守｢ｺ隱搾ｼ・
    const btnReset = document.getElementById('btn-reset-data');
    if (btnReset) {
        btnReset.addEventListener('click', async (e) => {
            e.preventDefault();

            // 隨ｬ1谿ｵ髫・ 蝓ｺ譛ｬ遒ｺ隱・
            const step1 = await showConfirmDialog(t('dialog.resetMessage'));
            if (!step1) return;

            // 隨ｬ2谿ｵ髫・ 蠕ｩ蜈・・ｽ・ｽ蜿ｯ縺ｮ隴ｦ蜻・
            const step2 = await showConfirmDialog(t('dialog.resetStep2'));
            if (!step2) return;

            // 隨ｬ3谿ｵ髫・ 繧ｳ繝ｬ繧ｯ繧ｷ繝ｧ繝ｳ謨ｰ縺ｮ謠千､ｺ
            const uniqueCount = getUniqueCardCount();
            const totalCount = getTotalCardCount();
            const step3 = await showConfirmDialog(
                t('dialog.resetStep3', { unique: uniqueCount, total: totalCount })
            );
            if (!step3) return;

            // 隨ｬ4谿ｵ髫・ 譛邨ら｢ｺ隱・
            const step4 = await showConfirmDialog(t('dialog.resetFinal'));
            if (!step4) return;

            resetAllData();
            showToast(t('toast.dataReset'), 'info');
            updateHomeScreen();
            updateCollectionScreen();
        });
    }

    // 繝代ャ繧ｯ繧ｫ繝ｫ繝ｼ繧ｻ繝ｫ - 繧ｯ繝ｪ繝・・ｽ・ｽ縺ｧ逶ｴ謗･髢句ｰ・+ 繝峨Λ繝・・ｽ・ｽ繧ｹ繧ｯ繝ｭ繝ｼ繝ｫ
    const carousel = document.getElementById('pack-carousel');
    const track = document.getElementById('pack-carousel-track');
    if (carousel && track) {
        // -- 繝峨Λ繝・・ｽ・ｽ繧ｹ繧ｯ繝ｭ繝ｼ繝ｫ --
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

        // -- 繧ｯ繝ｪ繝・・ｽ・ｽ縺ｧ逶ｴ謗･髢句ｰ・--
        track.addEventListener('click', async (e) => {
            if (hasDragged) return; // 繝峨Λ繝・・ｽ・ｽ蠕鯉ｿｽE繧ｯ繝ｪ繝・・ｽ・ｽ辟｡蜉ｹ
            const item = e.target.closest('.pack-item');
            if (!item) return;
            const packType = item.getAttribute('data-pack');
            if (!packType) return;

            // 繝代ャ繧ｯ谿区焚繝√ぉ繝・・ｽ・ｽ
            const packData = getPackData();
            if (packData.current <= 0) {
                showToast(t('toast.noPacks'), 'info');
                return;
            }

            // 驕ｸ謚樒憾諷九ｒ菫晏ｭ・
            selectedPackType = packType;
            setSetting('selectedPack', packType);

            // 繝代ャ繧ｯ逕ｻ蜒上ｒ蛻・・ｽ・ｽ譖ｿ縺・
            updatePackImage(packType);

            // 逶ｴ謗･髢句ｰ・
            navigateTo('pack');
            if (window.MusicGacha && window.MusicGacha.openPack) {
                await window.MusicGacha.openPack(packType);
            }
        });
    }

    // 險ｭ螳・ 閾ｪ蜍輔ヱ繝・・ｽ・ｽ髢句ｰ√ヨ繧ｰ繝ｫ
    const autoOpenToggle = document.getElementById('setting-auto-open');
    if (autoOpenToggle) {
        autoOpenToggle.addEventListener('change', (e) => {
            setSetting('autoOpen', e.target.checked);
        });
    }

    // 髻ｳ驥上さ繝ｳ繝医Ο繝ｼ繝ｫ
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
        // 蜷梧悄逧・↓Lucide繧｢繧､繧ｳ繝ｳ繧貞・謠冗判・・efreshIcons()縺ｯrequestIdleCallback邨檎罰縺ｧ驕・ｻｶ縺吶ｋ縺溘ａ譖ｴ譁ｰ縺輔ｌ縺ｪ縺・ｼ・
        if (window.lucide) {
            window.lucide.createIcons();
        }
        // aria-label譖ｴ譁ｰ
        if (volumeBtn) {
            volumeBtn.setAttribute('aria-label', (vol === 0 || isMuted) ? '繝溘Η繝ｼ繝郁ｧ｣髯､' : '繝溘Η繝ｼ繝・);
        }
    }

    if (volumeSlider) {
        const DEFAULT_VOLUME = 10;
        const savedVol = getSetting('volume') != null ? parseInt(getSetting('volume'), 10) : DEFAULT_VOLUME;
        volumeSlider.value = isNaN(savedVol) ? DEFAULT_VOLUME : savedVol;
        // 蛻晏屓繧｢繧ｯ繧ｻ繧ｹ譎ゑｿｽE蜊ｳ蠎ｧ縺ｫlocalStorage縺ｫ菫晏ｭ假ｼ磯浹縺碁ｳｴ繧九ｈ縺・・ｽ・ｽ縺吶ｋ・ｽE・ｽE
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
            // 繧ｫ繝ｼ繝牙腰菴難ｿｽE逕滂ｿｽE髻ｳ驥上ｂ騾｣蜍・
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
            // iOS蟇ｾ蠢・ audio.muted繧剃ｽｿ逕ｨ・ｽE・ｽEudio.volume縺ｯiOS縺ｧ辟｡蜉ｹ・ｽE・ｽE
            if (window.MusicGacha?.setPreviewMuted) {
                window.MusicGacha.setPreviewMuted(isMuted);
            }
            if (!isMuted && window.MusicGacha?.setPreviewVolume) {
                window.MusicGacha.setPreviewVolume(vol / 100);
            }
            // 繧ｫ繝ｼ繝牙腰菴難ｿｽE逕滂ｿｽE繝溘Η繝ｼ繝医ｂ騾｣蜍・
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
            // 蜀咲函荳ｭ縺ｮ髻ｳ螢ｰ繧貞●豁｢
            if (window.MusicGacha?.stopCardPreview) {
                window.MusicGacha.stopCardPreview();
            }
        });
    }

    // 繝｢繝ｼ繝繝ｫ閭梧勹繧ｯ繝ｪ繝・・ｽ・ｽ縺ｧ髢峨§繧・
    const modalOverlay = document.getElementById('card-detail-modal');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.style.display = 'none';
                // 蜀咲函荳ｭ縺ｮ髻ｳ螢ｰ繧貞●豁｢
                if (window.MusicGacha?.stopCardPreview) {
                    window.MusicGacha.stopCardPreview();
                }
            }
        });
    }

    // 繝上ャ繧ｷ繝･繝ｫ繝ｼ繝・・ｽ・ｽ繝ｳ繧ｰ
    window.addEventListener('hashchange', () => {
        const screen = window.location.hash.replace('#', '') || 'home';
        showScreen(screen);
    });

    // 螳溽ｸｾ繝懊ち繝ｳ・ｽE・ｽ・ｽE繝ｼ繝 + 繝倥ャ繝繝ｼ・ｽE・ｽE
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

    // 螳溽ｸｾ繝｢繝ｼ繝繝ｫ髢峨§繧・
    const achClose = document.getElementById('achievement-modal-close');
    if (achClose) {
        achClose.addEventListener('click', () => {
            const modal = document.getElementById('achievement-modal');
            if (modal) modal.style.display = 'none';
        });
    }

    // 螳溽ｸｾ繝｢繝ｼ繝繝ｫ閭梧勹繧ｯ繝ｪ繝・・ｽ・ｽ縺ｧ髢峨§繧・
    const achModal = document.getElementById('achievement-modal');
    if (achModal) {
        achModal.addEventListener('click', (e) => {
            if (e.target === achModal) achModal.style.display = 'none';
        });
    }

    // Esc繧ｭ繝ｼ縺ｧ繝｢繝ｼ繝繝ｫ繧帝哩縺倥ｋ・ｽE・ｽEC繝ｦ繝ｼ繧ｶ繝ｼ蜷代￠UX謾ｹ蝟・・ｽ・ｽE
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;

        // 繧ｫ繝ｼ繝芽ｩｳ邏ｰ繝｢繝ｼ繝繝ｫ
        const cardModal = document.getElementById('card-detail-modal');
        if (cardModal && cardModal.style.display !== 'none') {
            cardModal.style.display = 'none';
            if (window.MusicGacha?.stopCardPreview) {
                window.MusicGacha.stopCardPreview();
            }
            return;
        }

        // 螳溽ｸｾ繝｢繝ｼ繝繝ｫ
        const achModalEl = document.getElementById('achievement-modal');
        if (achModalEl && achModalEl.style.display !== 'none') {
            achModalEl.style.display = 'none';
            return;
        }

        // 蜈ｱ譛牙女蜿悶Δ繝ｼ繝繝ｫ
        const shareModal = document.getElementById('share-receive-modal');
        if (shareModal && shareModal.style.display !== 'none') {
            shareModal.style.display = 'none';
            history.replaceState(null, '', window.location.pathname);
            return;
        }

        // 繝ｪ繝ｼ繧ｸ繝ｧ繝ｳ繝峨Ο繝・・ｽE繝繧ｦ繝ｳ
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
        // 蝗ｽ譌礼判蜒上ｒ陦ｨ遉ｺ・ｽE・ｽElagcdn.com CDN・ｽE・ｽE
        const flagEl = countryBtn.querySelector('.country-flag');
        if (flagEl) {
            flagEl.src = getFlagUrl(region);
            flagEl.alt = region.toUpperCase();
        }

        const codeEl = countryBtn.querySelector('.country-code');
        if (codeEl) codeEl.textContent = region.toUpperCase();

        // 蛻晄悄髱櫁｡ｨ遉ｺ縺九ｉ縺ｮ蠕ｩ蟶ｰ・ｽE・ｽ蝗ｽ譌励ヵ繝ｩ繝・・ｽ・ｽ繝･髦ｲ豁｢・ｽE・ｽE
        countryBtn.style.visibility = '';
    }
}

/** 繝ｪ繝ｼ繧ｸ繝ｧ繝ｳ驕ｸ謚槭ラ繝ｭ繝・・ｽE繝繧ｦ繝ｳ繧定｡ｨ遉ｺ/髱櫁｡ｨ遉ｺ */
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

    // 螟厄ｿｽE繧ｯ繝ｪ繝・・ｽ・ｽ縺ｧ髢峨§繧・
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

    // 繝・・ｽE繧ｿ蜿門ｾ励ｒ蜈医↓陦後＞縲．OM譖ｴ譁ｰ縺ｯ譛蠕後↓荳諡ｬ縺ｧ螳溯｡鯉ｼ・LS髦ｲ豁｢・ｽE・ｽE
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

    // 荳諡ｬswap: 繧ｯ繝ｪ繧｢縺ｨ霑ｽ蜉繧帝｣邯壼ｮ溯｡後＠縲・蝗橸ｿｽEreflow縺ｧ螳御ｺ・
    track.innerHTML = '';
    track.appendChild(fragment);

    // F5繝ｪ繝ｭ繝ｼ繝画凾縺ｫ繝悶Λ繧ｦ繧ｶ縺後せ繧ｯ繝ｭ繝ｼ繝ｫ菴咲ｽｮ繧貞ｾｩ蜈・・ｽ・ｽ縺ｦTOP200縺檎ｫｯ縺ｫ譚･繧具ｿｽE繧帝亟豁｢
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

    // 繝ｪ繝ｼ繧ｸ繝ｧ繝ｳ縺ｫ蠢懊§縺ｦ險隱槭ｂ蛻・・ｽ・ｽ
    const config = REGIONS[newRegion];
    if (config && config.language) {
        setSetting('language', config.language);
        setLanguage(config.language);
    }

    invalidateCache();
    initStorage();

    await buildPackCarousel();

    updateRegionDisplay();

    // 繝幢ｿｽE繝逕ｻ髱｢縺ｫ驕ｷ遘ｻ
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
    // 繝悶Λ繧ｦ繧ｶ縺ｮ閾ｪ蜍輔せ繧ｯ繝ｭ繝ｼ繝ｫ蠕ｩ蜈・・ｽ・ｽ辟｡蜉ｹ蛹厄ｼ・LS髦ｲ豁｢・ｽE・ｽE
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);

    // 繧ｹ繝医Ξ繝ｼ繧ｸ蛻晄悄蛹・
    initStorage();

    // 險ｭ螳夊ｪｭ縺ｿ霎ｼ縺ｿ: 菫晏ｭ俶ｸ医∩險隱槭′縺ｪ縺代ｌ縺ｰ繝ｪ繝ｼ繧ｸ繝ｧ繝ｳ縺ｮ險隱槭ｒ繝・・ｽ・ｽ繧ｩ繝ｫ繝医↓
    const detectedRegion = getRegion();
    const detectedLang = REGIONS[detectedRegion]?.language || 'ja';
    const settings = {
        language: getSetting('language') || detectedLang,
    };

    // i18n蛻晄悄蛹・+ <html lang> 蜍慕噪譖ｴ譁ｰ
    initI18n(settings.language);
    setLanguage(settings.language);

    // 險ｭ螳夂判髱｢縺ｮ蛻晄悄蛟､繧ｻ繝・・ｽ・ｽ
    const langSelect = document.getElementById('setting-language');
    if (langSelect) langSelect.value = settings.language;

    // 繝代ャ繧ｯ驕ｸ謚橸ｿｽE蠕ｩ蜈・
    const savedPack = getSetting('selectedPack') || 'top200';
    selectedPackType = savedPack;

    // 繝代ャ繧ｯ逕ｻ蜒擾ｿｽE蛻晄悄險ｭ螳・
    updatePackImage(savedPack);

    // 閾ｪ蜍暮幕蟆√ヨ繧ｰ繝ｫ縺ｮ蠕ｩ蜈・
    const autoOpenToggle = document.getElementById('setting-auto-open');
    if (autoOpenToggle) {
        autoOpenToggle.checked = getSetting('autoOpen') === true;
    }

    // 繝ｪ繝ｼ繧ｸ繝ｧ繝ｳ陦ｨ遉ｺ縺ｮ蛻晄悄蛹・
    updateRegionDisplay();

    // 繝代ャ繧ｯ繧ｫ繝ｫ繝ｼ繧ｻ繝ｫ繧貞虚逧・・ｽ・ｽ謌撰ｼ・wait縺ｧ螳御ｺ・・ｽ・ｽ蠕・・ｽ・ｽ縺薙→縺ｧ繧ｹ繧ｯ繝ｭ繝ｼ繝ｫ菴咲ｽｮ縺ｮ豁｣縺励＞繝ｪ繧ｻ繝・・ｽ・ｽ繧剃ｿ晁ｨｼ・ｽE・ｽE
    await buildPackCarousel();



    // 繧､繝吶Φ繝医ワ繝ｳ繝峨Λ險ｭ螳・
    setupEventListeners();

    // 蛻晄悄逕ｻ髱｢陦ｨ遉ｺ
    const hash = window.location.hash.replace('#', '') || 'home';
    showScreen(hash);

    // 繧ｰ繝ｭ繝ｼ繝舌Ν蜿ゑｿｽE・ｽE・ｽ莉悶Δ繧ｸ繝･繝ｼ繝ｫ縺九ｉ蜻ｼ縺ｳ蜃ｺ縺礼畑・ｽE・ｽE
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

    // 蜈ｱ譛峨Μ繝ｳ繧ｯ縺ｮ讀懃衍
    initShareHandler();

    // 蠎・・ｽ・ｽ繧ｷ繧ｹ繝・・ｽ・ｽ蛻晄悄蛹・
    initAds();

    // Lucide繧｢繧､繧ｳ繝ｳ蛻晄悄蛹・
    refreshIcons();

    // SVG繧ｰ繝ｩ繝・・ｽE繧ｷ繝ｧ繝ｳ螳夂ｾｩ繧呈ｳｨ蜈･
    injectTop200Gradient();

    // 蛻晏屓繧｢繧ｯ繧ｻ繧ｹ譎ゑｿｽE髻ｳ螢ｰ豕ｨ諢上ヨ繝ｼ繧ｹ繝・
    if (!getSetting('firstVisitDone')) {
        setSetting('firstVisitDone', true);
        setTimeout(() => {
            showToast(t('toast.soundHint'), 'info', 5000);
        }, 1500);
    }

    // 繧ｿ繝門ｾｩ蟶ｰ譎ゅ↓繝・・ｽE繧ｿ繧ｭ繝｣繝・・ｽ・ｽ繝･繧呈峩譁ｰ・ｽE・ｽEop200-daily.json繧抵ｿｽE蜿門ｾ暦ｼ・
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            const config = getRegionConfig();
            invalidateCache(config.top200File);
            updateHomeScreen();
            if (currentScreen === 'collection') refreshCollection();
        }
    });

    // 蛻晄悄蛹門ｮ御ｺ・ loading迥ｶ諷九ｒ隗｣髯､縺励※蜊ｳ蠎ｧ縺ｫ陦ｨ遉ｺ
    document.body.classList.remove('loading');

    console.log('[MusicGacha] App initialized');
}

// DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
