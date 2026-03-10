// ============================================================
// MusicGacha - Pack Animation Module
// パック開封アニメーション + プレイリスト再生制御
// ============================================================

import { renderCard } from './card-renderer.js';
import { t } from './i18n.js';
import { getSetting } from './storage.js';
import { showAmazonCta } from './amazon-cta.js';

// ---- Playlist Controller ----
let playlist = [];        // { previewUrl, btnEl, cardEl, cardData } の配列
let playlistIndex = -1;
let currentAudio = null;
let isPlaying = false;
let fadeOutTimer = null;
let fadeInTimer = null;
let progressRAF = null;

const FADE_DURATION = 800; // ms
const FADE_STEPS = 20;
let packSessionId = 0; // パック開封セッションID（キャンセル用）
const CROSSFADE_OFFSET = 2; // 曲終了N秒前からクロスフェード開始

function getVolume() {
    if (getSetting('muted') === true) return 0;
    const saved = getSetting('volume');
    if (saved == null) return 0.1;
    const parsed = parseInt(saved, 10);
    return isNaN(parsed) ? 0.1 : parsed / 100;
}

function resetPlaylist() {
    stopPlayback();
    playlist = [];
    playlistIndex = -1;
}

function registerCard(previewUrl, btnEl, cardEl, cardData = null) {
    playlist.push({ previewUrl, btnEl, cardEl, cardData });
}

/**
 * 指定インデックスの曲を再生
 */
function playAtIndex(index) {
    if (index < 0 || index >= playlist.length) return;
    if (!playlist[index].previewUrl) return;

    // 同じ曲の再クリック → 停止
    if (playlistIndex === index && currentAudio && !currentAudio.paused) {
        fadeOutAndStop();
        return;
    }

    // 再生中の曲があればクロスフェードで切り替え
    if (currentAudio && !currentAudio.paused) {
        crossfadeTo(index);
    } else {
        startPlayback(index);
    }
}

function playCard(btnEl) {
    const idx = playlist.findIndex(p => p.btnEl === btnEl);
    if (idx === -1) return false;
    playAtIndex(idx);
    return true;
}

function playNext() {
    if (playlist.length === 0) return;

    // 最後の曲が終了
    if (playlistIndex === playlist.length - 1) {
        // Amazon Music CTA表示（最後に再生した曲のデータを使用）
        const lastCard = playlist[playlistIndex]?.cardData;
        if (lastCard) {
            // 少し遅延してからCTA表示（フェードアウトの余韻）
            setTimeout(() => showAmazonCta(lastCard), 600);
        }

        if (window.MusicGacha?.isAutoOpenEnabled?.()) {
            stopPlayback();
            setTimeout(() => {
                if (window.MusicGacha?.triggerAutoOpen) {
                    window.MusicGacha.triggerAutoOpen();
                }
            }, 500);
            return;
        }
    }

    let attempts = 0;
    let idx = (playlistIndex + 1) % playlist.length;
    while (!playlist[idx].previewUrl && attempts < playlist.length) {
        idx = (idx + 1) % playlist.length;
        attempts++;
    }
    if (attempts >= playlist.length) return;
    crossfadeTo(idx);
}

/**
 * クロスフェード: 旧曲フェードアウトと新曲フェードインを同時進行
 */
function crossfadeTo(newIndex) {
    const oldAudio = currentAudio;
    const oldIndex = playlistIndex;

    // 旧曲のプログレスバーを停止＆リセット
    cancelProgressUpdate();
    updateProgressBar(oldIndex, 0);
    updateButton(oldIndex, false);

    // 旧曲をフェードアウト（独立タイマー）
    if (oldAudio && !oldAudio.paused) {
        const startVol = oldAudio.volume;
        let step = 0;
        if (fadeOutTimer) clearInterval(fadeOutTimer);
        fadeOutTimer = setInterval(() => {
            step++;
            oldAudio.volume = Math.max(startVol * (1 - step / FADE_STEPS), 0);
            if (step >= FADE_STEPS) {
                clearInterval(fadeOutTimer);
                fadeOutTimer = null;
                oldAudio.pause();
                oldAudio.currentTime = 0;
            }
        }, FADE_DURATION / FADE_STEPS);
    }

    // 新曲を即座にフェードインで開始
    startPlayback(newIndex);
}

