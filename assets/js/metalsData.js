// ==================== 贵金属行情模块 ====================
/**
 * 贵金属实时行情显示模块
 * 功能：获取并显示贵金属的实时价格、涨跌幅等信息
 */

var MetalsData = {
    // 参考价格数据
    referencePrices: [
        { name: '黄金', id_B: 'jzj_au_B', id_A: 'jzj_au_A', hasSale: true },
        { name: '白银', id_B: 'jzj_ag_B', id_A: 'jzj_ag_A', hasSale: true },
        { name: '铂金', id_B: 'jzj_pt_B', id_A: 'jzj_pt_A', hasSale: true },
        { name: '钯金', id_B: 'jzj_pd_B', id_A: 'jzj_pd_A', hasSale: true },
        { name: '铑金', id_B: 'jzj_rh_B', id_A: null, hasSale: false },
        { name: '铱金', id_B: 'jzj_ir_B', id_A: null, hasSale: false },
        { name: '钌金', id_B: 'jzj_ru_B', id_A: null, hasSale: false }
    ],

    // 旧料回收数据
    recyclePrices: [
        { name: '旧料9999', id_B: 'jzj_zj9999_B' },
        { name: '18K金', id_B: 'jzj_k18_B' },
        { name: 'Pt950', id_B: 'jzj_pt950_B' },
        { name: 'Pd990', id_B: 'jzj_pd990_B' }
    ],

    // 上海行情数据
    shanghaiPrices: [
        { name: '黄金(T+D)', id_B: 'SG5106_B', id_A: 'SG5106_A' },
        { name: '白银(T+D)', id_B: 'SG5108_B', id_A: 'SG5108_A' },
        { name: '黄金99.99', id_B: 'SG5101_B', id_A: 'SG5101_A' },
        { name: '铂金99.95', id_B: 'SG5103_B', id_A: 'SG5103_A' }
    ],

    // 渲染参考价格表格
    renderReferencePrices: function() {
        var html = '';
        this.referencePrices.forEach(function(item, index) {
            var className = index % 2 === 1 ? 'single_tr' : '';
            var saleHtml = item.hasSale ? 
                '<td class="rightLine"><span class="f_hongse" id="' + item.id_A + '">--</span></td>' : 
                '<td class="rightLine"><span class="f_hongse">--</span></td>';
            
            html += '<tr class="' + className + '">' +
                '<td class="jinjia_name">' + item.name + '</td>' +
                '<td class="rightLine lineBackgroound"><span class="f_hongse" id="' + item.id_B + '">--</span></td>' +
                saleHtml +
                '</tr>';
        });
        return html;
    },

    // 渲染旧料回收表格
    renderRecyclePrices: function() {
        var html = '';
        this.recyclePrices.forEach(function(item, index) {
            var className = index % 2 === 1 ? 'single_tr' : '';
            html += '<tr class="' + className + '">' +
                '<td class="jinjia_name">' + item.name + '</td>' +
                '<td><span class="f_hongse" id="' + item.id_B + '">--</span></td>' +
                '</tr>';
        });
        return html;
    },

    // 渲染上海行情表格
    renderShanghaiPrices: function() {
        var html = '';
        this.shanghaiPrices.forEach(function(item, index) {
            var className = index % 2 === 1 ? 'single_tr' : '';
            html += '<tr class="' + className + '">' +
                '<td class="jinjia_name">' + item.name + '</td>' +
                '<td class="rightLine lineBackgroound"><span class="f_hongse" id="' + item.id_B + '">----</span></td>' +
                '<td class="rightLine"><span class="f_hongse" id="' + item.id_A + '">----</span></td>' +
                '</tr>';
        });
        return html;
    },

    // 初始化所有表格
    initTables: function() {
        var refTableBody = document.querySelector('#reference-prices-table tbody');
        var recycleTableBody = document.querySelector('#recycle-prices-table tbody');
        var shanghaiTableBody = document.querySelector('#shanghai-prices-table tbody');

        if (refTableBody) {
            refTableBody.innerHTML = this.renderReferencePrices();
        }
        if (recycleTableBody) {
            recycleTableBody.innerHTML = this.renderRecyclePrices();
        }
        if (shanghaiTableBody) {
            shanghaiTableBody.innerHTML = this.renderShanghaiPrices();
        }
    }
};

