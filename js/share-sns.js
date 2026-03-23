import { t } from './i18n.js';
// ============================================================
// MusicGacha - SNS Share Module
// X (Twitter) 共有ユーティリティ
// ============================================================

import { trackShare } from './achievements.js';

// レアリティ→色付き四角絵文字マッピング
const RARITY_EMOJI = { C: '⬜', UC: '🟩', R: '🟦', SR: '🟪', UR: '🟨', LR: '🟧' };

/**
 * X (Twitter) Web Intent URLを生成して開く
 * @param {string} text - ツイートテキスト
 */
function openXIntent(text) {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'width=550,height=420,noopener');
    trackShare();
}

/**
 * パック開封結果をXに共有
 */
export function sharePackResult(cards, packType, isGold = false, isGod = false) {
    if (!cards || cards.length === 0) return;

    const packNames = {
        top200: t('pack.top200'), standard: t('pack.standard'), jpop: t('pack.jpop'), kpop: t('pack.kpop'),
        vocaloid: t('pack.vocaloid'), anime: t('pack.anime'), hiphop: t('pack.hiphop'), western: t('pack.western'),
    };
    const packName = packNames[packType] || packType;
    const rarityOrder = ['C', 'UC', 'R', 'SR', 'UR', 'LR'];

    let header;
    const bestRarity = cards.reduce((best, c) =>
        rarityOrder.indexOf(c.rarity) > rarityOrder.indexOf(best) ? c.rarity : best, cards[0].rarity);
    if (isGod) header = t('share.godPack');
    else if (isGold) header = t('share.rareSong');
    else if (rarityOrder.indexOf(bestRarity) >= rarityOrder.indexOf('UR')) header = t('share.rareSong');
    else header = t('share.gachaResult');

    // X文字数カウント: URL=23固定、日本語等=2、ASCII=1
    function xCharCount(str) {
        let count = 0;
        for (const ch of str) {
            count += ch.charCodeAt(0) > 127 ? 2 : 1;
        }
        return count;
    }

    // 固定部分を先に構築
    const footer = t('share.footerWithUrl');
    const headerLine = `${header}\n📦 ${packName}\n`;
    // URL=23固定, ハッシュタグと改行の文字数
    const fixedCost = xCharCount(headerLine) + xCharCount(t('share.footer')) + 23;

    // 残り文字数で曲リストを構築
    const maxTotal = 280;
    const available = maxTotal - fixedCost;

    // 各カードの情報を構造化（プレフィックスと本文を分離）
    const ellipsis = '…';
    const ellipsisCost = xCharCount(ellipsis);
    const cardInfos = cards.map(card => {
        const prefix = `${RARITY_EMOJI[card.rarity] || '⬜'}${card.rarity}｜`;
        const body = `${card.title} / ${card.artist}`;
        return { prefix, body, prefixCost: xCharCount(prefix), bodyCost: xCharCount(body) };
    });

    // 全行の合計コスト（改行含む）を計算
    const newlineCosts = cards.length; // 各行の改行分
    const totalPrefixCost = cardInfos.reduce((sum, c) => sum + c.prefixCost, 0);
    const totalBodyCost = cardInfos.reduce((sum, c) => sum + c.bodyCost, 0);
    const totalCost = totalPrefixCost + totalBodyCost + newlineCosts;

    let finalLines;
    if (totalCost <= available) {
        // 全曲そのまま収まる
        finalLines = cardInfos.map(c => `${c.prefix}${c.body}`);
    } else {
        // 長い曲名を均等にトリミング: 全行の本文に共通の上限文字数を設定
        // 二分探索で最適な上限を見つける
        let lo = 4, hi = Math.max(...cardInfos.map(c => c.bodyCost));
        while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            // この上限でのコストを計算
            let cost = newlineCosts;
            for (const c of cardInfos) {
                cost += c.prefixCost;
                if (c.bodyCost <= mid) {
                    cost += c.bodyCost;
                } else {
                    cost += mid + ellipsisCost; // トリミング時は省略記号分も加算
                }
            }
            if (cost <= available) {
                lo = mid;
            } else {
                hi = mid - 1;
            }
        }
        const maxBodyCost = lo;

        // 上限に基づいて各行をトリミング
        finalLines = cardInfos.map(c => {
            if (c.bodyCost <= maxBodyCost) {
                return `${c.prefix}${c.body}`;
            }
            // 本文をmaxBodyCostに収まるようトリミング
            let trimmed = c.body;
            while (xCharCount(trimmed) > maxBodyCost && trimmed.length > 1) {
                trimmed = trimmed.slice(0, -1);
            }
            return `${c.prefix}${trimmed}${ellipsis}`;
        });
    }

    // 安全ネット: 最終テキストがmaxTotalを超過していないか再検証
    // URL部分(musicgacha.com)を23文字として計算
    let textWithoutUrl = headerLine + finalLines.join('\n') + '\n\n#MusicGacha #音楽ガチャ\n';
    let safeTotal = xCharCount(textWithoutUrl) + 23;

    if (safeTotal > maxTotal) {
        // 最も長いbodyを持つ行から1文字ずつ削って280に収める
        // finalLinesとcardInfosの対応を保持して修正
        const bodyTexts = cardInfos.map((c, i) => {
            const line = finalLines[i];
            return line.startsWith(c.prefix) ? line.slice(c.prefix.length).replace(/…$/, '') : line;
        });
        const isEllipsized = finalLines.map(l => l.endsWith(ellipsis));

        while (safeTotal > maxTotal) {
            // 最もbodyが長い行のインデックスを見つける
            let longestIdx = 0, longestCost = 0;
            for (let i = 0; i < bodyTexts.length; i++) {
                const cost = xCharCount(bodyTexts[i]);
                if (cost > longestCost) {
                    longestCost = cost;
                    longestIdx = i;
                }
            }
            if (longestCost <= 1) break; // これ以上短くできない
            // 1文字削る
            bodyTexts[longestIdx] = bodyTexts[longestIdx].slice(0, -1);
            isEllipsized[longestIdx] = true;
            // 再構築して再計算
            finalLines = cardInfos.map((c, i) =>
                `${c.prefix}${bodyTexts[i]}${isEllipsized[i] ? ellipsis : ''}`
            );
            textWithoutUrl = headerLine + finalLines.join('\n') + '\n\n#MusicGacha #音楽ガチャ\n';
            safeTotal = xCharCount(textWithoutUrl) + 23;
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
        t('share.gotOnMusicGacha'), '',
        `🎵 ${card.title} / ${card.artist}`,
        `${RARITY_EMOJI[card.rarity] || '⬜'} ${rarityNames[card.rarity] || card.rarity}`,
    ];
    if (card.album && card.album !== 'Unknown Album') lines.push(`💿 ${card.album}`);
    lines.push('', t('share.hashtags'), 'musicgacha.com');
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

    const lines = [t('share.collectionTitle'), '', `📦 ${uniqueCount} ${t('share.songsCollected')}`];
    if (rarityParts.length > 0) lines.push(`⭐ ${rarityParts.join(' / ')}`);
    lines.push(`💎 ${t('share.rareRate')}: ${rareRate}%`, '', t('share.discoverMusic'), '#MusicGacha #音楽ガチャ', 'musicgacha.com');
    openXIntent(lines.join('\n'));
}

/**
 * TOP200マイルストーン達成をXに共有
 */
export function shareTop200Milestone(count, total = 200, chartDate = null) {
    const pct = Math.round((count / total) * 100);
    const dateStr = chartDate || new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    const lines = [t('share.top200Title'), `📅 ${dateStr} TOP 200`, '', `📊 ${count}/${total} ${t('share.completed')} (${pct}%)`];
    if (count >= total) lines.push(t('share.allComplete'));
    else {
        const next = [50, 100, 150, 200].find(m => m > count);
        if (next) lines.push(`${t('share.nextGoal', { next })} 🎯`);
    }
    lines.push('', t('share.top200Hashtags'), 'musicgacha.com');
    openXIntent(lines.join('\n'));
}