/**
 * 曲を開始（フェードイン付き）
 */
function startPlayback(index) {
    // カード単体再生中なら停止（排他制御）
    if (window.MusicGacha?.stopCardPreview) {
        window.MusicGacha.stopCardPreview();
    }
    updateAllButtons(-1);
    cancelProgressUpdate();

    playlistIndex = index;
    const item = playlist[index];
    const targetVol = getVolume();
    let crossfadeStarted = false;

    try {
        const audio = new Audio(item.previewUrl);
        audio.volume = 0;
        audio.muted = getSetting('muted') === true; // iOS対応

        // プログレスバー更新 + 終了前クロスフェード検知
        audio.addEventListener('timeupdate', () => {
            // クロスフェード開始済み or 別の曲に切り替わった → 更新しない
            if (crossfadeStarted || playlistIndex !== index) return;
            // プログレスバー更新
            if (audio.duration) {
                updateProgressBar(index, audio.currentTime / audio.duration);
            }
            // 終了N秒前 → 次曲へクロスフェード
            if (audio.duration && audio.currentTime >= audio.duration - CROSSFADE_OFFSET) {
                crossfadeStarted = true;
                updateProgressBar(index, 0);
                playNext();
            }
        });

        audio.addEventListener('ended', () => {
            if (!crossfadeStarted) {
                crossfadeStarted = true;
                updateProgressBar(index, 0);
                playNext();
            }
        });
        audio.addEventListener('error', () => {
            console.warn(`[Playlist] Audio error for track ${index}`);
            updateButton(index, false);
            updateProgressBar(index, 0);
            // エラー時は停止（playNextで無限ループしない）
        });

        audio.play().then(() => {
            fadeInAudio(audio, targetVol);
        }).catch(e => {
            console.warn('[Playlist] Autoplay blocked:', e.message);
            // iOS Safari: autoplayブロック時は停止して手動再生を待つ
            // playNext()を呼ぶと無限ループになるため呼ばない
            updateButton(index, false);
            isPlaying = false;
        });

        currentAudio = audio;
        isPlaying = true;
        updateButton(index, true);
    } catch (e) {
        console.warn('[Playlist] Failed to play:', e.message);
        playNext();
    }
}

function fadeInAudio(audio, targetVol) {
    if (fadeInTimer) clearInterval(fadeInTimer);
    let step = 0;
    fadeInTimer = setInterval(() => {
        step++;
        audio.volume = Math.min(targetVol * (step / FADE_STEPS), 1);
        if (step >= FADE_STEPS) {
            clearInterval(fadeInTimer);
            fadeInTimer = null;
            audio.volume = targetVol;
        }
    }, FADE_DURATION / FADE_STEPS);
}

function fadeOutAndStop() {
    if (!currentAudio) return;
    const audio = currentAudio;
    const startVol = audio.volume;
    const oldIndex = playlistIndex;
    let step = 0;

    if (fadeOutTimer) clearInterval(fadeOutTimer);
    fadeOutTimer = setInterval(() => {
        step++;
        audio.volume = Math.max(startVol * (1 - step / FADE_STEPS), 0);
        if (step >= FADE_STEPS) {
            clearInterval(fadeOutTimer);
            fadeOutTimer = null;
            audio.pause();
            audio.currentTime = 0;
            currentAudio = null;
            isPlaying = false;
            updateAllButtons(-1);
            updateProgressBar(oldIndex, 0);
            playlistIndex = -1;
        }
    }, FADE_DURATION / FADE_STEPS);
}

function stopPlayback() {
    if (fadeOutTimer) { clearInterval(fadeOutTimer); fadeOutTimer = null; }
    if (fadeInTimer) { clearInterval(fadeInTimer); fadeInTimer = null; }
    cancelProgressUpdate();
    if (currentAudio) {
        try { currentAudio.pause(); currentAudio.currentTime = 0; } catch (e) { /* ignore */ }
        currentAudio = null;
    }
    isPlaying = false;
    // 全プログレスバーリセット
    for (let i = 0; i < playlist.length; i++) {
        updateProgressBar(i, 0);
    }
    updateAllButtons(-1);
    playlistIndex = -1;
}

// ---- Progress Bar ----

