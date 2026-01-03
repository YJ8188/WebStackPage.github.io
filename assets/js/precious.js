// precious.js - 贵金属行情功能模块（支持实时WebSocket数据）

let currentPreciousCurrency = 'CNY'; // 默认显示人民币
let preciousData = [];
let isPreciousSearching = false;
let USD_CNY_RATE = 7.25; // 默认汇率，将动态更新
let lastRateUpdate = 0;

// 实时数据状态
let isRealtimeEnabled = false;
let lastRealtimeUpdate = 0;

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
    const toggleBtn = document.getElementById('precious-currency-toggle');
    if (toggleBtn) {
        toggleBtn.innerText = currentPreciousCurrency;
    }
    
    // 更新所有价格显示
    if (preciousData.length > 0) {
        renderPreciousTable(preciousData);
    }
}

// 搜索功能
function searchPrecious() {
    const searchInput = document.getElementById('precious-search');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.trim().toLowerCase();
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
    const searchInput = document.getElementById('precious-search');
    const searchClear = document.getElementById('precious-search-clear');
    
    if (searchInput) searchInput.value = '';
    if (searchClear) searchClear.style.display = 'none';
    
    isPreciousSearching = false;
    renderPreciousTable(preciousData);
}

// 处理搜索输入
function handlePreciousSearchInput() {
    const searchInput = document.getElementById('precious-search');
    const searchClear = document.getElementById('precious-search-clear');
    
    if (!searchInput || !searchClear) return;
    
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

// ========== WebSocket 实时数据处理 ==========

// 处理 WebSocket 实时数据
function handleRealtimeData(data) {
    try {
        console.log('[Precious] 收到实时数据:', data);
        
        // 更新状态指示器
        updateRealtimeStatus(true);
        lastRealtimeUpdate = Date.now();
        
        // 检查数据格式
        if (!data) {
            console.warn('[Precious] 收到空数据');
            return;
        }
        
        // 多种数据格式处理
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch (parseError) {
                console.error('[Precious] 解析字符串数据失败:', parseError);
                return;
            }
        }
        
        // 解析数据并更新贵金属价格
        if (data && typeof data === 'object') {
            updatePreciousDataFromWS(data);
        } else {
            console.warn('[Precious] 数据格式不正确:', typeof data);
        }
        
    } catch (error) {
        console.error('[Precious] 处理实时数据失败:', error);
        updateRealtimeStatus(false);
    }
}

// 从 WebSocket 数据更新贵金属价格
function updatePreciousDataFromWS(wsData) {
    try {
        // 根据实际返回的数据结构解析
        // 假设数据格式为: { XAU: 1800, XAG: 23, ... }
        
        const newPreciousData = [];
        
        // 定义贵金属映射
        const metalMapping = {
            'XAU': { name: '黄金', baseKey: 'XAU' },
            'XAG': { name: '白银', baseKey: 'XAG' },
            'XPT': { name: '铂金', baseKey: 'XPT' },
            'XPD': { name: '钯金', baseKey: 'XPD' },
            'OLD': { name: '旧料9999', baseKey: 'XAU', multiplier: 0.99 },
            '18K': { name: '18K金', baseKey: 'XAU', multiplier: 0.75 },
            'PT950': { name: 'Pt950', baseKey: 'XPT', multiplier: 0.95 },
            'PD990': { name: 'Pd990', baseKey: 'XPD', multiplier: 0.99 }
        };
        
        // 解析数据
        for (const [symbol, config] of Object.entries(metalMapping)) {
            let basePrice = wsData[config.baseKey];
            
            // 如果没有数据，跳过
            if (!basePrice) continue;
            
            // 应用乘数
            if (config.multiplier) {
                basePrice *= config.multiplier;
            }
            
            // 计算回购价和销售价（加减0.5%）
            newPreciousData.push({
                name: config.name,
                symbol: symbol,
                buybackPrice: parseFloat((basePrice * 0.995).toFixed(2)),
                sellingPrice: parseFloat((basePrice * 1.005).toFixed(2))
            });
        }
        
        // 如果有有效数据，更新显示
        if (newPreciousData.length > 0) {
            preciousData = newPreciousData;
            
            // 如果不在搜索状态，更新表格
            if (!isPreciousSearching) {
                renderPreciousTable(preciousData);
            }
            
            console.log('[Precious] 已更新实时行情，共', newPreciousData.length, '项');
        }
        
    } catch (error) {
        console.error('[Precious] 解析WebSocket数据失败:', error);
    }
}

