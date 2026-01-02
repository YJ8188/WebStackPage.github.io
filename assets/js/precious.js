// 金银行情功能模块
let currentPreciousCurrency = 'USD';
let preciousData = [];
let isPreciousSearching = false;
let USD_CNY_RATE = 7.25; // 默认汇率，将动态更新
let lastRateUpdate = 0;

// Sparkline 缓存和工具
const preciousSparklineCache = {};
const preciousSparklineRequests = new Set();

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
function formatPreciousPrice(price) {
    if (price === undefined || price === null) return '-';
    
    const numPrice = parseFloat(price);
    if (isNaN(numPrice)) return '-';

    return currentPreciousCurrency === 'USD' ? 
        '$' + numPrice.toFixed(2) :
        '¥' + numPrice.toFixed(2);
}

// 格式化涨跌幅
function formatChange(change) {
    if (change === undefined || change === null) return '-';
    
    const numChange = parseFloat(change);
    if (isNaN(numChange)) return '-';

    return numChange > 0 ? '+' + numChange.toFixed(2) : numChange.toFixed(2);
}

// 格式化涨跌幅百分比
function formatChangePercent(percent) {
    if (percent === undefined || percent === null) return '-';
    
    const numPercent = parseFloat(percent);
    if (isNaN(numPercent)) return '-';

    const sign = numPercent > 0 ? '+' : '';
    return sign + numPercent.toFixed(2) + '%';
}

// 切换货币
function togglePreciousCurrency() {
    currentPreciousCurrency = currentPreciousCurrency === 'USD' ? 'CNY' : 'USD';
    document.getElementById('precious-currency-toggle').innerText = currentPreciousCurrency;
    
    // 更新所有价格显示
    if (preciousData.length > 0) {
        renderPreciousTable(preciousData);
    }
}

// 搜索功能
function searchPrecious() {
    const searchTerm = document.getElementById('precious-search').value.trim().toLowerCase();
    if (!searchTerm) {
        isPreciousSearching = false;
        renderPreciousTable(preciousData);
        return;
    }

    isPreciousSearching = true;
    const filteredData = preciousData.filter(item => 
        item.symbol.toLowerCase().includes(searchTerm) ||
        item.name.toLowerCase().includes(searchTerm)
    );

    renderPreciousTable(filteredData);
}

// 清除搜索
function clearPreciousSearch() {
    document.getElementById('precious-search').value = '';
    document.getElementById('precious-search-clear').style.display = 'none';
    isPreciousSearching = false;
    renderPreciousTable(preciousData);
}

// 处理搜索输入
function handlePreciousSearchInput() {
    const searchInput = document.getElementById('precious-search');
    const searchClear = document.getElementById('precious-search-clear');
    
    if (searchInput.value.trim()) {
        searchClear.style.display = 'block';
    } else {
        searchClear.style.display = 'none';
        isPreciousSearching = false;
        renderPreciousTable(preciousData);
    }
}

// 处理搜索按键
function handlePreciousSearchKey(e) {
    if (e.key === 'Enter') {
        searchPrecious();
    } else if (e.key === 'Escape') {
        clearPreciousSearch();
    }
}