function updateProgressBar(index, progress) {
    if (index < 0 || index >= playlist.length) return;
    const cardEl = playlist[index].cardEl;
    if (!cardEl) return;
    let bar = cardEl.querySelector('.card-progress-fill');
    if (!bar) return;
    bar.style.width = `${Math.min(progress * 100, 100)}%`;
}

function cancelProgressUpdate() {
    if (progressRAF) { cancelAnimationFrame(progressRAF); progressRAF = null; }
}

// ---- Button State ----

const ICON_PLAY = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
const ICON_PAUSE = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/></svg>';

function updateButton(index, playing) {
    if (index < 0 || index >= playlist.length) return;
    const btn = playlist[index].btnEl;
    if (!btn) return;
    btn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
    if (playing) btn.classList.add('playing');
    else btn.classList.remove('playing');
}

function updateAllButtons(activeIndex) {
    for (let i = 0; i < playlist.length; i++) {
        updateButton(i, i === activeIndex);
    }
}

function setPreviewVolume(vol) {
    if (currentAudio && !currentAudio.paused) {
        currentAudio.volume = vol;
    }
}

function setPreviewMuted(muted) {
    if (currentAudio) {
        currentAudio.muted = muted;
    }
}

// パック開封セッションをキャンセル（画面遷移時に呼ばれる）
function cancelPackSession() {
    packSessionId++;
}

// グローバル参照に登録
if (typeof window !== 'undefined') {
    window.MusicGacha = window.MusicGacha || {};
    window.MusicGacha.stopPreview = stopPlayback;
    window.MusicGacha.setPreviewVolume = setPreviewVolume;
    window.MusicGacha.setPreviewMuted = setPreviewMuted;
    window.MusicGacha.playlistPlayCard = playCard;
    window.MusicGacha.cancelPackSession = cancelPackSession;
}

// ---- Rarity Effect Config ----
const RARITY_EFFECTS = {
    C: { particles: 0, flash: false, color: '#6b7280', glow: false },
    UC: { particles: 0, flash: false, color: '#22c55e', glow: false },
    R: { particles: 8, flash: false, color: '#3b82f6', glow: true },
    SR: { particles: 15, flash: false, color: '#a855f7', glow: true },
    UR: { particles: 30, flash: true, color: '#f59e0b', glow: true },
    LR: { particles: 50, flash: true, color: 'rainbow', glow: true },
};

/**
 * パック開封演出のメインフロー
 * @param {Promise<Array>} cardsPromise - カードデータのPromise
 * @param {boolean} isGold - ゴールドパックか
 */
