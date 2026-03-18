// ============================================================
// MusicGacha - Collection Module
// コレクション画面 (グリッド, フィルタ, ソート, パック別, Top200ランキング)
// ============================================================

import { getCollection, getTop200Data, getFavorites } from './storage.js';
import { getSongPool, getTop200Daily } from './data-loader.js';
import { renderCard, renderCardBack, openCardDetail } from './card-renderer.js';
import { RARITY_CONFIG } from './card.js';
import { t } from './i18n.js';
import { refreshIcons } from './icons.js';

// ---- State ----
let currentFilter = 'all';
let currentSort = 'acquiredAt';
let currentPackFilter = 'all';
let searchQuery = '';
let initialized = false;

// Top 200 日付管理
let top200DateList = [];
let top200CurrentDateIndex = 0;

// ---- Init ----

export function initCollection() {
    if (initialized) return;
    initialized = true;
    setupFilterListeners();
    setupPackFilterListeners();

    // デフォルトをTOP200ビューにする
    currentPackFilter = 'top200';

    // タブのアクティブ状態を切替
    const tabContainer = document.getElementById('pack-filter-tabs');
    if (tabContainer) {
        tabContainer.querySelectorAll('.pack-filter-tab').forEach(t => t.classList.remove('active'));
        const top200Tab = tabContainer.querySelector('[data-pack-filter="top200"]');
        if (top200Tab) top200Tab.classList.add('active');
    }

    // ビュー切替
    const normalView = document.getElementById('collection-normal-view');
    const top200View = document.getElementById('collection-top200-view');
    if (normalView) normalView.style.display = 'none';
    if (top200View) top200View.style.display = '';

    loadTop200DateList().then(() => renderTop200View());
}

// ---- Pack Filter ----

function setupPackFilterListeners() {
    const tabContainer = document.getElementById('pack-filter-tabs');
    if (!tabContainer) return;

    tabContainer.addEventListener('click', (e) => {
        const tab = e.target.closest('.pack-filter-tab');
        if (!tab) return;

        const packFilter = tab.getAttribute('data-pack-filter');
        if (!packFilter) return;

        // アクティブ切替
        tabContainer.querySelectorAll('.pack-filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        currentPackFilter = packFilter;

        // ビュー切替
        const normalView = document.getElementById('collection-normal-view');
        const top200View = document.getElementById('collection-top200-view');

        if (packFilter === 'top200') {
            if (normalView) normalView.style.display = 'none';
            if (top200View) top200View.style.display = '';
            loadTop200DateList().then(() => renderTop200View());
        } else {
            if (normalView) normalView.style.display = '';
            if (top200View) top200View.style.display = 'none';
            renderCollection();
        }
    });

    // 日付セレクタ
    const prevBtn = document.getElementById('top200-date-prev');
    const nextBtn = document.getElementById('top200-date-next');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (top200CurrentDateIndex < top200DateList.length - 1) {
                top200CurrentDateIndex++;
                renderTop200View();
            }
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (top200CurrentDateIndex > 0) {
                top200CurrentDateIndex--;
                renderTop200View();
            }
        });
    }
}

// ---- Pack-based song lookup ----

let songPoolCache = null;

async function loadSongPoolForFilter() {
    if (songPoolCache) return songPoolCache;
    songPoolCache = await getSongPool() || {};
    return songPoolCache;
}

// 初期ロード（共通キャッシュ経由）
loadSongPoolForFilter();

/**
 * コレクションをパックでフィルタ（songs.jsonの各パックの曲リストと照合）
 */
function filterByPack(collection, packId) {
    if (packId === 'all' || packId === 'top200') return collection;
    if (!songPoolCache || !songPoolCache[packId]) return collection;

    const packTracks = songPoolCache[packId];
    const packKeySet = new Set(
        packTracks.map(t => `${t.artist.toLowerCase()}::${t.name.toLowerCase()}`)
    );

    return collection.filter(card => {
        const artist = (card.originalArtist || card.artist || '').toLowerCase();
        const title = (card.originalName || card.title || '').toLowerCase();
        return packKeySet.has(`${artist}::${title}`);
    });
}