// 获取贵金属数据
async function fetchPreciousData() {
    try {
        const tbody = document.getElementById('precious-table-body');
        const apiProviderName = document.getElementById('precious-api-provider-name');
        const apiStatusDot = document.getElementById('precious-api-status-dot');

        // 确保DOM元素存在
        if (!tbody || !apiProviderName || !apiStatusDot) {
            console.error('无法找到金银行情所需的DOM元素');
            return;
        }

        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 20px;">正在加载实时行情...<i class="fa fa-spinner fa-spin"></i></td></tr>`;

        try {
            // 尝试从多个可靠的黄金行情API获取数据
            // 1. 首先尝试使用CoinGecko API（提供更稳定的贵金属数据）
            const coingeckoRes = await fetchWithTimeout('https://api.coingecko.com/api/v3/simple/price?ids=gold,silver,platinum,palladium&vs_currencies=usd', { timeout: 5000 });
            
            if (coingeckoRes.ok) {
                const coingeckoData = await coingeckoRes.json();
                
                // 检查是否获取到黄金价格
                if (coingeckoData.gold && coingeckoData.gold.usd) {
                    // 计算人民币汇率（使用默认汇率或最新汇率）
                    const usdToCny = USD_CNY_RATE;
                    
                    // 基于CoinGecko数据生成贵金属价格（接近ysx9999.com的展示格式）
                    preciousData = [
                        {
                            name: '黄金',
                            symbol: 'XAU',
                            buybackPrice: parseFloat((coingeckoData.gold.usd * usdToCny * 0.995).toFixed(2)),
                            sellingPrice: parseFloat((coingeckoData.gold.usd * usdToCny * 1.005).toFixed(2))
                        },
                        {
                            name: '白银',
                            symbol: 'XAG',
                            buybackPrice: parseFloat(((coingeckoData.silver ? coingeckoData.silver.usd : coingeckoData.gold.usd / 80) * usdToCny * 0.995).toFixed(3)),
                            sellingPrice: parseFloat(((coingeckoData.silver ? coingeckoData.silver.usd : coingeckoData.gold.usd / 80) * usdToCny * 1.005).toFixed(3))
                        },
                        {
                            name: '铂金',
                            symbol: 'XPT',
                            buybackPrice: parseFloat(((coingeckoData.platinum ? coingeckoData.platinum.usd : coingeckoData.gold.usd * 0.5) * usdToCny * 0.995).toFixed(1)),
                            sellingPrice: parseFloat(((coingeckoData.platinum ? coingeckoData.platinum.usd : coingeckoData.gold.usd * 0.5) * usdToCny * 1.005).toFixed(1))
                        },
                        {
                            name: '钯金',
                            symbol: 'XPD',
                            buybackPrice: parseFloat(((coingeckoData.palladium ? coingeckoData.palladium.usd : coingeckoData.gold.usd * 0.4) * usdToCny * 0.995).toFixed(1)),
                            sellingPrice: parseFloat(((coingeckoData.palladium ? coingeckoData.palladium.usd : coingeckoData.gold.usd * 0.4) * usdToCny * 1.005).toFixed(1))
                        },
                        {
                            name: '旧料9999',
                            symbol: 'OLD',
                            buybackPrice: parseFloat((coingeckoData.gold.usd * usdToCny * 0.985).toFixed(2)),
                            sellingPrice: parseFloat((coingeckoData.gold.usd * usdToCny * 0.995).toFixed(2))
                        },
                        {
                            name: '18K金',
                            symbol: '18K',
                            buybackPrice: parseFloat((coingeckoData.gold.usd * usdToCny * 0.75 * 0.995).toFixed(2)),
                            sellingPrice: parseFloat((coingeckoData.gold.usd * usdToCny * 0.75 * 1.005).toFixed(2))
                        },
                        {
                            name: 'Pt950',
                            symbol: 'PT950',
                            buybackPrice: parseFloat(((coingeckoData.platinum ? coingeckoData.platinum.usd : coingeckoData.gold.usd * 0.5) * usdToCny * 0.95 * 0.995).toFixed(1)),
                            sellingPrice: parseFloat(((coingeckoData.platinum ? coingeckoData.platinum.usd : coingeckoData.gold.usd * 0.5) * usdToCny * 0.95 * 1.005).toFixed(1))
                        },
                        {
                            name: 'Pd990',
                            symbol: 'PD990',
                            buybackPrice: parseFloat(((coingeckoData.palladium ? coingeckoData.palladium.usd : coingeckoData.gold.usd * 0.4) * usdToCny * 0.99 * 0.995).toFixed(1)),
                            sellingPrice: parseFloat(((coingeckoData.palladium ? coingeckoData.palladium.usd : coingeckoData.gold.usd * 0.4) * usdToCny * 0.99 * 1.005).toFixed(1))
                        }
                    ];
                    
                    renderPreciousTable(preciousData);
                    apiProviderName.innerText = 'CoinGecko API (模拟YSX9999格式)';
                    apiStatusDot.style.color = '#34d399';
                    return;
                }
            }
        } catch (apiError) {
            console.error('CoinGecko API调用失败:', apiError);
        }

        try {
            // 2. 回退到Alpha Vantage API
            const alphaVantageRes = await fetchWithTimeout('https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=XAUUSD&apikey=demo', { timeout: 5000 });
            
            if (alphaVantageRes.ok) {
                const alphaVantageData = await alphaVantageRes.json();
                if (alphaVantageData['Global Quote'] && alphaVantageData['Global Quote']['05. price']) {
                    const goldPrice = parseFloat(alphaVantageData['Global Quote']['05. price']);
                    
                    // 基于黄金价格生成其他贵金属价格（合理的市场比例）
                    preciousData = [
                        {
                            name: '黄金',
                            symbol: 'XAU',
                            buybackPrice: goldPrice * 0.995,
                            sellingPrice: goldPrice * 1.005
                        },
                        {
                            name: '白银',
                            symbol: 'XAG',
                            buybackPrice: (goldPrice / 80) * 0.995,
                            sellingPrice: (goldPrice / 80) * 1.005
                        },
                        {
                            name: '铂金',
                            symbol: 'XPT',
                            buybackPrice: (goldPrice * 0.5) * 0.995,
                            sellingPrice: (goldPrice * 0.5) * 1.005
                        },
                        {
                            name: '钯金',
                            symbol: 'XPD',
                            buybackPrice: (goldPrice * 0.4) * 0.995,
                            sellingPrice: (goldPrice * 0.4) * 1.005
                        },
                        {
                            name: '旧料9999',
                            symbol: 'OLD',
                            buybackPrice: goldPrice * 0.985,
                            sellingPrice: goldPrice * 0.995
                        },
                        {
                            name: '18K金',
                            symbol: '18K',
                            buybackPrice: (goldPrice * 0.75) * 0.995,
                            sellingPrice: (goldPrice * 0.75) * 1.005
                        },
                        {
                            name: 'Pt950',
                            symbol: 'PT950',
                            buybackPrice: (goldPrice * 0.47) * 0.995,
                            sellingPrice: (goldPrice * 0.47) * 1.005
                        },
                        {
                            name: 'Pd990',
                            symbol: 'PD990',
                            buybackPrice: (goldPrice * 0.38) * 0.995,
                            sellingPrice: (goldPrice * 0.38) * 1.005
                        }
                    ];
                    
                    renderPreciousTable(preciousData);
                    apiProviderName.innerText = 'Alpha Vantage API';
                    apiStatusDot.style.color = '#34d399';
                    return;
                }
            }
        } catch (apiError) {
            console.error('Alpha Vantage API调用失败:', apiError);
        }

        try {
            // 2. 回退到另一个可靠的API - CryptoCompare（提供贵金属数据）
            const cryptoCompareRes = await fetchWithTimeout('https://min-api.cryptocompare.com/data/price?fsym=XAU&tsyms=USD', { timeout: 5000 });
            
            if (cryptoCompareRes.ok) {
                const cryptoCompareData = await cryptoCompareRes.json();
                if (cryptoCompareData.USD) {
                    const goldPrice = cryptoCompareData.USD;
                    
                    // 基于黄金价格生成其他贵金属价格
                    preciousData = [
                        {
                            name: '黄金',
                            symbol: 'XAU',
                            buybackPrice: goldPrice * 0.995,
                            sellingPrice: goldPrice * 1.005
                        },
                        {
                            name: '白银',
                            symbol: 'XAG',
                            buybackPrice: (goldPrice / 80) * 0.995,
                            sellingPrice: (goldPrice / 80) * 1.005
                        },
                        {
                            name: '铂金',
                            symbol: 'XPT',
                            buybackPrice: (goldPrice * 0.5) * 0.995,
                            sellingPrice: (goldPrice * 0.5) * 1.005
                        },
                        {
                            name: '钯金',
                            symbol: 'XPD',
                            buybackPrice: (goldPrice * 0.4) * 0.995,
                            sellingPrice: (goldPrice * 0.4) * 1.005
                        },
                        {
                            name: '旧料9999',
                            symbol: 'OLD',
                            buybackPrice: goldPrice * 0.985,
                            sellingPrice: goldPrice * 0.995
                        },
                        {
                            name: '18K金',
                            symbol: '18K',
                            buybackPrice: (goldPrice * 0.75) * 0.995,
                            sellingPrice: (goldPrice * 0.75) * 1.005
                        },
                        {
                            name: 'Pt950',
                            symbol: 'PT950',
                            buybackPrice: (goldPrice * 0.47) * 0.995,
                            sellingPrice: (goldPrice * 0.47) * 1.005
                        },
                        {
                            name: 'Pd990',
                            symbol: 'PD990',
                            buybackPrice: (goldPrice * 0.38) * 0.995,
                            sellingPrice: (goldPrice * 0.38) * 1.005
                        }
                    ];
                    
                    renderPreciousTable(preciousData);
                    apiProviderName.innerText = 'CryptoCompare API';
                    apiStatusDot.style.color = '#34d399';
                    return;
                }
            }
        } catch (apiError) {
            console.error('CryptoCompare API调用失败:', apiError);
        }

        // 回退到模拟数据（无论API是否成功，只要没有有效数据就使用模拟数据）
        console.log('使用模拟数据');
        preciousData = generateMockPreciousData();
        renderPreciousTable(preciousData);
        apiProviderName.innerText = '模拟数据';
        apiStatusDot.style.color = '#f59e0b'; // 警告颜色
    } catch (error) {
        console.error('获取贵金属数据时发生严重错误:', error);
        const tbody = document.getElementById('precious-table-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 20px; color: #ef4444;">加载失败，请刷新页面重试</td></tr>`;
        }
    }
}