export async function renderPackOpening(cardsPromise, isGold = false, autoTap = false, isGod = false, hintRarity = null) {
    const container = document.getElementById('pack-opening-container');
    const cardsContainer = document.getElementById('pack-cards-container');
    const packCardsEl = document.getElementById('pack-cards');
    const packVisual = document.getElementById('pack-visual');

    if (!container || !cardsContainer || !packCardsEl) return;

    // 前回のセッションをキャンセルし、新しいセッションIDを発行
    packSessionId++;
    const mySessionId = packSessionId;

    // セッションがキャンセルされたかチェックするヘルパー
    const isCancelled = () => mySessionId !== packSessionId;

    // リセット
    container.style.display = '';
    cardsContainer.style.display = 'none';
    packCardsEl.innerHTML = '';
    resetPlaylist();

    // 前回の分裂アニメーションの残存要素をクリーンアップ
    if (packVisual) {
        const packImage = packVisual.querySelector('.pack-image');
        if (packImage) {
            packImage.style.transition = '';
            packImage.style.opacity = '';
            packImage.style.visibility = '';
        }
        packVisual.querySelectorAll('.pack-split-half, .pack-split-loading, .pack-tear-glow, .pack-tear-spark').forEach(el => el.remove());
        document.querySelectorAll('.pack-split-flash').forEach(el => el.remove());
        packVisual.style.animation = '';
    }

    // ローディング解除（パック画面をすぐ表示するため）
    window.MusicGacha?.hideLoading?.();

    // ゴッドパックスタイル（ゴールドより優先）
    if (isGod && packVisual) {
        packVisual.classList.add('god');
        packVisual.classList.remove('gold');
    } else if (isGold && packVisual) {
        packVisual.classList.add('gold');
        const packTitle = packVisual.querySelector('.pack-title');
        if (packTitle) packTitle.textContent = t('pack.goldPack');
    }

    // パックが表示されるまで待つ
    await delay(300);
    if (isCancelled()) return;

    // 示唆エフェクトをセット（ホバー時にCSSで色が変わる）
    if (hintRarity && packVisual) {
        packVisual.setAttribute('data-hint-rarity', hintRarity);
    }

    // ---- Phase 1: タップ待ち → パック開裂 ----
    return new Promise((resolve) => {
        const packWrapper = document.getElementById('pack-wrapper');

        const handleTap = async () => {
            packWrapper.removeEventListener('click', handleTap);

            if (isCancelled()) { resolve(); return; }

            // 示唆エフェクトをクリーンアップ
            if (packVisual) {
                packVisual.removeAttribute('data-hint-rarity');
            }

            // アニメーションとデータ取得を並行実行
            let cards;
            try {
                const [, fetchedCards] = await Promise.all([
                    isGod ? animateGodPackOpen(packVisual) : animatePackOpen(packVisual),
                    cardsPromise,
                ]);
                cards = fetchedCards;
            } catch (err) {
                console.error('[PackAnimation] Failed to load cards:', err);
                window.MusicGacha?.hideLoading?.();
                window.MusicGacha?.showToast?.('カードの取得に失敗しました', 'error');
                resolve();
                return;
            }

            // ---- Phase 2: カードフリップ ----
            container.style.display = 'none';
            cardsContainer.style.display = '';

            // ゴッドパック: 背景レインボーオーラを追加
            let godAura = null;
            if (isGod) {
                godAura = document.createElement('div');
                godAura.className = 'god-background-aura';
                cardsContainer.appendChild(godAura);
                // 開始フラッシュ
                screenFlash('rainbow');
            }

            // キャンセルチェック
            if (isCancelled()) { resolve(); return; }

            // 最高レアリティを判定
            const maxRarity = getMaxRarity(cards);

            for (let i = 0; i < cards.length; i++) {
                const card = cards[i];
                const cardEl = renderCard(card, {
                    showNew: true,
                    onClick: () => {
                        import('./card-renderer.js').then(m => m.openCardDetail(card));
                    }
                });

                // フリップアニメーション用
                cardEl.classList.add('card-flip');
                packCardsEl.appendChild(cardEl);

                // カードの再生ボタンをプレイリストに登録
                const listenBtn = cardEl.querySelector('.card-listen-btn');
                registerCard(card.previewUrl || null, listenBtn, cardEl, card);

                // プログレスバーをカードに追加
                const progressBar = document.createElement('div');
                progressBar.className = 'card-progress-bar';
                progressBar.innerHTML = '<div class="card-progress-fill"></div>';
                cardEl.appendChild(progressBar);

                // 再生ボタンにプレイリスト経由のハンドラを上書き
                if (listenBtn && card.previewUrl) {
                    // 既存のイベントを除去するためclone
                    const newBtn = listenBtn.cloneNode(true);
                    listenBtn.parentNode.replaceChild(newBtn, listenBtn);
                    // プレイリスト配列のbtnElも更新
                    playlist[playlist.length - 1].btnEl = newBtn;

                    newBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        playCard(newBtn);
                    });
                }

                // 順番にフリップ（ゴッドパックは溜め長め）
                await delay(isGod ? 700 : 500);
                if (isCancelled()) { resolve(); return; }

                cardEl.classList.add('revealed');

                // 最初のカードがめくれたら即座に再生開始
                if (!isPlaying && card.previewUrl) {
                    playAtIndex(playlist.length - 1);
                }

                if (isGod) {
                    // ゴッドパック: 全カードにLR級の豪華エフェクト
                    emitGlow(cardEl, 'LR');
                    emitParticles('LR', 40);
                    screenFlash('rainbow');
                    emitShockwave();
                } else {
                    // 通常: レアリティ別エフェクト
                    const effect = RARITY_EFFECTS[card.rarity];
                    if (effect.glow) {
                        emitGlow(cardEl, card.rarity);
                    }
                    if (effect.particles > 0) {
                        emitParticles(card.rarity, effect.particles);
                    }
                    if (effect.flash) {
                        screenFlash(effect.color);
                    }
                }

                await delay(isGod ? 400 : 300);
                if (isCancelled()) { resolve(); return; }
            }

            // ゴッドパック完了: フィナーレ演出
            if (isGod && godAura) {
                // 最終フィナーレ: 大量パーティクル + 3連衝撃波
                emitParticles('LR', 150);
                screenFlash('rainbow');
                for (let w = 0; w < 3; w++) {
                    setTimeout(() => emitShockwave(), w * 200);
                }
                await delay(1500);
                godAura.remove();
            }

            // ゴッドパックリセット
            if (isGod && packVisual) {
                packVisual.classList.remove('god');
                const packTitle = packVisual.querySelector('.pack-title');
                if (packTitle) packTitle.textContent = 'Music Pack';
            }

            // ゴールドパックリセット
            if (isGold && packVisual) {
                packVisual.classList.remove('gold');
                const packTitle = packVisual.querySelector('.pack-title');
                if (packTitle) packTitle.textContent = 'Music Pack';
            }

            resolve();
        };

        packWrapper.addEventListener('click', handleTap);

        // 自動開封時はタップをスキップ
        if (autoTap) {
            setTimeout(() => handleTap(), 400);
        }
    });
}

