// ==================== 贵金属行情模块 ====================
/**
 * 贵金属实时行情显示模块
 * 功能：获取并显示贵金属的实时价格、涨跌幅等信息
 */

var MetalsData = {
    // 贵金属价格数据
    prices: {
        bankGoldBars: [],      // 银行投资金条价格
        goldRecycle: [],       // 黄金回收价格
        preciousMetals: []     // 贵金属价格
    },
    
    // 初始化数据
    init: function() {
        console.log('%c[金银行情] 初始化数据模块', 'color: #10b981; font-weight: bold;');
        this.fetchGoldPrice();
    },

    // 获取黄金价格数据
    fetchGoldPrice: function() {
        var self = this;

        console.log('%c[金银行情] 开始获取黄金价格数据...', 'color: #10b981;');

        fetch('https://v2.xxapi.cn/api/goldprice', {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        })
        .then(function(response) {
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }
            return response.json();
        })
        .then(function(data) {
            console.log('%c[金银行情] 数据获取成功:', 'color: #10b981;', data);
            
            if (data.code === 200 && data.data) {
                self.prices.bankGoldBars = data.data.bank_gold_bar_price || [];
                self.prices.goldRecycle = data.data.gold_recycle_price || [];
                self.prices.preciousMetals = data.data.precious_metal_price || [];
                
                self.updateUI();
            } else {
                console.error('%c[金银行情] 数据格式错误:', 'color: #f59e0b;', data);
            }
        })
        .catch(function(error) {
            console.error('%c[金银行情] 数据获取失败:', 'color: #f59e0b;', error);
        });
    },

    // 更新UI显示
    updateUI: function() {
        this.renderBankGoldBars();
        this.renderGoldRecycle();
        this.renderPreciousMetals();
    },

    // 渲染银行投资金条价格
    renderBankGoldBars: function() {
        var tbody = document.getElementById('bank-gold-bars-body');
        if (!tbody) {
            console.warn('%c[金银行情] 找不到银行金条表格元素', 'color: #f59e0b;');
            return;
        }

        if (!this.prices.bankGoldBars || this.prices.bankGoldBars.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding: 20px; color: #999;">暂无数据</td></tr>';
            return;
        }

        var html = '';
        this.prices.bankGoldBars.forEach(function(item) {
            html += '<tr>' +
                '<td class="jinjia_name">' + item.bank + '</td>' +
                '<td><span class="f_hongse">¥' + item.price + '</span></td>' +
                '</tr>';
        });

        tbody.innerHTML = html;
        console.log('%c[金银行情] 银行金条表格渲染成功', 'color: #10b981;');
    },

    // 渲染黄金回收价格
    renderGoldRecycle: function() {
        var tbody = document.getElementById('gold-recycle-body');
        if (!tbody) {
            console.warn('%c[金银行情] 找不到黄金回收表格元素', 'color: #f59e0b;');
            return;
        }

        if (!this.prices.goldRecycle || this.prices.goldRecycle.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px; color: #999;">暂无数据</td></tr>';
            return;
        }

        var html = '';
        this.prices.goldRecycle.forEach(function(item) {
            html += '<tr>' +
                '<td class="jinjia_name">' + item.gold_type + '</td>' +
                '<td><span class="f_hongse">¥' + item.recycle_price + '</span></td>' +
                '<td style="font-size: 12px; color: #999;">' + item.updated_date + '</td>' +
                '</tr>';
        });

        tbody.innerHTML = html;
        console.log('%c[金银行情] 黄金回收表格渲染成功', 'color: #10b981;');
    },

    // 渲染贵金属价格
    renderPreciousMetals: function() {
        var tbody = document.getElementById('precious-metals-body');
        if (!tbody) {
            console.warn('%c[金银行情] 找不到贵金属表格元素', 'color: #f59e0b;');
            return;
        }

        if (!this.prices.preciousMetals || this.prices.preciousMetals.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: #999;">暂无数据</td></tr>';
            return;
        }

        var html = '';
        this.prices.preciousMetals.forEach(function(item) {
            html += '<tr>' +
                '<td class="jinjia_name">' + item.brand + '</td>' +
                '<td><span class="f_hongse">¥' + item.bullion_price + '</span></td>' +
                '<td><span class="f_hongse">¥' + item.gold_price + '</span></td>' +
                '<td><span class="f_hongse">¥' + item.platinum_price + '</span></td>' +
                '</tr>';
        });

        tbody.innerHTML = html;
        console.log('%c[金银行情] 贵金属表格渲染成功', 'color: #10b981;');
    }
};

/**
 * 动态生成金银行情板块UI
 */
