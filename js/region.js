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
    jp: regionEntry('jp', '日本', 'Japan', 'ja', 'JP'),

    // --- 北米 ---
    us: regionEntry('us', 'United States', 'United States', 'en', 'US'),
    ca: regionEntry('ca', 'Canada', 'Canada', 'en', 'CA'),
    mx: regionEntry('mx', 'México', 'Mexico', 'es', 'MX'),

    // --- ヨーロッパ ---
    uk: regionEntry('uk', 'United Kingdom', 'United Kingdom', 'en', 'GB'),
    de: regionEntry('de', 'Deutschland', 'Germany', 'de', 'DE'),
    fr: regionEntry('fr', 'France', 'France', 'fr', 'FR'),
    it: regionEntry('it', 'Italia', 'Italy', 'it', 'IT'),
    es: regionEntry('es', 'España', 'Spain', 'es', 'ES'),
    nl: regionEntry('nl', 'Nederland', 'Netherlands', 'nl', 'NL'),
    be: regionEntry('be', 'Belgique', 'Belgium', 'fr', 'BE'),

    // --- オセアニア ---
    au: regionEntry('au', 'Australia', 'Australia', 'en', 'AU'),

    // --- 南米 ---
    br: regionEntry('br', 'Brasil', 'Brazil', 'pt', 'BR'),
};

/**
 * 国旗画像URLを取得（flagcdn.com CDN）
 */
export function getFlagUrl(regionKey) {
    const config = REGIONS[regionKey];
    if (!config) return '';
    const isoCode = config.itunesCountry.toLowerCase();
    return `https://flagcdn.com/w40/${isoCode}.png`;
}

/**
 * navigator.language からデフォルトリージョンを推定
 * 例: "en-US" → "us", "fr-FR" → "fr", "de" → "de"
 */
const LANG_TO_REGION = {
    'ja': 'jp', 'ja-jp': 'jp',
    'en-us': 'us', 'en-ca': 'ca', 'en-gb': 'uk', 'en-au': 'au',
    'es-mx': 'mx', 'es-es': 'es', 'es': 'es',
    'fr-fr': 'fr', 'fr-be': 'be', 'fr-ca': 'ca', 'fr': 'fr',
    'de-de': 'de', 'de-at': 'de', 'de': 'de',
    'it-it': 'it', 'it': 'it',
    'nl-nl': 'nl', 'nl-be': 'be', 'nl': 'nl',
    'pt-br': 'br', 'pt': 'br',
    'en': 'us',
};

function detectRegionFromBrowser() {
    try {
        const lang = (navigator.language || '').toLowerCase();
        // まず完全一致（例: "en-us"）
        if (LANG_TO_REGION[lang]) return LANG_TO_REGION[lang];
        // 次にベース言語だけで検索（例: "en-gb" が無くても "en" でフォールバック）
        const base = lang.split('-')[0];
        if (LANG_TO_REGION[base]) return LANG_TO_REGION[base];
    } catch (e) { /* ignore */ }
    return 'jp';
}

/**
 * 現在のリージョンを取得
 */
export function getRegion() {
    try {
        const saved = localStorage.getItem(REGION_STORAGE_KEY);
        if (saved && REGIONS[saved]) return saved;
    } catch (e) { /* ignore */ }
    return detectRegionFromBrowser();
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
