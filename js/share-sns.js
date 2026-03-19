// ============================================================
// MusicGacha - SNS Share Module
// X (Twitter) 共有ユーティリティ + Canvas画像生成
// ============================================================

/**
 * X (Twitter) Web Intent URLを生成して開く
 * @param {string} text - ツイートテキスト
 */
function openXIntent(text) {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'width=550,height=420,noopener');
}

// ---- Canvas画像生成 ----

/**
 * 画像をCORS対応で読み込む（失敗時はnull）
 */
function loadImage(src) {
    return new Promise((resolve) => {
        if (!src || src.startsWith('data:')) {
            resolve(null);
            return;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

/**
 * レアリティの色を返す
 */
function getRarityColor(rarity) {
    const colors = {
        C: '#6b7280',
        UC: '#22c55e',
        R: '#3b82f6',
        SR: '#a855f7',
        UR: '#f59e0b',
        LR: '#ef4444',
    };
    return colors[rarity] || '#6b7280';
}

/**
 * 角丸矩形を描画
 */
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

/**
 * テキストを指定幅に収まるようにトリミング
 */
function trimText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let trimmed = text;
    while (trimmed.length > 0 && ctx.measureText(trimmed + '…').width > maxWidth) {
        trimmed = trimmed.slice(0, -1);
    }
    return trimmed + '…';
}

/**
 * パック結果のカード画像をCanvasで生成
 * @param {Object[]} cards - カード配列
 * @param {string} packType - パックタイプ
 * @param {boolean} isGold - ゴールドパック
 * @param {boolean} isGod - ゴッドパック
 * @returns {Promise<Blob|null>}
 */
async function generatePackResultImage(cards, packType, isGold, isGod) {
    if (!cards || cards.length === 0) return null;

    try {
        // カバー画像を並列読み込み（200x200サイズで取得）
        const coverPromises = cards.map(card => {
            const url = card.coverUrl ? card.coverUrl.replace(/\/\d+x\d+bb\./, '/200x200bb.') : null;
            return loadImage(url);
        });
        const coverImages = await Promise.all(coverPromises);

        // Canvas設定
        const cols = 3;
        const rows = Math.ceil(cards.length / cols);
        const cardW = 240;
        const cardH = 280;
        const gap = 16;
        const padding = 24;
        const headerH = 56;
        const footerH = 48;

        const canvasW = padding * 2 + cols * cardW + (cols - 1) * gap;
        const canvasH = padding + headerH + rows * cardH + (rows - 1) * gap + footerH + padding;

        const canvas = document.createElement('canvas');
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext('2d');

        // 背景
        ctx.fillStyle = '#0d0d0d';
        ctx.fillRect(0, 0, canvasW, canvasH);

        // ヘッダー
        const packNames = {
            top200: 'Top 200', standard: 'オール', jpop: 'J-POP', kpop: 'K-POP',
            vocaloid: 'ボカロ', anime: 'Anime', hiphop: 'Hip-Hop', western: '洋楽',
        };
        let headerText = `📦 ${packNames[packType] || packType} パック`;
        if (isGod) headerText = '⚡ 神パック降臨！！！';
        else if (isGold) headerText = '💰 ゴールドパック開封！';

        ctx.font = 'bold 28px "Outfit", "Inter", sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(headerText, canvasW / 2, padding + 36);

        // カード描画
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = padding + col * (cardW + gap);
            const y = padding + headerH + row * (cardH + gap);

            const rarityColor = getRarityColor(card.rarity);

            // カード背景（角丸）
            ctx.save();
            roundRect(ctx, x, y, cardW, cardH, 16);
            ctx.clip();

            // 暗い背景
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(x, y, cardW, cardH);

            // カバー画像
            const coverImg = coverImages[i];
            if (coverImg) {
                // カバーをカードの上部に描画（正方形にクロップ）
                const coverSize = cardW;
                const coverH = cardW - 30;
                ctx.drawImage(coverImg, 0, 0, coverImg.width, coverImg.height, x, y, coverSize, coverH);

                // グラデーションオーバーレイ（下部を暗く）
                const grad = ctx.createLinearGradient(x, y + coverH - 80, x, y + coverH);
                grad.addColorStop(0, 'rgba(26, 26, 26, 0)');
                grad.addColorStop(1, 'rgba(26, 26, 26, 0.95)');
                ctx.fillStyle = grad;
                ctx.fillRect(x, y + coverH - 80, coverSize, 80);
            } else {
                // プレースホルダー
                ctx.fillStyle = '#2a2a2a';
                ctx.fillRect(x, y, cardW, cardW - 30);
                ctx.font = '40px sans-serif';
                ctx.fillStyle = '#555';
                ctx.textAlign = 'center';
                ctx.fillText('♪', x + cardW / 2, y + (cardW - 30) / 2 + 14);
            }

            // レアリティバッジ
            ctx.font = 'bold 14px "Rajdhani", sans-serif';
            const badgeW = ctx.measureText(card.rarity).width + 16;
            const badgeH = 24;
            const badgeX = x + 10;
            const badgeY = y + 10;
            roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 6);
            ctx.fillStyle = rarityColor;
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText(card.rarity, badgeX + badgeW / 2, badgeY + 17);

            // チャートランクバッジ
            if (card.chartRank) {
                ctx.font = 'bold 12px "Rajdhani", sans-serif';
                const rankText = `No.${card.chartRank}`;
                const rankW = ctx.measureText(rankText).width + 12;
                const rankX = x + cardW - rankW - 10;
                const rankY = y + 10;
                roundRect(ctx, rankX, rankY, rankW, 22, 6);
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.fill();
                ctx.fillStyle = '#f59e0b';
                ctx.textAlign = 'center';
                ctx.fillText(rankText, rankX + rankW / 2, rankY + 16);
            }

            // NEWバッジ
            if (card.isNew) {
                ctx.font = 'bold 11px "Rajdhani", sans-serif';
                const newW = 40;
                const newX = x + cardW - newW - 10;
                const newY = card.chartRank ? y + 36 : y + 10;
                roundRect(ctx, newX, newY, newW, 20, 6);
                ctx.fillStyle = '#22D3EE';
                ctx.fill();
                ctx.fillStyle = '#000';
                ctx.textAlign = 'center';
                ctx.fillText('NEW', newX + newW / 2, newY + 15);
            }

            // 曲名
            const textY = y + cardW - 20;
            ctx.font = 'bold 15px "Outfit", "Inter", sans-serif';
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'left';
            const titleText = trimText(ctx, card.title, cardW - 20);
            ctx.fillText(titleText, x + 10, textY);

            // アーティスト名
            ctx.font = '13px "Inter", sans-serif';
            ctx.fillStyle = '#9a9a9a';
            const artistText = trimText(ctx, card.artist, cardW - 20);
            ctx.fillText(artistText, x + 10, textY + 22);

            ctx.restore();

            // カードのレアリティボーダー（角丸）
            ctx.save();
            roundRect(ctx, x, y, cardW, cardH, 16);
            ctx.strokeStyle = rarityColor;
            ctx.lineWidth = card.rarity === 'LR' ? 3 : card.rarity === 'UR' ? 2.5 : 1.5;
            ctx.globalAlpha = card.rarity === 'C' ? 0.3 : 0.7;
            ctx.stroke();
            ctx.restore();
        }

        // フッター
        const footerY = canvasH - footerH - padding / 2;
        ctx.font = 'bold 20px "Outfit", sans-serif';
        ctx.fillStyle = '#22D3EE';
        ctx.textAlign = 'left';
        ctx.fillText('🎵 MusicGacha', padding, footerY + 30);

        ctx.font = '14px "Inter", sans-serif';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'right';
        ctx.fillText('musicgacha.com', canvasW - padding, footerY + 30);

        // Blob化
        return new Promise((resolve) => {
            canvas.toBlob((blob) => resolve(blob), 'image/png', 1.0);
        });
    } catch (e) {
        console.error('[Share] Canvas image generation failed:', e);
        return null;
    }
}

/**
 * パック開封結果をXに共有（画像付き）
 */
export async function sharePackResult(cards, packType, isGold = false, isGod = false) {
    if (!cards || cards.length === 0) return;

    const packNames = {
        top200: 'Top 200', standard: 'オール', jpop: 'J-POP', kpop: 'K-POP',
        vocaloid: 'ボカロ', anime: 'Anime', hiphop: 'Hip-Hop', western: '洋楽',
    };
    const packName = packNames[packType] || packType;
    const rarityOrder = ['C', 'UC', 'R', 'SR', 'UR', 'LR'];

    let bestCard = cards[0];
    for (const card of cards) {
        if (rarityOrder.indexOf(card.rarity) > rarityOrder.indexOf(bestCard.rarity)) {
            bestCard = card;
        }
    }

    const rarityCounts = {};
    for (const card of cards) {
        rarityCounts[card.rarity] = (rarityCounts[card.rarity] || 0) + 1;
    }
    const rarityText = rarityOrder.filter(r => rarityCounts[r]).map(r => `${r}×${rarityCounts[r]}`).join(', ');

    let header;
    if (isGod) header = '⚡ 神パック降臨！！！';
    else if (isGold) header = '💰 ゴールドパック開封！';
    else if (rarityOrder.indexOf(bestCard.rarity) >= rarityOrder.indexOf('UR')) header = '✨ 激レア降臨！';
    else header = '🎵 パック開封結果';

    const text = [
        header, '',
        `📦 ${packName}パック`,
        `🎵 ${bestCard.rarity}「${bestCard.title} / ${bestCard.artist}」`,
        `内訳: ${rarityText}`, '',
        '#MusicGacha #音楽ガチャ',
        'musicgacha.com',
    ].join('\n');

    // 画像生成
    if (window.MusicGacha?.showToast) {
        window.MusicGacha.showToast('画像を生成中...', 'info', 2000);
    }

    const imageBlob = await generatePackResultImage(cards, packType, isGold, isGod);

    if (imageBlob) {
        const file = new File([imageBlob], 'musicgacha-result.png', { type: 'image/png' });

        // 1. Web Share API（モバイル優先）
        if (navigator.share) {
            try {
                const shareData = { text, files: [file] };
                if (navigator.canShare && navigator.canShare(shareData)) {
                    await navigator.share(shareData);
                    return;
                }
                // ファイル共有非対応ならテキストのみ試行
                await navigator.share({ text });
                return;
            } catch (e) {
                if (e.name === 'AbortError') return;
                console.warn('[Share] Web Share failed:', e);
            }
        }

        // 2. デスクトップ: クリップボードに画像コピー + Xを開く
        try {
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': imageBlob })
            ]);
            if (window.MusicGacha?.showToast) {
                window.MusicGacha.showToast('📷 画像をクリップボードにコピーしました！Xの投稿画面でCtrl+Vで貼り付けてください', 'success', 5000);
            }
            openXIntent(text);
            return;
        } catch (e) {
            console.warn('[Share] Clipboard write failed:', e);
        }

        // 3. フォールバック: テキストのみ
        openXIntent(text);
    } else {
        openXIntent(text);
    }
}