// ---- Pack Open Animation ----

/**
 * ギザギザ切断ラインを生成するヘルパー
 * アルミパックを手で破いたような不規則形状のclip-pathを作る
 * @param {number} splitY - 切断位置のパーセント (0-100)
 * @param {number} segments - ギザギザの分割数
 * @param {number} amplitude - ギザギザの振幅 (%)
 * @returns {{topClip: string, bottomClip: string, tearY: number}}
 */
function generateTearLine(splitY = 22, segments = 16, amplitude = 3) {
    const points = [];
    for (let i = 0; i <= segments; i++) {
        const x = (i / segments) * 100;
        // 端は振幅を小さくして自然に
        const edgeFactor = Math.min(i, segments - i) / (segments * 0.3);
        const factor = Math.min(edgeFactor, 1);
        const jitter = (Math.random() - 0.5) * 2 * amplitude * factor;
        points.push({ x, y: splitY + jitter });
    }

    // 上パーツ: 上端→左端→ギザギザ→右端
    const topPoints = [
        '0% 0%', '100% 0%',
        ...points.slice().reverse().map(p => `${p.x}% ${p.y}%`)
    ];
    const topClip = `polygon(${topPoints.join(', ')})`;

    // 下パーツ: ギザギザ→右端→下端→左端
    const bottomPoints = [
        ...points.map(p => `${p.x}% ${p.y}%`),
        '100% 100%', '0% 100%'
    ];
    const bottomClip = `polygon(${bottomPoints.join(', ')})`;

    return { topClip, bottomClip, tearY: splitY };
}

/**
 * 切断ライン沿いに火花パーティクルを放出
 */
function emitTearSparks(packVisual, tearYPercent, count = 12) {
    const rect = packVisual.getBoundingClientRect();
    const tearPixelY = (tearYPercent / 100) * rect.height;

    for (let i = 0; i < count; i++) {
        const spark = document.createElement('div');
        spark.className = 'pack-tear-spark';

        // 切断ライン上のランダム位置
        const startX = Math.random() * rect.width;
        spark.style.left = `${startX}px`;
        spark.style.top = `${tearPixelY}px`;

        // 飛散方向: 上下左右にランダム
        const angle = (Math.random() - 0.5) * Math.PI * 1.5;
        const distance = 40 + Math.random() * 80;
        const dx = Math.cos(angle) * distance;
        const dy = -Math.abs(Math.sin(angle) * distance) - 20; // 上方向バイアス

        spark.style.setProperty('--spark-x', `${dx}px`);
        spark.style.setProperty('--spark-y', `${dy}px`);
        spark.style.setProperty('--spark-duration', `${0.4 + Math.random() * 0.4}s`);

        // サイズと色のバリエーション
        const size = 3 + Math.random() * 5;
        spark.style.width = `${size}px`;
        spark.style.height = `${size}px`;

        if (Math.random() > 0.6) {
            spark.style.background = 'rgba(200, 170, 255, 0.9)';
        }

        packVisual.appendChild(spark);

        // アニメーション開始を少しずらす
        setTimeout(() => {
            spark.classList.add('animate');
        }, i * 15);

        // クリーンアップ
        setTimeout(() => spark.remove(), 1000);
    }
}

