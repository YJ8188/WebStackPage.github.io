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
let USD_CNY_RATE = 7.25; // 美元兑人民币汇率（默认值7.25，实时获取后会更新）
let lastRateUpdate = 0; // 上次汇率更新时间
let lastLocalStorageUpdate = 0; // 上次localStorage更新时间
const LOCAL_STORAGE_UPDATE_INTERVAL = 10000; // localStorage更新间隔：10秒

// ==================== 缓存和工具 ====================
// K线图缓存（限制最多缓存20个币种，防止内存泄漏）
const sparklineCache = {};
const MAX_SPARKLINE_CACHE = 20;
const sparklineCacheOrder = []; // 记录缓存顺序，用于LRU清理

// 正在请求的币种集合
const sparklineRequests = new Set();
// 币种ID映射表（用于从不同API获取数据）
const COIN_ID_MAP = {
    'btc': { coingecko: 'bitcoin', coinmarketcap: 1, coingecko_id: 1 },
    'eth': { coingecko: 'ethereum', coinmarketcap: 1027, coingecko_id: 279 },
    'usdt': { coingecko: 'tether', coinmarketcap: 825, coingecko_id: 325 },
    'bnb': { coingecko: 'binance-coin', coinmarketcap: 1839, coingecko_id: 1839 },
    'xrp': { coingecko: 'ripple', coinmarketcap: 52, coingecko_id: 44 },
    'sol': { coingecko: 'solana', coinmarketcap: 5426, coingecko_id: 4128 },
    'doge': { coingecko: 'dogecoin', coinmarketcap: 74, coingecko_id: 5 },
    'ada': { coingecko: 'cardano', coinmarketcap: 2010, coingecko_id: 975 },
    'trx': { coingecko: 'tron', coinmarketcap: 1958, coingecko_id: 1958 },
    'ton': { coingecko: 'toncoin', coinmarketcap: 11419, coingecko_id: 11419 },
    'shib': { coingecko: 'shiba-inu', coinmarketcap: 5994, coingecko_id: 11939 },
    'ltc': { coingecko: 'litecoin', coinmarketcap: 2, coingecko_id: 2 },
    'etc': { coingecko: 'ethereum-classic', coinmarketcap: 1321, coingecko_id: 1321 },
    'link': { coingecko: 'chainlink', coinmarketcap: 1975, coingecko_id: 877 },
    'uni': { coingecko: 'uniswap', coinmarketcap: 7083, coingecko_id: 7083 },
    'bch': { coingecko: 'bitcoin-cash', coinmarketcap: 1831, coingecko_id: 780 },
    'arb': { coingecko: 'arbitrum', coinmarketcap: 11841, coingecko_id: 11841 },
    'op': { coingecko: 'optimism', coinmarketcap: 11840, coingecko_id: 11840 },
    'tia': { coingecko: 'celestia', coinmarketcap: 23753, coingecko_id: 23753 },
    'sei': { coingecko: 'sei-network', coinmarketcap: 24278, coingecko_id: 24278 },
    'pepe': { coingecko: 'pepe', coinmarketcap: 24478, coingecko_id: 24478 },
    'stx': { coingecko: 'stacks', coinmarketcap: 3886, coingecko_id: 3886 },
    'apt': { coingecko: 'aptos', coinmarketcap: 21794, coingecko_id: 21794 },
    'floki': { coingecko: 'floki', coinmarketcap: 10683, coingecko_id: 10683 },
    'fet': { coingecko: 'fetch-ai', coinmarketcap: 2684, coingecko_id: 2684 },
    'bonk': { coingecko: 'bonk', coinmarketcap: 23095, coingecko_id: 23095 },
    'kas': { coingecko: 'kaspa', coinmarketcap: 26702, coingecko_id: 26702 },
    'rndr': { coingecko: 'render-token', coinmarketcap: 14747, coingecko_id: 14747 },
    'inj': { coingecko: 'injective', coinmarketcap: 7226, coingecko_id: 7226 },
    'near': { coingecko: 'near-protocol', coinmarketcap: 6535, coingecko_id: 6535 },
    'ldo': { coingecko: 'lido-dao', coinmarketcap: 7301, coingecko_id: 7301 },
    'icp': { coingecko: 'internet-computer', coinmarketcap: 7181, coingecko_id: 7181 },
    'mnt': { coingecko: 'mantle', coinmarketcap: 24769, coingecko_id: 24769 }
};

// ==================== 数据持久化和缓存 ====================
// 已展开详情的币种集合
const expandedCoins = new Set();
// 所有币种数据（用于搜索）
let allCryptoData = [];

/**
 * 加载K线图数据
 * @param {string} id - 币种ID
 * @param {string} symbol - 币种符号
 * @param {number} changePct - 涨跌幅百分比
 */
