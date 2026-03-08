// ============================================================
// MusicGacha - Transfer Module
// カード共有リンク生成・受取処理
// ============================================================

import { addCardToCollection } from './storage.js';
import { renderCard } from './card-renderer.js';

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
    return url;
}

// ---- Share Link Parsing ----

/**
 * URLハッシュから共有カードデータをパース
 * @returns {Object|null} カードデータ、なければnull
 */
export function parseShareLink() {
    const hash = window.location.hash;
    if (!hash || !hash.startsWith('#share=')) return null;

    try {
        const base64 = hash.substring('#share='.length);
        const json = decodeURIComponent(escape(atob(base64)));
        const data = JSON.parse(json);

        // 最低限のバリデーション
        if (!data.id || !data.title || !data.artist || !data.rarity) {
            console.warn('[Transfer] Invalid share data: missing required fields');
            return null;
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
        titleEl.textContent = 'カードが届いています！';
    }
    if (subtitleEl) {
        subtitleEl.innerHTML = `<strong>${escapeHtml(cardData.artist)}</strong> - ${escapeHtml(cardData.title)}<br><span class="share-receive-rarity rarity-${cardData.rarity.toLowerCase()}">${cardData.rarity}</span>`;
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

        // ハッシュをクリア
        history.replaceState(null, '', window.location.pathname);

        // トースト
        if (window.MusicGacha?.showToast) {
            window.MusicGacha.showToast(`「${cardData.title}」を受け取りました！`, 'success');
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
