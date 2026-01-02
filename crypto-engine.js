// 数字货币引擎 - crypto-engine.js
// 所有与数字货币相关的功能都封装在此文件中

// 全局变量
let currentCurrency = 'USD';
let cryptoData = [];
let isSearching = false;
let USD_CNY_RATE = 7.25; // 默认值，会动态更新
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
let allGateTickers = []; // 来自Gate.io的主列表，用于全局搜索
const expandedCoins = new Set();

// API策略配置
const APIS = {
    GATEIO: {
        name: 'Gate.io (Official)',
        url: 'https://api.gateio.ws/api/v4/spot/tickers', // 返回所有行情，需要过滤
        handler: (data) => {
            // 0. 备份所有行情，用于全局搜索
            allGateTickers = data;

            // 1. 同步汇率（修复了准确查找USDT_CNY的问题）
            const usdtCny = data.find(item => item.currency_pair === 'USDT_CNY');
            if (usdtCny && usdtCny.last) {
                USD_CNY_RATE = parseFloat(usdtCny.last);
                lastRateUpdate = Date.now();
            }

            // 2. 过滤USDT交易对，并按交易量排序，获取前50名
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
                    market_cap: parseFloat(item.quote_volume) * 7.5, // 用于显示的代理值
                    total_volume: parseFloat(item.quote_volume),
                    sparkline_in_7d: null
                };
            });
        }
    },
    CRYPTOCOMPARE: {
        name: 'CryptoCompare',
        // 从CC获取按交易量排名前50
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
        // 从CoinCap获取按市值排名前50
        url: 'https://api.coincap.io/v2/assets?limit=50',
        handler: (data) => {
            return data.data.map(item => ({
                id: item.id,
                symbol: item.symbol.toLowerCase(),
                name: item.name,
                image: `https://gimg2.gateimg.com/coin_icon/64/${item.symbol.toLowerCase()}.png`, // 使用gate图标，因为它们更好
                current_price: parseFloat(item.priceUsd),
                price_change_percentage_24h: parseFloat(item.changePercent24Hr),
                market_cap: parseFloat(item.marketCapUsd),
                sparkline_in_7d: null
            }));
        }
    },
    COINGECKO: {
        name: 'CoinGecko',
        // 从CoinGecko获取按市值排名前50
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

// 中文币种名称映射，用于更好的搜索
const CN_COIN_MAP = {
    '比特币': 'bitcoin', '以太坊': 'ethereum', '泰达币': 'tether', '狗狗币': 'dogecoin',
    '波卡': 'polkadot', '币安': 'binance', '瑞波': 'ripple', '索拉纳': 'solana',
    '莱特币': 'litecoin', '艾达币': 'cardano', '波场': 'tron', '以太经典': 'ethereum-classic',
    '佩佩': 'pepe', '链克': 'chainlink', '优尼': 'uniswap', '近': 'near-protocol',
    '艾普特': 'aptos', '堆栈': 'stack', '奥普': 'optimism', '阿比特': 'arbitrum',
    '天体': 'celestia', '赛伊': 'sei-network'
};

// CSS样式注入函数
function injectCryptoStyles() {
    const style = document.createElement('style');
    style.textContent = `
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

        /* Gate.io style change buttons */
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

        /* Red for up (China style) */
        .change-down {
            background-color: #10b981;
        }

        /* Green for down */
        .change-neutral {
            background-color: #9ca3af;
        }

        .market_cap_cell {
            font-size: 12px;
            color: #666;
        }

        /* Real-time Pulse Animation (Restored & Enhanced) */
        .price-update {
            transition: background-color 0.8s ease;
        }

        .pulse-green {
            background-color: rgba(239, 68, 68, 0.2) !important;
            /* Red for up (China style) */
        }

        .pulse-red {
            background-color: rgba(16, 185, 129, 0.2) !important;
            /* Green for down */
        }

        body.dark-mode .pulse-green {
            background-color: rgba(239, 68, 68, 0.15) !important;
        }

        body.dark-mode .pulse-red {
            background-color: rgba(16, 185, 129, 0.15) !important;
        }

        /* Dark Mode Adaptation */
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

        body.dark-mode #crypto-search {
            border-color: #444;
            color: #ddd;
        }

        /* Sparkline enhancements */
        .sparkline-svg {
            overflow: visible;
        }

        .sparkline-point-label {
            font-size: 9px;
            font-weight: 500;
            fill: #888;
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

            /* Show everything since user requested mobile/PC consistency, but maybe compact market cap */
            .table-market-cap,
            .market_cap_cell {
                font-size: 11px;
            }
        }
    `;
    document.head.appendChild(style);
}

// HTML结构生成函数
function createCryptoHTML() {
    return `
        <div class="xe-widget xe-conversations" style="padding: 20px;">
            <h4 class="xe-header">
                <i class="linecons-money" style="margin-right: 7px;" id="数字货币"></i>数字货币行情 (Live Market)
                <span style="float: right; display: flex; align-items: center; font-size: 13px;">
                    <button id="refresh-crypto-btn" class="btn btn-xs btn-white" onclick="fetchCryptoData()" style="margin-right: 10px; padding: 2px 6px;" title="刷新数据">
                        <i class="fa fa-refresh"></i>
                    </button>
                    <span style="margin-right: 10px; color: #888;">计价:</span>
                    <button id="currency-toggle" class="btn btn-xs btn-primary" onclick="toggleCurrency()" style="padding: 2px 8px;">USD</button>
                    <span style="margin: 0 10px; color: #333;">|</span>
                    <div class="search-box-crypto" style="position: relative; display: inline-block; vertical-align: middle; z-index: 100;">
                        <input type="text" id="crypto-search" placeholder="输入币种 (如 ETC, PEPE)..." style="background:rgba(255,255,255,0.05); border: 1px solid #444; border-radius: 4px; padding: 2px 50px 2px 10px; color: inherit; width: 190px; height: 26px; font-size: 12px; transition: border-color 0.3s;">
                        <i class="fa fa-times" id="crypto-search-clear" onclick="clearCryptoSearch()" style="position: absolute; right: 28px; top: 50%; transform: translateY(-50%); color: #666; font-size: 12px; cursor: pointer; display: none; padding: 5px;"></i>
                        <i class="fa fa-search" id="crypto-search-trigger" onclick="searchCrypto()" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); color: #999; font-size: 14px; cursor: pointer; padding: 5px;"></i>
                    </div>
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
                        Data provided by <span id="api-provider-name">Crypto API</span> <span id="api-status-dot" style="color: #10b981;">●</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}