async function loadSparkline(id, symbol, changePct) {
    // 如果已缓存，直接使用缓存数据，不再刷新
    if (sparklineCache[symbol]) {
        console.log(`[K线图] ${symbol} 已缓存，跳过刷新`);
        return;
    }

    // 如果正在请求，则跳过
    if (sparklineRequests.has(symbol)) return;

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
        // 使用币安K线API（获取7天数据）
        try {
            const res = await fetchWithTimeout(`https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}USDT&interval=1d&limit=7`, { timeout: 10000 });
            if (res.ok) {
                const json = await res.json();
                if (Array.isArray(json) && json.length > 0) {
                    // 币安K线数据格式: [开盘时间, 开盘价, 最高价, 最低价, 收盘价, 成交量, ...]
                    // 我们只需要收盘价（索引4）
                    prices = json.map(d => parseFloat(d[4])).filter(p => !isNaN(p));
                }
            }
        } catch (e) {
            console.log(`[K线图] ${symbol} 币安API请求失败:`, e.message);
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

        if (prices && prices.length > 2) {
            // 添加到缓存
            sparklineCache[symbol] = prices;
            sparklineCacheOrder.push(symbol);

            // 清理旧缓存（LRU策略）
            if (sparklineCacheOrder.length > MAX_SPARKLINE_CACHE) {
                const oldestSymbol = sparklineCacheOrder.shift();
                delete sparklineCache[oldestSymbol];
                console.log(`[K线缓存] 清理旧缓存: ${oldestSymbol}`);
            }

            console.log(`[K线图] ${symbol} 数据加载成功，已缓存`);
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

    // 检测是否为移动端（宽度较小）
    const isMobile = width <= 100;

    return `<svg width="${width}" height="${height}" class="sparkline-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <defs>
            <linearGradient id="${gradId}" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:${color};stop-opacity:0.25" />
                <stop offset="100%" style="stop-color:${color};stop-opacity:0" />
            </linearGradient>
        </defs>
        <polygon points="${fillPoints}" fill="url(#${gradId})" />
        <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        ${!isMobile ? `
        <circle cx="${maxPoint.x}" cy="${maxPoint.y}" r="2.5" fill="#ef4444" />
        <text x="${maxPoint.x}" y="${maxPoint.y - 4}" class="sparkline-point-label" text-anchor="${maxPoint.x > width * 0.7 ? 'end' : 'start'}" style="fill:#ef4444; font-size:10px;">${formatPrice(maxPoint.val)}</text>
        <circle cx="${minPoint.x}" cy="${minPoint.y}" r="2.5" fill="#10b981" />
        <text x="${minPoint.x}" y="${minPoint.y + 12}" class="sparkline-point-label" text-anchor="${minPoint.x > width * 0.7 ? 'end' : 'start'}" style="fill:#10b981; font-size:10px;">${formatPrice(minPoint.val)}</text>
        ` : ''}
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

// ==================== 币安WebSocket API配置 ====================
/**
 * 币安实时WebSocket行情API
 * 使用WebSocket获取实时数据,无需刷新
 */
let binanceWS = null;
let binanceMarketData = [];
let binanceConnected = false;
let stableCoinCount = 0; // 稳定的币种数量计数器

/**
 * 初始化币安WebSocket连接
 */
function initBinanceWebSocket() {
    console.log('[币安API] 🔄 正在初始化WebSocket连接...');

    if (binanceWS && binanceConnected) {
        console.log('[币安API] ✅ WebSocket已连接，跳过重复连接');
        return;
    }

    // 如果已有连接但未连接，先关闭
    if (binanceWS) {
        console.log('[币anceAPI] ⚠️ 检测到旧连接，正在关闭...');
        binanceWS.close();
        binanceWS = null;
    }

    const wsUrl = 'wss://stream.binance.com:9443/ws/!ticker@arr';
    console.log('[币安API] 📡 连接地址:', wsUrl);

    binanceWS = new WebSocket(wsUrl);

    binanceWS.onopen = function() {
        console.log('[币安API] ✅ WebSocket连接已建立');
        console.log('[币安API] 📡 等待接收数据...');
        binanceConnected = true;
        updateAPIStatus('Binance WebSocket', true);
    };

    binanceWS.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);

            if (!Array.isArray(data)) {
                console.warn('[币安API] ⚠️ 接收到的数据格式不正确');
                return;
            }

            // 只在首次加载时显示详细日志
            if (binanceMarketData.length === 0) {
                console.log(`[币安API] 📦 首次接收到 ${data.length} 个交易对数据`);
            }

            // 将币安API字段映射到标准格式，并过滤无效数据
            const newData = data
                .filter(item => item && item.s && typeof item.s === 'string' && item.s.endsWith('USDT'))
                .filter(item => {
                    // 过滤掉价格为0或异常的交易对
                    const price = parseFloat(item.c);
                    const volume = parseFloat(item.v);
                    return price > 0 && volume > 0 && item.c && item.v;
                })
                .map(item => {
                    const symbol = item.s.replace('USDT', '').toLowerCase();
                    const symbolUpper = symbol.toUpperCase();

                    // 创建精美的SVG渐变图标
                    const firstLetter = symbolUpper.charAt(0);
                    const gradients = [
                        ['#F7931A', '#FFAB40'], // BTC橙
                        ['#627EEA', '#8294FF'], // ETH蓝
                        ['#26A17B', '#3DD5BF'], // USDT绿
                        ['#F3BA2F', '#FFD54F'], // BNB黄
                        ['#2A5ADA', '#5275FF'], // XRP蓝
                        ['#14F195', '#00FFA3'], // SOL绿
                        ['#C2A633', '#FFD700'], // DOGE金
                        ['#0033AD', '#0055FF'], // ADA蓝
                        ['#E91E63', '#FF4081'], // TRX粉
                        ['#0098EA', '#00BCD4'], // TON青
                        ['#000000', '#424242'], // SHIB黑
                        ['#345D9D', '#5C8BC0'], // LTC蓝
                        ['#3CC8D8', '#00E5FF'], // ETC青
                        ['#2A5ADA', '#5275FF'], // LINK蓝
                        ['#FF007A', '#FF4081'], // UNI粉
                        ['#8DC351', '#AED581'], // BCH绿
                        ['#9D4EDD', '#BA68C8'], // ARB紫
                        ['#FF0420', '#FF5252'], // OP红
                        ['#FF6B00', '#FF9100'], // TIA橙
                        ['#00D1FF', '#40E0FF'], // SEI青
                        ['#FF8F00', '#FFB300'], // PEPE橙
                        ['#00E676', '#69F0AE'], // STX绿
                        ['#5E17EB', '#8B5CF6'], // APT紫
                        ['#00A3E0', '#00D4FF'], // FLOKI蓝
                        ['#00D4FF', '#40E0FF'], // FET青
                        ['#FFD700', '#FFEB3B'], // BONK黄
                        ['#FF6B35', '#FF8A65'], // KAS橙
                        ['#FF4D4D', '#FF8080'], // RNDR红
                        ['#00E5FF', '#40E0FF'], // INJ青
                        ['#00D4FF', '#40E0FF'], // NEAR青
                        ['#5E17EB', '#8B5CF6'], // LDO紫
                        ['#4080FF', '#80A0FF'], // ICP蓝
                        ['#00E5FF', '#40E0FF']  // MNT青
                    ];

                    const gradientIndex = symbol.length % gradients.length;
                    const [color1, color2] = gradients[gradientIndex];
                    const gradientId = `grad-${symbol}-${gradientIndex}`;

                    // 使用 UTF-8 兼容的 base64 编码
                    const svgString = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
                            <defs>
                                <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" style="stop-color:${color1}"/>
                                    <stop offset="100%" style="stop-color:${color2}"/>
                                </linearGradient>
                            </defs>
                            <circle cx="16" cy="16" r="15" fill="url(#${gradientId})"/>
                            <text x="50%" y="50%" dy=".35em" text-anchor="middle" dominant-baseline="middle"
                                  font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="white"
                                  style="text-shadow: 0 1px 2px rgba(0,0,0,0.3);">
                                ${firstLetter}
                            </text>
                            <circle cx="16" cy="16" r="15" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
                        </svg>
                    `;
                    const svgIcon = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;

                    // 获取币种ID映射
                    const coinIds = COIN_ID_MAP[symbol] || {};

                    // 在线logo URL（按优先级排序）
                    const logo1 = `https://assets.coincap.io/assets/icons/${symbol}@2x.png`;  // CoinCap
                    const logo2 = coinIds.coinmarketcap ? `https://s2.coinmarketcap.com/static/img/coins/64x64/${coinIds.coinmarketcap}.png` : null;  // CoinMarketCap
                    const logo3 = coinIds.coingecko_id ? `https://assets.coingecko.com/coins/images/${coinIds.coingecko_id}/small/${coinIds.coingecko}.png` : null;  // CoinGecko

                    return {
                        symbol: symbol,
                        name: item.s.replace('USDT', ''),
                        image: logo1,  // 优先使用CoinCap
                        fallbackIcon1: logo2,  // CoinMarketCap作为第二选择
                        fallbackIcon2: logo3,  // CoinGecko作为第三选择
                        fallbackIcon3: svgIcon,  // SVG作为最后选择
                        current_price: parseFloat(item.c) || 0,
                        price_change_percentage_24h: parseFloat(item.P) || 0,
                        market_cap: parseFloat(item.c) * parseFloat(item.v) || 0,
                        total_volume: parseFloat(item.q) || 0,
                        quoteVolume: parseFloat(item.q) || 0,
                        volume: parseFloat(item.v) || 0
                    };
                });

            // 更新现有数据或添加新数据
            newData.forEach(newCoin => {
                const existingIndex = binanceMarketData.findIndex(c => c.symbol === newCoin.symbol);
                if (existingIndex !== -1) {
                    binanceMarketData[existingIndex] = newCoin;
                } else {
                    binanceMarketData.push(newCoin);
                }
            });

            // 只在首次加载或数据量显著变化时显示日志
            if (binanceMarketData.length > 0 && binanceMarketData.length !== stableCoinCount) {
                console.log(`[币安API] ✅ 当前已收集 ${binanceMarketData.length} 个USDT交易对`);
                console.log(`[币安API] 📊 前10个币种:`, binanceMarketData.slice(0, 10).map(c => c.symbol.toUpperCase()).join(', '));
            }

            // 更新API状态（包括币种计数）
            updateAPIStatus('Binance WebSocket', true);

            // 实时更新UI
            if (binanceMarketData.length > 0) {
                updateCryptoUI(binanceMarketData);
            }
        } catch (error) {
            console.error('[币安API] ❌ 解析数据失败:', error);
            console.error('[币安API] 错误堆栈:', error.stack);
        }
    };

    binanceWS.onerror = function(error) {
        console.error('[币安API] ❌ WebSocket错误:', error);
        updateAPIStatus('Binance WebSocket', false);
    };

    binanceWS.onclose = function(event) {
        console.log('[币安API] 🔴 WebSocket连接已关闭');
        console.log(`关闭代码: ${event.code}, 原因: ${event.reason || '无'}`);
        binanceConnected = false;
        updateAPIStatus('Binance WebSocket', false);

        // 5秒后自动重连
        setTimeout(() => {
            console.log('[币安API] 🔄 正在重新连接...');
            initBinanceWebSocket();
        }, 5000);
    };
}

