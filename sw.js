/**
 * Service Worker — Network First with Cache Fallback
 *
 * 策略：
 * - 頁面/JS/CSS：先嘗試網路，失敗時用快取（確保拿到最新版）
 * - 資料 JSON：同上，離線時展示上次成功的快取
 * - 外部資源（字體、CDN）：Cache First（不常變動）
 */

const CACHE_NAME = 'dashboard-v1';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
];

// 安裝：預快取核心檔案
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// 啟用：清除舊版本快取
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// 請求攔截
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 外部資源（Google Fonts、CDN）→ Cache First
  if (url.origin !== location.origin) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // 本地資源 → Network First
  event.respondWith(networkFirst(event.request));
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}
