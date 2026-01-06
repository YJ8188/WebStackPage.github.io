// Crypto Logic - Digital Currency Module
// ==================== 数字货币行情模块 ====================
/**
 * 数字货币实时行情显示模块
 * 功能：获取并显示数字货币的实时价格、涨跌幅、市值等信息
 * 作者：何哥
 * 版本：1.0
 */

// ==================== 全局变量 ====================
let currentCurrency = 'USD'; // 当前货币类型：USD或CNY
let cryptoData = []; // 加密货币数据数组
let USD_CNY_RATE = 7.25; // 美元兑人民币汇率（默认值，会动态更新）
let lastRateUpdate = 0; // 上次汇率更新时间

// ==================== 缓存和工具 ====================
// K线图缓存
const sparklineCache = {};
// 正在请求的币种集合
const sparklineRequests = new Set();
// 币种ID映射表（用于从不同API获取数据）
const COIN_ID_MAP = {
    'btc': 'bitcoin', 'eth': 'ethereum', 'usdt': 'tether', 'bnb': 'binance-coin',
    'xrp': 'ripple', 'sol': 'solana', 'doge': 'dogecoin', 'ada': 'cardano',
    'trx': 'tron', 'ton': 'toncoin', 'shib': 'shiba-inu', 'ltc': 'litecoin',
    'etc': 'ethereum-classic', 'link': 'chainlink', 'uni': 'uniswap', 'bch': 'bitcoin-cash',
    'arb': 'arbitrum', 'op': 'optimism', 'tia': 'celestia', 'sei': 'sei-network',
    'pepe': 'pepe', 'stx': 'stacks', 'apt': 'aptos', 'floki': 'floki', 'fet': 'fetch-ai',
    'bonk': 'bonk', 'kas': 'kaspa', 'rndr': 'render-token', 'inj': 'injective',
    'near': 'near-protocol', 'ldo': 'lido-dao', 'icp': 'internet-computer', 'mnt': 'mantle'
};

// ==================== 数据持久化和缓存 ====================
// Gate.io的所有交易对数据（用于全局搜索）
let allGateTickers = [];
// 已展开详情的币种集合
const expandedCoins = new Set();

/**
 * 加载K线图数据
 * @param {string} id - 币种ID
 * @param {string} symbol - 币种符号
 * @param {number} changePct - 涨跌幅百分比
 */