async function animatePackOpen(packVisual) {
    if (!packVisual) return;

    const packImage = packVisual.querySelector('.pack-image');
    if (!packImage) return;

    const imgSrc = packImage.src;

    // ---- Phase 1: 揺れ（ポケポケ風の小刻みな揺れ）----
    packVisual.style.transition = 'all 0.15s ease';
    for (let i = 0; i < 5; i++) {
        const angle = (i % 2 === 0 ? 1 : -1) * (2 + Math.random() * 2);
        const scale = 1.03 + Math.random() * 0.03;
        packVisual.style.transform = `rotate(${angle}deg) scale(${scale})`;
        await delay(60 + i * 10);
    }
    packVisual.style.transform = 'scale(1.06)';
    await delay(100);

    // ---- Phase 2: 光る（強化版）----
    packVisual.style.transition = 'filter 0.3s ease';
    packVisual.style.filter = 'drop-shadow(0 0 20px rgba(139, 92, 246, 0.6)) drop-shadow(0 0 40px rgba(236, 72, 153, 0.3))';
    await delay(150);
    packVisual.style.filter = 'drop-shadow(0 0 40px rgba(200, 170, 255, 0.9)) drop-shadow(0 0 70px rgba(139, 92, 246, 0.6)) brightness(1.15)';
    await delay(200);

    // フロートアニメーション停止
    packVisual.style.animation = 'none';

    // ---- Phase 3: ギザギザ切断面を生成 ----
    const { topClip, bottomClip, tearY } = generateTearLine(22, 12, 0.8);

    // 分割パーツ生成
    const topHalf = document.createElement('div');
    topHalf.className = 'pack-split-half pack-split-top';
    topHalf.innerHTML = `<img src="${imgSrc}" alt="" draggable="false">`;
    topHalf.style.clipPath = topClip;

    const bottomHalf = document.createElement('div');
    bottomHalf.className = 'pack-split-half pack-split-bottom';
    bottomHalf.innerHTML = `<img src="${imgSrc}" alt="" draggable="false">`;
    bottomHalf.style.clipPath = bottomClip;

    // 光漏れグロー要素
    const tearGlow = document.createElement('div');
    tearGlow.className = 'pack-tear-glow';
    const rect = packVisual.getBoundingClientRect();
    const packImg = packVisual.querySelector('.pack-image');
    const imgRect = packImg ? packImg.getBoundingClientRect() : rect;
    tearGlow.style.top = `${(tearY / 100) * imgRect.height}px`;

    // ローディング
    const loading = document.createElement('div');
    loading.className = 'pack-split-loading';
    loading.innerHTML = '<div class="pack-split-spinner"></div>';

    // 画面フラッシュ
    const flash = document.createElement('div');
    flash.className = 'pack-split-flash';
    document.body.appendChild(flash);

    // ---- Phase 4: 瞬間的に分割（ポケポケ的なスナップ感）----
    // 元画像を即座に非表示
    packImage.style.transition = 'none';
    packImage.style.opacity = '0';
    packImage.style.visibility = 'hidden';
    void packImage.offsetHeight;

    // パーツをDOMに追加
    packVisual.appendChild(bottomHalf);
    packVisual.appendChild(topHalf);
    packVisual.appendChild(tearGlow);
    packVisual.appendChild(loading);

    // フィルタリセット＆スケールリセット
    packVisual.style.filter = '';
    packVisual.style.transform = '';
    packVisual.style.transition = '';

    // 1フレーム待ってからアニメーション発火
    await delay(30);

    // 同時発火: フラッシュ + 光漏れ + 火花 + 上パーツ飛散 + 下パーツスライド
    flash.classList.add('active');
    tearGlow.classList.add('active');
    topHalf.classList.add('fly-away');
    bottomHalf.classList.add('split');

    // 火花パーティクルを切断ラインに沿って放出
    emitTearSparks(packVisual, tearY, 14);

    // ローディング表示（少し遅延後）
    setTimeout(() => loading.classList.add('visible'), 300);

    // アニメーション完了を待つ
    await delay(900);

    // フラッシュのクリーンアップ
    flash.remove();

    // スタイルリセット
    packVisual.style.transition = '';
    packVisual.style.transform = '';
    packVisual.style.filter = '';
}