// ---- Render Normal Collection ----

export function renderCollection() {
    const grid = document.getElementById('card-grid');
    const emptyEl = document.getElementById('empty-collection');
    if (!grid) return;

    let collection = getCollection();

    // パックフィルタ
    if (currentPackFilter !== 'all' && currentPackFilter !== 'top200') {
        collection = filterByPack(collection, currentPackFilter);
    }

    // レアリティフィルタ
    if (currentFilter !== 'all') {
        collection = collection.filter(c => c.rarity === currentFilter);
    }

    // 検索
    if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        collection = collection.filter(c =>
            c.artist.toLowerCase().includes(q) ||
            c.title.toLowerCase().includes(q)
        );
    }

    // ソート
    collection = sortCollection(collection, currentSort);

    // 描画
    grid.innerHTML = '';

    if (collection.length === 0) {
        if (emptyEl) {
            const emptyClone = emptyEl.cloneNode(true);
            emptyClone.style.display = '';
            grid.appendChild(emptyClone);
        }
        return;
    }

    for (const card of collection) {
        const cardEl = renderCard(card, {
            compact: true,
            onClick: (c) => openCardDetail(c),
        });
        cardEl.style.width = '100%';
        cardEl.style.aspectRatio = '1 / 1';
        grid.appendChild(cardEl);
    }

    // 統計更新
    updateStats(collection);

    // Lucideアイコン描画
    refreshIcons();
}

function sortCollection(collection, sortBy) {
    const rarityOrder = { LR: 6, UR: 5, SR: 4, R: 3, UC: 2, C: 1 };
    const sorted = [...collection];

    switch (sortBy) {
        case 'acquiredAt':
            sorted.sort((a, b) => new Date(b.acquiredAt) - new Date(a.acquiredAt));
            break;
        case 'rarity':
            sorted.sort((a, b) => (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0));
            break;
        case 'atk':
            sorted.sort((a, b) => b.atk - a.atk);
            break;
        case 'def':
            sorted.sort((a, b) => b.def - a.def);
            break;
        case 'artist':
            sorted.sort((a, b) => a.artist.localeCompare(b.artist));
            break;
        case 'favorite':
            const favSet = getFavorites();
            sorted.sort((a, b) => {
                const aFav = favSet.has(a.id) ? 1 : 0;
                const bFav = favSet.has(b.id) ? 1 : 0;
                if (bFav !== aFav) return bFav - aFav;
                return new Date(b.acquiredAt) - new Date(a.acquiredAt);
            });
            break;
        default:
            break;
    }

    return sorted;
}

function updateStats(filteredCollection) {
    const allCollection = getCollection();
    const totalCount = allCollection.reduce((sum, c) => sum + (c.count || 1), 0);
    const uniqueCount = allCollection.length;

    const statTotal = document.getElementById('stat-total');
    const statUnique = document.getElementById('stat-unique');

    if (statTotal) statTotal.textContent = `${totalCount}${t('collection.songs')}`;
    if (statUnique) statUnique.textContent = `${uniqueCount}${t('collection.types')}`;
}

// ---- Top 200 Ranking View ----

async function loadTop200DateList() {
    try {
        const response = await fetch('./data/top200-history/index.json');
        top200DateList = await response.json();
        top200CurrentDateIndex = 0; // 最新を表示
    } catch {
        // index.jsonがない場合は現在のdailyデータの日付を使用（共通キャッシュ経由）
        const data = await getTop200Daily();
        if (data) {
            top200DateList = [data.chartDate];
            top200CurrentDateIndex = 0;
        } else {
            top200DateList = [];
        }
    }
}

async function loadTop200ForDate(date) {
    try {
        // まず日別アーカイブを試す
        const response = await fetch(`./data/top200-history/${date}.json`);
        if (response.ok) return await response.json();
    } catch { }

    // フォールバック: 最新データ
    try {
        const response = await fetch('./data/top200-daily.json');
        return await response.json();
    } catch {
        return null;
    }
}

