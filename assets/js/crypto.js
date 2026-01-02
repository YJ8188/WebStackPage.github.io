// 数字货币行情功能模块
let currentCurrency = 'USD';
let cryptoData = [];
let isSearching = false;
let USD_CNY_RATE = 7.25; // 默认汇率，将动态更新
let lastRateUpdate = 0;

// Sparkline 缓存和工具
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

// 数据持久化和缓存
let allGateTickers = []; // Gate.io的主列表，用于全局搜索
const expandedCoins = new Set();

async function loadSparkline(id, symbol, changePct) {
    if (sparklineCache[symbol] || sparklineRequests.has(symbol)) return;
    const finalId = id || COIN_ID_MAP[symbol] || symbol.toLowerCase();
    if (!finalId) return;

    sparklineRequests.add(symbol);

    try {
        // 使用CoinCap的历史数据API获取最近7天的数据
        const res = await fetchWithTimeout(`https://api.coincap.io/v2/assets/${finalId}/history?interval=d1&limit=7`);
        if (!res.ok) throw new Error('Sparkline data not available');
        
        const data = await res.json();
        if (!data.data || data.data.length === 0) throw new Error('No sparkline data');

        const prices = data.data.map(item => parseFloat(item.priceUsd));
        sparklineCache[symbol] = prices;

        const container = document.querySelector(`.graph-container-${symbol}`);
        if (!container) return;

        // 移除重试链接
        container.innerHTML = '';

        // 创建简单的SVG图表
        const width = 60;
        const height = 20;
        const margin = { top: 2, right: 2, bottom: 2, left: 2 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceRange = maxPrice - minPrice || 1;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        svg.setAttribute('class', 'sparkline');

        const points = prices.map((price, index) => {
            const x = margin.left + (index / (prices.length - 1)) * innerWidth;
            const y = margin.top + (1 - (price - minPrice) / priceRange) * innerHeight;
            return `${x},${y}`;
        }).join(' ');

        const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        polyline.setAttribute('points', points);
        polyline.setAttribute('fill', 'none');
        polyline.setAttribute('stroke', changePct > 0 ? '#ef4444' : '#10b981');
        polyline.setAttribute('stroke-width', '1.5');
        polyline.setAttribute('stroke-linecap', 'round');

        svg.appendChild(polyline);
        container.appendChild(svg);

    } catch (error) {
        console.error('Error loading sparkline:', error);
        const container = document.querySelector(`.graph-container-${symbol}`);
        if (container) {
            container.innerHTML = `<a href="javascript:void(0)" onclick="loadSparkline('${id}', '${symbol}', ${changePct})" style="font-size: 11px; color: #666; text-decoration: none;">补全趋势</a>`;
        }
    } finally {
        sparklineRequests.delete(symbol);
    }
}

// 带超时的fetch函数
async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 8000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(resource, {
        ...options,
        signal: controller.signal
    });
    clearTimeout(id);

    return response;
}

// 格式化价格
function formatPrice(price) {
    if (price === undefined || price === null) return '-';
    
    const numPrice = parseFloat(price);
    if (isNaN(numPrice)) return '-';

    if (numPrice >= 1000) {
        return currentCurrency === 'USD' ? 
            '$' + numPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) :
            '¥' + numPrice.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (numPrice >= 1) {
        return currentCurrency === 'USD' ? 
            '$' + numPrice.toFixed(2) :
            '¥' + numPrice.toFixed(2);
    } else if (numPrice >= 0.01) {
        return currentCurrency === 'USD' ? 
            '$' + numPrice.toFixed(4) :
            '¥' + numPrice.toFixed(4);
    } else {
        return currentCurrency === 'USD' ? 
            '$' + numPrice.toExponential(2) :
            '¥' + numPrice.toExponential(2);
    }
}

// 格式化市值
function formatMarketCap(cap) {
    if (cap === undefined || cap === null) return '-';
    
    const numCap = parseFloat(cap);
    if (isNaN(numCap)) return '-';

    if (numCap >= 1e12) {
        return currentCurrency === 'USD' ? 
            '$' + (numCap / 1e12).toFixed(2) + 'T' :
            '¥' + (numCap / 1e12).toFixed(2) + 'T';
    } else if (numCap >= 1e9) {
        return currentCurrency === 'USD' ? 
            '$' + (numCap / 1e9).toFixed(2) + 'B' :
            '¥' + (numCap / 1e9).toFixed(2) + 'B';
    } else if (numCap >= 1e6) {
        return currentCurrency === 'USD' ? 
            '$' + (numCap / 1e6).toFixed(2) + 'M' :
            '¥' + (numCap / 1e6).toFixed(2) + 'M';
    } else {
        return currentCurrency === 'USD' ? 
            '$' + numCap.toLocaleString('en-US') :
            '¥' + numCap.toLocaleString('zh-CN');
    }
}