/**
 * ゴッドパック専用の開封アニメーション（超豪華演出）
 */
async function animateGodPackOpen(packVisual) {
    if (!packVisual) return;

    const packImage = packVisual.querySelector('.pack-image');
    if (!packImage) return;

    const imgSrc = packImage.src;

    // ========== Phase 1: 画面暗転 ==========
    const dimOverlay = document.createElement('div');
    dimOverlay.className = 'god-dim-overlay';
    document.body.appendChild(dimOverlay);
    await delay(100);
    dimOverlay.classList.add('active');
    await delay(600);

    // ========== Phase 2: 不穏なゆっくり揺れ（緊張感） ==========
    packVisual.style.transition = 'all 0.2s ease';
    for (let i = 0; i < 6; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        const angle = dir * (1 + i * 0.3);
        packVisual.style.transform = `rotate(${angle}deg) scale(1.02)`;
        await delay(250 - i * 20);
    }
    packVisual.style.transform = '';
    await delay(400);

    // ========== Phase 3: 高速の激しい揺れ（爆発的） ==========
    packVisual.style.transition = 'all 0.03s linear';
    for (let i = 0; i < 16; i++) {
        const angle = (i % 2 === 0 ? 1 : -1) * (4 + i * 0.8);
        const scale = 1.05 + i * 0.015;
        const tx = (Math.random() - 0.5) * (i * 1.5);
        const ty = (Math.random() - 0.5) * (i * 1.5);
        packVisual.style.transform = `translate(${tx}px, ${ty}px) rotate(${angle}deg) scale(${scale})`;
        await delay(35);
    }
    packVisual.style.transform = 'scale(1.15)';
    await delay(150);

    // ========== Phase 4: 段階的レインボーグロー ==========
    packVisual.style.transition = 'filter 0.2s ease';

    // 段階1: 赤〜オレンジ
    packVisual.style.filter = `
        drop-shadow(0 0 15px rgba(239, 68, 68, 0.9))
        drop-shadow(0 0 30px rgba(245, 158, 11, 0.6))
    `;
    await delay(200);

    // 段階2: + 緑〜青
    packVisual.style.filter = `
        drop-shadow(0 0 20px rgba(239, 68, 68, 0.9))
        drop-shadow(0 0 40px rgba(245, 158, 11, 0.8))
        drop-shadow(0 0 60px rgba(34, 197, 94, 0.6))
        drop-shadow(0 0 80px rgba(59, 130, 246, 0.5))
    `;
    await delay(200);

    // 段階3: フルレインボー（最大光量）
    packVisual.style.filter = `
        drop-shadow(0 0 25px rgba(239, 68, 68, 1))
        drop-shadow(0 0 50px rgba(245, 158, 11, 0.9))
        drop-shadow(0 0 75px rgba(34, 197, 94, 0.7))
        drop-shadow(0 0 100px rgba(59, 130, 246, 0.6))
        drop-shadow(0 0 130px rgba(168, 85, 247, 0.5))
    `;
    emitParticles('LR', 30);
    await delay(300);

    // ========== Phase 5: 画面ホワイトアウト → 衝撃波 ==========
    const whiteFlash = document.createElement('div');
    whiteFlash.className = 'god-white-flash';
    document.body.appendChild(whiteFlash);
    await delay(100);
    whiteFlash.classList.add('active');
    await delay(300);

    // 衝撃波 x2
    emitShockwave();
    setTimeout(() => emitShockwave(), 300);

    // 画面シェイク
    document.body.classList.add('god-screen-shake');

    await delay(1000);

    // ホワイトフラッシュを消す
    whiteFlash.classList.remove('active');
    setTimeout(() => whiteFlash.remove(), 500);

    // シェイク終了
    document.body.classList.remove('god-screen-shake');

    await delay(300);

    // ========== Phase 6: 分裂 ==========
    packVisual.style.animation = 'none';

    const topHalf = document.createElement('div');
    topHalf.className = 'pack-split-half pack-split-top';
    topHalf.innerHTML = `<img src="${imgSrc}" alt="" draggable="false">`;

    const bottomHalf = document.createElement('div');
    bottomHalf.className = 'pack-split-half pack-split-bottom';
    bottomHalf.innerHTML = `<img src="${imgSrc}" alt="" draggable="false">`;

    const loading = document.createElement('div');
    loading.className = 'pack-split-loading god-loading';
    loading.innerHTML = '<div class="pack-split-spinner god-spinner"></div>';

    packImage.style.transition = 'none';
    packImage.style.opacity = '0';
    packImage.style.visibility = 'hidden';
    void packImage.offsetHeight;

    packVisual.appendChild(topHalf);
    packVisual.appendChild(bottomHalf);
    packVisual.appendChild(loading);

    await delay(50);
    topHalf.classList.add('split');
    bottomHalf.classList.add('split');
    loading.classList.add('visible');

    packVisual.style.filter = '';

    // 分裂直後の大量パーティクル + フラッシュ
    emitParticles('LR', 120);
    screenFlash('rainbow');
    emitShockwave();

    // 暗転解除
    dimOverlay.classList.remove('active');
    setTimeout(() => dimOverlay.remove(), 600);

    await delay(1200);

    packVisual.style.transition = '';
    packVisual.style.transform = '';
    packVisual.style.filter = '';
}

