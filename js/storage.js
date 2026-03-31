// ============================================================
// MusicGacha - Storage Module
// localStorage CRUD + パック回復ロジック
// ============================================================

import { getStorageSuffix } from './region.js';

// リージョン別キー（サフィックス付き）
function getRegionKey(base) {
  return base + getStorageSuffix();
}

// グローバル設定キー（リージョン共通）
const GLOBAL_KEYS = {
  SETTINGS: 'musicgacha_settings',
};

// リージョン別ストレージキーのベース名
const STORAGE_KEY_BASES = {
  COLLECTION: 'musicgacha_collection',
  PACKS: 'musicgacha_packs',
  TOP200: 'musicgacha_top200',
  FAVORITES: 'musicgacha_favorites',
  ACHIEVEMENTS: 'musicgacha_achievements',
};

// 互換性のためのSTORAGE_KEYS getter
const STORAGE_KEYS = new Proxy({}, {
  get(_, prop) {
    if (prop === 'SETTINGS') return GLOBAL_KEYS.SETTINGS;
    if (STORAGE_KEY_BASES[prop]) return getRegionKey(STORAGE_KEY_BASES[prop]);
    return undefined;
  }
});

const DEFAULT_PACKS = {
  current: 10,
  max: 10,
  lastRegenAt: new Date().toISOString(),
  totalOpened: 0,
  dailyBonusClaimed: null,
};

const DEFAULT_SETTINGS = {
  // language は意図的に除外 — 未設定(null)の場合はブラウザのリージョンから自動検出する
  selectedPack: 'standard',
  autoOpen: true,
  volume: '10',
  muted: false,
};

const PACK_REGEN_INTERVAL_MS = 60 * 1000; // 1分

// ---- Helpers ----

function safeGet(key, defaultValue) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`[Storage] Failed to parse ${key}:`, e);
    return defaultValue;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`[Storage] Failed to save ${key}:`, e);
  }
}

// ---- Collection ----

export function getCollection() {
  return safeGet(STORAGE_KEYS.COLLECTION, []);
}

export function saveCollection(collection) {
  safeSet(STORAGE_KEYS.COLLECTION, collection);
}

export function addCardToCollection(card) {
  const collection = getCollection();
  // 重複チェック: 同じ曲IDがあれば所持数+1
  const existing = collection.find(c => c.id === card.id);
  if (existing) {
    existing.count = (existing.count || 1) + 1;
  } else {
    card.count = 1;
    collection.push(card);
  }
  saveCollection(collection);
  return collection;
}

export function getUniqueCardCount() {
  return getCollection().length;
}

export function getTotalCardCount() {
  const collection = getCollection();
  return collection.reduce((sum, card) => sum + (card.count || 1), 0);
}

// ---- Packs ----

export function getPackData() {
  const data = safeGet(STORAGE_KEYS.PACKS, { ...DEFAULT_PACKS });
  // 回復計算
  return recalculatePacks(data);
}

export function savePackData(data) {
  safeSet(STORAGE_KEYS.PACKS, data);
}

function recalculatePacks(data) {
  if (data.current >= data.max) {
    data.lastRegenAt = new Date().toISOString();
    return data;
  }

  const now = Date.now();
  const lastRegen = new Date(data.lastRegenAt).getTime();
  const elapsed = now - lastRegen;

  if (elapsed < 0) {
    data.lastRegenAt = new Date().toISOString();
    return data;
  }

  const packsToAdd = Math.floor(elapsed / PACK_REGEN_INTERVAL_MS);

  if (packsToAdd > 0) {
    data.current = Math.min(data.current + packsToAdd, data.max);
    // 残りの時間を保持するため、加算分だけ進める
    data.lastRegenAt = new Date(lastRegen + packsToAdd * PACK_REGEN_INTERVAL_MS).toISOString();

    if (data.current >= data.max) {
      data.lastRegenAt = new Date().toISOString();
    }

    savePackData(data);
  }

  return data;
}

export function consumePack() {
  const data = getPackData();
  if (data.current <= 0) return null;

  data.current -= 1;
  data.totalOpened += 1;

  if (data.current < data.max && data.current === data.max - 1) {
    // 今回の消費で満タンから減った → リジェンタイマー開始
    data.lastRegenAt = new Date().toISOString();
  }

  savePackData(data);
  return data;
}

export function addPacks(count) {
  const data = getPackData();
  data.current = data.current + count;
  savePackData(data);
  return data;
}

/**
 * パックをフル回復 or +1
 * current < max → maxまで回復, current >= max → +1
 * @returns {{ data: Object, added: number }}
 */
export function recoverPacks() {
  const data = getPackData();
  let added;
  if (data.current < data.max) {
    added = data.max - data.current;
    data.current = data.max;
  } else {
    added = 1;
    data.current = data.current + 1;
  }
  savePackData(data);
  return { data, added };
}

export function isGoldPack() {
  const data = getPackData();
  return data.totalOpened > 0 && data.totalOpened % 10 === 0;
}

export function getNextRegenTime() {
  const data = getPackData();
  if (data.current >= data.max) return null;

  const lastRegen = new Date(data.lastRegenAt).getTime();
  const nextRegen = lastRegen + PACK_REGEN_INTERVAL_MS;
  const remaining = nextRegen - Date.now();

  return Math.max(0, remaining);
}

