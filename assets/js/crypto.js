// Crypto Logic - Digital Currency Module
// ==================== 数字货币行情模块 ====================
/**
 * 数字货币实时行情显示模块
 * 功能：获取并显示数字货币的实时价格、涨跌幅、市值等信息
 * 作者：何哥
 * 版本：1.0
 */

// ==================== 日志系统 ====================
/**
 * 统一日志系统，支持日志级别控制
 * 日志级别: debug(0) < info(1) < warn(2) < error(3)
 * 只有大于等于当前日志级别的日志才会输出
 */
const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
};

// 生产环境默认只显示 warn 和 error，开发环境显示所有日志
// 可通过 localStorage.cryptoLogLevel 修改日志级别
const LOG_LEVEL = (() => {
    const savedLevel = localStorage.getItem('cryptoLogLevel');
    if (savedLevel !== null) {
        const level = parseInt(savedLevel);
        if (level in LogLevel) return level;
    }
    // 默认只显示 warn 和 error 级别的日志（心跳日志单独处理）
    return LogLevel.WARN;
})();

/**
 * 日志函数
 */
const Logger = {
    debug: (...args) => {
        if (LOG_LEVEL <= LogLevel.DEBUG) {
            console.log('[DEBUG]', ...args);
        }
    },
    info: (...args) => {
        if (LOG_LEVEL <= LogLevel.INFO) {
            console.log('[INFO]', ...args);
        }
    },
    warn: (...args) => {
        if (LOG_LEVEL <= LogLevel.WARN) {
            console.warn('[WARN]', ...args);
        }
    },
    error: (...args) => {
        if (LOG_LEVEL <= LogLevel.ERROR) {
            console.error('[ERROR]', ...args);
        }
    },
    /**
     * 心跳日志（始终显示，不受日志级别限制）
     */
    heartbeat: (...args) => {
        console.log('[💓 心跳]', ...args);
    },
    /**
     * 设置日志级别
     * @param {number} level - 日志级别 (0=debug, 1=info, 2=warn, 3=error, 4=none)
     */
    setLevel: (level) => {
        if (level in LogLevel) {
            localStorage.setItem('cryptoLogLevel', level);
            console.log(`[日志系统] 日志级别已设置为: ${Object.keys(LogLevel)[level]}`);
        } else {
            console.error('[日志系统] 无效的日志级别:', level);
        }
    },
    /**
     * 获取当前日志级别
     */
    getLevel: () => {
        return Object.keys(LogLevel).find(key => LogLevel[key] === LOG_LEVEL) || 'UNKNOWN';
    }
};

// 暴露到全局，方便调试
window.Logger = Logger;

// ==================== 全局变量 ====================
let currentCurrency = 'USD'; // 当前货币类型：USD或CNY
let cryptoData = []; // 加密货币数据数组
let USD_CNY_RATE = 7.25; // 美元兑人民币汇率（默认值7.25，实时获取后会更新）
let lastRateUpdate = 0; // 上次汇率更新时间
let lastLocalStorageUpdate = 0; // 上次localStorage更新时间
const LOCAL_STORAGE_UPDATE_INTERVAL = 10000; // localStorage更新间隔：10秒

// ==================== 缓存相关常量 ====================
const CRYPTO_CACHE_KEY = 'crypto_data_cache'; // 币种数据缓存键名（已弃用，改用服务器缓存）
const CRYPTO_CACHE_EXPIRY = 5 * 60 * 1000; // 缓存过期时间：5分钟
let cachedCryptoData = null; // 缓存的币种数据（已弃用，改用服务器缓存）
const SERVER_CACHE_URL = 'https://crypto-websocket-proxy.onrender.com/api/cache'; // 服务器缓存端点

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
 * 从服务器缓存读取币种数据
 */
async function loadCachedCryptoData() {
    try {
        const res = await fetch(SERVER_CACHE_URL);
        if (res.ok) {
            const result = await res.json();
            if (result.success && result.data) {
                console.log(`[缓存] ✅ 从服务器缓存加载了 ${result.data.length} 个币种`);
                return result.data;
            }
        }
    } catch (e) {
        console.error('[缓存] ❌ 读取服务器缓存失败:', e);
    }
    return null;
}

/**
 * 保存币种数据到 localStorage（备用，已弃用）
 */
function saveCachedCryptoData(coins) {
    // 已弃用，改用服务器端缓存
    console.log('[缓存] 💾 已切换到服务器端缓存，本地缓存已弃用');
}

/**
 * 加载K线图数据
 * @param {string} id - 币种ID
 * @param {string} symbol - 币种符号
 * @param {number} changePct - 涨跌幅百分比
 */
