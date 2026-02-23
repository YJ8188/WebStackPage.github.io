const CORE_CACHE = 'webstack-core-v20260223-4';
const RUNTIME_CACHE = 'webstack-runtime-v20260223-4';

const CORE_ASSETS = [
    '/',
    '/index.html',
    '/login.html',
    '/about.html',
    '/erp-ant.html',
    '/404.html',
    '/offline.html',
    '/manifest.webmanifest',
    '/assets/images/favicon.png',
    '/assets/images/icon-192.png',
    '/assets/images/icon-512.png',
    '/assets/css/nav.css',
    '/assets/js/supabase-config.js',
    '/assets/js/user-data.js',
    '/assets/js/notification.js',
    '/assets/js/erp.js',
    '/assets/js/erp-ant-functions.js',
    '/assets/js/crypto.js',
    '/assets/js/metalsData.js',
    '/assets/js/pwa-register.js'
];

async function cacheCoreAssets() {
    const cache = await caches.open(CORE_CACHE);
    await Promise.all(CORE_ASSETS.map(async (assetUrl) => {
        try {
            await cache.add(new Request(assetUrl, { cache: 'reload' }));
        } catch (error) {
            console.warn('[SW] 预缓存失败:', assetUrl, error?.message || error);
        }
    }));
}

async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    const fetchPromise = fetch(request).then((response) => {
        if (response && (response.ok || response.type === 'opaque')) {
            cache.put(request, response.clone());
        }
        return response;
    }).catch(() => null);

    if (cached) {
        return cached;
    }

    const network = await fetchPromise;
    if (network) {
        return network;
    }

    throw new Error('network-and-cache-miss');
}

async function networkFirstWithCacheFallback(request, cacheName) {
    const cache = await caches.open(cacheName);
    try {
        const response = await fetch(request);
        if (response && (response.ok || response.type === 'opaque')) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await cache.match(request);
        if (cached) {
            return cached;
        }
        throw error;
    }
}

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        await cacheCoreAssets();
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names.map((name) => {
            if (name !== CORE_CACHE && name !== RUNTIME_CACHE) {
                return caches.delete(name);
            }
            return Promise.resolve();
        }));

        if (self.registration.navigationPreload) {
            await self.registration.navigationPreload.enable();
        }

        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);
    const isSameOrigin = url.origin === self.location.origin;

    if (request.mode === 'navigate') {
        event.respondWith((async () => {
            try {
                const preload = await event.preloadResponse;
                if (preload) {
                    const runtimeCache = await caches.open(RUNTIME_CACHE);
                    runtimeCache.put(request, preload.clone());
                    return preload;
                }

                const network = await fetch(request);
                const runtimeCache = await caches.open(RUNTIME_CACHE);
                runtimeCache.put(request, network.clone());
                return network;
            } catch (error) {
                const cached = await caches.match(request, { ignoreSearch: true });
                if (cached) {
                    return cached;
                }

                const offline = await caches.match('/offline.html');
                if (offline) {
                    return offline;
                }

                return new Response('当前离线，请稍后重试。', {
                    status: 503,
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                });
            }
        })());
        return;
    }

    const destination = request.destination;
    const shouldRuntimeCache = isSameOrigin && (
        destination === 'script'
        || destination === 'style'
        || destination === 'font'
        || destination === 'image'
        || destination === 'worker'
        || url.pathname.startsWith('/assets/')
    );

    if (!shouldRuntimeCache) {
        return;
    }

    const hasVersionQuery = isSameOrigin && url.searchParams.has('v');
    if (hasVersionQuery) {
        event.respondWith(networkFirstWithCacheFallback(request, RUNTIME_CACHE));
        return;
    }

    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
});

self.addEventListener('message', (event) => {
    if (event?.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
