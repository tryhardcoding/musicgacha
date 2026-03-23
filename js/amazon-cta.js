// ============================================================
// MusicGacha - Amazon Music CTA Module
// プレビュー終了時のAmazon Music誘導バナー
// ============================================================

import { getAmazonMusicUrl } from './affiliate.js';

let ctaTimer = null;
let currentBanner = null;

/**
 * Amazon Music CTAバナーを表示
 * @param {Object} card - カードデータ { artist, title }
 */
export function showAmazonCta(card) {
    // 既存バナーがあれば削除
    hideAmazonCta();

    if (!card) return;

    const amazonUrl = getAmazonMusicUrl(card);

    const banner = document.createElement('div');
    banner.className = 'amazon-cta-banner';
    banner.innerHTML = `
        <a href="${amazonUrl}" target="_blank" rel="noopener" class="amazon-cta-link">
            <span class="amazon-cta-text">
                <span class="amazon-cta-label">🎧 ${window.MusicGacha?.t ? window.MusicGacha.t("amazon.listenFull") : "🎧 Listen in full"}</span>
                <span class="amazon-cta-song">${escapeHtml(card.title)} - ${escapeHtml(card.artist)}</span>
            </span>
            <span class="amazon-cta-badge">Amazon Music →</span>
        </a>
        <button class="amazon-cta-close" aria-label="Close">✕</button>
    `;

    // 閉じるボタン
    banner.querySelector('.amazon-cta-close').addEventListener('click', (e) => {
        e.stopPropagation();
        hideAmazonCta();
    });

    document.body.appendChild(banner);
    currentBanner = banner;

    // アニメーション開始（1フレーム待つ）
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            banner.classList.add('visible');
        });
    });

    // 8秒後に自動フェードアウト
    ctaTimer = setTimeout(() => {
        hideAmazonCta();
    }, 8000);
}

/**
 * CTAバナーを非表示
 */
export function hideAmazonCta() {
    if (ctaTimer) {
        clearTimeout(ctaTimer);
        ctaTimer = null;
    }

    if (currentBanner) {
        currentBanner.classList.remove('visible');
        currentBanner.classList.add('hiding');
        const banner = currentBanner;
        currentBanner = null;
        setTimeout(() => {
            banner.remove();
        }, 400);
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
