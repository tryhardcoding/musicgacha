// ============================================================
// MusicGacha - Card Renderer Module
// HTMLテンプレートでカードUI描画
// ============================================================

import { RARITY_CONFIG, formatDuration } from './card.js';
import { getSetting, toggleFavorite, isFavorite } from './storage.js';
import { copyShareLink } from './transfer.js';
import { getAmazonMusicUrl } from './affiliate.js';
import { icon, refreshIcons, PACK_ICONS, GENRE_ICONS } from './icons.js';
import { getSongPool, getGenreData } from './data-loader.js';

// ---- Default Cover ----
const DEFAULT_COVER = 'data:image/svg+xml,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="250" height="250" viewBox="0 0 250 250">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#0a0a0f"/>
    </linearGradient>
  </defs>
  <rect width="250" height="250" fill="url(#g)"/>
  <g transform="translate(105, 85)" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 18V5l12-2v13"/>
    <circle cx="6" cy="18" r="3"/>
    <circle cx="18" cy="16" r="3"/>
  </g>
  <text x="125" y="155" text-anchor="middle" font-size="14" fill="#555" font-family="sans-serif">No Cover</text>
</svg>
`);

/**
 * iTunes CDN URLの画像サイズを動的に変更
 * 例: 600x600bb.jpg → 200x200bb.jpg
 * @param {string} url - iTunes CDN画像URL
 * @param {number} size - 希望サイズ（正方形）
 * @returns {string} サイズ変更済みURL
 */
function resizeCoverUrl(url, size) {
  if (!url || url.startsWith('data:')) return url;
  return url.replace(/\/\d+x\d+bb\./, `/${size}x${size}bb.`);
}

// ---- Card Preview Audio (standalone for non-gacha screens) ----
let activeCardAudio = null;
let activeCardBtn = null;

const ICON_PLAY_SM = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
const ICON_PAUSE_SM = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/></svg>';

function toggleCardPreview(btn, previewUrl) {
  // ガチャ結果画面のプレイリストに登録済みならそちらに委任
  if (window.MusicGacha?.playlistPlayCard) {
    const handled = window.MusicGacha.playlistPlayCard(btn);
    if (handled) return;
  }

  // ガチャプレイリスト再生中なら先に停止（排他制御）
  if (window.MusicGacha?.stopPreview) {
    window.MusicGacha.stopPreview();
  }

  // 同じボタンの再クリック → 停止
  if (activeCardBtn === btn && activeCardAudio && !activeCardAudio.paused) {
    activeCardAudio.pause();
    activeCardAudio.currentTime = 0;
    btn.innerHTML = ICON_PLAY_SM;
    btn.classList.remove('playing');
    activeCardAudio = null;
    activeCardBtn = null;
    return;
  }

  // 他のカードが再生中 → 先に停止
  if (activeCardAudio) {
    activeCardAudio.pause();
    activeCardAudio.currentTime = 0;
    if (activeCardBtn) {
      activeCardBtn.innerHTML = ICON_PLAY_SM;
      activeCardBtn.classList.remove('playing');
    }
  }

  // 再生開始
  const isMuted = getSetting('muted') === true;
  const vol = getSetting('volume');
  const audio = new Audio(previewUrl);
  const parsedVol = vol != null ? parseInt(vol, 10) : NaN;
  audio.volume = isMuted ? 0 : (isNaN(parsedVol) ? 0.1 : parsedVol / 100);
  audio.muted = isMuted; // iOS対応: audio.volumeが効かないためmutedプロパティも設定
  audio.addEventListener('ended', () => {
    btn.innerHTML = ICON_PLAY_SM;
    btn.classList.remove('playing');
    activeCardAudio = null;
    activeCardBtn = null;
  });
  audio.play().catch(e => console.warn('[CardPreview] Autoplay blocked:', e.message));

  btn.innerHTML = ICON_PAUSE_SM;
  btn.classList.add('playing');
  activeCardAudio = audio;
  activeCardBtn = btn;
}

/**
 * カード要素を生成
 * @param {Object} card - カードデータ
 * @param {Object} options - { showNew: bool, compact: bool, onClick: fn }
 * @returns {HTMLElement}
 */
export function renderCard(card, options = {}) {
  const { showNew = false, compact = false, onClick = null } = options;

  const el = document.createElement('div');
  el.className = `music-card card-rarity-${card.rarity.toLowerCase()}`;
  if (compact) el.classList.add('card-compact');

  // カードサムネイル: 200x200で十分（元は600x600）
  const coverUrl = card.coverUrl ? resizeCoverUrl(card.coverUrl, 200) : DEFAULT_COVER;

  const isFav = isFavorite(card.id);

  el.innerHTML = `
    <div class="card-bg" style="background-image: url('${escapeHtml(coverUrl)}')"></div>
    <div class="card-overlay"></div>
    <div class="card-border"></div>
    <span class="card-rarity-badge rarity-badge-${card.rarity.toLowerCase()}">${card.rarity}</span>
    ${card.chartRank ? `<span class="card-rank-badge">No.${card.chartRank}</span>` : ''}
    <span class="card-fav-icon${isFav ? ' active' : ''}" title="お気に入り">${isFav ? icon('heart', { size: 16, class: 'fav-heart' }) : ''}</span>
    <div class="card-content">
      <div class="card-title" title="${escapeHtml(card.title)}">${escapeHtml(card.title)}</div>
      <div class="card-artist" title="${escapeHtml(card.artist)}">${escapeHtml(card.artist)}</div>

    </div>
    ${card.previewUrl ? `<button class="card-listen-btn" data-preview-url="${escapeHtml(card.previewUrl)}" title="試聴"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg></button>` : ''}
    ${showNew && card.isNew ? '<span class="card-new-badge">NEW</span>' : ''}
  `;

  // ダブルクリックでお気に入りトグル
  let clickTimer = null;

  el.addEventListener('dblclick', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // シングルクリックのタイマーをキャンセル
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
    }
    const result = toggleFavorite(card.id);
    const favIcon = el.querySelector('.card-fav-icon');
    if (favIcon) {
      favIcon.innerHTML = result.isFavorite ? icon('heart', { size: 16, class: 'fav-heart' }) : '';
      favIcon.classList.toggle('active', result.isFavorite);
      // バウンスアニメーション
      favIcon.classList.remove('bounce');
      void favIcon.offsetWidth; // reflow
      favIcon.classList.add('bounce');
    }
    if (window.MusicGacha?.showToast) {
      window.MusicGacha.showToast(
        result.isFavorite ? 'お気に入りに追加しました' : 'お気に入りを解除しました',
        result.isFavorite ? 'success' : 'info'
      );
    }
  });

  // シングルクリック（遅延実行でダブルクリックと区別）
  if (onClick) {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.card-listen-btn')) return;
      if (clickTimer) clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        clickTimer = null;
        onClick(card);
      }, 250);
    });
  }

  // 試聴/再生ボタン
  const listenBtn = el.querySelector('.card-listen-btn');
  if (listenBtn) {
    const previewUrl = listenBtn.getAttribute('data-preview-url');
    if (previewUrl) {
      listenBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCardPreview(listenBtn, previewUrl);
      });
    } else {
      listenBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openCardDetail(card);
      });
    }
  }

  // Cover Art 読み込みエラー時のフォールバック
  const bgEl = el.querySelector('.card-bg');
  if (card.coverUrl) {
    const img = new Image();
    img.onerror = () => {
      bgEl.style.backgroundImage = `url('${DEFAULT_COVER}')`;
    };
    img.src = card.coverUrl;
  }

  return el;
}

/**
 * カード詳細モーダルを開く
 */
export async function openCardDetail(card) {
  const modal = document.getElementById('card-detail-modal');
  const cardContainer = document.getElementById('modal-card-container');
  const infoContainer = document.getElementById('modal-info');
  const playerContainer = document.getElementById('modal-player');

  if (!modal) return;

  // カード拡大表示
  if (cardContainer) {
    cardContainer.innerHTML = '';
    const cardEl = renderCard(card, { compact: false });
    cardEl.style.width = '200px';
    cardEl.style.height = '200px';
    cardEl.style.cursor = 'default';
    cardContainer.appendChild(cardEl);
  }

  // パック情報を取得（standard以外）- songs.jsonとの照合のためoriginalName/originalArtistを使用
  const packs = await findPacksForTrack(card.originalArtist || card.artist, card.originalName || card.title);
  const packDisplayHtml = packs.length > 0
    ? packs.map(p => `<span class="pack-tag">${icon(p.icon, { size: 14 })} ${escapeHtml(p.name)}</span>`).join(' ')
    : '';

  // 曲情報
  if (infoContainer) {
    infoContainer.innerHTML = `
      <div class="modal-info-row">
        <span class="modal-info-label">曲名</span>
        <span class="modal-info-value">${escapeHtml(card.title)}</span>
      </div>
      <div class="modal-info-row">
        <span class="modal-info-label">アーティスト</span>
        <span class="modal-info-value">${escapeHtml(card.artist)}</span>
      </div>
      <div class="modal-info-row">
        <span class="modal-info-label">アルバム</span>
        <span class="modal-info-value">${escapeHtml(card.album || 'Unknown')}</span>
      </div>
      ${card.year ? `<div class="modal-info-row">
        <span class="modal-info-label">リリース年</span>
        <span class="modal-info-value">${card.year}</span>
      </div>` : ''}
      ${packDisplayHtml ? `<div class="modal-info-row">
        <span class="modal-info-label">パック</span>
        <span class="modal-info-value">${packDisplayHtml}</span>
      </div>` : ''}
      <div class="modal-info-row">
        <span class="modal-info-label">曲長</span>
        <span class="modal-info-value">${formatDuration(card.duration)}</span>
      </div>
      ${card.count > 1 ? `<div class="modal-info-row">
        <span class="modal-info-label">所持数</span>
        <span class="modal-info-value">×${card.count}</span>
      </div>` : ''}
    `;
  }

  // 外部リンク（アフィリエイト対応 - Amazon Music）
  if (playerContainer) {
    const amazonMusicUrl = getAmazonMusicUrl(card);

    playerContainer.innerHTML = `
      <div class="modal-player-actions">
        <a href="${amazonMusicUrl}" target="_blank" rel="noopener" class="btn-affiliate-primary btn-affiliate-amazon">
          <span class="btn-affiliate-icon">🎧</span>
          <span class="btn-affiliate-text">
            <span class="btn-affiliate-label">フルで聴く</span>
            <span class="btn-affiliate-sub">Amazon Music</span>
          </span>
          <span class="btn-affiliate-arrow">→</span>
        </a>
      </div>
      <div class="modal-share-section">
        <button class="btn-share-card" id="btn-share-card">${icon('link', { size: 16 })} カードを共有する</button>
      </div>
    `;

    // 共有ボタンのイベント
    const btnShare = playerContainer.querySelector('#btn-share-card');
    if (btnShare) {
      btnShare.addEventListener('click', async () => {
        await copyShareLink(card);
        if (window.MusicGacha?.showToast) {
          window.MusicGacha.showToast('共有リンクをコピーしました！', 'success');
        }
      });
    }
  }

  modal.style.display = '';
  refreshIcons();

  // モーダル内バナー広告をリフレッシュ
  if (window.MusicGacha?.refreshModalBannerAd) {
    window.MusicGacha.refreshModalBannerAd();
  }

  // アニメーション: ステータスバーを遅延で表示
  setTimeout(() => {
    modal.querySelectorAll('.modal-stat-fill').forEach(fill => {
      const w = fill.style.width;
      fill.style.width = '0%';
      requestAnimationFrame(() => {
        fill.style.width = w;
      });
    });
  }, 100);
}

// ---- Genre Icon Lookup (共通キャッシュ経由) ----

let genreData = null;

async function loadGenreData() {
  if (genreData) return genreData;
  genreData = await getGenreData();
  return genreData;
}

// 同期版（キャッシュ済みの場合のみ使用）
function getGenreIcon(genre) {
  const iconName = GENRE_ICONS[genre] || 'music';
  if (!genreData) {
    loadGenreData();
  }
  return icon(iconName, { size: 14 });
}

// 初期読み込み（共通キャッシュ経由）
loadGenreData();

// ---- Pack Lookup (曲からパック逆引き) ----

const PACK_DISPLAY_NAMES = {
  jpop: { name: 'J-POP', icon: 'flower-2' },
  kpop: { name: 'K-POP', icon: 'gem' },
  vocaloid: { name: 'Vocaloid', icon: 'mic' },
  anime: { name: 'Anime', icon: 'sparkles' },
  hiphop: { name: 'Hip-Hop', icon: 'headphones' },

  western: { name: 'Western', icon: 'globe' },
};

let songPoolCache = null;

async function loadSongPoolForLookup() {
  if (songPoolCache) return songPoolCache;
  songPoolCache = await getSongPool() || {};
  return songPoolCache;
}

// 初期ロード（共通キャッシュ経由）
loadSongPoolForLookup();

/**
 * 曲名+アーティスト名から所属パックを検索（standard除外）- 同期版
 * songPoolCacheが未ロードの場合は空配列を返す
 */
function findPacksForTrackSync(artist, title) {
  if (!songPoolCache) return [];
  const results = [];
  const artistLower = (artist || '').toLowerCase();
  const titleLower = (title || '').toLowerCase();

  for (const [packId, tracks] of Object.entries(songPoolCache)) {
    if (packId === 'standard') continue;
    const displayInfo = PACK_DISPLAY_NAMES[packId];
    if (!displayInfo) continue;

    const found = tracks.some(t =>
      t.artist.toLowerCase() === artistLower &&
      t.name.toLowerCase() === titleLower
    );
    if (found) {
      results.push(displayInfo);
    }
  }
  return results;
}

/**
 * 曲名+アーティスト名から所属パックを検索（standard除外）- 非同期版
 */
async function findPacksForTrack(artist, title) {
  await loadSongPoolForLookup();
  return findPacksForTrackSync(artist, title);
}

/**
 * カード用パックバッジHTML生成（同期）
 */
function getPackBadgesHtml(card) {
  const artist = card.originalArtist || card.artist;
  const title = card.originalName || card.title;
  const packs = findPacksForTrackSync(artist, title);
  if (packs.length === 0) return '';
  return packs.map(p =>
    `<span class="card-genre-badge">${icon(p.icon, { size: 12 })} ${escapeHtml(p.name)}</span>`
  ).join('');
}

/**
 * カード裏面（未取得スロット）を生成
 * @param {number} rank - チャート順位
 * @param {string} artist - アーティスト名
 * @param {string} name - 曲名
 * @returns {HTMLElement}
 */
export function renderCardBack(rank, artist, name) {
  const el = document.createElement('div');
  el.className = 'top200-slot top200-slot-empty';
  el.innerHTML = `
        <span class="top200-rank-badge">#${rank}</span>
        <div class="card-back">
            <div class="card-back-pattern"></div>
            <div class="card-back-icon">?</div>
            <div class="card-back-info">
                <div class="card-back-title">${escapeHtml(name)}</div>
                <div class="card-back-artist">${escapeHtml(artist)}</div>
            </div>
        </div>
    `;
  return el;
}

// ---- Utilities ----

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// グローバル参照に登録（ヘッダー音量連動・排他制御用）
if (typeof window !== 'undefined') {
  window.MusicGacha = window.MusicGacha || {};
  window.MusicGacha.stopCardPreview = () => {
    if (activeCardAudio) {
      activeCardAudio.pause();
      activeCardAudio.currentTime = 0;
      if (activeCardBtn) {
        activeCardBtn.innerHTML = ICON_PLAY_SM;
        activeCardBtn.classList.remove('playing');
      }
      activeCardAudio = null;
      activeCardBtn = null;
    }
  };
  window.MusicGacha.getActiveCardAudio = () => activeCardAudio;
}

export { getGenreIcon, DEFAULT_COVER };
