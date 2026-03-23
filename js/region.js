// ============================================================
// MusicGacha - Region Module
// リージョン管理（JP / US / UK）
// ============================================================

const REGION_STORAGE_KEY = 'musicgacha_region';

export const REGIONS = {
    jp: {
        label: '🇯🇵 日本',
        labelEn: '🇯🇵 Japan',
        language: 'ja',
        songsFile: './data/songs.json',
        top200File: './data/top200-daily.json',
        packsFile: './data/packs.json',
        itunesCountry: 'JP',
        storageSuffix: '', // JP は後方互換のためサフィックスなし
    },
    us: {
        label: '🇺🇸 United States',
        labelEn: '🇺🇸 United States',
        language: 'en',
        songsFile: './data/songs-us.json',
        top200File: './data/top200-daily-us.json',
        packsFile: './data/packs-us.json',
        itunesCountry: 'US',
        storageSuffix: '_us',
    },
    uk: {
        label: '🇬🇧 United Kingdom',
        labelEn: '🇬🇧 United Kingdom',
        language: 'en',
        songsFile: './data/songs-uk.json',
        top200File: './data/top200-daily-uk.json',
        packsFile: './data/packs-uk.json',
        itunesCountry: 'GB',
        storageSuffix: '_uk',
    },
};

/**
 * 現在のリージョンを取得
 * @returns {string} 'jp' | 'us' | 'uk'
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
 * @param {string} region - 'jp' | 'us' | 'uk'
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
