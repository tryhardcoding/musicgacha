// ============================================================
// MusicGacha - Service Worker
// オフラインキャッシュ + 再訪問時の通信量削減
// ============================================================

const CACHE_VERSION = 'musicgacha-v23';

// プリキャッシュする静的アセット（初回インストール時に取得）
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/index.css',
  '/js/app.js',
  '/js/api.js',
  '/js/card.js',
  '/js/card-renderer.js',
  '/js/collection.js',
  '/js/data-loader.js',
  '/js/gacha.js',
  '/js/i18n.js',
  '/js/icons.js',
  '/js/storage.js',
  '/js/ads.js',
  '/js/affiliate.js',
  '/js/amazon-cta.js',
  '/js/pack-animation.js',
  '/js/transfer.js',
  '/js/share-sns.js',
  '/js/init.js',
  '/data/packs.json',
  '/data/genres.json',
  '/manifest.json',
  '/assets/favicon.svg',
];

// WebPパック画像もプリキャッシュ
const PACK_IMAGES = [
  '/assets/pack-anime.webp',
  '/assets/pack-hiphop.webp',
  '/assets/pack-jpop.webp',
  '/assets/pack-kpop.webp',
  '/assets/pack-standard.webp',
  '/assets/pack-top200.webp',
  '/assets/pack-vocaloid.webp',
  '/assets/pack-western.webp',
];

// ---- Install: プリキャッシュ ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll([...PRECACHE_ASSETS, ...PACK_IMAGES]);
    }).then(() => {
      // 待たずに即座にアクティブ化
      return self.skipWaiting();
    })
  );
});

// ---- Activate: 古いキャッシュを削除 ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      // 既存のページを即座に制御
      return self.clients.claim();
    })
  );
});

// ---- Fetch: リクエスト戦略 ----
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. 外部ドメインのリクエスト → キャッシュしない（広告・CDN・API）
  if (url.origin !== self.location.origin) {
    return; // ブラウザのデフォルト動作に任せる
  }

  // 2. HTML (ナビゲーション) → Network First
  //    最新のHTMLを取得し、失敗時はキャッシュから
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // 3. songs.json → Stale While Revalidate（大きいファイルなのでキャッシュ優先）
  if (url.pathname === '/data/songs.json') {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // 4. top200-daily.json → Network First（日次更新データ）
  if (url.pathname === '/data/top200-daily.json') {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // 5a. top200-history/index.json → Network First（日付リストは更新される）
  if (url.pathname === '/data/top200-history/index.json') {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // 5b. top200-history（個別日付ファイル）→ Cache First（過去データは不変）
  if (url.pathname.startsWith('/data/top200-history/')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // 6. JS・CSS → Network First（常に最新を取得、オフライン時のみキャッシュ）
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // 7. 静的アセット（画像・設定JSON）→ Cache First
  if (url.pathname.startsWith('/assets/') ||
      url.pathname === '/data/packs.json' ||
      url.pathname === '/data/genres.json') {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // 7. その他 → Network First
  event.respondWith(networkFirst(event.request));
});

// ---- キャッシュ戦略ヘルパー ----

/**
 * Cache First: キャッシュにあればそれを返す。なければネットワークから取得してキャッシュ。
 * 静的アセット向け。
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // オフライン時にキャッシュもなければフォールバック
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * Network First: ネットワークを優先し、失敗時はキャッシュを返す。
 * HTML・日次更新データ向け。
 */
async function networkFirst(request) {
  try {
    // cache: 'no-cache' でブラウザHTTPキャッシュをバイパスし、
    // 常にサーバーから最新版を取得（ESMインポートのキャッシュ問題対策）
    const response = await fetch(request, { cache: 'no-cache' });
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * Stale While Revalidate: キャッシュを即座に返しつつ、バックグラウンドで更新。
 * songs.json向け（大きいファイルだがたまに更新される）。
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);

  // バックグラウンドで最新版を取得（HTTPキャッシュをバイパス）
  const fetchPromise = fetch(request, { cache: 'no-cache' }).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  // キャッシュがあればすぐ返す、なければネットワークを待つ
  return cached || fetchPromise || new Response('Offline', { status: 503 });
}

/**
 * Stale While Revalidate (検索パラメータ無視版):
 * ?v=xxx などのキャッシュバスティングパラメータを無視してキャッシュをマッチさせる。
 * JS・CSS向け。
 */
async function staleWhileRevalidateIgnoreSearch(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request, { ignoreSearch: true });

  // バックグラウンドで最新版を取得（パラメータ無しのURLでキャッシュ）
  const url = new URL(request.url);
  url.search = '';
  const cleanRequest = new Request(url.toString(), { mode: 'cors' });

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      // パラメータ無しのURLをキーとしてキャッシュに保存
      cache.put(cleanRequest, response.clone());
    }
    return response;
  }).catch(() => null);

  return cached || fetchPromise || new Response('Offline', { status: 503 });
}
