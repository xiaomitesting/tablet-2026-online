const CACHE_NAME = 'tablet-2026-v3';

// 需要缓存的核心资源
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './css/style.css',
  './js/app.js',
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

// 安装 → 缓存核心资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 激活 → 清除旧缓存
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

// 请求拦截 → Cache First，离线回退
self.addEventListener('fetch', event => {
  // 只处理 GET 请求
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;

        return fetch(event.request)
          .then(response => {
            // 只缓存同源请求
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // 克隆一份用于缓存
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, responseToCache));

            return response;
          })
          .catch(() => {
            // 离线时请求网络失败
            // 如果是页面请求，返回离线页
            if (event.request.mode === 'navigate') {
              return caches.match('./offline.html');
            }
            // 其他请求直接失败
            return new Response('Offline', { status: 503 });
          });
      })
  );
});