async function loadSparkline(id, symbol, changePct) {
    // 如果已缓存或正在请求，则跳过
    if (sparklineCache[symbol] || sparklineRequests.has(symbol)) return;
    
    // 获取最终的币种ID
    const finalId = id || COIN_ID_MAP[symbol] || symbol.toLowerCase();
    if (!finalId) return;

    // 添加到请求集合
    sparklineRequests.add(symbol);
    
    // 获取所有图表容器并显示加载状态
    const containers = document.querySelectorAll(`.graph-container-${symbol}`);
    containers.forEach(el => {
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
    if (label) label.innerText = providerName;

    // Always update UI elements if they exist
    if (freshData) updateCryptoUI(freshData);

    // Handle table sync
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

// API Strategies configuration
// ==================== API配置 ====================
/**
 * 多API数据源配置
 * 使用竞速模式获取数据，优先返回最快的响应
 */
const APIS = {
    GATEIO: {
        name: 'Gate.io (Official)',
        url: 'https://api.gateio.ws/api/v4/spot/tickers',
        handler: (data) => {
            // 0. 备份所有交易对数据用于全局搜索
            allGateTickers = data;

            // 1. 同步汇率（修复USDT_CNY查找问题）
            const usdtCny = data.find(item => item.currency_pair === 'USDT_CNY');
            if (usdtCny && usdtCny.last) {
                USD_CNY_RATE = parseFloat(usdtCny.last);
                lastRateUpdate = Date.now();
            }

            // 2. 过滤USDT交易对并按成交量排序，取前50个
            const sortedTickers = data
                .filter(item => item.currency_pair.endsWith('_USDT'))
                .filter(item => !item.currency_pair.includes('3L_') && !item.currency_pair.includes('3S_')) // 排除杠杆
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
                    market_cap: parseFloat(item.quote_volume) * 7.5, // 市值代理
                    total_volume: parseFloat(item.quote_volume),
                    sparkline_in_7d: null
                };
            });
        }
    },
    CRYPTOCOMPARE: {
        name: 'CryptoCompare',
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
        url: 'https://api.coincap.io/v2/assets?limit=50',
        handler: (data) => {
            return data.data.map(item => ({
                id: item.id,
                symbol: item.symbol.toLowerCase(),
                name: item.name,
                image: `https://gimg2.gateimg.com/coin_icon/64/${item.symbol.toLowerCase()}.png`,
                current_price: parseFloat(item.priceUsd),
                price_change_percentage_24h: parseFloat(item.changePercent24Hr),
                market_cap: parseFloat(item.marketCapUsd),
                sparkline_in_7d: null
            }));
        }
    },
    COINGECKO: {
        name: 'CoinGecko',
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

// ==================== 汇率显示功能 ====================
/**
 * 显示汇率更新提醒消息
 */
function showRateUpdateMessage(oldRate, newRate) {
    // 检查是否支持通知
    if (!('Notification' in window)) return;

    // 如果已授权，显示通知
    if (Notification.permission === 'granted') {
        const change = newRate - oldRate;
        const changePct = ((change / oldRate) * 100).toFixed(4);
        const direction = change > 0 ? '上涨' : (change < 0 ? '下跌' : '持平');
        const icon = change > 0 ? '📈' : (change < 0 ? '📉' : '➡️');

        const notification = new Notification('USDT汇率更新', {
            body: `${icon} 1 USDT = ${newRate.toFixed(2)} CNY (${direction} ${Math.abs(changePct)}%)`,
            icon: 'https://gimg2.gateimg.com/coin_icon/64/usdt.png',
            tag: 'usdt-cny-rate',
            requireInteraction: false,
            silent: false
        });

        // 5秒后自动关闭
        setTimeout(() => notification.close(), 5000);
    }
}

/**
 * 显示页面内提醒消息（移动端友好）
 */
function showInlineRateMessage(oldRate, newRate) {
    // 检查是否已有消息容器
    let msgContainer = document.getElementById('rate-update-message');
    if (!msgContainer) {
        msgContainer = document.createElement('div');
        msgContainer.id = 'rate-update-message';
        msgContainer.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 10000;
            background: rgba(16, 185, 129, 0.95);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            font-size: 14px;
            font-weight: 500;
            animation: slideIn 0.3s ease-out;
            max-width: 300px;
            cursor: pointer;
        `;
        document.body.appendChild(msgContainer);

        // 添加动画样式
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    const change = newRate - oldRate;
    const changePct = ((change / oldRate) * 100).toFixed(4);
    const direction = change > 0 ? '📈 上涨' : (change < 0 ? '📉 下跌' : '➡️ 持平');
    const color = change > 0 ? '#ef4444' : (change < 0 ? '#10b981' : '#f59e0b');

    msgContainer.style.background = color;
    msgContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">${change > 0 ? '📈' : (change < 0 ? '📉' : '➡️')}</span>
            <div>
                <div style="font-weight: 600; font-size: 15px;">USDT汇率更新</div>
                <div style="font-size: 13px; opacity: 0.9;">1 USDT = ${newRate.toFixed(2)} CNY</div>
                <div style="font-size: 12px; opacity: 0.8;">${direction} ${Math.abs(changePct)}%</div>
            </div>
        </div>
    `;

    // 点击关闭
    msgContainer.onclick = () => {
        msgContainer.style.animation = 'slideOut 0.3s ease-in forwards';
        setTimeout(() => msgContainer.remove(), 300);
    };

    // 8秒后自动关闭
    setTimeout(() => {
        if (msgContainer && msgContainer.parentNode) {
            msgContainer.style.animation = 'slideOut 0.3s ease-in forwards';
            setTimeout(() => msgContainer.remove(), 300);
        }
    }, 8000);
}

/**
 * 切换USD/CNY显示顺序（数字颠倒）
 */
function toggleCurrencyDisplay() {
    const rateEl = document.getElementById('exchange-rate-display');
    if (!rateEl) return;

    const currentRate = USD_CNY_RATE;
    const reversedRate = 1 / currentRate;

    // 检查当前显示的是哪种格式
    if (rateEl.dataset.mode === 'usdt-cny') {
        // 切换到 CNY-USDT
        rateEl.innerHTML = `1 CNY = <span class="rate-value">${reversedRate.toFixed(4)}</span> USDT`;
        rateEl.dataset.mode = 'cny-usdt';
    } else {
        // 切换到 USDT-CNY
        rateEl.innerHTML = `1 USDT = <span class="rate-value">${currentRate.toFixed(2)}</span> CNY`;
        rateEl.dataset.mode = 'usdt-cny';
    }
}

/**
 * 更新汇率显示
 */
function updateExchangeRateDisplay() {
    const rateEl = document.getElementById('exchange-rate-display');
    if (!rateEl) return;

    const currentRate = USD_CNY_RATE;
    const reversedRate = 1 / currentRate;

    // 根据当前模式更新显示
    if (rateEl.dataset.mode === 'cny-usdt') {
        rateEl.innerHTML = `1 CNY = <span class="rate-value">${reversedRate.toFixed(4)}</span> USDT`;
    } else {
        rateEl.innerHTML = `1 USDT = <span class="rate-value">${currentRate.toFixed(2)}</span> CNY`;
        rateEl.dataset.mode = 'usdt-cny';
    }
}

/**
 * 同步并显示汇率（Gate.io USDT_CNY）
 * 实时同步，每次获取最新数据
 */
const syncRate = async () => {
    try {
        const res = await fetchWithTimeout('https://api.gateio.ws/api/v4/spot/tickers?currency_pair=USDT_CNY', { timeout: 5000 });
        if (res.ok) {
            const data = await res.json();
            if (data && data[0] && data[0].last) {
                const oldRate = USD_CNY_RATE;
                const newRate = parseFloat(data[0].last);

                // 只有汇率发生变化时才显示提醒
                if (Math.abs(newRate - oldRate) > 0.0001) {
                    USD_CNY_RATE = newRate;
                    lastRateUpdate = Date.now();
                    updateExchangeRateDisplay();

                    // 显示桌面通知
                    showRateUpdateMessage(oldRate, newRate);

                    // 显示页面内提醒消息（移动端友好）
                    showInlineRateMessage(oldRate, newRate);
                } else {
                    // 即使汇率没变，也更新时间戳
                    lastRateUpdate = Date.now();
                }
            }
        }
    } catch (e) {
        console.error('汇率同步失败:', e);
    }
};

// ==================== 数据获取核心引擎 ====================
/**
 * 获取数字货币数据（竞速模式 + 本地缓存回退）
 * 优先使用本地缓存实现即时加载，同时后台更新数据
 */
async function fetchCryptoData() {
    const dot = document.getElementById('api-status-dot');
    const label = document.getElementById('api-provider-name');
    const tbody = document.getElementById('crypto-table-body');
    const refreshIcon = document.querySelector('#refresh-crypto-btn i');

    // 设置为获取中状态
    dot.style.color = '#f59e0b';
    if (refreshIcon) refreshIcon.classList.add('fa-spin');

    // A. 立即尝试从本地存储加载（实现即时加载效果）
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

    // 后台同步汇率（Gate.io USDT_CNY）
    syncRate();

    // C. 并行竞速模式（核心优化）
    const fetchSource = async (apiObj) => {
        const res = await fetchWithTimeout(apiObj.url, { timeout: 15000 });
        if (!res.ok) throw new Error(`${apiObj.name} Failed`);
        const data = await res.json();
        return { name: apiObj.name, data: apiObj.handler(data) };
    };

    try {
        // 优先竞速：同时启动所有主要数据源
        // 使用Promise.any获取最快响应
        const fastestResult = await Promise.any([
            fetchSource(APIS.GATEIO),
            fetchSource(APIS.CRYPTOCOMPARE),
            fetchSource(APIS.COINCAP)
        ]);

        if (fastestResult && fastestResult.data) {
            cryptoData = fastestResult.data;
            onSuccess(dot, fastestResult.name, fastestResult.data);
            // 持久化到本地存储
            localStorage.setItem('crypto_market_cache', JSON.stringify(cryptoData));
            return;
        }
    } catch (e) {
        // D. 如果所有初始竞速失败，回退到CoinGecko
        try {
            if (label) label.innerText = 'Fallback (CG)...';
            const geckoRes = await fetchSource(APIS.COINGECKO);
            cryptoData = geckoRes.data;
            onSuccess(dot, geckoRes.name, geckoRes.data);
            localStorage.setItem('crypto_market_cache', JSON.stringify(cryptoData));
            return;
        } catch (ge) {
            // E. 最终失败：如果有缓存数据，不显示红色错误框
            if (cryptoData.length > 0) {
                dot.style.color = '#ef4444';
                if (label) label.innerText = 'Sync Off (Local)';
            } else {
                // 完全失败UI
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

// ==================== 页面初始化 ====================
/**
 * 动态生成数字货币板块UI
 */
function initCryptoUI() {
    const placeholder = document.getElementById('crypto-section-placeholder');
    if (!placeholder) return;

    const cryptoHTML = `
        <h4 class="text-gray">
            <i class="linecons-money" style="margin-right: 7px;" id="数字货币"></i>数字货币行情 (Live Market)
            <span style="float: right; display: flex; align-items: center; font-size: 13px;">
                <button id="refresh-crypto-btn" class="btn btn-xs btn-white" onclick="fetchCryptoData()"
                    style="margin-right: 10px; padding: 2px 6px;" title="刷新数据">
                    <i class="fa fa-refresh"></i>
                </button>
                <span style="margin-right: 10px; color: #888;">汇率:</span>
                <span id="exchange-rate-display" class="rate-display"
                    style="font-size: 12px; font-weight: bold; color: #10b981; cursor: pointer;"
                    onclick="toggleCurrencyDisplay()"
                    title="点击切换汇率显示"
                    data-mode="usdt-cny">
                    1 USDT = <span class="rate-value">7.25</span> CNY
                </span>
            </span>
        </h4>

        <div class="row">
            <div class="col-sm-12">
                <div class="crypto-table-container">
                    <table class="table crypto-table">
                        <thead>
                            <tr>
                                <th>币种 / 24h量</th>
                                <th>最新价</th>
                                <th>24h涨跌</th>
                                <th class="table-market-cap">市值</th>
                                <th style="text-align:center;">7日趋势</th>
                            </tr>
                        </thead>
                        <tbody id="crypto-table-body">
                            <tr>
                                <td colspan="5" style="text-align:center; padding: 20px;">正在加载实时行情...
                                    <i class="fa fa-spinner fa-spin"></i>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div style="font-size: 12px; color: #888; text-align: right; margin-top: 5px;">
                    Data provided by <span id="api-provider-name">Crypto API</span>
                    <span id="api-status-dot" style="color: #10b981;">●</span>
                </div>
            </div>
        </div>

        <style>
            .crypto-table-container {
                background: #fff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            }

            .crypto-table {
                margin-bottom: 0;
                width: 100%;
            }

            .crypto-table th {
                background: #fcfcfc;
                font-weight: 500;
                color: #888;
                border-bottom: 1px solid #f0f0f0;
                padding: 12px 15px !important;
                font-size: 13px;
            }

            .crypto-table td {
                vertical-align: middle !important;
                padding: 12px 15px !important;
                border-top: 1px solid #f8f8f8;
                color: #333;
            }

            .coin-info {
                display: flex;
                align-items: center;
            }

            .coin-icon {
                width: 32px;
                height: 32px;
                margin-right: 12px;
                border-radius: 50%;
            }

            .coin-name-wrap {
                display: flex;
                flex-direction: column;
            }

            .coin-name {
                font-weight: bold;
                font-size: 14px;
                color: #1a1a1a;
            }

            .coin-symbol {
                color: #999;
                font-size: 11px;
                margin-top: 2px;
            }

            .coin-vol {
                color: #888;
                font-size: 11px;
                margin-top: 2px;
            }

            .price-wrap {
                display: flex;
                flex-direction: column;
            }

            .main-price {
                font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
                font-weight: 600;
                font-size: 14px;
            }

            .converted-price {
                color: #999;
                font-size: 11px;
                margin-top: 2px;
            }

            .change-box {
                display: inline-block;
                min-width: 75px;
                padding: 6px 4px;
                border-radius: 4px;
                text-align: center;
                font-weight: bold;
                color: #fff;
                font-size: 12px;
            }

            .change-up {
                background-color: #ef4444;
            }

            .change-down {
                background-color: #10b981;
            }

            .change-neutral {
                background-color: #9ca3af;
            }

            .market_cap_cell {
                font-size: 12px;
                color: #666;
            }

            .price-update {
                transition: background-color 0.8s ease;
            }

            .pulse-green {
                background-color: rgba(239, 68, 68, 0.2) !important;
            }

            .pulse-red {
                background-color: rgba(16, 185, 129, 0.2) !important;
            }

            body.dark-mode .pulse-green {
                background-color: rgba(239, 68, 68, 0.15) !important;
            }

            body.dark-mode .pulse-red {
                background-color: rgba(16, 185, 129, 0.15) !important;
            }

            body.dark-mode .crypto-table-container {
                background: #1e1e1e;
                box-shadow: none;
            }

            body.dark-mode .crypto-table th {
                background: #252525;
                color: #777;
                border-bottom-color: #333;
            }

            body.dark-mode .crypto-table td {
                border-top-color: #2a2a2a;
                color: #ccc;
            }

            body.dark-mode .coin-name {
                color: #eee;
            }

            body.dark-mode .main-price {
                color: #fff;
            }

            body.dark-mode .market_cap_cell {
                color: #888;
            }

            .sparkline-svg {
                overflow: visible;
            }

            .sparkline-point-label {
                font-size: 9px;
                font-weight: 500;
                fill: #888;
            }

            .rate-display {
                display: inline-block;
                padding: 4px 10px;
                background: rgba(16, 185, 129, 0.1);
                border: 1px solid #10b981;
                border-radius: 4px;
                transition: all 0.3s;
            }

            .rate-display:hover {
                background: rgba(16, 185, 129, 0.2);
                transform: scale(1.05);
            }

            .rate-value {
                color: #10b981;
                font-weight: bold;
            }

            @media screen and (max-width: 768px) {
                .crypto-table th,
                .crypto-table td {
                    padding: 10px 8px !important;
                }

                .coin-icon {
                    width: 24px;
                    height: 24px;
                    margin-right: 8px;
                }

                .change-box {
                    min-width: 65px;
                    font-size: 11px;
                }

                .table-market-cap,
                .market_cap_cell {
                    display: table-cell !important;
                }

                .detail-row td {
                    padding: 15px !important;
                }

                .detail-container {
                    flex-direction: column;
                    gap: 15px;
                    padding: 15px;
                    margin: 5px 10px 15px 10px;
                }

                .detail-info {
                    border-right: none;
                    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
                    padding-right: 0;
                    padding-bottom: 15px;
                }

                body.dark-mode .detail-info {
                    border-bottom-color: rgba(255, 255, 255, 0.1);
                }
            }

            .detail-row {
                display: none;
                background-color: transparent;
                opacity: 0;
                max-height: 0;
                overflow: hidden;
                transition: opacity 0.3s ease, max-height 0.3s ease;
            }

            .detail-container {
                background: rgba(0, 0, 0, 0.03);
                border-radius: 8px;
                margin: 10px 15px 20px 15px;
                padding: 20px;
                display: flex;
                gap: 30px;
            }

            .detail-info {
                flex: 1;
                border-right: 1px solid rgba(0, 0, 0, 0.05);
                padding-right: 20px;
            }

            .detail-chart {
                flex: 2;
            }

            body.dark-mode .detail-container {
                background: rgba(255, 255, 255, 0.03);
            }

            body.dark-mode .detail-info {
                border-right-color: rgba(255, 255, 255, 0.1);
            }

            body.dark-mode .detail-row {
                background-color: rgba(255, 255, 255, 0.02);
            }

            .main-row {
                cursor: pointer;
                transition: background 0.2s;
            }

            .main-row:hover {
                background-color: rgba(0, 0, 0, 0.01);
            }

            body.dark-mode .main-row:hover {
                background-color: rgba(255, 255, 255, 0.01);
            }
        </style>
    `;

    placeholder.innerHTML = cryptoHTML;
}

/**
 * 页面加载完成后初始化
 */
document.addEventListener('DOMContentLoaded', () => {
    // 动态生成UI
    initCryptoUI();

    // 初始加载数据
    fetchCryptoData();

    // 初始化汇率显示
    updateExchangeRateDisplay();

    // 实时轮询更新（每3秒）
    setInterval(() => {
        fetchCryptoData();
    }, 3000);

    // 后台刷新完整交易对列表（每60秒）
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
    }, 60000);

    // 实时更新汇率显示（每10秒，更频繁）
    setInterval(() => {
        syncRate();
    }, 10000);

    // 请求通知权限
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                console.log('通知权限已授予');
            }
        });
    }

    // 悬停时隐藏浮动按钮的优化
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
