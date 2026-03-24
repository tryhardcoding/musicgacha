// ============================================================
// MusicGacha - Affiliate Module
// アフィリエイトリンク生成 & 設定管理（14カ国対応）
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
        // Amazon アソシエイト（14カ国対応）
        // 各国のアソシエイトプログラム登録後にタグを設定
        // 未設定の国からのアクセスは日本タグにフォールバック
        // ※ US登録 + Earn Globally で大半をカバー可能
        tags: {
            jp: 'sadpof-22',       // https://affiliate.amazon.co.jp/
            us: 'musicgacha-20',   // Earn Globally (メイン)
            uk: 'musicgacha-20',   // Earn Globally
            de: 'musicgacha-20',   // Earn Globally
            fr: 'musicgacha-20',   // Earn Globally
            it: 'musicgacha-20',   // Earn Globally
            es: 'musicgacha-20',   // Earn Globally
            nl: 'musicgacha-20',   // Earn Globally
            ca: 'musicgacha-20',   // Earn Globally
            au: '',                // 個別登録が必要（→JPフォールバック）
            br: '',                // 個別登録が必要（→JPフォールバック）
            mx: '',                // 個別登録が必要（→JPフォールバック）
            be: 'musicgacha-20',   // Earn Globally (FR経由)
        },
    },
    imobile: {
        // i-mobile Ad Network
        // 取得先: https://i-mobile.co.jp/
        configured: true,
    },
};

// ---- Amazon Domain & Music Unlimited Map ----
const AMAZON_DOMAINS = {
    jp: 'https://www.amazon.co.jp',
    us: 'https://www.amazon.com',
    uk: 'https://www.amazon.co.uk',
    de: 'https://www.amazon.de',
    fr: 'https://www.amazon.fr',
    it: 'https://www.amazon.it',
    es: 'https://www.amazon.es',
    nl: 'https://www.amazon.nl',
    ca: 'https://www.amazon.ca',
    au: 'https://www.amazon.com.au',
    br: 'https://www.amazon.com.br',
    mx: 'https://www.amazon.com.mx',
    be: 'https://www.amazon.com.be',
};

const AMAZON_MUSIC_UNLIMITED_PATHS = {
    jp: '/music/unlimited',
    us: '/music/unlimited',
    uk: '/music/unlimited',
    de: '/music/unlimited',
    fr: '/music/unlimited',
    it: '/music/unlimited',
    es: '/music/unlimited',
    nl: '/music/unlimited',
    ca: '/music/unlimited',
    au: '/music/unlimited',
    br: '/music/unlimited',
    mx: '/music/unlimited',
    be: '/music/unlimited',
};

// ---- Locale Detection ----

// 言語コード → Amazonリージョン マッピング
const LOCALE_TO_REGION = {
    'ja': 'jp',
    // 英語圏
    'en-us': 'us',
    'en-gb': 'uk',
    'en-au': 'au',
    'en-ca': 'ca',
    'en-nz': 'au',   // ニュージーランドはAUにフォールバック
    'en': 'us',       // 英語（地域なし）は米国
    // ドイツ語圏
    'de': 'de',
    'de-de': 'de',
    'de-at': 'de',
    'de-ch': 'de',    // スイスはDEにフォールバック
    // フランス語圏
    'fr': 'fr',
    'fr-fr': 'fr',
    'fr-be': 'be',
    'fr-ca': 'ca',
    'fr-ch': 'fr',
    // イタリア語
    'it': 'it',
    'it-it': 'it',
    // スペイン語圏
    'es': 'es',
    'es-es': 'es',
    'es-mx': 'mx',
    'es-ar': 'mx',    // アルゼンチンはMXにフォールバック
    'es-co': 'mx',
    'es-cl': 'mx',
    // ポルトガル語圏
    'pt': 'br',
    'pt-br': 'br',
    'pt-pt': 'br',    // ポルトガルはBRにフォールバック
    // オランダ語圏
    'nl': 'nl',
    'nl-nl': 'nl',
    'nl-be': 'be',
};

let _detectedRegion = null;

/**
 * ブラウザのロケールからAmazonリージョンを自動判定
 * @returns {string} リージョンコード ('jp', 'us', 'uk', 'de')
 */
export function detectAmazonRegion() {
    if (_detectedRegion) return _detectedRegion;

    const lang = (navigator.language || navigator.userLanguage || 'ja').toLowerCase();

    // 完全一致を試行 → 言語部分のみで試行 → デフォルトjp
    _detectedRegion = LOCALE_TO_REGION[lang]
        || LOCALE_TO_REGION[lang.split('-')[0]]
        || 'jp';

    return _detectedRegion;
}

/**
 * 現在のリージョンに対応するアソシエイトタグを取得
 * 未設定の国は日本タグにフォールバック
 * @param {string} [region] - リージョン（省略時は自動判定）
 * @returns {string} アソシエイトタグ
 */
function getAmazonTag(region) {
    const r = region || detectAmazonRegion();
    return AFFILIATE_CONFIG.amazon.tags[r]
        || AFFILIATE_CONFIG.amazon.tags.jp
        || '';
}

/**
 * 現在のリージョンに対応するAmazonドメインを取得
 * @param {string} [region] - リージョン（省略時は自動判定）
 * @returns {string} Amazonドメイン URL
 */
function getAmazonDomain(region) {
    const r = region || detectAmazonRegion();
    return AMAZON_DOMAINS[r] || AMAZON_DOMAINS.jp;
}

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
 * ブラウザロケールに基づいて適切な国のAmazonストアにリンク
 * @param {Object} card - カードデータ { artist, title }
 * @returns {string} Amazon デジタルミュージック検索 URL
 */
export function getAmazonMusicUrl(card) {
    const domain = getAmazonDomain();
    const tag = getAmazonTag();
    const searchTerm = encodeURIComponent(`${card.artist} ${card.title}`);
    let url = `${domain}/s?k=${searchTerm}&i=digital-music`;

    if (tag) {
        url += `&tag=${tag}`;
    }

    return url;
}

/**
 * Amazon Music Unlimited PRバナー用URL生成
 * ブラウザロケールに基づいて適切な国のUnlimitedページにリンク
 * @returns {string} Amazon Music Unlimited URL（タグ付き）
 */
export function getAmazonMusicUnlimitedUrl() {
    const region = detectAmazonRegion();
    const domain = getAmazonDomain(region);
    const path = AMAZON_MUSIC_UNLIMITED_PATHS[region] || '/music/unlimited';
    const tag = getAmazonTag(region);
    let url = `${domain}${path}`;

    if (tag) {
        url += `?tag=${tag}`;
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
        getAmazonTag()
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
    return {
        ...AFFILIATE_CONFIG,
        _detectedRegion: detectAmazonRegion(),
        _activeDomain: getAmazonDomain(),
        _activeTag: getAmazonTag(),
    };
}