// 更新实时状态指示器
function updateRealtimeStatus(isConnected) {
    const statusDot = document.getElementById('precious-api-status-dot');
    const providerName = document.getElementById('precious-api-provider-name');
    
    if (statusDot) {
        statusDot.style.color = isConnected ? '#10b981' : '#ef4444';
    }
    
    if (providerName && isConnected) {
        providerName.innerText = 'WebSocket 实时数据';
    }
}

// 初始化 WebSocket 连接
function initRealtimeConnection() {
    try {
        console.log('[Precious] 初始化实时数据连接...');
        
        // 方法1：检查直接的 WSClient
        if (typeof WSClient !== 'undefined') {
            if (typeof WSClient.onData === 'function') {
                WSClient.onData(handleRealtimeData);
                isRealtimeEnabled = true;
                console.log('[Precious] 通过 WSClient 初始化实时数据连接');
                return;
            } else {
                console.warn('[Precious] WSClient 存在但 onData 方法不可用');
            }
        }
        
        // 方法2：检查全局 WebSocket 实例
        if (typeof window.websocket !== 'undefined' && typeof window.websocket.on === 'function') {
            window.websocket.on('precious-data', handleRealtimeData);
            isRealtimeEnabled = true;
            console.log('[Precious] 通过 window.websocket 初始化实时数据连接');
            return;
        }
        
        // 方法3：检查是否有 WebSocket 工厂函数
        if (typeof window.createWebSocket === 'function') {
            try {
                const ws = window.createWebSocket();
                if (typeof ws.on === 'function') {
                    ws.on('data', handleRealtimeData);
                    isRealtimeEnabled = true;
                    console.log('[Precious] 通过 createWebSocket() 初始化实时数据连接');
                    return;
                }
            } catch (wsError) {
                console.warn('[Precious] WebSocket 创建失败:', wsError);
            }
        }
        
        // 方法4：监听全局事件（备用方案）
        window.addEventListener('ws-data-received', function(event) {
            if (event.detail) {
                handleRealtimeData(event.detail);
            }
        });
        
        // 检查是否有其他 WebSocket 相关对象
        const possibleClients = ['socket', 'ws', 'websocketClient', 'realtimeClient'];
        for (const clientName of possibleClients) {
            if (typeof window[clientName] !== 'undefined') {
                const client = window[clientName];
                if (typeof client.on === 'function') {
                    client.on('data', handleRealtimeData);
                    isRealtimeEnabled = true;
                    console.log(`[Precious] 通过 window.${clientName} 初始化实时数据连接`);
                    return;
                }
            }
        }
        
        console.warn('[Precious] 未找到可用的WebSocket客户端，使用备用数据源');
        isRealtimeEnabled = false;
        
    } catch (error) {
        console.error('[Precious] 初始化实时连接失败:', error);
        isRealtimeEnabled = false;
    }
}

// 延迟初始化 WebSocket 连接（等待其他脚本加载）
function initRealtimeConnectionWithDelay() {
    // 首先尝试立即初始化
    initRealtimeConnection();
    
    // 如果失败，等待一段时间后重试
    if (!isRealtimeEnabled) {
        setTimeout(() => {
            console.log('[Precious] 尝试重新初始化WebSocket连接...');
            initRealtimeConnection();
        }, 2000);
    }
}

// ========== 备用数据源（API） ==========

// 获取贵金属数据（备用方案）
async function fetchPreciousData() {
    try {
        const tbody = document.getElementById('precious-table-body');
        const apiProviderName = document.getElementById('precious-api-provider-name');
        const apiStatusDot = document.getElementById('precious-api-status-dot');

        // 如果实时数据可用且最近更新过，不使用备用API
        if (isRealtimeEnabled && (Date.now() - lastRealtimeUpdate) < 10000) {
            console.log('[Precious] 使用实时数据，跳过API调用');
            return;
        }

        // 确保DOM元素存在
        if (!tbody || !apiProviderName || !apiStatusDot) {
            console.error('[Precious] 无法找到贵金属行情所需的DOM元素');
            return;
        }

        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 20px;">正在加载实时行情...<i class="fa fa-spinner fa-spin"></i></td></tr>`;

        try {
            // 尝试从CoinGecko API获取数据
            const coingeckoRes = await fetchWithTimeout('https://api.coingecko.com/api/v3/simple/price?ids=gold,silver,platinum,palladium&vs_currencies=usd', { timeout: 5000 });
            
            if (coingeckoRes.ok) {
                const coingeckoData = await coingeckoRes.json();
                
                // 检查是否获取到黄金价格
                if (coingeckoData.gold && coingeckoData.gold.usd) {
                    // 计算人民币汇率（使用默认汇率或最新汇率）
                    const usdToCny = USD_CNY_RATE;
                    
                    // 基于CoinGecko数据生成贵金属价格
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
                    apiProviderName.innerText = 'CoinGecko API (备用数据源)';
                    apiStatusDot.style.color = '#34d399';
                    return;
                }
            }
        } catch (apiError) {
            console.error('[Precious] CoinGecko API调用失败:', apiError);
        }

        // 回退到模拟数据
        console.log('[Precious] 使用模拟数据');
        preciousData = generateMockPreciousData();
        renderPreciousTable(preciousData);
        apiProviderName.innerText = '模拟数据';
        apiStatusDot.style.color = '#f59e0b';
        
    } catch (error) {
        console.error('[Precious] 获取贵金属数据时发生严重错误:', error);
        const tbody = document.getElementById('precious-table-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 20px; color: #ef4444;">加载失败，请刷新页面重试</td></tr>`;
        }
    }
}

