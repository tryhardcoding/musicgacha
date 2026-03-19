// ============================================================
// MusicGacha - SNS Share Module
// X (Twitter) 共有ユーティリティ
// ============================================================

/**
 * X (Twitter) Web Intent URLを生成して開く
 * @param {string} text - ツイートテキスト
 */
function openXIntent(text) {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'width=550,height=420,noopener');
}

/**
 * パック開封結果をXに共有
 */
export function sharePackResult(cards, packType, isGold = false, isGod = false) {
    if (!cards || cards.length === 0) return;

    const packNames = {
        top200: 'Top 200', standard: 'オール', jpop: 'J-POP', kpop: 'K-POP',
        vocaloid: 'ボカロ', anime: 'Anime', hiphop: 'Hip-Hop', western: '洋楽',
    };
    const packName = packNames[packType] || packType;
    const rarityOrder = ['C', 'UC', 'R', 'SR', 'UR', 'LR'];

    let header;
    const bestRarity = cards.reduce((best, c) =>
        rarityOrder.indexOf(c.rarity) > rarityOrder.indexOf(best) ? c.rarity : best, cards[0].rarity);
    if (isGod) header = '⚡ 神パック降臨！！！';
    else if (isGold) header = '💰 ゴールドパック開封！';
    else if (rarityOrder.indexOf(bestRarity) >= rarityOrder.indexOf('UR')) header = '✨ 激レア降臨！';
    else header = '🎵 パック開封結果';

    // X文字数カウント: URL=23固定、日本語等=2、ASCII=1
    function xCharCount(str) {
        let count = 0;
        for (const ch of str) {
            count += ch.charCodeAt(0) > 127 ? 2 : 1;
        }
        return count;
    }

    // 固定部分を先に構築
    const footer = '\n\n#MusicGacha #音楽ガチャ\nmusicgacha.com';
    const headerLine = `${header}\n📦 ${packName}パック\n`;
    // URL=23固定, ハッシュタグと改行の文字数
    const fixedCost = xCharCount(headerLine) + xCharCount('\n\n#MusicGacha #音楽ガチャ\n') + 23;

    // 残り文字数で曲リストを構築
    const maxTotal = 280;
    let remaining = maxTotal - fixedCost;

    // 各カードの行を生成（レアリティ + 曲名 / アーティスト）
    const cardLines = cards.map(card => {
        return `${card.rarity}｜${card.title} / ${card.artist}`;
    });

    // 文字数に収まるようにトリミング（後ろのカードの曲名から短縮）
    const finalLines = [];
    for (let i = 0; i < cardLines.length; i++) {
        let line = cardLines[i];
        const lineCost = xCharCount(line) + 1; // +1 for newline

        if (remaining >= lineCost) {
            finalLines.push(line);
            remaining -= lineCost;
        } else {
            // 残り文字数に収まるようトリミング
            const prefix = `${cards[i].rarity}｜`;
            const ellipsis = '…';
            const prefixCost = xCharCount(prefix);
            const availableForTitle = remaining - prefixCost - xCharCount(ellipsis) - 1;

            if (availableForTitle > 4) {
                // タイトルを短縮して入れる
                let trimmed = `${cards[i].title} / ${cards[i].artist}`;
                while (xCharCount(trimmed) > availableForTitle && trimmed.length > 1) {
                    trimmed = trimmed.slice(0, -1);
                }
                finalLines.push(`${prefix}${trimmed}${ellipsis}`);
                remaining = 0;
            } else {
                // もう入らない → 残り曲数表示
                const left = cardLines.length - i;
                finalLines.push(`...他${left}曲`);
                break;
            }
        }
    }

    const text = headerLine + finalLines.join('\n') + footer;
    openXIntent(text);
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

    const lines = ['🎵 MusicGacha コレクション', '', `📦 ${uniqueCount}曲収集済み！`];
    if (rarityParts.length > 0) lines.push(`⭐ ${rarityParts.join(' / ')}`);
    lines.push(`💎 レアカード率: ${rareRate}%`, '', '音楽ガチャで新しい曲と出会おう！', '#MusicGacha #音楽ガチャ', 'musicgacha.com');
    openXIntent(lines.join('\n'));
}

/**
 * TOP200マイルストーン達成をXに共有
 */
export function shareTop200Milestone(count, total = 200) {
    const pct = Math.round((count / total) * 100);
    const lines = ['🏆 MusicGacha TOP 200 チャレンジ', '', `📊 ${count}/${total}曲コンプリート！(${pct}%)`];
    if (count >= total) lines.push('🎉 全曲制覇達成！！！');
    else {
        const next = [50, 100, 150, 200].find(m => m > count);
        if (next) lines.push(`次の目標: ${next}曲 🎯`);
    }
    lines.push('', '#MusicGacha #TOP200チャレンジ', 'musicgacha.com');
    openXIntent(lines.join('\n'));
}