// ---- Daily Bonus ----

/** ローカルタイムゾーンの YYYY-MM-DD を返す */
function getLocalDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function canClaimDailyBonus() {
  const data = getPackData();
  const today = getLocalDateString();
  return data.dailyBonusClaimed !== today;
}

export function claimDailyBonus() {
  if (!canClaimDailyBonus()) return null;

  const data = getPackData();
  const today = getLocalDateString();
  data.dailyBonusClaimed = today;
  // フル回復 or +1
  let added;
  if (data.current < data.max) {
    added = data.max - data.current;
    data.current = data.max;
  } else {
    added = 1;
    data.current = data.current + 1;
  }
  savePackData(data);
  return { ...data, added };
}

// ---- Settings ----

export function getSettings() {
  return safeGet(STORAGE_KEYS.SETTINGS, { ...DEFAULT_SETTINGS });
}

export function saveSettings(settings) {
  safeSet(STORAGE_KEYS.SETTINGS, settings);
}

export function getSetting(key) {
  const settings = getSettings();
  return settings[key];
}

/**
 * 言語設定がユーザーによって明示的に保存されているか確認
 * （旧デフォルト値 'ja' の混入と、意図的な設定を区別するために使用）
 */
export function hasLanguageSetting() {
  try {
    const raw = localStorage.getItem(GLOBAL_KEYS.SETTINGS);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Object.prototype.hasOwnProperty.call(parsed, 'language');
  } catch (e) {
    return false;
  }
}

export function setSetting(key, value) {
  const settings = getSettings();
  settings[key] = value;
  saveSettings(settings);
}

// ---- Top 200 Progress ----

const DEFAULT_TOP200 = {
  chartDate: null,
  obtainedKeys: [],  // "artist_lower::title_lower" 形式
};

export function getTop200Data() {
  return safeGet(STORAGE_KEYS.TOP200, { ...DEFAULT_TOP200, obtainedKeys: [] });
}

export function saveTop200Data(data) {
  safeSet(STORAGE_KEYS.TOP200, data);
}

/**
 * Top 200で曲を取得したときに記録
 * @param {string} trackKey - "artist_lower::title_lower" 形式
 */
export function addTop200Obtained(trackKey) {
  const data = getTop200Data();
  if (!data.obtainedKeys.includes(trackKey)) {
    data.obtainedKeys.push(trackKey);
    saveTop200Data(data);
  }
}

/**
 * Top 200の残り曲数を返す
 * @param {number} totalTracks - チャートの総曲数（通常200）
 * @returns {number} 未取得の曲数
 */
export function getTop200Remaining(totalTracks = 200) {
  const data = getTop200Data();
  return Math.max(0, totalTracks - data.obtainedKeys.length);
}

/**
 * チャート更新時に日付を同期する（取得済みキーは永続保持）
 * @param {string} newChartDate - 新しいチャートの日付
 * @param {Array} newTracks - 新しいチャートの曲リスト [{artist, name}, ...]
 * @returns {Object} { kept: number, removed: number }
 */
export function syncTop200WithNewChart(newChartDate, newTracks) {
  const data = getTop200Data();

  const oldDate = data.chartDate;
  data.chartDate = newChartDate;
  saveTop200Data(data);

  if (oldDate && oldDate !== newChartDate) {
    console.log(`[Storage] Top 200 chart updated: ${oldDate} → ${newChartDate}, keys preserved: ${data.obtainedKeys.length}`);
  }

  return { kept: data.obtainedKeys.length, removed: 0 };
}

// ---- Favorites ----

export function getFavorites() {
  return new Set(safeGet(STORAGE_KEYS.FAVORITES, []));
}

export function toggleFavorite(cardId) {
  const favs = safeGet(STORAGE_KEYS.FAVORITES, []);
  const idx = favs.indexOf(cardId);
  if (idx >= 0) {
    favs.splice(idx, 1);
    safeSet(STORAGE_KEYS.FAVORITES, favs);
    return { isFavorite: false, cardId };
  } else {
    favs.push(cardId);
    safeSet(STORAGE_KEYS.FAVORITES, favs);
    return { isFavorite: true, cardId };
  }
}

export function isFavorite(cardId) {
  const favs = safeGet(STORAGE_KEYS.FAVORITES, []);
  return favs.includes(cardId);
}

// ---- Data Reset ----

export function resetAllData() {
  localStorage.removeItem(STORAGE_KEYS.COLLECTION);
  localStorage.removeItem(STORAGE_KEYS.PACKS);
  localStorage.removeItem(STORAGE_KEYS.TOP200);
  localStorage.removeItem(STORAGE_KEYS.FAVORITES);
  localStorage.removeItem(STORAGE_KEYS.ACHIEVEMENTS);
  // 設定はリセットしない
}

// ---- Init ----

export function initStorage() {
  // 初回起動: パックデータがなければ初期化
  if (!localStorage.getItem(STORAGE_KEYS.PACKS)) {
    savePackData({ ...DEFAULT_PACKS });
  }
  // 設定データがなければ初期化  
  if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
    saveSettings({ ...DEFAULT_SETTINGS });
  }
}