/**
 * 动态生成金银行情板块UI
 */
function initMetalsUI() {
    console.log('[金银行情] initMetalsUI 开始执行');
    const placeholder = document.getElementById('metals-section-placeholder');
    console.log('[金银行情] placeholder 元素:', !!placeholder);
    if (!placeholder) {
        console.error('[金银行情] 找不到 metals-section-placeholder 元素');
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
                        
                        <!-- 参考价格 -->
                        <p class="paddingP" style="padding: 15px 10px; margin: 0 0 15px 0; font-size: 16px; font-weight: bold; color: #333;">参考价格</p>
                        <table class="jinjia_tab" style="width: 100%; border-collapse: collapse; margin-bottom: 20px; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                            <thead>
                                <tr>
                                    <th width="33.33%" style="background-color: #f8f8f8; padding: 12px; text-align: center; border-bottom: 2px solid #ddd; font-weight: bold; color: #333;">商品</th>
                                    <th width="33.33%" style="background-color: #f8f8f8; padding: 12px; text-align: center; border-bottom: 2px solid #ddd; font-weight: bold; color: #333;">回购</th>
                                    <th width="33.33%" style="background-color: #f8f8f8; padding: 12px; text-align: center; border-bottom: 2px solid #ddd; font-weight: bold; color: #333;">销售</th>
                                </tr>
                            </thead>
                            <tbody id="reference-prices-table-body" style="background: #fff;">
                                <tr><td colspan="3" style="text-align:center; padding: 20px;">正在加载行情数据...</td></tr>
                            </tbody>
                        </table>

                        <!-- 旧料回收 -->
                        <table class="jinjia_tab" style="width: 100%; border-collapse: collapse; margin-bottom: 20px; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                            <thead>
                                <tr>
                                    <th width="50%" style="background-color: #f8f8f8; padding: 12px; text-align: center; border-bottom: 2px solid #ddd; font-weight: bold; color: #333;">商品</th>
                                    <th width="50%" style="background-color: #f8f8f8; padding: 12px; text-align: center; border-bottom: 2px solid #ddd; font-weight: bold; color: #333;">回购</th>
                                </tr>
                            </thead>
                            <tbody id="recycle-prices-table-body" style="background: #fff;">
                                <tr><td colspan="2" style="text-align:center; padding: 20px;">正在加载行情数据...</td></tr>
                            </tbody>
                        </table>

                        <!-- 上海行情 -->
                        <p class="paddingP" style="padding: 15px 10px; margin: 0 0 15px 0; font-size: 16px; font-weight: bold; color: #333;">上海行情</p>
                        <table class="jinjia_tab" style="width: 100%; border-collapse: collapse; margin-bottom: 20px; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                            <thead>
                                <tr>
                                    <th width="33.33%" style="background-color: #f8f8f8; padding: 12px; text-align: center; border-bottom: 2px solid #ddd; font-weight: bold; color: #333;">商品</th>
                                    <th width="33.33%" style="background-color: #f8f8f8; padding: 12px; text-align: center; border-bottom: 2px solid #ddd; font-weight: bold; color: #333;">回购</th>
                                    <th width="33.33%" style="background-color: #f8f8f8; padding: 12px; text-align: center; border-bottom: 2px solid #ddd; font-weight: bold; color: #333;">销售</th>
                                </tr>
                            </thead>
                            <tbody id="shanghai-prices-table-body" style="background: #fff;">
                                <tr><td colspan="3" style="text-align:center; padding: 20px;">正在加载行情数据...</td></tr>
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
    console.log('[金银行情] UI 生成成功');

    // 初始化表格数据
    initMetalsTableWithRetry();
}

// 页面加载完成后初始化表格（带重试机制）
function initMetalsTableWithRetry(retryCount = 0) {
    try {
        MetalsData.initTables();
        console.log('[金银行情] ✓ 表格初始化成功');
    } catch (e) {
        console.error('[金银行情] ✗ 表格初始化失败:', e);
        if (retryCount < 3) {
            console.log(`[金银行情] 正在重试初始化 (${retryCount + 1}/3)...`);
            setTimeout(() => initMetalsTableWithRetry(retryCount + 1), 1000);
        }
    }
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMetalsUI);
} else {
    initMetalsUI();
}