// ============================================================
// MusicGacha - Transfer Module
// カード共有リンク生成・受取処理
// ============================================================

import { addCardToCollection } from './storage.js';
import { renderCard } from './card-renderer.js?v=20260327c';
import { trackTransferSend, trackTransferReceive, checkAchievements } from './achievements.js';
import { t } from './i18n.js';

// ---- Share Link Creation ----

/**
 * カードデータから共有リンクを生成
 * @param {Object} card - カードデータ
 * @returns {string} 共有URL
 */
export function createShareLink(card) {
    // 共有に必要な最小限のデータを抽出
    const shareData = {
        id: card.id,
        title: card.title,
        artist: card.artist,
        originalName: card.originalName || card.title,
        originalArtist: card.originalArtist || card.artist,
        album: card.album,
        year: card.year || null,
        duration: card.duration,
        listeners: card.listeners || 0,
        atk: card.atk,
        def: card.def,
        rarity: card.rarity,
        coverUrl: card.coverUrl || null,
        previewUrl: card.previewUrl || null,
        trackViewUrl: card.trackViewUrl || null,
    };

    const json = JSON.stringify(shareData);
    const base64 = btoa(unescape(encodeURIComponent(json)));
    const url = `${window.location.origin}${window.location.pathname}#share=${base64}`;
    return url;
}

/**
 * 共有リンクをクリップボードにコピー
 * @param {Object} card - カードデータ
 * @returns {Promise<string>} 生成されたURL
 */
export async function copyShareLink(card) {
    const url = createShareLink(card);
    try {
        await navigator.clipboard.writeText(url);
    } catch (e) {
        // フォールバック: テキストエリアを使ったコピー
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }
    trackTransferSend();
    return url;
}

// ---- Share Link Parsing ----

/**
 * URLハッシュから共有カードデータをパース
 * @returns {Object|null} カードデータ、なければnull
 */
// セキュリティ: 共有リンクで許可するレアリティ
const VALID_RARITIES = ['C', 'UC', 'R', 'SR', 'UR', 'LR'];

// セキュリティ: 共有リンクで許可するURLドメイン
const ALLOWED_COVER_DOMAINS = ['is1-ssl.mzstatic.com', 'is2-ssl.mzstatic.com', 'is3-ssl.mzstatic.com', 'is4-ssl.mzstatic.com', 'is5-ssl.mzstatic.com'];
const ALLOWED_PREVIEW_DOMAINS = ['audio-ssl.itunes.apple.com'];
const ALLOWED_TRACKVIEW_DOMAINS = ['music.apple.com', 'itunes.apple.com'];

/**
 * URLが許可されたドメインリストに含まれるかチェック
 * @param {string} url - 検証対象URL
 * @param {string[]} allowedDomains - 許可ドメインリスト
 * @returns {boolean}
 */
function isAllowedUrl(url, allowedDomains) {
    if (!url) return true; // nullは許可
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') return false;
        return allowedDomains.some(domain => parsed.hostname === domain || parsed.hostname.endsWith('.' + domain));
    } catch {
        return false;
    }
}

export function parseShareLink() {
    const hash = window.location.hash;
    if (!hash || !hash.startsWith('#share=')) return null;

    try {
        const base64 = hash.substring('#share='.length);
        // Base64ペイロードの長さ制限（DoS防止: 最大10KB）
        if (base64.length > 10240) {
            console.warn('[Transfer] Share data too large');
            return null;
        }
        const json = decodeURIComponent(escape(atob(base64)));
        const data = JSON.parse(json);

        // 必須フィールドの存在チェック
        if (!data.id || !data.title || !data.artist || !data.rarity) {
            console.warn('[Transfer] Invalid share data: missing required fields');
            return null;
        }

        // 型チェック
        if (typeof data.id !== 'number' || typeof data.title !== 'string' || typeof data.artist !== 'string') {
            console.warn('[Transfer] Invalid share data: wrong types');
            return null;
        }

        // rarity の許可リスト検証（XSS防止）
        if (!VALID_RARITIES.includes(data.rarity)) {
            console.warn('[Transfer] Invalid rarity:', data.rarity);
            return null;
        }

        // 文字列フィールドの長さ制限
        if (data.title.length > 300 || data.artist.length > 300 ||
            (data.album && data.album.length > 300)) {
            console.warn('[Transfer] Share data fields too long');
            return null;
        }

        // URL検証: 不正なドメインのURLはnullに置換（悪意のある外部リンク防止）
        if (data.coverUrl && !isAllowedUrl(data.coverUrl, ALLOWED_COVER_DOMAINS)) {
            console.warn('[Transfer] Invalid coverUrl domain, stripping:', data.coverUrl);
            data.coverUrl = null;
        }
        if (data.previewUrl && !isAllowedUrl(data.previewUrl, ALLOWED_PREVIEW_DOMAINS)) {
            console.warn('[Transfer] Invalid previewUrl domain, stripping:', data.previewUrl);
            data.previewUrl = null;
        }
        if (data.trackViewUrl && !isAllowedUrl(data.trackViewUrl, ALLOWED_TRACKVIEW_DOMAINS)) {
            console.warn('[Transfer] Invalid trackViewUrl domain, stripping:', data.trackViewUrl);
            data.trackViewUrl = null;
        }

        return data;
    } catch (e) {
        console.warn('[Transfer] Failed to parse share link:', e);
        return null;
    }
}

