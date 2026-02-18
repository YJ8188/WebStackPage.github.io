(() => {
    if (!('serviceWorker' in navigator)) {
        return;
    }

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
            const registration = await navigator.serviceWorker.register('/sw.js?v=20260218-2', { scope: '/' });
            await registration.update();
            if (registration && registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
        } catch (error) {
            console.error('[PWA] Service Worker 注册失败:', error);
        }
    });
})();
