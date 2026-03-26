// ============================================================
// MusicGacha - Icons Module
// Lucide Icons ヘルパー（SVGアイコン生成）
// ============================================================

/**
 * Lucide SVGアイコンのインラインHTML文字列を生成
 * @param {string} name - Lucideアイコン名（例: 'music', 'home'）
 * @param {Object} opts - { size: number, class: string, strokeWidth: number }
 * @returns {string} SVG HTML文字列
 */
export function icon(name, opts = {}) {
    const size = opts.size || 18;
    const cls = opts.class || '';
    const sw = opts.strokeWidth || 2;
    return `<i data-lucide="${name}" class="lucide-icon ${cls}" style="width:${size}px;height:${size}px;" data-lucide-stroke-width="${sw}"></i>`;
}

/**
 * 動的に挿入されたアイコンを再描画（Lucide createIcons 呼び出し）
 */
export function refreshIcons() {
    if (!window.lucide) return;
    // requestIdleCallback: メインスレッドが空いた時にアイコンを描画（TBT改善）
    const run = () => window.lucide.createIcons();
    if ('requestIdleCallback' in window) {
        requestIdleCallback(run, { timeout: 200 });
    } else {
        setTimeout(run, 0);
    }
}

// ---- パック → アイコン名マッピング ----
export const PACK_ICONS = {
    jpop: 'flower-2',
    kpop: 'gem',
    vocaloid: 'mic',
    anime: 'sparkles',
    hiphop: 'headphones',
    western: 'globe',
    top200: 'trophy',
    standard: 'disc-3',
};

// ---- ジャンル → アイコン名マッピング ----
export const GENRE_ICONS = {
    'Rock': 'guitar',
    'Pop': 'mic',
    'Hip-Hop': 'headphones',
    'R&B': 'music',
    'Electronic': 'sliders-horizontal',
    'Jazz': 'music',
    'Classical': 'music',
    'Country': 'wheat',
    'Metal': 'zap',
    'Punk': 'zap',
    'Blues': 'music',
    'Reggae': 'palm-tree',
    'Latin': 'flame',
    'Folk': 'guitar',
    'Soul': 'heart',
    'Funk': 'disc',
    'Indie': 'moon',
    'Alternative': 'sparkle',
    'J-Pop': 'flower-2',
    'K-Pop': 'gem',
    'World': 'globe',
    'Soundtrack': 'clapperboard',
    'Unknown': 'music',
};