/**
 * 個別カードをXに共有
 */
export function shareCard(card) {
    if (!card) return;
    const rarityNames = {
        LR: '🌈 Legend', UR: '✨ Ultra Rare', SR: '💜 Super Rare',
        R: '💙 Rare', UC: '💚 Uncommon', C: 'Common',
    };
    const lines = [
        '🃏 MusicGachaでゲット！', '',
        `🎵 ${card.title} / ${card.artist}`,
        `⭐ ${rarityNames[card.rarity] || card.rarity}`,
    ];
    if (card.album && card.album !== 'Unknown Album') lines.push(`💿 ${card.album}`);
    lines.push('', '#MusicGacha #音楽ガチャ', 'musicgacha.com');
    openXIntent(lines.join('\n'));
}

/**
 * コレクション統計をXに共有
 */
export function shareCollectionStats(stats) {
    if (!stats) return;
    const { uniqueCount = 0, rarityCounts = {} } = stats;
    const rarityOrder = ['LR', 'UR', 'SR', 'R', 'UC', 'C'];
    const rarityParts = rarityOrder.filter(r => rarityCounts[r] > 0).map(r => `${r}×${rarityCounts[r]}`);
    const rareCount = (rarityCounts['SR'] || 0) + (rarityCounts['UR'] || 0) + (rarityCounts['LR'] || 0);
    const rareRate = uniqueCount > 0 ? ((rareCount / uniqueCount) * 100).toFixed(1) : '0.0';

    const lines = [
        '🎵 MusicGacha コレクション', '',
        `📦 ${uniqueCount}曲収集済み！`,
    ];
    if (rarityParts.length > 0) lines.push(`⭐ ${rarityParts.join(' / ')}`);
    lines.push(`💎 レアカード率: ${rareRate}%`);
    lines.push('', '音楽ガチャで新しい曲と出会おう！', '#MusicGacha #音楽ガチャ', 'musicgacha.com');
    openXIntent(lines.join('\n'));
}

/**
 * TOP200マイルストーン達成をXに共有
 */
export function shareTop200Milestone(count, total = 200) {
    const pct = Math.round((count / total) * 100);
    const lines = [
        '🏆 MusicGacha TOP 200 チャレンジ', '',
        `📊 ${count}/${total}曲コンプリート！(${pct}%)`,
    ];
    if (count >= total) lines.push('🎉 全曲制覇達成！！！');
    else {
        const next = [50, 100, 150, 200].find(m => m > count);
        if (next) lines.push(`次の目標: ${next}曲 🎯`);
    }
    lines.push('', '#MusicGacha #TOP200チャレンジ', 'musicgacha.com');
    openXIntent(lines.join('\n'));
}
