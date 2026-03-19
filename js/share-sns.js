// ============================================================
// MusicGacha - SNS Share Module
// X (Twitter) 共有ユーティリティ + 画像キャプチャ
// ============================================================

// ---- html2canvas 遅延ロード ----
let html2canvasLoaded = null;

function loadHtml2Canvas() {
    if (html2canvasLoaded) return html2canvasLoaded;
    html2canvasLoaded = new Promise((resolve, reject) => {
        if (window.html2canvas) {
            resolve(window.html2canvas);
            return;
        }
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s.onload = () => resolve(window.html2canvas);
        s.onerror = () => reject(new Error('html2canvas load failed'));
        document.head.appendChild(s);
    });
    return html2canvasLoaded;
}

/**
 * X (Twitter) Web Intent URLを生成して開く
 * @param {string} text - ツイートテキスト
 */
function openXIntent(text) {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'width=550,height=420,noopener');
}

/**
 * パック開封結果の画像をキャプチャ
 * @returns {Promise<Blob|null>} PNG画像のBlob
 */
async function capturePackResultImage() {
    const packCards = document.getElementById('pack-cards');
    if (!packCards) return null;

    try {
        const h2c = await loadHtml2Canvas();

        const canvas = await h2c(packCards, {
            backgroundColor: '#0d0d0d',
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false,
            // カバー画像のCORS対策
            onclone: (doc) => {
                // クローンされたDOM内の背景画像をそのまま使用
                const clonedCards = doc.getElementById('pack-cards');
                if (clonedCards) {
                    clonedCards.style.padding = '16px';
                }
            }
        });

        // ブランディングバナーを追加した最終画像を作成
        const finalCanvas = document.createElement('canvas');
        const ctx = finalCanvas.getContext('2d');
        const bannerHeight = 60;
        finalCanvas.width = canvas.width;
        finalCanvas.height = canvas.height + bannerHeight;

        // 背景
        ctx.fillStyle = '#0d0d0d';
        ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

        // カード画像を描画
        ctx.drawImage(canvas, 0, 0);

        // ブランディングバナー
        ctx.fillStyle = 'rgba(13, 13, 13, 0.95)';
        ctx.fillRect(0, canvas.height, finalCanvas.width, bannerHeight);

        // ロゴテキスト
        const fontSize = Math.round(finalCanvas.width * 0.035);
        ctx.font = `bold ${fontSize}px 'Rajdhani', 'Outfit', sans-serif`;
        ctx.fillStyle = '#22D3EE';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎵 MusicGacha', 24, canvas.height + bannerHeight / 2);

        // URL
        ctx.font = `${Math.round(fontSize * 0.7)}px 'Inter', sans-serif`;
        ctx.fillStyle = '#9a9a9a';
        ctx.textAlign = 'right';
        ctx.fillText('musicgacha.com', finalCanvas.width - 24, canvas.height + bannerHeight / 2);

        return new Promise((resolve) => {
            finalCanvas.toBlob((blob) => resolve(blob), 'image/png', 1.0);
        });
    } catch (e) {
        console.warn('[Share] Image capture failed:', e);
        return null;
    }
}

/**
 * パック開封結果をXに共有（画像付き）
 * @param {Object[]} cards - 開封されたカード配列
 * @param {string} packType - パックタイプ
 * @param {boolean} isGold - ゴールドパックか
 * @param {boolean} isGod - ゴッドパックか
 */
export async function sharePackResult(cards, packType, isGold = false, isGod = false) {
    if (!cards || cards.length === 0) return;

    // パックタイプ表示名
    const packNames = {
        top200: 'Top 200',
        standard: 'オール',
        jpop: 'J-POP',
        kpop: 'K-POP',
        vocaloid: 'ボカロ',
        anime: 'Anime',
        hiphop: 'Hip-Hop',
        western: '洋楽',
    };
    const packName = packNames[packType] || packType;

    // 最高レアリティのカードを特定
    const rarityOrder = ['C', 'UC', 'R', 'SR', 'UR', 'LR'];
    let bestCard = cards[0];
    for (const card of cards) {
        if (rarityOrder.indexOf(card.rarity) > rarityOrder.indexOf(bestCard.rarity)) {
            bestCard = card;
        }
    }

    // レアリティ集計
    const rarityCounts = {};
    for (const card of cards) {
        rarityCounts[card.rarity] = (rarityCounts[card.rarity] || 0) + 1;
    }
    const rarityText = rarityOrder
        .filter(r => rarityCounts[r])
        .map(r => `${r}×${rarityCounts[r]}`)
        .join(', ');

    // ヘッダー（パック種別で変化）
    let header;
    if (isGod) {
        header = '⚡ 神パック降臨！！！';
    } else if (isGold) {
        header = '💰 ゴールドパック開封！';
    } else if (rarityOrder.indexOf(bestCard.rarity) >= rarityOrder.indexOf('UR')) {
        header = '✨ 激レア降臨！';
    } else {
        header = '🎵 パック開封結果';
    }

    const bestLine = `🎵 ${bestCard.rarity}「${bestCard.title} / ${bestCard.artist}」`;

    const text = [
        `${header}`,
        ``,
        `📦 ${packName}パック`,
        bestLine,
        `内訳: ${rarityText}`,
        ``,
        `#MusicGacha #音楽ガチャ`,
        `musicgacha.com`,
    ].join('\n');

    // 画像キャプチャを試行
    if (window.MusicGacha?.showToast) {
        window.MusicGacha.showToast('画像を準備中...', 'info', 2000);
    }

    const imageBlob = await capturePackResultImage();

    if (imageBlob) {
        // Web Share API が画像対応しているか確認
        const file = new File([imageBlob], 'musicgacha-result.png', { type: 'image/png' });
        const shareData = { text, files: [file] };

        if (navigator.canShare && navigator.canShare(shareData)) {
            try {
                await navigator.share(shareData);
                return; // 共有成功
            } catch (e) {
                if (e.name === 'AbortError') return; // ユーザーキャンセル
                console.warn('[Share] Web Share failed, falling back:', e);
            }
        }

        // Web Share非対応: 画像ダウンロード + Xテキスト投稿
        downloadBlob(imageBlob, 'musicgacha-result.png');
        if (window.MusicGacha?.showToast) {
            window.MusicGacha.showToast('📷 画像を保存しました！Xの投稿画面に貼り付けてください', 'success', 4000);
        }
        openXIntent(text);
    } else {
        // 画像キャプチャ失敗時はテキストのみ
        openXIntent(text);
    }
}