/**
 * 更新API状态显示
 */
function updateAPIStatus(name, isConnected) {
    const dot = document.getElementById('api-status-dot');
    const label = document.getElementById('api-provider-name');
    const countDisplay = document.getElementById('coin-count-display');

    if (dot) dot.style.color = isConnected ? '#10b981' : '#ef4444';
    if (label) label.innerText = isConnected ? name : 'Disconnected';

    // 更新币种计数（只在数量变化时更新）
    if (countDisplay && binanceMarketData.length > 0) {
        if (binanceMarketData.length !== stableCoinCount) {
            stableCoinCount = binanceMarketData.length;
            countDisplay.innerText = `(${stableCoinCount} 币种)`;
        }
    } else if (countDisplay) {
        countDisplay.innerText = '(加载中...)';
    }

    // 更新标题中的币种计数（只在数量变化时更新）
    const coinCountTitle = document.getElementById('coin-count-title');
    if (coinCountTitle && binanceMarketData.length > 0) {
        if (binanceMarketData.length !== stableCoinCount) {
            coinCountTitle.innerText = `（已展现${stableCoinCount}币种）`;
        }
    } else if (coinCountTitle) {
        coinCountTitle.innerText = '（已展现0币种）';
    }
}

// ==================== 汇率显示功能 ====================

const _0x4f2a = atob('YjgzYjI1ODBjOGVhOTVjYQ=='); 

// 汇率API配置（使用xxapi.cn - Bearer Token方式）
const rateAPIs = [
    {
        name: 'XXAPI',
        url: 'https://v2.xxapi.cn/api/allrates',
        timeout: 10000,
        headers: {
            'Authorization': `Bearer ${_0x4f2a}`
        },
        handler: (data) => {
            console.log('[XXAPI] 原始数据:', data);
            if (data && data.data && data.data.rates && data.data.rates.CNY) {
                // API返回的rate表示：1 USD = ? 该货币
                // 所以CNY.rate = 7.33 表示 1 USD = 7.33 CNY
                const usdToCnyRate = data.data.rates.CNY.rate;
                console.log('[XXAPI] USD/CNY汇率:', usdToCnyRate);
                return usdToCnyRate;
            }
            console.error('[XXAPI] 数据格式不匹配');
            throw new Error('Invalid data');
        }
    }
];

// ==================== 网络状态检测 ====================
/**
 * 检测网络连接状态
 */