// 生成模拟贵金属数据
function generateMockPreciousData() {
    const metals = [
        { symbol: 'XAU', name: '黄金', baseBuybackPrice: 480, baseSellingPrice: 485 },
        { symbol: 'XAG', name: '白银', baseBuybackPrice: 6.5, baseSellingPrice: 7.0 },
        { symbol: 'XPT', name: '铂金', baseBuybackPrice: 220, baseSellingPrice: 225 },
        { symbol: 'XPD', name: '钯金', baseBuybackPrice: 180, baseSellingPrice: 185 },
        { symbol: 'OLD', name: '旧料9999', baseBuybackPrice: 475, baseSellingPrice: 480 },
        { symbol: '18K', name: '18K金', baseBuybackPrice: 360, baseSellingPrice: 365 },
        { symbol: 'PT950', name: 'Pt950', baseBuybackPrice: 210, baseSellingPrice: 215 },
        { symbol: 'PD990', name: 'Pd990', baseBuybackPrice: 175, baseSellingPrice: 180 }
    ];

    return metals.map(metal => {
        const buybackVariation = (Math.random() - 0.5) * 2;
        const sellingVariation = (Math.random() - 0.5) * 2;
        
        return {
            name: metal.name,
            symbol: metal.symbol,
            buybackPrice: parseFloat((metal.baseBuybackPrice + buybackVariation).toFixed(2)),
            sellingPrice: parseFloat((metal.baseSellingPrice + sellingVariation).toFixed(2))
        };
    });
}

// 渲染贵金属表格
function renderPreciousTable(data) {
    const tbody = document.getElementById('precious-table-body');
    if (!tbody) return;
    
    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 40px; color: #888;">暂无数据</td></tr>`;
        return;
    }

    const rows = data.map((item) => {
        const buybackPrice = parseFloat(item.buybackPrice);
        const sellingPrice = parseFloat(item.sellingPrice);

        const buybackColor = '#10b981';
        const sellingColor = '#ef4444';

        const formattedBuybackPrice = formatPreciousPrice(buybackPrice);
        const formattedSellingPrice = formatPreciousPrice(sellingPrice);

        return `
            <tr class="main-row" onclick="togglePreciousDetail('${item.symbol}')">
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

    // 隐藏显示/隐藏和恢复默认排序按钮
    const controlButtonsHTML = `
        <tr id="precious-controls" style="display:none;">
            <td colspan="3" style="padding: 10px; text-align: right; background: #fafafa;">
                <button type="button" id="precious-toggle-display" class="btn btn-xs btn-white" style="margin-right: 10px;">
                    <i class="fa fa-eye"></i> 显示/隐藏
                </button>
                <button type="button" id="precious-reset-sort" class="btn btn-xs btn-white">
                    <i class="fa fa-refresh"></i> 恢复默认排序
                </button>
            </td>
        </tr>
    `;

    tbody.innerHTML = rows + controlButtonsHTML;
}

// 切换贵金属详情展开
function togglePreciousDetail(symbol) {
    const detailRow = document.getElementById(`precious-detail-${symbol}`);
    if (detailRow) {
        // 收起详情
        detailRow.remove();
    } else {
        // 展开详情
        const mainRow = Array.from(document.querySelectorAll('.main-row')).find(row => {
            return row.querySelector('.metal-symbol').textContent === symbol;
        });
        
        if (mainRow) {
            const detailHTML = `
                <tr id="precious-detail-${symbol}" class="precious-detail-row">
                    <td colspan="3" style="padding: 10px 15px; background: #fafafa;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="color: #666; font-size: 12px;">
                                <strong>${symbol}</strong> 详细信息
                            </div>
                            <button class="btn btn-xs btn-white" onclick="document.getElementById('precious-detail-${symbol}').remove();"
                                style="padding: 2px 6px;">
                                <i class="fa fa-times"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            
            // 使用insertAdjacentHTML添加到主行之后
            mainRow.insertAdjacentHTML('afterend', detailHTML);
        }
    }
}

