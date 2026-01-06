// Crypto Logic - Digital Currency Module
let currentCurrency = 'USD';
let cryptoData = [];
let isSearching = false;
let USD_CNY_RATE = 7.25; // Default, will be updated dynamically
let lastRateUpdate = 0;

// Sparkline Cache & Utils
const sparklineCache = {};
const sparklineRequests = new Set();
const COIN_ID_MAP = {
    'btc': 'bitcoin', 'eth': 'ethereum', 'usdt': 'tether', 'bnb': 'binance-coin',
    'xrp': 'ripple', 'sol': 'solana', 'doge': 'dogecoin', 'ada': 'cardano',
    'trx': 'tron', 'ton': 'toncoin', 'shib': 'shiba-inu', 'ltc': 'litecoin',
    'etc': 'ethereum-classic', 'link': 'chainlink', 'uni': 'uniswap', 'bch': 'bitcoin-cash',
    'arb': 'arbitrum', 'op': 'optimism', 'tia': 'celestia', 'sei': 'sei-network',
    'pepe': 'pepe', 'stx': 'stacks', 'apt': 'aptos', 'floki': 'floki', 'fet': 'fetch-ai',
    'bonk': 'bonk', 'kas': 'kaspa', 'rndr': 'render-token', 'inj': 'injective',
    'near': 'near-protocol', 'bch': 'bitcoin-cash', 'uni': 'uniswap', 'ldo': 'lido-dao',
    'icp': 'internet-computer', 'apt': 'aptos', 'mnt': 'mantle', 'kas': 'kaspa'
};

// Data persistence & cache
let allGateTickers = []; // Master list from Gate.io for global search
const expandedCoins = new Set();

async function loadSparkline(id, symbol, changePct) {
    if (sparklineCache[symbol] || sparklineRequests.has(symbol)) return;
    const finalId = id || COIN_ID_MAP[symbol] || symbol.toLowerCase();
    if (!finalId) return;

    sparklineRequests.add(symbol);
    const containers = document.querySelectorAll(`.graph-container-${symbol}`);
    containers.forEach(el => {
        // Better loading state
        el.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:30px; opacity:0.6;">
            <i class="fa fa-spinner fa-spin" style="font-size:12px; margin-right:6px; color:#10b981;"></i>
            <span style="font-size:10px; color:#10b981;">数据同步中...</span>
        </div>`;
    });

    async function tryFetch() {
        let prices = null;
        // 1. Try CryptoCompare (Fastest chart API)
        try {
            const res = await fetchWithTimeout(`https://min-api.cryptocompare.com/data/v2/histohour?fsym=${symbol.toUpperCase()}&tsym=USD&limit=168`, { timeout: 7000 });
            if (res.ok) {
                const json = await res.json();
                if (json.Data && json.Data.Data && json.Data.Data.length > 0) {
                    prices = json.Data.Data.map(d => d.close).filter(p => !isNaN(p));
                }
            }
        } catch (e) { }

        // 2. Fallback to CoinCap
        if (!prices) {
            try {
                const end = Date.now();
                const start = end - (7 * 24 * 60 * 60 * 1000);
                const res = await fetchWithTimeout(`https://api.coincap.io/v2/assets/${finalId}/history?interval=h2&start=${start}&end=${end}`, { timeout: 5000 });
                if (res.ok) {
                    const json = await res.json();
                    if (json.data && json.data.length > 0) {
                        prices = json.data.map(d => parseFloat(d.priceUsd));
                    }
                }
            } catch (e) { }
        }
        return prices;
    }

    try {
        let prices = await tryFetch();
        // Auto-retry once after 3 seconds if failed
        if (!prices) {
            await new Promise(r => setTimeout(r, 3000));
            prices = await tryFetch();
        }

        // 3. Last Resort: CoinGecko (Backup)
        if (!prices) {
            try {
                const geckoRes = await fetchWithTimeout(`https://api.coingecko.com/api/v3/coins/${finalId}/market_chart?vs_currency=usd&days=7&interval=daily`, { timeout: 5000 });
                if (geckoRes.ok) {
                    const json = await geckoRes.json();
                    if (json.prices && json.prices.length > 0) {
                        prices = json.prices.map(p => p[1]);
                    }
                }
            } catch (e) { }
        }

        if (prices && prices.length > 2) {
            sparklineCache[symbol] = prices;
            document.querySelectorAll(`.graph-container-${symbol}`).forEach(target => {
                const isDetail = target.id.startsWith('graph-detail-');
                target.innerHTML = generateSparklineSvg(prices, changePct, isDetail ? 240 : 100);
            });
        } else {
            throw new Error('No data');
        }
    } catch (e) {
        document.querySelectorAll(`.graph-container-${symbol}`).forEach(target => {
            target.innerHTML = `<a href="javascript:void(0)" onclick="loadSparkline(null, '${symbol}', ${changePct})"
                style="color:#888; font-size:10px; text-decoration:none; border:1px solid #444; padding:2px 6px; border-radius:10px; display:inline-block; transition:all 0.3s;"
                onmouseover="this.style.borderColor='#10b981';this.style.color='#10b981'"
                onmouseout="this.style.borderColor='#444';this.style.color='#888'">
                <i class="fa fa-refresh" style="margin-right:3px;"></i>补全趋势
            </a>`;
        });
    } finally {
        sparklineRequests.delete(symbol);
    }
}