async function loadSparkline(id, symbol, changePct) {
    // 如果已缓存，直接使用缓存数据，不再刷新
    if (sparklineCache[symbol]) {
        Logger.debug(`[K线图] ${symbol} 已缓存，跳过刷新`);
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
        // 使用您的代理服务器获取币安K线数据（获取7天数据）
        try {
            const res = await fetchWithTimeout(`https://crypto-websocket-proxy.onrender.com/api/klines?symbol=${symbol.toUpperCase()}USDT&interval=1d&limit=7`, { timeout: 10000 });
            if (res.ok) {
                const json = await res.json();
                if (Array.isArray(json) && json.length > 0) {
                    // 币安K线数据格式: [开盘时间, 开盘价, 最高价, 最低价, 收盘价, 成交量, ...]
                    // 我们只需要收盘价（索引4）
                    prices = json.map(d => parseFloat(d[4])).filter(p => !isNaN(p));
                }
            }
        } catch (e) {
            Logger.warn(`[K线图] ${symbol} 代理API请求失败:`, e.message);
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
                Logger.debug(`[K线缓存] 清理旧缓存: ${oldestSymbol}`);
            }

            Logger.debug(`[K线图] ${symbol} 数据加载成功，已缓存`);
            document.querySelectorAll(`.graph-container-${symbol}`).forEach(target => {
                const isDetail = target.id.startsWith('graph-detail-');
                target.innerHTML = generateSparklineSvg(prices, changePct, isDetail ? 240 : 100);
            });
        } else {
            throw new Error('No data');
        }
    } catch (e) {
        document.querySelectorAll(`.graph-container-${symbol}`).forEach(target => {
            target.innerHTML = `<a href="javascript:void(0)" onclick="event.stopPropagation(); event.preventDefault(); loadSparkline(null, '${symbol}', ${changePct})"
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
let isConnecting = false; // 连接锁，防止重复连接

// 心跳机制相关变量
let heartbeatInterval = null;
let lastHeartbeatTime = 0;
const HEARTBEAT_INTERVAL = 30000; // 心跳间隔：30秒
const HEARTBEAT_TIMEOUT = 60000; // 心跳超时：60秒（无响应则认为连接断开）

// 消息队列处理机制
let messageQueue = [];
let isProcessingQueue = false;
const MAX_QUEUE_SIZE = 100; // 最大队列长度

/**
 * 生成 SVG 渐变图标
 * @param {string} symbol - 币种符号
 * @returns {string} base64 编码的 SVG 图标
 */
function generateSvgIcon(symbol) {
    const symbolUpper = symbol.toUpperCase();
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
    
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
}

/**
 * 启动心跳机制
 */
function startHeartbeat() {
    // 清除旧的心跳定时器
    stopHeartbeat();

    // 初始化最后心跳时间
    lastHeartbeatTime = Date.now();

    // 设置心跳检测定时器
    heartbeatInterval = setInterval(() => {
        checkHeartbeat();
    }, HEARTBEAT_INTERVAL);

    Logger.heartbeat('[币安API] 💓 心跳机制已启动（每30秒检测一次）');
}

/**
 * 启动客户端主动心跳（发送心跳给服务器，保持连接活跃）
 */
let clientHeartbeatInterval = null;

function startClientHeartbeat() {
    // 清除旧的客户端心跳定时器
    stopClientHeartbeat();

    // 设置客户端心跳定时器（每60秒发送一次）
    clientHeartbeatInterval = setInterval(() => {
        if (binanceWS && binanceWS.readyState === WebSocket.OPEN) {
            try {
                const heartbeatMsg = JSON.stringify({
                    type: 'client_heartbeat',
                    timestamp: new Date().toISOString(),
                    client_time: Date.now()
                });
                binanceWS.send(heartbeatMsg);
                Logger.heartbeat('[币安API] 💓 发送客户端心跳给服务器');
                Logger.debug('[币安API] 💓 心跳内容:', heartbeatMsg);
            } catch (error) {
                Logger.error('[币安API] ❌ 发送客户端心跳失败:', error);
            }
        } else {
            Logger.warn('[币安API] ⚠️ WebSocket未连接，无法发送心跳');
        }
    }, 60000); // 60秒

    Logger.heartbeat('[币安API] 💓 客户端心跳已启动（每60秒发送一次）');
}

/**
 * 停止客户端心跳机制
 */
function stopClientHeartbeat() {
    if (clientHeartbeatInterval) {
        clearInterval(clientHeartbeatInterval);
        clientHeartbeatInterval = null;
        Logger.info('[币安API] 💔 客户端心跳已停止');
    }
}

/**
 * 停止心跳机制
 */
function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
        Logger.info('[币安API] 💔 心跳机制已停止');
    }
    
    // 同时停止客户端心跳
    stopClientHeartbeat();
    
    Logger.info('[币安API] 💔 双向心跳机制已停止');
}

/**
 * 检查心跳状态
 */
function checkHeartbeat() {
    const now = Date.now();
    const timeSinceLastHeartbeat = now - lastHeartbeatTime;

    if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT) {
        Logger.warn(`[币安API] ⚠️ 心跳超时！上次心跳已超过 ${HEARTBEAT_TIMEOUT / 1000} 秒`);
        Logger.warn('[币安API] 🔴 检测到连接可能已断开，正在重连...');

        // 关闭当前连接并重新连接
        if (binanceWS) {
            binanceWS.close();
        }
    } else {
        Logger.heartbeat('[币安API] 💓 心跳正常');
        Logger.debug(`[币安API] 距离上次心跳: ${timeSinceLastHeartbeat}ms`);
    }
}

/**
 * 初始化币安WebSocket连接
 */
function initBinanceWebSocket() {
    Logger.info('[币安API] 🔄 正在初始化WebSocket连接...');

    // 检查连接锁，防止重复连接
    if (isConnecting) {
        Logger.debug('[币安API] ⏳ 正在连接中，跳过重复请求');
        return;
    }

    // 如果已连接，直接返回
    if (binanceWS && binanceConnected) {
        Logger.info('[币安API] ✅ WebSocket已连接，跳过重复连接');
        return;
    }

    // 设置连接锁
    isConnecting = true;

    // 如果已有连接但未连接，先关闭
    if (binanceWS) {
        Logger.warn('[币安API] ⚠️ 检测到旧连接，正在关闭...');
        try {
            binanceWS.close();
        } catch (e) {
            Logger.warn('[币安API] 关闭旧连接时出错:', e.message);
        }
        binanceWS = null;
    }

    // 使用 WebSocket 代理服务器（解决国内网络访问问题）
    const wsUrl = 'wss://crypto-websocket-proxy.onrender.com';
    Logger.debug('[币安API] 📡 连接地址:', wsUrl);
    Logger.info('[币安API] 🌐 使用代理服务器连接币安数据');

    // 设置连接超时（10秒）
    const connectionTimeout = setTimeout(() => {
        if (!binanceConnected && isConnecting) {
            Logger.warn('[币安API] ⏰ WebSocket连接超时');
            isConnecting = false;
            updateAPIStatus('Binance WebSocket', false);

            // 显示连接超时提示
            const tbody = document.getElementById('crypto-table-body');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color: #999;">
                    <i class="fa fa-clock-o" style="font-size: 24px; margin-bottom: 8px;"></i>
                    <p style="font-size: 14px;">连接超时，请检查网络或代理设置</p>
                </td></tr>`;
            }
        }
    }, 10000);

    try {
        binanceWS = new WebSocket(wsUrl);
    } catch (e) {
        Logger.error('[币安API] ❌ 创建WebSocket失败:', e);
        isConnecting = false;
        clearTimeout(connectionTimeout);
        return;
    }

    binanceWS.onopen = function () {
        clearTimeout(connectionTimeout);
        isConnecting = false;
        binanceConnected = true;

        Logger.info('[币安API] ✅ WebSocket连接已建立');
        Logger.debug('[币安API] 📡 等待接收数据...');
        updateAPIStatus('Binance WebSocket', true);

        // 启动心跳机制
        startHeartbeat();

        // 启动客户端主动心跳（每60秒发送一次，保持连接活跃）
        startClientHeartbeat();
        
        Logger.heartbeat('[币安API] 💓 双向心跳机制已启动');
    };

    binanceWS.onmessage = function (event) {
        // 更新最后心跳时间（收到任何消息都视为心跳响应）
        lastHeartbeatTime = Date.now();

        // 处理 Blob 或 String 数据
        let messageData = event.data;
        
        // 如果是 Blob，需要转换为文本
        if (messageData instanceof Blob) {
            messageData = new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error('Failed to read Blob'));
                reader.readAsText(messageData);
            });
        }

        // 将消息加入队列
        if (messageQueue.length >= MAX_QUEUE_SIZE) {
            // 队列已满，丢弃最旧的消息
            messageQueue.shift();
        }
        
        if (messageData instanceof Promise) {
            // 异步处理 Blob
            messageData.then(text => {
                if (messageQueue.length >= MAX_QUEUE_SIZE) {
                    messageQueue.shift();
                }
                messageQueue.push(text);
                if (!isProcessingQueue) {
                    processMessageQueue();
                }
            }).catch(error => {
                Logger.error('[币安API] ❌ Blob读取失败:', error);
            });
        } else {
            // 同步处理 String
            messageQueue.push(messageData);
            if (!isProcessingQueue) {
                processMessageQueue();
            }
        }
    };

    /**
     * 处理消息队列
     */
    function processMessageQueue() {
        if (messageQueue.length === 0) {
            isProcessingQueue = false;
            return;
        }

        isProcessingQueue = true;

        // 取出最新的一条消息（丢弃旧消息）
        const latestData = messageQueue.pop();
        messageQueue = []; // 清空队列

        const startTime = performance.now();

        try {
            const data = JSON.parse(latestData);

            // 处理服务器心跳
            if (data.type === 'heartbeat') {
                Logger.heartbeat('[币安API] 💓 收到服务器心跳');
                Logger.debug('[币安API] 💓 服务器时间:', data.timestamp);
                Logger.debug('[币安API] 💓 服务器时间戳:', data.server_time);

                // 更新最后心跳时间
                lastHeartbeatTime = Date.now();

                if (binanceWS && binanceWS.readyState === WebSocket.OPEN) {
                    const responseMsg = JSON.stringify({
                        type: 'heartbeat_response',
                        timestamp: new Date().toISOString(),
                        client_time: Date.now()
                    });
                    binanceWS.send(responseMsg);
                    Logger.heartbeat('[币安API] 💓 已回复服务器心跳');
                    Logger.debug('[币安API] 💓 回复内容:', responseMsg);
                }

                isProcessingQueue = false;
                return;
            }

            // 处理服务器重启通知
            if (data.type === 'server_restart') {
                Logger.warn('[币安API] ⚠️ 收到服务器重启通知:', data.message);
                Logger.info('[币安API] 🔄 3秒后自动重连...');
                
                // 关闭当前连接，触发重连
                if (binanceWS) {
                    binanceWS.close();
                }
                
                isProcessingQueue = false;
                return;
            }

            // 调试：打印数据类型
            if (binanceMarketData.length === 0) {
                Logger.debug('[币安API] 🔍 接收到的数据类型:', Array.isArray(data) ? 'Array' : typeof data);
                Logger.debug('[币安API] 🔍 数据内容预览:', JSON.stringify(data).substring(0, 200));
            }

            if (!Array.isArray(data)) {
                Logger.warn('[币安API] ⚠️ 接收到的数据格式不正确，期望 Array，实际:', typeof data);
                Logger.warn('[币安API] 🔍 实际数据:', JSON.stringify(data).substring(0, 500));
                isProcessingQueue = false;
                return;
            }

            // 只在首次加载时显示详细日志
            if (binanceMarketData.length === 0) {
                Logger.info(`[币安API] 📦 首次接收到 ${data.length} 个交易对数据`);
            }

            // 使用 requestAnimationFrame 避免阻塞主线程
            requestAnimationFrame(() => {
                try {
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

                            // 获取币种ID映射
                            const coinIds = COIN_ID_MAP[symbol] || {};

                            // 生成 SVG 图标作为备用方案
                            const svgIcon = generateSvgIcon(symbol);

                            // 在线logo URL（按优先级排序）
                            const logo1 = `https://assets.coincap.io/assets/icons/${symbol}@2x.png`;  // CoinCap
                            const logo2 = coinIds.coinmarketcap ? `https://s2.coinmarketcap.com/static/img/coins/64x64/${coinIds.coinmarketcap}.png` : svgIcon;  // CoinMarketCap作为第二选择
                            const logo3 = coinIds.coingecko_id ? `https://assets.coingecko.com/coins/images/${coinIds.coingecko_id}/small/${coinIds.coingecko}.png` : svgIcon;  // CoinGecko作为第三选择

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
                        Logger.info(`[币安API] ✅ 当前已收集 ${binanceMarketData.length} 个USDT交易对`);
                        Logger.debug(`[币安API] 📊 前10个币种:`, binanceMarketData.slice(0, 10).map(c => c.symbol.toUpperCase()).join(', '));
                    }

                    // 更新API状态（包括币种计数）
                    updateAPIStatus('Binance WebSocket', true);

                    // 实时更新UI（使用节流避免频繁更新）
                    if (binanceMarketData.length > 0) {
                        throttledUpdateUI(binanceMarketData);
                    }

                    // 性能监控
                    const endTime = performance.now();
                    const duration = endTime - startTime;
                    if (duration > 100) {
                        Logger.warn(`[性能] WebSocket message handler 耗时: ${duration.toFixed(2)}ms`);
                    }

                    // 处理完成后，继续处理队列中的下一条消息
                    isProcessingQueue = false;
                    if (messageQueue.length > 0) {
                        requestAnimationFrame(() => processMessageQueue());
                    }
                } catch (error) {
                    Logger.error('[币安API] ❌ 处理数据失败:', error);
                    Logger.error('[币安API] 错误堆栈:', error.stack);
                    isProcessingQueue = false;
                }
            });
        } catch (error) {
            Logger.error('[币安API] ❌ 解析数据失败:', error);
            Logger.error('[币安API] 错误堆栈:', error.stack);
            isProcessingQueue = false;
        }
    }

    binanceWS.onerror = function (error) {
        isConnecting = false;
        binanceConnected = false;
        Logger.error('[币安API] ❌ WebSocket错误:', error);
        updateAPIStatus('Binance WebSocket', false);

        // 停止心跳机制
        stopHeartbeat();
    };

    binanceWS.onclose = function (event) {
        isConnecting = false;
        binanceConnected = false;

        // 详细的关闭原因分析
        const closeCodes = {
            1000: '正常关闭',
            1001: '端点离开',
            1002: '协议错误',
            1003: '不支持的数据类型',
            1006: '连接异常关闭',
            1007: '无效的帧类型数据',
            1008: '违反策略',
            1009: '消息太大',
            1010: '缺少扩展',
            1011: '内部错误',
            1012: '服务重启',
            1013: '尝试重新连接',
            1014: '服务器拒绝',
            1015: 'TLS握手失败'
        };

        const closeReason = closeCodes[event.code] || '未知原因';
        Logger.warn('[币安API] 🔴 WebSocket连接已关闭');
        Logger.warn(`[币安API] 关闭代码: ${event.code} (${closeReason})`);
        Logger.warn(`[币安API] 关闭原因: ${event.reason || '无'}`);
        Logger.warn(`[币安API] 是否干净关闭: ${event.wasClean}`);
        updateAPIStatus('Binance WebSocket', false);

        // 停止心跳机制
        stopHeartbeat();

        // 只在非正常关闭时自动重连（1000=正常关闭）
        if (event.code !== 1000) {
            // 根据关闭代码调整重连时间
            let reconnectDelay = 5000; // 默认5秒

            if (event.code === 1006) {
                // 连接异常关闭，可能是服务器重启，快速重连
                reconnectDelay = 3000;
                Logger.info('[币安API] 🔄 检测到异常关闭，3秒后快速重连...');
            } else if (event.code === 1012) {
                // 服务重启，中等延迟重连
                reconnectDelay = 5000;
                Logger.info('[币安API] 🔄 检测到服务重启，5秒后重连...');
            } else {
                Logger.info('[币安API] 🔄 5秒后自动重连...');
            }

            setTimeout(() => {
                initBinanceWebSocket();
            }, reconnectDelay);
        } else {
            Logger.info('[币安API] ✅ 正常关闭，无需重连');
        }
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
            Logger.debug('[XXAPI] 原始数据:', data);
            if (data && data.data && data.data.rates && data.data.rates.CNY) {
                // API返回的rate表示：1 USD = ? 该货币
                // 所以CNY.rate = 7.33 表示 1 USD = 7.33 CNY
                const usdToCnyRate = data.data.rates.CNY.rate;
                Logger.debug('[XXAPI] USD/CNY汇率:', usdToCnyRate);
                return usdToCnyRate;
            }
            Logger.error('[XXAPI] 数据格式不匹配');
            throw new Error('Invalid data');
        }
    }
];

