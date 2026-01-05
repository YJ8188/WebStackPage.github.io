// 贵金属行情数据配置
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

// 页面加载完成后初始化表格
document.addEventListener('DOMContentLoaded', function() {
    MetalsData.initTables();
});