function generateSparklineSvg(prices, changePct, width = 100) {
    if (!prices || prices.length < 2) return '-';
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const height = 48;
    const padding = 12;
    const innerHeight = height - (padding * 2);
    const range = max - min || 1;

    let points = '';
    let maxPoint = { x: 0, y: height };
    let minPoint = { x: 0, y: 0 };

    prices.forEach((p, i) => {
        const x = (i / (prices.length - 1)) * width;
        const y = padding + innerHeight - ((p - min) / range) * innerHeight;
        points += `${x},${y} `;

        if (p === max) maxPoint = { x, y, val: p };
        if (p === min) minPoint = { x, y, val: p };
    });

    const color = changePct >= 0 ? '#ef4444' : '#10b981';
    const gradId = `grad-${Math.random().toString(36).substr(2, 8)}`;
    const fillPoints = `0,${height} ` + points + ` ${width},${height}`;
    const formatPrice = (p) => p < 1 ? p.toFixed(4) : (p > 1000 ? p.toLocaleString(undefined, { maximumFractionDigits: 1 }) : p.toFixed(2));

    return `<svg width="${width}" height="${height}" class="sparkline-svg" preserveAspectRatio="none">
        <defs>
            <linearGradient id="${gradId}" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:${color};stop-opacity:0.25" />
                <stop offset="100%" style="stop-color:${color};stop-opacity:0" />
            </linearGradient>
        </defs>
        <polygon points="${fillPoints}" fill="url(#${gradId})" />
        <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${maxPoint.x}" cy="${maxPoint.y}" r="2.5" fill="#ef4444" />
        <text x="${maxPoint.x}" y="${maxPoint.y - 4}" class="sparkline-point-label" text-anchor="${maxPoint.x > width * 0.7 ? 'end' : 'start'}" style="fill:#ef4444; font-size:10px;">${formatPrice(maxPoint.val)}</text>
        <circle cx="${minPoint.x}" cy="${minPoint.y}" r="2.5" fill="#10b981" />
        <text x="${minPoint.x}" y="${minPoint.y + 12}" class="sparkline-point-label" text-anchor="${minPoint.x > width * 0.7 ? 'end' : 'start'}" style="fill:#10b981; font-size:10px;">${formatPrice(minPoint.val)}</text>
    </svg>`;
}