/**
 * 衝撃波エフェクト
 */
function emitShockwave() {
    const wave = document.createElement('div');
    wave.className = 'god-shockwave';
    document.body.appendChild(wave);
    setTimeout(() => wave.remove(), 1000);
}

// ---- Particle System ----

function emitParticles(rarity, count) {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = rarity === 'LR'
        ? ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7']
        : [RARITY_EFFECTS[rarity].color];

    for (let i = 0; i < count; i++) {
        particles.push({
            x: canvas.width / 2 + (Math.random() - 0.5) * 200,
            y: canvas.height / 2 + (Math.random() - 0.5) * 200,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8 - 3,
            size: Math.random() * 6 + 2,
            color: colors[Math.floor(Math.random() * colors.length)],
            life: 1,
            decay: 0.01 + Math.random() * 0.02,
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let alive = false;
        for (const p of particles) {
            if (p.life <= 0) continue;
            alive = true;

            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1; // gravity
            p.life -= p.decay;

            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;

        if (alive) {
            requestAnimationFrame(animate);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    requestAnimationFrame(animate);
}

// ---- Screen Flash ----

function screenFlash(color) {
    const flash = document.createElement('div');
    flash.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 100;
    pointer-events: none;
    animation: flashAnim 0.5s ease-out forwards;
  `;

    if (color === 'rainbow') {
        flash.style.background = 'linear-gradient(135deg, rgba(239,68,68,0.3), rgba(245,158,11,0.3), rgba(34,197,94,0.3), rgba(59,130,246,0.3), rgba(168,85,247,0.3))';
    } else {
        flash.style.background = color.replace(')', ',0.3)').replace('rgb', 'rgba');
        if (!flash.style.background.includes('rgba')) {
            flash.style.background = `${color}4D`; // hex with alpha
        }
    }

    // CSS animation for flash
    const style = document.createElement('style');
    style.textContent = `
    @keyframes flashAnim {
      0% { opacity: 1; }
      100% { opacity: 0; }
    }
  `;
    document.head.appendChild(style);
    document.body.appendChild(flash);

    setTimeout(() => {
        flash.remove();
        style.remove();
    }, 600);
}

// ---- Glow Effect ----

function emitGlow(element, rarity) {
    const effect = RARITY_EFFECTS[rarity];
    if (!effect) return;

    if (rarity === 'LR') {
        element.style.boxShadow = '0 0 30px rgba(239,68,68,0.5), 0 0 60px rgba(168,85,247,0.3), 0 0 90px rgba(59,130,246,0.2)';
    } else {
        element.style.boxShadow = `0 0 30px ${effect.color}80, 0 0 60px ${effect.color}40`;
    }

    setTimeout(() => {
        element.style.boxShadow = '';
    }, 2000);
}

// ---- Helpers ----

function getMaxRarity(cards) {
    const order = { C: 1, UC: 2, R: 3, SR: 4, UR: 5, LR: 6 };
    let max = 'C';
    for (const card of cards) {
        if ((order[card.rarity] || 0) > (order[max] || 0)) {
            max = card.rarity;
        }
    }
    return max;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
