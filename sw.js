const CACHE_NAME = 'tablet-2026-v13';

const CORE_ASSETS = [
  './',
  './style.css',
  './css/style.css',
  './js/data/products.json',
  './js/modules/quiz-data.js',
  './assets/xiaomi-logo-square.png',
  './assets/mi-logo.png',
  './assets/mi-logo.svg',
  './favicon.ico',
  './favicon-16x16.png',
  './favicon-32x32.png',
  './favicon.svg',
  './apple-touch-icon.png',
  './offline.html'
];

// ─── 安裝：緩存資源，立即跳過等待 ───
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
  // 強制立即跳過等待，激活新 SW
  self.skipWaiting();
});

// ─── 激活：清舊緩存 + 強制所有頁面刷新 ───
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── 監聽頁面消息 ───
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'skip-waiting') {
    self.skipWaiting();
  }
});

// ─── 請求攔截 ───
// HTML 頁面：Network First（確保拿到最新版）
// 靜態資源：Cache First（快速 + 離線可用）
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const isHTMLPage = event.request.mode === 'navigate'
    || (event.request.headers.get('accept') || '').includes('text/html');

  if (isHTMLPage) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('./offline.html')))
    );
  } else {
    event.respondWith(
      caches.match(event.request)
        .then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (!response || response.status !== 200 || response.type !== 'basic') return response;
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            return response;
          }).catch(() => new Response('Offline', { status: 503 }));
        })
    );
  }
});
