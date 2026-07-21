const CACHE_NAME = 'tablet-2026-v9';

// 需要缓存的核心资源
const CORE_ASSETS = [
  './',
  './index.html',
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

// ─── SW 版本广播：通知所有頁面「有新版本」───
const VERSION_CHANNEL = 'sw-version-update';

function notifyClientsNewVersion() {
  self.clients.matchAll({ type: 'window' }).then(clients => {
    clients.forEach(client => client.postMessage({ type: VERSION_CHANNEL }));
  });
}

// 安装 → 缓存核心资源 → 立即激活
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())   // 跳过等待，立即激活
  );
});

// 激活 → 清除旧缓存 → 接管所有页面
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      )
    ).then(() => {
      self.clients.claim();             // 立即接管所有页面
      notifyClientsNewVersion();         // 通知页面有新版本
    })
  );
});

// 监听页面发来的 skip-waiting 消息
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'skip-waiting') {
    self.skipWaiting();
  }
});

// 请求拦截
// - HTML 页面：Network First（确保拿到最新版）
// - 静态资源：Cache First（快速加载 + 离线可用）
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