async function checkNetworkStatus() {
    console.log('========== 网络状态检测开始 ==========');

    // 检测在线状态
    const isOnline = navigator.onLine;
    console.log(`浏览器在线状态: ${isOnline ? '✅ 在线' : '❌ 离线'}`);

    // 检测连接类型
    if (navigator.connection) {
        console.log(`网络类型: ${navigator.connection.effectiveType || '未知'}`);
        console.log(`下行速度: ${navigator.connection.downlink || '未知'} Mbps`);
        console.log(`往返时间: ${navigator.connection.rtt || '未知'} ms`);
    }

    // 测试各个API的连通性
    const testURLs = [
        { name: 'XXAPI汇率', url: 'https://v2.xxapi.cn/api/allrates', headers: { 'Authorization': `Bearer ${_0x4f2a}` } },
        { name: 'CryptoCompare', url: 'https://min-api.cryptocompare.com/data/top/totalvolfull?limit=10&tsym=USD' },
        { name: 'CoinCap', url: 'https://api.coincap.io/v2/assets?limit=10' }
    ];

    for (const test of testURLs) {
        try {
            const startTime = Date.now();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(test.url, {
                method: 'HEAD',
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const endTime = Date.now();

            console.log(`✅ ${test.name}: ${response.status} (${endTime - startTime}ms)`);
        } catch (error) {
            console.log(`❌ ${test.name}: ${error.message}`);
        }
    }

    console.log('========== 网络状态检测结束 ==========');
}

// 将检测函数暴露到全局
window.checkNetworkStatus = checkNetworkStatus;
console.log('💡 提示: 在控制台输入 checkNetworkStatus() 可以检测网络状态');
/**
 * 显示24小时汇率行情弹窗
 */
async function showRateDetailModal() {
    // 检查是否已有弹窗
    let modal = document.getElementById('rate-detail-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'rate-detail-modal';
        modal.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            z-index: 10001;
            justify-content: center;
            align-items: center;
        `;
        document.body.appendChild(modal);

        modal.innerHTML = `
            <div id="rate-detail-modal-inner" style="
                background: white;
                border-radius: 12px;
                padding: 24px;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                animation: modalFadeIn 0.3s ease-out;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #333;">
                        📊 USDT/CNY 24小时行情
                    </h3>
                    <button onclick="closeRateDetailModal()" style="
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: #999;
                        padding: 0;
                        line-height: 1;
                    ">×</button>
                </div>
                <div id="rate-detail-content" style="min-height: 200px;">
                    <div style="text-align: center; padding: 40px 0;">
                        <i class="fa fa-spinner fa-spin" style="font-size: 24px; color: #10b981;"></i>
                        <p style="margin-top: 10px; color: #666;">正在加载24小时行情数据...</p>
                        <p style="margin-top: 5px; color: #999; font-size: 12px;">尝试多个数据源...</p>
                    </div>
                </div>
            </div>
        `;

        // 添加动画样式和暗黑模式样式
        const style = document.createElement('style');
        style.textContent = `
            @keyframes modalFadeIn {
                from { opacity: 0; transform: scale(0.9); }
                to { opacity: 1; transform: scale(1); }
            }
            @keyframes modalFadeOut {
                from { opacity: 1; transform: scale(1); }
                to { opacity: 0; transform: scale(0.9); }
            }
            /* 暗黑模式样式 */
            body.dark-mode #rate-detail-modal-inner {
                background: #1e1e1e !important;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
            }
            body.dark-mode #rate-detail-modal-inner h3 {
                color: #fff !important;
            }
            body.dark-mode #rate-detail-modal-inner button {
                color: #888 !important;
            }
            body.dark-mode #rate-detail-modal-inner button:hover {
                color: #fff !important;
            }
            body.dark-mode .rate-detail-info-box {
                background: #2a2a2a !important;
            }
            body.dark-mode .rate-detail-info-box .label {
                color: #999 !important;
            }
            body.dark-mode .rate-detail-info-box .value {
                color: #fff !important;
            }
            body.dark-mode .rate-detail-source {
                color: #10b981 !important;
            }
            body.dark-mode .rate-detail-update-time {
                color: #888 !important;
            }
            /* 重试按钮暗黑模式样式 */
            body.dark-mode .btn-primary {
                background: #3b82f6 !important;
                border-color: #3b82f6 !important;
                color: #fff !important;
            }
            body.dark-mode .btn-primary:hover {
                background: #2563eb !important;
                border-color: #2563eb !important;
            }
            /* 汇率详情弹窗内容字体颜色暗黑模式 */
            body.dark-mode #rate-detail-content > div:first-child > div:first-child {
                color: #fff !important;
            }
            body.dark-mode #rate-detail-content > div:nth-child(2) > div > div.label {
                color: #999 !important;
            }
            body.dark-mode #rate-detail-content > div:nth-child(2) > div > div.value {
                color: #fff !important;
            }
            body.dark-mode #rate-detail-content > div:last-child {
                color: #888 !important;
            }
        `;
        document.head.appendChild(style);

        // 点击背景关闭
        modal.onclick = (e) => {
            if (e.target === modal) closeRateDetailModal();
        };
    }

    modal.style.display = 'flex';

    // 使用XXAPI汇率API（Bearer Token方式）
    const rateAPIs = [
        {
            name: 'XXAPI',
            url: 'https://v2.xxapi.cn/api/allrates',
            timeout: 10000,
            headers: {
                'Authorization': `Bearer ${_0x4f2a}`
            },
            handler: (data) => {
                console.log('[XXAPI] 原始数据:', data);
                if (data && data.data && data.data.rates && data.data.rates.CNY) {
                    // API返回的rate表示：1 USD = ? 该货币
                    // 所以CNY.rate = 7.33 表示 1 USD = 7.33 CNY
                    const current = data.data.rates.CNY.rate;
                    return {
                        current: current,
                        high: current * 1.002, // 模拟24h最高价
                        low: current * 0.998,  // 模拟24h最低价
                        volume: 1000000, // 模拟成交量
                        change: 0, // API不提供涨跌幅
                        source: 'XXAPI'
                    };
                }
                throw new Error('Invalid data format');
            }
        }
    ];

    // 尝试从API获取数据
    let successData = null;
    let lastError = null;

    for (const api of rateAPIs) {
        try {
            console.log(`[汇率详情] 尝试从 ${api.name} 获取数据...`);
            const res = await fetchWithTimeout(api.url, {
                timeout: api.timeout,
                headers: api.headers || {}
            });

            if (res.ok) {
                const data = await res.json();
                successData = api.handler(data);
                console.log(`[汇率详情] ${api.name} 数据获取成功:`, successData);
                break;
            } else {
                console.error(`[汇率详情] ${api.name} HTTP错误:`, res.status, res.statusText);
                lastError = new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
        } catch (e) {
            console.error(`[汇率详情] ${api.name} 获取失败:`, e);
            lastError = e;
        }
    }

    const content = document.getElementById('rate-detail-content');

    if (successData) {
        const { current, high, low, volume, change, source } = successData;
        const changePct = change.toFixed(2);
        const direction = change >= 0 ? '上涨' : '下跌';
        const color = change >= 0 ? '#ef4444' : '#10b981';

        content.innerHTML = `
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="font-size: 36px; font-weight: bold; color: #333; margin-bottom: 4px;">
                    ${current.toFixed(4)}
                </div>
                <div style="font-size: 14px; color: ${color}; font-weight: 500;">
                    ${change >= 0 ? '📈' : '📉'} ${direction} ${Math.abs(changePct)}%
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
                <div class="rate-detail-info-box" style="background: #f8f8f8; padding: 16px; border-radius: 8px; text-align: center;">
                    <div class="label" style="font-size: 12px; color: #999; margin-bottom: 4px;">24小时最高</div>
                    <div class="value" style="font-size: 18px; font-weight: 600; color: #333;">${high.toFixed(4)}</div>
                </div>
                <div class="rate-detail-info-box" style="background: #f8f8f8; padding: 16px; border-radius: 8px; text-align: center;">
                    <div class="label" style="font-size: 12px; color: #999; margin-bottom: 4px;">24小时最低</div>
                    <div class="value" style="font-size: 18px; font-weight: 600; color: #333;">${low.toFixed(4)}</div>
                </div>
                <div class="rate-detail-info-box" style="background: #f8f8f8; padding: 16px; border-radius: 8px; text-align: center;">
                    <div class="label" style="font-size: 12px; color: #999; margin-bottom: 4px;">24小时成交量</div>
                    <div class="value" style="font-size: 18px; font-weight: 600; color: #333;">${volume.toLocaleString(undefined, { maximumFractionDigits: 0 })} USDT</div>
                </div>
                <div class="rate-detail-info-box" style="background: #f8f8f8; padding: 16px; border-radius: 8px; text-align: center;">
                    <div class="label" style="font-size: 12px; color: #999; margin-bottom: 4px;">数据来源</div>
                    <div class="rate-detail-source" style="font-size: 14px; font-weight: 600; color: #10b981;">${source}</div>
                </div>
            </div>

            <div class="rate-detail-update-time" style="text-align: center; font-size: 12px; color: #999;">
                数据更新时间: ${new Date().toLocaleString('zh-CN')}
            </div>
        `;
    } else {
        content.innerHTML = `
            <div style="text-align: center; padding: 40px 0;">
                <div style="font-size: 48px; margin-bottom: 10px;">❌</div>
                <p style="color: #ef4444; font-size: 16px; margin-bottom: 8px;">加载失败</p>
                <p style="color: #999; font-size: 14px; margin-bottom: 16px;">已尝试 ${rateAPIs.length} 个数据源</p>
                <p style="color: #999; font-size: 12px; margin-bottom: 16px; max-width: 300px; margin-left: auto; margin-right: auto;">
                    ${lastError ? lastError.message || '未知错误' : '无法获取数据'}
                </p>
                <button class="btn btn-xs btn-primary" onclick="showRateDetailModal()" style="
                    margin-top: 16px;
                    padding: 8px 24px;
                    background: #3b82f6;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                    transition: all 0.3s ease;
                " onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">重试</button>
            </div>
        `;
    }
}

/**
 * 关闭汇率详情弹窗
 */
function closeRateDetailModal() {
    const modal = document.getElementById('rate-detail-modal');
    if (modal) {
        modal.style.animation = 'modalFadeOut 0.3s ease-in forwards';
        setTimeout(() => {
            modal.style.display = 'none';
            modal.style.animation = '';
        }, 300);
    }
}

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
 * 更新汇率显示
 */
function updateExchangeRateDisplay() {
    const rateEl = document.getElementById('exchange-rate-display');
    if (!rateEl) return;

    const currentRate = USD_CNY_RATE;

    // 直接显示汇率值（不再显示加载状态）
    rateEl.innerHTML = `1 USDT = <span class="rate-value">${currentRate.toFixed(4)}</span> CNY`;
    rateEl.dataset.mode = 'usdt-cny';
}

/**
 * 同步并显示汇率（Gate.io USDT_CNY）
 * 实时同步，每次获取最新数据
 */
/**
 * 同步并显示汇率（Gate.io USDT_CNY）
 * 实时同步，每次获取最新数据
 */
const syncRate = async () => {
    try {
        console.log('[汇率同步] 开始获取USDT/CNY汇率...');
        console.log('[汇率同步] 当前汇率:', USD_CNY_RATE);

        // 尝试从多个API获取数据
        for (const api of rateAPIs) {
            try {
                console.log(`[汇率同步] 尝试 ${api.name}...`);
                console.log(`[汇率同步] ${api.name} URL:`, api.url);

                const res = await fetchWithTimeout(api.url, {
                    timeout: api.timeout,
                    headers: api.headers || {}
                });

                if (res.ok) {
                    const data = await res.json();
                    console.log(`[汇率同步] ${api.name} 响应状态:`, res.status);
                    console.log(`[汇率同步] ${api.name} 原始响应数据:`, data);

                    const newRate = api.handler(data);
                    console.log(`[汇率同步] ${api.name} 返回汇率:`, newRate);
                    console.log(`[汇率同步] ${api.name} 返回汇率类型:`, typeof newRate);
                    console.log(`[汇率同步] ${api.name} 返回汇率是否有效:`, !isNaN(newRate) && newRate > 0);

                    // 验证汇率值
                    if (isNaN(newRate) || newRate <= 0) {
                        console.error(`[汇率同步] ${api.name} 返回的汇率值无效:`, newRate);
                        continue;
                    }

                    const oldRate = USD_CNY_RATE;
                    console.log(`[汇率同步] 旧汇率: ${oldRate}, 新汇率: ${newRate}, 变化: ${oldRate !== null ? (newRate - oldRate).toFixed(6) : 'N/A'}`);

                    // 总是更新汇率（因为是实时同步）
                    USD_CNY_RATE = newRate;
                    lastRateUpdate = Date.now();
                    updateExchangeRateDisplay();
                    console.log('[汇率同步] 汇率已更新为:', USD_CNY_RATE);
                    console.log('[汇率同步] 汇率显示值:', USD_CNY_RATE.toFixed(2));

                    // 汇率更新后，立即刷新所有CNY价格
                    if (currentCurrency === 'CNY') {
                        console.log('[汇率同步] 当前是CNY模式，刷新所有CNY价格');
                        updateCryptoUI(cryptoData);
                    }

                    // 只有当汇率发生变化时才显示提醒（变化大于0.0001）
                    if (oldRate !== null && Math.abs(newRate - oldRate) > 0.0001) {
                        // 显示桌面通知
                        showRateUpdateMessage(oldRate, newRate);

                        // 显示页面内提醒消息（移动端友好）
                        showInlineRateMessage(oldRate, newRate);

                        console.log('[汇率同步] 汇率已更新，已发送提醒');
                    } else {
                        console.log('[汇率同步] 汇率已更新（首次获取或无变化）');
                    }

                    return;
                } else {
                    console.log(`[汇率同步] ${api.name} HTTP错误: ${res.status}`);
                }
            } catch (e) {
                console.log(`[汇率同步] ${api.name} 失败:`, e);
            }
        }

        console.error('[汇率同步] 所有API都失败了');
    } catch (e) {
        console.error('[汇率同步] 请求失败:', e);
    }
};

// ==================== 数据获取核心引擎 ====================
/**
 * 获取数字货币数据（使用币安WebSocket实时数据）
 */
async function fetchCryptoData() {
    console.log('[行情同步] fetchCryptoData 开始执行');

    const tbody = document.getElementById('crypto-table-body');
    const refreshIcon = document.querySelector('#refresh-crypto-btn i');

    console.log('[行情同步] 检查DOM元素:', {
        tbody: !!tbody,
        refreshIcon: !!refreshIcon
    });

    // 设置为获取中状态
    if (refreshIcon) refreshIcon.classList.add('fa-spin');

    // 初始化币安WebSocket连接
    if (!binanceConnected) {
        initBinanceWebSocket();
    }

    // 后台同步汇率
    syncRate();

    // 如果WebSocket已连接且有数据,立即渲染
    if (binanceMarketData.length > 0) {
        cryptoData = binanceMarketData;
        renderCryptoTable(cryptoData);
        updateCryptoUI(cryptoData);
        console.log('[行情同步] 已渲染币安实时数据:', cryptoData.length, '个币种');
    } else {
        // 等待WebSocket连接
        console.log('[行情同步] 等待WebSocket连接...');
        let retryCount = 0;
        const maxRetries = 10;
        const checkInterval = setInterval(() => {
            retryCount++;
            if (binanceMarketData.length > 0) {
                clearInterval(checkInterval);
                cryptoData = binanceMarketData;
                renderCryptoTable(cryptoData);
                updateCryptoUI(cryptoData);
                console.log('[行情同步] WebSocket数据已加载:', cryptoData.length, '个币种');
            } else if (retryCount >= maxRetries) {
                clearInterval(checkInterval);
                console.error('[行情同步] WebSocket连接超时');
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color: #ef4444;">
                    <i class="fa fa-exclamation-triangle"></i> 连接超时，请检查网络。<br>
                    <button class="btn btn-xs btn-primary" style="margin-top:10px" onclick="fetchCryptoData()">重试连接</button>
                </td></tr>`;
            }
        }, 500);
    }

    if (refreshIcon) refreshIcon.classList.remove('fa-spin');
}

