(() => {
    if (!('serviceWorker' in navigator)) {
        return;
    }

    const CACHE_EPOCH = '20260218-3';
    const CACHE_EPOCH_KEY = 'webstack-cache-epoch';

    const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (location.protocol !== 'https:' && !isLocalhost) {
        return;
    }

    let hasRefreshed = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hasRefreshed) {
            return;
        }
        hasRefreshed = true;
        window.location.reload();
    });

    window.addEventListener('load', async () => {
        try {
            const lastEpoch = localStorage.getItem(CACHE_EPOCH_KEY);
            if (lastEpoch !== CACHE_EPOCH) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map((item) => item.unregister()));

                if ('caches' in window) {
                    const cacheKeys = await caches.keys();
                    await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
                }

                localStorage.setItem(CACHE_EPOCH_KEY, CACHE_EPOCH);
            }

            const registration = await navigator.serviceWorker.register('/sw.js?v=20260218-3', { scope: '/' });
            await registration.update();
            if (registration && registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
        } catch (error) {
            console.error('[PWA] Service Worker 注册失败:', error);
        }
    });
})();
