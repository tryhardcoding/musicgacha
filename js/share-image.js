// ============================================================
// MusicGacha - Share Image Generator
// Canvas APIでガチャ結果画像を生成
// ============================================================

import { t } from './i18n.js';

const BRAND = {
    bg: '#0d0d0d',
    teal: '#22D3EE',
    orange: '#FF6B35',
    cardBg: '#1a1a2e',
    text: '#e8e8e8',
    subtext: '#888',
};

const RARITY_COLORS = {
    C: '#aaa', UC: '#4ade80', R: '#3b82f6',
    SR: '#a855f7', UR: '#facc15', LR: '#ff6b35',
};

/**
 * ガチャ結果画像をCanvasで生成
 * @param {Array} cards - カード配列
 * @param {string} packType - パックタイプ
 * @param {boolean} isGold - ゴールドパック
 * @returns {Promise<Blob>} PNG画像のBlob
 */
export async function generateShareImage(cards, packType, isGold = false) {
    const W = 1080, H = 1080;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // 背景
    ctx.fillStyle = BRAND.bg;
    ctx.fillRect(0, 0, W, H);

    // グラデーションオーバーレイ
    const grad = ctx.createRadialGradient(W / 2, 200, 0, W / 2, 200, 600);
    grad.addColorStop(0, 'rgba(34, 211, 238, 0.08)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // ヘッダー
    ctx.fillStyle = BRAND.teal;
    ctx.font = 'bold 48px Inter, sans-serif';
    ctx.textAlign = 'center';
    const title = isGold ? '✨ Gold Pack ✨' : 'MusicGacha';
    ctx.fillText(title, W / 2, 80);

    // パック名
    ctx.fillStyle = BRAND.subtext;
    ctx.font = '28px Inter, sans-serif';
    ctx.fillText(`📦 ${packType}`, W / 2, 125);

    // カード一覧
    const startY = 170;
    const cardH = Math.min(130, (H - startY - 120) / Math.min(cards.length, 6));

    cards.slice(0, 6).forEach((card, i) => {
        const y = startY + i * cardH;
        const rarityColor = RARITY_COLORS[card.rarity] || '#aaa';

        // カード背景
        ctx.fillStyle = BRAND.cardBg;
        roundRect(ctx, 60, y, W - 120, cardH - 10, 12);
        ctx.fill();

        // レアリティバー
        ctx.fillStyle = rarityColor;
        roundRect(ctx, 60, y, 6, cardH - 10, 3);
        ctx.fill();

        // レアリティバッジ
        ctx.fillStyle = rarityColor;
        ctx.font = 'bold 20px Rajdhani, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(card.rarity, 85, y + 32);

        // 曲名
        ctx.fillStyle = BRAND.text;
        ctx.font = 'bold 24px Inter, sans-serif';
        const maxTitleW = W - 300;
        ctx.fillText(truncate(ctx, card.title, maxTitleW), 150, y + 32);

        // アーティスト
        ctx.fillStyle = BRAND.subtext;
        ctx.font = '20px Inter, sans-serif';
        ctx.fillText(truncate(ctx, card.artist, maxTitleW), 150, y + 60);

        // アルバムアート（プレースホルダー）
        ctx.fillStyle = rarityColor + '30';
        roundRect(ctx, W - 150, y + 5, cardH - 20, cardH - 20, 8);
        ctx.fill();
    });

    // フッター
    const footerY = H - 60;
    ctx.fillStyle = BRAND.teal;
    ctx.font = 'bold 24px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('musicgacha.com', W / 2, footerY);

    ctx.fillStyle = BRAND.subtext;
    ctx.font = '18px Inter, sans-serif';
    ctx.fillText('#MusicGacha', W / 2, footerY + 30);

    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

/**
 * 画像をダウンロード or Web Share APIで共有
 */
export async function shareWithImage(cards, packType, isGold = false) {
    const blob = await generateShareImage(cards, packType, isGold);
    const file = new File([blob], 'musicgacha-result.png', { type: 'image/png' });

    // Web Share API対応ブラウザではネイティブ共有
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                title: 'MusicGacha',
                text: t('share.gachaResult'),
                files: [file],
            });
            return true;
        } catch (e) {
            if (e.name === 'AbortError') return false;
        }
    }

    // フォールバック: ダウンロード
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'musicgacha-result.png';
    a.click();
    URL.revokeObjectURL(url);
    return true;
}

// ── Helpers ──

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
}

function truncate(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    while (text.length > 1 && ctx.measureText(text + '…').width > maxW) {
        text = text.slice(0, -1);
    }
    return text + '…';
}
