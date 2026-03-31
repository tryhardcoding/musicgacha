// ============================================================
// MusicGacha - Service Worker
// 繧ｪ繝輔Λ繧､繝ｳ繧ｭ繝｣繝・す繝･ + 蜀崎ｨｪ蝠乗凾縺ｮ騾壻ｿ｡驥丞炎貂・
// ============================================================

const CACHE_VERSION = 'musicgacha-v48';

// 繝励Μ繧ｭ繝｣繝・す繝･縺吶ｋ髱咏噪繧｢繧ｻ繝・ヨ・亥・蝗槭う繝ｳ繧ｹ繝医・繝ｫ譎ゅ↓蜿門ｾ暦ｼ・
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
  '/js/region.js',
  '/js/achievements.js',
  '/js/transfer.js',
  '/js/share-sns.js',
  '/js/init.js',
  '/js/analytics.js',
  '/js/lucide.min.js',
  '/data/packs.json',
  '/data/genres.json',
  '/manifest.json',
  '/assets/favicon.svg',
  '/assets/favicon-192.png',
];

// WebP繝代ャ繧ｯ逕ｻ蜒上ｂ繝励Μ繧ｭ繝｣繝・す繝･
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

// ---- Install: 繝励Μ繧ｭ繝｣繝・す繝･ ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll([...PRECACHE_ASSETS, ...PACK_IMAGES]);
    }).then(() => {
      // 蠕・◆縺壹↓蜊ｳ蠎ｧ縺ｫ繧｢繧ｯ繝・ぅ繝門喧
      return self.skipWaiting();
    })
  );
});

// ---- Activate: 蜿､縺・く繝｣繝・す繝･繧貞炎髯､ ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      // 譌｢蟄倥・繝壹・繧ｸ繧貞叉蠎ｧ縺ｫ蛻ｶ蠕｡
      return self.clients.claim();
    })
  );
});