// 初始化贵金属行情功能
function initPrecious() {
    // 实时轮询
    setInterval(() => {
        if (!isPreciousSearching) fetchPreciousData();
    }, 3000);
    
    // 初始化WebSocket连接
    initRealtimeConnectionWithDelay();
    
    // 添加搜索框事件监听
    const searchInput = document.getElementById('precious-search');
    const searchClear = document.getElementById('precious-search-clear');
    
    if (searchInput) {
        searchInput.addEventListener('input', handlePreciousSearchInput);
        searchInput.addEventListener('keydown', handlePreciousSearchKey);
    }
    
    if (searchClear) {
        searchClear.addEventListener('click', clearPreciousSearch);
    }
    
    // 添加货币切换按钮事件
    const currencyToggle = document.getElementById('precious-currency-toggle');
    if (currencyToggle) {
        currencyToggle.addEventListener('click', togglePreciousCurrency);
    }
}

// 当DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', initPrecious);

// 页面加载完成后立即获取数据
window.addEventListener('load', fetchPreciousData);

// 调试函数：检查WebSocket连接状态
function checkPreciousWebSocketStatus() {
    const status = {
        isRealtimeEnabled,
        lastRealtimeUpdate,
        wsClientAvailable: typeof WSClient !== 'undefined',
        windowWebsocketAvailable: typeof window.websocket !== 'undefined',
        createWebSocketAvailable: typeof window.createWebSocket === 'function',
        possibleClients: []
    };
    
    // 检查所有可能的WebSocket客户端
    const clientNames = ['socket', 'ws', 'websocketClient', 'realtimeClient'];
    clientNames.forEach(name => {
        if (typeof window[name] !== 'undefined') {
            status.possibleClients.push({
                name,
                hasOnMethod: typeof window[name].on === 'function'
            });
        }
    });
    
    console.log('[Precious] WebSocket状态检查:', status);
    return status;
}

// 手动重新连接WebSocket
function reconnectPreciousWebSocket() {
    console.log('[Precious] 手动重新连接WebSocket...');
    isRealtimeEnabled = false;
    initRealtimeConnectionWithDelay();
}

// 初始化贵金属功能
function initPrecious() {
    console.log('[Precious] 初始化贵金属模块...');
    
    // 初始化搜索功能
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

    // 初始化实时连接
    initRealtimeConnectionWithDelay();

    // 定期检查连接状态（如果实时数据长时间未更新，使用备用API）
    setInterval(() => {
        if (!isPreciousSearching) {
            const timeSinceUpdate = Date.now() - lastRealtimeUpdate;
            
            // 如果超过30秒没收到数据，使用备用API
            if (!isRealtimeEnabled || timeSinceUpdate > 30000) {
                fetchPreciousData();
            }
        }
    }, 10000); // 每10秒检查一次

    // 定期更新USD/CNY汇率
    setInterval(() => {
        if (Date.now() - lastRateUpdate > 300000) {
            fetch('https://api.exchangerate-api.com/v4/latest/USD')
                .then(res => res.json())
                .then(data => {
                    if (data.rates && data.rates.CNY) {
                        USD_CNY_RATE = data.rates.CNY;
                        lastRateUpdate = Date.now();
                        console.log('[Precious] 汇率已更新: 1 USD =', USD_CNY_RATE, 'CNY');
                    }
                })
                .catch(err => console.error('[Precious] 更新USD/CNY汇率失败:', err));
        }
    }, 60000);
    
    // 暴露调试函数到全局
    window.checkPreciousWebSocketStatus = checkPreciousWebSocketStatus;
    window.reconnectPreciousWebSocket = reconnectPreciousWebSocket;
    
    console.log('[Precious] 贵金属模块初始化完成');
}

// 当DOM加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPrecious);
} else {
    initPrecious();
}

// 页面加载完成后获取初始数据
window.addEventListener('load', function() {
    // 等待1秒让 WebSocket 连接建立
    setTimeout(() => {
        if (!isRealtimeEnabled || preciousData.length === 0) {
            fetchPreciousData();
        }
    }, 1000);
});
