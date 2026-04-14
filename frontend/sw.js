import { CacheFirst, ExpirationPlugin, NetworkFirst, Serwist, StaleWhileRevalidate } from 'serwist';

const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    precacheOptions: {
        cleanupOutdatedCaches: true,
    },
    skipWaiting: true,
    clientsClaim: true,
    runtimeCaching: [
        {
            matcher: ({ request, url }) => request.mode === 'navigate' || url.pathname.endsWith('.html'),
            handler: new NetworkFirst({
                cacheName: 'html-cache',
                networkTimeoutSeconds: 3,
                plugins: [
                    new ExpirationPlugin({
                        maxEntries: 5,
                        maxAgeSeconds: 60 * 60,
                    }),
                ],
            }),
        },
        {
            matcher: /\/(sw\.js|manifest\.webmanifest)$/,
            handler: new NetworkFirst({
                cacheName: 'critical-assets',
                plugins: [
                    new ExpirationPlugin({
                        maxEntries: 3,
                        maxAgeSeconds: 4 * 60 * 60,
                    }),
                ],
            }),
        },
        {
            matcher: /\.(?:png|jpg|jpeg|svg|webp|woff|woff2)$/,
            handler: new CacheFirst({
                cacheName: 'images',
                plugins: [
                    new ExpirationPlugin({
                        maxEntries: 60,
                        maxAgeSeconds: 7 * 24 * 60 * 60,
                    }),
                ],
            }),
        },
        {
            matcher: /\.(?:js|css)$/,
            handler: new StaleWhileRevalidate({
                cacheName: 'assets',
                plugins: [
                    new ExpirationPlugin({
                        maxEntries: 30,
                        maxAgeSeconds: 3 * 24 * 60 * 60,
                    }),
                ],
            }),
        },
    ],
});

serwist.addEventListeners();