// ---- Share Receive UI ----

/**
 * 受取確認モーダルを表示
 * @param {Object} cardData - 受取カードデータ
 */
function showReceiveModal(cardData) {
    const modal = document.getElementById('share-receive-modal');
    if (!modal) return;

    const cardContainer = modal.querySelector('.share-receive-card');
    const titleEl = modal.querySelector('.share-receive-title');
    const subtitleEl = modal.querySelector('.share-receive-subtitle');
    const btnAccept = modal.querySelector('#btn-share-accept');
    const btnDecline = modal.querySelector('#btn-share-decline');

    // カード表示
    if (cardContainer) {
        cardContainer.innerHTML = '';
        const cardEl = renderCard(cardData, { compact: false });
        cardEl.style.width = '180px';
        cardEl.style.height = '180px';
        cardEl.style.cursor = 'default';
        cardContainer.appendChild(cardEl);
    }

    // テキスト
    if (titleEl) {
        titleEl.textContent = t('share.cardArrived') + ' 🎉';
    }
    if (subtitleEl) {
        // セキュリティ: rarity も escapeHtml() を適用（parseShareLink で許可リスト検証済みだが多層防御）
        const safeRarity = VALID_RARITIES.includes(cardData.rarity) ? cardData.rarity : 'C';
        subtitleEl.innerHTML = `<strong>${escapeHtml(cardData.artist)}</strong> - ${escapeHtml(cardData.title)}<br><span class="share-receive-rarity rarity-${safeRarity.toLowerCase()}">${escapeHtml(safeRarity)}</span><br><span class="share-receive-note">${escapeHtml(t('share.receiveNote'))}</span>`;
    }

    modal.style.display = '';

    // 受け取るボタン
    const onAccept = () => {
        // コレクションに追加
        const card = {
            ...cardData,
            acquiredAt: new Date().toISOString(),
            count: 1,
            packNumber: 0, // 共有で取得
        };
        addCardToCollection(card);

        modal.style.display = 'none';
        cleanup();

        // 実績トラッキング
        trackTransferReceive();
        checkAchievements();

        // ハッシュをクリア
        history.replaceState(null, '', window.location.pathname);

        // トースト
        if (window.MusicGacha?.showToast) {
            window.MusicGacha.showToast(t('toast.cardAdded', { title: cardData.title }), 'success');
        }

        // コレクション画面に遷移
        if (window.MusicGacha?.navigateTo) {
            window.MusicGacha.navigateTo('collection');
        }
    };

    // キャンセルボタン
    const onDecline = () => {
        modal.style.display = 'none';
        cleanup();
        history.replaceState(null, '', window.location.pathname);
    };

    function cleanup() {
        btnAccept?.removeEventListener('click', onAccept);
        btnDecline?.removeEventListener('click', onDecline);
    }

    btnAccept?.addEventListener('click', onAccept);
    btnDecline?.addEventListener('click', onDecline);
}

// ---- Init ----

/**
 * ページロード時に共有リンクをチェック
 */
export function initShareHandler() {
    const cardData = parseShareLink();
    if (cardData) {
        // 少し遅らせてUIが初期化された後に表示
        setTimeout(() => showReceiveModal(cardData), 500);
    }
}

// ---- Utilities ----

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
