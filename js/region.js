// ============================================================
// MusicGacha - Region Module
// リージョン管理（14カ国対応）
// ============================================================

const REGION_STORAGE_KEY = 'musicgacha_region';

/**
 * リージョン設定ヘルパー — ボイラープレート削減
 */
function regionEntry(code, label, labelEn, language, itunesCountry) {
    const suffix = code === 'jp' ? '' : `_${code}`;
    const fileSuffix = code === 'jp' ? '' : `-${code}`;
    return {
        label,
        labelEn,
        language,
        songsFile: `./data/songs${fileSuffix}.json`,
        top200File: `./data/top200-daily${fileSuffix}.json`,
        top200HistoryDir: `./data/top200-history${fileSuffix === '' ? '' : fileSuffix}`,
        packsFile: `./data/packs${fileSuffix}.json`,
        itunesCountry,
        storageSuffix: suffix,
    };
}

export const REGIONS = {
    // --- アジア ---
    jp: regionEntry('jp', '🇯🇵 日本', '🇯🇵 Japan', 'ja', 'JP'),

    // --- 北米 ---
    us: regionEntry('us', '🇺🇸 United States', '🇺🇸 United States', 'en', 'US'),
    ca: regionEntry('ca', '🇨🇦 Canada', '🇨🇦 Canada', 'en', 'CA'),
    mx: regionEntry('mx', '🇲🇽 México', '🇲🇽 Mexico', 'es', 'MX'),

    // --- ヨーロッパ ---
    uk: regionEntry('uk', '🇬🇧 United Kingdom', '🇬🇧 United Kingdom', 'en', 'GB'),
    de: regionEntry('de', '🇩🇪 Deutschland', '🇩🇪 Germany', 'de', 'DE'),
    fr: regionEntry('fr', '🇫🇷 France', '🇫🇷 France', 'fr', 'FR'),
    it: regionEntry('it', '🇮🇹 Italia', '🇮🇹 Italy', 'it', 'IT'),
    es: regionEntry('es', '🇪🇸 España', '🇪🇸 Spain', 'es', 'ES'),
    nl: regionEntry('nl', '🇳🇱 Nederland', '🇳🇱 Netherlands', 'nl', 'NL'),
    be: regionEntry('be', '🇧🇪 Belgique', '🇧🇪 Belgium', 'fr', 'BE'),

    // --- オセアニア ---
    au: regionEntry('au', '🇦🇺 Australia', '🇦🇺 Australia', 'en', 'AU'),

    // --- 南米 ---
    br: regionEntry('br', '🇧🇷 Brasil', '🇧🇷 Brazil', 'pt', 'BR'),
};

/**
 * 現在のリージョンを取得
 */
export function getRegion() {
    try {
        const saved = localStorage.getItem(REGION_STORAGE_KEY);
        if (saved && REGIONS[saved]) return saved;
    } catch (e) { /* ignore */ }
    return 'jp';
}

/**
 * リージョンを設定
 */
export function setRegion(region) {
    if (!REGIONS[region]) {
        console.error(`[Region] Unknown region: ${region}`);
        return;
    }
    localStorage.setItem(REGION_STORAGE_KEY, region);
    console.log(`[Region] Set to: ${region}`);
}

/**
 * 現在のリージョン設定オブジェクトを取得
 */
export function getRegionConfig() {
    return REGIONS[getRegion()];
}

/**
 * リージョンに応じたストレージキーサフィックスを取得
 */
export function getStorageSuffix() {
    return getRegionConfig().storageSuffix;
}