// 生成模拟贵金属数据
function generateMockPreciousData() {
    // 基于用户提供的图片数据，调整价格范围更接近实际现货行情
    const metals = [
        { symbol: 'XAU', name: '黄金', baseBuybackPrice: 980, baseSellingPrice: 985 },
        { symbol: 'XAG', name: '白银', baseBuybackPrice: 17, baseSellingPrice: 17.5 },
        { symbol: 'XPT', name: '铂金', baseBuybackPrice: 481, baseSellingPrice: 483 },
        { symbol: 'XPD', name: '钯金', baseBuybackPrice: 375, baseSellingPrice: 377 },
        { symbol: 'XRH', name: '铑金', baseBuybackPrice: 1780, baseSellingPrice: 1800 },
        { symbol: 'XTI', name: '钛金', baseBuybackPrice: 850, baseSellingPrice: 870 },
        { symbol: 'XRN', name: '钌金', baseBuybackPrice: 110, baseSellingPrice: 115 },
        { symbol: 'OLD', name: '旧料9999', baseBuybackPrice: 980, baseSellingPrice: 995 },
        { symbol: '18K', name: '18K金', baseBuybackPrice: 732, baseSellingPrice: 745 },
        { symbol: 'PT950', name: 'Pt950', baseBuybackPrice: 456, baseSellingPrice: 465 },
        { symbol: 'PD990', name: 'Pd990', baseBuybackPrice: 364, baseSellingPrice: 372 }
    ];

    return metals.map(metal => {
        // 添加小幅随机波动
        const buybackVariation = (Math.random() - 0.5) * 2;
        const sellingVariation = (Math.random() - 0.5) * 2;
        
        const buybackPrice = metal.baseBuybackPrice + buybackVariation;
        const sellingPrice = metal.baseSellingPrice + sellingVariation;

        return {
            name: metal.name,
            symbol: metal.symbol,
            buybackPrice: buybackPrice,
            sellingPrice: sellingPrice
        };
    });
}