// ==================== UI 更新节流 ====================
/**
 * 节流更新UI，避免频繁DOM操作导致性能问题
 */
let lastUIUpdateTime = 0;
const UI_UPDATE_THROTTLE = 100; // UI更新节流间隔：100ms

function throttledUpdateUI(data) {
    const now = Date.now();
    if (now - lastUIUpdateTime >= UI_UPDATE_THROTTLE) {
        lastUIUpdateTime = now;
        requestAnimationFrame(() => {
            updateCryptoUI(data);
        });
    }
}

// ==================== 网络状态检测 ====================
/**
 * 检测网络连接状态
 */
async function checkNetworkStatus() {
    Logger.info('========== 网络状态检测开始 ==========');

    // 检测在线状态
    const isOnline = navigator.onLine;
    Logger.info(`浏览器在线状态: ${isOnline ? '✅ 在线' : '❌ 离线'}`);

    // 检测连接类型
    if (navigator.connection) {
        Logger.info(`网络类型: ${navigator.connection.effectiveType || '未知'}`);
        Logger.info(`下行速度: ${navigator.connection.downlink || '未知'} Mbps`);
        Logger.info(`往返时间: ${navigator.connection.rtt || '未知'} ms`);
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

            Logger.info(`✅ ${test.name}: ${response.status} (${endTime - startTime}ms)`);
        } catch (error) {
            Logger.warn(`❌ ${test.name}: ${error.message}`);
        }
    }

    Logger.info('========== 网络状态检测结束 ==========');
}