// 格式化交易量
function formatVolume(volume) {
    if (volume === undefined || volume === null) return '-';
    
    const numVolume = parseFloat(volume);
    if (isNaN(numVolume)) return '-';

    if (numVolume >= 1e9) {
        return (numVolume / 1e9).toFixed(2) + 'B';
    } else if (numVolume >= 1e6) {
        return (numVolume / 1e6).toFixed(2) + 'M';
    } else {
        return numVolume.toLocaleString('en-US');
    }
}

// 切换货币
function toggleCurrency() {
    currentCurrency = currentCurrency === 'USD' ? 'CNY' : 'USD';
    document.getElementById('currency-toggle').innerText = currentCurrency;
    
    // 更新所有价格显示
    if (cryptoData.length > 0) {
        renderCryptoTable(cryptoData);
    }
}

// 搜索功能
function searchCrypto() {
    const searchTerm = document.getElementById('crypto-search').value.trim().toLowerCase();
    if (!searchTerm) {
        isSearching = false;
        renderCryptoTable(cryptoData);
        return;
    }

    isSearching = true;
    const filteredData = cryptoData.filter(item => 
        item.symbol.toLowerCase().includes(searchTerm) ||
        item.name.toLowerCase().includes(searchTerm)
    );

    renderCryptoTable(filteredData);
}

// 清除搜索
function clearCryptoSearch() {
    document.getElementById('crypto-search').value = '';
    document.getElementById('crypto-search-clear').style.display = 'none';
    isSearching = false;
    renderCryptoTable(cryptoData);
}

// 处理搜索输入
function handleSearchInput() {
    const searchInput = document.getElementById('crypto-search');
    const searchClear = document.getElementById('crypto-search-clear');
    
    if (searchInput.value.trim()) {
        searchClear.style.display = 'block';
    } else {
        searchClear.style.display = 'none';
        isSearching = false;
        renderCryptoTable(cryptoData);
    }
}

// 处理搜索按键
function handleSearchKey(e) {
    if (e.key === 'Enter') {
        searchCrypto();
    } else if (e.key === 'Escape') {
        clearCryptoSearch();
    }
}

// 获取加密货币数据
async function fetchCryptoData() {
    const tbody = document.getElementById('crypto-table-body');
    const apiProviderName = document.getElementById('api-provider-name');
    const apiStatusDot = document.getElementById('api-status-dot');

    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px;">正在加载实时行情...<i class="fa fa-spinner fa-spin"></i></td></tr>`;

    try {
        // 首先尝试使用CoinCap API
        const res = await fetchWithTimeout('https://api.coincap.io/v2/assets?limit=100', { timeout: 10000 });
        if (res.ok) {
            const data = await res.json();
            cryptoData = data.data;
            renderCryptoTable(cryptoData);
            apiProviderName.innerText = 'CoinCap API';
            apiStatusDot.style.color = '#34d399';
            return;
        }

        // 回退到Gate.io API
        const gateRes = await fetchWithTimeout('https://api.gateio.ws/api/v4/spot/tickers', { timeout: 8000 });
        if (gateRes.ok) {
            const gateData = await gateRes.json();
            const usdtPairs = gateData.filter(item => item.symbol.endsWith('_USDT')).slice(0, 100);
            
            // 映射Gate.io数据到我们的格式
            const mappedData = usdtPairs.map(item => ({
                id: item.currency_pair.split('_')[0].toLowerCase(),
                rank: '',
                symbol: item.currency_pair.split('_')[0].toUpperCase(),
                name: item.currency_pair.split('_')[0].toUpperCase(),
                supply: '',
                maxSupply: '',
                marketCapUsd: '',
                volumeUsd24Hr: item.volume_24h,
                priceUsd: item.last,
                changePercent24Hr: item.change_percentage_24h
            }));
            
            cryptoData = mappedData;
            renderCryptoTable(mappedData);
            apiProviderName.innerText = 'Gate.io API';
            apiStatusDot.style.color = '#34d399';
            return;
        }

        throw new Error('所有API都失败了');
    } catch (error) {
        console.error('获取加密货币数据错误:', error);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 40px; color: #ef4444;">数据加载失败，请检查网络连接或稍后再试</td></tr>`;
        apiProviderName.innerText = 'API Error';
        apiStatusDot.style.color = '#ef4444';
    }
}