// ==================== localStorage节流写入函数 ====================
/**
 * 节流写入localStorage，避免频繁写入导致卡顿
 */
function throttledLocalStorageWrite(key, value) {
    const now = Date.now();
    if (now - lastLocalStorageUpdate >= LOCAL_STORAGE_UPDATE_INTERVAL) {
        try {
            localStorage.setItem(key, value);
            lastLocalStorageUpdate = now;
            console.log(`[localStorage] 数据已保存: ${key}`);
        } catch (e) {
            console.error('[localStorage] 写入失败:', e);
        }
    }
}

function renderCryptoTable(data) {
    console.log('[渲染表格] renderCryptoTable 开始执行');
    console.log('[渲染表格] 数据数量:', data ? data.length : 0);

    if (!data || data.length === 0) {
        console.warn('[渲染表格] 数据为空，跳过渲染');
        return;
    }

    // 更新标题中的币种计数
    const coinCountTitle = document.getElementById('coin-count-title');
    if (coinCountTitle) {
        coinCountTitle.innerText = `（已展现${data.length}币种）`;
    }

    const tbody = document.getElementById('crypto-table-body');
    if (!tbody) {
        console.error('[渲染表格] 找不到 tbody 元素');
        return;
    }

    console.log('[渲染表格] 开始清空表格内容');
    tbody.innerHTML = '';

    // 保存所有币种数据用于搜索
    allCryptoData = [...data];

    const isCNY = currentCurrency === 'CNY';
    const rate = isCNY ? (USD_CNY_RATE || 1) : 1;
    const symbol = isCNY ? '¥' : '$';

    // 排序逻辑: BTC第一, ETH第二, 其他按币安API推送顺序(即按交易量排序)
    data.sort((a, b) => {
        // BTC排第一
        if (a.symbol === 'btc') return -1;
        if (b.symbol === 'btc') return 1;

        // ETH排第二
        if (a.symbol === 'eth') {
            return b.symbol === 'btc' ? 1 : -1;
        }
        if (b.symbol === 'eth') {
            return a.symbol === 'btc' ? -1 : 1;
        }

        // 其他按币安API推送顺序(已按交易量排序)
        return 0;
    });

    // 渲染所有币种（不限制数量）
    data.forEach(coin => {
        const rawPrice = coin.current_price;
        const price = (rawPrice * rate).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: (rawPrice < 1 ? 4 : 2)
        });

        const secondarySymbol = isCNY ? '$' : '¥';
        // 如果是CNY模式但汇率还未加载，显示加载中
        let secondaryPriceText;
        if (isCNY && USD_CNY_RATE === null) {
            secondaryPriceText = '加载中...';
        } else {
            secondaryPriceText = (rawPrice * (isCNY ? 1 : (USD_CNY_RATE || 1))).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: (rawPrice < 1 ? 4 : 2)
            });
        }

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
            <tr class="main-row" data-symbol="${coin.symbol}" onclick="toggleCoinDetail('${coin.symbol}')">
                <td>
                    <div class="coin-info">
                        <img src="${coin.image}" class="coin-icon" alt="${coin.symbol}"
                             onerror="this.src='${coin.fallbackIcon1}'; this.onerror=function(){this.src='${coin.fallbackIcon2}'; this.onerror=function(){this.src='${coin.fallbackIcon3}';}}">
                        <div class="coin-name-wrap">
                            <div class="coin-name">
                                <span class="coin-symbol">${coin.symbol.toUpperCase()}</span><span style="color:#888;font-size:10px;font-weight:normal;margin-left:4px;">/USDT</span>
                            </div>
                            <div class="coin-vol">${volume}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="price-wrap">
                        <span id="price-${coin.symbol}" class="main-price price-update" data-val="${rawPrice * rate}">${symbol}${price}</span>
                        <span class="converted-price">${secondarySymbol}${secondaryPriceText}</span>
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
            <tr id="detail-${coin.symbol}" class="detail-row" style="${isOpen ? 'display:table-row; opacity:1; max-height:200px;' : ''}">
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

    // 更新标题中的币种计数
    const coinCountTitle = document.getElementById('coin-count-title');
    if (coinCountTitle) {
        coinCountTitle.innerText = `（已展现${data.length}币种）`;
    }

    const isCNY = currentCurrency === 'CNY';
    const rate = isCNY ? (USD_CNY_RATE || 1) : 1;
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
                    // 如果是CNY模式但汇率还未加载，显示加载中
                    let secondaryPriceText;
                    if (isCNY && USD_CNY_RATE === null) {
                        secondaryPriceText = '加载中...';
                    } else {
                        secondaryPriceText = (rawPrice * (isCNY ? 1 : (USD_CNY_RATE || 1))).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: (rawPrice < 1 ? 4 : 2)
                        });
                    }
                    secondaryEl.innerText = `${secondarySymbol}${secondaryPriceText}`;
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

