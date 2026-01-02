const CryptoEngine = (() => {
    let allGateTickers = [];
    let tickerCache = {};
    let isInitialSyncDone = false;
    let localStorageKey = 'gate_tickers_full_v2';

    // 1. Initial Load Cache
    try {
        const saved = localStorage.getItem(localStorageKey);
        if (saved) {
            allGateTickers = JSON.parse(saved);
        }
    } catch (e) {
        console.error('Engine Cache Load Failed', e);
    }

    // 2. Background Sync
    const syncAllTickers = async () => {
        try {
            const res = await fetch('https://api.gateio.ws/api/v4/spot/tickers', { mode: 'cors' });
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 500) {
                    allGateTickers = data;
                    localStorage.setItem(localStorageKey, JSON.stringify(data));
                    isInitialSyncDone = true;
                }
            }
        } catch (e) {
            console.error('Background Sync Failed', e);
        }
    };
    syncAllTickers();
    setInterval(syncAllTickers, 60000); // Sync every minute

    return {
        async search(query) {
            query = query.trim().toLowerCase();
            if (!query) return [];

            // Ensure we have some data
            if (allGateTickers.length === 0) {
                await syncAllTickers();
            }

            // High Precision Filter
            const filtered = allGateTickers.filter(item => {
                const pair = item.currency_pair.toLowerCase();
                const symbol = pair.split('_')[0];
                return (symbol.includes(query) || pair.includes(query)) &&
                    (pair.endsWith('_usdt') || pair.endsWith('_btc')) &&
                    !pair.includes('3l_') && !pair.includes('3s_');
            });

            // Sort by volume
            filtered.sort((a, b) => parseFloat(b.quote_volume) - parseFloat(a.quote_volume));

            return filtered.slice(0, 30).map(item => {
                const symbol = item.currency_pair.split('_')[0].toLowerCase();
                return {
                    id: symbol,
                    symbol: symbol,
                    name: symbol.toUpperCase(),
                    image: `https://gimg2.gateimg.com/coin_icon/64/${symbol}.png`,
                    current_price: parseFloat(item.last),
                    price_change_percentage_24h: parseFloat(item.change_percentage),
                    market_cap: parseFloat(item.quote_volume) * 7.5,
                    total_volume: parseFloat(item.quote_volume),
                    sparkline_in_7d: null
                };
            });
        },
        getAllSyncStatus() {
            return isInitialSyncDone;
        }
    };
})();
window.CryptoEngine = CryptoEngine;
