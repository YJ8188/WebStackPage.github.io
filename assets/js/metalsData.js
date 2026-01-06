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
        // 尝试动态模式的 tbody ID
        var refTableBody = document.querySelector('#reference-prices-table-body');
        var recycleTableBody = document.querySelector('#recycle-prices-table-body');
        var shanghaiTableBody = document.querySelector('#shanghai-prices-table-body');

        // 如果动态模式的 tbody 不存在，尝试静态模式的表格 tbody
        if (!refTableBody) {
            refTableBody = document.querySelector('#reference-prices-table tbody');
        }
        if (!recycleTableBody) {
            recycleTableBody = document.querySelector('#recycle-prices-table tbody');
        }
        if (!shanghaiTableBody) {
            shanghaiTableBody = document.querySelector('#shanghai-prices-table tbody');
        }

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
    console.log('%c[金银行情] UI 生成成功', 'color: #10b981; font-weight: bold;');

    // 初始化表格数据
    initMetalsTableWithRetry();
}

// 页面加载完成后初始化表格（带重试机制）
function initMetalsTableWithRetry(retryCount = 0) {
    console.log('%c[金银行情] 开始初始化表格数据...', 'color: #10b981;');

    try {
        // 检查元素是否存在 - 先尝试动态模式的 tbody ID
        var refTableBody = document.querySelector('#reference-prices-table-body');
        var recycleTableBody = document.querySelector('#recycle-prices-table-body');
        var shanghaiTableBody = document.querySelector('#shanghai-prices-table-body');

        // 如果动态模式的 tbody 不存在，尝试静态模式的表格 tbody
        if (!refTableBody) {
            var refTable = document.getElementById('reference-prices-table');
            if (refTable) {
                refTableBody = refTable.querySelector('tbody');
            }
        }
        if (!recycleTableBody) {
            var recycleTable = document.getElementById('recycle-prices-table');
            if (recycleTable) {
                recycleTableBody = recycleTable.querySelector('tbody');
            }
        }
        if (!shanghaiTableBody) {
            var shanghaiTable = document.getElementById('shanghai-prices-table');
            if (shanghaiTable) {
                shanghaiTableBody = shanghaiTable.querySelector('tbody');
            }
        }

        console.log('%c[金银行情] 元素检查:', 'color: #10b981;', {
            refTableBody: !!refTableBody,
            recycleTableBody: !!recycleTableBody,
            shanghaiTableBody: !!shanghaiTableBody
        });

        // 渲染表格数据
        if (refTableBody) {
            var refHtml = MetalsData.renderReferencePrices();
            refTableBody.innerHTML = refHtml;
            console.log('%c[金银行情] 参考价格表格渲染成功，行数: ' + MetalsData.referencePrices.length, 'color: #10b981;');
        } else {
            console.error('%c[金银行情] 找不到参考价格表格元素', 'color: #f59e0b; font-weight: bold;');
        }

        if (recycleTableBody) {
            var recycleHtml = MetalsData.renderRecyclePrices();
            recycleTableBody.innerHTML = recycleHtml;
            console.log('%c[金银行情] 旧料回收表格渲染成功，行数: ' + MetalsData.recyclePrices.length, 'color: #10b981;');
        } else {
            console.error('%c[金银行情] 找不到旧料回收表格元素', 'color: #f59e0b; font-weight: bold;');
        }

        if (shanghaiTableBody) {
            var shanghaiHtml = MetalsData.renderShanghaiPrices();
            shanghaiTableBody.innerHTML = shanghaiHtml;
            console.log('%c[金银行情] 上海行情表格渲染成功，行数: ' + MetalsData.shanghaiPrices.length, 'color: #10b981;');
        } else {
            console.error('%c[金银行情] 找不到上海行情表格元素', 'color: #f59e0b; font-weight: bold;');
        }

        console.log('%c[金银行情] ✓ 所有表格初始化成功', 'color: #10b981; font-weight: bold;');
    } catch (e) {
        console.error('%c[金银行情] ✗ 表格初始化失败:', 'color: #f59e0b; font-weight: bold;', e);
        console.error('%c[金银行情] 错误堆栈:', 'color: #f59e0b;', e.stack);
        if (retryCount < 3) {
            console.log('%c[金银行情] 正在重试初始化 (' + (retryCount + 1) + '/3)...', 'color: #f59e0b;');
            setTimeout(() => initMetalsTableWithRetry(retryCount + 1), 1000);
        }
    }
}

// 页面加载完成后初始化
console.log('%c[金银行情] 模块加载完成，当前状态: ' + document.readyState, 'color: #10b981; font-weight: bold;');

// 使用 window.onload 确保页面完全加载
window.addEventListener('load', function() {
    console.log('%c[金银行情] window.load 事件触发', 'color: #10b981;');

    // 检查是动态模式还是静态模式
    var placeholder = document.getElementById('metals-section-placeholder');
    var staticTable = document.getElementById('reference-prices-table');

    if (placeholder) {
        console.log('%c[金银行情] 检测到动态模式（index.html）', 'color: #10b981;');
        // 延迟执行，确保所有资源都已加载完成
        setTimeout(function() {
            console.log('%c[金银行情] 开始执行初始化', 'color: #10b981;');
            initMetalsUI();
        }, 200);
    } else if (staticTable) {
        console.log('%c[金银行情] 检测到静态模式（1index.html）', 'color: #10b981;');
        // 静态模式，直接初始化表格数据
        setTimeout(function() {
            console.log('%c[金银行情] 开始执行静态模式初始化', 'color: #10b981;');
            initMetalsTableWithRetry();
        }, 200);
    } else {
        console.error('%c[金银行情] 未找到金银行情容器元素', 'color: #f59e0b; font-weight: bold;');
    }
});