async function renderTop200View() {
    const grid = document.getElementById('top200-ranking-grid');
    const dateLabel = document.getElementById('top200-date-label');
    const statsEl = document.getElementById('top200-collection-stats');
    const prevBtn = document.getElementById('top200-date-prev');
    const nextBtn = document.getElementById('top200-date-next');

    if (!grid) return;

    // 日付表示
    const currentDate = top200DateList[top200CurrentDateIndex] || 'N/A';
    if (dateLabel) dateLabel.textContent = currentDate;

    // ボタン状態
    if (prevBtn) prevBtn.disabled = top200CurrentDateIndex >= top200DateList.length - 1;
    if (nextBtn) nextBtn.disabled = top200CurrentDateIndex <= 0;

    // チャートデータ読み込み
    const chartData = await loadTop200ForDate(currentDate);
    if (!chartData || !chartData.tracks) {
        grid.innerHTML = '<p style="text-align:center; color: var(--text-muted);">チャートデータがありません</p>';
        return;
    }

    // 取得済みキーセット
    const top200Data = getTop200Data();
    const obtainedSet = new Set(top200Data.obtainedKeys);

    // コレクション内のカードをキーでルックアップ
    const collection = getCollection();
    const collectionMap = new Map();
    for (const card of collection) {
        const artist = (card.originalArtist || card.artist || '').toLowerCase();
        const title = (card.originalName || card.title || '').toLowerCase();
        const key = `${artist}::${title}`;
        if (!collectionMap.has(key) || (card.count || 1) > (collectionMap.get(key).count || 1)) {
            collectionMap.set(key, card);
        }
    }

    // 取得数カウント
    let obtainedCount = 0;
    grid.innerHTML = '';

    for (const track of chartData.tracks) {
        const key = `${track.artist.toLowerCase()}::${track.name.toLowerCase()}`;
        const isObtained = obtainedSet.has(key);
        const cardData = collectionMap.get(key);

        if (isObtained && cardData) {
            obtainedCount++;
            // 取得済み: カード表示 + ランク番号
            const wrapper = document.createElement('div');
            wrapper.className = 'top200-slot top200-slot-obtained';

            const rankBadge = document.createElement('span');
            rankBadge.className = 'top200-rank-badge';
            rankBadge.textContent = `#${track.rank}`;
            wrapper.appendChild(rankBadge);

            const cardEl = renderCard(cardData, {
                compact: true,
                onClick: (c) => openCardDetail(c),
            });
            cardEl.style.width = '100%';
            cardEl.style.aspectRatio = '1 / 1';
            wrapper.appendChild(cardEl);

            grid.appendChild(wrapper);
        } else {
            // 未取得: カード裏面
            const backEl = renderCardBack(track.rank, track.artist, track.name);
            grid.appendChild(backEl);
        }
    }

    // 統計更新
    if (statsEl) {
        statsEl.innerHTML = `<span class="stat-badge">${obtainedCount}/200 取得済み</span>`;
    }

    // Lucideアイコン描画
    refreshIcons();
}

// ---- Filter Listeners ----

function setupFilterListeners() {
    // レアリティフィルタ
    const filterPills = document.getElementById('filter-rarity');
    if (filterPills) {
        filterPills.addEventListener('click', (e) => {
            const pill = e.target.closest('.pill');
            if (!pill) return;

            filterPills.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');

            currentFilter = pill.dataset.filter;
            renderCollection();
        });
    }

    // ソート
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentSort = e.target.value;
            renderCollection();
        });
    }

    // 検索
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        let debounce = null;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounce);
            debounce = setTimeout(() => {
                searchQuery = e.target.value;
                renderCollection();
            }, 300);
        });
    }
}

// グローバル参照
if (typeof window !== 'undefined') {
    window.MusicGacha = window.MusicGacha || {};
    window.MusicGacha.renderCollection = renderCollection;
    window.MusicGacha.initCollection = initCollection;
}
