// ============================================================
// MusicGacha - GA4 Custom Events
// Google Analytics 4 カスタムイベントトラッキング
// ============================================================

/**
 * GA4イベントを送信
 * @param {string} eventName - イベント名
 * @param {Object} params - イベントパラメータ
 */
function sendEvent(eventName, params = {}) {
    if (typeof gtag === 'function') {
        gtag('event', eventName, params);
    }
}

/** パック開封 */
export function trackPackOpen(packType, isGold = false, isGod = false) {
    sendEvent('pack_open', {
        pack_type: packType,
        is_gold: isGold,
        is_god: isGod,
    });
}

/** シェア */
export function trackShareEvent(method, contentType) {
    sendEvent('share', {
        method: method,        // 'x_text', 'image_download', 'web_share'
        content_type: contentType,  // 'pack_result', 'card', 'collection', 'top200'
    });
}

/** コレクション閲覧 */
export function trackViewCollection(uniqueCount) {
    sendEvent('view_collection', {
        unique_count: uniqueCount,
    });
}

/** デイリーボーナス取得 */
export function trackDailyBonus() {
    sendEvent('daily_bonus_claim');
}

/** リージョン変更 */
export function trackRegionChange(region) {
    sendEvent('region_change', {
        region: region,
    });
}

/** カード詳細表示 */
export function trackCardView(rarity) {
    sendEvent('card_view', {
        rarity: rarity,
    });
}

/** PWAインストール */
export function trackPWAInstall() {
    sendEvent('pwa_install');
}