// 将检测函数暴露到全局
window.checkNetworkStatus = checkNetworkStatus;
Logger.info('💡 提示: 在控制台输入 checkNetworkStatus() 可以检测网络状态');
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
                    <button onclick="event.stopPropagation(); closeRateDetailModal()" style="
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
                Logger.debug('[XXAPI] 原始数据:', data);
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
            Logger.info(`[汇率详情] 尝试从 ${api.name} 获取数据...`);
            const res = await fetchWithTimeout(api.url, {
                timeout: api.timeout,
                headers: api.headers || {}
            });

            if (res.ok) {
                const data = await res.json();
                successData = api.handler(data);
                Logger.info(`[汇率详情] ${api.name} 数据获取成功:`, successData);
                break;
            } else {
                Logger.error(`[汇率详情] ${api.name} HTTP错误:`, res.status, res.statusText);
                lastError = new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
        } catch (e) {
            Logger.error(`[汇率详情] ${api.name} 获取失败:`, e);
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
                <button class="btn btn-xs btn-primary" onclick="event.stopPropagation(); showRateDetailModal()" style="
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
        Logger.debug('[汇率同步] 开始获取USDT/CNY汇率...');
        Logger.debug('[汇率同步] 当前汇率:', USD_CNY_RATE);

        // 尝试从多个API获取数据
        for (const api of rateAPIs) {
            try {
                Logger.info(`[汇率同步] 尝试 ${api.name}...`);
                Logger.debug(`[汇率同步] ${api.name} URL:`, api.url);

                const res = await fetchWithTimeout(api.url, {
                    timeout: api.timeout,
                    headers: api.headers || {}
                });

                if (res.ok) {
                    const data = await res.json();
                    Logger.debug(`[汇率同步] ${api.name} 响应状态:`, res.status);
                    Logger.debug(`[汇率同步] ${api.name} 原始响应数据:`, data);

                    const newRate = api.handler(data);
                    Logger.debug(`[汇率同步] ${api.name} 返回汇率:`, newRate);
                    Logger.debug(`[汇率同步] ${api.name} 返回汇率类型:`, typeof newRate);
                    Logger.debug(`[汇率同步] ${api.name} 返回汇率是否有效:`, !isNaN(newRate) && newRate > 0);

                    // 验证汇率值
                    if (isNaN(newRate) || newRate <= 0) {
                        Logger.error(`[汇率同步] ${api.name} 返回的汇率值无效:`, newRate);
                        continue;
                    }

                    const oldRate = USD_CNY_RATE;
                    Logger.debug(`[汇率同步] 旧汇率: ${oldRate}, 新汇率: ${newRate}, 变化: ${oldRate !== null ? (newRate - oldRate).toFixed(6) : 'N/A'}`);

                    // 总是更新汇率（因为是实时同步）
                    USD_CNY_RATE = newRate;
                    lastRateUpdate = Date.now();
                    updateExchangeRateDisplay();
                    Logger.info('[汇率同步] 汇率已更新为:', USD_CNY_RATE);
                    Logger.debug('[汇率同步] 汇率显示值:', USD_CNY_RATE.toFixed(2));

                    // 汇率更新后，立即刷新所有CNY价格
                    if (currentCurrency === 'CNY') {
                        Logger.debug('[汇率同步] 当前是CNY模式，刷新所有CNY价格');
                        updateCryptoUI(cryptoData);
                    }

                    // 只有当汇率发生变化时才显示提醒（变化大于0.0001）
                    if (oldRate !== null && Math.abs(newRate - oldRate) > 0.0001) {
                        // 显示桌面通知
                        showRateUpdateMessage(oldRate, newRate);

                        // 显示页面内提醒消息（移动端友好）
                        showInlineRateMessage(oldRate, newRate);

                        Logger.info('[汇率同步] 汇率已更新，已发送提醒');
                    } else {
                        Logger.debug('[汇率同步] 汇率已更新（首次获取或无变化）');
                    }

                    return;
                } else {
                    Logger.warn(`[汇率同步] ${api.name} HTTP错误: ${res.status}`);
                }
            } catch (e) {
                Logger.error(`[汇率同步] ${api.name} 失败:`, e);
            }
        }

        Logger.error('[汇率同步] 所有API都失败了');
    } catch (e) {
        Logger.error('[汇率同步] 请求失败:', e);
    }
};