// ---- Fetch: 繝ｪ繧ｯ繧ｨ繧ｹ繝域姶逡･ ----
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. 螟夜Κ繝峨Γ繧､繝ｳ縺ｮ繝ｪ繧ｯ繧ｨ繧ｹ繝・竊・繧ｭ繝｣繝・す繝･縺励↑縺・ｼ亥ｺ・相繝ｻCDN繝ｻAPI・・
  if (url.origin !== self.location.origin) {
    return; // 繝悶Λ繧ｦ繧ｶ縺ｮ繝・ヵ繧ｩ繝ｫ繝亥虚菴懊↓莉ｻ縺帙ｋ
  }

  // 2. HTML (繝翫ン繧ｲ繝ｼ繧ｷ繝ｧ繝ｳ) 竊・Network First
  //    譛譁ｰ縺ｮHTML繧貞叙蠕励＠縲∝､ｱ謨玲凾縺ｯ繧ｭ繝｣繝・す繝･縺九ｉ
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // 3. songs.json 竊・Stale While Revalidate・亥､ｧ縺阪＞繝輔ぃ繧､繝ｫ縺ｪ縺ｮ縺ｧ繧ｭ繝｣繝・す繝･蜆ｪ蜈茨ｼ・
  if (url.pathname === '/data/songs.json') {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // 4. top200-daily.json 竊・Network First・域律谺｡譖ｴ譁ｰ繝・・繧ｿ・・
  if (url.pathname === '/data/top200-daily.json') {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // 5a. top200-history/index.json 竊・Network First・域律莉倥Μ繧ｹ繝医・譖ｴ譁ｰ縺輔ｌ繧具ｼ・
  if (url.pathname === '/data/top200-history/index.json') {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // 5b. top200-history・亥句挨譌･莉倥ヵ繧｡繧､繝ｫ・俄・ Cache First・磯℃蜴ｻ繝・・繧ｿ縺ｯ荳榊､会ｼ・
  if (url.pathname.startsWith('/data/top200-history/')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // 6. JS繝ｻCSS 竊・Network First・亥ｸｸ縺ｫ譛譁ｰ繧貞叙蠕励√が繝輔Λ繧､繝ｳ譎ゅ・縺ｿ繧ｭ繝｣繝・す繝･・・
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // 7. 髱咏噪繧｢繧ｻ繝・ヨ・育判蜒上・險ｭ螳哽SON・俄・ Cache First
  if (url.pathname.startsWith('/assets/') ||
      url.pathname === '/data/packs.json' ||
      url.pathname === '/data/genres.json') {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // 7. 縺昴・莉・竊・Network First
  event.respondWith(networkFirst(event.request));
});

// ---- 繧ｭ繝｣繝・す繝･謌ｦ逡･繝倥Ν繝代・ ----

/**
 * Cache First: 繧ｭ繝｣繝・す繝･縺ｫ縺ゅｌ縺ｰ縺昴ｌ繧定ｿ斐☆縲ゅ↑縺代ｌ縺ｰ繝阪ャ繝医Ρ繝ｼ繧ｯ縺九ｉ蜿門ｾ励＠縺ｦ繧ｭ繝｣繝・す繝･縲・
 * 髱咏噪繧｢繧ｻ繝・ヨ蜷代￠縲・
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
    // 繧ｪ繝輔Λ繧､繝ｳ譎ゅ↓繧ｭ繝｣繝・す繝･繧ゅ↑縺代ｌ縺ｰ繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * Network First: 繝阪ャ繝医Ρ繝ｼ繧ｯ繧貞━蜈医＠縲∝､ｱ謨玲凾縺ｯ繧ｭ繝｣繝・す繝･繧定ｿ斐☆縲・
 * HTML繝ｻ譌･谺｡譖ｴ譁ｰ繝・・繧ｿ蜷代￠縲・
 */
async function networkFirst(request) {
  try {
    // cache: 'no-cache' 縺ｧ繝悶Λ繧ｦ繧ｶHTTP繧ｭ繝｣繝・す繝･繧偵ヰ繧､繝代せ縺励・
    // 蟶ｸ縺ｫ繧ｵ繝ｼ繝舌・縺九ｉ譛譁ｰ迚医ｒ蜿門ｾ暦ｼ・SM繧､繝ｳ繝昴・繝医・繧ｭ繝｣繝・す繝･蝠城｡悟ｯｾ遲厄ｼ・
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
 * Stale While Revalidate: 繧ｭ繝｣繝・す繝･繧貞叉蠎ｧ縺ｫ霑斐＠縺､縺､縲√ヰ繝・け繧ｰ繝ｩ繧ｦ繝ｳ繝峨〒譖ｴ譁ｰ縲・
 * songs.json蜷代￠・亥､ｧ縺阪＞繝輔ぃ繧､繝ｫ縺縺後◆縺ｾ縺ｫ譖ｴ譁ｰ縺輔ｌ繧具ｼ峨・
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);

  // 繝舌ャ繧ｯ繧ｰ繝ｩ繧ｦ繝ｳ繝峨〒譛譁ｰ迚医ｒ蜿門ｾ暦ｼ・TTP繧ｭ繝｣繝・す繝･繧偵ヰ繧､繝代せ・・
  const fetchPromise = fetch(request, { cache: 'no-cache' }).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  // 繧ｭ繝｣繝・す繝･縺後≠繧後・縺吶＄霑斐☆縲√↑縺代ｌ縺ｰ繝阪ャ繝医Ρ繝ｼ繧ｯ繧貞ｾ・▽
  return cached || fetchPromise || new Response('Offline', { status: 503 });
}

/**
 * Stale While Revalidate (讀懃ｴ｢繝代Λ繝｡繝ｼ繧ｿ辟｡隕也沿):
 * ?v=xxx 縺ｪ縺ｩ縺ｮ繧ｭ繝｣繝・す繝･繝舌せ繝・ぅ繝ｳ繧ｰ繝代Λ繝｡繝ｼ繧ｿ繧堤┌隕悶＠縺ｦ繧ｭ繝｣繝・す繝･繧偵・繝・メ縺輔○繧九・
 * JS繝ｻCSS蜷代￠縲・
 */
async function staleWhileRevalidateIgnoreSearch(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request, { ignoreSearch: true });

  // 繝舌ャ繧ｯ繧ｰ繝ｩ繧ｦ繝ｳ繝峨〒譛譁ｰ迚医ｒ蜿門ｾ暦ｼ医ヱ繝ｩ繝｡繝ｼ繧ｿ辟｡縺励・URL縺ｧ繧ｭ繝｣繝・す繝･・・
  const url = new URL(request.url);
  url.search = '';
  const cleanRequest = new Request(url.toString(), { mode: 'cors' });

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      // 繝代Λ繝｡繝ｼ繧ｿ辟｡縺励・URL繧偵く繝ｼ縺ｨ縺励※繧ｭ繝｣繝・す繝･縺ｫ菫晏ｭ・
      cache.put(cleanRequest, response.clone());
    }
    return response;
  }).catch(() => null);

  return cached || fetchPromise || new Response('Offline', { status: 503 });
}
