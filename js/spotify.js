// ============================================================
// MusicGacha - Spotify Module
// Spotify oEmbed連携
// ============================================================

/**
 * Spotify oEmbedでプレーヤーHTMLを取得
 * @param {string} trackUrl - Spotify track URL (e.g., https://open.spotify.com/track/{id})
 * @returns {Promise<string|null>} HTML or null
 */
export async function getSpotifyEmbed(trackUrl) {
    try {
        const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(trackUrl)}`;
        const response = await fetch(oembedUrl);
        if (!response.ok) return null;
        const data = await response.json();
        return data.html || null;
    } catch {
        return null;
    }
}

/**
 * Spotify埋め込みiframeを生成
 * @param {string} trackId - Spotify Track ID
 * @returns {string} HTML string
 */
export function createSpotifyIframe(trackId) {
    // セキュリティ: trackId を英数字のみに制限（iframe src インジェクション防止）
    if (!trackId || !/^[a-zA-Z0-9]+$/.test(trackId)) {
        console.warn('[Spotify] Invalid trackId:', trackId);
        return '';
    }
    return `<iframe 
    src="https://open.spotify.com/embed/track/${trackId}?theme=0" 
    width="100%" 
    height="80" 
    frameborder="0" 
    allow="encrypted-media"
    loading="lazy"
    style="border-radius: 12px;"
  ></iframe>`;
}

/**
 * Spotify検索リンクを生成
 * @param {string} artist
 * @param {string} track
 * @returns {string} URL
 */
export function getSpotifySearchUrl(artist, track) {
    const query = encodeURIComponent(`${artist} ${track}`);
    return `https://open.spotify.com/search/${query}`;
}

/**
 * YouTube検索リンクを生成
 * @param {string} artist
 * @param {string} track
 * @returns {string} URL
 */
export function getYouTubeSearchUrl(artist, track) {
    const query = encodeURIComponent(`${artist} ${track} official`);
    return `https://www.youtube.com/results?search_query=${query}`;
}
