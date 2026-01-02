/**
 * CryptoEngine - 数字货币行情模块 (集成化)
 * 修复了 PC 端下拉菜单、国内网络更新、及所有已知语法错误。
 */
const CryptoEngine = (() => {
    // --- 配置与状态 ---
    let currentCurrency = 'USD';
    let cryptoData = [];
    let isSearching = false;
    let USD_CNY_RATE = 7.25;
    let lastRateUpdate = 0;
    const expandedCoins = new Set();
    const sparklineCache = {};
    const iconCache = {}; // 缓存加载成功的图标源防止闪烁
    const sparklineRequests = new Set();
    const localStorageKey = 'crypto_market_cache_v3';
    // 排序状态
    let sortConfig = {
        column: 'market_cap',
        direction: 'desc'
    };

    // 常用币种映射
    const CN_COIN_MAP = {
        '比特币': 'btc', '以太坊': 'eth', '泰达币': 'usdt', '狗狗币': 'doge',
        '波卡': 'dot', '币安': 'bnb', '瑞波': 'xrp', '索拉纳': 'sol',
        '莱特币': 'ltc', '艾达币': 'ada', '波场': 'trx', '以太经典': 'etc',
        '佩佩': 'pepe', '链克': 'link', '优尼': 'uni', '近': 'near'
    };

    // --- API 策略 (增加国内多源备份) ---
    const APIS = {
        GATEIO: {
            name: 'Gate.io',
            url: 'https://api.gateio.ws/api/v4/spot/tickers',
            handler: (data) => {
                const results = data.filter(item => item.currency_pair.endsWith('_USDT'))
                    .filter(item => !item.currency_pair.includes('3L_') && !item.currency_pair.includes('3S_'))
                    .sort((a, b) => parseFloat(b.quote_volume) - parseFloat(a.quote_volume))
                    .slice(0, 50);
                return results.map(item => {
                    const symbol = item.currency_pair.split('_')[0].toLowerCase();
                    return {
                        symbol, name: symbol.toUpperCase(),
                        image: `https://gimg2.gateimg.com/coin_icon/64/${symbol}.png`,
                        image_backup: `https://static.coinpaper.com/coin/${symbol}.png`,
                        current_price: parseFloat(item.last),
                        price_change_percentage_24h: parseFloat(item.change_percentage),
                        market_cap: parseFloat(item.quote_volume) * 7.5,
                        total_volume: parseFloat(item.quote_volume),
                        high_24h: parseFloat(item.high_24h || 0),
                        low_24h: parseFloat(item.low_24h || 0)
                    };
                });
            }
        },
        COINCAP: {
            name: 'CoinCap',
            url: 'https://api.coincap.io/v2/assets?limit=50',
            handler: (data) => {
                return data.data.map(item => {
                    const symbol = item.symbol.toLowerCase();
                    return {
                        symbol, name: item.name,
                        image: `https://gimg2.gateimg.com/coin_icon/64/${symbol}.png`,
                        image_backup: `https://static.coinpaper.com/coin/${symbol}.png`,
                        current_price: parseFloat(item.priceUsd),
                        price_change_percentage_24h: parseFloat(item.changePercent24Hr),
                        market_cap: parseFloat(item.marketCapUsd),
                        total_volume: parseFloat(item.volumeUsd24Hr),
                        circulating_supply: parseFloat(item.supply),
                        high_24h: parseFloat(item.high24hr),
                        low_24h: parseFloat(item.low24hr)
                    };
                });
            }
        },
        COINLORE: {
            name: 'CoinLore',
            url: 'https://api.coinlore.net/api/tickers/?start=0&limit=50',
            handler: (data) => {
                return data.data.map(item => {
                    const symbol = item.symbol.toLowerCase();
                    return {
                        symbol, name: item.name,
                        image: `https://gimg2.gateimg.com/coin_icon/64/${symbol}.png`,
                        image_backup: `https://static.coinpaper.com/coin/${symbol}.png`,
                        current_price: parseFloat(item.price_usd),
                        price_change_percentage_24h: parseFloat(item.percent_change_24h),
                        market_cap: (parseFloat(item.msupply) || 0) * parseFloat(item.price_usd),
                        total_volume: parseFloat(item.volume24),
                        circulating_supply: parseFloat(item.msupply),
                        high_24h: parseFloat(item.high24),
                        low_24h: parseFloat(item.low24)
                    };
                });
            }
        }
    };

    // --- 辅助工具 ---
    const fetchWithTimeout = async (url, timeout = 8000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return res;
    };

    const coal = (val) => (val && !isNaN(val)) ? parseFloat(val) : 0;

    // --- 渲染逻辑 ---
    function generateSparklineSvg(prices, changePct, width = 100) {
        if (!prices || prices.length < 2) return '-';
        const min = Math.min(...prices), max = Math.max(...prices);
        const height = 48, padding = 12;
        const innerHeight = height - (padding * 2);
        const range = max - min || 1;
        let points = '';
        let maxP = { x: 0, y: height }, minP = { x: 0, y: 0 };
        prices.forEach((p, i) => {
            const x = (i / (prices.length - 1)) * width;
            const y = padding + innerHeight - ((p - min) / range) * innerHeight;
            points += `${x},${y} `;
            if (p === max) maxP = { x, y, val: p };
            if (p === min) minP = { x, y, val: p };
        });
        const color = changePct >= 0 ? '#ef4444' : '#10b981';
        const gid = `grad-${Math.random().toString(36).substr(2, 8)}`;
        const fmt = (v) => v < 1 ? v.toFixed(4) : (v > 1000 ? v.toLocaleString(undefined, { maximumFractionDigits: 1 }) : v.toFixed(2));
        return `<svg width="${width}" height="${height}" class="sparkline-svg">
            <defs><linearGradient id="${gid}" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:${color};stop-opacity:0.2" /><stop offset="100%" style="stop-color:${color};stop-opacity:0" /></linearGradient></defs>
            <polygon points="0,${height} ${points} ${width},${height}" fill="url(#${gid})" />
            <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" />
            <circle cx="${maxP.x}" cy="${maxP.y}" r="2" fill="#ef4444" /><text x="${maxP.x}" y="${maxP.y - 3}" fill="#ef4444" style="font-size:9px" text-anchor="${maxP.x > width * 0.7 ? 'end' : 'start'}">${fmt(maxP.val)}</text>
            <circle cx="${minP.x}" cy="${minP.y}" r="2" fill="#10b981" /><text x="${minP.x}" y="${minP.y + 10}" fill="#10b981" style="font-size:9px" text-anchor="${minP.x > width * 0.7 ? 'end' : 'start'}">${fmt(minP.val)}</text>
        </svg>`;
    }

    async function loadSparkline(symbol, changePct) {
        if (sparklineRequests.has(symbol)) return;
        sparklineRequests.add(symbol);
        
        // 显示加载指示器
        const sparkContainer = document.querySelector(`.spark-box[data-symbol="${symbol}"]`);
        if (sparkContainer) sparkContainer.innerHTML = '<div class="pulse-loader"></div>';
        
        const detailContainer = document.getElementById(`graph-detail-${symbol}`);
        if (detailContainer) detailContainer.innerHTML = '<div class="sync-text">聚合趋势计算中...</div>';
        
        try {
            const res = await fetchWithTimeout(`https://min-api.cryptocompare.com/data/v2/histohour?fsym=${symbol.toUpperCase()}&tsym=USD&limit=168`);
            if (res.ok) {
                const json = await res.json();
                if (json.Data && json.Data.Data) {
                    const prices = json.Data.Data.map(d => d.close);
                    sparklineCache[symbol] = prices;

                    // 核心优化：局部更新 DOM，防止整表刷新导致的图标闪烁
                    if (sparkContainer) sparkContainer.innerHTML = generateSparklineSvg(prices, changePct);
                    if (detailContainer) detailContainer.innerHTML = generateSparklineSvg(prices, changePct, 450);
                } else {
                    throw new Error('Invalid data structure');
                }
            } else {
                throw new Error('API request failed');
            }
        } catch (e) {
            // 显示重试按钮
            if (sparkContainer) sparkContainer.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:48px;"><button onclick="CryptoEngine.reloadSparkline('${symbol}')" style="background:none;border:none;color:#666;cursor:pointer;padding:5px 10px;border-radius:4px;font-size:12px;"><i class="fa fa-refresh"></i> 重试</button></div>`;
            if (detailContainer) detailContainer.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100px;"><button onclick="CryptoEngine.reloadSparkline('${symbol}')" class="btn btn-xs btn-primary"><i class="fa fa-refresh"></i> 重新加载趋势图</button></div>`;
        } finally { sparklineRequests.delete(symbol); }
    }

    // 排序函数
    function sortCryptoData(data, column, direction) {
        return [...data].sort((a, b) => {
            let valueA, valueB;
            
            switch (column) {
                case 'symbol':
                    valueA = a.symbol.toLowerCase();
                    valueB = b.symbol.toLowerCase();
                    break;
                case 'current_price':
                    valueA = coal(a.current_price);
                    valueB = coal(b.current_price);
                    break;
                case 'price_change_percentage_24h':
                    valueA = coal(a.price_change_percentage_24h);
                    valueB = coal(b.price_change_percentage_24h);
                    break;
                case 'market_cap':
                    valueA = coal(a.market_cap);
                    valueB = coal(b.market_cap);
                    break;
                default:
                    return 0;
            }
            
            if (valueA < valueB) return direction === 'asc' ? -1 : 1;
            if (valueA > valueB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    function renderTable() {
        const tbody = document.getElementById('crypto-table-body');
        if (!tbody) return;

        const query = (document.getElementById('crypto-search')?.value || '').toLowerCase().trim();
        const mappedQuery = CN_COIN_MAP[query] || query;

        // 应用排序
        const sortedData = sortCryptoData(cryptoData, sortConfig.column, sortConfig.direction);

        // --- 核心优化：局部更新逻辑 (彻底解决图标闪烁) ---
        sortedData.forEach(coin => {
            const isMatch = !mappedQuery || coin.symbol.includes(mappedQuery) || coin.name.toLowerCase().includes(mappedQuery);
            let row = document.querySelector(`.main-row[data-symbol="${coin.symbol}"]`);
            let detailRow = document.getElementById(`detail-${coin.symbol}`);

            if (!isMatch) {
                if (row) row.style.display = 'none';
                if (detailRow) detailRow.style.display = 'none';
                return;
            }

            const p_raw = coal(coin.current_price);
            // 格式化美元价格 (使用 Roboto Mono 加强金融感)
            const priceUSD = p_raw.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: p_raw < 0.1 ? 6 : (p_raw < 1 ? 4 : 2) });
            // 格式化人民币价格
            const priceCNY = (p_raw * USD_CNY_RATE).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 });
            const change = coal(coin.price_change_percentage_24h);
            const mcap = (p_raw * coal(coin.circulating_supply || 0) * USD_CNY_RATE).toLocaleString('zh-CN', { notation: 'compact' });
            const vol = coal(coin.total_volume).toLocaleString('zh-CN', { notation: 'compact' });
            const isOpen = expandedCoins.has(coin.symbol);

            // 如果行不存在，则创建骨架
            if (!row) {
                const displayIcon = iconCache[coin.symbol] || coin.image;
                const tr = document.createElement('tr');
                tr.className = 'main-row';
                tr.setAttribute('data-symbol', coin.symbol);
                tr.onclick = (e) => {
                    // 排除点击特定交互元素
                    if (e.target.closest('button') || e.target.closest('input')) return;
                    CryptoEngine.toggleCoinDetail(coin.symbol);
                };
                tr.innerHTML = `
                    <td class="coin-cell">
                        <div class="coin-info">
                            <div class="coin-icon-wrapper">
                                <img src="${displayIcon}" class="coin-icon" 
                                     onerror="handleIconError(this, '${coin.symbol.toLowerCase()}', '${coin.symbol.toUpperCase()}')">
                            </div>
                            <div class="coin-name-wrap">
                                <strong class="sym">${coin.symbol.toUpperCase()}</strong>
                                <span class="coin-vol-text">24h: ${vol} USDT</span>
                            </div>
                        </div>
                    </td>
                    <td class="price-cell">
                        <div class="price-stack">
                            <span class="price-primary">${priceUSD}</span>
                            <span class="price-secondary">≈ ${priceCNY}</span>
                        </div>
                    </td>
                    <td class="change-cell"><div class="change-pill"></div></td>
                    <td class="market-cap-cell table-market-cap"><div class="mcap-val-wrap"><span class="mcap-text">¥${mcap}</span><i class="fa fa-angle-right"></i></div></td>
                    <td class="trend-cell" style="text-align:center;"><div class="spark-box" data-symbol="${coin.symbol}">${sparklineCache[coin.symbol] ? generateSparklineSvg(sparklineCache[coin.symbol], change) : '<div class="pulse-loader"></div>'}</div></td>
                `;
                tbody.appendChild(tr);

                // 创建详情行备份
                const dtr = document.createElement('tr');
                dtr.id = `detail-${coin.symbol}`;
                dtr.className = 'detail-row';
                dtr.style.display = 'none';
                dtr.innerHTML = `<td colspan="5"><div class="pro-panel"></div></td>`;
                tbody.appendChild(dtr);

                row = tr;
                detailRow = dtr;
            }

            // --- 动态更新具体数值 (不重载行，根绝闪烁) ---
            row.style.display = 'table-row';
            row.querySelector('.price-primary').innerText = priceUSD;
            row.querySelector('.price-secondary').innerText = `≈ ${priceCNY}`;
            row.querySelector('.coin-vol-text').innerText = `24h: ${vol} USDT`;

            const pill = row.querySelector('.change-pill');
            pill.innerText = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
            pill.className = `change-pill ${change >= 0 ? 'up' : 'down'}`;

            row.querySelector('.mcap-text').innerText = `¥${mcap}`;
            const angle = row.querySelector('.fa-angle-right');
            angle.className = `fa fa-angle-right ${isOpen ? 'rotate-down' : ''}`;

            // 更新详情面板内容 (仅开启时更新，极致性能)
            if (isOpen) {
                detailRow.style.display = 'table-row';
                const panel = detailRow.querySelector('.pro-panel');
                // 仅在内容为空时或强制刷新内容
                if (!panel.innerHTML || row.dataset.needsUpdate === 'true') {
                    panel.innerHTML = `
                        <div class="pro-grid">
                            <div class="pro-stat"><label>估算市值(CNY)</label><div class="v">¥${(p_raw * coal(coin.circulating_supply || 0) * USD_CNY_RATE).toLocaleString()}</div></div>
                            <div class="pro-stat"><label>24h 成交额(USD)</label><div class="v">$${coal(coin.total_volume).toLocaleString()}</div></div>
                            <div class="pro-stat"><label>流通供应量</label><div class="v">${coal(coin.circulating_supply).toLocaleString()} ${coin.symbol.toUpperCase()}</div></div>
                            <div class="pro-stat"><label>24h 高/低</label><div class="v">$${coal(coin.high_24h || 0).toLocaleString()} / $${coal(coin.low_24h || 0).toLocaleString()}</div></div>
                        </div>
                        <div class="pro-chart">
                            <div class="chart-header"><h6>7D 趋势图谱 (CryptoCompare)</h6><span class="time-label">数据采样自最近168小时</span></div>
                            <div id="graph-detail-${coin.symbol}" class="expanded-spark">
                                ${sparklineCache[coin.symbol] ? generateSparklineSvg(sparklineCache[coin.symbol], change, 500) : '<div class="sync-text">聚合趋势计算中...</div>'}
                            </div>
                        </div>
                    `;
                }
            } else {
                detailRow.style.display = 'none';
            }

            if (!sparklineCache[coin.symbol]) setTimeout(() => loadSparkline(coin.symbol, change), 0);
        });

        // 维持列表顺序 (如果需要重排)
        const filteredData = sortedData.filter(c => !mappedQuery || c.symbol.includes(mappedQuery) || c.name.toLowerCase().includes(mappedQuery));
        filteredData.forEach(coin => {
            const r = document.querySelector(`.main-row[data-symbol="${coin.symbol}"]`);
            const d = document.getElementById(`detail-${coin.symbol}`);
            if (r) tbody.appendChild(r);
            if (d) tbody.appendChild(d);
        });
    }

    // 独立图标错误处理，带路径缓存
    window.handleIconError = function (img, symLower, symUpper) {
        if (!img.tried) img.tried = 1; else img.tried++;
        const sources = [
            `https://assets.coincap.io/assets/icons/${symLower}@2x.png`,
            `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symLower}.png`,
            `https://cryptoicons.org/api/color/${symLower}/128`,
            `https://static.coinpaper.com/coin/${symLower}.png`,
            `https://api.gateio.ws/api/v4/spot/currencies/${symUpper}/icon`,
            `https://cryptologos.cc/logos/${symLower}-${symUpper}-logo.png`,
            `https://cdn.jsdelivr.net/gh/cjdowner/cryptocurrency-icons@latest/128/color/${symLower}.png`,
            `https://www.cryptocompare.com/media/331246/${symLower}.png`,
            `https://s2.coinmarketcap.com/static/img/coins/64x64/${symLower}.png`,
            `https://coinicons-api.vercel.app/api/icon/${symLower}`,
            `https://via.placeholder.com/32?text=${symUpper}`
        ];
        if (img.tried <= sources.length) {
            const nextSrc = sources[img.tried - 1];
            img.src = nextSrc;
            // 如果加载成功，缓存该路径
            img.onload = () => { if (img.tried > 0) iconCache[symLower] = nextSrc; };
        }
    };

    // 处理排序点击
    function handleSortClick(column) {
        if (sortConfig.column === column) {
            // 切换排序方向
            sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
        } else {
            // 新的排序列，默认降序
            sortConfig.column = column;
            sortConfig.direction = 'desc';
        }
        // 更新表头样式
        updateSortIndicators();
        // 重新渲染表格
        renderTable();
    }

    // 更新表头排序指示器
    function updateSortIndicators() {
        // 移除所有排序指示器
        document.querySelectorAll('.crypto-table th span').forEach(span => {
            span.innerHTML = '';
        });
        
        // 为当前排序列添加指示器
        const th = document.querySelector(`.crypto-table th[data-sort="${sortConfig.column}"]`);
        if (th) {
            const span = th.querySelector('span');
            if (span) {
                span.innerHTML = sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
            }
        }
    }

    // --- 外部接口 ---
    return {
        async init() {
            // 样式注入
            const style = document.createElement('style');
            style.id = 'crypto-engine-styles';
            style.innerHTML = `
                /* --- Gate.io 风格极致美化 --- */
                #crypto-section-wrapper { 
                    font-family: 'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif !important; 
                    margin-top: 35px !important;
                    padding-bottom: 30px;
                    background: transparent !important;
                }
                
                .crypto-header { 
                    display: flex !important; 
                    justify-content: space-between !important; 
                    align-items: center !important; 
                    flex-wrap: wrap !important; 
                    padding: 0 5px 25px 5px !important; 
                }
                .crypto-header-right { display: flex !important; gap: 15px !important; align-items: center !important; }
                .crypto-controls { display: flex !important; gap: 10px !important; align-items: center !important; }
                .crypto-title { 
                    font-size: 22px !important; 
                    font-weight: 800 !important; 
                    color: #1e2329 !important; 
                    letter-spacing: -0.8px; 
                    display: flex;
                    align-items: center;
                }
                
                /* API 状态指示灯呼吸效 */
                .api-status-wrap { 
                    display: inline-flex; 
                    align-items: center; 
                    background: rgba(0,0,0,0.03); 
                    padding: 4px 10px; 
                    border-radius: 20px; 
                    margin-left: 15px;
                    font-size: 11px;
                    font-weight: 600;
                    color: #707a8a;
                    border: 1px solid rgba(0,0,0,0.05);
                }
                #api-status-dot { 
                    margin-right: 6px; 
                    font-size: 8px; 
                    animation: status-pulse 2s infinite; 
                }
                @keyframes status-pulse {
                    0% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.2); }
                    100% { opacity: 1; transform: scale(1); }
                }

                /* 搜索盒优化 */
                .search-box-crypto {
                    position: relative;
                    background: #f1f3f6 !important;
                    border-radius: 10px !important;
                    padding: 0 15px !important;
                    display: flex;
                    align-items: center;
                    width: 260px;
                    height: 40px;
                    transition: all 0.3s;
                    border: 1px solid transparent;
                }
                .search-box-crypto:focus-within {
                    background: #fff !important;
                    border-color: #f0b90b !important;
                    box-shadow: 0 0 0 3px rgba(240, 185, 11, 0.1);
                }
                .search-box-crypto i { color: #848e9c; margin-right: 10px; font-size: 14px; }
                .search-box-crypto input {
                    border: none !important;
                    background: transparent !important;
                    color: #1e2329 !important;
                    font-size: 14px !important;
                    outline: none !important;
                    width: 100%;
                }

                /* 表格容器高级阴影 */
                .crypto-table-container { 
                    background: white !important; 
                    border-radius: 10px !important; 
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important; 
                    border: 1px solid rgba(0, 0, 0, 0.1) !important; 
                    overflow: hidden !important;
                }
                
                @media screen and (max-width: 768px) {
                    .crypto-table-container { overflow-x: auto !important; -webkit-overflow-scrolling: touch; }
                    .crypto-table { min-width: 750px !important; }
                    .search-box-crypto { width: 100% !important; margin-top: 15px; }
                    .crypto-header-right { width: 100% !important; flex-direction: column !important; align-items: stretch !important; }
                }
                
                .crypto-table th { 
                    background: #f8f9fa !important; 
                    padding: 18px 20px !important; 
                    color: #666 !important; 
                    font-size: 12px !important; 
                    font-weight: 700 !important; 
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    border-bottom: 1px solid #e9ecef !important; 
                }
                .crypto-table td { 
                    padding: 16px 20px !important; 
                    border-bottom: 1px solid #f1f3f6 !important; 
                    transition: all 0.2s; 
                    color: #1e2329 !important;
                }
                .main-row:hover td { background-color: #f8f9fa !important; cursor: pointer; }

                /* 价格双叠架构 */
                .price-stack { display: flex; flex-direction: column; gap: 4px; }
                .price-primary { 
                    font-family: 'Roboto Mono', monospace !important; 
                    font-weight: 700 !important; 
                    font-size: 17px !important; 
                    color: #1e2329 !important; 
                }
                .price-secondary { 
                    font-size: 12px !important; 
                    color: #848e9c !important; 
                    font-weight: 500; 
                }
                
                /* 涨跌幅药丸效果 */
                .change-pill { 
                    display: inline-flex !important; 
                    align-items: center; 
                    justify-content: center; 
                    min-width: 88px; 
                    padding: 6px 0 !important; 
                    border-radius: 6px !important; 
                    color: #fff !important; 
                    font-weight: 700 !important; 
                    font-size: 14px !important; 
                    transition: transform 0.2s;
                }
                .change-pill:hover { transform: scale(1.05); }
                .change-pill.up { background: #0ecb81 !important; box-shadow: 0 4px 12px rgba(14,203,129,0.25); }
                .change-pill.down { background: #f6465d !important; box-shadow: 0 4px 12px rgba(246,70,93,0.25); }
                
                .coin-icon-wrapper { 
                    width: 40px; 
                    height: 40px; 
                    border-radius: 50%; 
                    background: #f1f3f6; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    margin-right: 12px;
                }
                .coin-icon { width: 32px !important; height: 32px !important; object-fit: contain !important; }
                .coin-name-wrap .sym { font-size: 16px !important; color: #1e2329 !important; font-weight: 700 !important; letter-spacing: -0.2px; }
                .coin-vol-text { font-size: 11px !important; color: #848e9c !important; font-weight: 500; margin-top: 2px; }

                /* 详情展示区面板 */
                .pro-panel { 
                    background: #f8f9fa !important; 
                    padding: 35px !important; 
                    border-top: 1px solid #e9ecef; 
                    box-shadow: inset 0 10px 30px rgba(0,0,0,0.05);
                }
                .pro-grid { display: grid !important; grid-template-columns: repeat(4, 1fr) !important; gap: 30px !important; }
                .pro-stat { border-left: 4px solid #f0b90b; padding-left: 20px; }
                .pro-stat label { font-size: 12px !important; color: #848e9c !important; font-weight: 600; margin-bottom: 10px; display: block; }
                .pro-stat .v { 
                    font-family: 'Roboto Mono', monospace !important; 
                    font-size: 16px !important; 
                    font-weight: 700 !important; 
                    color: #1e2329 !important; 
                }
                
                .chart-header { border-bottom: 1px solid #e9ecef; padding-bottom: 15px; margin-bottom: 25px; }

                /* 暗黑模式深度定制 */
                body.dark-mode #crypto-section-wrapper { background: transparent !important; }
                body.dark-mode .crypto-title { color: #eaecef !important; }
                body.dark-mode .api-status-wrap { background: rgba(255,255,255,0.05); color: #848e9c; }
                body.dark-mode .search-box-crypto { background: #1e2329 !important; }
                body.dark-mode .search-box-crypto input { color: #eaecef !important; }
                body.dark-mode .crypto-table-container { background: rgba(255, 255, 255, 0.02) !important; border-color: rgba(255, 255, 255, 0.1) !important; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35) !important; }
                body.dark-mode .crypto-table th { background: rgba(255, 255, 255, 0.05) !important; color: rgba(255, 255, 255, 0.7) !important; border-bottom-color: rgba(255, 255, 255, 0.1) !important; }
                body.dark-mode .crypto-table td { color: rgba(255, 255, 255, 0.9) !important; border-bottom-color: rgba(255, 255, 255, 0.05) !important; }
                body.dark-mode .main-row:hover td { background-color: rgba(255, 255, 255, 0.05) !important; }
                body.dark-mode .price-primary { color: rgba(255, 255, 255, 0.9) !important; }
                body.dark-mode .price-secondary { color: rgba(255, 255, 255, 0.6) !important; }
                body.dark-mode .coin-name-wrap .sym { color: rgba(255, 255, 255, 0.9) !important; }
                body.dark-mode .coin-vol-text { color: rgba(255, 255, 255, 0.6) !important; }
                body.dark-mode .pro-panel { background: rgba(255, 255, 255, 0.02) !important; border-top-color: rgba(255, 255, 255, 0.1); }
                body.dark-mode .coin-icon-wrapper { background: rgba(255, 255, 255, 0.1); }
                body.dark-mode .pro-stat { border-left-color: #f0b90b; }
                body.dark-mode .pro-stat label { color: rgba(255, 255, 255, 0.6) !important; }
                body.dark-mode .pro-stat .v { color: rgba(255, 255, 255, 0.9) !important; }
                body.dark-mode .chart-header { border-bottom-color: rgba(255, 255, 255, 0.1); }
                
                .pulse-loader { width: 20px; height: 2px; background: #eee; animation: pulse 1.5s infinite; }
                @keyframes pulse { 0% { opacity: 0.3; } 50% { opacity: 1; } 100% { opacity: 0.3; } }
                .fade-out { opacity: 0 !important; pointer-events: none !important; transition: opacity 0.3s !important; }
            `;
            document.head.appendChild(style);

            // 搜索与交互
            document.getElementById('crypto-search')?.addEventListener('input', renderTable);

            // 浮动按钮隐藏逻辑
            const wrapper = document.getElementById('crypto-section-wrapper');
            if (wrapper) {
                wrapper.addEventListener('mouseenter', () => {
                    document.querySelectorAll('#showHiddenCards, #resetOrder, .back-to-top').forEach(el => el.classList.add('fade-out'));
                });
                wrapper.addEventListener('mouseleave', () => {
                    document.querySelectorAll('#showHiddenCards, #resetOrder, .back-to-top').forEach(el => el.classList.remove('fade-out'));
                });
            }

            // 添加表头排序事件监听器
            setTimeout(() => {
                const headers = document.querySelectorAll('.crypto-table th[data-sort]');
                headers.forEach(th => {
                    th.addEventListener('click', () => {
                        const column = th.getAttribute('data-sort');
                        handleSortClick(column);
                    });
                    // 为表头添加排序指示器容器
                    if (!th.querySelector('span')) {
                        const span = document.createElement('span');
                        span.style.marginLeft = '5px';
                        th.appendChild(span);
                    }
                });
                // 初始化排序指示器
                updateSortIndicators();
            }, 100);

            // 初始数据
            await this.refresh();
            setInterval(() => this.refresh(), 10000);

            // 汇率更新
            this.updateRate();
            setInterval(() => this.updateRate(), 60000);
        },

        async refresh() {
            const statusDot = document.getElementById('api-status-dot');
            const statusText = document.getElementById('api-status-text');
            if (statusDot) statusDot.style.color = '#f59e0b';
            if (statusText) statusText.innerText = 'Syncing...';
            try {
                const fastest = await Promise.any(Object.values(APIS).map(async api => {
                    const r = await fetchWithTimeout(api.url);
                    if (!r.ok) throw new Error();
                    const d = await r.json();
                    return { data: api.handler(d), name: api.name };
                }));
                cryptoData = fastest.data;
                if (statusDot) statusDot.style.color = '#10b981';
                if (statusText) statusText.innerText = 'Synced';
                renderTable();
                localStorage.setItem(localStorageKey, JSON.stringify(cryptoData));
            } catch (e) {
                const cached = localStorage.getItem(localStorageKey);
                if (cached) cryptoData = JSON.parse(cached);
                if (statusDot) statusDot.style.color = '#ef4444';
                if (statusText) statusText.innerText = 'Sync Off';
                renderTable();
            }
        },

        async updateRate() {
            try {
                const r = await fetchWithTimeout('https://api.gateio.ws/api/v4/spot/tickers?currency_pair=USDT_CNY');
                if (r.ok) {
                    const d = await r.json();
                    if (d[0]?.last) USD_CNY_RATE = parseFloat(d[0].last);
                }
            } catch (e) { }
        },

        toggleCurrency() {
            currentCurrency = currentCurrency === 'USD' ? 'CNY' : 'USD';
            const btn = document.getElementById('currency-toggle');
            if (btn) {
                btn.innerText = currentCurrency;
                btn.className = currentCurrency === 'USD' ? 'btn btn-xs btn-primary' : 'btn btn-xs btn-warning';
            }
            renderTable();
        },

        toggleCoinDetail(symbol) {
            const row = document.getElementById(`detail-${symbol}`);
            if (!row) return;
            const isOpen = expandedCoins.has(symbol);
            if (isOpen) {
                expandedCoins.delete(symbol);
                row.style.opacity = '0';
                setTimeout(() => { if (!expandedCoins.has(symbol)) row.style.display = 'none'; }, 300);
            } else {
                expandedCoins.add(symbol);
                row.style.display = 'table-row';
                setTimeout(() => { if (expandedCoins.has(symbol)) row.style.opacity = '1'; }, 10);
            }
            renderTable(); // 更新箭头旋转
        },
        
        reloadSparkline(symbol) {
            // 移除缓存，强制重新加载
            delete sparklineCache[symbol];
            // 找到对应的币种数据获取changePct
            const coin = cryptoData.find(c => c.symbol === symbol);
            if (coin) {
                loadSparkline(symbol, coal(coin.price_change_percentage_24h));
            }
        }
    };
})();

window.CryptoEngine = CryptoEngine;
document.addEventListener('DOMContentLoaded', () => CryptoEngine.init());
