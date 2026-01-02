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
                        total_volume: parseFloat(item.volumeUsd24Hr)
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
                        total_volume: parseFloat(item.volume24)
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
                                 onerror="if(!this.tried){this.tried=1; this.src='https://assets.coincap.io/assets/icons/${coin.symbol.toLowerCase()}@2x.png';}else if(this.tried==1){this.tried=2; this.src='https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${coin.symbol.toLowerCase()}.png';}else if(this.tried==2){this.tried=3; this.src='https://cryptoicons.org/api/color/${coin.symbol.toLowerCase()}/64';}else if(this.tried==3){this.tried=4; this.src='https://static.coinpaper.com/coin/${coin.symbol.toLowerCase()}.png';}else if(this.tried==4){this.tried=5; this.src='https://api.gateio.ws/api/v4/spot/currencies/${coin.symbol.toUpperCase()}/icon';}else if(this.tried==5){this.tried=6; this.src='https://assets.coingecko.com/coins/images/placeholder/small/missing.png';}else{this.src='../assets/images/logos/btc.png';}">
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
            style.id = 'crypto-engine-styles';
            style.innerHTML = `
                .crypto-header { display: flex !important; justify-content: space-between !important; align-items: center !important; flex-wrap: wrap !important; gap: 15px !important; margin-bottom: 20px !important; border-bottom: 1px solid rgba(0,0,0,0.05) !important; padding-bottom: 15px !important; }
                .crypto-header-left { display: flex !important; align-items: center !important; gap: 10px !important; font-weight: 600 !important; font-size: 16px !important; color: #555 !important; }
                .crypto-header-right { display: flex !important; align-items: center !important; gap: 15px !important; flex-wrap: nowrap !important; white-space: nowrap !important; }
                .crypto-controls { display: flex !important; align-items: center !important; gap: 10px !important; }
                .control-label { font-size: 12px !important; color: #999 !important; }
                .api-status-wrap { display: flex !important; align-items: center !important; gap: 5px !important; background: rgba(0,0,0,0.03) !important; padding: 2px 8px !important; border-radius: 12px !important; margin-left:10px !important;}
                #api-status-dot { font-size: 10px !important; line-height: 1 !important; color: #f59e0b; }
                #api-status-text { font-size: 11px !important; color: #888 !important; }

                .search-box-crypto { position: relative !important; display: flex !important; align-items: center !important; background: #fff !important; border: 1px solid #e0e0e0 !important; border-radius: 6px !important; padding: 4px 12px !important; width: 220px !important; box-shadow: 0 2px 5px rgba(0,0,0,0.02) !important; transition: all 0.2s !important; }
                .search-box-crypto:focus-within { border-color: #10b981 !important; box-shadow: 0 0 0 3px rgba(16,185,129,0.1) !important; }
                .search-box-crypto i { color: #aaa !important; font-size: 13px !important; margin-right: 8px !important; }
                .search-box-crypto input { background: transparent !important; border: none !important; outline: none !important; padding: 0 !important; width: 100% !important; font-size: 13px !important; color: #333 !important; height: 26px !important; }
                
                .crypto-table-container { background: #fff !important; border-radius: 12px !important; overflow: hidden !important; box-shadow: 0 5px 25px rgba(0,0,0,0.05) !important; border: 1px solid #f0f0f0 !important; }
                .crypto-table { width: 100% !important; border-collapse: collapse !important; }
                .crypto-table th { background: #fafafa !important; padding: 14px 15px !important; color: #888 !important; font-size: 13px !important; font-weight: 500 !important; border-bottom: 2px solid #f5f5f5 !important; text-align: left !important; }
                .crypto-table td { padding: 14px 15px !important; vertical-align: middle !important; border-top: 1px solid #f8f8f8 !important; color: #333 !important; }
                .main-row { cursor: pointer !important; transition: background 0.2s !important; } .main-row:hover { background: #fbfbfb !important; }
                
                .coin-info { display: flex !important; align-items: center !important; gap: 12px !important; } 
                .coin-icon { width: 34px !important; height: 34px !important; border-radius: 50% !important; background: #fff !important; object-fit: contain !important; flex-shrink: 0 !important; box-shadow: 0 2px 6px rgba(0,0,0,0.05) !important; }
                .coin-name-wrap { display: flex !important; flex-direction: column !important; line-height: 1.2 !important; } 
                .coin-name-wrap strong { font-size: 15px !important; color: #111 !important; } .coin-vol { font-size: 11px !important; color: #aaa !important; margin-top: 2px !important; }
                .main-price { font-weight: 700 !important; font-size: 15px !important; font-family: "JetBrains Mono", monospace !important; }
                
                .change-box { display: inline-block !important; min-width: 80px !important; padding: 6px !important; border-radius: 4px !important; color: #fff !important; text-align: center !important; font-weight: bold !important; font-size: 12px !important; }
                .change-up { background: #ef4444 !important; } .change-down { background: #10b981 !important; }

                /* Dark Mode Fixes */
                body.dark-mode .crypto-header { border-bottom-color: rgba(255,255,255,0.08) !important; }
                body.dark-mode .crypto-header-left { color: #ccc !important; }
                body.dark-mode .api-status-wrap { background: rgba(255,255,255,0.05) !important; }
                body.dark-mode .search-box-crypto { background: #2a2a2a !important; border-color: #3a3a3a !important; }
                body.dark-mode .search-box-crypto input { color: #eee !important; }
                body.dark-mode .search-box-crypto i { color: #888 !important; }
                body.dark-mode .crypto-table-container { background: #1e1e1e !important; border-color: #2a2a2a !important; box-shadow: none !important; }
                body.dark-mode .crypto-table th { background: #252525 !important; border-bottom-color: #2a2a2a !important; color: #777 !important; }
                body.dark-mode .crypto-table td { border-top-color: #2a2a2a !important; color: #ccc !important; }
                body.dark-mode .main-row:hover { background: #252525 !important; }
                body.dark-mode .coin-name-wrap strong { color: #eee !important; }
                body.dark-mode .search-box-crypto i { color: #888 !important; }
                body.dark-mode .coin-icon { background: #333 !important; }

                @media screen and (max-width: 768px) {
                    .crypto-header { flex-direction: column !important; align-items: flex-start !important; gap: 15px !important; }
                    .crypto-header-right { width: 100% !important; justify-content: space-between !important; flex-wrap: wrap !important; }
                    .search-box-crypto { width: 100% !important; margin-top: 5px !important; }
                    .table-market-cap { display: none !important; } .market_cap_cell { display: none !important; }
                }
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
        }
    };
})();

window.CryptoEngine = CryptoEngine;
document.addEventListener('DOMContentLoaded', () => CryptoEngine.init());
