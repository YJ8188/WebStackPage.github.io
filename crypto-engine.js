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
    const sparklineRequests = new Set();
    const localStorageKey = 'crypto_market_cache_v3';

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
                        total_volume: parseFloat(item.quote_volume)
                    };
                });
            }
        },
        COINCAP: {
            name: 'CoinCap',
            url: 'https://api.coincap.io/v2/assets?limit=50',
            handler: (data) => data.data.map(item => {
                const symbol = item.symbol.toLowerCase();
                return {
                    symbol, name: item.name,
                    image: `https://gimg2.gateimg.com/coin_icon/64/${symbol}.png`,
                    current_price: parseFloat(item.priceUsd),
                    price_change_percentage_24h: parseFloat(item.changePercent24Hr),
                    market_cap: parseFloat(item.marketCapUsd),
                    total_volume: parseFloat(item.volumeUsd24Hr)
                };
            })
        },
        COINLORE: {
            name: 'CoinLore',
            url: 'https://api.coinlore.net/api/tickers/?start=0&limit=50',
            handler: (data) => data.data.map(item => {
                const symbol = item.symbol.toLowerCase();
                return {
                    symbol, name: item.name,
                    image: `https://gimg2.gateimg.com/coin_icon/64/${symbol}.png`,
                    current_price: parseFloat(item.price_usd),
                    price_change_percentage_24h: parseFloat(item.percent_change_24h),
                    market_cap: (parseFloat(item.msupply) || 0) * parseFloat(item.price_usd),
                    total_volume: parseFloat(item.volume24)
                };
            })
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
        if (sparklineCache[symbol] || sparklineRequests.has(symbol)) return;
        sparklineRequests.add(symbol);
        try {
            const res = await fetchWithTimeout(`https://min-api.cryptocompare.com/data/v2/histohour?fsym=${symbol.toUpperCase()}&tsym=USD&limit=168`);
            if (res.ok) {
                const json = await res.json();
                if (json.Data && json.Data.Data) {
                    sparklineCache[symbol] = json.Data.Data.map(d => d.close);
                    renderTable();
                }
            }
        } catch (e) { } finally { sparklineRequests.delete(symbol); }
    }

    function renderTable() {
        const tbody = document.getElementById('crypto-table-body');
        if (!tbody) return;
        const query = (document.getElementById('crypto-search')?.value || '').toLowerCase().trim();
        const mappedQuery = CN_COIN_MAP[query] || query;
        const isCNY = currentCurrency === 'CNY';
        const rate = isCNY ? USD_CNY_RATE : 1;
        const sym = isCNY ? '¥' : '$';

        let html = '';
        cryptoData.forEach(coin => {
            if (mappedQuery && !coin.symbol.includes(mappedQuery) && !coin.name.toLowerCase().includes(mappedQuery)) return;

            const p_raw = coin.current_price;
            const price = (p_raw * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: p_raw < 1 ? 4 : 2 });
            const change = coal(coin.price_change_percentage_24h);
            const mcap = (coal(coin.market_cap) * rate).toLocaleString(undefined, { notation: 'compact' });
            const vol = (coal(coin.total_volume) * rate).toLocaleString(undefined, { notation: 'compact' });
            const isOpen = expandedCoins.has(coin.symbol);

            html += `
                <tr class="main-row" onclick="CryptoEngine.toggleCoinDetail('${coin.symbol}')">
                    <td>
                        <div class="coin-info">
                            <img src="${coin.image}" class="coin-icon" 
                                 onerror="if(!this.tried){this.tried=true; this.src='https://static.coinpaper.com/coin/${coin.symbol}.png';}else{this.src='../assets/images/logos/btc.png';}">
                            <div class="coin-name-wrap">
                                <strong>${coin.symbol.toUpperCase()}</strong>
                                <span class="coin-vol">${vol}</span>
                            </div>
                        </div>
                    </td>
                    <td><div class="price-wrap"><span class="main-price">${sym}${price}</span></div></td>
                    <td><div class="change-box ${change >= 0 ? 'change-up' : 'change-down'}">${change >= 0 ? '+' : ''}${change.toFixed(2)}%</div></td>
                    <td class="market_cap_cell">
                        <span style="display:flex; align-items:center;">
                            ${sym}${mcap} 
                            <i class="fa fa-angle-down" style="margin-left:8px; transition:0.3s; ${isOpen ? 'transform:rotate(180deg)' : ''}"></i>
                        </span>
                    </td>
                    <td style="text-align:center;"><div class="spark-box">${sparklineCache[coin.symbol] ? generateSparklineSvg(sparklineCache[coin.symbol], change) : '-'}</div></td>
                </tr>
                <tr id="detail-${coin.symbol}" class="detail-row" style="${isOpen ? 'display:table-row; opacity:1;' : 'display:none;'}">
                    <td colspan="5" style="padding:0 !important; background:rgba(0,0,0,0.015);">
                        <div class="detail-container">
                            <div class="detail-info">
                                <h5>行情概览</h5>
                                <p>市值: ${sym}${(coal(coin.market_cap) * rate).toLocaleString()}</p>
                                <p>24h成交量: ${sym}${(coal(coin.total_volume) * rate).toLocaleString()}</p>
                                <p>全称: ${coin.name}</p>
                            </div>
                            <div class="detail-chart">
                                <h5>7日趋势 (最近168小时)</h5>
                                <div id="graph-detail-${coin.symbol}">${sparklineCache[coin.symbol] ? generateSparklineSvg(sparklineCache[coin.symbol], change, 240) : '数据同步中...'}</div>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
            if (!sparklineCache[coin.symbol]) setTimeout(() => loadSparkline(coin.symbol, change), 0);
        });
        tbody.innerHTML = html || '<tr><td colspan="5" style="text-align:center;padding:40px;color:#999;">无匹配行情数据</td></tr>';
    }

    // --- 外部接口 ---
    return {
        async init() {
            // 样式注入
            const style = document.createElement('style');
            style.innerHTML = `
                .crypto-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 5px; margin-top: 15px; }
                .crypto-header-left { display: flex; align-items: center; gap: 10px; font-weight: bold; }
                .crypto-header-right { display: flex; align-items: center; gap: 10px; }
                .crypto-controls { display: flex; align-items: center; gap: 8px; font-size: 13px; }
                .search-box-crypto { position: relative; display: flex; align-items: center; background: rgba(0,0,0,0.05); border-radius: 4px; padding: 2px 8px; border: 1px solid rgba(0,0,0,0.1); }
                .search-box-crypto input { background: transparent; border: none; outline: none; padding: 4px; width: 150px; font-size: 12px; color: inherit; }
                
                .crypto-table-container { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
                .crypto-table { width: 100%; margin-bottom: 0; }
                .crypto-table th { background: #fafafa; padding: 12px 15px; color: #888; font-size: 13px; font-weight: 500; border-bottom: 1px solid #f0f0f0; }
                .crypto-table td { padding: 12px 15px; vertical-align: middle; border-top: 1px solid #f8f8f8; color: #333; }
                .main-row { cursor: pointer; transition: background 0.2s; } .main-row:hover { background: #f9f9f9; }
                .coin-info { display: flex; align-items: center; } 
                .coin-icon { width: 32px; height: 32px; margin-right: 12px; border-radius: 50%; background: #f5f5f5; object-fit: contain; }
                .coin-name-wrap { display: flex; flex-direction: column; line-height: 1.2; } 
                .coin-name-wrap strong { font-size: 14px; color: #111; } 
                .coin-vol { font-size: 11px; color: #999; margin-top: 2px; }
                .main-price { font-weight: 600; font-family: monospace; font-size: 14px; }
                
                .change-box { display: inline-block; min-width: 75px; padding: 5px; border-radius: 4px; color: #fff; text-align: center; font-weight: bold; font-size: 12px; }
                .change-up { background: #ef4444; } .change-down { background: #10b981; }
                
                .detail-row { transition: opacity 0.3s ease; }
                .detail-container { display: flex; gap: 30px; padding: 20px; border-top: 1px solid #f0f0f0; }
                .detail-info { flex: 1; } .detail-info h5 { margin: 0 0 15px; font-weight: bold; color: #444; } .detail-info p { margin: 8px 0; font-size: 12px; color: #666; }
                .detail-chart { flex: 2; } .detail-chart h5 { margin: 0 0 10px; font-weight: bold; color: #444; }
                .spark-box { height: 40px; display: flex; align-items: center; justify-content: center; }

                /* Dark Mode Optimization */
                body.dark-mode .search-box-crypto { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }
                body.dark-mode .crypto-table-container { background: #1a1a1a; box-shadow: none; border: 1px solid #2a2a2a; }
                body.dark-mode .crypto-table th { background: #222; border-bottom-color: #2a2a2a; color: #777; }
                body.dark-mode .crypto-table td { border-top-color: #2a2a2a; color: #ccc; }
                body.dark-mode .main-row:hover { background: #252525; }
                body.dark-mode .coin-name-wrap strong { color: #eee; }
                body.dark-mode .detail-info h5, body.dark-mode .detail-chart h5 { color: #ccc; }
                body.dark-mode .detail-info p { color: #aaa; }
                body.dark-mode .coin-icon { background: #333; }

                @media screen and (max-width: 768px) {
                    .crypto-header-right { width: 100%; justify-content: space-between; }
                    .search-box-crypto { flex: 1; }
                    .search-box-crypto input { width: 100%; }
                    .detail-container { flex-direction: column; gap: 15px; }
                    .market_cap_cell { font-size: 11px; }
                }
                .fade-out { opacity: 0; pointer-events: none; transition: opacity 0.3s; }
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

            // 初始数据
            await this.refresh();
            setInterval(() => this.refresh(), 10000);

            // 汇率更新
            this.updateRate();
            setInterval(() => this.updateRate(), 60000);
        },

        async refresh() {
            const statusDot = document.getElementById('api-status-dot');
            if (statusDot) statusDot.style.color = '#f59e0b';
            try {
                // 并行竞速
                const fastest = await Promise.any(Object.values(APIS).map(async api => {
                    const r = await fetchWithTimeout(api.url);
                    if (!r.ok) throw new Error();
                    const d = await r.json();
                    return { data: api.handler(d) };
                }));
                cryptoData = fastest.data;
                if (statusDot) statusDot.style.color = '#10b981';
                renderTable();
                localStorage.setItem(localStorageKey, JSON.stringify(cryptoData));
            } catch (e) {
                console.error('API Fetch failed, using cache.');
                const cached = localStorage.getItem(localStorageKey);
                if (cached) cryptoData = JSON.parse(cached);
                if (statusDot) statusDot.style.color = '#ef4444';
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
        }
    };
})();

window.CryptoEngine = CryptoEngine;
document.addEventListener('DOMContentLoaded', () => CryptoEngine.init());
