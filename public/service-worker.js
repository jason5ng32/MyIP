// service-worker.js
const CACHE_NAME = 'v2_cache';
const urlsToCache = [
    'defaultMap.jpg',
    'defaultMap_dark.jpg',
    'logo-144.png',
    'logo-192.png',
    'logo-256.png',
    'logo-512.png',
];

// 安装 Service Worker 时，缓存文件
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
    );
});