/**
 * Blobをファイルとしてダウンロード
 */
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

/**
 * 個別カードをXに共有
 * @param {Object} card - カードデータ
 */
export function shareCard(card) {
    if (!card) return;

    const rarityNames = {
        LR: '🌈 Legend',
        UR: '✨ Ultra Rare',
        SR: '💜 Super Rare',
        R: '💙 Rare',
        UC: '💚 Uncommon',
        C: 'Common',
    };
    const rarityDisplay = rarityNames[card.rarity] || card.rarity;

    const lines = [
        `🃏 MusicGachaでゲット！`,
        ``,
        `🎵 ${card.title} / ${card.artist}`,
        `⭐ ${rarityDisplay}`,
    ];

    if (card.album && card.album !== 'Unknown Album') {
        lines.push(`💿 ${card.album}`);
    }

    lines.push('');
    lines.push('#MusicGacha #音楽ガチャ');
    lines.push('musicgacha.com');

    openXIntent(lines.join('\n'));
}

/**
 * コレクション統計をXに共有
 * @param {Object} stats - { uniqueCount, totalCount, rarityCounts }
 */
export function shareCollectionStats(stats) {
    if (!stats) return;

    const { uniqueCount = 0, totalCount = 0, rarityCounts = {} } = stats;

    // レアリティ内訳
    const rarityOrder = ['LR', 'UR', 'SR', 'R', 'UC', 'C'];
    const rarityParts = rarityOrder
        .filter(r => rarityCounts[r] && rarityCounts[r] > 0)
        .map(r => `${r}×${rarityCounts[r]}`);
    const rarityLine = rarityParts.length > 0 ? rarityParts.join(' / ') : '';

    // レアカード率（SR以上）
    const rareCount = (rarityCounts['SR'] || 0) + (rarityCounts['UR'] || 0) + (rarityCounts['LR'] || 0);
    const rareRate = uniqueCount > 0 ? ((rareCount / uniqueCount) * 100).toFixed(1) : '0.0';

    const lines = [
        `🎵 MusicGacha コレクション`,
        ``,
        `📦 ${uniqueCount}曲収集済み！`,
    ];

    if (rarityLine) {
        lines.push(`⭐ ${rarityLine}`);
    }
    lines.push(`💎 レアカード率: ${rareRate}%`);
    lines.push('');
    lines.push('音楽ガチャで新しい曲と出会おう！');
    lines.push('#MusicGacha #音楽ガチャ');
    lines.push('musicgacha.com');

    openXIntent(lines.join('\n'));
}

/**
 * TOP200マイルストーン達成をXに共有
 * @param {number} count - 取得済み曲数
 * @param {number} total - 全曲数
 */
export function shareTop200Milestone(count, total = 200) {
    const percentage = Math.round((count / total) * 100);

    const lines = [
        `🏆 MusicGacha TOP 200 チャレンジ`,
        ``,
        `📊 ${count}/${total}曲コンプリート！(${percentage}%)`,
    ];

    if (count >= total) {
        lines.push(`🎉 全曲制覇達成！！！`);
    } else {
        // 次のマイルストーン
        const milestones = [50, 100, 150, 200];
        const next = milestones.find(m => m > count);
        if (next) {
            lines.push(`次の目標: ${next}曲 🎯`);
        }
    }

    lines.push('');
    lines.push('#MusicGacha #TOP200チャレンジ');
    lines.push('musicgacha.com');

    openXIntent(lines.join('\n'));
}
