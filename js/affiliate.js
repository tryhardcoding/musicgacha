// ============================================================
// MusicGacha - Affiliate Module
// アフィリエイトリンク生成 & 設定管理
// ============================================================

// ---- Affiliate Configuration ----
// 各プログラム登録後にIDを差し替えてください
const AFFILIATE_CONFIG = {
    apple: {
        // Apple Services Performance Partners (Partnerize)
        // 取得先: https://performance-partners.apple.com/
        token: '',  // 例: '1234abcd'
        campaignId: '',
    },
    amazon: {
        // Amazon アソシエイト
        // 取得先: https://affiliate.amazon.co.jp/
        tag: 'musicgacha-22',
        region: 'jp', // jp, us, uk, etc.
    },
    imobile: {
        // i-mobile Ad Network
        // 取得先: https://i-mobile.co.jp/
        configured: true,
    },
};

// ---- Amazon Retail Domain Map ----
// Note: music.amazon.co.jp/search/ は外部リンクをサポートしないため、
//       小売サイトのデジタルミュージック検索を使用する
const AMAZON_DOMAINS = {
    jp: 'https://www.amazon.co.jp',
    us: 'https://www.amazon.com',
    uk: 'https://www.amazon.co.uk',
    de: 'https://www.amazon.de',
};

// ---- URL Generators ----

/**
 * Apple Music アフィリエイトURL生成
 * トークンが設定済みの場合、URLに at= パラメータを付与
 * @param {Object} card - カードデータ { artist, title, trackViewUrl }
 * @returns {string} Apple Music URL
 */
export function getAppleMusicUrl(card) {
    const searchTerm = encodeURIComponent(`${card.artist} ${card.title}`);
    const baseUrl = card.trackViewUrl || `https://music.apple.com/search?term=${searchTerm}`;

    if (AFFILIATE_CONFIG.apple.token) {
        const separator = baseUrl.includes('?') ? '&' : '?';
        let url = `${baseUrl}${separator}at=${AFFILIATE_CONFIG.apple.token}`;
        if (AFFILIATE_CONFIG.apple.campaignId) {
            url += `&ct=${AFFILIATE_CONFIG.apple.campaignId}`;
        }
        return url;
    }

    return baseUrl;
}

/**
 * Spotify 検索URL生成
 * @param {Object} card - カードデータ { artist, title }
 * @returns {string} Spotify URL
 */
export function getSpotifyUrl(card) {
    const searchTerm = encodeURIComponent(`${card.artist} ${card.title}`);
    return `https://open.spotify.com/search/${searchTerm}`;
}

/**
 * Amazon Music 検索URL生成（デジタルミュージックカテゴリ）
 * music.amazon.co.jp は外部検索リンクをサポートしないため、
 * Amazon小売サイトの /s?k=...&i=digital-music 形式を使用
 * @param {Object} card - カードデータ { artist, title }
 * @returns {string} Amazon デジタルミュージック検索 URL
 */
export function getAmazonMusicUrl(card) {
    const region = AFFILIATE_CONFIG.amazon.region || 'jp';
    const domain = AMAZON_DOMAINS[region] || AMAZON_DOMAINS.jp;
    const searchTerm = encodeURIComponent(`${card.artist} ${card.title}`);
    let url = `${domain}/s?k=${searchTerm}&i=digital-music`;

    if (AFFILIATE_CONFIG.amazon.tag) {
        url += `&tag=${AFFILIATE_CONFIG.amazon.tag}`;
    }

    return url;
}

/**
 * YouTube 検索URL生成
 * @param {Object} card - カードデータ { artist, title }
 * @returns {string} YouTube URL
 */
export function getYouTubeUrl(card) {
    const searchTerm = encodeURIComponent(`${card.artist} ${card.title} official`);
    return `https://www.youtube.com/results?search_query=${searchTerm}`;
}

// ---- Config Check ----

/**
 * アフィリエイトIDが1つ以上設定済みかチェック
 * @returns {boolean}
 */
export function isAffiliateConfigured() {
    return !!(
        AFFILIATE_CONFIG.apple.token ||
        AFFILIATE_CONFIG.amazon.tag
    );
}

/**
 * AdSense設定が有効か（後方互換性）
 * @returns {boolean}
 */
export function isAdSenseConfigured() {
    return false;
}

/**
 * i-mobile設定が有効か
 * @returns {boolean}
 */
export function isIMobileConfigured() {
    return !!AFFILIATE_CONFIG.imobile.configured;
}

/**
 * AdSenseのclientIdを取得（後方互換性）
 * @returns {string}
 */
export function getAdSenseClientId() {
    return '';
}

/**
 * 設定オブジェクトを外部から参照（デバッグ用）
 */
export function getAffiliateConfig() {
    return { ...AFFILIATE_CONFIG };
}