function initMetalsUI() {
    console.log('%c[金银行情] initMetalsUI 开始执行', 'color: #10b981; font-weight: bold;');
    const placeholder = document.getElementById('metals-section-placeholder');
    console.log('%c[金银行情] placeholder 元素: ' + !!placeholder, 'color: #10b981;');
    if (!placeholder) {
        console.error('%c[金银行情] 找不到 metals-section-placeholder 元素', 'color: #f59e0b; font-weight: bold;');
        return;
    }

    const metalsHTML = `
        <h4 class="text-gray">
            <i class="linecons-diamond" style="margin-right: 7px;" id="金银行情"></i>金银行情
            <span style="float: right; display: flex; align-items: center; font-size: 12px;">
                <button id="refresh-metals-btn" class="btn btn-xs btn-white" onclick="MetalsData.init()"
                    style="margin-right: 0; padding: 4px 8px;" title="刷新数据">
                    <i class="fa fa-refresh"></i>
                </button>
                <span style="margin-left: 8px; color: #888;">实时行情</span>
            </span>
        </h4>

        <div class="row">
            <div class="col-sm-12">
                <p class="states" style="font-size: 12px; color: #666; padding: 10px; background-color: #fff; text-align: center; margin-bottom: 15px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">声明：以下行情仅供参考，如有咨询请联系相关人员。</p>

                <!-- 银行投资金条价格 -->
                <div class="metals-table-container" style="margin-bottom: 20px;">
                    <div style="padding: 12px 15px; font-size: 15px; font-weight: 600; color: #333; border-bottom: 1px solid #f0f0f0;">银行投资金条价格</div>
                    <table class="table metals-table">
                        <thead>
                            <tr>
                                <th style="width: 60%;">银行</th>
                                <th style="width: 40%;">价格(元/克)</th>
                            </tr>
                        </thead>
                        <tbody id="bank-gold-bars-body">
                            <tr>
                                <td colspan="2" style="text-align:center; padding: 20px;">
                                    正在加载行情数据... <i class="fa fa-spinner fa-spin"></i>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- 黄金回收价格 -->
                <div class="metals-table-container" style="margin-bottom: 20px;">
                    <div style="padding: 12px 15px; font-size: 15px; font-weight: 600; color: #333; border-bottom: 1px solid #f0f0f0;">黄金回收价格</div>
                    <table class="table metals-table">
                        <thead>
                            <tr>
                                <th style="width: 40%;">品种</th>
                                <th style="width: 30%;">回收价格(元/克)</th>
                                <th style="width: 30%;">更新日期</th>
                            </tr>
                        </thead>
                        <tbody id="gold-recycle-body">
                            <tr>
                                <td colspan="3" style="text-align:center; padding: 20px;">
                                    正在加载行情数据... <i class="fa fa-spinner fa-spin"></i>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- 贵金属价格 -->
                <div class="metals-table-container">
                    <div style="padding: 12px 15px; font-size: 15px; font-weight: 600; color: #333; border-bottom: 1px solid #f0f0f0;">贵金属价格</div>
                    <table class="table metals-table">
                        <thead>
                            <tr>
                                <th style="width: 25%;">品牌</th>
                                <th style="width: 25%;">金条价(元/克)</th>
                                <th style="width: 25%;">黄金价(元/克)</th>
                                <th style="width: 25%;">铂金价(元/克)</th>
                            </tr>
                        </thead>
                        <tbody id="precious-metals-body">
                            <tr>
                                <td colspan="4" style="text-align:center; padding: 20px;">
                                    正在加载行情数据... <i class="fa fa-spinner fa-spin"></i>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div style="font-size: 12px; color: #888; text-align: right; margin-top: 5px;">
                    Data provided by <span id="metals-api-provider">XXAPI</span>
                    <span id="metals-api-status-dot" style="color: #10b981;">●</span>
                </div>
            </div>
        </div>

        <style>
            .metals-table-container {
                background: #fff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            }

            .metals-table {
                margin-bottom: 0;
                width: 100%;
            }

            .metals-table th {
                background: #fcfcfc;
                font-weight: 500;
                color: #888;
                border-bottom: 1px solid #f0f0f0;
                padding: 12px 15px !important;
                font-size: 13px;
            }

            .metals-table td {
                vertical-align: middle !important;
                padding: 12px 15px !important;
                border-top: 1px solid #f8f8f8;
                color: #333;
            }

            .metals-table tr:nth-child(even) {
                background-color: #fafafa;
            }

            .metals-table tr:hover {
                background-color: #f5f5f5;
            }

            .f_hongse {
                color: #ef4444;
                font-weight: 600;
            }

            .jinjia_name {
                font-weight: 500;
                color: #333;
            }
        </style>
    `;

    placeholder.innerHTML = metalsHTML;
    console.log('%c[金银行情] UI 生成成功', 'color: #10b981; font-weight: bold;');

    // 初始化数据
    MetalsData.init();
}

// 页面加载完成后初始化
console.log('%c[金银行情] 模块加载完成，当前状态: ' + document.readyState, 'color: #10b981; font-weight: bold;');

// 立即检查元素是否存在
var placeholder = document.getElementById('metals-section-placeholder');
console.log('%c[金银行情] 元素检查 - placeholder: ' + !!placeholder, 'color: #10b981;');

// 使用 window.onload 确保页面完全加载
window.addEventListener('load', function() {
    console.log('%c[金银行情] window.load 事件触发', 'color: #10b981;');

    // 再次检查元素
    placeholder = document.getElementById('metals-section-placeholder');
    console.log('%c[金银行情] load 事件后元素检查 - placeholder: ' + !!placeholder, 'color: #10b981;');

    // 检查是动态模式还是静态模式
    if (placeholder) {
        console.log('%c[金银行情] 检测到动态模式（index.html）', 'color: #10b981;');
        // 延迟执行，确保所有资源都已加载完成
        setTimeout(function() {
            console.log('%c[金银行情] 开始执行初始化', 'color: #10b981;');
            initMetalsUI();
        }, 200);
    } else {
        console.error('%c[金银行情] 未找到金银行情容器元素', 'color: #f59e0b; font-weight: bold;');
    }
});

// 备用：如果 window.onload 不触发，使用 DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        console.log('%c[金银行情] DOMContentLoaded 事件触发', 'color: #10b981;');
    });
}