// 从符号获取完整的金属名称
function getMetalName(symbol) {
    const names = {
        'XAU': '黄金',
        'XAG': '白银',
        'XPT': '铂金',
        'XPD': '钯金',
        'XRH': '铑金',
        'XTI': '钛金',
        'XRN': '钌金',
        'OLD': '旧料9999',
        '18K': '18K金',
        'PT950': 'Pt950',
        'PD990': 'Pd990'
    };
    return names[symbol] || symbol;
}

// 渲染贵金属表格
function renderPreciousTable(data) {
    const tbody = document.getElementById('precious-table-body');
    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 40px; color: #888;">暂无数据</td></tr>`;
        return;
    }

    const rows = data.map((item, index) => {
        const buybackPrice = parseFloat(item.buybackPrice);
        const sellingPrice = parseFloat(item.sellingPrice);

        // 根据回购价和销售价的关系确定颜色（用户图片中显示为绿色）
        const buybackColor = '#10b981';
        const sellingColor = '#ef4444';

        const formattedBuybackPrice = formatPreciousPrice(buybackPrice);
        const formattedSellingPrice = formatPreciousPrice(sellingPrice);

        return `
            <tr class="main-row">
                <td>
                    <div class="metal-info">
                        <div class="metal-name">${item.name}</div>
                        <div class="metal-symbol">${item.symbol}</div>
                    </div>
                </td>
                <td>
                    <div class="price-wrap">
                        <div class="main-price" style="color: ${buybackColor};">${formattedBuybackPrice}</div>
                    </div>
                </td>
                <td>
                    <div class="price-wrap">
                        <div class="main-price" style="color: ${sellingColor};">${formattedSellingPrice}</div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = rows;
}

// 加载贵金属的Sparkline图表
async function loadPreciousSparkline(symbol, changePct) {
    if (preciousSparklineCache[symbol] || preciousSparklineRequests.has(symbol)) return;
    
    preciousSparklineRequests.add(symbol);

    try {
        // 生成模拟的24h数据点
        const points = [];
        const basePrice = preciousData.find(item => item.symbol === symbol)?.price || 1000;
        
        for (let i = 0; i < 24; i++) {
            // 生成有轻微波动的价格点
            const variation = (Math.random() - 0.5) * 0.02;
            points.push(basePrice * (1 + variation));
        }
        
        preciousSparklineCache[symbol] = points;

        const container = document.querySelector(`.graph-container-${symbol}`);
        if (!container) return;

        // 创建简单的SVG图表
        const width = 60;
        const height = 20;
        const margin = { top: 2, right: 2, bottom: 2, left: 2 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const minPrice = Math.min(...points);
        const maxPrice = Math.max(...points);
        const priceRange = maxPrice - minPrice || 1;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        svg.setAttribute('class', 'sparkline');

        const polylinePoints = points.map((price, index) => {
            const x = margin.left + (index / (points.length - 1)) * innerWidth;
            const y = margin.top + (1 - (price - minPrice) / priceRange) * innerHeight;
            return `${x},${y}`;
        }).join(' ');

        const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        polyline.setAttribute('points', polylinePoints);
        polyline.setAttribute('fill', 'none');
        polyline.setAttribute('stroke', changePct > 0 ? '#ef4444' : '#10b981');
        polyline.setAttribute('stroke-width', '1.5');
        polyline.setAttribute('stroke-linecap', 'round');

        svg.appendChild(polyline);
        container.innerHTML = '';
        container.appendChild(svg);

    } catch (error) {
        console.error('加载贵金属趋势图错误:', error);
        const container = document.querySelector(`.graph-container-${symbol}`);
        if (container) {
            container.innerHTML = `<a href="javascript:void(0)" onclick="loadPreciousSparkline('${symbol}', ${changePct})" style="font-size: 11px; color: #666; text-decoration: none;">补全趋势</a>`;
        }
    } finally {
        preciousSparklineRequests.delete(symbol);
    }
}

// 初始化贵金属功能
function initPrecious() {
    const searchInput = document.getElementById('precious-search');
    const searchTrigger = document.getElementById('precious-search-trigger');
    
    if (searchInput) {
        searchInput.addEventListener('input', handlePreciousSearchInput);
        searchInput.addEventListener('keydown', handlePreciousSearchKey);
    }
    if (searchTrigger) {
        searchTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            searchPrecious();
        });
    }

    // 实时轮询
    setInterval(() => {
        if (!isPreciousSearching) fetchPreciousData();
    }, 5000);

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
document.addEventListener('DOMContentLoaded', initPrecious);

// 页面加载完成后立即获取数据
window.addEventListener('load', fetchPreciousData);
