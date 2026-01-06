// ==================== 贵金属行情模块 ====================
/**
 * 贵金属实时行情显示模块
 * 功能：获取并显示贵金属的实时价格、涨跌幅等信息
 */

// API Key (使用Base64编码加密)
const _0x4f2a = atob('YjgzYjI1ODBjOGVhOTVjYQ==');

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
                'Authorization': `Bearer ${_0x4f2a}`,
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

        var html = '';
        this.prices.bankGoldBars.forEach(function(item, index) {
            var className = index % 2 === 1 ? 'single_tr' : '';
            html += '<tr class="' + className + '">' +
                '<td class="jinjia_name">' + item.bank + '</td>' +
                '<td><span class="f_hongse">' + item.price + '</span></td>' +
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

        var html = '';
        this.prices.goldRecycle.forEach(function(item, index) {
            var className = index % 2 === 1 ? 'single_tr' : '';
            html += '<tr class="' + className + '">' +
                '<td class="jinjia_name">' + item.gold_type + '</td>' +
                '<td><span class="f_hongse">' + item.recycle_price + '</span></td>' +
                '<td style="font-size: 12px; color: #888;">' + item.updated_date + '</td>' +
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

        var html = '';
        this.prices.preciousMetals.forEach(function(item, index) {
            var className = index % 2 === 1 ? 'single_tr' : '';
            html += '<tr class="' + className + '">' +
                '<td class="jinjia_name">' + item.brand + '</td>' +
                '<td><span class="f_hongse">' + item.bullion_price + '</span></td>' +
                '<td><span class="f_hongse">' + item.gold_price + '</span></td>' +
                '<td><span class="f_hongse">' + item.platinum_price + '</span></td>' +
                '<td style="font-size: 12px; color: #888;">' + item.updated_date + '</td>' +
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
        <div class="panel panel-default" id="金银行情">
            <div class="panel-body">
                <h4 class="text-gray">
                    <i class="linecons-diamond" style="margin-right: 7px;" id="金银行情"></i>金银行情
                    <span style="float: right; font-size: 12px; color: #888;">实时行情数据</span>
                </h4>

                <div class="row">
                    <div class="col-sm-12">
                        <p class="states" style="font-size: 12px; color: #666; padding: 10px; background-color: #fff; text-align: center; margin-bottom: 15px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">声明：以下行情仅供参考，如有咨询请联系相关人员。</p>
                        
                        <!-- 银行投资金条价格 -->
                        <p class="paddingP" style="padding: 15px 10px; margin: 0 0 15px 0; font-size: 16px; font-weight: bold; color: #333;">银行投资金条价格</p>
                        <table class="jinjia_tab" style="width: 100%; border-collapse: collapse; margin-bottom: 20px; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                            <thead>
                                <tr>
                                    <th width="60%" style="background-color: #f8f8f8; padding: 12px; text-align: center; border-bottom: 2px solid #ddd; font-weight: bold; color: #333;">银行</th>
                                    <th width="40%" style="background-color: #f8f8f8; padding: 12px; text-align: center; border-bottom: 2px solid #ddd; font-weight: bold; color: #333;">价格(元/克)</th>
                                </tr>
                            </thead>
                            <tbody id="bank-gold-bars-body" style="background: #fff;">
                                <tr><td colspan="2" style="text-align:center; padding: 20px;">正在加载行情数据...</td></tr>
                            </tbody>
                        </table>

                        <!-- 黄金回收价格 -->
                        <p class="paddingP" style="padding: 15px 10px; margin: 0 0 15px 0; font-size: 16px; font-weight: bold; color: #333;">黄金回收价格</p>
                        <table class="jinjia_tab" style="width: 100%; border-collapse: collapse; margin-bottom: 20px; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                            <thead>
                                <tr>
                                    <th width="40%" style="background-color: #f8f8f8; padding: 12px; text-align: center; border-bottom: 2px solid #ddd; font-weight: bold; color: #333;">品种</th>
                                    <th width="30%" style="background-color: #f8f8f8; padding: 12px; text-align: center; border-bottom: 2px solid #ddd; font-weight: bold; color: #333;">回收价格(元/克)</th>
                                    <th width="30%" style="background-color: #f8f8f8; padding: 12px; text-align: center; border-bottom: 2px solid #ddd; font-weight: bold; color: #333;">更新日期</th>
                                </tr>
                            </thead>
                            <tbody id="gold-recycle-body" style="background: #fff;">
                                <tr><td colspan="3" style="text-align:center; padding: 20px;">正在加载行情数据...</td></tr>
                            </tbody>
                        </table>

                        <!-- 贵金属价格 -->
                        <p class="paddingP" style="padding: 15px 10px; margin: 0 0 15px 0; font-size: 16px; font-weight: bold; color: #333;">贵金属价格</p>
                        <table class="jinjia_tab" style="width: 100%; border-collapse: collapse; margin-bottom: 20px; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                            <thead>
                                <tr>
                                    <th width="25%" style="background-color: #f8f8f8; padding: 12px; text-align: center; border-bottom: 2px solid #ddd; font-weight: bold; color: #333;">品牌</th>
                                    <th width="25%" style="background-color: #f8f8f8; padding: 12px; text-align: center; border-bottom: 2px solid #ddd; font-weight: bold; color: #333;">金条价(元/克)</th>
                                    <th width="25%" style="background-color: #f8f8f8; padding: 12px; text-align: center; border-bottom: 2px solid #ddd; font-weight: bold; color: #333;">黄金价(元/克)</th>
                                    <th width="25%" style="background-color: #f8f8f8; padding: 12px; text-align: center; border-bottom: 2px solid #ddd; font-weight: bold; color: #333;">铂金价(元/克)</th>
                                </tr>
                            </thead>
                            <tbody id="precious-metals-body" style="background: #fff;">
                                <tr><td colspan="4" style="text-align:center; padding: 20px;">正在加载行情数据...</td></tr>
                            </tbody>
                        </table>

                        <div style="font-size: 12px; color: #888; text-align: right; margin-top: 5px;">
                            贵金属行情数据
                        </div>
                    </div>
                </div>
            </div>
        </div>
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