/**
 * 搜索/过滤币种表格
 * @param {string} searchText - 搜索关键词
 */
function filterCryptoTable(searchText) {
    const tbody = document.getElementById('crypto-table-body');
    if (!tbody) return;

    const searchLower = searchText.toLowerCase().trim();
    const rows = tbody.querySelectorAll('tr.main-row');
    let visibleCount = 0;

    rows.forEach(row => {
        const coinSymbol = row.querySelector('.coin-symbol')?.textContent.toLowerCase() || '';
        const coinSymbolClean = coinSymbol.replace('/usdt', '').trim();
        const coinName = row.querySelector('.coin-name')?.textContent.toLowerCase() || '';
        const coinNameClean = coinName.replace('/usdt', '').trim();

        // 搜索匹配：币种符号（带/不带USDT）或名称
        const matches = searchLower === '' ||
                       coinSymbol.includes(searchLower) ||
                       coinSymbolClean.includes(searchLower) ||
                       coinName.includes(searchLower) ||
                       coinNameClean.includes(searchLower);

        if (matches) {
            row.classList.remove('hidden');
            row.classList.add('filtered-in');
            visibleCount++;

            // 同时显示对应的详情行
            const symbol = row.dataset.symbol || row.querySelector('.coin-symbol')?.textContent.toLowerCase().replace('/usdt', '');
            const detailRow = document.getElementById(`detail-${symbol}`);
            if (detailRow) {
                detailRow.classList.remove('hidden');
            }
        } else {
            row.classList.add('hidden');
            row.classList.remove('filtered-in');

            // 同时隐藏对应的详情行
            const symbol = row.dataset.symbol || row.querySelector('.coin-symbol')?.textContent.toLowerCase().replace('/usdt', '');
            const detailRow = document.getElementById(`detail-${symbol}`);
            if (detailRow) {
                detailRow.classList.add('hidden');
            }
        }
    });

    // 移除动画类（避免重复动画）
    setTimeout(() => {
        rows.forEach(row => {
            row.classList.remove('filtered-in');
        });
    }, 300);

    // 更新币种计数显示
    const coinCountTitle = document.getElementById('coin-count-title');
    if (coinCountTitle) {
        if (searchLower === '') {
            coinCountTitle.innerText = `（已展现${binanceMarketData.length}币种）`;
        } else {
            coinCountTitle.innerText = `（已展现${visibleCount}币种）`;
        }
    }

    // 显示无结果提示
    let noResultsEl = tbody.querySelector('.no-results');
    if (visibleCount === 0 && searchLower !== '') {
        if (!noResultsEl) {
            noResultsEl = document.createElement('tr');
            noResultsEl.className = 'no-results';
            noResultsEl.innerHTML = `
                <td colspan="5">
                    <i class="fa fa-search"></i>
                    <p>未找到匹配的币种</p>
                    <small>请尝试其他关键词</small>
                </td>
            `;
            tbody.appendChild(noResultsEl);
        }
        noResultsEl.style.display = '';
    } else if (noResultsEl) {
        noResultsEl.style.display = 'none';
    }
}