// 渲染加密货币表格
function renderCryptoTable(data) {
    const tbody = document.getElementById('crypto-table-body');
    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 40px; color: #888;">暂无数据</td></tr>`;
        return;
    }

    const rows = data.map((item, index) => {
        const price = parseFloat(item.priceUsd);
        const changePct = parseFloat(item.changePercent24Hr);
        const marketCap = parseFloat(item.marketCapUsd);
        const volume = parseFloat(item.volumeUsd24Hr);

        const changeClass = changePct > 0 ? 'change-up' : (changePct < 0 ? 'change-down' : 'change-neutral');
        const changeSign = changePct > 0 ? '+' : '';

        const formattedPrice = formatPrice(price);
        const formattedMarketCap = formatMarketCap(marketCap);
        const formattedVolume = formatVolume(volume);

        return `
            <tr class="main-row" onclick="toggleDetail('${item.symbol}')">
                <td>
                    <div class="coin-info">
                        <img class="coin-icon" src="https://assets.coincap.io/assets/icons/${item.symbol.toLowerCase()}@2x.png" onerror="this.src='https://via.placeholder.com/32'">
                        <div class="coin-name-wrap">
                            <div class="coin-name">${item.name}</div>
                            <div class="coin-symbol">${item.symbol}</div>
                            <div class="coin-vol">${formattedVolume}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="price-wrap">
                        <div class="main-price">${formattedPrice}</div>
                        ${currentCurrency === 'USD' ? `<div class="converted-price">¥${(price * USD_CNY_RATE).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>` : ''}
                    </div>
                </td>
                <td>
                    <div class="change-box ${changeClass}">
                        ${changeSign}${changePct.toFixed(2)}%
                    </div>
                </td>
                <td>
                    <div class="market_cap_cell">${formattedMarketCap}</div>
                </td>
                <td style="text-align:center;">
                    <div class="graph-container-${item.symbol}" style="display:inline-block;">
                        <i class="fa fa-line-chart" style="color:#ccc;"></i>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = rows;

    // 加载所有Sparkline图表
    data.forEach(item => {
        const changePct = parseFloat(item.changePercent24Hr);
        loadSparkline(item.id, item.symbol, changePct);
    });
}

// 切换详情展开
function toggleDetail(symbol) {
    const detailRow = document.getElementById(`detail-${symbol}`);
    if (detailRow) {
        // 收起详情
        detailRow.remove();
        expandedCoins.delete(symbol);
    } else {
        // 展开详情
        const mainRow = document.querySelector(`tr.main-row td.coin-info:contains('${symbol}')`).closest('tr');
        if (mainRow) {
            const detailHTML = `
                <tr id="detail-${symbol}" class="detail-row">
                    <td colspan="5" style="padding: 10px 15px; background: #fafafa;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="color: #666; font-size: 12px;">
                                <strong>${symbol}</strong> 详细信息
                            </div>
                            <button class="btn btn-xs btn-white" onclick="document.getElementById('detail-${symbol}').remove(); expandedCoins.delete('${symbol}');"
                                style="padding: 2px 6px;">
                                <i class="fa fa-times"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            
            // 使用insertAdjacentHTML添加到主行之后
            mainRow.insertAdjacentHTML('afterend', detailHTML);
            expandedCoins.add(symbol);
        }
    }
}

// 初始化加密货币功能
function initCrypto() {
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

    // 实时轮询
    setInterval(() => {
        if (!isSearching) fetchCryptoData();
    }, 3000);

    // 定期更新USD/CNY汇率
    setInterval(() => {
        if (Date.now() - lastRateUpdate > 300000) { // 每5分钟更新一次
            fetch('https://api.exchangerate-api.com/v4/latest/USD')
                .then(res => res.json())
                .then(data => {
                    if (data.rates && data.rates.CNY) {
                        USD_CNY_RATE = data.rates.CNY;
                        lastRateUpdate = Date.now();
                    }
                })
                .catch(err => console.error('更新USD/CNY汇率失败:', err));
        }
    }, 60000);
}

// 当DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', initCrypto);

// 页面加载完成后立即获取数据
window.addEventListener('load', fetchCryptoData);