// ==================== 数据获取核心引擎 ====================
/**
 * 获取数字货币数据（使用币安WebSocket实时数据）
 */
async function fetchCryptoData() {
    Logger.info('[行情同步] fetchCryptoData 开始执行');

    const tbody = document.getElementById('crypto-table-body');

    Logger.debug('[行情同步] 检查DOM元素:', {
        tbody: !!tbody
    });

    // 优先使用缓存数据
    const cachedData = loadCachedCryptoData();
    if (cachedData && cachedData.length > 0) {
        cryptoData = cachedData;
        renderCryptoTable(cryptoData);
        updateCryptoUI(cryptoData);
        Logger.info('[行情同步] ✅ 已从缓存加载:', cryptoData.length, '个币种');
    }

    // 初始化币安WebSocket连接
    if (!binanceConnected) {
        initBinanceWebSocket();
    }

    // 后台同步汇率
    syncRate();

    // 如果WebSocket已连接且有数据,立即渲染（覆盖缓存）
    if (binanceMarketData.length > 0) {
        cryptoData = binanceMarketData;
        renderCryptoTable(cryptoData);
        updateCryptoUI(cryptoData);
        Logger.info('[行情同步] 已渲染币安实时数据:', cryptoData.length, '个币种');
    } else {
        // 等待WebSocket连接
        Logger.debug('[行情同步] 等待WebSocket连接...');
        let retryCount = 0;
        const maxRetries = 10;
        const checkInterval = setInterval(() => {
            retryCount++;
            if (binanceMarketData.length > 0) {
                clearInterval(checkInterval);
                cryptoData = binanceMarketData;
                renderCryptoTable(cryptoData);
                updateCryptoUI(cryptoData);
                Logger.info('[行情同步] WebSocket数据已加载:', cryptoData.length, '个币种');
            } else if (retryCount >= maxRetries) {
                clearInterval(checkInterval);
                Logger.error('[行情同步] WebSocket连接超时');
                // 如果有缓存数据，继续显示缓存，否则显示错误
                if (cachedData && cachedData.length > 0) {
                    Logger.warn('[行情同步] 使用缓存数据继续显示');
                } else {
                    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color: #ef4444;">
                        <i class="fa fa-exclamation-triangle"></i> 连接超时，请检查网络或稍后刷新页面。
                    </td></tr>`;
                }
            }
        }, 500);
    }
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
            Logger.debug(`[localStorage] 数据已保存: ${key}`);
        } catch (e) {
            Logger.error('[localStorage] 写入失败:', e);
        }
    }
}

function renderCryptoTable(data) {
    Logger.debug('[渲染表格] renderCryptoTable 开始执行');
    Logger.debug('[渲染表格] 数据数量:', data ? data.length : 0);

    if (!data || data.length === 0) {
        Logger.warn('[渲染表格] 数据为空，跳过渲染');
        return;
    }

    // 更新标题中的币种计数
    const coinCountTitle = document.getElementById('coin-count-title');
    if (coinCountTitle) {
        coinCountTitle.innerText = `（已展现${data.length}币种）`;
    }

    const tbody = document.getElementById('crypto-table-body');
    if (!tbody) {
        Logger.error('[渲染表格] 找不到 tbody 元素');
        return;
    }

    Logger.debug('[渲染表格] 开始清空表格内容');
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
            <tr class="main-row" data-symbol="${coin.symbol}" onclick="event.stopPropagation(); toggleCoinDetail('${coin.symbol}')">
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
        const isNone = row.style.display === 'none' || row.classList.contains('detail-hidden');
        if (isNone) {
            row.style.display = 'table-row';
            row.classList.remove('detail-hidden');
            // 使用 requestAnimationFrame 避免强制重排
            requestAnimationFrame(() => {
                row.style.opacity = '1';
                row.style.maxHeight = '200px';
            });
            expandedCoins.add(symbol);
        } else {
            row.style.opacity = '0';
            row.style.maxHeight = '0';
            // 延迟隐藏，避免强制重排
            setTimeout(() => {
                row.style.display = 'none';
                row.classList.add('detail-hidden');
            }, 300);
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

    // 不再保存到本地缓存，服务器端会自动缓存

    // 更新标题中的币种计数
    const coinCountTitle = document.getElementById('coin-count-title');
    if (coinCountTitle) {
        coinCountTitle.innerText = `（已展现${data.length}币种）`;
    }

    const isCNY = currentCurrency === 'CNY';
    const rate = isCNY ? (USD_CNY_RATE || 1) : 1;
    const symbol = isCNY ? '¥' : '$';

    // 批量收集需要更新的元素，减少DOM查询
    const updates = [];

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

                updates.push({
                    element: priceEl,
                    text: newText,
                    dataset: { val: newVal },
                    cell: priceEl.closest('td'),
                    pulseClass: newVal >= oldVal ? 'pulse-green' : 'pulse-red',
                    secondaryEl: priceEl.nextElementSibling,
                    secondarySymbol: isCNY ? '$' : '¥',
                    rawPrice: rawPrice,
                    isCNY: isCNY
                });
            }
        }

        if (changeEl) {
            const change = coin.price_change_percentage_24h;
            const changeSign = change >= 0 ? '+' : '';
            const newText = `${changeSign}${change.toFixed(2)}%`;

            if (changeEl.innerText.trim() !== newText) {
                updates.push({
                    element: changeEl,
                    text: newText,
                    className: `change-box ${change >= 0 ? 'change-up' : 'change-down'} price-update`,
                    cell: changeEl.closest('td'),
                    pulseClass: change >= 0 ? 'pulse-green' : 'pulse-red',
                    isChange: true
                });
            }
        }
    });

    // 批量应用更新，减少重排
    requestAnimationFrame(() => {
        updates.forEach(update => {
            if (update.element) {
                update.element.innerText = update.text;

                if (update.dataset) {
                    update.element.dataset.val = update.dataset.val;
                }

                if (update.className) {
                    update.element.className = update.className;
                }
            }

            if (update.secondaryEl && update.secondaryEl.classList.contains('converted-price')) {
                let secondaryPriceText;
                if (update.isCNY && USD_CNY_RATE === null) {
                    secondaryPriceText = '加载中...';
                } else {
                    secondaryPriceText = (update.rawPrice * (update.isCNY ? 1 : (USD_CNY_RATE || 1))).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: (update.rawPrice < 1 ? 4 : 2)
                    });
                }
                update.secondaryEl.innerText = `${update.secondarySymbol}${secondaryPriceText}`;
            }

            if (update.cell) {
                // 移除旧的动画类
                update.cell.classList.remove('pulse-green', 'pulse-red');
                
                // 使用 requestAnimationFrame 在下一帧添加新动画类，避免强制重排
                requestAnimationFrame(() => {
                    update.cell.classList.add(update.pulseClass);
                    
                    // 1秒后移除动画类
                    setTimeout(() => {
                        update.cell.classList.remove(update.pulseClass);
                    }, 1000);
                });
            }
        });
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
        const coinName = row.querySelector('.coin-name')?.textContent.toLowerCase() || '';

        // 搜索匹配：币种符号或名称
        const matches = searchLower === '' ||
            coinSymbol.includes(searchLower) ||
            coinName.includes(searchLower);

        if (matches) {
            row.classList.remove('hidden');
            row.classList.add('filtered-in');
            visibleCount++;

            // 同时显示对应的详情行
            const symbol = row.querySelector('.coin-symbol')?.textContent.toLowerCase();
            const detailRow = document.getElementById(`detail-${symbol}`);
            if (detailRow) {
                detailRow.classList.remove('hidden');
            }
        } else {
            row.classList.add('hidden');
            row.classList.remove('filtered-in');

            // 同时隐藏对应的详情行
            const symbol = row.querySelector('.coin-symbol')?.textContent.toLowerCase();
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
    Logger.info('[UI初始化] initCryptoUI 开始执行');
    const placeholder = document.getElementById('crypto-section-placeholder');
    Logger.debug('[UI初始化] placeholder 元素:', !!placeholder);
    if (!placeholder) {
        Logger.error('[UI初始化] 找不到 crypto-section-placeholder 元素');
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

                <span style="margin-right: 0; color: #888; font-size: 12px;">汇率:</span>
                <span id="exchange-rate-display" class="rate-display"
                    style="font-size: 12px; font-weight: bold; color: #10b981; cursor: pointer;"
                    onclick="event.stopPropagation(); showRateDetailModal()"
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
                font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
                font-weight: bold;
                font-size: 14px;
                color: #1a1a1a;
            }

            .coin-symbol {
                font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
                font-weight: bold;
                color: #1a1a1a;
                font-size: 14px;
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

            body.dark-mode .coin-symbol {
                color: #fff;
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
    Logger.debug('[UI初始化] UI已插入到DOM中');
    Logger.debug('[UI初始化] 检查关键元素是否存在:');
    Logger.debug('[UI初始化] - crypto-table-body:', !!document.getElementById('crypto-table-body'));
    Logger.debug('[UI初始化] - api-status-dot:', !!document.getElementById('api-status-dot'));
    Logger.debug('[UI初始化] - api-provider-name:', !!document.getElementById('api-provider-name'));
}

/**
 * 页面加载完成后初始化（完全非阻塞）
 */
document.addEventListener('DOMContentLoaded', () => {
    // 使用 requestIdleCallback 在浏览器完全空闲时初始化
    if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
            initCryptoModule();
        }, { timeout: 1000 });  // 减少超时时间到1秒
    } else {
        // 不支持 requestIdleCallback 的浏览器，延迟 500ms 初始化
        setTimeout(() => {
            initCryptoModule();
        }, 500);
    }
});

/**
 * 异步初始化数字货币模块（完全非阻塞，分阶段加载）
 */
async function initCryptoModule() {
    Logger.info('[页面加载] 开始初始化数字货币模块（完全异步）');

    // 阶段1：立即执行（最小化操作）
    try {
        // 只生成占位符，不渲染完整UI
        const placeholder = document.getElementById('crypto-section-placeholder');
        if (placeholder) {
            placeholder.innerHTML = `<div style="padding: 40px; text-align: center; color: #999;">
                <i class="fa fa-spinner fa-spin" style="font-size: 32px; margin-bottom: 15px; color: #10b981;"></i>
                <p style="font-size: 14px; font-weight: 500;">正在加载数字货币行情...</p>
                <p style="font-size: 12px; color: #888; margin-top: 5px;">请稍候，数据将在后台加载</p>
            </div>`;
        } else {
            Logger.error('[页面加载] 找不到 crypto-section-placeholder 元素');
        }
    } catch (e) {
        Logger.warn('[页面加载] 生成占位符失败:', e);
    }

    // 阶段2：延迟 500ms 执行（UI 生成）- 减少延迟
    setTimeout(() => {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                try {
                    Logger.info('[页面加载] 阶段2：生成UI');
                    initCryptoUI();
                } catch (e) {
                    Logger.warn('[页面加载] 初始化UI失败:', e);
                }
            }, { timeout: 1000 });
        } else {
            setTimeout(() => {
                try {
                    Logger.info('[页面加载] 阶段2：生成UI');
                    initCryptoUI();
                } catch (e) {
                    Logger.warn('[页面加载] 初始化UI失败:', e);
                }
            }, 100);
        }
    }, 500);

    // 阶段3：延迟 1 秒执行（WebSocket 连接）- 减少延迟
    setTimeout(() => {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                try {
                    Logger.info('[页面加载] 阶段3：初始化WebSocket连接');
                    initBinanceWebSocket();
                } catch (e) {
                    Logger.warn('[页面加载] 初始化WebSocket失败:', e);
                }
            }, { timeout: 1000 });
        } else {
            setTimeout(() => {
                try {
                    Logger.info('[页面加载] 阶段3：初始化WebSocket连接');
                    initBinanceWebSocket();
                } catch (e) {
                    Logger.warn('[页面加载] 初始化WebSocket失败:', e);
                }
            }, 100);
        }
    }, 1000);

    // 阶段4：延迟 1.5 秒执行（数据加载）- 减少延迟
    setTimeout(() => {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                try {
                    Logger.info('[页面加载] 阶段4：加载数据');
                    fetchCryptoData();
                } catch (e) {
                    Logger.warn('[页面加载] 加载数据失败:', e);
                }
            }, { timeout: 1000 });
        } else {
            setTimeout(() => {
                try {
                    Logger.info('[页面加载] 阶段4：加载数据');
                    fetchCryptoData();
                } catch (e) {
                    Logger.warn('[页面加载] 加载数据失败:', e);
                }
            }, 100);
        }
    }, 1500);

    // 阶段5：延迟 2 秒执行（汇率同步）- 减少延迟
    setTimeout(() => {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                try {
                    Logger.info('[页面加载] 阶段5：同步汇率');
                    updateExchangeRateDisplay();
                    syncRate();
                } catch (e) {
                    Logger.warn('[页面加载] 同步汇率失败:', e);
                }
            }, { timeout: 1000 });
        } else {
            setTimeout(() => {
                try {
                    Logger.info('[页面加载] 阶段5：同步汇率');
                    updateExchangeRateDisplay();
                    syncRate();
                } catch (e) {
                    Logger.warn('[页面加载] 同步汇率失败:', e);
                }
            }, 100);
        }
    }, 2000);

    // 阶段6：延迟 2.5 秒执行（事件绑定）- 减少延迟
    setTimeout(() => {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                try {
                    Logger.info('[页面加载] 阶段6：绑定事件监听器');
                    bindEventListeners();
                } catch (e) {
                    Logger.warn('[页面加载] 绑定事件失败:', e);
                }
            }, { timeout: 1000 });
        } else {
            setTimeout(() => {
                try {
                    Logger.info('[页面加载] 阶段6：绑定事件监听器');
                    bindEventListeners();
                } catch (e) {
                    Logger.warn('[页面加载] 绑定事件失败:', e);
                }
            }, 100);
        }
    }, 2500);

    // 实时更新汇率显示（每5秒，只在页面可见时刷新）
    setInterval(() => {
        if (!document.hidden) {
            syncRate();
        }
    }, 5000);

    // 请求通知权限（延迟执行）
    setTimeout(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    Logger.info('通知权限已授予');
                }
            });
        }
    }, 3000);
}

/**
 * 绑定事件监听器（独立函数，延迟执行）
 */
function bindEventListeners() {
    Logger.info('[页面加载] 绑定事件监听器');

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
}