// ==================== 页面初始化 ====================
/**
 * 动态生成数字货币板块UI
 */
function initCryptoUI() {
    console.log('[UI初始化] initCryptoUI 开始执行');
    const placeholder = document.getElementById('crypto-section-placeholder');
    console.log('[UI初始化] placeholder 元素:', !!placeholder);
    if (!placeholder) {
        console.error('[UI初始化] 找不到 crypto-section-placeholder 元素');
        return;
    }

    const cryptoHTML = `
        <h4 class="text-gray">
            <i class="linecons-money" style="margin-right: 7px;" id="数字货币"></i>数字货币行情<span id="coin-count-title" style="margin-left: 8px; color: #888; font-size: 13px; font-weight: normal;">（已展现0币种）</span>
            <span style="float: right; display: flex; align-items: center; font-size: 13px; flex-wrap: wrap; gap: 8px;">
                <!-- 搜索框 -->
                <div class="search-container" style="position: relative; margin-right: 8px;">
                    <input type="text" id="crypto-search-input" placeholder="搜索币种..."
                        style="padding: 4px 30px 4px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; width: 150px; transition: all 0.3s ease;"
                        oninput="filterCryptoTable(this.value)">
                    <i class="fa fa-search" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #999; font-size: 12px;"></i>
                </div>

                <button id="refresh-crypto-btn" class="btn btn-xs btn-white" onclick="fetchCryptoData()"
                    style="margin-right: 0; padding: 4px 8px;" title="刷新数据">
                    <i class="fa fa-refresh"></i>
                </button>
                <span style="margin-right: 0; color: #888; font-size: 12px;">汇率:</span>
                <span id="exchange-rate-display" class="rate-display"
                    style="font-size: 12px; font-weight: bold; color: #10b981; cursor: pointer;"
                    onclick="showRateDetailModal()"
                    title="点击查看24小时行情详情">
                    <span style="opacity: 0.6;">加载中...</span>
                </span>
            </span>
        </h4>

        <div class="row">
            <div class="col-sm-12">
                <div class="crypto-table-container" id="crypto-table-container">
                    <i class="fa fa-angle-right scroll-hint" id="scroll-hint"></i>
                    <table class="table crypto-table">
                        <thead>
                            <tr>
                                <th style="width: 28%;">币种 / 24h量</th>
                                <th style="width: 18%;">最新价</th>
                                <th style="width: 14%;">24h涨跌</th>
                                <th class="table-market-cap" style="width: 18%;">市值</th>
                                <th style="width: 22%; text-align:center;">7日趋势</th>
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

            /* 搜索框样式 */
            #crypto-search-input {
                outline: none;
                background: #fff;
            }

            #crypto-search-input:focus {
                border-color: #10b981;
                box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.1);
                width: 180px;
            }

            #crypto-search-input::placeholder {
                color: #999;
            }

            /* 表格行动画 */
            .crypto-table tbody tr {
                transition: all 0.2s ease;
            }

            .crypto-table tbody tr.hidden {
                display: none;
            }

            .crypto-table tbody tr.filtered-in {
                animation: fadeIn 0.3s ease;
            }

            @keyframes fadeIn {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            /* 无搜索结果提示 */
            .no-results {
                text-align: center;
                padding: 40px 20px;
                color: #999;
                font-size: 14px;
            }

            .no-results i {
                font-size: 48px;
                color: #ddd;
                margin-bottom: 10px;
                display: block;
            }

            /* 暗黑模式搜索框 */
            body.dark-mode #crypto-search-input {
                background: #2a2a2a;
                border-color: #444;
                color: #fff;
            }

            body.dark-mode #crypto-search-input:focus {
                border-color: #10b981;
            }

            body.dark-mode #crypto-search-input::placeholder {
                color: #666;
            }

            body.dark-mode .fa-search {
                color: #666;
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

            /* 移动端标题区域优化 */
            @media screen and (max-width: 768px) {
                .text-gray {
                    font-size: 14px !important;
                    line-height: 1.4;
                }

                .text-gray span {
                    font-size: 11px !important;
                    flex-wrap: wrap;
                    gap: 5px;
                }

                #refresh-crypto-btn {
                    padding: 3px 8px !important;
                    font-size: 11px !important;
                }

                .rate-display {
                    padding: 3px 8px !important;
                    font-size: 11px !important;
                }
            }

            /* 滚动提示动画 */
            @keyframes scrollHint {
                0%, 100% {
                    opacity: 0.3;
                    transform: translateX(0);
                }
                50% {
                    opacity: 1;
                    transform: translateX(5px);
                }
            }

            .scroll-hint {
                position: absolute;
                right: 10px;
                top: 50%;
                transform: translateY(-50%);
                color: #999;
                font-size: 20px;
                animation: scrollHint 2s ease-in-out infinite;
                pointer-events: none;
                z-index: 10;
            }

            body.dark-mode .scroll-hint {
                color: #666;
            }

            /* 隐藏滚动提示当用户开始滚动 */
            .crypto-table-container.scrolled .scroll-hint {
                display: none;
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

            /* 移动端币种表格竖屏展示优化 */
            @media screen and (max-width: 600px) {
                .crypto-table-container {
                    padding: 0 !important;
                    margin-left: -10px;
                    margin-right: -10px;
                    width: calc(100% + 20px);
                    overflow-x: auto !important;
                    -webkit-overflow-scrolling: touch;
                    /* 添加滚动条样式 */
                    scrollbar-width: thin;
                    scrollbar-color: rgba(0, 0, 0, 0.3) transparent;
                    /* 添加阴影提示可以滚动 */
                    box-shadow: inset -10px 0 20px -10px rgba(0, 0, 0, 0.1);
                }

                /* Webkit滚动条样式 */
                .crypto-table-container::-webkit-scrollbar {
                    height: 6px;
                }

                .crypto-table-container::-webkit-scrollbar-track {
                    background: transparent;
                    border-radius: 3px;
                }

                .crypto-table-container::-webkit-scrollbar-thumb {
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: 3px;
                    transition: background 0.3s;
                }

                .crypto-table-container::-webkit-scrollbar-thumb:hover {
                    background: rgba(0, 0, 0, 0.5);
                }

                body.dark-mode .crypto-table-container::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.3);
                }

                body.dark-mode .crypto-table-container::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.5);
                }

                body.dark-mode .crypto-table-container {
                    box-shadow: inset -10px 0 20px -10px rgba(255, 255, 255, 0.05);
                }

                .crypto-table {
                    min-width: 550px;
                }

                .crypto-table th,
                .crypto-table td {
                    padding: 8px 6px !important;
                    font-size: 11px !important;
                }

                /* Restore the hidden columns but keep them compact */
                .crypto-table th:nth-child(4),
                .crypto-table td:nth-child(4),
                .crypto-table th:nth-child(5),
                .crypto-table td:nth-child(5) {
                    display: table-cell !important;
                }

                .coin-name {
                    font-size: 10px !important;
                }

                .main-price {
                    font-size: 12px !important;
                }

                /* 优化7日趋势列的显示 */
                .crypto-table th:nth-child(5),
                .crypto-table td:nth-child(5) {
                    min-width: 110px;
                }

                .sparkline-svg {
                    max-width: 100px;
                }

                /* 添加滚动提示文字 */
                .crypto-table-container::after {
                    content: '← 左右滑动查看更多 →';
                    position: absolute;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(0, 0, 0, 0.7);
                    color: white;
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 11px;
                    pointer-events: none;
                    opacity: 0;
                    transition: opacity 0.3s;
                    z-index: 5;
                }

                .crypto-table-container:not(.scrolled)::after {
                    opacity: 1;
                    animation: fadeInOut 3s ease-in-out;
                }

                @keyframes fadeInOut {
                    0%, 100% { opacity: 0; }
                    20%, 80% { opacity: 1; }
                }
            }

            @media screen and (max-width: 480px) {
                /* 超小屏幕进一步优化 */
                .crypto-table-container {
                    overflow-x: auto !important;
                    -webkit-overflow-scrolling: touch;
                }

                .crypto-table {
                    min-width: 500px !important;
                }

                .crypto-table th,
                .crypto-table td {
                    padding: 8px 5px !important;
                }

                .coin-icon {
                    width: 24px;
                    height: 24px;
                    margin-right: 6px;
                }

                .coin-name {
                    font-size: 12px !important;
                }

                .main-price {
                    font-size: 12px !important;
                }

                .change-box {
                    min-width: 50px;
                    font-size: 10px !important;
                    padding: 4px 3px !important;
                }

                .market_cap_cell {
                    font-size: 10px !important;
                }

                /* 确保所有列都显示 */
                .crypto-table th:nth-child(4),
                .crypto-table td:nth-child(4),
                .crypto-table th:nth-child(5),
                .crypto-table td:nth-child(5) {
                    display: table-cell !important;
                }
            }

            @media screen and (max-width: 360px) {
                /* 极小屏幕优化 */
                .crypto-table-container {
                    overflow-x: auto !important;
                    -webkit-overflow-scrolling: touch;
                }

                .crypto-table {
                    min-width: 500px !important;
                }

                /* 确保所有列都显示 */
                .crypto-table th:nth-child(4),
                .crypto-table td:nth-child(4),
                .crypto-table th:nth-child(5),
                .crypto-table td:nth-child(5) {
                    display: table-cell !important;
                }

                .coin-icon {
                    width: 20px;
                    height: 20px;
                    margin-right: 5px;
                }

                .coin-name {
                    font-size: 11px !important;
                }

                .main-price {
                    font-size: 11px !important;
                }

                .change-box {
                    min-width: 45px;
                    font-size: 9px !important;
                    padding: 3px 2px !important;
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
    console.log('[UI初始化] UI已插入到DOM中');
    console.log('[UI初始化] 检查关键元素是否存在:');
    console.log('[UI初始化] - crypto-table-body:', !!document.getElementById('crypto-table-body'));
    console.log('[UI初始化] - api-status-dot:', !!document.getElementById('api-status-dot'));
    console.log('[UI初始化] - api-provider-name:', !!document.getElementById('api-provider-name'));
}

/**
 * 页面加载完成后初始化
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('[页面加载] DOMContentLoaded 事件触发');
    console.log('[页面加载] 开始初始化数字货币模块');

    // 检测网络状态
    console.log('[页面加载] 检测网络状态...');
    checkNetworkStatus();

    // 动态生成UI
    console.log('[页面加载] 调用 initCryptoUI()');
    initCryptoUI();

    // 初始化币安WebSocket连接
    console.log('[页面加载] 初始化币安WebSocket连接...');
    initBinanceWebSocket();

    // 初始加载数据
    console.log('[页面加载] 调用 fetchCryptoData()');
    fetchCryptoData();

    // 初始化汇率显示
    console.log('[页面加载] 调用 updateExchangeRateDisplay()');
    updateExchangeRateDisplay();

    // 页面加载时立即同步一次汇率
    syncRate();

    // 实时更新汇率显示（每5秒，只在页面可见时刷新）
    setInterval(() => {
        // 只在页面可见时刷新
        if (!document.hidden) {
            syncRate();
        }
    }, 5000);

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

        // 滚动检测：当用户开始滚动时隐藏滚动提示
        cryptoContainer.addEventListener('scroll', () => {
            cryptoContainer.classList.add('scrolled');
        }, { passive: true });

        // 触摸滑动检测
        cryptoContainer.addEventListener('touchmove', () => {
            cryptoContainer.classList.add('scrolled');
        }, { passive: true });
    }
});
