// ============================================================
// MusicGacha - Card Renderer Module
// HTMLテンプレートでカードUI描画
// ============================================================

import { RARITY_CONFIG, formatDuration } from './card.js';
import { getSetting, toggleFavorite, isFavorite } from './storage.js';
import { copyShareLink } from './transfer.js';
import { getAppleMusicUrl, getSpotifyUrl, getAmazonMusicUrl, getYouTubeUrl } from './affiliate.js';

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
  <text x="125" y="115" text-anchor="middle" font-size="60" fill="#333">🎵</text>
  <text x="125" y="155" text-anchor="middle" font-size="14" fill="#555" font-family="sans-serif">No Cover</text>
</svg>
`);

// ---- Card Preview Audio (standalone for non-gacha screens) ----
let activeCardAudio = null;
let activeCardBtn = null;

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
    btn.textContent = '▶';
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
      activeCardBtn.textContent = '▶';
      activeCardBtn.classList.remove('playing');
    }
  }

  // 再生開始
  const isMuted = getSetting('muted') === true;
  const vol = getSetting('volume');
  const audio = new Audio(previewUrl);
  audio.volume = isMuted ? 0 : (vol !== null ? parseInt(vol, 10) / 100 : 0.5);
  audio.addEventListener('ended', () => {
    btn.textContent = '▶';
    btn.classList.remove('playing');
    activeCardAudio = null;
    activeCardBtn = null;
  });
  audio.play().catch(e => console.warn('[CardPreview] Autoplay blocked:', e.message));

  btn.textContent = '⏸';
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

  const coverUrl = card.coverUrl || DEFAULT_COVER;

  const isFav = isFavorite(card.id);

  el.innerHTML = `
    <div class="card-bg" style="background-image: url('${escapeHtml(coverUrl)}')"></div>
    <div class="card-overlay"></div>
    <div class="card-border"></div>
    <span class="card-rarity-badge rarity-badge-${card.rarity.toLowerCase()}">${card.rarity}</span>
    <span class="card-fav-icon${isFav ? ' active' : ''}" title="お気に入り">${isFav ? '❤' : ''}</span>
    <div class="card-content">
      <div class="card-title" title="${escapeHtml(card.title)}">${escapeHtml(card.title)}</div>
      <div class="card-artist" title="${escapeHtml(card.artist)}">${escapeHtml(card.artist)}</div>

    </div>
    ${card.previewUrl ? `<button class="card-listen-btn" data-preview-url="${escapeHtml(card.previewUrl)}" title="試聴">▶</button>` : ''}
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
      favIcon.textContent = result.isFavorite ? '❤' : '';
      favIcon.classList.toggle('active', result.isFavorite);
      // バウンスアニメーション
      favIcon.classList.remove('bounce');
      void favIcon.offsetWidth; // reflow
      favIcon.classList.add('bounce');
    }
    if (window.MusicGacha?.showToast) {
      window.MusicGacha.showToast(
        result.isFavorite ? '❤ お気に入りに追加しました' : 'お気に入りを解除しました',
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
    ? packs.map(p => `<span class="pack-tag">${escapeHtml(p.icon)} ${escapeHtml(p.name)}</span>`).join(' ')
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
      <div class="modal-debug-section" style="margin-top: 12px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); font-size: 11px;">
        <div style="color: #888; margin-bottom: 4px; font-weight: bold;">🔍 Debug: データソース比較</div>
        <div class="modal-info-row">
          <span class="modal-info-label" style="color: #f80;">iTunes曲名</span>
          <span class="modal-info-value" style="color: #f80;">${escapeHtml(card.title)}</span>
        </div>
        <div class="modal-info-row">
          <span class="modal-info-label" style="color: #0af;">Last.fm曲名</span>
          <span class="modal-info-value" style="color: #0af;">${escapeHtml(card.originalName || '(なし)')}</span>
        </div>
        <div class="modal-info-row">
          <span class="modal-info-label" style="color: #f80;">iTunesアーティスト</span>
          <span class="modal-info-value" style="color: #f80;">${escapeHtml(card.artist)}</span>
        </div>
        <div class="modal-info-row">
          <span class="modal-info-label" style="color: #0af;">Last.fmアーティスト</span>
          <span class="modal-info-value" style="color: #0af;">${escapeHtml(card.originalArtist || '(なし)')}</span>
        </div>
        <div class="modal-info-row">
          <span class="modal-info-label" style="color: #888;">カードID</span>
          <span class="modal-info-value" style="color: #888;">${escapeHtml(card.id || '(なし)')}</span>
        </div>
      </div>
    `;
  }

  // 外部リンク（アフィリエイト対応）
  if (playerContainer) {
    const appleMusicUrl = getAppleMusicUrl(card);
    const spotifyUrl = getSpotifyUrl(card);
    const amazonMusicUrl = getAmazonMusicUrl(card);
    const youtubeUrl = getYouTubeUrl(card);

    playerContainer.innerHTML = `
      <div class="modal-player-actions">
        <a href="${appleMusicUrl}" target="_blank" rel="noopener" class="btn-apple-music">
          🍎 Apple Musicで聴く
        </a>
        <a href="${spotifyUrl}" target="_blank" rel="noopener" class="btn-spotify">
          🎵 Spotifyで聴く
        </a>
        <a href="${amazonMusicUrl}" target="_blank" rel="noopener" class="btn-amazon-music">
          🛒 Amazon Musicで聴く
        </a>
        <a href="${youtubeUrl}" target="_blank" rel="noopener" class="btn-youtube">
          ▶ YouTubeで観る
        </a>
      </div>
      <div class="modal-share-section">
        <button class="btn-share-card" id="btn-share-card">🔗 カードを共有する</button>
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

// ---- Genre Icon Lookup ----

let genreData = null;

async function loadGenreData() {
  if (genreData) return genreData;
  try {
    const response = await fetch('./data/genres.json');
    const data = await response.json();
    genreData = data.genres;
  } catch {
    genreData = {};
  }
  return genreData;
}

// 同期版（キャッシュ済みの場合のみ使用）
function getGenreIcon(genre) {
  if (!genreData) {
    // 非同期で読み込み開始
    loadGenreData();
    return '🎵';
  }
  return genreData[genre]?.icon || '🎵';
}

// 初期読み込み
loadGenreData();

// ---- Pack Lookup (曲からパック逆引き) ----

const PACK_DISPLAY_NAMES = {
  jpop: { name: 'J-POP', icon: '🌸' },
  kpop: { name: 'K-POP', icon: '💎' },
  vocaloid: { name: 'Vocaloid', icon: '🎤' },
  anime: { name: 'Anime', icon: '🌟' },
  hiphop: { name: 'Hip-Hop', icon: '🎧' },
  idol: { name: 'Idol', icon: '⭐' },
  western: { name: 'Western', icon: '🌍' },
};

let songPoolCache = null;

async function loadSongPoolForLookup() {
  if (songPoolCache) return songPoolCache;
  try {
    const response = await fetch('./data/songs.json');
    const data = await response.json();
    songPoolCache = data.packs;
  } catch {
    songPoolCache = {};
  }
  return songPoolCache;
}

// 初期ロード（カード描画時に同期的に使えるように事前読み込み）
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
    `<span class="card-genre-badge">${escapeHtml(p.icon)} ${escapeHtml(p.name)}</span>`
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
        activeCardBtn.textContent = '▶';
        activeCardBtn.classList.remove('playing');
      }
      activeCardAudio = null;
      activeCardBtn = null;
    }
  };
  window.MusicGacha.getActiveCardAudio = () => activeCardAudio;
}

export { getGenreIcon, DEFAULT_COVER };