// Helper: Fetch with Timeout to prevent hanging
async function fetchWithTimeout(resource, options = {}) {
    // Reset timeout to 8s for slower proxies
    const { timeout = 8000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(resource, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

// Success Handler
function onSuccess(dot, providerName, freshData) {
    const label = document.getElementById('api-provider-name');
    if (dot) dot.style.color = '#10b981';
    if (label && !isSearching) label.innerText = providerName;

    // Always update UI elements if they exist
    if (freshData) updateCryptoUI(freshData);

    // If NOT searching, handle table sync
    if (!isSearching) {
        const tbody = document.getElementById('crypto-table-body');
        const rowCount = tbody ? tbody.querySelectorAll('.main-row').length : 0;

        // Force re-render if coin count changed (e.g. from 12 to 50)
        if (rowCount !== cryptoData.length) {
            renderCryptoTable(cryptoData);
        } else {
            // Otherwise just update prices/changes
            updateCryptoUI(freshData);
        }
    }
}

// Add this new function to help search results update too
async function updateSearchPrices() {
    const query = document.getElementById('crypto-search').value.trim();
    if (!query || !isSearching) return;

    try {
        // For search results, we just update what's in cryptoData or do another search
        // Better: just fetch standard data and let updateCryptoUI do its job
        fetchCryptoData();
    } catch (e) { }
}

// API Strategies configuration
const APIS = {
    GATEIO: {
        name: 'Gate.io (Official)',
        url: 'https://api.gateio.ws/api/v4/spot/tickers', // Returns all tickers, need filtering
        handler: (data) => {
            // 0. Backup all tickers for global search
            allGateTickers = data;

            // 1. Sync Exchange Rate (Fixed issue with finding USDT_CNY accurately)
            const usdtCny = data.find(item => item.currency_pair === 'USDT_CNY');
            if (usdtCny && usdtCny.last) {
                USD_CNY_RATE = parseFloat(usdtCny.last);
                lastRateUpdate = Date.now();
            }

            // 2. Filter USDT pairs and sort by volume to get Top 50
            const sortedTickers = data
                .filter(item => item.currency_pair.endsWith('_USDT'))
                .filter(item => !item.currency_pair.includes('3L_') && !item.currency_pair.includes('3S_')) // Exclude leveraged
                .sort((a, b) => parseFloat(b.quote_volume) - parseFloat(a.quote_volume))
                .slice(0, 50);

            return sortedTickers.map(item => {
                const symbol = item.currency_pair.split('_')[0].toLowerCase();
                const nameMap = {
                    'btc': 'Bitcoin', 'eth': 'Ethereum', 'usdt': 'Tether', 'bnb': 'BNB',
                    'xrp': 'Ripple', 'sol': 'Solana', 'doge': 'Dogecoin', 'ada': 'Cardano',
                    'trx': 'Tron', 'ton': 'Toncoin', 'shib': 'Shiba Inu', 'ltc': 'Litecoin',
                    'pepe': 'PEPE', 'link': 'Chainlink', 'near': 'NEAR Protocol', 'apt': 'Aptos'
                };
                return {
                    id: symbol,
                    symbol: symbol,
                    name: nameMap[symbol] || symbol.toUpperCase(),
                    image: `https://gimg2.gateimg.com/coin_icon/64/${symbol}.png`,
                    current_price: parseFloat(item.last),
                    price_change_percentage_24h: parseFloat(item.change_percentage),
                    market_cap: parseFloat(item.quote_volume) * 7.5, // Proxy for display
                    total_volume: parseFloat(item.quote_volume),
                    sparkline_in_7d: null
                };
            });
        }
    },
    CRYPTOCOMPARE: {
        name: 'CryptoCompare',
        // Fetching top 50 by volume from CC
        url: 'https://min-api.cryptocompare.com/data/top/totalvolfull?limit=50&tsym=USD',
        handler: (data) => {
            if (!data.Data) throw new Error("Invalid CC Data");
            return data.Data.map(item => {
                const coin = item.RAW.USD;
                return {
                    id: item.CoinInfo.Name.toLowerCase(),
                    symbol: item.CoinInfo.Name.toLowerCase(),
                    name: item.CoinInfo.FullName,
                    image: 'https://www.cryptocompare.com' + coin.IMAGEURL,
                    current_price: coin.PRICE,
                    price_change_percentage_24h: coin.CHANGEPCT24HOUR,
                    market_cap: coin.MKTCAP,
                    sparkline_in_7d: null
                };
            });
        }
    },
    COINCAP: {
        name: 'CoinCap',
        // Fetching top 50 by market cap from CoinCap
        url: 'https://api.coincap.io/v2/assets?limit=50',
        handler: (data) => {
            return data.data.map(item => ({
                id: item.id,
                symbol: item.symbol.toLowerCase(),
                name: item.name,
                image: `https://gimg2.gateimg.com/coin_icon/64/${item.symbol.toLowerCase()}.png`, // Use gate icons as they are better
                current_price: parseFloat(item.priceUsd),
                price_change_percentage_24h: parseFloat(item.changePercent24Hr),
                market_cap: parseFloat(item.marketCapUsd),
                sparkline_in_7d: null
            }));
        }
    },
    COINGECKO: {
        name: 'CoinGecko',
        // Fetching top 50 by market cap from CoinGecko
        url: 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h',
        handler: (data) => data.map(item => ({
            id: item.id,
            symbol: item.symbol.toLowerCase(),
            name: item.name,
            image: item.image,
            current_price: item.current_price,
            price_change_percentage_24h: item.price_change_percentage_24h,
            market_cap: item.market_cap,
            sparkline_in_7d: null
        }))
    }
};

function toggleCurrency() {
    const btn = document.getElementById('currency-toggle');
    if (currentCurrency === 'USD') {
        currentCurrency = 'CNY';
        btn.innerText = 'CNY';
        btn.className = 'btn btn-xs btn-warning';
    } else {
        currentCurrency = 'USD';
        btn.innerText = 'USD';
        btn.className = 'btn btn-xs btn-primary';
    }
    renderCryptoTable(cryptoData);
}

// 1. Racing Engine with Local Cache fallback
async function fetchCryptoData() {
    const dot = document.getElementById('api-status-dot');
    const label = document.getElementById('api-provider-name');
    const tbody = document.getElementById('crypto-table-body');
    const refreshIcon = document.querySelector('#refresh-crypto-btn i');

    dot.style.color = '#f59e0b'; // Fetching state
    if (refreshIcon) refreshIcon.classList.add('fa-spin');

    // A. Try to load from Local Storage immediately for "Instant Load" feel
    if (cryptoData.length === 0) {
        const cached = localStorage.getItem('crypto_market_cache');
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (parsed && parsed.length > 0) {
                    cryptoData = parsed;
                    renderCryptoTable(cryptoData);
                    if (label) label.innerText = 'Cached Source';
                }
            } catch (e) { }
        }
    }

    // B. Sync Exchange Rate (Gate.io USDT_CNY) - background
    const syncRate = async () => {
        if (Date.now() - lastRateUpdate > 30000) {
            try {
                const res = await fetchWithTimeout('https://api.gateio.ws/api/v4/spot/tickers?currency_pair=USDT_CNY', { timeout: 5000 });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data[0] && data[0].last) {
                        USD_CNY_RATE = parseFloat(data[0].last);
                        lastRateUpdate = Date.now();
                    }
                }
            } catch (e) { }
        }
    };
    syncRate();

    // C. Parallel Racing Mode (The core optimization)
    const fetchSource = async (apiObj) => {
        const res = await fetchWithTimeout(apiObj.url, { timeout: 15000 });
        if (!res.ok) throw new Error(`${apiObj.name} Failed`);
        const data = await res.json();
        return { name: apiObj.name, data: apiObj.handler(data) };
    };

    try {
        // Priority Racing: Start all main sources at once
        // We use Promise.any for speed, but Gate.io is still our accuracy target.
        // However, stability first. We'll take the first one that responds.
        const fastestResult = await Promise.any([
            fetchSource(APIS.GATEIO),
            fetchSource(APIS.CRYPTOCOMPARE),
            fetchSource(APIS.COINCAP)
        ]);

        if (fastestResult && fastestResult.data) {
            cryptoData = fastestResult.data;
            onSuccess(dot, fastestResult.name, fastestResult.data);
            // Persist to local storage for offline use
            localStorage.setItem('crypto_market_cache', JSON.stringify(cryptoData));
            return;
        }
    } catch (e) {
        // D. Fallback to CoinGecko if all initial racing fail
        try {
            if (label) label.innerText = 'Fallback (CG)...';
            const geckoRes = await fetchSource(APIS.COINGECKO);
            cryptoData = geckoRes.data;
            onSuccess(dot, geckoRes.name, geckoRes.data);
            localStorage.setItem('crypto_market_cache', JSON.stringify(cryptoData));
            return;
        } catch (ge) {
            // E. Final Fail: If we have cached data, don't show the red error box
            if (cryptoData.length > 0) {
                dot.style.color = '#ef4444'; // Signal failure silently
                if (label) label.innerText = 'Sync Off (Local)';
            } else {
                // Full Failure UI
                dot.style.color = '#ef4444';
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color: #ef4444;">
                    <i class="fa fa-exclamation-triangle"></i> 连接超时，请检查网络或代理。<br>
                    <button class="btn btn-xs btn-primary" style="margin-top:10px" onclick="fetchCryptoData()">重试连接</button>
                </td></tr>`;
            }
        }
    } finally {
        if (refreshIcon) refreshIcon.classList.remove('fa-spin');
    }
}

function renderCryptoTable(data) {
    if (!data || data.length === 0) return;
    const tbody = document.getElementById('crypto-table-body');
    const searchQuery = document.getElementById('crypto-search').value.toLowerCase();
    tbody.innerHTML = '';

    const isCNY = currentCurrency === 'CNY';
    const rate = isCNY ? USD_CNY_RATE : 1;
    const symbol = isCNY ? '¥' : '$';

    const orderMap = { 'btc': 1, 'eth': 2, 'usdt': 3, 'bnb': 4, 'sol': 5, 'xrp': 6, 'etc': 7, 'doge': 8 };
    data.sort((a, b) => {
        const scoreA = orderMap[a.symbol] || 999;
        const scoreB = orderMap[b.symbol] || 999;
        if (scoreA !== scoreB) return scoreA - scoreB;
        return (b.market_cap || 0) - (a.market_cap || 0);
    });

    data.forEach(coin => {
        const searchName = coin.name || coin.symbol;
        if (!searchName.toLowerCase().includes(searchQuery) && !coin.symbol.toLowerCase().includes(searchQuery))
            return;

        const rawPrice = coin.current_price;
        const price = (rawPrice * rate).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: (rawPrice < 1 ? 4 : 2)
        });

        const secondarySymbol = isCNY ? '$' : '¥';
        const secondaryPrice = (rawPrice * (isCNY ? 1 : USD_CNY_RATE)).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: (rawPrice < 1 ? 4 : 2)
        });

        const change = coin.price_change_percentage_24h;
        const changeClass = change >= 0 ? 'change-up' : 'change-down';
        const changeSign = change >= 0 ? '+' : '';

        const mkVal = coal(coin.market_cap);
        const marketCap = mkVal > 0 ? (mkVal * rate).toLocaleString(undefined, { maximumFractionDigits: 0, notation: "compact" }) : '-';

        const volVal = coal(coin.total_volume || (mkVal / 100));
        const volume = (volVal * rate).toLocaleString(undefined, { maximumFractionDigits: 0, notation: "compact" });

        let sparklineContent = '';
        let sparklineDetail = '';
        const cached = sparklineCache[coin.symbol];
        if (cached) {
            sparklineContent = `<div style="display:flex; justify-content:center; width:100%;">${generateSparklineSvg(cached, change, 100)}</div>`;
            sparklineDetail = `<div style="display:flex; justify-content:center; width:100%;">${generateSparklineSvg(cached, change, 240)}</div>`;
        } else {
            sparklineContent = `<div id="graph-${coin.symbol}" class="graph-container-${coin.symbol}" style="height:30px; display:flex; align-items:center; justify-content:center;">-</div>`;
            sparklineDetail = `<div id="graph-detail-${coin.symbol}" class="graph-container-${coin.symbol}" style="height:60px; min-width:240px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.05); border-radius:6px; border: 1px dotted rgba(0,0,0,0.05);"></div>`;
            setTimeout(() => loadSparkline(coin.id, coin.symbol, change), 0);
        }

        const isOpen = expandedCoins.has(coin.symbol);
        const tr = `
            <tr class="main-row" onclick="toggleCoinDetail('${coin.symbol}')">
                <td>
                    <div class="coin-info">
                        <img src="${coin.image}" class="coin-icon" alt="${coin.symbol}" onerror="this.src='../assets/images/logos/btc.png'">
                        <div class="coin-name-wrap">
                            <div class="coin-name">${coin.symbol.toUpperCase()}<span style="color:#888;font-size:10px;font-weight:normal;margin-left:4px;">/USDT</span></div>
                            <div class="coin-vol">${volume}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="price-wrap">
                        <span id="price-${coin.symbol}" class="main-price price-update" data-val="${rawPrice * rate}">${symbol}${price}</span>
                        <span class="converted-price">${secondarySymbol}${secondaryPrice}</span>
                    </div>
                </td>
                <td>
                    <div class="change-box ${changeClass} price-update" id="change-${coin.symbol}">
                        ${changeSign}${change.toFixed(2)}%
                    </div>
                </td>
                <td class="market_cap_cell">
                    <span style="display:flex; align-items:center;">
                        ${symbol}${marketCap}
                        <i class="fa fa-angle-down" id="arrow-${coin.symbol}" style="margin-left:8px; color:#666; transition:transform 0.3s; ${isOpen ? 'transform:rotate(180deg)' : ''}"></i>
                    </span>
                </td>
                <td style="text-align:center;">
                    ${sparklineContent}
                </td>
            </tr>
            <tr id="detail-${coin.symbol}" class="detail-row" style="${isOpen ? 'display:table-row' : ''}">
                <td colspan="5" style="border-top:none; padding:0 !important;">
                    <div class="detail-container">
                        <div class="detail-info">
                            <h5 style="margin-top:0; font-size:14px; font-weight:bold; color:#555; margin-bottom:15px;">市场详情</h5>
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; font-size:12px; color:#777;">
                                <div><span style="color:#aaa">市值:</span> <br><b>${symbol}${mkVal > 0 ? (mkVal * rate).toLocaleString() : '-'}</b></div>
                                <div><span style="color:#aaa">24h成交量:</span> <br><b>${symbol}${volVal > 0 ? (volVal * rate).toLocaleString() : '-'}</b></div>
                                <div><span style="color:#aaa">24h涨跌幅:</span> <br><b class="${change >= 0 ? 'text-danger' : 'text-success'}">${changeSign}${change.toFixed(2)}%</b></div>
                                <div><span style="color:#aaa">币种名称:</span> <br><b>${coin.name} (${coin.symbol.toUpperCase()})</b></div>
                            </div>
                        </div>
                        <div class="detail-chart">
                            <h5 style="margin-top:0; font-size:14px; font-weight:bold; color:#555; margin-bottom:15px; display:flex; justify-content:space-between;">
                                <span>7日价格趋势曲线</span>
                                <span style="font-weight:normal; font-size:11px; color:#aaa;">最近168小时数据</span>
                            </h5>
                            ${sparklineDetail}
                        </div>
                    </div>
                </td>
            </tr>
            `;
        tbody.innerHTML += tr;
    });
}

function toggleCoinDetail(symbol) {
    const row = document.getElementById(`detail-${symbol}`);
    const arrow = document.getElementById(`arrow-${symbol}`);
    if (row) {
        const isNone = window.getComputedStyle(row).display === 'none';
        if (isNone) {
            row.style.display = 'table-row';
            setTimeout(() => {
                row.style.opacity = '1';
                row.style.maxHeight = '200px'; // A value larger than expected content height
            }, 10); // Small delay to allow display change to register
            expandedCoins.add(symbol);
        } else {
            row.style.opacity = '0';
            row.style.maxHeight = '0';
            setTimeout(() => {
                row.style.display = 'none';
            }, 300); // Match transition duration
            expandedCoins.delete(symbol);
        }
        if (arrow) arrow.style.transform = isNone ? 'rotate(180deg)' : 'rotate(0deg)';
    }
}

function coal(val) {
    return (val && !isNaN(val)) ? parseFloat(val) : 0;
}

function updateCryptoUI(data) {
    if (!data) return;
    const isCNY = currentCurrency === 'CNY';
    const rate = isCNY ? USD_CNY_RATE : 1;
    const symbol = isCNY ? '¥' : '$';

    data.forEach(coin => {
        const priceId = `price-${coin.symbol}`;
        const priceEl = document.getElementById(priceId);
        const changeEl = document.getElementById(`change-${coin.symbol}`);

        if (priceEl) {
            const rawPrice = coin.current_price;
            const formattedPrice = (rawPrice * rate).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: (rawPrice < 1 ? 4 : 2)
            });
            const oldText = priceEl.innerText;
            const newText = `${symbol}${formattedPrice}`;

            if (oldText !== newText) {
                const oldVal = parseFloat(priceEl.dataset.val || 0);
                const newVal = rawPrice * rate;

                priceEl.innerText = newText;
                priceEl.dataset.val = newVal;

                const cell = priceEl.closest('td');
                if (cell) {
                    const pulseClass = newVal >= oldVal ? 'pulse-green' : 'pulse-red';
                    cell.classList.remove('pulse-green', 'pulse-red');
                    void cell.offsetWidth;
                    cell.classList.add(pulseClass);
                    setTimeout(() => cell.classList.remove(pulseClass), 1000);
                }

                const secondaryEl = priceEl.nextElementSibling;
                if (secondaryEl && secondaryEl.classList.contains('converted-price')) {
                    const secondarySymbol = isCNY ? '$' : '¥';
                    const secondaryPrice = (rawPrice * (isCNY ? 1 : USD_CNY_RATE)).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: (rawPrice < 1 ? 4 : 2)
                    });
                    secondaryEl.innerText = `${secondarySymbol}${secondaryPrice}`;
                }
            }
        }

        if (changeEl) {
            const change = coin.price_change_percentage_24h;
            const changeSign = change >= 0 ? '+' : '';
            const newText = `${changeSign}${change.toFixed(2)}%`;

            if (changeEl.innerText.trim() !== newText) {
                changeEl.innerText = newText;
                // IMPORTANT: Apply pulse to the Change button container cell too
                const cell = changeEl.closest('td');
                if (cell) {
                    const pulseClass = change >= 0 ? 'pulse-green' : 'pulse-red';
                    cell.classList.remove('pulse-green', 'pulse-red');
                    void cell.offsetWidth;
                    cell.classList.add(pulseClass);
                    setTimeout(() => cell.classList.remove(pulseClass), 1000);
                }
                changeEl.className = `change-box ${change >= 0 ? 'change-up' : 'change-down'} price-update`;
            }
        }
    });
}

// Search Logic with Debounce
let searchTimeout;

function handleSearchInput() {
    const input = document.getElementById('crypto-search');
    if (!input) return;
    const query = input.value.trim();
    if (!query) {
        isSearching = false;
        fetchCryptoData(); // Revert to main list if search cleared
        return;
    }
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(searchCrypto, 1000);
}

async function handleSearchKey(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(searchTimeout);
        searchCrypto();
    } else if (e.key === 'Escape') {
        const input = document.getElementById('crypto-search');
        if (input) input.value = '';
        isSearching = false;
        fetchCryptoData();
    }
}

// Map common Chinese names to English for better search
const CN_COIN_MAP = {
    '比特币': 'bitcoin', '以太坊': 'ethereum', '泰达币': 'tether', '狗狗币': 'dogecoin',
    '波卡': 'polkadot', '币安': 'binance', '瑞波': 'ripple', '索拉纳': 'solana',
    '莱特币': 'litecoin', '艾达币': 'cardano', '波场': 'tron', '以太经典': 'ethereum-classic',
    '佩佩': 'pepe', '链克': 'chainlink', '优尼': 'uniswap', '近': 'near-protocol',
    '艾普特': 'aptos', '堆栈': 'stack', '奥普': 'optimism', '阿比特': 'arbitrum',
    '天体': 'celestia', '赛伊': 'sei-network'
};

function clearCryptoSearch() {
    const input = document.getElementById('crypto-search');
    if (input) input.value = '';
    isSearching = false;
    const clearBtn = document.getElementById('crypto-search-clear');
    if (clearBtn) clearBtn.style.display = 'none';
    fetchCryptoData();
}

async function searchCrypto() {
    const input = document.getElementById('crypto-search');
    if (!input) return;
    let query = input.value.trim().toLowerCase();
    const dot = document.getElementById('api-status-dot');
    const label = document.getElementById('api-provider-name');
    const tbody = document.getElementById('crypto-table-body');
    const clearBtn = document.getElementById('crypto-search-clear');

    if (!query) {
        clearCryptoSearch();
        return;
    }

    if (clearBtn) clearBtn.style.display = 'block';
    if (CN_COIN_MAP[query]) query = CN_COIN_MAP[query];

    if (label) label.innerText = '正在全量搜索: ' + query;
    if (dot) dot.style.color = '#f59e0b';
    isSearching = true;

    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 40px; color: #888;">
        <i class="fa fa-circle-o-notch fa-spin"></i> 正在深度检索全网币种...
    </td></tr>`;

    try {
        // 1. Efficient Global Search in allGateTickers (Synced with Gate.io)
        const filtered = allGateTickers
            .filter(item => {
                const pair = item.currency_pair.toLowerCase();
                const symbol = pair.split('_')[0];
                return symbol.includes(query) && pair.endsWith('_usdt') && !pair.includes('3l_') && !pair.includes('3s_');
            })
            .sort((a, b) => parseFloat(b.quote_volume) - parseFloat(a.quote_volume))
            .slice(0, 30); // Max 30 results for search

        if (filtered.length > 0) {
            const mapped = filtered.map(item => {
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
            cryptoData = mapped;
            renderCryptoTable(mapped);
            if (label) label.innerText = `[Gate] 已找到 ${mapped.length} 个结果`;
            if (dot) dot.style.color = '#10b981';
            return;
        }

        // 2. Fallback to CoinCap Search only if Gate data has no matches
        const directUrl = `https://api.coincap.io/v2/assets?search=${query}&limit=20`;
        const res = await fetchWithTimeout(directUrl, { timeout: 5000 });
        if (res.ok) {
            const json = await res.json();
            if (json.data && json.data.length > 0) {
                const mapped = json.data.map(item => ({
                    id: item.id,
                    symbol: item.symbol.toLowerCase(),
                    name: item.name,
                    image: `https://gimg2.gateimg.com/coin_icon/64/${item.symbol.toLowerCase()}.png`,
                    current_price: parseFloat(item.priceUsd),
                    price_change_percentage_24h: parseFloat(item.changePercent24Hr),
                    market_cap: parseFloat(item.marketCapUsd),
                    total_volume: parseFloat(item.volumeUsd24Hr),
                    sparkline_in_7d: null
                }));
                cryptoData = mapped;
                renderCryptoTable(mapped);
                if (label) label.innerText = `[CoinCap] 已找到 ${mapped.length} 个结果`;
                if (dot) dot.style.color = '#34d399';
                return;
            }
        }

        // 3. Not found
        if (label) label.innerText = `未找到 "${query}"`;
        if (dot) dot.style.color = '#ef4444';
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 60px; color: #888;">
            <div style="font-size:32px; margin-bottom:15px;">🔍</div>
            未找到 "${query}"<br>
            <small style="color:#aaa">Gate.io 全网库中暂无此币种</small>
        </td></tr>`;

    } catch (e) {
        console.error('Search error:', e);
        if (label) label.innerText = 'Search Error';
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 40px; color: #ef4444;">搜索失败，请检查网络设置或稍后再试</td></tr>`;
    }
}

// Hover to hide floating buttons logic
document.addEventListener('DOMContentLoaded', () => {
    fetchCryptoData();

    const searchInput = document.getElementById('crypto-search');
    const searchTrigger = document.getElementById('crypto-search-trigger');

    if (searchInput) {
        searchInput.addEventListener('input', handleSearchInput);
        searchInput.addEventListener('keydown', handleSearchKey);
    }
    if (searchTrigger) {
        searchTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            searchCrypto();
        });
    }

    // Real-time polling
    setInterval(() => {
        if (!isSearching) fetchCryptoData();
    }, 3000);

    // Dedicated Full Ticker Refresh (Background)
    setInterval(async () => {
        try {
            const res = await fetchWithTimeout('https://api.gateio.ws/api/v4/spot/tickers', { timeout: 10000 });
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 500) {
                    allGateTickers = data;
                }
            }
        } catch (e) { }
    }, 60000); // Refresh full list every minute

    // Hover Logic - Optimized to hide all floating buttons
    const cryptoContainer = document.querySelector('.crypto-table-container');
    if (cryptoContainer) {
        const cryptoSection = cryptoContainer.closest('.row');
        const floatBtns = ['#showHiddenCards', '#resetOrder', '.xp-panel'];

        const hideFloats = () => {
            floatBtns.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => el.classList.add('fade-out'));
            });
        };
        const showFloats = () => {
            floatBtns.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => el.classList.remove('fade-out'));
            });
        };

        if (cryptoSection) {
            cryptoSection.addEventListener('mouseenter', hideFloats);
            cryptoSection.addEventListener('mouseleave', showFloats);
            cryptoSection.addEventListener('touchstart', hideFloats, { passive: true });
        }
    }
});