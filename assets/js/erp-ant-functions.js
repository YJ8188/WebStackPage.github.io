/**
 * ERP Ant Design 界面 - 业务逻辑函数
 * 从 erp.html 提取并适配用于 erp-ant.html
 */

// ==================== 登录状态检查 ====================
let erpRealtimeSyncTimer = null;
let erpRealtimeSyncInProgress = false;
const ERP_VERBOSE_LOG = typeof window !== 'undefined' && window.__DEBUG_MODE__ === true;

function erpDebugLog(level, ...args) {
    if (!ERP_VERBOSE_LOG) {
        return;
    }

    const logger = console[level] || console.log;
    logger(...args);
}

function isInventoryRiskProduct(product) {
    const parsedStock = Number(product?.stock_quantity);
    const parsedMinStock = Number(product?.min_stock);
    const stock = Number.isFinite(parsedStock) ? parsedStock : 0;
    const minStock = Number.isFinite(parsedMinStock) ? parsedMinStock : 0;
    return minStock > 0 ? stock <= minStock : stock <= 3;
}

function isSameEntityId(left, right) {
    if (left === null || left === undefined || right === null || right === undefined) {
        return false;
    }
    return String(left) === String(right);
}

function normalizeEntityId(value) {
    if (value === null || value === undefined) {
        return null;
    }
    const text = String(value).trim();
    if (!text) {
        return null;
    }
    return /^-?\d+$/.test(text) ? Number(text) : text;
}

const orderApprovalHistoryState = {
    orderId: null,
    order: null,
    records: [],
    filteredRecords: [],
    keyword: '',
    range: 'all',
    loading: false,
    errorMessage: ''
};

const payablePaymentHistoryState = {
    financeId: null,
    finance: null,
    rows: [],
    relatedRows: []
};

let bulkCompleteSignedOrdersInProgress = false;
const purchaseLogState = {
    records: []
};
const financeViewState = {
    currentRows: [],
    source: 'all'
};
const dashboardItemCacheState = {
    orderIdsKey: '',
    rows: [],
    loadedAt: 0,
    pendingKey: '',
    pendingPromise: null
};
const dashboardOrderStatusLogCacheState = {
    orderIdsKey: '',
    rows: [],
    loadedAt: 0,
    pendingKey: '',
    pendingPromise: null
};
const dashboardPurchaseCacheState = {
    rows: [],
    loadedAt: 0,
    pendingPromise: null
};

function resetDashboardItemCache() {
    dashboardItemCacheState.orderIdsKey = '';
    dashboardItemCacheState.rows = [];
    dashboardItemCacheState.loadedAt = 0;
    dashboardItemCacheState.pendingKey = '';
    dashboardItemCacheState.pendingPromise = null;

    dashboardOrderStatusLogCacheState.orderIdsKey = '';
    dashboardOrderStatusLogCacheState.rows = [];
    dashboardOrderStatusLogCacheState.loadedAt = 0;
    dashboardOrderStatusLogCacheState.pendingKey = '';
    dashboardOrderStatusLogCacheState.pendingPromise = null;

    dashboardPurchaseCacheState.rows = [];
    dashboardPurchaseCacheState.loadedAt = 0;
    dashboardPurchaseCacheState.pendingPromise = null;
}

function escapeCsvCell(value) {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsvFile(fileName, headers, rows) {
    const safeHeaders = Array.isArray(headers) ? headers : [];
    const safeRows = Array.isArray(rows) ? rows : [];
    const csvLines = [
        safeHeaders.map(escapeCsvCell).join(','),
        ...safeRows.map(row => (Array.isArray(row) ? row : []).map(escapeCsvCell).join(','))
    ];
    const csvContent = '\uFEFF' + csvLines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function formatFileTimestamp(date = new Date()) {
    const d = date instanceof Date ? date : new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    const second = String(d.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}-${hour}${minute}${second}`;
}

function syncFinanceViewRows(rows = [], source = 'all') {
    financeViewState.currentRows = Array.isArray(rows) ? [...rows] : [];
    financeViewState.source = source;
}

function parsePurchaseMetaFromNotes(notes) {
    const raw = String(notes || '').trim();
    const result = {};
    if (!raw || !raw.includes('|')) {
        return result;
    }

    raw.split('|').forEach((segment, index) => {
        if (index === 0 && !segment.includes('=')) {
            result.tag = segment.trim();
            return;
        }
        const [key, ...valueParts] = segment.split('=');
        const keyText = String(key || '').trim();
        if (!keyText) {
            return;
        }
        result[keyText] = valueParts.join('=').trim();
    });
    return result;
}

function formatCurrency(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) {
        return '¥0.00';
    }
    return `¥${amount.toFixed(2)}`;
}

function getCurrentYearMonthText() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function parseYearMonthValue(rawValue) {
    const text = String(rawValue || '').trim();
    const matched = text.match(/^(\d{4})-(\d{2})$/);
    if (!matched) {
        const fallback = getCurrentYearMonthText().split('-');
        return {
            year: Number(fallback[0]),
            month: Number(fallback[1]),
            key: getCurrentYearMonthText()
        };
    }
    const year = Number(matched[1]);
    const month = Number(matched[2]);
    return {
        year,
        month,
        key: `${year}-${String(month).padStart(2, '0')}`
    };
}

function getSelectedFinanceReportMonth() {
    const input = document.getElementById('financeReportMonth');
    const rawValue = input?.value || getCurrentYearMonthText();
    return parseYearMonthValue(rawValue);
}

function isDateInYearMonth(dateValue, year, month) {
    const date = parseFinanceDate(dateValue);
    if (!date) {
        return false;
    }
    return date.getFullYear() === year && (date.getMonth() + 1) === month;
}

function getFinanceReferenceMeta(finance) {
    const rawReferenceId = finance?.reference_id;
    const rawOrderId = finance?.order_id;
    const hasReference = rawReferenceId !== null && rawReferenceId !== undefined && String(rawReferenceId).trim() !== '';
    const hasOrder = rawOrderId !== null && rawOrderId !== undefined && String(rawOrderId).trim() !== '';

    return {
        referenceId: hasReference ? String(rawReferenceId) : null,
        orderId: hasOrder ? String(rawOrderId) : null
    };
}

function getFinanceChartSourceRows(preferredRows = null) {
    const scopeValue = String(document.getElementById('financeChartScope')?.value || 'all').toLowerCase();
    const allRows = Array.isArray(ERP.state?.finances) ? ERP.state.finances : [];

    if (scopeValue === 'filtered') {
        if (Array.isArray(preferredRows)) {
            return preferredRows;
        }
        if (Array.isArray(financeViewState.currentRows) && financeViewState.currentRows.length > 0) {
            return financeViewState.currentRows;
        }
        return allRows;
    }

    return allRows;
}

function onFinanceChartScopeChange() {
    renderFinanceTrendSummary();
    renderFinanceMonthlyProfitChart();
    renderFinanceCashflowOverview();
    renderFinanceRiskAlerts();
}

function onFinanceReportMonthChange() {
    renderFinanceCashflowOverview();
    renderFinanceMonthlyProfitChart();
}

function isPurchasePaymentRecord(finance) {
    const type = String(finance?.type || '').toLowerCase();
    const category = String(finance?.category || '');
    if (type !== 'expense') {
        return false;
    }
    return category.includes('采购付款') && Number(finance?.amount || 0) > 0;
}

const ERP_SYSTEM_FINANCE_CATEGORIES = ['销售订单', '销售成本', '利润', '利润(系统)', '应付账款', '采购付款', '回款确认'];

function normalizeTextKey(value) {
    return String(value || '').trim().toLowerCase();
}

function buildCustomerMergeKey(customer) {
    return [
        normalizeTextKey(customer?.name),
        normalizeTextKey(customer?.phone),
        normalizeTextKey(customer?.email)
    ].join('|');
}

function buildProductMergeKey(product) {
    const sku = normalizeTextKey(product?.sku);
    const name = normalizeTextKey(product?.name);
    return sku ? `${sku}|${name}` : name;
}

function buildFinanceMergeKey(finance) {
    return [
        normalizeTextKey(finance?.type),
        normalizeTextKey(finance?.category),
        Number(finance?.amount || 0).toFixed(2),
        normalizeTextKey(finance?.description),
        normalizeTextKey(finance?.transaction_date)
    ].join('|');
}

function isSystemLinkedFinanceCategory(category) {
    const text = String(category || '').trim();
    if (!text) {
        return false;
    }
    return ERP_SYSTEM_FINANCE_CATEGORIES.some(item => text.includes(item));
}

function toDbDateTimeString(inputValue) {
    const raw = String(inputValue || '').trim();
    if (!raw) {
        return new Date().toISOString();
    }

    if (raw.includes(' ')) {
        return raw;
    }

    if (raw.includes('T')) {
        const date = new Date(raw);
        if (Number.isNaN(date.getTime())) {
            return new Date().toISOString();
        }
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        const second = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    }

    return raw;
}

function getERPInventoryDiagnostics() {
    const products = (window.ERP && ERP.state && Array.isArray(ERP.state.products)) ? ERP.state.products : [];
    const rows = products.map(product => {
        const stockRaw = product?.stock_quantity;
        const minStockRaw = product?.min_stock;
        const stock = Number(stockRaw);
        const minStock = Number(minStockRaw);
        const safeStock = Number.isFinite(stock) ? stock : 0;
        const safeMinStock = Number.isFinite(minStock) ? minStock : 0;
        const risk = safeMinStock > 0 ? safeStock <= safeMinStock : safeStock <= 3;

        return {
            id: product?.id,
            name: product?.name,
            stockRaw,
            minStockRaw,
            stock: safeStock,
            minStock: safeMinStock,
            risk
        };
    });

    const lowStockCount = rows.filter(item => item.risk).length;
    return { rows, lowStockCount };
}

function getLowStockRuleText(rows = []) {
    if (!Array.isArray(rows) || rows.length === 0) {
        return '暂无产品数据';
    }

    const thresholds = rows
        .map(item => Number(item?.minStock))
        .filter(value => Number.isFinite(value) && value > 0);

    if (thresholds.length === 0) {
        return '规则：库存 ≤ 3 触发预警';
    }

    const minThreshold = Math.min(...thresholds);
    const maxThreshold = Math.max(...thresholds);

    if (minThreshold === maxThreshold) {
        return `规则：库存 ≤ ${minThreshold} 触发预警`;
    }

    return `规则：库存 ≤ 各商品预警值（${minThreshold}~${maxThreshold}）`;
}

function renderLowStockSummary(diagnostics, lowStockCount) {
    const safeCount = Number.isFinite(lowStockCount) ? lowStockCount : 0;
    const rows = Array.isArray(diagnostics?.rows) ? diagnostics.rows : [];

    const statLowStock = document.getElementById('statLowStock');
    if (statLowStock) {
        statLowStock.textContent = rows.length > 0 ? `${safeCount}/${rows.length}` : String(safeCount);
    }

    const statLowStockHint = document.getElementById('statLowStockHint');
    if (!statLowStockHint) {
        return;
    }

    if (rows.length === 0) {
        statLowStockHint.textContent = '暂无产品数据';
        return;
    }

    statLowStockHint.textContent = `共 ${rows.length} 个商品，${safeCount} 个触发预警；${getLowStockRuleText(rows)}`;
}

async function checkLoginStatus() {
    if (typeof userData !== 'undefined' && userData.isLoggedIn) {
        showERPContent();
        if (typeof ERP !== 'undefined' && ERP.init) {
            ERP.init();
        }
        return;
    }

    try {
        if (window.supabaseClient && window.supabaseClient.auth) {
            let session = null;

            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const { data, error } = await window.supabaseClient.auth.getSession();
                    session = data?.session || null;

                    if (!error || !String(error.message || '').toLowerCase().includes('aborted') || attempt === 3) {
                        break;
                    }
                } catch (error) {
                    if (!String(error?.message || '').toLowerCase().includes('aborted') || attempt === 3) {
                        break;
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 200 * attempt));
            }

            if (session && session.user) {
                if (typeof userData !== 'undefined') {
                    userData.isLoggedIn = true;
                    userData.user = session.user;
                    if (typeof userData.loadConfig === 'function') {
                        userData.loadConfig(true).catch(loadConfigError => {
                            console.error('[ERP Ant] 会话恢复后加载用户配置失败:', loadConfigError);
                        });
                    }
                }
                showERPContent();
                if (typeof ERP !== 'undefined' && ERP.init) {
                    ERP.init();
                }
                return;
            }
        }
    } catch (error) {
        console.error('[ERP Ant] checkLoginStatus 获取会话失败:', error?.message || error);
    }

    showNotLoggedIn();
}

function showLoading() {
    document.getElementById('loadingContainer').style.display = 'block';
    document.getElementById('notLoggedIn').style.display = 'none';
    document.getElementById('erpContent').style.display = 'none';
}

function showNotLoggedIn() {
    stopERPRealtimeSync();
    document.getElementById('loadingContainer').style.display = 'none';
    document.getElementById('notLoggedIn').style.display = 'block';
    document.getElementById('erpContent').style.display = 'none';
}

function showERPContent() {
    document.getElementById('loadingContainer').style.display = 'none';
    document.getElementById('notLoggedIn').style.display = 'none';
    document.getElementById('erpContent').style.display = 'block';
    startERPRealtimeSync();
}

function showCustomerProfile(customerId) {
    if (!window.ERP || !Array.isArray(ERP.state.customers)) {
        console.error('[ERP] 客户档案打开失败：ERP状态不可用');
        return;
    }

    const normalizedCustomerId = normalizeEntityId(customerId);
    const customer = ERP.state.customers.find(item => isSameEntityId(item.id, normalizedCustomerId));

    erpDebugLog('info', '[ERP Debug] customer profile click', {
        rawCustomerId: customerId,
        normalizedCustomerId,
        customersCount: ERP.state.customers.length,
        customerFound: !!customer,
        customerIds: ERP.state.customers.map(item => item?.id)
    });

    if (!customer) {
        if (typeof showToast === 'function') {
            showToast('未找到客户信息', 'warning');
        }
        return;
    }

    const relatedOrders = (ERP.state.orders || []).filter(order => isSameEntityId(order.customer_id, customer.id));
    const totalAmount = relatedOrders.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0);

    const modal = document.getElementById('customerProfileModal');
    const content = document.getElementById('customerProfileContent');
    const title = document.getElementById('customerProfileTitle');

    if (modal && content) {
        const latestOrders = relatedOrders.slice(0, 6).map(order => {
            const orderNumber = order.order_number || `订单#${order.id}`;
            const amount = parseFloat(order.total_amount || 0).toFixed(2);
            return `<li style="padding:6px 0;border-bottom:1px solid #f0f0f0;">${orderNumber} · ¥${amount}</li>`;
        }).join('');

        if (title) {
            title.textContent = `${customer.name || '客户'} · 客户档案`;
        }

        content.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 18px;line-height:1.7;">
                <div><strong>联系人：</strong>${customer.contact_person || '-'}</div>
                <div><strong>电话：</strong>${customer.phone || '-'}</div>
                <div><strong>邮箱：</strong>${customer.email || '-'}</div>
                <div><strong>状态：</strong>${customer.status === 'active' ? '活跃' : '停用'}</div>
                <div><strong>历史订单：</strong>${relatedOrders.length} 笔</div>
                <div><strong>累计金额：</strong>¥${totalAmount.toFixed(2)}</div>
            </div>
            <div style="margin-top:12px;"><strong>地址：</strong>${customer.address || '-'}</div>
            <div style="margin-top:6px;"><strong>备注：</strong>${customer.notes || '-'}</div>
            <div style="margin-top:14px;">
                <strong>最近订单：</strong>
                <ul style="list-style:none;padding:0;margin:6px 0 0;max-height:180px;overflow:auto;">
                    ${latestOrders || '<li style="padding:6px 0;color:#999;">暂无订单</li>'}
                </ul>
            </div>
        `;

        modal.classList.add('active');
        modal.style.display = 'flex';
        return;
    }

    const profileText = [
        `客户名称：${customer.name || '-'}`,
        `联系人：${customer.contact_person || '-'}`,
        `电话：${customer.phone || '-'}`,
        `邮箱：${customer.email || '-'}`,
        `状态：${customer.status === 'active' ? '活跃' : '停用'}`,
        `历史订单：${relatedOrders.length} 笔`,
        `累计金额：¥${totalAmount.toFixed(2)}`,
        `地址：${customer.address || '-'}`,
        `备注：${customer.notes || '-'}`
    ].join('\n');

    alert(profileText);
}

function handleCustomerProfileLink(event, customerId) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }

    const normalizedCustomerId = normalizeEntityId(customerId);

    erpDebugLog('info', '[ERP Debug] handleCustomerProfileLink', {
        rawCustomerId: customerId,
        normalizedCustomerId,
        href: event?.currentTarget?.getAttribute?.('href') || null
    });

    if (normalizedCustomerId === null) {
        console.error('[ERP] 客户档案打开失败：客户ID为空');
        return false;
    }

    showCustomerProfile(normalizedCustomerId);
    return false;
}

function hideCustomerProfileModal() {
    const modal = document.getElementById('customerProfileModal');
    if (!modal) {
        return;
    }
    modal.classList.remove('active');
    modal.style.display = '';
}

// ==================== 统计数据更新 ====================
function updateStatistics(data) {
    if (typeof ERP === 'undefined' || !ERP.getStatistics) return;
    
    const stats = ERP.getStatistics();

    // 更新客户统计
    const statCustomers = document.getElementById('statCustomers');
    if (statCustomers) statCustomers.textContent = stats.customers.total;
    
    const statActiveCustomers = document.getElementById('statActiveCustomers');
    if (statActiveCustomers) statActiveCustomers.textContent = stats.customers.active;

    // 更新产品统计
    const statProducts = document.getElementById('statProducts');
    if (statProducts) statProducts.textContent = stats.products.total;
    
    const diagnostics = getERPInventoryDiagnostics();
    const inventoryRisk = diagnostics.lowStockCount;
    const finalLowStock = Number.isFinite(stats.products.lowStock) ? stats.products.lowStock : inventoryRisk;
    renderLowStockSummary(diagnostics, finalLowStock);

    erpDebugLog('info', '[ERP Debug] low stock statistics', {
        statsLowStock: stats.products.lowStock,
        inventoryRisk,
        finalLowStock,
        productsCount: diagnostics.rows.length,
        rows: diagnostics.rows
    });

    // 更新订单统计
    const statOrders = document.getElementById('statOrders');
    if (statOrders) statOrders.textContent = stats.orders.total;
    
    const statPendingOrders = document.getElementById('statPendingOrders');
    if (statPendingOrders) statPendingOrders.textContent = stats.orders.pending;

    // 更新财务统计
    const statRevenue = document.getElementById('statRevenue');
    if (statRevenue) statRevenue.textContent = '¥' + stats.finances.totalIncome.toLocaleString();
    
    const statProfit = document.getElementById('statProfit');
    if (statProfit) statProfit.textContent = '¥' + stats.finances.netProfit.toLocaleString();

    const currentOrders = Array.isArray(ERP.state?.orders) ? ERP.state.orders : [];
    renderOrderWorkflowSummary(currentOrders, getFilteredOrdersForView());
    renderFinanceAgingSummary();
    renderFinanceTrendSummary();
    renderFinanceMonthlyProfitChart();
    renderFinanceCashflowOverview();
    renderFinanceRiskAlerts();
    renderDashboardBusinessCards();
    renderDashboardSalesFunnel();
    renderDashboardDeliveryPerformance();
    renderDashboardCustomerInsights();
    renderDashboardCustomerRiskAlerts();
    renderDashboardTopProducts();
    renderDashboardProfitProducts();
    renderDashboardCustomerLifecycle();
    renderDashboardCustomerRfm();
    renderDashboardSupplierPerformance();
    renderDashboardProcurementCycle();
    renderDashboardSupplierReconciliation();
    renderDashboardRestockRecommendations();
    renderDashboardInventoryCapital();
    renderDashboardGrossMarginAlerts();
    renderDashboardRiskApprovals();
}

// ==================== 单位转换 ====================
function printERPDiagnostics() {
    if (!ERP_VERBOSE_LOG) {
        return;
    }

    try {
        const inventory = getERPInventoryDiagnostics();
        erpDebugLog('info', '[ERP Debug] Diagnostics Snapshot', {
            location: window.location.href,
            isLoggedIn: !!(window.userData && userData.isLoggedIn),
            customersCount: (window.ERP && ERP.state?.customers?.length) || 0,
            productsCount: (window.ERP && ERP.state?.products?.length) || 0,
            ordersCount: (window.ERP && ERP.state?.orders?.length) || 0,
            financesCount: (window.ERP && ERP.state?.finances?.length) || 0,
            lowStockCount: inventory.lowStockCount,
            inventoryRows: inventory.rows
        });
    } catch (error) {
        console.error('[ERP Debug] printERPDiagnostics failed', error);
    }
}

async function refreshLowStockFromLatestData(reason = 'manual', options = {}) {
    if (!window.ERP) {
        return;
    }

    try {
        const forceReload = options === true || (typeof options === 'object' && options !== null && options.forceReload === true);
        if (forceReload && typeof ERP.loadProducts === 'function') {
            const latestProducts = await ERP.loadProducts({ lite: true, forceRefresh: true });
            if (Array.isArray(latestProducts)) {
                ERP.state.products = latestProducts;
            }
        }

        const diagnostics = getERPInventoryDiagnostics();
        renderLowStockSummary(diagnostics, diagnostics.lowStockCount);

        erpDebugLog('info', '[ERP Debug] low stock refreshed', {
            reason,
            lowStockCount: diagnostics.lowStockCount,
            productsCount: diagnostics.rows.length
        });
    } catch (error) {
        console.error('[ERP] 刷新库存预警失败:', error?.message || error);
    }
}

async function syncERPRealtimeData() {
    if (erpRealtimeSyncInProgress || typeof ERP === 'undefined' || !userData?.isLoggedIn) {
        return;
    }

    erpRealtimeSyncInProgress = true;
    try {
        await Promise.all([
            ERP.loadProducts({ lite: true, forceRefresh: true }),
            ERP.loadOrders(true),
            ERP.loadFinances(true)
        ]);

        updateStatistics();
        await refreshLowStockFromLatestData('realtime-sync');
        if (typeof renderHeaderNotices === 'function') {
            renderHeaderNotices();
        }
    } catch (error) {
        console.error('[ERP Ant] 实时同步失败:', error?.message || error);
    } finally {
        erpRealtimeSyncInProgress = false;
    }
}

function startERPRealtimeSync() {
    if (erpRealtimeSyncTimer) {
        return;
    }

    syncERPRealtimeData();
    erpRealtimeSyncTimer = setInterval(syncERPRealtimeData, 15000);
}

function stopERPRealtimeSync() {
    if (!erpRealtimeSyncTimer) {
        return;
    }
    clearInterval(erpRealtimeSyncTimer);
    erpRealtimeSyncTimer = null;
}

function getUnitText(unit) {
    const unitMap = {
        'piece': '个',
        'kg': '千克',
        'g': '克',
        'ton': '吨',
        'box': '盒',
        'set': '套',
        'pair': '双',
        'pack': '包',
        'bottle': '瓶',
        'bag': '袋',
        'liter': '升',
        'ml': '毫升',
        'meter': '米',
        'cm': '厘米',
        'mm': '毫米',
        'sheet': '张',
        'roll': '卷',
        'dozen': '打',
        'unit': '单位'
    };
    if (!unit || unit === '.' || unit === '-' || unit === '') {
        return '-';
    }
    return unitMap[unit] || '-';
}

// ==================== 客户管理 ====================
function showCustomerModal(customer = null) {
    const modal = document.getElementById('customerModal');
    if (!modal) {
        console.error('[ERP Ant] 找不到 customerModal 元素');
        return;
    }

    modal.classList.add('active');
    modal.style.display = 'flex';

    const title = document.getElementById('customerModalTitle');
    const form = document.getElementById('customerForm');

    if (customer) {
        title.textContent = '编辑客户';
        document.getElementById('customerId').value = customer.id;
        document.getElementById('customerName').value = customer.name;
        document.getElementById('customerContactPerson').value = customer.contact_person || '';
        document.getElementById('customerPhone').value = customer.phone || '';
        document.getElementById('customerEmail').value = customer.email || '';
        document.getElementById('customerAddress').value = customer.address || '';
        document.getElementById('customerNotes').value = customer.notes || '';

        const statusSelect = document.getElementById('customerStatus');
        const validStatus = customer.status && statusSelect.querySelector(`option[value="${customer.status}"]`);
        statusSelect.value = validStatus ? customer.status : 'active';
    } else {
        title.textContent = '添加客户';
        form.reset();
        document.getElementById('customerId').value = '';
        document.getElementById('customerStatus').value = 'active';
    }

    modal.classList.add('active');
    modal.style.display = 'flex';
}

function hideCustomerModal() {
    const modal = document.getElementById('customerModal');
    modal.classList.remove('active');
    modal.style.display = '';
}

async function saveCustomer() {
    const customerId = document.getElementById('customerId').value;
    const customerData = {
        name: document.getElementById('customerName').value,
        contact_person: document.getElementById('customerContactPerson').value,
        phone: document.getElementById('customerPhone').value,
        email: document.getElementById('customerEmail').value,
        address: document.getElementById('customerAddress').value,
        notes: document.getElementById('customerNotes').value,
        status: document.getElementById('customerStatus').value
    };

    if (!customerData.name) {
        alert('请输入客户名称');
        return;
    }

    const saveBtn = document.querySelector('#customerModal .ant-btn-primary');
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = '保存中...';

    try {
        let result;
        if (customerId) {
            result = await ERP.updateCustomer(normalizeEntityId(customerId), customerData);
        } else {
            // 先关闭模态框，然后异步保存
            hideCustomerModal();
            
            // 保存到数据库
            result = await ERP.addCustomer(customerData);
            erpDebugLog('info', '[ERP Ant] 客户已保存: ', result);
            
            if (result) {
                // 重新加载数据并更新显示
                const customers = await ERP.loadCustomers({ forceRefresh: true });
                erpDebugLog('info', '[ERP Ant] 重新加载客户数据条数: ', customers.length);
                renderCustomers(customers);
                updateStatistics();
                
                if (typeof showToast === 'function') {
                    showToast('客户保存成功', 'success');
                }
            }
        }

        if (result && customerId) {
            // 客户更新成功
            hideCustomerModal();
            
            // 重新加载数据并更新显示
            const customers = await ERP.loadCustomers({ forceRefresh: true });
            erpDebugLog('info', '[ERP Ant] 重新加载客户数据条数: ', customers.length);
            renderCustomers(customers);
            updateStatistics();
            
            if (typeof showToast === 'function') {
                showToast('客户更新成功', 'success');
            }
        }
    } catch (error) {
        console.error('[ERP Ant] 保存客户失败:', error);
        alert('保存失败：' + (error.message || '网络错误，请检查连接'));
        // 如果是创建客户失败，需要重新加载数据
        if (!customerId) {
            await ERP.loadCustomers();
            renderCustomers();
            updateStatistics();
        }
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
}

async function editCustomer(customerId) {
    let customer = ERP.state.customers.find(c => isSameEntityId(c.id, customerId));

    const hasFullProfile = !!(customer && (
        Object.prototype.hasOwnProperty.call(customer, 'contact_person') ||
        Object.prototype.hasOwnProperty.call(customer, 'phone') ||
        Object.prototype.hasOwnProperty.call(customer, 'email') ||
        Object.prototype.hasOwnProperty.call(customer, 'address') ||
        Object.prototype.hasOwnProperty.call(customer, 'notes')
    ));

    if (!hasFullProfile) {
        const customers = await ERP.loadCustomers({ forceRefresh: true });
        customer = customers.find(c => isSameEntityId(c.id, customerId));
    }

    if (customer) {
        showCustomerModal(customer);
    }
}

async function deleteCustomer(customerId) {
    erpDebugLog('info', '[ERP Ant] 删除客户请求: customerId=', customerId);
    if (!confirm('确定要删除这个客户吗？')) {
        return;
    }

    try {
        erpDebugLog('info', '[ERP Ant] 删除客户已提交到后端: ', customerId);
        await ERP.deleteCustomer(customerId);
        erpDebugLog('info', '[ERP Ant] 重新加载客户数据...');
        const customers = await ERP.loadCustomers({ forceRefresh: true });
        erpDebugLog('info', '[ERP Ant] 重新加载客户数据条数: ', customers.length);
        
        if (typeof renderCustomers === 'function') {
            erpDebugLog('info', '[ERP Ant] renderCustomers 函数存在，正在调用...');
            renderCustomers(customers);
            erpDebugLog('info', '[ERP Ant] renderCustomers 调用完成');
        } else {
            console.error('[ERP Ant] renderCustomers 函数不存在！');
        }
        
        updateStatistics();
        
        if (typeof showToast === 'function') {
            showToast('客户删除成功', 'success');
        }
    } catch (error) {
        console.error('[ERP Ant] 删除客户失败:', error);
        if (typeof showToast === 'function') {
            showToast('删除失败：' + (error.message || '网络错误，请检查连接'), 'error');
        }
        
        // 重新加载数据
        const customers = await ERP.loadCustomers({ forceRefresh: true });
        if (typeof renderCustomers === 'function') {
            renderCustomers(customers);
        }
        updateStatistics();
    }
}

function searchCustomers() {
    const keyword = document.getElementById('customerSearch').value.toLowerCase();
    const filtered = ERP.state.customers.filter(customer =>
        customer.name.toLowerCase().includes(keyword) ||
        (customer.contact_person && customer.contact_person.toLowerCase().includes(keyword)) ||
        (customer.phone && customer.phone.includes(keyword)) ||
        (customer.email && customer.email.toLowerCase().includes(keyword))
    );
    renderCustomers(filtered);
}

// ==================== 产品管理 ====================
function showProductModal(product = null) {
    const modal = document.getElementById('productModal');
    if (!modal) {
        console.error('[ERP Ant] 找不到 productModal 元素');
        return;
    }

    modal.classList.add('active');
    modal.style.display = 'flex';

    const title = document.getElementById('productModalTitle');
    const form = document.getElementById('productForm');

    if (product) {
        title.textContent = '编辑产品';
        document.getElementById('productId').value = product.id;
        document.getElementById('productName').value = product.name;
        document.getElementById('productSku').value = product.sku || '';
        document.getElementById('productCategory').value = product.category || '';
        document.getElementById('productDescription').value = product.description || '';
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productCost').value = product.cost || '';
        document.getElementById('productStockQuantity').value = product.stock_quantity || '';
        document.getElementById('productMinStock').value = product.min_stock || '';

        // 设置单位值
        document.getElementById('productUnit').value = product.unit || '';

        const statusSelect = document.getElementById('productStatus');
        const validStatus = product.status && statusSelect.querySelector(`option[value="${product.status}"]`);
        statusSelect.value = validStatus ? product.status : 'active';
    } else {
        title.textContent = '添加产品';
        form.reset();
        document.getElementById('productId').value = '';
        document.getElementById('productUnit').value = '个';
        document.getElementById('productStatus').value = 'active';
    }

    modal.classList.add('active');
    modal.style.display = 'flex';
}

function hideProductModal() {
    const modal = document.getElementById('productModal');
    modal.classList.remove('active');
    modal.style.display = '';
}

async function saveProduct() {
    const productId = document.getElementById('productId').value;
    const productData = {
        name: document.getElementById('productName').value,
        sku: document.getElementById('productSku').value,
        category: document.getElementById('productCategory').value,
        description: document.getElementById('productDescription').value,
        price: document.getElementById('productPrice').value,
        cost: document.getElementById('productCost').value,
        stock_quantity: document.getElementById('productStockQuantity').value,
        min_stock: document.getElementById('productMinStock').value,
        unit: document.getElementById('productUnit').value,
        status: document.getElementById('productStatus').value
    };

    if (!productData.name || !productData.price) {
        alert('请输入产品名称和售价');
        return;
    }

    const saveBtn = document.querySelector('#productModal .ant-btn-primary');
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = '保存中...';

    try {
        let result;
        if (productId) {
            result = await ERP.updateProduct(normalizeEntityId(productId), productData);
        } else {
            // 先关闭模态框，然后异步保存
            hideProductModal();
            
            // 保存到数据库
            result = await ERP.addProduct(productData);
            erpDebugLog('info', '[ERP Ant] 产品已保存: ', result);
            
            if (result) {
                // 重新加载数据并更新显示
                const products = await ERP.loadProducts(true);
                erpDebugLog('info', '[ERP Ant] 重新加载产品数据条数: ', products.length);
                renderProducts(products);
                updateStatistics();
                
                if (typeof showToast === 'function') {
                    showToast('产品保存成功', 'success');
                }
            }
        }

        if (result && productId) {
            // 产品更新成功
            hideProductModal();
            
            // 重新加载数据并更新显示
            const products = await ERP.loadProducts(true);
            erpDebugLog('info', '[ERP Ant] 重新加载产品数据条数: ', products.length);
            renderProducts(products);
            updateStatistics();
            
            if (typeof showToast === 'function') {
                showToast('产品更新成功', 'success');
            }
        }
    } catch (error) {
        console.error('[ERP Ant] 保存产品失败:', error);
        alert('保存失败：' + (error.message || '网络错误，请检查连接'));
        // 如果是创建产品失败，需要重新加载数据
        if (!productId) {
            const products = await ERP.loadProducts(true);
            renderProducts(products);
            updateStatistics();
        }
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
}

async function editProduct(productId) {
    const product = ERP.state.products.find(p => isSameEntityId(p.id, productId));
    if (product) {
        showProductModal(product);
    }
}

async function deleteProduct(productId) {
    if (!confirm('确定要删除这个产品吗？')) {
        return;
    }

    try {
        erpDebugLog('info', '[ERP Ant] 删除产品已提交到后端: ', productId);
        await ERP.deleteProduct(productId);
        erpDebugLog('info', '[ERP Ant] 重新加载产品数据...');
        const products = await ERP.loadProducts(true);
        erpDebugLog('info', '[ERP Ant] 重新加载产品数据条数: ', products.length);
        
        if (typeof renderProducts === 'function') {
            erpDebugLog('info', '[ERP Ant] renderProducts 函数存在，正在调用...');
            renderProducts(products);
            erpDebugLog('info', '[ERP Ant] renderProducts 调用完成');
        } else {
            console.error('[ERP Ant] renderProducts 函数不存在！');
        }
        
        updateStatistics();
        
        if (typeof showToast === 'function') {
            showToast('产品删除成功', 'success');
        }
    } catch (error) {
        console.error('[ERP Ant] 删除产品失败:', error);
        if (typeof showToast === 'function') {
            showToast('删除失败：' + (error.message || '网络错误，请检查连接'), 'error');
        }
        
        // 重新加载数据
        const products = await ERP.loadProducts(true);
        if (typeof renderProducts === 'function') {
            renderProducts(products);
        }
        updateStatistics();
    }
}

function searchProducts() {
    const keyword = document.getElementById('productSearch').value.toLowerCase();
    const filtered = ERP.state.products.filter(product =>
        product.name.toLowerCase().includes(keyword) ||
        (product.sku && product.sku.toLowerCase().includes(keyword)) ||
        (product.category && product.category.toLowerCase().includes(keyword))
    );
    renderProducts(filtered);
}

// ==================== 订单管理 ====================
const ERP_LOGISTICS_STATE = {
    cache: new Map()
};

const ERP_ORDER_STATUS_META = {
    pending: { text: '待处理' },
    confirmed: { text: '已确认' },
    shipped: { text: '已发货' },
    signed: { text: '已签收' },
    completed: { text: '已完成' },
    refunded: { text: '已退款' },
    cancelled: { text: '已取消' }
};

const ERP_ORDER_STATUS_TRANSITIONS = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['shipped', 'cancelled'],
    shipped: ['signed', 'refunded'],
    signed: ['completed', 'refunded'],
    completed: [],
    refunded: [],
    cancelled: []
};

function normalizeOrderStatusValue(status) {
    const raw = String(status || '').trim().toLowerCase();
    const legacyMap = {
        processing: 'confirmed'
    };
    const normalized = legacyMap[raw] || raw || 'pending';
    return ERP_ORDER_STATUS_META[normalized] ? normalized : 'pending';
}

function getOrderStatusTextByValue(status) {
    const normalized = normalizeOrderStatusValue(status);
    return ERP_ORDER_STATUS_META[normalized]?.text || '待处理';
}

function refreshOrderStatusOptions(currentStatus, isCreateMode = false) {
    const statusSelect = document.getElementById('orderStatus');
    if (!statusSelect) {
        return;
    }

    const normalizedCurrent = normalizeOrderStatusValue(currentStatus);
    const nextStatuses = ERP_ORDER_STATUS_TRANSITIONS[normalizedCurrent] || [];
    const optionStatuses = isCreateMode
        ? ['pending', 'confirmed']
        : [normalizedCurrent, ...nextStatuses];
    const uniqueStatuses = [...new Set(optionStatuses)];

    statusSelect.innerHTML = uniqueStatuses.map(status => (
        `<option value="${status}">${ERP_ORDER_STATUS_META[status]?.text || status}</option>`
    )).join('');
    statusSelect.value = normalizedCurrent;
}

function normalizeTrackingNumber(rawValue) {
    return String(rawValue || '').trim().replace(/\s+/g, '');
}

function escapeHtmlText(rawValue) {
    return String(rawValue ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function setOrderLogisticsStatus(message, isError = false) {
    const statusEl = document.getElementById('orderLogisticsStatus');
    if (!statusEl) {
        return;
    }
    statusEl.textContent = message || '';
    statusEl.classList.toggle('error', !!isError);
}

function getCarrierFallbackLetter(name) {
    const text = String(name || '').trim();
    if (!text) {
        return '物';
    }
    return text.slice(0, 1).toUpperCase();
}

function renderOrderLogisticsCarrierCard(result = null) {
    const cardEl = document.getElementById('orderLogisticsCarrierCard');
    const logoEl = document.getElementById('orderLogisticsCarrierLogo');
    const fallbackEl = document.getElementById('orderLogisticsCarrierFallback');
    const nameEl = document.getElementById('orderLogisticsCarrierName');
    const metaEl = document.getElementById('orderLogisticsCarrierMeta');

    if (!cardEl || !logoEl || !fallbackEl || !nameEl || !metaEl) {
        return;
    }

    const providerName = String(result?.providerName || '').trim();
    if (!providerName) {
        cardEl.classList.add('is-empty');
        logoEl.style.display = 'none';
        logoEl.removeAttribute('src');
        fallbackEl.style.display = 'inline-flex';
        fallbackEl.textContent = '物';
        nameEl.textContent = '物流公司';
        metaEl.textContent = '中国 · 无电话';
        return;
    }

    const countryText = String(result?.providerCountryText || '中国');
    const phoneText = String(result?.providerPhone || '').trim() || '无电话';
    const logoUrlPrimary = String(result?.providerLogoUrl || '').trim();
    const logoUrlFallback = String(result?.providerLogoFallbackUrl || '').trim();

    cardEl.classList.remove('is-empty');
    nameEl.textContent = providerName;
    metaEl.textContent = `${countryText} · ${phoneText}`;
    fallbackEl.textContent = getCarrierFallbackLetter(providerName);

    if (!logoUrlPrimary && !logoUrlFallback) {
        logoEl.style.display = 'none';
        logoEl.removeAttribute('src');
        fallbackEl.style.display = 'inline-flex';
        return;
    }

    logoEl.style.display = 'block';
    fallbackEl.style.display = 'none';
    logoEl.onerror = function () {
        if (logoUrlFallback && logoEl.src !== logoUrlFallback) {
            logoEl.src = logoUrlFallback;
            return;
        }
        logoEl.style.display = 'none';
        fallbackEl.style.display = 'inline-flex';
    };
    logoEl.src = logoUrlPrimary || logoUrlFallback;
}

function renderOrderLogisticsTimeline(events = []) {
    const timelineEl = document.getElementById('orderLogisticsTimeline');
    if (!timelineEl) {
        return;
    }

    if (!Array.isArray(events) || events.length === 0) {
        timelineEl.innerHTML = '<div class="order-logistics-empty">暂无物流轨迹</div>';
        return;
    }

    timelineEl.innerHTML = events.map((event, index) => {
        const timeText = escapeHtmlText(event?.time || '-');
        const rawDisplayText = String(event?.displayText || '').trim();
        const statusText = String(event?.status || '').trim();
        const descText = String(event?.description || '').trim();
        const locationText = String(event?.location || '').trim();
        const fallbackText = [statusText, descText, locationText].filter(Boolean).join(' ｜ ');
        const displayText = escapeHtmlText(rawDisplayText || fallbackText || '状态更新');
        const itemClass = index === 0 ? 'order-logistics-item is-latest' : 'order-logistics-item';
        return `
            <div class="${itemClass}">
                <span class="order-logistics-node"></span>
                <div class="order-logistics-content">
                    <div class="order-logistics-main">${displayText}</div>
                    <div class="order-logistics-time">${timeText}</div>
                </div>
            </div>
        `;
    }).join('');

    timelineEl.scrollTop = 0;
}

function resetOrderLogisticsPanel() {
    renderOrderLogisticsCarrierCard(null);
    setOrderLogisticsStatus('填写快递单号后可查询实时轨迹');
    renderOrderLogisticsTimeline([]);
}

function getOrderShippingCompanyFromForm() {
    const companySelect = document.getElementById('orderShippingCompany');
    const otherInput = document.getElementById('orderOtherShippingCompany');
    if (!companySelect) {
        return '';
    }
    if (companySelect.value === '其他') {
        return String(otherInput?.value || '').trim();
    }
    return String(companySelect.value || '').trim();
}

function updateOrderTrackingParamHint() {
    const trackingParamGroup = document.getElementById('orderTrackingParamGroup');
    const trackingParamInput = document.getElementById('orderTrackingParam');
    const trackingParamHint = document.getElementById('orderTrackingParamHint');
    if (!trackingParamGroup || !trackingParamInput || !trackingParamHint) {
        return;
    }

    const shippingCompany = getOrderShippingCompanyFromForm();
    const companyText = String(shippingCompany || '').trim();
    const isSfExpress = ['顺丰', '顺丰快递', '顺丰速运'].includes(companyText);

    if (isSfExpress) {
        trackingParamGroup.style.display = '';
        trackingParamInput.placeholder = '顺丰：请输入收件人手机号后4位';
        trackingParamHint.textContent = '提示：顺丰常需校验参数（手机号后4位），填后查询更稳定。';
        return;
    }

    trackingParamGroup.style.display = 'none';
    trackingParamInput.value = '';
}

async function requestOrderLogistics(trackingNumber, shippingCompany = '', options = {}) {
    const normalizedTracking = normalizeTrackingNumber(trackingNumber);
    const normalizedCompany = String(shippingCompany || '').trim();
    const normalizedParam = String(options?.param || '').trim();
    const forceRefresh = options?.forceRefresh === true;
    const cacheKey = `${normalizedTracking}|${normalizedCompany}|${normalizedParam}`;

    if (!forceRefresh && ERP_LOGISTICS_STATE.cache.has(cacheKey)) {
        return ERP_LOGISTICS_STATE.cache.get(cacheKey);
    }

    if (!window.supabaseClient || !window.supabaseClient.functions || typeof window.supabaseClient.functions.invoke !== 'function') {
        throw new Error('未检测到 Supabase Functions 客户端，请刷新页面后重试');
    }

    const { data, error } = await window.supabaseClient.functions.invoke('logistics-track', {
        body: {
            trackingNumber: normalizedTracking,
            shippingCompany: normalizedCompany,
            param: normalizedParam
        }
    });

    if (error) {
        let errorMessage = String(error?.message || '物流查询服务调用失败');
        const context = error?.context;
        if (context && typeof context.json === 'function') {
            try {
                const payload = await context.json();
                const serverMessage = payload?.message || payload?.error || payload?.msg;
                if (serverMessage) {
                    errorMessage = String(serverMessage);
                }
            } catch (contextParseError) {
                const fallbackMessage = String(contextParseError?.message || '');
                if (fallbackMessage) {
                    errorMessage = `${errorMessage}（${fallbackMessage}）`;
                }
            }
        }
        throw new Error(errorMessage);
    }

    if (!data || data.ok !== true) {
        throw new Error(data?.message || '物流查询失败');
    }

    ERP_LOGISTICS_STATE.cache.set(cacheKey, data);
    return data;
}

async function queryOrderLogisticsByForm(options = {}) {
    const trackingInput = document.getElementById('orderTrackingNumber');
    const trackingParamInput = document.getElementById('orderTrackingParam');
    const queryBtn = document.getElementById('orderTrackingQueryBtn');

    if (!trackingInput) {
        return;
    }

    const trackingNumber = normalizeTrackingNumber(trackingInput.value);
    const silentWhenEmpty = options?.silentWhenEmpty === true;
    const forceRefresh = options?.forceRefresh === true;
    const silentError = options?.silentError === true;

    if (!trackingNumber) {
        resetOrderLogisticsPanel();
        if (!silentWhenEmpty && typeof showToast === 'function') {
            showToast('请先填写快递单号', 'warning');
        }
        return;
    }

    const shippingCompany = getOrderShippingCompanyFromForm();
    const trackingParam = String(trackingParamInput?.value || '').trim();
    const originalBtnText = queryBtn ? queryBtn.textContent : '';

    if (queryBtn) {
        queryBtn.disabled = true;
        queryBtn.textContent = '查询中...';
    }
    setOrderLogisticsStatus('正在查询物流轨迹...');

    try {
        const result = await requestOrderLogistics(trackingNumber, shippingCompany, { forceRefresh, param: trackingParam });
        const timeline = Array.isArray(result.timeline) ? result.timeline : [];
        renderOrderLogisticsCarrierCard(result);
        renderOrderLogisticsTimeline(timeline);

        const latestStatusText = String(result.latestStatusText || result.latestStatusCode || '已同步');
        const providerText = String(result.providerName || '17TRACK');
        setOrderLogisticsStatus(`最新状态：${latestStatusText}（${providerText}）`);
    } catch (error) {
        const message = String(error?.message || error || '物流查询失败');
        renderOrderLogisticsCarrierCard(null);
        setOrderLogisticsStatus(`物流查询失败：${message}`, true);
        renderOrderLogisticsTimeline([]);
        if (!silentError && typeof showToast === 'function') {
            showToast(`物流查询失败：${message}`, 'error');
        }
    } finally {
        if (queryBtn) {
            queryBtn.disabled = false;
            queryBtn.textContent = originalBtnText || '查询轨迹';
        }
    }
}

if (typeof window !== 'undefined') {
    window.queryOrderLogisticsByForm = queryOrderLogisticsByForm;
}

const ORDER_RISK_RULES = {
    highAmount: 20000,
    highDiscountRate: 0.3,
    lowMarginRate: 0.12,
    lowMarginAmountFloor: 8000
};
let orderRiskConfigCache = null;

function getOrderRiskConfigStorageKey() {
    const userId = String(userData?.user?.id || 'guest').trim() || 'guest';
    return `erp_order_risk_config_${userId}`;
}

function normalizeOrderRiskConfig(rawConfig = {}) {
    const parseAmount = (value, fallback) => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return fallback;
        }
        return parsed;
    };
    const parseRate = (value, fallback) => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return fallback;
        }
        if (parsed > 1) {
            return Math.min(parsed / 100, 1);
        }
        return Math.min(parsed, 1);
    };

    return {
        highAmount: parseAmount(rawConfig?.highAmount, ORDER_RISK_RULES.highAmount),
        highDiscountRate: parseRate(rawConfig?.highDiscountRate, ORDER_RISK_RULES.highDiscountRate),
        lowMarginRate: parseRate(rawConfig?.lowMarginRate, ORDER_RISK_RULES.lowMarginRate),
        lowMarginAmountFloor: parseAmount(rawConfig?.lowMarginAmountFloor, ORDER_RISK_RULES.lowMarginAmountFloor)
    };
}

function loadOrderRiskConfig(force = false) {
    if (!force && orderRiskConfigCache) {
        return orderRiskConfigCache;
    }

    try {
        const key = getOrderRiskConfigStorageKey();
        const raw = localStorage.getItem(key);
        if (!raw) {
            orderRiskConfigCache = normalizeOrderRiskConfig({});
            return orderRiskConfigCache;
        }
        const parsed = JSON.parse(raw);
        orderRiskConfigCache = normalizeOrderRiskConfig(parsed);
        return orderRiskConfigCache;
    } catch (error) {
        console.error('[ERP] 加载订单风控配置失败:', error?.message || error);
        orderRiskConfigCache = normalizeOrderRiskConfig({});
        return orderRiskConfigCache;
    }
}

function saveOrderRiskConfig(config = {}) {
    const normalized = normalizeOrderRiskConfig(config);
    orderRiskConfigCache = normalized;
    try {
        localStorage.setItem(getOrderRiskConfigStorageKey(), JSON.stringify(normalized));
    } catch (error) {
        console.error('[ERP] 保存订单风控配置失败:', error?.message || error);
    }
    return normalized;
}

function resetOrderRiskConfigToDefault() {
    const normalized = saveOrderRiskConfig({
        highAmount: ORDER_RISK_RULES.highAmount,
        highDiscountRate: ORDER_RISK_RULES.highDiscountRate,
        lowMarginRate: ORDER_RISK_RULES.lowMarginRate,
        lowMarginAmountFloor: ORDER_RISK_RULES.lowMarginAmountFloor
    });
    syncOrderRiskConfigInputs(normalized);
    refreshOrderRiskPreview();
}

function syncOrderRiskConfigInputs(config = loadOrderRiskConfig()) {
    const amountInput = document.getElementById('orderRiskAmountThreshold');
    const discountInput = document.getElementById('orderRiskDiscountThreshold');
    const marginInput = document.getElementById('orderRiskMarginThreshold');
    const floorInput = document.getElementById('orderRiskLowMarginAmountFloor');

    if (amountInput) amountInput.value = Number(config.highAmount || ORDER_RISK_RULES.highAmount).toFixed(0);
    if (discountInput) discountInput.value = (Number(config.highDiscountRate || ORDER_RISK_RULES.highDiscountRate) * 100).toFixed(1);
    if (marginInput) marginInput.value = (Number(config.lowMarginRate || ORDER_RISK_RULES.lowMarginRate) * 100).toFixed(1);
    if (floorInput) floorInput.value = Number(config.lowMarginAmountFloor || ORDER_RISK_RULES.lowMarginAmountFloor).toFixed(0);
}

function readOrderRiskConfigFromInputs() {
    const amountInput = document.getElementById('orderRiskAmountThreshold');
    const discountInput = document.getElementById('orderRiskDiscountThreshold');
    const marginInput = document.getElementById('orderRiskMarginThreshold');
    const floorInput = document.getElementById('orderRiskLowMarginAmountFloor');

    return normalizeOrderRiskConfig({
        highAmount: amountInput?.value,
        highDiscountRate: discountInput?.value,
        lowMarginRate: marginInput?.value,
        lowMarginAmountFloor: floorInput?.value
    });
}

function onOrderRiskConfigInputChange() {
    const config = saveOrderRiskConfig(readOrderRiskConfigFromInputs());
    syncOrderRiskConfigInputs(config);
    refreshOrderRiskPreview();
}

function getOrderRiskProductMap() {
    const products = Array.isArray(ERP.state?.products) ? ERP.state.products : [];
    return new Map(products.map(item => [String(item?.id), item]));
}

function buildOrderRiskAnalysis(orderItems = [], manualTotalAmount = 0) {
    const riskConfig = loadOrderRiskConfig();
    const safeItems = Array.isArray(orderItems) ? orderItems : [];
    const productMap = getOrderRiskProductMap();
    const summary = {
        itemCount: safeItems.length,
        suggestedTotal: 0,
        effectiveTotal: 0,
        totalCost: 0,
        grossProfit: 0,
        grossMargin: 0,
        heavyDiscountItems: [],
        alerts: [],
        riskRank: 0,
        needsSecondConfirm: false
    };

    const resolveItemValue = (item, keyA, keyB = null) => {
        if (item == null || typeof item !== 'object') {
            return undefined;
        }
        if (Object.prototype.hasOwnProperty.call(item, keyA)) {
            return item[keyA];
        }
        if (keyB && Object.prototype.hasOwnProperty.call(item, keyB)) {
            return item[keyB];
        }
        return undefined;
    };

    safeItems.forEach(item => {
        const rawProductId = resolveItemValue(item, 'product_id', 'productId');
        const productId = rawProductId === null || rawProductId === undefined ? '' : String(rawProductId);
        const product = productMap.get(productId) || null;
        const quantity = Math.max(Number(resolveItemValue(item, 'quantity')) || 0, 0);
        const unitPrice = Math.max(Number(resolveItemValue(item, 'unit_price', 'unitPrice')) || 0, 0);
        const listPrice = Math.max(Number(product?.price || unitPrice || 0), 0);
        const unitCost = Math.max(Number(product?.cost || resolveItemValue(item, 'unit_cost', 'unitCost') || 0), 0);
        const lineRevenue = quantity * unitPrice;
        const lineCost = quantity * unitCost;
        const discountRate = listPrice > 0 ? Math.max((listPrice - unitPrice) / listPrice, 0) : 0;

        summary.suggestedTotal += lineRevenue;
        summary.totalCost += lineCost;

        if (discountRate >= riskConfig.highDiscountRate) {
            summary.heavyDiscountItems.push({
                productName: String(resolveItemValue(item, 'product_name', 'productName') || product?.name || `商品#${productId || '-'}`),
                discountRate,
                unitPrice,
                listPrice
            });
        }
    });

    const parsedManualTotal = Number(manualTotalAmount);
    const hasManualTotal = Number.isFinite(parsedManualTotal) && parsedManualTotal > 0;
    summary.effectiveTotal = hasManualTotal ? parsedManualTotal : summary.suggestedTotal;
    summary.grossProfit = summary.effectiveTotal - summary.totalCost;
    summary.grossMargin = summary.effectiveTotal > 0 ? (summary.grossProfit / summary.effectiveTotal) : 0;

    if (summary.effectiveTotal >= riskConfig.highAmount) {
        summary.alerts.push({
            rank: 2,
            title: '超金额订单',
            detail: `订单金额 ${formatCurrency(summary.effectiveTotal)}，超过阈值 ${formatCurrency(riskConfig.highAmount)}`
        });
    }

    if (summary.heavyDiscountItems.length > 0) {
        const topDiscount = summary.heavyDiscountItems
            .slice()
            .sort((left, right) => Number(right.discountRate || 0) - Number(left.discountRate || 0))[0];
        summary.alerts.push({
            rank: 2,
            title: '超折扣风险',
            detail: `${topDiscount?.productName || '商品'} 折扣 ${((topDiscount?.discountRate || 0) * 100).toFixed(1)}%，超过 ${(riskConfig.highDiscountRate * 100).toFixed(1)}%`
        });
    }

    if (summary.grossProfit < 0) {
        summary.alerts.push({
            rank: 3,
            title: '异常毛利',
            detail: `订单毛利为负值 ${formatCurrency(summary.grossProfit)}`
        });
    } else if (
        summary.effectiveTotal >= riskConfig.lowMarginAmountFloor
        && summary.grossMargin < riskConfig.lowMarginRate
    ) {
        summary.alerts.push({
            rank: 2,
            title: '低毛利风险',
            detail: `毛利率 ${(summary.grossMargin * 100).toFixed(1)}%，低于 ${(riskConfig.lowMarginRate * 100).toFixed(1)}%`
        });
    }

    summary.riskRank = summary.alerts.reduce((maxRank, alert) => Math.max(maxRank, Number(alert?.rank || 0)), 0);
    summary.needsSecondConfirm = summary.alerts.length > 0;
    return summary;
}

function renderOrderRiskPanel(analysis = null) {
    const panel = document.getElementById('orderRiskPanel');
    if (!panel) {
        return;
    }

    const safeAnalysis = analysis || {
        itemCount: 0,
        suggestedTotal: 0,
        effectiveTotal: 0,
        totalCost: 0,
        grossProfit: 0,
        grossMargin: 0,
        alerts: [],
        riskRank: 0
    };
    const approvalGroup = document.getElementById('orderRiskApprovalGroup');
    if (approvalGroup) {
        approvalGroup.style.display = safeAnalysis.riskRank >= 3 ? 'block' : 'none';
    }

    if (!safeAnalysis.itemCount) {
        panel.style.display = 'block';
        panel.style.borderColor = '#d9d9d9';
        panel.style.background = '#fafafa';
        panel.innerHTML = '<div style="font-size:12px;color:#8c8c8c;">风控提示：添加商品后自动分析超金额、超折扣、异常毛利。</div>';
        if (approvalGroup) {
            approvalGroup.style.display = 'none';
        }
        return;
    }

    const tone = safeAnalysis.riskRank >= 3
        ? { border: '#ff7875', bg: '#fff1f0', title: '#cf1322' }
        : (safeAnalysis.riskRank >= 2
            ? { border: '#ffd591', bg: '#fff7e6', title: '#d46b08' }
            : { border: '#b7eb8f', bg: '#f6ffed', title: '#237804' });

    const alertHtml = (Array.isArray(safeAnalysis.alerts) ? safeAnalysis.alerts : []).map(alert => `
        <div style="font-size:12px;color:${tone.title};margin-top:4px;">• ${alert.title}：${alert.detail}</div>
    `).join('');

    panel.style.display = 'block';
    panel.style.borderColor = tone.border;
    panel.style.background = tone.bg;
    panel.innerHTML = `
        <div style="font-size:12px;color:#595959;">建议价 ${formatCurrency(safeAnalysis.suggestedTotal)} / 当前总额 ${formatCurrency(safeAnalysis.effectiveTotal)} / 成本 ${formatCurrency(safeAnalysis.totalCost)}</div>
        <div style="font-size:12px;color:#595959;margin-top:2px;">毛利 ${formatCurrency(safeAnalysis.grossProfit)} / 毛利率 ${(safeAnalysis.grossMargin * 100).toFixed(1)}%</div>
        ${alertHtml || '<div style="font-size:12px;color:#237804;margin-top:4px;">当前未发现显著风险，可直接保存。</div>'}
    `;
}

function refreshOrderRiskPreview() {
    const riskConfig = loadOrderRiskConfig();
    const orderItems = getOrderItems();
    const totalAmountInput = document.getElementById('orderTotalAmount');
    const manualTotal = Number(totalAmountInput?.value || 0);
    const analysis = buildOrderRiskAnalysis(orderItems.map(item => ({
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: item.unitPrice
    })), manualTotal);
    renderOrderRiskPanel(analysis);

    const productMap = getOrderRiskProductMap();
    const rows = document.querySelectorAll('#orderItems .order-item');
    rows.forEach(row => {
        const select = row.querySelector('.product-select');
        const priceInput = row.querySelector('.item-unit-price');
        const productId = String(select?.value || '');
        const product = productMap.get(productId) || null;
        const listPrice = Math.max(Number(product?.price || select?.selectedOptions?.[0]?.dataset?.price || 0), 0);
        const unitPrice = Math.max(Number(priceInput?.value || 0), 0);
        const discountRate = listPrice > 0 ? Math.max((listPrice - unitPrice) / listPrice, 0) : 0;
        if (discountRate >= riskConfig.highDiscountRate) {
            row.style.border = '1px dashed #ff7875';
            row.style.background = '#fff1f0';
        } else {
            row.style.border = '1px dashed #d9d9d9';
            row.style.background = '#fff';
        }
    });
    return analysis;
}

function confirmOrderRiskBeforeSave(analysis) {
    const safeAnalysis = analysis || buildOrderRiskAnalysis([], 0);
    if (!safeAnalysis.needsSecondConfirm) {
        return true;
    }

    const alertLines = safeAnalysis.alerts.map(alert => `- ${alert.title}：${alert.detail}`).join('\n');
    const message = [
        '检测到订单风险，请二次确认：',
        alertLines,
        `毛利：${formatCurrency(safeAnalysis.grossProfit)}（${(safeAnalysis.grossMargin * 100).toFixed(1)}%）`,
        safeAnalysis.riskRank >= 3 ? '该订单为高风险，需填写审批原因。' : '',
        '确定继续保存吗？'
    ].join('\n');
    return confirm(message);
}

function showOrderModal(order = null) {
    const modal = document.getElementById('orderModal');
    if (!modal) {
        console.error('[ERP Ant] 找不到 orderModal 元素');
        return;
    }

    modal.classList.add('active');
    modal.style.display = 'flex';

    const title = document.getElementById('orderModalTitle');
    const form = document.getElementById('orderForm');
    const customerSelect = document.getElementById('orderCustomer');
    syncOrderRiskConfigInputs(loadOrderRiskConfig());

    // 加载客户列表
    customerSelect.innerHTML = '<option value="">请选择客户</option>' +
        ERP.state.customers.map(customer =>
            `<option value="${customer.id}">${customer.name}</option>`
        ).join('');

    if (order) {
        title.textContent = '编辑订单';
        document.getElementById('orderId').value = order.id;
        customerSelect.value = order.customer_id;
        document.getElementById('orderNotes').value = String(order.notes || '')
            .split('\n')
            .filter(line => !String(line || '').trim().startsWith('[风控审批]'))
            .join('\n')
            .trim();
        const riskReasonInput = document.getElementById('orderRiskApprovalReason');
        if (riskReasonInput) {
            const matched = String(order.notes || '').match(/\[风控审批\]\s*(.*)/);
            riskReasonInput.value = matched ? String(matched[1] || '').trim() : '';
        }

        const currentStatus = normalizeOrderStatusValue(order.status || 'pending');
        refreshOrderStatusOptions(currentStatus, false);

        const paymentStatusSelect = document.getElementById('orderPaymentStatus');
        const validPaymentStatus = order.payment_status && paymentStatusSelect.querySelector(`option[value="${order.payment_status}"]`);
        paymentStatusSelect.value = validPaymentStatus ? order.payment_status : 'unpaid';

        // 物流信息
        const shippingCompany = order.shipping_company || '';
        document.getElementById('orderShippingCompany').value = shippingCompany;
        document.getElementById('orderTrackingNumber').value = order.tracking_number || '';
        const trackingParamInput = document.getElementById('orderTrackingParam');
        if (trackingParamInput) {
            trackingParamInput.value = '';
        }

        // 发货状态
        const shippingStatusSelect = document.getElementById('orderShippingStatus');
        const validShippingStatus = order.shipping_status && shippingStatusSelect.querySelector(`option[value="${order.shipping_status}"]`);
        shippingStatusSelect.value = validShippingStatus ? order.shipping_status : 'not_shipped';

        // 如果是其他快递公司，显示手动输入框
        if (shippingCompany && !document.getElementById('orderShippingCompany').querySelector(`option[value="${shippingCompany}"]`)) {
            document.getElementById('orderShippingCompany').value = '其他';
            document.getElementById('otherShippingCompanyGroup').style.display = 'block';
            document.getElementById('orderOtherShippingCompany').value = shippingCompany;
        } else {
            document.getElementById('otherShippingCompanyGroup').style.display = 'none';
            document.getElementById('orderOtherShippingCompany').value = '';
        }

        // 设置订单总金额（编辑时显示实际金额）
        const totalAmount = order.total_amount || order.totalAmount || 0;
        document.getElementById('orderTotalAmount').value = totalAmount.toString();

        // 回显订单明细（若有）
        const itemsContainer = document.getElementById('orderItems');
        if (itemsContainer) {
            itemsContainer.innerHTML = '';
            const detailItems = Array.isArray(order.items) ? order.items : [];
            detailItems.forEach(detail => {
                const normalizedProductId = normalizeEntityId(detail.product_id);
                const matchedProduct = (ERP.state.products || []).find(p => isSameEntityId(p.id, normalizedProductId));
                const fallbackName = detail.product_name || matchedProduct?.name || `商品#${detail.product_id || '-'}`;
                const fallbackPriceNumber = parseFloat(detail.unit_price ?? matchedProduct?.price ?? 0);
                const fallbackPrice = Number.isFinite(fallbackPriceNumber) ? fallbackPriceNumber : 0;
                const hasCurrentOption = (ERP.state.products || []).some(p => isSameEntityId(p.id, normalizedProductId));
                const fallbackOption = (!hasCurrentOption && normalizedProductId !== null)
                    ? `<option value="${normalizedProductId}" data-name="${fallbackName}" data-price="${fallbackPrice.toFixed(2)}" selected>${fallbackName} - ¥${fallbackPrice.toFixed(2)}</option>`
                    : '';

                const row = document.createElement('div');
                row.className = 'order-item';
                row.style.cssText = 'border: 1px dashed #d9d9d9; padding: 10px; margin-bottom: 8px; background: #fff;';
                row.innerHTML = `
                    <div style="margin-bottom:8px;">
                        <select class="ant-select product-select" style="width:100%;" onchange="updateOrderItemTotal(this)">
                            <option value="">选择产品</option>
                            ${fallbackOption}
                            ${ERP.state.products.map(p => `<option value="${p.id}" data-name="${p.name}" data-price="${p.price}">${p.name} - ¥${p.price}</option>`).join('')}
                        </select>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <input type="number" class="ant-input item-quantity" value="${detail.quantity || 1}" min="1" onchange="updateOrderItemTotal(this)" style="width:80px;">
                        <input type="number" class="ant-input item-unit-price" value="${parseFloat(detail.unit_price || 0).toFixed(2)}" min="0" step="0.01" onchange="updateOrderItemTotal(this)" style="width:120px;" placeholder="单价">
                        <input type="text" class="ant-input item-total" readonly value="¥0.00" style="flex:1; background:#fafafa;">
                        <button type="button" class="ant-btn" onclick="removeOrderItem(this)" style="color:red;">删除</button>
                    </div>
                `;
                itemsContainer.appendChild(row);
                const select = row.querySelector('.product-select');
                if (select) {
                    select.value = String(detail.product_id || '');
                }
                updateOrderItemTotal(row.querySelector('.item-unit-price'));
            });
        }
    } else {
        title.textContent = '创建订单';
        form.reset();
        document.getElementById('orderId').value = '';
        document.getElementById('orderItems').innerHTML = '';
        document.getElementById('orderTotalAmount').value = '';
        refreshOrderStatusOptions('pending', true);
        document.getElementById('orderPaymentStatus').value = 'unpaid';
        document.getElementById('orderShippingCompany').value = '';
        document.getElementById('orderTrackingNumber').value = '';
        document.getElementById('orderShippingStatus').value = 'not_shipped';
        document.getElementById('otherShippingCompanyGroup').style.display = 'none';
        document.getElementById('orderOtherShippingCompany').value = '';
        const trackingParamInput = document.getElementById('orderTrackingParam');
        if (trackingParamInput) {
            trackingParamInput.value = '';
        }
        const riskReasonInput = document.getElementById('orderRiskApprovalReason');
        if (riskReasonInput) {
            riskReasonInput.value = '';
        }
    }

    refreshOrderRiskPreview();

    resetOrderLogisticsPanel();
    updateOrderTrackingParamHint();
    const trackingNumber = normalizeTrackingNumber(document.getElementById('orderTrackingNumber')?.value);
    if (trackingNumber) {
        setTimeout(() => {
            queryOrderLogisticsByForm({ silentWhenEmpty: true, forceRefresh: true, silentError: true });
        }, 80);
    }

    modal.classList.add('active');
    modal.style.display = 'flex';
}

function hideOrderModal() {
    const modal = document.getElementById('orderModal');
    modal.classList.remove('active');
    modal.style.display = '';
}

async function saveOrder() {
    const orderId = document.getElementById('orderId').value;
    const customerId = document.getElementById('orderCustomer').value;

    if (!customerId) {
        alert('请选择客户');
        return;
    }

    const itemsContainer = document.getElementById('orderItems');
    const items = itemsContainer.querySelectorAll('.order-item');
    const orderItems = [];

    items.forEach(item => {
        const select = item.querySelector('.product-select');
        const quantityInput = item.querySelector('.item-quantity');
        const unitPriceInput = item.querySelector('.item-unit-price');
        const productId = normalizeEntityId(select.value);
        const quantity = parseInt(quantityInput.value) || 0;

        if (productId !== null && quantity > 0) {
            const selectedOption = select.options[select.selectedIndex];
            const productName = selectedOption?.dataset.name || '';
            const selectedPrice = parseFloat(selectedOption?.dataset.price) || 0;
            const price = parseFloat(unitPriceInput?.value);
            const finalPrice = Number.isFinite(price) && price > 0 ? price : selectedPrice;

            orderItems.push({
                product_id: productId,
                product_name: productName,
                quantity: quantity,
                unit_price: finalPrice
            });
        }
    });

    if (orderItems.length === 0) {
        alert('请至少添加一个产品');
        return;
    }

    // 获取手动输入的总金额，如果没有输入则根据产品计算
    let totalAmount = parseFloat(document.getElementById('orderTotalAmount').value) || 0;
    if (totalAmount === 0) {
        // 如果用户没有输入金额，则根据产品售价自动计算
        orderItems.forEach(item => {
            totalAmount += (item.unit_price || 0) * (item.quantity || 0);
        });
    }

    const riskAnalysis = buildOrderRiskAnalysis(orderItems, totalAmount);
    renderOrderRiskPanel(riskAnalysis);
    const riskReasonInput = document.getElementById('orderRiskApprovalReason');
    const riskApprovalReason = String(riskReasonInput?.value || '').trim();
    if (riskAnalysis.riskRank >= 3 && !riskApprovalReason) {
        alert('高风险订单必须填写审批原因后才能保存');
        if (riskReasonInput) {
            riskReasonInput.focus();
        }
        return;
    }

    const originalNotes = String(document.getElementById('orderNotes').value || '').trim();
    const baseNotes = originalNotes
        .split('\n')
        .filter(line => !String(line || '').trim().startsWith('[风控审批]'))
        .join('\n')
        .trim();

    const orderData = {
        customer_id: normalizeEntityId(customerId),
        customer_name: (document.getElementById('orderCustomer')?.selectedOptions?.[0]?.text || '').trim(),
        notes: (() => {
            if (riskAnalysis.riskRank >= 3) {
                const approvalLine = `[风控审批] ${riskApprovalReason}`;
                return baseNotes ? `${baseNotes}\n${approvalLine}` : approvalLine;
            }
            return baseNotes;
        })(),
        status: document.getElementById('orderStatus').value,
        payment_status: document.getElementById('orderPaymentStatus').value,
        shipping_company: document.getElementById('orderShippingCompany').value === '其他'
            ? document.getElementById('orderOtherShippingCompany').value
            : document.getElementById('orderShippingCompany').value,
        tracking_number: document.getElementById('orderTrackingNumber').value,
        shipping_status: document.getElementById('orderShippingStatus').value,
        total_amount: totalAmount, // 使用手动输入或自动计算的金额
        items: orderItems
    };

    if (!confirmOrderRiskBeforeSave(riskAnalysis)) {
        return;
    }

    const saveBtn = document.querySelector('#orderModal .ant-btn-primary');
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = '保存中...';

    try {
        let result;
        if (orderId) {
            result = await ERP.updateOrder(normalizeEntityId(orderId), orderData);
        } else {
            // 先关闭模态框，然后异步保存
            hideOrderModal();
            
            // 保存到数据库
            result = await ERP.addOrder(orderData);
            erpDebugLog('info', '[ERP Ant] 订单已保存: ', result);
            
            if (result) {
                // 直接使用本地状态刷新，避免额外全量查询导致卡顿
                searchOrders();
                updateStatistics();

                if (ERP.config.currentModule === 'finance') {
                    const finances = await ERP.loadFinances(true);
                    syncFinanceViewRows(finances, 'all');
                    renderFinances(finances);
                }
                
                if (typeof showToast === 'function') {
                    showToast('订单保存成功', 'success');
                }
            }
        }

        if (result && orderId) {
            // 订单更新成功
            hideOrderModal();
            
            // 直接使用本地状态刷新，减少等待
            searchOrders();
            updateStatistics();

            if (ERP.config.currentModule === 'finance') {
                const finances = await ERP.loadFinances(true);
                syncFinanceViewRows(finances, 'all');
                renderFinances(finances);
            }
            
            if (typeof showToast === 'function') {
                showToast('订单更新成功', 'success');
            }
        }
    } catch (error) {
        console.error('[ERP Ant] 保存订单失败:', error);
        alert('保存失败：' + (error.message || '网络错误，请检查连接'));
        // 如果是创建订单失败，需要重新加载数据
        if (!orderId) {
            await ERP.loadOrders();
            searchOrders();
            updateStatistics();
        }
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
}

// 获取当前订单中的产品项
function getOrderItems() {
    const itemsContainer = document.getElementById('orderItems');
    const items = itemsContainer.querySelectorAll('.order-item');
    const orderItems = [];

    items.forEach(item => {
        const select = item.querySelector('.product-select');
        const quantityInput = item.querySelector('.item-quantity');
        const unitPriceInput = item.querySelector('.item-unit-price');
        const productId = normalizeEntityId(select.value);
        const quantity = parseInt(quantityInput.value) || 0;

        if (productId !== null && quantity > 0) {
            const selectedOption = select.options[select.selectedIndex];
            const productName = selectedOption?.dataset.name || '';
            const selectedPrice = parseFloat(selectedOption?.dataset.price) || 0;
            const price = parseFloat(unitPriceInput?.value);
            const finalPrice = Number.isFinite(price) && price > 0 ? price : selectedPrice;

            orderItems.push({
                productId: productId,
                productName: productName,
                quantity: quantity,
                unitPrice: finalPrice
            });
        }
    });

    return orderItems;
}

// 计算订单建议总价（基于产品售价）
function calculateOrderTotal() {
    const orderItems = getOrderItems();
    let suggestedTotal = 0;
    
    orderItems.forEach(item => {
        suggestedTotal += (item.unitPrice || 0) * (item.quantity || 0);
    });
    
    const totalInput = document.getElementById('orderTotalAmount');
    if (totalInput) {
        totalInput.value = suggestedTotal.toFixed(2);
        
        if (typeof showToast === 'function') {
            showToast(`已计算建议价：¥${suggestedTotal.toFixed(2)}，您可以根据实际情况调整`, 'info');
        }
    }
    refreshOrderRiskPreview();
}

async function openOrderFromRiskLedger(orderId) {
    const normalizedId = normalizeEntityId(orderId);
    if (!normalizedId) {
        return;
    }
    if (typeof switchTab === 'function') {
        switchTab('orders');
    }
    await editOrder(normalizedId);
}

async function editOrder(orderId) {
    if (window.ERP && typeof ERP.loadProducts === 'function' && (!Array.isArray(ERP.state.products) || ERP.state.products.length === 0)) {
        await ERP.loadProducts({ lite: true, forceRefresh: true });
    }

    let order = ERP.state.orders.find(o => isSameEntityId(o.id, orderId));

    const hasDetailItems = !!(order && Array.isArray(order.items) && order.items.length > 0);
    if (!hasDetailItems && window.ERP && typeof ERP.loadOrderDetail === 'function') {
        const detail = await ERP.loadOrderDetail(normalizeEntityId(orderId));
        if (detail) {
            order = detail;
        }
    }

    if (order) {
        showOrderModal(order);
        return;
    }

    if (typeof showToast === 'function') {
        showToast('未找到订单详情，请刷新后重试', 'error');
    }
}

async function deleteOrder(orderId) {
    if (!confirm('确定要删除这个订单吗？')) {
        return;
    }

    try {
        erpDebugLog('info', '[ERP Ant] 删除订单已提交到后端: ', orderId);
        await ERP.deleteOrder(orderId);
        erpDebugLog('info', '[ERP Ant] 重新加载订单数据...');
        const orders = await ERP.loadOrders(true);
        erpDebugLog('info', '[ERP Ant] 重新加载订单数据条数: ', orders.length);
        
        if (typeof renderOrders === 'function') {
            erpDebugLog('info', '[ERP Ant] renderOrders 函数存在，正在调用...');
            searchOrders();
            erpDebugLog('info', '[ERP Ant] renderOrders 调用完成');
        } else {
            console.error('[ERP Ant] renderOrders 函数不存在！');
        }
        
        updateStatistics();
        
        if (typeof showToast === 'function') {
            showToast('订单删除成功', 'success');
        }
    } catch (error) {
        console.error('[ERP Ant] 删除订单失败:', error);
        if (typeof showToast === 'function') {
            showToast('删除失败：' + (error.message || '网络错误，请检查连接'), 'error');
        }
        
        // 重新加载数据
        const orders = await ERP.loadOrders(true);
        if (typeof renderOrders === 'function') {
            searchOrders();
        }
        updateStatistics();
    }
}

function formatOrderApprovalDateTime(value) {
    if (!value) {
        return '-';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

function getApprovalRangeStartTimestamp(range) {
    const normalizedRange = String(range || 'all').toLowerCase();
    const now = new Date();
    if (normalizedRange === 'today') {
        return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    }
    if (normalizedRange === '7') {
        return now.getTime() - (7 * 24 * 60 * 60 * 1000);
    }
    if (normalizedRange === '30') {
        return now.getTime() - (30 * 24 * 60 * 60 * 1000);
    }
    return null;
}

function filterOrderApprovalHistoryRecords(records, keyword, range) {
    const keywordText = String(keyword || '').trim().toLowerCase();
    const rangeStart = getApprovalRangeStartTimestamp(range);

    return (Array.isArray(records) ? records : []).filter(record => {
        const searchableText = [
            record?.actionText,
            record?.fromStatusText,
            record?.toStatusText,
            record?.operator,
            record?.remark,
            record?.description
        ].map(item => String(item || '').toLowerCase()).join(' ');

        const matchKeyword = !keywordText || searchableText.includes(keywordText);
        if (!matchKeyword) {
            return false;
        }

        if (rangeStart === null) {
            return true;
        }

        const createdAt = new Date(record?.createdAt || '').getTime();
        if (!Number.isFinite(createdAt)) {
            return false;
        }
        return createdAt >= rangeStart;
    });
}

function renderOrderApprovalHistoryModal(order, records = [], options = {}) {
    const body = document.getElementById('orderApprovalHistoryBody');
    const title = document.getElementById('orderApprovalHistoryTitle');
    if (!body || !title) {
        return;
    }

    const loading = !!options.loading;
    const errorMessage = String(options.errorMessage || '').trim();
    const orderNumber = order?.order_number || `订单#${order?.id || '-'}`;
    title.textContent = `审批记录 · ${orderNumber}`;

    if (Array.isArray(records)) {
        orderApprovalHistoryState.records = records;
    }

    if (typeof options.keyword === 'string') {
        orderApprovalHistoryState.keyword = options.keyword;
    }
    if (typeof options.range === 'string') {
        orderApprovalHistoryState.range = options.range;
    }
    if (Object.prototype.hasOwnProperty.call(options, 'loading')) {
        orderApprovalHistoryState.loading = loading;
    }
    if (Object.prototype.hasOwnProperty.call(options, 'errorMessage')) {
        orderApprovalHistoryState.errorMessage = errorMessage;
    }

    if (loading || orderApprovalHistoryState.loading) {
        body.innerHTML = '<div style="padding:16px 0;color:#64748b;">审批记录加载中...</div>';
        return;
    }

    if (errorMessage || orderApprovalHistoryState.errorMessage) {
        body.innerHTML = `<div style="padding:16px 0;color:#cf1322;">${escapeHtmlText(errorMessage || orderApprovalHistoryState.errorMessage)}</div>`;
        return;
    }

    const keyword = String(orderApprovalHistoryState.keyword || '').trim();
    const range = String(orderApprovalHistoryState.range || 'all').trim().toLowerCase();
    const filteredRecords = filterOrderApprovalHistoryRecords(orderApprovalHistoryState.records, keyword, range);
    orderApprovalHistoryState.filteredRecords = filteredRecords;

    const rows = filteredRecords.map((item, index) => {
        const indexText = String(index + 1).padStart(2, '0');
        const operatorText = item?.operator ? escapeHtmlText(item.operator) : '系统';
        const remarkText = item?.remark ? escapeHtmlText(item.remark) : '-';
        const fromText = escapeHtmlText(item?.fromStatusText || '-');
        const toText = escapeHtmlText(item?.toStatusText || '-');
        const actionText = escapeHtmlText(item?.actionText || '状态变更');
        const timeText = escapeHtmlText(formatOrderApprovalDateTime(item?.createdAt));
        return `
            <tr>
                <td>${indexText}</td>
                <td>${actionText}</td>
                <td>${fromText} → ${toText}</td>
                <td>${operatorText}</td>
                <td title="${remarkText}">${remarkText}</td>
                <td>${timeText}</td>
            </tr>
        `;
    }).join('');

    const tableContent = filteredRecords.length > 0
        ? `
            <div class="ant-table-wrapper">
                <div class="ant-table">
                    <table>
                        <thead class="ant-table-thead">
                            <tr>
                                <th>#</th>
                                <th>动作</th>
                                <th>状态流转</th>
                                <th>操作人</th>
                                <th>备注</th>
                                <th>时间</th>
                            </tr>
                        </thead>
                        <tbody class="ant-table-tbody">
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>
        `
        : '<div style="padding:16px 0;color:#64748b;">当前筛选条件下暂无审批记录</div>';

    body.innerHTML = `
        <div class="search-form" style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">
            <div class="search-item">
                <label class="search-label">筛选关键词:</label>
                <input type="text" id="orderApprovalHistorySearch" class="ant-input" style="min-width:220px;"
                    placeholder="动作/状态/操作人/备注"
                    value="${escapeHtmlText(keyword)}"
                    oninput="onOrderApprovalHistoryFilterChange()">
            </div>
            <div class="search-item">
                <label class="search-label">时间范围:</label>
                <select id="orderApprovalHistoryRange" class="ant-select" onchange="onOrderApprovalHistoryFilterChange()">
                    <option value="all" ${range === 'all' ? 'selected' : ''}>全部</option>
                    <option value="today" ${range === 'today' ? 'selected' : ''}>今天</option>
                    <option value="7" ${range === '7' ? 'selected' : ''}>近7天</option>
                    <option value="30" ${range === '30' ? 'selected' : ''}>近30天</option>
                </select>
            </div>
            <div class="search-item">
                <button class="ant-btn ant-btn-primary" onclick="onOrderApprovalHistoryFilterChange()">筛选</button>
                <button class="ant-btn" onclick="resetOrderApprovalHistoryFilters()" style="margin-left:8px;">重置</button>
            </div>
            <div class="search-item">
                <button class="ant-btn" onclick="exportOrderApprovalHistoryCsv()" style="color:#1677ff;border-color:#91caff;">
                    导出审批CSV
                </button>
            </div>
        </div>
        <div style="margin-bottom:12px;color:#64748b;font-size:12px;">
            共 ${orderApprovalHistoryState.records.length} 条记录，当前显示 ${filteredRecords.length} 条
        </div>
        ${tableContent}
    `;
}

function onOrderApprovalHistoryFilterChange() {
    const keywordInput = document.getElementById('orderApprovalHistorySearch');
    const rangeSelect = document.getElementById('orderApprovalHistoryRange');
    orderApprovalHistoryState.keyword = String(keywordInput?.value || '').trim();
    orderApprovalHistoryState.range = String(rangeSelect?.value || 'all').trim().toLowerCase();
    renderOrderApprovalHistoryModal(orderApprovalHistoryState.order, orderApprovalHistoryState.records, {
        loading: false,
        errorMessage: ''
    });
}

function resetOrderApprovalHistoryFilters() {
    orderApprovalHistoryState.keyword = '';
    orderApprovalHistoryState.range = 'all';
    renderOrderApprovalHistoryModal(orderApprovalHistoryState.order, orderApprovalHistoryState.records, {
        loading: false,
        errorMessage: ''
    });
}

function exportOrderApprovalHistoryCsv() {
    const order = orderApprovalHistoryState.order;
    const records = Array.isArray(orderApprovalHistoryState.filteredRecords) ? orderApprovalHistoryState.filteredRecords : [];
    if (records.length === 0) {
        if (typeof showToast === 'function') {
            showToast('当前没有可导出的审批记录', 'warning');
        }
        return;
    }

    const orderNumber = order?.order_number || `订单_${order?.id || 'unknown'}`;
    const headers = ['订单号', '动作', '状态流转', '操作人', '备注', '时间'];
    const rows = records.map(item => [
        orderNumber,
        item?.actionText || '',
        `${item?.fromStatusText || '-'} -> ${item?.toStatusText || '-'}`,
        item?.operator || '系统',
        item?.remark || '',
        formatOrderApprovalDateTime(item?.createdAt)
    ]);
    downloadCsvFile(`审批记录-${orderNumber}-${formatFileTimestamp()}.csv`, headers, rows);

    if (typeof showToast === 'function') {
        showToast(`已导出 ${rows.length} 条审批记录`, 'success');
    }
}

function hideOrderApprovalHistoryModal() {
    const modal = document.getElementById('orderApprovalHistoryModal');
    if (!modal) {
        return;
    }
    modal.classList.remove('active');
    modal.style.display = '';
    orderApprovalHistoryState.loading = false;
    orderApprovalHistoryState.errorMessage = '';
}

function hidePayablePaymentHistoryModal() {
    const modal = document.getElementById('payablePaymentHistoryModal');
    if (!modal) {
        return;
    }
    modal.classList.remove('active');
    modal.style.display = '';
    payablePaymentHistoryState.financeId = null;
    payablePaymentHistoryState.finance = null;
    payablePaymentHistoryState.rows = [];
    payablePaymentHistoryState.relatedRows = [];
}

function openPayablePaymentHistoryModal() {
    const modal = document.getElementById('payablePaymentHistoryModal');
    if (!modal) {
        return;
    }
    modal.classList.add('active');
    modal.style.display = 'flex';
}

function collectRelatedFinanceRows(targetFinance) {
    const sourceRows = Array.isArray(ERP.state?.finances) ? ERP.state.finances : [];
    const targetMeta = getFinanceReferenceMeta(targetFinance);
    const targetRef = targetMeta.referenceId;
    const targetOrder = targetMeta.orderId;

    return sourceRows.filter(item => {
        const meta = getFinanceReferenceMeta(item);
        const sameReference = targetRef && meta.referenceId && meta.referenceId === targetRef;
        const sameOrder = targetOrder && meta.orderId && meta.orderId === targetOrder;
        return !!(sameReference || sameOrder);
    });
}

function renderPayablePaymentHistoryModal(finance, paymentRows, relatedRows) {
    const titleEl = document.getElementById('payablePaymentHistoryTitle');
    const bodyEl = document.getElementById('payablePaymentHistoryBody');
    if (!bodyEl) {
        return;
    }

    const target = finance || {};
    const rows = Array.isArray(paymentRows) ? paymentRows : [];
    const related = Array.isArray(relatedRows) ? relatedRows : [];
    const totalPaid = rows.reduce((sum, item) => sum + Math.abs(Number(item?.amount || 0)), 0);
    const remainingPayable = related.find(item => String(item?.category || '').includes('应付账款'));
    const remainingAmount = remainingPayable ? Math.abs(Number(remainingPayable?.amount || 0)) : 0;
    const meta = getFinanceReferenceMeta(target);
    const financeLabel = meta.referenceId ? `参考ID: ${meta.referenceId}` : (meta.orderId ? `订单ID: ${meta.orderId}` : `记录ID: ${target?.id || '-'}`);

    if (titleEl) {
        titleEl.textContent = `采购付款记录 - ${financeLabel}`;
    }

    const rowsHtml = rows.length > 0
        ? rows
            .sort((left, right) => {
                const l = parseFinanceDate(left?.transaction_date)?.getTime() || 0;
                const r = parseFinanceDate(right?.transaction_date)?.getTime() || 0;
                return r - l;
            })
            .map(item => {
                const date = parseFinanceDate(item?.transaction_date);
                return `
                    <tr>
                        <td>${date ? date.toLocaleString('zh-CN') : '-'}</td>
                        <td>${formatCurrency(Math.abs(Number(item?.amount || 0)))}</td>
                        <td>${escapeHtmlText(item?.description || '-')}</td>
                        <td>${item?.id || '-'}</td>
                    </tr>
                `;
            }).join('')
        : '<tr><td colspan="4" style="text-align:center;color:#999;padding:16px;">暂无付款记录</td></tr>';

    bodyEl.innerHTML = `
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
            <div style="padding:10px 12px;border:1px solid #d6e4ff;border-radius:8px;background:#f0f5ff;min-width:180px;">
                <div style="font-size:12px;color:#8c8c8c;">累计已付款</div>
                <div style="font-size:18px;font-weight:600;color:#1d39c4;">${formatCurrency(totalPaid)}</div>
            </div>
            <div style="padding:10px 12px;border:1px solid #ffd6e7;border-radius:8px;background:#fff1f8;min-width:180px;">
                <div style="font-size:12px;color:#8c8c8c;">当前剩余应付</div>
                <div style="font-size:18px;font-weight:600;color:#cf1322;">${formatCurrency(remainingAmount)}</div>
            </div>
        </div>
        <div class="ant-table-wrapper">
            <div class="ant-table">
                <table>
                    <thead class="ant-table-thead">
                        <tr>
                            <th>付款时间</th>
                            <th>付款金额</th>
                            <th>描述</th>
                            <th>记录ID</th>
                        </tr>
                    </thead>
                    <tbody class="ant-table-tbody">${rowsHtml}</tbody>
                </table>
            </div>
        </div>
    `;
}

async function showPayablePaymentHistory(financeId) {
    const normalizedId = normalizeEntityId(financeId);
    if (normalizedId === null) {
        alert('记录标识无效');
        return;
    }

    if (!window.ERP) {
        alert('ERP 尚未初始化');
        return;
    }

    await ERP.loadFinances(true);

    const targetFinance = (ERP.state?.finances || []).find(item => isSameEntityId(item?.id, normalizedId));
    if (!targetFinance) {
        alert('未找到财务记录，请刷新后重试');
        return;
    }

    const relatedRows = collectRelatedFinanceRows(targetFinance);
    const paymentRows = relatedRows.filter(isPurchasePaymentRecord);

    payablePaymentHistoryState.financeId = normalizedId;
    payablePaymentHistoryState.finance = targetFinance;
    payablePaymentHistoryState.rows = paymentRows;
    payablePaymentHistoryState.relatedRows = relatedRows;

    openPayablePaymentHistoryModal();
    renderPayablePaymentHistoryModal(targetFinance, paymentRows, relatedRows);
}

function exportPayablePaymentHistoryCsv() {
    const rows = Array.isArray(payablePaymentHistoryState.rows) ? payablePaymentHistoryState.rows : [];
    if (!rows.length) {
        if (typeof showToast === 'function') {
            showToast('当前没有可导出的付款记录', 'warning');
        }
        return;
    }

    const targetFinance = payablePaymentHistoryState.finance || {};
    const meta = getFinanceReferenceMeta(targetFinance);
    const label = meta.referenceId || meta.orderId || targetFinance?.id || 'unknown';
    const headers = ['付款时间', '付款金额', '类型', '分类', '描述', '记录ID'];
    const exportRows = rows
        .slice()
        .sort((left, right) => {
            const l = parseFinanceDate(left?.transaction_date)?.getTime() || 0;
            const r = parseFinanceDate(right?.transaction_date)?.getTime() || 0;
            return r - l;
        })
        .map(item => {
            const date = parseFinanceDate(item?.transaction_date);
            return [
                date ? date.toLocaleString('zh-CN') : (item?.transaction_date || '-'),
                Number(item?.amount || 0).toFixed(2),
                item?.type === 'income' ? '收入' : (item?.type === 'expense' ? '支出' : '系统'),
                item?.category || '-',
                item?.description || '-',
                item?.id || '-'
            ];
        });

    downloadCsvFile(`采购付款记录-${label}-${formatFileTimestamp()}.csv`, headers, exportRows);
    if (typeof showToast === 'function') {
        showToast(`已导出 ${exportRows.length} 条付款记录`, 'success');
    }
}

function openOrderApprovalHistoryModal() {
    const modal = document.getElementById('orderApprovalHistoryModal');
    if (!modal) {
        return;
    }
    modal.classList.add('active');
    modal.style.display = 'flex';
}

async function showOrderApprovalHistory(orderId) {
    const normalizedOrderId = normalizeEntityId(orderId);
    if (normalizedOrderId === null) {
        if (typeof showToast === 'function') {
            showToast('订单标识无效，无法查看审批记录', 'error');
        }
        return;
    }
    const order = (ERP.state.orders || []).find(item => isSameEntityId(item?.id, normalizedOrderId));
    orderApprovalHistoryState.orderId = normalizedOrderId;
    orderApprovalHistoryState.order = order || null;
    orderApprovalHistoryState.records = [];
    orderApprovalHistoryState.filteredRecords = [];
    orderApprovalHistoryState.keyword = '';
    orderApprovalHistoryState.range = 'all';
    orderApprovalHistoryState.loading = true;
    orderApprovalHistoryState.errorMessage = '';

    openOrderApprovalHistoryModal();
    renderOrderApprovalHistoryModal(orderApprovalHistoryState.order, [], { loading: true, errorMessage: '' });

    try {
        if (!window.ERP || typeof ERP.loadOrderApprovalLogs !== 'function') {
            throw new Error('审批记录模块未初始化，请刷新后重试');
        }

        const records = await ERP.loadOrderApprovalLogs(normalizedOrderId, 200);
        orderApprovalHistoryState.loading = false;
        orderApprovalHistoryState.errorMessage = '';
        renderOrderApprovalHistoryModal(orderApprovalHistoryState.order, records, { loading: false, errorMessage: '' });
    } catch (error) {
        console.error('[ERP Ant] 加载审批记录失败:', error);
        orderApprovalHistoryState.loading = false;
        orderApprovalHistoryState.errorMessage = `审批记录加载失败：${error?.message || '未知错误'}`;
        renderOrderApprovalHistoryModal(orderApprovalHistoryState.order, [], { loading: false, errorMessage: orderApprovalHistoryState.errorMessage });
    }
}

function getOrderSearchKeyword() {
    const keywordInput = document.getElementById('orderSearch');
    return String(keywordInput?.value || '').trim().toLowerCase();
}

function getOrderStatusFilterValue() {
    const statusSelect = document.getElementById('orderStatusFilter');
    return String(statusSelect?.value || 'all').trim().toLowerCase();
}

function filterOrdersBySearchAndStatus(orders) {
    const keyword = getOrderSearchKeyword();
    const statusFilter = getOrderStatusFilterValue();
    const customers = Array.isArray(ERP.state?.customers) ? ERP.state.customers : [];

    return (Array.isArray(orders) ? orders : []).filter(order => {
        const orderNumber = String(order?.order_number || `订单#${order?.id || ''}`).toLowerCase();
        const customer = customers.find(item => isSameEntityId(item?.id, order?.customer_id));
        const customerName = String(customer?.name || order?.customer_name || '').toLowerCase();
        const normalizedStatus = normalizeOrderStatusValue(order?.status || 'pending');

        const matchKeyword = !keyword
            || orderNumber.includes(keyword)
            || customerName.includes(keyword);
        const matchStatus = statusFilter === 'all' || normalizedStatus === statusFilter;

        return matchKeyword && matchStatus;
    });
}

function getOrderStatusCountMap(orders) {
    const counters = {
        pending: 0,
        confirmed: 0,
        shipped: 0,
        signed: 0,
        completed: 0,
        refunded: 0,
        cancelled: 0
    };

    (Array.isArray(orders) ? orders : []).forEach(order => {
        const status = normalizeOrderStatusValue(order?.status || 'pending');
        if (Object.prototype.hasOwnProperty.call(counters, status)) {
            counters[status] += 1;
        }
    });
    return counters;
}

function renderOrderWorkflowSummary(allOrders = [], visibleOrders = []) {
    const summaryEl = document.getElementById('orderWorkflowSummary');
    if (!summaryEl) {
        return;
    }

    const allRows = Array.isArray(allOrders) ? allOrders : [];
    const visibleRows = Array.isArray(visibleOrders) ? visibleOrders : [];
    const allStats = getOrderStatusCountMap(allRows);
    const visibleStats = getOrderStatusCountMap(visibleRows);

    summaryEl.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
            <span class="ant-tag">筛选结果：${visibleRows.length}/${allRows.length}</span>
            <span class="ant-tag">待审批 ${visibleStats.pending}（总${allStats.pending}）</span>
            <span class="ant-tag">待发货 ${visibleStats.confirmed}（总${allStats.confirmed}）</span>
            <span class="ant-tag">在途 ${visibleStats.shipped + visibleStats.signed}（总${allStats.shipped + allStats.signed}）</span>
            <span class="ant-tag">已完成 ${visibleStats.completed}（总${allStats.completed}）</span>
            <span class="ant-tag">已退款 ${visibleStats.refunded}（总${allStats.refunded}）</span>
            <span class="ant-tag">已取消 ${visibleStats.cancelled}（总${allStats.cancelled}）</span>
        </div>
    `;
}

function getFilteredOrdersForView() {
    const sourceOrders = Array.isArray(ERP.state?.orders) ? ERP.state.orders : [];
    return filterOrdersBySearchAndStatus(sourceOrders);
}

function exportOrdersCsv() {
    const filtered = getFilteredOrdersForView();
    if (!Array.isArray(filtered) || filtered.length === 0) {
        if (typeof showToast === 'function') {
            showToast('当前筛选无订单可导出', 'warning');
        }
        return;
    }

    const customers = Array.isArray(ERP.state?.customers) ? ERP.state.customers : [];
    const headers = ['订单号', '客户', '订单日期', '订单状态', '支付状态', '发货状态', '金额', '快递公司', '快递单号', '备注'];
    const rows = filtered.map(order => {
        const customer = customers.find(item => isSameEntityId(item?.id, order?.customer_id));
        const orderDate = order?.order_date ? new Date(order.order_date).toLocaleDateString('zh-CN') : '';
        return [
            order?.order_number || `订单#${order?.id || ''}`,
            customer?.name || order?.customer_name || '',
            orderDate,
            getOrderStatusText(order?.status || 'pending'),
            getPaymentStatusText(order?.payment_status || 'unpaid'),
            getShippingStatusText(order?.shipping_status || 'not_shipped'),
            Number.isFinite(parseFloat(order?.total_amount)) ? parseFloat(order.total_amount).toFixed(2) : '0.00',
            order?.shipping_company || '',
            order?.tracking_number || '',
            order?.notes || ''
        ];
    });

    downloadCsvFile(`订单列表-${formatFileTimestamp()}.csv`, headers, rows);

    if (typeof showToast === 'function') {
        showToast(`已导出 ${rows.length} 条订单`, 'success');
    }
}

async function bulkCompleteSignedOrders() {
    if (bulkCompleteSignedOrdersInProgress) {
        if (typeof showToast === 'function') {
            showToast('批量完结正在执行，请稍候', 'warning');
        }
        return;
    }

    const candidates = getFilteredOrdersForView().filter(order => normalizeOrderStatusValue(order?.status) === 'signed');
    if (candidates.length === 0) {
        if (typeof showToast === 'function') {
            showToast('当前筛选中没有“已签收”订单', 'info');
        }
        return;
    }

    if (!confirm(`确认将 ${candidates.length} 笔“已签收”订单批量完结为“已完成”吗？`)) {
        return;
    }

    bulkCompleteSignedOrdersInProgress = true;
    let successCount = 0;
    let failCount = 0;

    try {
        for (const order of candidates) {
            try {
                const updated = await ERP.updateOrderStatus(
                    normalizeEntityId(order.id),
                    'completed',
                    null,
                    {
                        action_label: '批量完结',
                        remark: '批量完结已签收订单',
                        operator: String(userData?.user?.email || userData?.user?.id || '').trim(),
                        source: 'erp-bulk-action'
                    }
                );
                if (updated) {
                    successCount += 1;
                } else {
                    failCount += 1;
                }
            } catch (error) {
                console.error('[ERP Ant] 批量完结单笔失败:', error);
                failCount += 1;
            }
        }

        await Promise.all([
            ERP.loadOrders(true),
            ERP.loadFinances(true)
        ]);
        searchOrders();
        if (typeof renderFinances === 'function') {
            syncFinanceViewRows(ERP.state.finances, 'all');
            renderFinances(ERP.state.finances);
        }
        updateStatistics();

        if (typeof showToast === 'function') {
            showToast(`批量完结完成：成功 ${successCount}，失败 ${failCount}`, failCount > 0 ? 'warning' : 'success');
        }
    } finally {
        bulkCompleteSignedOrdersInProgress = false;
    }
}

async function updateOrderStatusByAction(orderId, targetStatus, actionLabel = '状态更新') {
    const normalizedOrderId = normalizeEntityId(orderId);
    if (normalizedOrderId === null) {
        if (typeof showToast === 'function') {
            showToast('订单标识无效，无法更新状态', 'error');
        }
        return;
    }

    const order = (ERP.state.orders || []).find(item => isSameEntityId(item?.id, normalizedOrderId));
    const orderNumber = order?.order_number || `订单#${normalizedOrderId}`;
    const fromText = getOrderStatusText(order?.status || 'pending');
    const toText = getOrderStatusText(targetStatus);

    if (!confirm(`确认执行【${actionLabel}】？\n订单：${orderNumber}\n状态：${fromText} → ${toText}`)) {
        return;
    }

    const approvalRemark = prompt(`请输入【${actionLabel}】备注（可留空）`, '');
    if (approvalRemark === null) {
        if (typeof showToast === 'function') {
            showToast('已取消本次审批操作', 'info');
        }
        return;
    }

    try {
        const updated = await ERP.updateOrderStatus(
            normalizedOrderId,
            targetStatus,
            null,
            {
                action_label: actionLabel,
                remark: String(approvalRemark || '').trim(),
                operator: String(userData?.user?.email || userData?.user?.id || '').trim(),
                source: 'erp-approval-action'
            }
        );
        if (!updated) {
            throw new Error('状态更新未生效');
        }

        await Promise.all([
            ERP.loadOrders(true),
            ERP.loadFinances(true)
        ]);

        searchOrders();
        if (typeof renderFinances === 'function') {
            syncFinanceViewRows(ERP.state.finances, 'all');
            renderFinances(ERP.state.finances);
        }
        updateStatistics();
    } catch (error) {
        console.error('[ERP Ant] 订单审批操作失败:', error);
        if (typeof showToast === 'function') {
            showToast(`${actionLabel}失败：${error?.message || '未知错误'}`, 'error');
        }
    }
}

function getOrderQuickActions(order) {
    const status = normalizeOrderStatusValue(order?.status || 'pending');
    const orderIdLiteral = JSON.stringify(order?.id);
    const buttons = [
        `<button class="ant-btn erp-btn-teal" onclick="showOrderApprovalHistory(${orderIdLiteral})">审批记录</button>`
    ];

    if (status === 'pending') {
        buttons.push(
            `<button class="ant-btn erp-btn-blue" onclick="updateOrderStatusByAction(${orderIdLiteral}, 'confirmed', '订单审批通过')">审批通过</button>`,
            `<button class="ant-btn erp-btn-danger" onclick="updateOrderStatusByAction(${orderIdLiteral}, 'cancelled', '订单审批驳回')">驳回</button>`
        );
    }

    if (status === 'shipped' || status === 'signed') {
        buttons.push(
            `<button class="ant-btn erp-btn-violet" onclick="updateOrderStatusByAction(${orderIdLiteral}, 'refunded', '退款审批')">退款审批</button>`
        );
    }

    return buttons.join('');
}

function resetOrderFilters() {
    const keywordInput = document.getElementById('orderSearch');
    const statusSelect = document.getElementById('orderStatusFilter');
    if (keywordInput) {
        keywordInput.value = '';
    }
    if (statusSelect) {
        statusSelect.value = 'all';
    }
    searchOrders();
}

function searchOrders() {
    const sourceOrders = Array.isArray(ERP.state?.orders) ? ERP.state.orders : [];
    const filtered = getFilteredOrdersForView();
    renderOrders(filtered);
    renderOrderWorkflowSummary(sourceOrders, filtered);
}

// ==================== 库存管理 ====================
function showInventoryModal() {
    const modal = document.getElementById('inventoryModal');
    if (!modal) {
        console.error('[ERP Ant] 找不到 inventoryModal 元素');
        return;
    }

    const quantityInput = document.getElementById('inventoryQuantityChange');
    const notesInput = document.getElementById('inventoryNotes');
    const typeInput = document.getElementById('inventoryType');
    const productInput = document.getElementById('inventoryProduct');
    const purchaseDateInput = document.getElementById('inventoryPurchaseDate');
    const paymentStatusInput = document.getElementById('inventoryPaymentStatus');
    const paidAmountInput = document.getElementById('inventoryPaidAmount');
    const unitCostInput = document.getElementById('inventoryUnitCost');
    const supplierInput = document.getElementById('inventorySupplier');

    if (quantityInput) quantityInput.value = '';
    if (notesInput) notesInput.value = '';
    if (typeInput) typeInput.value = 'manual';
    if (productInput) productInput.value = '';
    if (unitCostInput) unitCostInput.value = '';
    if (supplierInput) supplierInput.value = '';
    if (paymentStatusInput) paymentStatusInput.value = 'paid';
    if (paidAmountInput) paidAmountInput.value = '';
    if (purchaseDateInput) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');
        purchaseDateInput.value = `${year}-${month}-${day}T${hour}:${minute}`;
    }

    toggleInventoryPurchaseFields();
    modal.classList.add('active');
    modal.style.display = 'flex';
}

function hideInventoryModal() {
    const modal = document.getElementById('inventoryModal');
    modal.classList.remove('active');
    modal.style.display = '';
}

function populateInventoryProducts() {
    const productSelect = document.getElementById('inventoryProduct');
    if (!productSelect) {
        return;
    }
    productSelect.innerHTML = '<option value="">请选择产品</option>' +
        ERP.state.products.map(product =>
            `<option value="${product.id}">${product.name} - ${product.sku || ''}</option>`
        ).join('');
}

function toggleInventoryPurchaseFields() {
    const typeInput = document.getElementById('inventoryType');
    const purchaseExtra = document.getElementById('inventoryPurchaseExtra');
    const paidAmountGroup = document.getElementById('inventoryPaidAmountGroup');
    const paymentStatusInput = document.getElementById('inventoryPaymentStatus');

    const isPurchase = typeInput?.value === 'purchase';
    if (purchaseExtra) {
        purchaseExtra.style.display = isPurchase ? 'block' : 'none';
    }

    if (!paidAmountGroup || !paymentStatusInput) {
        return;
    }

    paidAmountGroup.style.display = (isPurchase && paymentStatusInput.value === 'partial') ? 'block' : 'none';
}

function showInventoryPurchaseModal(productId = null) {
    populateInventoryProducts();
    showInventoryModal();
    const typeInput = document.getElementById('inventoryType');
    if (typeInput) {
        typeInput.value = 'purchase';
    }
    if (productId !== null && productId !== undefined) {
        const productSelect = document.getElementById('inventoryProduct');
        if (productSelect) {
            productSelect.value = String(productId);
        }
    }
    toggleInventoryPurchaseFields();
}

function showInventoryAdjustModalForProduct(productId) {
    populateInventoryProducts();
    showInventoryModal();
    const productSelect = document.getElementById('inventoryProduct');
    if (productSelect && productId !== null && productId !== undefined) {
        productSelect.value = String(productId);
    }
}

async function saveInventory() {
    const productId = document.getElementById('inventoryProduct')?.value;
    const quantityChangeRaw = Number(document.getElementById('inventoryQuantityChange')?.value);
    const type = document.getElementById('inventoryType')?.value || 'manual';
    const notes = document.getElementById('inventoryNotes')?.value || '';
    const unitCost = Number(document.getElementById('inventoryUnitCost')?.value || 0);
    const supplier = String(document.getElementById('inventorySupplier')?.value || '').trim();
    const paymentStatus = String(document.getElementById('inventoryPaymentStatus')?.value || 'paid');
    const purchaseDate = toDbDateTimeString(document.getElementById('inventoryPurchaseDate')?.value);
    const paidAmount = Number(document.getElementById('inventoryPaidAmount')?.value || 0);

    const quantityChange = type === 'purchase'
        ? Math.abs(quantityChangeRaw)
        : quantityChangeRaw;

    if (!productId || !quantityChange) {
        alert('请选择产品并输入调整数量');
        return;
    }

    if (type === 'purchase' && unitCost < 0) {
        alert('采购单价不能小于 0');
        return;
    }

    try {
        // 先关闭模态框，然后异步保存
        hideInventoryModal();
        
        // 保存到数据库
        const result = await ERP.adjustInventory(productId, quantityChange, type, notes, {
            unitCost,
            supplier,
            paymentStatus,
            purchaseDate,
            paidAmount
        });
        
        if (result) {
            // 重新加载数据并更新显示
            const products = await ERP.loadProducts(true);
            renderInventory(products);
            await loadPurchaseRecords();
            
            if (typeof showToast === 'function') {
                showToast('库存调整成功', 'success');
            }
        }
    } catch (error) {
        console.error('[ERP Ant] 库存调整失败:', error);
        if (typeof showToast === 'function') {
            showToast('调整失败：' + (error.message || '网络错误，请检查连接'), 'error');
        }
        
        // 重新加载数据
        const products = await ERP.loadProducts(true);
        renderInventory(products);
        await loadPurchaseRecords();
    }
}

async function loadPurchaseRecords(limit = 80) {
    if (!window.ERP || typeof ERP.loadPurchaseLogs !== 'function') {
        return;
    }

    const logs = await ERP.loadPurchaseLogs(limit);
    purchaseLogState.records = Array.isArray(logs) ? logs : [];
    dashboardPurchaseCacheState.rows = [...purchaseLogState.records];
    dashboardPurchaseCacheState.loadedAt = Date.now();
    renderPurchaseRecords(purchaseLogState.records);
}

function renderPurchaseRecords(records = []) {
    const tbody = document.getElementById('purchaseRecordsTableBody');
    if (!tbody) {
        return;
    }

    const rows = Array.isArray(records) ? records : [];
    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:16px;color:#999;">暂无采购记录</td></tr>';
        return;
    }

    const products = Array.isArray(ERP.state?.products) ? ERP.state.products : [];
    const productMap = new Map(products.map(item => [String(item?.id), item]));
    const canApprovePurchase = isCurrentUserPurchaseApprover();

    tbody.innerHTML = rows.map(record => {
        const meta = parsePurchaseMetaFromNotes(record?.notes);
        const productFromState = productMap.get(String(record?.product_id));
        const purchaseOrderNo = String(meta['采购单号'] || (record?.id ? `CG-LOG-${record.id}` : '-')).trim() || '-';
        const productName = meta['商品'] || productFromState?.name || `商品#${record?.product_id || '-'}`;
        const quantity = Number(meta['数量'] ?? Math.abs(Number(record?.quantity_change || 0)));
        const unitCost = Number(meta['单价'] ?? 0);
        const amount = Number(meta['总额'] ?? (Math.abs(quantity) * Math.max(unitCost, 0)));
        const supplier = meta['供应商'] || '-';
        const paymentStatus = String(meta['付款'] || 'paid');
        const paymentTextMap = { paid: '已付款', unpaid: '未付款', partial: '部分付款' };
        const paymentText = paymentTextMap[paymentStatus] || paymentStatus;
        const approvalStatus = normalizePurchaseApprovalStatus(meta['审批'] || 'approved');
        const approvalText = formatPurchaseApprovalStatus(approvalStatus);
        const approvalColor = approvalStatus === 'approved' ? '#237804' : (approvalStatus === 'rejected' ? '#cf1322' : '#d46b08');
        const approvalBg = approvalStatus === 'approved' ? '#f6ffed' : (approvalStatus === 'rejected' ? '#fff1f0' : '#fff7e6');
        const approvalBorder = approvalStatus === 'approved' ? '#b7eb8f' : (approvalStatus === 'rejected' ? '#ffa39e' : '#ffd591');
        const approvalOperator = String(meta['审批人'] || '').trim() || '-';
        const approvalTimeText = String(meta['审批时间'] || '').trim();
        const approvalNote = String(meta['审批备注'] || '').trim();
        const createdAt = meta['时间'] || record?.created_at || '';
        const noteText = (meta['备注'] && meta['备注'] !== '-') ? meta['备注'] : '-';
        const displayTime = parseFinanceDate(createdAt);
        const rollbackStatus = String(meta['冲销状态'] || '').trim();
        const rollbackTime = String(meta['冲销时间'] || '').trim();
        const rollbackNote = String(meta['冲销备注'] || '').trim();
        const approvalTagTitle = [
            `审批人：${approvalOperator}`,
            `审批时间：${approvalTimeText || '-'}`,
            `审批备注：${approvalNote || '-'}`,
            rollbackStatus ? `冲销状态：${rollbackStatus}` : '',
            rollbackTime ? `冲销时间：${rollbackTime}` : '',
            rollbackNote ? `冲销备注：${rollbackNote}` : ''
        ].filter(Boolean).join('\n');
        const approvalActions = approvalStatus === 'pending'
            ? (canApprovePurchase
                ? `
                    <button class="ant-btn erp-btn-compact erp-btn-success"
                        onclick='setPurchaseApprovalStatus(${JSON.stringify(record?.id)}, "approved")'>通过</button>
                    <button class="ant-btn erp-btn-compact erp-btn-danger"
                        onclick='setPurchaseApprovalStatus(${JSON.stringify(record?.id)}, "rejected")'>驳回</button>
                `
                : `<span style="font-size:12px;color:#8c8c8c;">仅管理员可审批</span>`)
            : (canApprovePurchase
                ? `
                    <button class="ant-btn erp-btn-compact erp-btn-warning"
                        onclick='setPurchaseApprovalStatus(${JSON.stringify(record?.id)}, "pending")'>改待审</button>
                `
                : `<span style="font-size:12px;color:#8c8c8c;">仅管理员可改审</span>`);
        const extraAction = `
            <button class="ant-btn erp-btn-compact erp-btn-purple"
                onclick='showPurchaseApprovalLog(${JSON.stringify(record?.id)})'>日志</button>
        `;

        return `
            <tr>
                <td>${displayTime ? displayTime.toLocaleString('zh-CN') : '-'}</td>
                <td>${escapeHtmlText(purchaseOrderNo)}</td>
                <td>${escapeHtmlText(productName)}</td>
                <td>${Number.isFinite(quantity) ? quantity : '-'}</td>
                <td>${formatCurrency(unitCost)}</td>
                <td>${formatCurrency(amount)}</td>
                <td>${escapeHtmlText(supplier)}</td>
                <td>${escapeHtmlText(paymentText)}</td>
                <td>
                    <span style="display:inline-block;padding:1px 8px;border-radius:999px;border:1px solid ${approvalBorder};background:${approvalBg};color:${approvalColor};font-size:12px;"
                        title="${escapeHtmlText(approvalTagTitle || '-')}"
                    >${escapeHtmlText(approvalText)}</span>
                </td>
                <td title="${escapeHtmlText(noteText)}">${escapeHtmlText(noteText)}</td>
                <td class="erp-action-cell"><div class="erp-row-actions">${approvalActions}${extraAction}</div></td>
            </tr>
        `;
    }).join('');
}

async function setPurchaseApprovalStatus(logId, approvalStatus = 'approved') {
    if (!window.ERP || typeof ERP.updatePurchaseApproval !== 'function') {
        alert('当前版本不支持采购审批，请刷新后重试');
        return;
    }
    if (!isCurrentUserPurchaseApprover()) {
        alert('仅管理员可以执行采购审批');
        return;
    }

    const safeStatus = normalizePurchaseApprovalStatus(approvalStatus);
    const statusText = formatPurchaseApprovalStatus(safeStatus);
    let note = '';
    if (safeStatus === 'rejected') {
        note = String(prompt('请输入驳回原因（必填）', '') || '').trim();
        if (!note) {
            alert('驳回必须填写原因');
            return;
        }
    } else {
        note = String(prompt(`可选：填写审批备注（状态：${statusText}）`, '') || '').trim();
    }

    const result = await ERP.updatePurchaseApproval(logId, safeStatus, note);
    if (!result) {
        return;
    }

    await loadPurchaseRecords(120);
    updateStatistics();
    if (typeof showToast === 'function') {
        showToast(`采购审批已更新为：${statusText}`, 'success');
    }
}

function showPurchaseApprovalLog(logId) {
    const target = (Array.isArray(purchaseLogState.records) ? purchaseLogState.records : [])
        .find(item => String(item?.id) === String(logId));
    if (!target) {
        alert('未找到采购记录，请刷新后重试');
        return;
    }

    const meta = parsePurchaseMetaFromNotes(target?.notes || '');
    const orderNo = String(meta['采购单号'] || `CG-LOG-${target?.id || '-'}`).trim();
    const history = parsePurchaseApprovalHistory(meta['审批日志'] || '');
    const currentStatus = formatPurchaseApprovalStatus(meta['审批'] || 'approved');
    const operator = String(meta['审批人'] || '').trim() || '-';
    const approvalTime = String(meta['审批时间'] || '').trim() || '-';
    const approvalNote = String(meta['审批备注'] || '').trim() || '-';
    const rollbackStatus = String(meta['冲销状态'] || '').trim() || '-';
    const rollbackTime = String(meta['冲销时间'] || '').trim() || '-';
    const rollbackNote = String(meta['冲销备注'] || '').trim() || '-';

    const historyText = history.length
        ? history.map((item, index) => `${index + 1}. ${item.time} | ${formatPurchaseApprovalStatus(item.status)} | ${item.operator || '-'} | ${item.note || '-'}`).join('\n')
        : '暂无审批日志';

    alert([
        `采购单号：${orderNo}`,
        `当前审批：${currentStatus}`,
        `审批人：${operator}`,
        `审批时间：${approvalTime}`,
        `审批备注：${approvalNote}`,
        `冲销状态：${rollbackStatus}`,
        `冲销时间：${rollbackTime}`,
        `冲销备注：${rollbackNote}`,
        '--- 审批日志 ---',
        historyText
    ].join('\n'));
}

function searchInventory() {
    const keyword = document.getElementById('inventorySearch').value.toLowerCase();
    const filtered = ERP.state.products.filter(product =>
        product.name.toLowerCase().includes(keyword) ||
        (product.sku && product.sku.toLowerCase().includes(keyword)) ||
        (product.category && product.category.toLowerCase().includes(keyword))
    );
    renderInventory(filtered);
}

// ==================== 财务管理 ====================
function showFinanceModal() {
    const modal = document.getElementById('financeModal');
    if (!modal) {
        console.error('[ERP Ant] 找不到 financeModal 元素');
        return;
    }

    const form = document.getElementById('financeForm');

    form.reset();
    document.getElementById('financeId').value = '';
    // 设置当前日期时间，格式：YYYY-MM-DDTHH:MM (datetime-local格式)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('financeTransactionDate').value = `${year}-${month}-${day}T${hours}:${minutes}`;
    document.getElementById('financeType').value = 'income';

    modal.classList.add('active');
    modal.style.display = 'flex';
}

function hideFinanceModal() {
    const modal = document.getElementById('financeModal');
    modal.classList.remove('active');
    modal.style.display = '';
}

async function saveFinance() {
    // 处理日期时间格式，确保使用本地时间
    let transactionDate = document.getElementById('financeTransactionDate').value;
    // 如果是 datetime-local 格式 (YYYY-MM-DDTHH:MM)，转换为数据库格式 (YYYY-MM-DD HH:MM:SS)
    if (transactionDate.includes('T')) {
        // 使用本地时间，避免时区转换问题
        const date = new Date(transactionDate);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        transactionDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        erpDebugLog('info', '[ERP Ant] 保存的本地时间:', transactionDate);
    }

    const financeData = {
        type: document.getElementById('financeType').value,
        category: document.getElementById('financeCategory').value,
        amount: parseFloat(document.getElementById('financeAmount').value),
        description: document.getElementById('financeDescription').value,
        transaction_date: transactionDate
    };

    if (!financeData.amount) {
        alert('请输入金额');
        return;
    }

    const saveBtn = document.querySelector('#financeModal .ant-btn-primary');
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = '保存中...';

    try {
        // 先关闭模态框，然后异步保存
        hideFinanceModal();
        
        // 保存到数据库
        const result = await ERP.addFinance(financeData);
        erpDebugLog('info', '[ERP Ant] 财务记录已保存: ', result);
        
        if (result) {
            // 重新加载数据并更新显示
            const finances = await ERP.loadFinances(true);
            erpDebugLog('info', '[ERP Ant] 重新加载财务数据条数: ', finances.length);
            syncFinanceViewRows(finances, 'all');
            renderFinances(finances);
            updateStatistics();
            
            if (typeof showToast === 'function') {
                showToast('财务记录保存成功', 'success');
            }
        }
    } catch (error) {
        console.error('[ERP Ant] 保存财务记录失败:', error);
        if (typeof showToast === 'function') {
            showToast('保存失败：' + (error.message || '网络错误，请检查连接'), 'error');
        }
        // 重新加载数据
        const finances = await ERP.loadFinances(true);
        syncFinanceViewRows(finances, 'all');
        renderFinances(finances);
        updateStatistics();
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
}

async function deleteFinance(financeId) {
        erpDebugLog('info', '[ERP Ant] 删除财务记录请求: financeId=', financeId);
        if (!confirm('确定要删除这条财务记录吗？')) {
            return;
        }
        
        // 防止重复调用
        if (window.deletingFinance) {
            erpDebugLog('info', '[ERP Ant] 删除操作正在进行中，忽略重复调用');
            return;
        }
        window.deletingFinance = true;
        try {
            await ERP.deleteFinance(financeId);
            erpDebugLog('info', '[ERP Ant] 删除财务记录已提交到后端: ', financeId);
            const finances = await ERP.loadFinances(true);
            erpDebugLog('info', '[ERP Ant] 重新加载财务数据条数: ', finances.length);
            erpDebugLog('info', '[ERP Ant] 调用 renderFinances 函数，数据: ', finances);
            
            // 检查 renderFinances 函数是否存在
            if (typeof renderFinances === 'function') {
                erpDebugLog('info', '[ERP Ant] renderFinances 函数存在，正在调用...');
                syncFinanceViewRows(finances, 'all');
                renderFinances(finances);
                erpDebugLog('info', '[ERP Ant] renderFinances 调用完成');
            } else {
                console.error('[ERP Ant] renderFinances 函数不存在！');
            }
            
            updateStatistics();
        } catch (error) {
            console.error('[ERP Ant] 删除财务记录失败（数据库调用异常）:', {
                financeId,
                name: error?.name,
                message: error?.message,
                stack: error?.stack
            });
            if (typeof showToast === 'function') {
                showToast('删除财务记录失败: ' + (error?.message ?? '未知错误'), 'error');
            }
        } finally {
            window.deletingFinance = false;
        }
}

function searchFinances() {
    applyFinanceFilters();
}

function filterFinancesByMonth() {
    applyFinanceFilters();
}

function parseFinanceDate(value) {
    const raw = String(value || '').trim();
    if (!raw) {
        return null;
    }

    const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
}

function getFinanceRangeFromPreset(preset) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    switch (preset) {
        case 'yesterday': {
            const start = new Date(todayStart);
            start.setDate(start.getDate() - 1);
            const end = new Date(todayEnd);
            end.setDate(end.getDate() - 1);
            return { start, end };
        }
        case 'last7': {
            const start = new Date(todayStart);
            start.setDate(start.getDate() - 6);
            return { start, end: todayEnd };
        }
        case 'last30': {
            const start = new Date(todayStart);
            start.setDate(start.getDate() - 29);
            return { start, end: todayEnd };
        }
        case 'thisMonth': {
            const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            return { start, end: todayEnd };
        }
        default:
            return { start: null, end: null };
    }
}

function applyFinanceFilters() {
    const keyword = String(document.getElementById('financeSearch')?.value || '').trim().toLowerCase();
    const rangePreset = String(document.getElementById('financeDateRange')?.value || 'all');
    const customStart = String(document.getElementById('financeDateStart')?.value || '').trim();
    const customEnd = String(document.getElementById('financeDateEnd')?.value || '').trim();

    let startDate = null;
    let endDate = null;

    if (rangePreset === 'custom') {
        if (customStart) {
            startDate = new Date(`${customStart}T00:00:00`);
        }
        if (customEnd) {
            endDate = new Date(`${customEnd}T23:59:59.999`);
        }
    } else {
        const range = getFinanceRangeFromPreset(rangePreset);
        startDate = range.start;
        endDate = range.end;
    }

    const orders = Array.isArray(ERP.state?.orders) ? ERP.state.orders : [];
    const customers = Array.isArray(ERP.state?.customers) ? ERP.state.customers : [];
    const orderMap = new Map(orders.map(item => [String(item?.id), item]));
    const customerMap = new Map(customers.map(item => [String(item?.id), item]));

    const filtered = (ERP.state.finances || []).filter(finance => {
        const targetDate = parseFinanceDate(finance?.transaction_date);
        if ((startDate || endDate) && !targetDate) {
            return false;
        }

        const linkedOrderId = finance?.order_id || finance?.reference_id;
        const linkedOrder = linkedOrderId ? orderMap.get(String(linkedOrderId)) : null;
        const linkedCustomer = linkedOrder ? customerMap.get(String(linkedOrder.customer_id)) : null;

        const keywordSource = [
            finance?.description,
            finance?.category,
            finance?.reference_id,
            finance?.order_id,
            linkedOrder?.order_number,
            linkedCustomer?.name
        ]
            .map(item => String(item || '').toLowerCase())
            .join(' ');

        const keywordMatch = !keyword || keywordSource.includes(keyword);
        const startMatch = !startDate || targetDate >= startDate;
        const endMatch = !endDate || targetDate <= endDate;

        return keywordMatch && startMatch && endMatch;
    });

    syncFinanceViewRows(filtered, rangePreset === 'all' && !keyword ? 'all' : 'filtered');
    renderFinances(filtered);
    renderFinanceAgingSummary();
}

function updateFinanceQuickRangeButtons() {
    const rangePreset = String(document.getElementById('financeDateRange')?.value || 'all');
    const buttons = document.querySelectorAll('[data-finance-range-btn]');
    buttons.forEach(button => {
        const buttonPreset = String(button.getAttribute('data-finance-range-btn') || '').trim();
        button.classList.toggle('is-active', buttonPreset === rangePreset);
    });
}

function setFinanceDateRangePreset(preset = 'all') {
    const rangeSelect = document.getElementById('financeDateRange');
    if (rangeSelect) {
        rangeSelect.value = String(preset || 'all');
    }
    onFinanceDateRangeChange();
}

function onFinanceDateRangeChange() {
    const rangePreset = String(document.getElementById('financeDateRange')?.value || 'all');
    const startInput = document.getElementById('financeDateStart');
    const endInput = document.getElementById('financeDateEnd');

    const isCustom = rangePreset === 'custom';
    if (startInput) {
        startInput.disabled = !isCustom;
    }
    if (endInput) {
        endInput.disabled = !isCustom;
    }

    if (!isCustom) {
        if (startInput) {
            startInput.value = '';
        }
        if (endInput) {
            endInput.value = '';
        }
    }

    updateFinanceQuickRangeButtons();
    applyFinanceFilters();
}

function resetFinanceFilters() {
    const rangeSelect = document.getElementById('financeDateRange');
    const startInput = document.getElementById('financeDateStart');
    const endInput = document.getElementById('financeDateEnd');
    const searchInput = document.getElementById('financeSearch');

    if (rangeSelect) {
        rangeSelect.value = 'all';
    }
    if (startInput) {
        startInput.value = '';
        startInput.disabled = true;
    }
    if (endInput) {
        endInput.value = '';
        endInput.disabled = true;
    }
    if (searchInput) {
        searchInput.value = '';
    }

    onFinanceDateRangeChange();
}

function initFinanceFilters() {
    const rangeSelect = document.getElementById('financeDateRange');
    const startInput = document.getElementById('financeDateStart');
    const endInput = document.getElementById('financeDateEnd');
    const reportMonthInput = document.getElementById('financeReportMonth');
    const dailyReportDateInput = document.getElementById('financeDailyReportDate');

    if (rangeSelect) {
        rangeSelect.value = 'all';
    }
    if (startInput) {
        startInput.value = '';
        startInput.disabled = true;
    }
    if (endInput) {
        endInput.value = '';
        endInput.disabled = true;
    }
    if (reportMonthInput && !reportMonthInput.value) {
        reportMonthInput.value = getCurrentYearMonthText();
    }
    if (dailyReportDateInput && !dailyReportDateInput.value) {
        const now = new Date();
        const dateText = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        dailyReportDateInput.value = dateText;
    }

    updateFinanceQuickRangeButtons();
    syncFinanceViewRows(Array.isArray(ERP.state?.finances) ? ERP.state.finances : [], 'all');
    applyFinanceFilters();
}

function calculateFinanceRiskAlerts(options = {}) {
    const overdueDays = Math.max(1, parseInt(options.overdueDays ?? 30, 10));
    const orders = Array.isArray(ERP.state?.orders) ? ERP.state.orders : [];
    const finances = Array.isArray(ERP.state?.finances) ? ERP.state.finances : [];
    const customers = Array.isArray(ERP.state?.customers) ? ERP.state.customers : [];
    const customerMap = new Map(customers.map(item => [String(item?.id), item]));

    const overdueReceivableRows = orders
        .map(order => {
            const paymentStatus = String(order?.payment_status || 'unpaid').toLowerCase();
            const orderStatus = String(order?.status || '').toLowerCase();
            if (paymentStatus === 'paid' || orderStatus === 'cancelled' || orderStatus === 'refunded') {
                return null;
            }

            const amount = Number(order?.total_amount || 0);
            const days = getAgingDays(order?.order_date);
            if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(days) || days <= overdueDays) {
                return null;
            }

            const customer = customerMap.get(String(order?.customer_id || '')) || null;
            return {
                id: order?.id,
                orderNumber: order?.order_number || `订单#${order?.id || '-'}`,
                customerName: customer?.name || '-',
                amount,
                days
            };
        })
        .filter(Boolean)
        .sort((left, right) => right.days - left.days);

    const overduePayableRows = finances
        .map(finance => {
            const category = String(finance?.category || '');
            if (!category.includes('应付账款')) {
                return null;
            }

            const amount = Math.abs(Number(finance?.amount || 0));
            const days = getAgingDays(finance?.transaction_date);
            if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(days) || days <= overdueDays) {
                return null;
            }

            const orderId = resolveFinanceOrderId(finance);
            const order = orderId !== null
                ? orders.find(item => String(item?.id) === String(orderId))
                : null;
            const customer = order ? customerMap.get(String(order?.customer_id || '')) : null;
            return {
                id: finance?.id,
                orderId,
                orderNumber: order?.order_number || (orderId !== null ? `订单#${orderId}` : '-'),
                customerName: customer?.name || '-',
                amount,
                days
            };
        })
        .filter(Boolean)
        .sort((left, right) => right.days - left.days);

    const overdueReceivableAmount = overdueReceivableRows.reduce((sum, item) => sum + item.amount, 0);
    const overduePayableAmount = overduePayableRows.reduce((sum, item) => sum + item.amount, 0);

    return {
        overdueDays,
        overdueReceivableRows,
        overduePayableRows,
        overdueReceivableCount: overdueReceivableRows.length,
        overduePayableCount: overduePayableRows.length,
        overdueReceivableAmount,
        overduePayableAmount,
        totalOverdueCount: overdueReceivableRows.length + overduePayableRows.length,
        totalOverdueAmount: overdueReceivableAmount + overduePayableAmount
    };
}

function renderFinanceRiskAlerts() {
    const container = document.getElementById('financeRiskAlerts');
    if (!container || !window.ERP) {
        return;
    }

    const risk = calculateFinanceRiskAlerts({ overdueDays: 30 });
    const overdueDaysText = `超过${risk.overdueDays}天`;

    const renderList = (rows, emptyText, tone = 'normal') => {
        const amountColor = tone === 'danger' ? '#cf1322' : '#ad6800';
        if (!rows.length) {
            return `<div style="font-size:12px;color:#8c8c8c;">${emptyText}</div>`;
        }
        return rows.slice(0, 6).map(item => `
            <div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px dashed #f0f0f0;">
                <div style="font-size:12px;color:#262626;">
                    <div>${item.orderNumber} / ${item.customerName}</div>
                    <div style="color:#8c8c8c;">账龄 ${item.days} 天</div>
                </div>
                <div style="font-size:12px;font-weight:600;color:${amountColor};">${formatCurrency(item.amount)}</div>
            </div>
        `).join('');
    };

    container.innerHTML = `
        <div style="flex:1;min-width:280px;padding:12px 14px;border:1px solid #ffd6e7;border-radius:8px;background:#fff1f8;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="font-size:14px;font-weight:600;color:#cf1322;">逾期应收预警（${overdueDaysText}）</div>
                <div style="font-size:12px;color:#cf1322;">${risk.overdueReceivableCount} 笔 / ${formatCurrency(risk.overdueReceivableAmount)}</div>
            </div>
            ${renderList(risk.overdueReceivableRows, '暂无逾期应收订单', 'danger')}
        </div>
        <div style="flex:1;min-width:280px;padding:12px 14px;border:1px solid #ffe7ba;border-radius:8px;background:#fff7e6;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="font-size:14px;font-weight:600;color:#ad6800;">逾期应付预警（${overdueDaysText}）</div>
                <div style="font-size:12px;color:#ad6800;">${risk.overduePayableCount} 笔 / ${formatCurrency(risk.overduePayableAmount)}</div>
            </div>
            ${renderList(risk.overduePayableRows, '暂无逾期应付记录', 'warning')}
        </div>
    `;
}

function renderDashboardBusinessCards() {
    const container = document.getElementById('dashboardBusinessCards');
    if (!container || !window.ERP) {
        return;
    }

    const orders = Array.isArray(ERP.state?.orders) ? ERP.state.orders : [];
    const finances = Array.isArray(ERP.state?.finances) ? ERP.state.finances : [];
    const diagnostics = getERPInventoryDiagnostics();
    const risk = calculateFinanceRiskAlerts({ overdueDays: 30 });
    const today = new Date();
    const todayDateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const isSameDay = value => {
        const date = parseFinanceDate(value);
        if (!date) {
            return false;
        }
        const dateText = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return dateText === todayDateString;
    };

    const todayOrdersCount = orders.filter(order => isSameDay(order?.order_date)).length;
    const todayReceivedAmount = finances
        .filter(finance => String(finance?.type || '').toLowerCase() === 'income')
        .filter(finance => String(finance?.category || '').includes('回款确认'))
        .filter(finance => isSameDay(finance?.transaction_date))
        .reduce((sum, finance) => sum + Math.abs(Number(finance?.amount || 0)), 0);

    const pendingReceivableAmount = orders
        .filter(order => {
            const paymentStatus = String(order?.payment_status || 'unpaid').toLowerCase();
            const status = String(order?.status || '').toLowerCase();
            return paymentStatus !== 'paid' && status !== 'cancelled' && status !== 'refunded';
        })
        .reduce((sum, order) => sum + Math.max(Number(order?.total_amount || 0), 0), 0);

    const pendingPayableAmount = finances
        .filter(finance => String(finance?.category || '').includes('应付账款'))
        .reduce((sum, finance) => sum + Math.abs(Number(finance?.amount || 0)), 0);

    const card = (title, value, subtitle, color = '#1677ff', bg = '#f0f5ff', border = '#adc6ff') => `
        <div style="flex:1;min-width:180px;padding:10px 12px;border:1px solid ${border};border-radius:8px;background:${bg};">
            <div style="font-size:12px;color:#8c8c8c;">${title}</div>
            <div style="font-size:20px;font-weight:600;color:${color};margin-top:4px;">${value}</div>
            <div style="font-size:12px;color:#8c8c8c;margin-top:2px;">${subtitle}</div>
        </div>
    `;

    container.innerHTML = `
        ${card('今日订单', `${todayOrdersCount} 笔`, '按下单日期统计', '#1d39c4', '#f0f5ff', '#adc6ff')}
        ${card('今日回款', formatCurrency(todayReceivedAmount), '仅统计回款确认', '#08979c', '#e6fffb', '#87e8de')}
        ${card('待回款', formatCurrency(pendingReceivableAmount), '未支付订单合计', '#cf1322', '#fff1f0', '#ffccc7')}
        ${card('待付款', formatCurrency(pendingPayableAmount), '应付账款余额', '#ad6800', '#fff7e6', '#ffe7ba')}
        ${card('库存预警', `${diagnostics.lowStockCount}/${diagnostics.rows.length}`, '库存 ≤ 商品预警值', '#7a3d00', '#fff7e6', '#ffd591')}
        ${card('逾期预警', `${risk.totalOverdueCount} 笔`, `超过30天，总额 ${formatCurrency(risk.totalOverdueAmount)}`, '#722ed1', '#f9f0ff', '#d3adf7')}
    `;
}

function buildSalesFunnelStats() {
    const orders = Array.isArray(ERP.state?.orders) ? ERP.state.orders : [];
    const normalizeStatus = value => String(value || '').trim().toLowerCase();
    const validOrders = orders.filter(order => {
        const status = normalizeStatus(order?.status);
        return status !== 'cancelled' && status !== 'refunded';
    });

    const counters = {
        pending: 0,
        confirmed: 0,
        transit: 0,
        completed: 0
    };

    validOrders.forEach(order => {
        const status = normalizeStatus(order?.status);
        if (status === 'pending') {
            counters.pending += 1;
            return;
        }
        if (status === 'confirmed') {
            counters.confirmed += 1;
            return;
        }
        if (status === 'shipped' || status === 'signed') {
            counters.transit += 1;
            return;
        }
        if (status === 'completed') {
            counters.completed += 1;
        }
    });

    const total = validOrders.length;
    const completedRate = total > 0 ? (counters.completed / total) : 0;
    const pendingOver3Days = validOrders.filter(order => normalizeStatus(order?.status) === 'pending')
        .filter(order => {
            const days = getAgingDays(order?.order_date);
            return Number.isFinite(days) && days > 3;
        }).length;

    return {
        total,
        pendingOver3Days,
        completedRate,
        steps: [
            { key: 'pending', title: '待审批', count: counters.pending, color: '#722ed1', bg: '#f9f0ff' },
            { key: 'confirmed', title: '待发货', count: counters.confirmed, color: '#1677ff', bg: '#f0f5ff' },
            { key: 'transit', title: '在途/已签收', count: counters.transit, color: '#d46b08', bg: '#fff7e6' },
            { key: 'completed', title: '已完成', count: counters.completed, color: '#237804', bg: '#f6ffed' }
        ]
    };
}

function renderDashboardSalesFunnel() {
    const container = document.getElementById('dashboardSalesFunnel');
    if (!container || !window.ERP) {
        return;
    }

    const funnel = buildSalesFunnelStats();
    const maxCount = Math.max(1, ...funnel.steps.map(step => step.count));
    const barsHtml = funnel.steps.map(step => {
        const widthPercent = Math.max(6, Math.round((step.count / maxCount) * 100));
        const ratioText = funnel.total > 0 ? `${((step.count / funnel.total) * 100).toFixed(1)}%` : '0.0%';
        return `
            <div style="margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;font-size:12px;color:#595959;">
                    <span>${step.title}</span>
                    <span>${step.count} 单（${ratioText}）</span>
                </div>
                <div style="height:10px;background:#f5f5f5;border-radius:999px;overflow:hidden;margin-top:4px;">
                    <div style="height:10px;background:${step.color};width:${widthPercent}%;"></div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div style="flex:1;min-width:320px;padding:12px 14px;border:1px solid #d9d9d9;border-radius:8px;background:#fff;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="font-size:14px;font-weight:600;color:#262626;">销售漏斗</div>
                <div style="font-size:12px;color:#8c8c8c;">有效订单 ${funnel.total} 笔</div>
            </div>
            ${barsHtml || '<div style="font-size:12px;color:#8c8c8c;">暂无订单数据</div>'}
            <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;font-size:12px;">
                <span class="ant-tag" style="margin:0;">完成率 ${(funnel.completedRate * 100).toFixed(1)}%</span>
                <span class="ant-tag" style="margin:0;">超3天待审批 ${funnel.pendingOver3Days} 单</span>
            </div>
        </div>
    `;
}

function parseAuditDetailObject(rawDetails) {
    if (window.ERP && typeof ERP.parseAuditDetails === 'function') {
        return ERP.parseAuditDetails(rawDetails);
    }

    if (rawDetails && typeof rawDetails === 'object') {
        return rawDetails;
    }

    if (typeof rawDetails === 'string') {
        try {
            return JSON.parse(rawDetails);
        } catch (error) {
            return {};
        }
    }

    return {};
}

function normalizeAuditOrderStatus(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) {
        return '';
    }
    if (window.ERP && typeof ERP.normalizeOrderStatus === 'function') {
        return ERP.normalizeOrderStatus(raw);
    }
    return normalizeOrderStatusValue(raw);
}

async function loadDashboardOrderStatusLogs(orderRows = []) {
    const orders = Array.isArray(orderRows) ? orderRows : [];
    const orderIds = orders
        .map(item => item?.id)
        .filter(id => id !== null && id !== undefined && String(id).trim() !== '');
    if (!orderIds.length || !window.supabaseClient || !userData?.user?.id) {
        dashboardOrderStatusLogCacheState.orderIdsKey = '';
        dashboardOrderStatusLogCacheState.rows = [];
        dashboardOrderStatusLogCacheState.loadedAt = Date.now();
        return [];
    }

    const key = orderIds.map(id => String(id)).sort().join(',');
    const now = Date.now();
    if (
        dashboardOrderStatusLogCacheState.orderIdsKey === key
        && Array.isArray(dashboardOrderStatusLogCacheState.rows)
        && (now - Number(dashboardOrderStatusLogCacheState.loadedAt || 0)) < 20000
    ) {
        return dashboardOrderStatusLogCacheState.rows;
    }

    if (dashboardOrderStatusLogCacheState.pendingPromise && dashboardOrderStatusLogCacheState.pendingKey === key) {
        return dashboardOrderStatusLogCacheState.pendingPromise;
    }

    const orderIdSet = new Set(orderIds.map(id => String(id)));
    const fetchPromise = (async () => {
        try {
            const { data, error } = await window.supabaseClient
                .from('erp_audit_logs')
                .select('entity_id, details, created_at, action, module, user_id, description')
                .eq('user_id', userData.user.id)
                .eq('module', 'orders')
                .eq('action', 'update_status')
                .order('created_at', { ascending: true })
                .limit(1500);

            if (error) {
                throw error;
            }

            const rows = (Array.isArray(data) ? data : [])
                .map(row => {
                    const details = parseAuditDetailObject(row?.details);
                    const orderId = row?.entity_id ?? details?.order_id ?? details?.before?.id ?? details?.after?.id ?? null;
                    if (orderId === null || orderId === undefined || !orderIdSet.has(String(orderId))) {
                        return null;
                    }

                    const toStatus = normalizeAuditOrderStatus(details?.after?.status || details?.to_status || row?.to_status || '');
                    const fromStatus = normalizeAuditOrderStatus(details?.before?.status || details?.from_status || row?.from_status || '');
                    const createdAt = parseFinanceDate(row?.created_at || row?.updated_at || '');
                    if (!createdAt || !toStatus) {
                        return null;
                    }
                    return {
                        orderId: String(orderId),
                        toStatus,
                        fromStatus,
                        createdAt
                    };
                })
                .filter(Boolean);

            dashboardOrderStatusLogCacheState.orderIdsKey = key;
            dashboardOrderStatusLogCacheState.rows = rows;
            dashboardOrderStatusLogCacheState.loadedAt = now;
            return rows;
        } catch (error) {
            console.error('[ERP] 首页交付时效日志加载失败:', error?.message || error);
            dashboardOrderStatusLogCacheState.orderIdsKey = key;
            dashboardOrderStatusLogCacheState.rows = [];
            dashboardOrderStatusLogCacheState.loadedAt = now;
            return [];
        }
    })();

    dashboardOrderStatusLogCacheState.pendingKey = key;
    dashboardOrderStatusLogCacheState.pendingPromise = fetchPromise;
    try {
        return await fetchPromise;
    } finally {
        if (dashboardOrderStatusLogCacheState.pendingPromise === fetchPromise) {
            dashboardOrderStatusLogCacheState.pendingPromise = null;
            dashboardOrderStatusLogCacheState.pendingKey = '';
        }
    }
}

function calculateOrderDeliveryPerformance(orders = [], logs = []) {
    const validOrders = (Array.isArray(orders) ? orders : []).filter(order => {
        const status = normalizeOrderStatusValue(order?.status || '');
        return status !== 'cancelled' && status !== 'refunded';
    });

    const logMap = new Map();
    (Array.isArray(logs) ? logs : []).forEach(log => {
        const key = String(log?.orderId || '');
        if (!key) {
            return;
        }
        if (!logMap.has(key)) {
            logMap.set(key, []);
        }
        logMap.get(key).push(log);
    });

    const deliveredDays = [];
    let inTransitCount = 0;
    let longTransitCount = 0;

    validOrders.forEach(order => {
        const orderId = String(order?.id || '');
        const orderDate = parseFinanceDate(order?.order_date);
        if (!orderDate) {
            return;
        }
        const status = normalizeOrderStatusValue(order?.status || '');
        const orderLogs = logMap.get(orderId) || [];

        const signedLog = orderLogs.find(item => item?.toStatus === 'signed')
            || orderLogs.find(item => item?.toStatus === 'completed');

        if (signedLog && (status === 'signed' || status === 'completed')) {
            const diffDays = Math.max(0, Math.floor((signedLog.createdAt.getTime() - orderDate.getTime()) / (24 * 60 * 60 * 1000)));
            deliveredDays.push(diffDays);
            return;
        }

        if (status === 'shipped' || status === 'signed') {
            inTransitCount += 1;
            const openDays = getAgingDays(order?.order_date);
            if (Number.isFinite(openDays) && openDays > 5) {
                longTransitCount += 1;
            }
        }
    });

    const calcAverage = rows => {
        if (!rows.length) {
            return 0;
        }
        return rows.reduce((sum, value) => sum + value, 0) / rows.length;
    };
    const safeDeliveredDays = deliveredDays.slice().sort((left, right) => left - right);
    const p80Index = safeDeliveredDays.length > 0 ? Math.floor((safeDeliveredDays.length - 1) * 0.8) : 0;
    const p80Days = safeDeliveredDays.length > 0 ? safeDeliveredDays[p80Index] : 0;

    const bucket = {
        d1: 0,
        d3: 0,
        d7: 0,
        d7p: 0
    };
    safeDeliveredDays.forEach(days => {
        if (days <= 1) {
            bucket.d1 += 1;
        } else if (days <= 3) {
            bucket.d3 += 1;
        } else if (days <= 7) {
            bucket.d7 += 1;
        } else {
            bucket.d7p += 1;
        }
    });

    const deliveredCount = safeDeliveredDays.length;
    const onTimeRate = deliveredCount > 0
        ? (safeDeliveredDays.filter(days => days <= 3).length / deliveredCount)
        : 0;

    return {
        orderCount: validOrders.length,
        deliveredCount,
        avgDays: calcAverage(safeDeliveredDays),
        p80Days,
        onTimeRate,
        inTransitCount,
        longTransitCount,
        bucket
    };
}

async function renderDashboardDeliveryPerformance() {
    const container = document.getElementById('dashboardDeliveryPerformance');
    if (!container || !window.ERP) {
        return;
    }

    const orders = Array.isArray(ERP.state?.orders) ? ERP.state.orders : [];
    container.innerHTML = `
        <div style="flex:1;min-width:320px;padding:12px 14px;border:1px solid #f0f0f0;border-radius:8px;background:#fff;">
            <div style="font-size:14px;font-weight:600;color:#262626;margin-bottom:8px;">订单交付时效</div>
            <div style="font-size:12px;color:#8c8c8c;">加载中...</div>
        </div>
    `;

    const logs = await loadDashboardOrderStatusLogs(orders);
    const perf = calculateOrderDeliveryPerformance(orders, logs);
    const totalDelivered = Math.max(perf.deliveredCount, 1);
    const bar = (label, value, color) => {
        const width = Math.max(6, Math.round((value / totalDelivered) * 100));
        return `
            <div style="margin-bottom:6px;">
                <div style="display:flex;justify-content:space-between;font-size:12px;color:#595959;">
                    <span>${label}</span>
                    <span>${value} 单</span>
                </div>
                <div style="height:8px;background:#f5f5f5;border-radius:999px;overflow:hidden;margin-top:3px;">
                    <div style="height:8px;background:${color};width:${width}%;"></div>
                </div>
            </div>
        `;
    };

    container.innerHTML = `
        <div style="flex:1;min-width:320px;padding:12px 14px;border:1px solid #bae0ff;border-radius:8px;background:#f0f5ff;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="font-size:14px;font-weight:600;color:#1d39c4;">订单交付时效</div>
                <div style="font-size:12px;color:#8c8c8c;">可计算签收 ${perf.deliveredCount} 单</div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:12px;margin-bottom:8px;">
                <span class="ant-tag" style="margin:0;">平均 ${perf.avgDays.toFixed(1)} 天</span>
                <span class="ant-tag" style="margin:0;">P80 ${perf.p80Days} 天</span>
                <span class="ant-tag" style="margin:0;">3天内签收率 ${(perf.onTimeRate * 100).toFixed(1)}%</span>
                <span class="ant-tag" style="margin:0;">在途超5天 ${perf.longTransitCount} 单</span>
            </div>
            ${bar('1天内签收', perf.bucket.d1, '#1677ff')}
            ${bar('2-3天签收', perf.bucket.d3, '#13c2c2')}
            ${bar('4-7天签收', perf.bucket.d7, '#faad14')}
            ${bar('7天以上签收', perf.bucket.d7p, '#f5222d')}
            <div style="margin-top:6px;font-size:12px;color:#8c8c8c;">在途订单 ${perf.inTransitCount} 单；基于订单状态变更日志计算</div>
        </div>
    `;
}

function calculateCustomerSegmentStats() {
    const orders = Array.isArray(ERP.state?.orders) ? ERP.state.orders : [];
    const customers = Array.isArray(ERP.state?.customers) ? ERP.state.customers : [];
    const customerMap = new Map(customers.map(item => [String(item?.id), item]));
    const profileMap = new Map();

    const ensureProfile = customerId => {
        const key = String(customerId || '');
        if (!profileMap.has(key)) {
            const customer = customerMap.get(key) || null;
            profileMap.set(key, {
                customerId: key,
                customerName: customer?.name || '-',
                orderCount: 0,
                amount: 0
            });
        }
        return profileMap.get(key);
    };

    orders.forEach(order => {
        const status = String(order?.status || '').toLowerCase();
        if (status === 'cancelled' || status === 'refunded') {
            return;
        }
        const customerId = order?.customer_id;
        if (customerId === null || customerId === undefined || String(customerId).trim() === '') {
            return;
        }
        const profile = ensureProfile(customerId);
        profile.orderCount += 1;
        profile.amount += Math.max(Number(order?.total_amount || 0), 0);
    });

    const classifyTier = profile => {
        if (profile.orderCount >= 10 || profile.amount >= 50000) return 'A';
        if (profile.orderCount >= 5 || profile.amount >= 10000) return 'B';
        if (profile.orderCount >= 1 || profile.amount > 0) return 'C';
        return '潜客';
    };

    const profiles = Array.from(profileMap.values()).map(item => ({
        ...item,
        tier: classifyTier(item)
    }));

    const tierCount = { A: 0, B: 0, C: 0, 潜客: 0 };
    profiles.forEach(profile => {
        if (Object.prototype.hasOwnProperty.call(tierCount, profile.tier)) {
            tierCount[profile.tier] += 1;
        }
    });

    const customersWithOrders = profiles.filter(item => item.orderCount > 0).length;
    const repeatCustomers = profiles.filter(item => item.orderCount >= 2).length;
    const repurchaseRate = customersWithOrders > 0 ? (repeatCustomers / customersWithOrders) : 0;

    return {
        tierCount,
        customersWithOrders,
        repeatCustomers,
        repurchaseRate,
        profiles: profiles.sort((left, right) => {
            const amountDiff = right.amount - left.amount;
            if (amountDiff !== 0) return amountDiff;
            return right.orderCount - left.orderCount;
        })
    };
}

function renderDashboardCustomerInsights() {
    const container = document.getElementById('dashboardCustomerInsights');
    if (!container || !window.ERP) {
        return;
    }

    const stats = calculateCustomerSegmentStats();
    const topCustomersHtml = stats.profiles
        .slice(0, 5)
        .map(item => `
            <div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px dashed #f0f0f0;">
                <div style="font-size:12px;color:#262626;">${item.customerName} <span style="color:#8c8c8c;">(${item.tier}层)</span></div>
                <div style="font-size:12px;color:#595959;">${item.orderCount} 单 / ${formatCurrency(item.amount)}</div>
            </div>
        `)
        .join('');

    container.innerHTML = `
        <div style="flex:1;min-width:320px;padding:12px 14px;border:1px solid #d6e4ff;border-radius:8px;background:#f0f5ff;">
            <div style="font-size:14px;font-weight:600;color:#1d39c4;margin-bottom:8px;">客户分层</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:12px;margin-bottom:8px;">
                <span class="ant-tag" style="margin:0;">A层 ${stats.tierCount.A}</span>
                <span class="ant-tag" style="margin:0;">B层 ${stats.tierCount.B}</span>
                <span class="ant-tag" style="margin:0;">C层 ${stats.tierCount.C}</span>
                <span class="ant-tag" style="margin:0;">复购客户 ${stats.repeatCustomers}</span>
                <span class="ant-tag" style="margin:0;">复购率 ${(stats.repurchaseRate * 100).toFixed(1)}%</span>
            </div>
            <div style="font-size:12px;color:#8c8c8c;margin-bottom:4px;">消费TOP客户</div>
            ${topCustomersHtml || '<div style="font-size:12px;color:#8c8c8c;">暂无客户成交数据</div>'}
        </div>
    `;
}

function calculateCustomerRiskAlerts(options = {}) {
    const warningDays = Math.max(1, parseInt(options.warningDays ?? 30, 10));
    const orders = Array.isArray(ERP.state?.orders) ? ERP.state.orders : [];
    const customers = Array.isArray(ERP.state?.customers) ? ERP.state.customers : [];
    const customerMap = new Map(customers.map(item => [String(item?.id), item]));
    const profileMap = new Map();

    orders.forEach(order => {
        const status = String(order?.status || '').toLowerCase();
        if (status === 'cancelled' || status === 'refunded') {
            return;
        }
        const customerId = order?.customer_id;
        if (customerId === null || customerId === undefined || String(customerId).trim() === '') {
            return;
        }
        const key = String(customerId);
        if (!profileMap.has(key)) {
            const customer = customerMap.get(key) || null;
            profileMap.set(key, {
                customerId: key,
                customerName: customer?.name || '-',
                orderCount: 0,
                amount: 0,
                latestDate: null
            });
        }
        const profile = profileMap.get(key);
        profile.orderCount += 1;
        profile.amount += Math.max(Number(order?.total_amount || 0), 0);
        const date = parseFinanceDate(order?.order_date);
        if (date && (!profile.latestDate || date.getTime() > profile.latestDate.getTime())) {
            profile.latestDate = date;
        }
    });

    const riskRows = Array.from(profileMap.values())
        .map(item => {
            const days = item.latestDate ? getAgingDays(item.latestDate.toISOString()) : null;
            return {
                ...item,
                days
            };
        })
        .filter(item => Number.isFinite(item.days) && item.days >= warningDays)
        .sort((left, right) => {
            const dayDiff = Number(right.days || 0) - Number(left.days || 0);
            if (dayDiff !== 0) return dayDiff;
            return Number(right.amount || 0) - Number(left.amount || 0);
        });

    const highValueRiskCount = riskRows.filter(item => Number(item.amount || 0) >= 10000).length;
    const totalRiskAmount = riskRows.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
        warningDays,
        riskRows,
        riskCount: riskRows.length,
        highValueRiskCount,
        totalRiskAmount
    };
}

function renderDashboardCustomerRiskAlerts() {
    const container = document.getElementById('dashboardCustomerRisk');
    if (!container || !window.ERP) {
        return;
    }

    const risk = calculateCustomerRiskAlerts({ warningDays: 30 });
    const listHtml = risk.riskRows
        .slice(0, 8)
        .map(item => `
            <div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px dashed #f0f0f0;">
                <div style="font-size:12px;color:#262626;">
                    <div>${item.customerName}</div>
                    <div style="color:#8c8c8c;">${item.days} 天未下单 / 历史 ${item.orderCount} 单</div>
                </div>
                <div style="font-size:12px;color:#cf1322;font-weight:600;">${formatCurrency(item.amount)}</div>
            </div>
        `)
        .join('');

    container.innerHTML = `
        <div style="flex:1;min-width:320px;padding:12px 14px;border:1px solid #ffccc7;border-radius:8px;background:#fff1f0;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="font-size:14px;font-weight:600;color:#cf1322;">客户流失预警（${risk.warningDays}天）</div>
                <div style="font-size:12px;color:#cf1322;">${risk.riskCount} 人</div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:12px;margin-bottom:8px;">
                <span class="ant-tag" style="margin:0;">高价值风险 ${risk.highValueRiskCount}</span>
                <span class="ant-tag" style="margin:0;">风险历史销售 ${formatCurrency(risk.totalRiskAmount)}</span>
            </div>
            ${listHtml || '<div style="font-size:12px;color:#8c8c8c;">暂无流失风险客户</div>'}
        </div>
    `;
}

async function loadDashboardOrderItems(orderRows = []) {
    const orders = Array.isArray(orderRows) ? orderRows : [];
    const orderIds = orders
        .map(item => item?.id)
        .filter(id => id !== null && id !== undefined && String(id).trim() !== '');
    if (!orderIds.length) {
        dashboardItemCacheState.orderIdsKey = '';
        dashboardItemCacheState.rows = [];
        dashboardItemCacheState.loadedAt = Date.now();
        return [];
    }

    const key = orderIds.map(id => String(id)).sort().join(',');
    const now = Date.now();
    if (
        dashboardItemCacheState.orderIdsKey === key
        && Array.isArray(dashboardItemCacheState.rows)
        && (now - Number(dashboardItemCacheState.loadedAt || 0)) < 10000
    ) {
        return dashboardItemCacheState.rows;
    }

    if (dashboardItemCacheState.pendingPromise && dashboardItemCacheState.pendingKey === key) {
        return dashboardItemCacheState.pendingPromise;
    }

    const fetchPromise = (async () => {
        try {
            if (window.supabaseClient && typeof window.supabaseClient.from === 'function') {
                const { data, error } = await window.supabaseClient
                    .from('erp_order_items')
                    .select('order_id, product_id, product_name, quantity, unit_price, unit_cost, total_cost, net_profit')
                    .in('order_id', orderIds);
                if (error) {
                    throw error;
                }
                const rows = Array.isArray(data) ? data : [];
                dashboardItemCacheState.orderIdsKey = key;
                dashboardItemCacheState.rows = rows;
                dashboardItemCacheState.loadedAt = now;
                return rows;
            }
        } catch (error) {
            console.error('[ERP] 首页商品明细加载失败:', error?.message || error);
        }

        const fallbackRows = orders.flatMap(order => {
            const items = Array.isArray(order?.items) ? order.items : [];
            return items.map(item => ({
                order_id: order?.id,
                product_id: item?.product_id,
                product_name: item?.product_name,
                quantity: item?.quantity,
                unit_price: item?.unit_price || item?.price,
                unit_cost: item?.unit_cost,
                total_cost: item?.total_cost,
                net_profit: item?.net_profit
            }));
        });

        dashboardItemCacheState.orderIdsKey = key;
        dashboardItemCacheState.rows = fallbackRows;
        dashboardItemCacheState.loadedAt = now;
        return fallbackRows;
    })();

    dashboardItemCacheState.pendingKey = key;
    dashboardItemCacheState.pendingPromise = fetchPromise;
    try {
        return await fetchPromise;
    } finally {
        if (dashboardItemCacheState.pendingPromise === fetchPromise) {
            dashboardItemCacheState.pendingPromise = null;
            dashboardItemCacheState.pendingKey = '';
        }
    }
}

async function renderDashboardTopProducts() {
    const container = document.getElementById('dashboardTopProducts');
    if (!container || !window.ERP) {
        return;
    }

    const orders = Array.isArray(ERP.state?.orders) ? ERP.state.orders : [];
    const products = Array.isArray(ERP.state?.products) ? ERP.state.products : [];
    const productMap = new Map(products.map(item => [String(item?.id), item]));
    const validOrders = orders.filter(order => {
        const status = String(order?.status || '').toLowerCase();
        return status !== 'cancelled' && status !== 'refunded';
    });

    container.innerHTML = `
        <div style="flex:1;min-width:320px;padding:12px 14px;border:1px solid #e6f4ff;border-radius:8px;background:#f6ffed;">
            <div style="font-size:14px;font-weight:600;color:#237804;margin-bottom:8px;">热销商品排行</div>
            <div style="font-size:12px;color:#8c8c8c;">加载中...</div>
        </div>
    `;

    const itemRows = await loadDashboardOrderItems(validOrders);
    const summaryMap = new Map();

    itemRows.forEach(item => {
        const quantity = Number(item?.quantity || 0);
        if (!Number.isFinite(quantity) || quantity <= 0) {
            return;
        }
        const productIdText = String(item?.product_id || '');
        const product = productMap.get(productIdText) || null;
        const productName = item?.product_name || product?.name || `商品#${productIdText || '-'}`;
        const key = productIdText || productName;
        if (!summaryMap.has(key)) {
            summaryMap.set(key, {
                productId: productIdText || null,
                productName,
                quantity: 0,
                revenue: 0
            });
        }
        const target = summaryMap.get(key);
        target.quantity += quantity;
        target.revenue += Math.max(Number(item?.unit_price || product?.price || 0), 0) * quantity;
    });

    const ranked = Array.from(summaryMap.values())
        .sort((left, right) => {
            const quantityDiff = right.quantity - left.quantity;
            if (quantityDiff !== 0) return quantityDiff;
            return right.revenue - left.revenue;
        })
        .slice(0, 8);

    const rankRowsHtml = ranked.map((item, index) => `
        <div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px dashed #f0f0f0;">
            <div style="font-size:12px;color:#262626;">${index + 1}. ${item.productName}</div>
            <div style="font-size:12px;color:#595959;">销量 ${item.quantity} / ${formatCurrency(item.revenue)}</div>
        </div>
    `).join('');

    container.innerHTML = `
        <div style="flex:1;min-width:320px;padding:12px 14px;border:1px solid #b7eb8f;border-radius:8px;background:#f6ffed;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="font-size:14px;font-weight:600;color:#237804;">热销商品排行</div>
                <div style="font-size:12px;color:#8c8c8c;">有效订单 ${validOrders.length} 笔</div>
            </div>
            ${rankRowsHtml || '<div style="font-size:12px;color:#8c8c8c;">暂无订单商品数据</div>'}
        </div>
    `;
}

function buildProductProfitRanking(itemRows = [], products = []) {
    const productMap = new Map((Array.isArray(products) ? products : []).map(item => [String(item?.id), item]));
    const summaryMap = new Map();

    (Array.isArray(itemRows) ? itemRows : []).forEach(item => {
        const quantity = Number(item?.quantity || 0);
        if (!Number.isFinite(quantity) || quantity <= 0) {
            return;
        }
        const productIdText = String(item?.product_id || '');
        const product = productMap.get(productIdText) || null;
        const productName = item?.product_name || product?.name || `商品#${productIdText || '-'}`;
        const unitPrice = Math.max(Number(item?.unit_price || product?.price || 0), 0);
        const revenue = unitPrice * quantity;
        const fallbackCost = Math.max(Number(item?.unit_cost || product?.cost || 0), 0) * quantity;
        const totalCost = Number.isFinite(Number(item?.total_cost)) ? Number(item.total_cost) : fallbackCost;
        const netProfit = Number.isFinite(Number(item?.net_profit))
            ? Number(item.net_profit)
            : (revenue - totalCost);
        const key = productIdText || productName;

        if (!summaryMap.has(key)) {
            summaryMap.set(key, {
                productId: productIdText || null,
                productName,
                quantity: 0,
                revenue: 0,
                cost: 0,
                profit: 0
            });
        }

        const target = summaryMap.get(key);
        target.quantity += quantity;
        target.revenue += revenue;
        target.cost += totalCost;
        target.profit += netProfit;
    });

    return Array.from(summaryMap.values())
        .sort((left, right) => {
            const profitDiff = right.profit - left.profit;
            if (profitDiff !== 0) return profitDiff;
            return right.revenue - left.revenue;
        });
}

async function renderDashboardProfitProducts() {
    const container = document.getElementById('dashboardProfitProducts');
    if (!container || !window.ERP) {
        return;
    }

    const orders = Array.isArray(ERP.state?.orders) ? ERP.state.orders : [];
    const products = Array.isArray(ERP.state?.products) ? ERP.state.products : [];
    const validOrders = orders.filter(order => {
        const status = String(order?.status || '').toLowerCase();
        return status !== 'cancelled' && status !== 'refunded';
    });

    container.innerHTML = `
        <div style="flex:1;min-width:320px;padding:12px 14px;border:1px solid #f0f0f0;border-radius:8px;background:#fff;">
            <div style="font-size:14px;font-weight:600;color:#262626;margin-bottom:8px;">商品利润排行</div>
            <div style="font-size:12px;color:#8c8c8c;">加载中...</div>
        </div>
    `;

    const itemRows = await loadDashboardOrderItems(validOrders);
    const ranking = buildProductProfitRanking(itemRows, products).slice(0, 8);
    const totalProfit = ranking.reduce((sum, item) => sum + Number(item?.profit || 0), 0);

    const rowsHtml = ranking.map((item, index) => {
        const margin = item.revenue > 0 ? ((item.profit / item.revenue) * 100) : 0;
        const positive = item.profit >= 0;
        return `
            <div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px dashed #f0f0f0;">
                <div style="font-size:12px;color:#262626;">${index + 1}. ${item.productName}</div>
                <div style="text-align:right;font-size:12px;color:${positive ? '#237804' : '#d46b08'};">
                    <div>利润 ${formatCurrency(item.profit)}</div>
                    <div style="color:#8c8c8c;">毛利率 ${margin.toFixed(1)}%</div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div style="flex:1;min-width:320px;padding:12px 14px;border:1px solid #d9f7be;border-radius:8px;background:#f6ffed;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="font-size:14px;font-weight:600;color:#237804;">商品利润排行</div>
                <div style="font-size:12px;color:#8c8c8c;">TOP利润 ${formatCurrency(totalProfit)}</div>
            </div>
            ${rowsHtml || '<div style="font-size:12px;color:#8c8c8c;">暂无可计算利润数据</div>'}
        </div>
    `;
}

function calculateCustomerLifecycleStats() {
    const orders = Array.isArray(ERP.state?.orders) ? ERP.state.orders : [];
    const customers = Array.isArray(ERP.state?.customers) ? ERP.state.customers : [];
    const customerMap = new Map(customers.map(item => [String(item?.id), item]));
    const profileMap = new Map();

    orders.forEach(order => {
        const status = String(order?.status || '').toLowerCase();
        if (status === 'cancelled' || status === 'refunded') {
            return;
        }
        const customerId = order?.customer_id;
        if (customerId === null || customerId === undefined || String(customerId).trim() === '') {
            return;
        }
        const key = String(customerId);
        if (!profileMap.has(key)) {
            const customer = customerMap.get(key) || null;
            profileMap.set(key, {
                customerId: key,
                customerName: customer?.name || '-',
                firstDate: null,
                lastDate: null,
                orderCount: 0,
                totalAmount: 0
            });
        }

        const profile = profileMap.get(key);
        const date = parseFinanceDate(order?.order_date);
        if (date && (!profile.firstDate || date.getTime() < profile.firstDate.getTime())) {
            profile.firstDate = date;
        }
        if (date && (!profile.lastDate || date.getTime() > profile.lastDate.getTime())) {
            profile.lastDate = date;
        }
        profile.orderCount += 1;
        profile.totalAmount += Math.max(Number(order?.total_amount || 0), 0);
    });

    const rows = Array.from(profileMap.values()).map(item => {
        const firstDays = item.firstDate ? getAgingDays(item.firstDate.toISOString()) : null;
        const lastDays = item.lastDate ? getAgingDays(item.lastDate.toISOString()) : null;
        let stage = '观察';
        if (Number.isFinite(firstDays) && firstDays <= 30 && item.orderCount <= 2) {
            stage = '新客';
        } else if (Number.isFinite(lastDays) && lastDays <= 30) {
            stage = '活跃';
        } else if (Number.isFinite(lastDays) && lastDays > 30) {
            stage = '沉睡';
        }
        return {
            ...item,
            firstDays,
            lastDays,
            stage
        };
    });

    const summary = {
        totalCustomers: rows.length,
        newCustomers: rows.filter(item => item.stage === '新客').length,
        activeCustomers: rows.filter(item => item.stage === '活跃').length,
        sleepingCustomers: rows.filter(item => item.stage === '沉睡').length
    };

    return {
        summary,
        rows: rows.sort((left, right) => {
            const leftTime = left.lastDate ? left.lastDate.getTime() : 0;
            const rightTime = right.lastDate ? right.lastDate.getTime() : 0;
            if (rightTime !== leftTime) return rightTime - leftTime;
            return Number(right.totalAmount || 0) - Number(left.totalAmount || 0);
        })
    };
}

function renderDashboardCustomerLifecycle() {
    const container = document.getElementById('dashboardCustomerLifecycle');
    if (!container || !window.ERP) {
        return;
    }

    const lifecycle = calculateCustomerLifecycleStats();
    const formatDateText = date => {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
            return '-';
        }
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    const rowsHtml = lifecycle.rows
        .slice(0, 8)
        .map(item => `
            <div style="padding:6px 0;border-bottom:1px dashed #f0f0f0;">
                <div style="display:flex;justify-content:space-between;gap:10px;">
                    <div style="font-size:12px;color:#262626;">${item.customerName}</div>
                    <div style="font-size:12px;color:${item.stage === '沉睡' ? '#d46b08' : '#1677ff'};">${item.stage}</div>
                </div>
                <div style="font-size:12px;color:#8c8c8c;margin-top:2px;">
                    首单 ${formatDateText(item.firstDate)} → 最近 ${formatDateText(item.lastDate)}（${Number.isFinite(item.lastDays) ? `${item.lastDays}天前` : '-'}）
                </div>
                <div style="font-size:12px;color:#595959;">累计 ${item.orderCount} 单 / ${formatCurrency(item.totalAmount)}</div>
            </div>
        `)
        .join('');

    container.innerHTML = `
        <div style="flex:1;min-width:320px;padding:12px 14px;border:1px solid #d6e4ff;border-radius:8px;background:#f0f5ff;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="font-size:14px;font-weight:600;color:#1d39c4;">客户生命周期</div>
                <div style="font-size:12px;color:#8c8c8c;">客户 ${lifecycle.summary.totalCustomers} 人</div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:12px;margin-bottom:8px;">
                <span class="ant-tag" style="margin:0;">新客 ${lifecycle.summary.newCustomers}</span>
                <span class="ant-tag" style="margin:0;">活跃 ${lifecycle.summary.activeCustomers}</span>
                <span class="ant-tag" style="margin:0;">沉睡 ${lifecycle.summary.sleepingCustomers}</span>
            </div>
            ${rowsHtml || '<div style="font-size:12px;color:#8c8c8c;">暂无客户生命周期数据</div>'}
        </div>
    `;
}

function getRfmRecencyScore(days) {
    if (!Number.isFinite(days)) return 1;
    if (days <= 7) return 5;
    if (days <= 15) return 4;
    if (days <= 30) return 3;
    if (days <= 60) return 2;
    return 1;
}

function getRfmFrequencyScore(count) {
    const value = Number(count || 0);
    if (value >= 10) return 5;
    if (value >= 6) return 4;
    if (value >= 3) return 3;
    if (value >= 2) return 2;
    return 1;
}

function getRfmMonetaryScore(amount) {
    const value = Number(amount || 0);
    if (value >= 50000) return 5;
    if (value >= 20000) return 4;
    if (value >= 10000) return 3;
    if (value >= 3000) return 2;
    return 1;
}

function getRfmSegmentLabel(totalScore) {
    if (totalScore >= 13) return '核心价值';
    if (totalScore >= 10) return '成长维护';
    if (totalScore >= 7) return '普通维系';
    return '召回预警';
}

function calculateCustomerRfmStats() {
    const orders = Array.isArray(ERP.state?.orders) ? ERP.state.orders : [];
    const customers = Array.isArray(ERP.state?.customers) ? ERP.state.customers : [];
    const customerMap = new Map(customers.map(item => [String(item?.id), item]));
    const profileMap = new Map();

    orders.forEach(order => {
        const status = normalizeOrderStatusValue(order?.status || '');
        if (status === 'cancelled' || status === 'refunded') {
            return;
        }
        const customerId = order?.customer_id;
        if (customerId === null || customerId === undefined || String(customerId).trim() === '') {
            return;
        }

        const key = String(customerId);
        if (!profileMap.has(key)) {
            const customer = customerMap.get(key) || null;
            profileMap.set(key, {
                customerId: key,
                customerName: customer?.name || '-',
                frequency: 0,
                monetary: 0,
                lastDate: null
            });
        }

        const profile = profileMap.get(key);
        profile.frequency += 1;
        profile.monetary += Math.max(Number(order?.total_amount || 0), 0);
        const orderDate = parseFinanceDate(order?.order_date);
        if (orderDate && (!profile.lastDate || orderDate.getTime() > profile.lastDate.getTime())) {
            profile.lastDate = orderDate;
        }
    });

    const rows = Array.from(profileMap.values()).map(item => {
        const recencyDays = item.lastDate ? getAgingDays(item.lastDate.toISOString()) : null;
        const scoreR = getRfmRecencyScore(recencyDays);
        const scoreF = getRfmFrequencyScore(item.frequency);
        const scoreM = getRfmMonetaryScore(item.monetary);
        const totalScore = scoreR + scoreF + scoreM;
        const segment = getRfmSegmentLabel(totalScore);
        return {
            ...item,
            recencyDays,
            scoreR,
            scoreF,
            scoreM,
            totalScore,
            segment
        };
    });

    const summary = {
        totalCustomers: rows.length,
        highValue: rows.filter(item => item.segment === '核心价值').length,
        growth: rows.filter(item => item.segment === '成长维护').length,
        normal: rows.filter(item => item.segment === '普通维系').length,
        risk: rows.filter(item => item.segment === '召回预警').length
    };

    return {
        summary,
        rows: rows.sort((left, right) => {
            const scoreDiff = Number(right.totalScore || 0) - Number(left.totalScore || 0);
            if (scoreDiff !== 0) return scoreDiff;
            return Number(right.monetary || 0) - Number(left.monetary || 0);
        })
    };
}

function renderDashboardCustomerRfm() {
    const container = document.getElementById('dashboardCustomerRfm');
    if (!container || !window.ERP) {
        return;
    }

    const rfm = calculateCustomerRfmStats();
    const rowsHtml = rfm.rows.slice(0, 10).map(item => `
        <div style="padding:6px 0;border-bottom:1px dashed #f0f0f0;">
            <div style="display:flex;justify-content:space-between;gap:10px;">
                <div style="font-size:12px;color:#262626;">${item.customerName}</div>
                <div style="font-size:12px;color:${item.totalScore >= 13 ? '#237804' : (item.totalScore >= 10 ? '#1677ff' : (item.totalScore >= 7 ? '#d46b08' : '#cf1322'))};">${item.segment}</div>
            </div>
            <div style="font-size:12px;color:#8c8c8c;margin-top:2px;">
                R${item.scoreR} F${item.scoreF} M${item.scoreM} | 最近${Number.isFinite(item.recencyDays) ? `${item.recencyDays}天` : '-'} | ${item.frequency}单 / ${formatCurrency(item.monetary)}
            </div>
        </div>
    `).join('');

    container.innerHTML = `
        <div style="flex:1;min-width:320px;padding:12px 14px;border:1px solid #efdbff;border-radius:8px;background:#f9f0ff;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="font-size:14px;font-weight:600;color:#531dab;">客户RFM评分</div>
                <div style="font-size:12px;color:#8c8c8c;">客户 ${rfm.summary.totalCustomers} 人</div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:12px;margin-bottom:8px;">
                <span class="ant-tag" style="margin:0;">核心 ${rfm.summary.highValue}</span>
                <span class="ant-tag" style="margin:0;">成长 ${rfm.summary.growth}</span>
                <span class="ant-tag" style="margin:0;">维系 ${rfm.summary.normal}</span>
                <span class="ant-tag" style="margin:0;">召回 ${rfm.summary.risk}</span>
            </div>
            ${rowsHtml || '<div style="font-size:12px;color:#8c8c8c;">暂无可评分客户</div>'}
        </div>
    `;
}

function normalizePurchasePaymentStatus(value) {
    const text = String(value || '').trim().toLowerCase();
    if (text === 'partial' || text === 'partially_paid') return 'partial';
    if (text === 'unpaid') return 'unpaid';
    return 'paid';
}

function normalizePurchaseApprovalStatus(value) {
    const text = String(value || '').trim().toLowerCase();
    if (text === 'pending') return 'pending';
    if (text === 'rejected') return 'rejected';
    return 'approved';
}

function formatPurchaseApprovalStatus(status) {
    const safeStatus = normalizePurchaseApprovalStatus(status);
    if (safeStatus === 'pending') return '待审批';
    if (safeStatus === 'rejected') return '已驳回';
    return '已通过';
}

function isCurrentUserPurchaseApprover() {
    if (!window.ERP || typeof ERP.isCurrentUserAdmin !== 'function') {
        return true;
    }
    try {
        return !!ERP.isCurrentUserAdmin();
    } catch (error) {
        console.error('[ERP] 审批权限检查失败:', error?.message || error);
        return false;
    }
}

function parsePurchaseApprovalHistory(raw = '') {
    const text = String(raw || '').trim();
    if (!text) {
        return [];
    }
    return text
        .split('##')
        .map(chunk => String(chunk || '').trim())
        .filter(Boolean)
        .map(chunk => {
            const [time = '', status = '', operator = '', note = ''] = chunk.split('@');
            return {
                time: String(time || '').trim(),
                status: normalizePurchaseApprovalStatus(status),
                operator: String(operator || '').trim(),
                note: String(note || '').trim()
            };
        })
        .filter(item => item.time);
}

function parsePurchaseRecordForDashboard(record, productMap = new Map()) {
    const meta = parsePurchaseMetaFromNotes(record?.notes);
    const productFromState = productMap.get(String(record?.product_id || '')) || null;
    const fallbackOrderNo = record?.id ? `CG-LOG-${record.id}` : 'CG-UNKNOWN';
    const purchaseOrderNo = String(meta['采购单号'] || fallbackOrderNo).trim() || fallbackOrderNo;
    const productName = String(meta['商品'] || productFromState?.name || `商品#${record?.product_id || '-'}`);
    const quantityRaw = Number(meta['数量'] ?? Math.abs(Number(record?.quantity_change || 0)));
    const quantity = Number.isFinite(quantityRaw) ? Math.abs(quantityRaw) : 0;
    const unitCostRaw = Number(meta['单价'] ?? 0);
    const unitCost = Number.isFinite(unitCostRaw) ? Math.max(unitCostRaw, 0) : 0;
    const amountRaw = Number(meta['总额'] ?? (quantity * unitCost));
    const amount = Number.isFinite(amountRaw) ? Math.max(amountRaw, 0) : 0;
    const paymentStatus = normalizePurchasePaymentStatus(meta['付款'] || 'paid');
    const approvalStatus = normalizePurchaseApprovalStatus(meta['审批'] || 'approved');
    const approvalOperator = String(meta['审批人'] || '').trim();
    const approvalTime = parseFinanceDate(meta['审批时间'] || '');
    const approvalNote = String(meta['审批备注'] || '').trim();
    const approvalHistoryRaw = String(meta['审批日志'] || '').trim();
    const rollbackStatus = String(meta['冲销状态'] || '').trim();
    const rollbackTime = parseFinanceDate(meta['冲销时间'] || '');
    const rollbackNote = String(meta['冲销备注'] || '').trim();
    const paidAmountRaw = Number(meta['已付']);
    const payableAmountRaw = Number(meta['待付']);
    const paidAmount = Number.isFinite(paidAmountRaw)
        ? Math.max(paidAmountRaw, 0)
        : (paymentStatus === 'paid' ? amount : 0);
    const payableAmount = Number.isFinite(payableAmountRaw)
        ? Math.max(payableAmountRaw, 0)
        : Math.max(amount - paidAmount, 0);
    const supplier = String(meta['供应商'] || '').trim() || '未填写供应商';
    const note = String(meta['备注'] || '').trim();
    const purchaseDate = parseFinanceDate(meta['时间'] || record?.created_at || '');

    return {
        id: record?.id,
        purchaseOrderNo,
        productId: record?.product_id,
        productName,
        quantity,
        unitCost,
        amount,
        supplier,
        paymentStatus,
        approvalStatus,
        approvalOperator,
        approvalTime,
        approvalNote,
        approvalHistoryRaw,
        paidAmount,
        payableAmount,
        rollbackStatus,
        rollbackTime,
        rollbackNote,
        note,
        purchaseDate
    };
}

async function ensureDashboardPurchaseRecords(limit = 300) {
    const cacheFresh = (Date.now() - Number(dashboardPurchaseCacheState.loadedAt || 0)) < 20000;
    if (Array.isArray(dashboardPurchaseCacheState.rows) && dashboardPurchaseCacheState.rows.length > 0 && cacheFresh) {
        return dashboardPurchaseCacheState.rows;
    }

    if (Array.isArray(purchaseLogState.records) && purchaseLogState.records.length > 0) {
        dashboardPurchaseCacheState.rows = [...purchaseLogState.records];
        dashboardPurchaseCacheState.loadedAt = Date.now();
        return dashboardPurchaseCacheState.rows;
    }

    if (dashboardPurchaseCacheState.pendingPromise) {
        return dashboardPurchaseCacheState.pendingPromise;
    }

    if (!window.ERP || typeof ERP.loadPurchaseLogs !== 'function') {
        return [];
    }

    const promise = (async () => {
        try {
            const logs = await ERP.loadPurchaseLogs(limit);
            const rows = Array.isArray(logs) ? logs : [];
            purchaseLogState.records = rows;
            dashboardPurchaseCacheState.rows = [...rows];
            dashboardPurchaseCacheState.loadedAt = Date.now();
            return rows;
        } catch (error) {
            console.error('[ERP] 首页采购记录加载失败:', error?.message || error);
            return [];
        }
    })();

    dashboardPurchaseCacheState.pendingPromise = promise;
    try {
        return await promise;
    } finally {
        if (dashboardPurchaseCacheState.pendingPromise === promise) {
            dashboardPurchaseCacheState.pendingPromise = null;
        }
    }
}

function calculateSupplierPerformanceStats(purchaseRows = []) {
    const groupMap = new Map();
    (Array.isArray(purchaseRows) ? purchaseRows : []).forEach(row => {
        const supplier = String(row?.supplier || '').trim() || '未填写供应商';
        if (!groupMap.has(supplier)) {
            groupMap.set(supplier, {
                supplier,
                count: 0,
                quantity: 0,
                amount: 0,
                paidAmount: 0,
                payableAmount: 0,
                lastDate: null
            });
        }
        const target = groupMap.get(supplier);
        target.count += 1;
        target.quantity += Math.max(Number(row?.quantity || 0), 0);
        target.amount += Math.max(Number(row?.amount || 0), 0);
        target.paidAmount += Math.max(Number(row?.paidAmount || 0), 0);
        target.payableAmount += Math.max(Number(row?.payableAmount || 0), 0);
        const date = row?.purchaseDate instanceof Date ? row.purchaseDate : null;
        if (date && (!target.lastDate || date.getTime() > target.lastDate.getTime())) {
            target.lastDate = date;
        }
    });

    const rows = Array.from(groupMap.values()).map(item => {
        const paidRatio = item.amount > 0 ? (item.paidAmount / item.amount) : 1;
        const lastDays = item.lastDate ? getAgingDays(item.lastDate.toISOString()) : null;
        const recencyScore = !Number.isFinite(lastDays)
            ? 5
            : (lastDays <= 30 ? 20 : (lastDays <= 60 ? 15 : (lastDays <= 90 ? 10 : 5)));
        const score = Math.round(
            Math.min(60, paidRatio * 60)
            + Math.min(20, item.count * 2)
            + recencyScore
        );
        const grade = score >= 85 ? 'A' : (score >= 70 ? 'B' : (score >= 55 ? 'C' : 'D'));
        return {
            ...item,
            paidRatio,
            lastDays,
            score,
            grade
        };
    }).sort((left, right) => {
        const scoreDiff = Number(right.score || 0) - Number(left.score || 0);
        if (scoreDiff !== 0) return scoreDiff;
        return Number(right.amount || 0) - Number(left.amount || 0);
    });

    const summary = {
        totalSuppliers: rows.length,
        gradeA: rows.filter(item => item.grade === 'A').length,
        gradeB: rows.filter(item => item.grade === 'B').length,
        gradeCD: rows.filter(item => item.grade === 'C' || item.grade === 'D').length,
        totalAmount: rows.reduce((sum, item) => sum + Number(item.amount || 0), 0),
        totalPayable: rows.reduce((sum, item) => sum + Number(item.payableAmount || 0), 0)
    };

    return { summary, rows };
}

async function renderDashboardSupplierPerformance() {
    const container = document.getElementById('dashboardSupplierPerformance');
    if (!container || !window.ERP) {
        return;
    }

    const products = Array.isArray(ERP.state?.products) ? ERP.state.products : [];
    const productMap = new Map(products.map(item => [String(item?.id), item]));
    const records = await ensureDashboardPurchaseRecords(300);
    const parsedRows = records.map(record => parsePurchaseRecordForDashboard(record, productMap));
    const stats = calculateSupplierPerformanceStats(parsedRows);

    const rowsHtml = stats.rows.slice(0, 8).map((item, index) => `
        <div style="padding:6px 0;border-bottom:1px dashed #f0f0f0;">
            <div style="display:flex;justify-content:space-between;gap:10px;">
                <div style="font-size:12px;color:#262626;">${index + 1}. ${escapeHtmlText(item.supplier)}</div>
                <div style="font-size:12px;color:${item.grade === 'A' ? '#237804' : (item.grade === 'B' ? '#1677ff' : '#d46b08')};">评分 ${item.score}（${item.grade}）</div>
            </div>
            <div style="font-size:12px;color:#8c8c8c;margin-top:2px;">
                ${item.count} 次采购 / ${formatCurrency(item.amount)} / 待付 ${formatCurrency(item.payableAmount)} / 付款率 ${(item.paidRatio * 100).toFixed(1)}%
            </div>
        </div>
    `).join('');

    container.innerHTML = `
        <div style="flex:1;min-width:320px;padding:12px 14px;border:1px solid #ffd591;border-radius:8px;background:#fff7e6;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="font-size:14px;font-weight:600;color:#d46b08;">供应商绩效评分</div>
                <div style="font-size:12px;color:#8c8c8c;">供应商 ${stats.summary.totalSuppliers} 家</div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:12px;margin-bottom:8px;">
                <span class="ant-tag" style="margin:0;">A级 ${stats.summary.gradeA}</span>
                <span class="ant-tag" style="margin:0;">B级 ${stats.summary.gradeB}</span>
                <span class="ant-tag" style="margin:0;">C/D级 ${stats.summary.gradeCD}</span>
                <span class="ant-tag" style="margin:0;">采购额 ${formatCurrency(stats.summary.totalAmount)}</span>
                <span class="ant-tag" style="margin:0;">待付 ${formatCurrency(stats.summary.totalPayable)}</span>
            </div>
            ${rowsHtml || '<div style="font-size:12px;color:#8c8c8c;">暂无供应商采购数据</div>'}
        </div>
    `;
}

function findFirstDateNotBefore(sortedTimestamps = [], targetTimestamp = 0) {
    let left = 0;
    let right = sortedTimestamps.length - 1;
    let ans = -1;
    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        if (sortedTimestamps[mid] >= targetTimestamp) {
            ans = mid;
            right = mid - 1;
        } else {
            left = mid + 1;
        }
    }
    return ans;
}

function calculateProcurementCycleStats(purchaseRows = [], orders = [], itemRows = []) {
    const orderDateMap = new Map((Array.isArray(orders) ? orders : [])
        .map(order => [String(order?.id), parseFinanceDate(order?.order_date)]));
    const salesMap = new Map();

    (Array.isArray(itemRows) ? itemRows : []).forEach(item => {
        const productKey = String(item?.product_id || '');
        const orderId = String(item?.order_id || '');
        const orderDate = orderDateMap.get(orderId);
        if (!productKey || !(orderDate instanceof Date)) {
            return;
        }
        if (!salesMap.has(productKey)) {
            salesMap.set(productKey, []);
        }
        salesMap.get(productKey).push(orderDate.getTime());
    });

    salesMap.forEach((timestamps, key) => {
        timestamps.sort((left, right) => left - right);
        salesMap.set(key, timestamps);
    });

    const cycleDays = [];
    let staleUnsoldCount = 0;
    const staleRows = [];
    const bucket = { d3: 0, d7: 0, d15: 0, d15p: 0 };

    (Array.isArray(purchaseRows) ? purchaseRows : []).forEach(row => {
        const purchaseDate = row?.purchaseDate instanceof Date ? row.purchaseDate : null;
        const productKey = String(row?.productId || '');
        if (!purchaseDate || !productKey) {
            return;
        }

        const saleTimestamps = salesMap.get(productKey) || [];
        const purchaseTs = purchaseDate.getTime();
        const idx = findFirstDateNotBefore(saleTimestamps, purchaseTs);
        if (idx >= 0) {
            const diffDays = Math.max(0, Math.floor((saleTimestamps[idx] - purchaseTs) / (24 * 60 * 60 * 1000)));
            cycleDays.push(diffDays);
            if (diffDays <= 3) bucket.d3 += 1;
            else if (diffDays <= 7) bucket.d7 += 1;
            else if (diffDays <= 15) bucket.d15 += 1;
            else bucket.d15p += 1;
            return;
        }

        const agingDays = getAgingDays(purchaseDate.toISOString());
        if (Number.isFinite(agingDays) && agingDays > 30) {
            staleUnsoldCount += 1;
            staleRows.push({
                productName: row?.productName || `商品#${row?.productId || '-'}`,
                supplier: row?.supplier || '未填写供应商',
                agingDays,
                amount: Number(row?.amount || 0)
            });
        }
    });

    const sortedDays = cycleDays.slice().sort((left, right) => left - right);
    const avgDays = sortedDays.length > 0
        ? (sortedDays.reduce((sum, value) => sum + value, 0) / sortedDays.length)
        : 0;
    const medianDays = sortedDays.length > 0
        ? sortedDays[Math.floor((sortedDays.length - 1) / 2)]
        : 0;

    staleRows.sort((left, right) => {
        const dayDiff = Number(right.agingDays || 0) - Number(left.agingDays || 0);
        if (dayDiff !== 0) return dayDiff;
        return Number(right.amount || 0) - Number(left.amount || 0);
    });

    return {
        analyzedCount: purchaseRows.length,
        matchedSalesCount: sortedDays.length,
        avgDays,
        medianDays,
        staleUnsoldCount,
        bucket,
        staleRows: staleRows.slice(0, 6)
    };
}

async function renderDashboardProcurementCycle() {
    const container = document.getElementById('dashboardProcurementCycle');
    if (!container || !window.ERP) {
        return;
    }

    const orders = Array.isArray(ERP.state?.orders) ? ERP.state.orders : [];
    const validOrders = orders.filter(order => {
        const status = normalizeOrderStatusValue(order?.status || '');
        return status !== 'cancelled' && status !== 'refunded';
    });
    const products = Array.isArray(ERP.state?.products) ? ERP.state.products : [];
    const productMap = new Map(products.map(item => [String(item?.id), item]));
    const purchaseLogs = await ensureDashboardPurchaseRecords(300);
    const purchaseRows = purchaseLogs.map(record => parsePurchaseRecordForDashboard(record, productMap));
    const itemRows = await loadDashboardOrderItems(validOrders);
    const stats = calculateProcurementCycleStats(purchaseRows, validOrders, itemRows);

    const totalMatched = Math.max(stats.matchedSalesCount, 1);
    const bar = (label, value, color) => {
        const width = Math.max(6, Math.round((value / totalMatched) * 100));
        return `
            <div style="margin-bottom:6px;">
                <div style="display:flex;justify-content:space-between;font-size:12px;color:#595959;">
                    <span>${label}</span>
                    <span>${value} 批</span>
                </div>
                <div style="height:8px;background:#f5f5f5;border-radius:999px;overflow:hidden;margin-top:3px;">
                    <div style="height:8px;background:${color};width:${width}%;"></div>
                </div>
            </div>
        `;
    };

    const staleHtml = stats.staleRows.map(item => `
        <div style="font-size:12px;color:#8c8c8c;padding:4px 0;border-bottom:1px dashed #f0f0f0;">
            ${escapeHtmlText(item.productName)} / ${escapeHtmlText(item.supplier)} / ${item.agingDays}天未售 / ${formatCurrency(item.amount)}
        </div>
    `).join('');

    container.innerHTML = `
        <div style="flex:1;min-width:320px;padding:12px 14px;border:1px solid #b7eb8f;border-radius:8px;background:#f6ffed;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="font-size:14px;font-weight:600;color:#237804;">采购周期时效</div>
                <div style="font-size:12px;color:#8c8c8c;">分析批次 ${stats.analyzedCount}</div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:12px;margin-bottom:8px;">
                <span class="ant-tag" style="margin:0;">已匹配销售 ${stats.matchedSalesCount}</span>
                <span class="ant-tag" style="margin:0;">平均 ${stats.avgDays.toFixed(1)} 天</span>
                <span class="ant-tag" style="margin:0;">中位 ${stats.medianDays} 天</span>
                <span class="ant-tag" style="margin:0;">30天未售 ${stats.staleUnsoldCount}</span>
            </div>
            ${bar('3天内转化', stats.bucket.d3, '#1677ff')}
            ${bar('4-7天转化', stats.bucket.d7, '#13c2c2')}
            ${bar('8-15天转化', stats.bucket.d15, '#faad14')}
            ${bar('15天以上转化', stats.bucket.d15p, '#f5222d')}
            <div style="margin-top:8px;font-size:12px;color:#8c8c8c;">滞销采购样本（30天未售）</div>
            ${staleHtml || '<div style="font-size:12px;color:#8c8c8c;">暂无明显滞销采购</div>'}
        </div>
    `;
}

function calculateSupplierReconciliationStats(purchaseRows = []) {
    const monthMap = new Map();
    const supplierMonthMap = new Map();
    const currentMonthKey = getCurrentYearMonthText();

    (Array.isArray(purchaseRows) ? purchaseRows : []).forEach(row => {
        const date = row?.purchaseDate instanceof Date ? row.purchaseDate : null;
        if (!date) {
            return;
        }
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthMap.has(monthKey)) {
            monthMap.set(monthKey, {
                monthKey,
                amount: 0,
                paidAmount: 0,
                payableAmount: 0,
                count: 0
            });
        }
        const monthTarget = monthMap.get(monthKey);
        monthTarget.amount += Math.max(Number(row?.amount || 0), 0);
        monthTarget.paidAmount += Math.max(Number(row?.paidAmount || 0), 0);
        monthTarget.payableAmount += Math.max(Number(row?.payableAmount || 0), 0);
        monthTarget.count += 1;

        const supplier = String(row?.supplier || '').trim() || '未填写供应商';
        const supplierMonthKey = `${monthKey}|${supplier}`;
        if (!supplierMonthMap.has(supplierMonthKey)) {
            supplierMonthMap.set(supplierMonthKey, {
                monthKey,
                supplier,
                amount: 0,
                paidAmount: 0,
                payableAmount: 0,
                count: 0
            });
        }
        const supplierTarget = supplierMonthMap.get(supplierMonthKey);
        supplierTarget.amount += Math.max(Number(row?.amount || 0), 0);
        supplierTarget.paidAmount += Math.max(Number(row?.paidAmount || 0), 0);
        supplierTarget.payableAmount += Math.max(Number(row?.payableAmount || 0), 0);
        supplierTarget.count += 1;
    });

    const monthlyRows = Array.from(monthMap.values()).sort((left, right) => String(right.monthKey).localeCompare(String(left.monthKey)));
    const currentMonth = monthlyRows.find(item => item.monthKey === currentMonthKey) || {
        monthKey: currentMonthKey,
        amount: 0,
        paidAmount: 0,
        payableAmount: 0,
        count: 0
    };
    const topSuppliersCurrentMonth = Array.from(supplierMonthMap.values())
        .filter(item => item.monthKey === currentMonthKey)
        .sort((left, right) => {
            const payableDiff = Number(right.payableAmount || 0) - Number(left.payableAmount || 0);
            if (payableDiff !== 0) return payableDiff;
            return Number(right.amount || 0) - Number(left.amount || 0);
        })
        .slice(0, 6);

    return {
        currentMonthKey,
        currentMonth,
        monthlyRows: monthlyRows.slice(0, 6),
        topSuppliersCurrentMonth
    };
}

function getSupplierPayableFinances(supplierName) {
    const safeSupplier = String(supplierName || '').trim();
    if (!safeSupplier || !window.ERP) {
        return [];
    }

    const rows = Array.isArray(ERP.state?.finances) ? ERP.state.finances : [];
    const supplierTag = `供应商：${safeSupplier}`;
    return rows.filter(item => {
        const category = String(item?.category || '');
        if (!category.includes('应付账款')) {
            return false;
        }
        const amount = Math.abs(Number(item?.amount || 0));
        if (!Number.isFinite(amount) || amount <= 0) {
            return false;
        }
        const description = String(item?.description || '');
        return description.includes(supplierTag) || description.includes(safeSupplier);
    });
}

async function autoSettleSupplierPayables(supplierName) {
    const safeSupplier = String(supplierName || '').trim();
    if (!safeSupplier) {
        return;
    }
    if (!window.ERP || typeof ERP.settlePayableFinance !== 'function') {
        alert('当前版本不支持自动核销，请刷新后重试');
        return;
    }

    const payableRows = getSupplierPayableFinances(safeSupplier);
    if (!payableRows.length) {
        if (typeof showToast === 'function') {
            showToast(`供应商 ${safeSupplier} 暂无待核销应付`, 'info');
        }
        return;
    }

    const totalAmount = payableRows.reduce((sum, row) => sum + Math.abs(Number(row?.amount || 0)), 0);
    const confirmed = confirm(`确认自动核销供应商「${safeSupplier}」吗？\n待核销 ${payableRows.length} 笔，应付合计 ${formatCurrency(totalAmount)}。`);
    if (!confirmed) {
        return;
    }

    let successCount = 0;
    for (const row of payableRows) {
        const amount = Math.abs(Number(row?.amount || 0));
        if (!Number.isFinite(amount) || amount <= 0) {
            continue;
        }
        const result = await ERP.settlePayableFinance(row.id, {
            settleDate: new Date().toISOString(),
            note: `供应商对账中心自动核销：${safeSupplier}`,
            paidAmount: amount
        });
        if (result) {
            successCount += 1;
        }
    }

    await ERP.loadFinances(true);
    if (typeof renderFinances === 'function') {
        syncFinanceViewRows(ERP.state.finances, 'all');
        renderFinances(ERP.state.finances);
    }
    updateStatistics();

    if (typeof showToast === 'function') {
        showToast(`自动核销完成：成功 ${successCount}/${payableRows.length} 笔`, successCount === payableRows.length ? 'success' : 'warning');
    }
}

async function exportPurchaseDetailsByMonth(monthKey = '') {
    const targetMonth = String(monthKey || getCurrentYearMonthText()).trim();
    const products = Array.isArray(ERP.state?.products) ? ERP.state.products : [];
    const productMap = new Map(products.map(item => [String(item?.id), item]));
    const logs = await ensureDashboardPurchaseRecords(500);
    const rows = logs
        .map(record => parsePurchaseRecordForDashboard(record, productMap))
        .filter(item => {
            const date = item?.purchaseDate instanceof Date ? item.purchaseDate : null;
            if (!date) {
                return false;
            }
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            return key === targetMonth;
        });

    if (!rows.length) {
        if (typeof showToast === 'function') {
            showToast(`${targetMonth} 暂无采购明细`, 'info');
        }
        return;
    }

    const headers = ['采购单号', '采购时间', '供应商', '商品', '数量', '单价', '总额', '付款状态', '审批状态', '审批人', '审批时间', '审批备注', '冲销状态', '冲销时间', '冲销备注', '已付', '待付', '备注'];
    const paymentStatusMap = { paid: '已付款', unpaid: '未付款', partial: '部分付款' };
    const exportRows = rows.map(item => [
        item.purchaseOrderNo || '-',
        item.purchaseDate ? item.purchaseDate.toLocaleString('zh-CN') : '-',
        item.supplier || '-',
        item.productName || '-',
        Number(item.quantity || 0),
        Number(item.unitCost || 0).toFixed(2),
        Number(item.amount || 0).toFixed(2),
        paymentStatusMap[String(item.paymentStatus || '').toLowerCase()] || String(item.paymentStatus || '-'),
        formatPurchaseApprovalStatus(item.approvalStatus),
        item.approvalOperator || '-',
        item.approvalTime ? item.approvalTime.toLocaleString('zh-CN') : '-',
        item.approvalNote || '-',
        item.rollbackStatus || '-',
        item.rollbackTime ? item.rollbackTime.toLocaleString('zh-CN') : '-',
        item.rollbackNote || '-',
        Number(item.paidAmount || 0).toFixed(2),
        Number(item.payableAmount || 0).toFixed(2),
        item.note || '-'
    ]);
    downloadCsvFile(`采购明细-${targetMonth}-${formatFileTimestamp()}.csv`, headers, exportRows);
    if (typeof showToast === 'function') {
        showToast(`已导出 ${targetMonth} 采购明细`, 'success');
    }
}

async function exportSupplierMonthlyStatement() {
    const supplierName = String(prompt('请输入供应商名称（必填）', '') || '').trim();
    if (!supplierName) {
        return;
    }
    const defaultMonth = getCurrentYearMonthText();
    const monthInput = String(prompt('请输入结算月份（格式：YYYY-MM）', defaultMonth) || '').trim() || defaultMonth;
    if (!/^\d{4}-\d{2}$/.test(monthInput)) {
        alert('月份格式错误，请使用 YYYY-MM');
        return;
    }

    const products = Array.isArray(ERP.state?.products) ? ERP.state.products : [];
    const productMap = new Map(products.map(item => [String(item?.id), item]));
    const logs = await ensureDashboardPurchaseRecords(500);
    const rows = logs
        .map(record => parsePurchaseRecordForDashboard(record, productMap))
        .filter(item => {
            const date = item?.purchaseDate instanceof Date ? item.purchaseDate : null;
            if (!date) {
                return false;
            }
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            return key === monthInput && String(item.supplier || '').trim() === supplierName;
        });

    if (!rows.length) {
        if (typeof showToast === 'function') {
            showToast(`${monthInput} 未找到供应商 ${supplierName} 的采购记录`, 'info');
        }
        return;
    }

    const totalAmount = rows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalPaid = rows.reduce((sum, item) => sum + Number(item.paidAmount || 0), 0);
    const totalPayable = rows.reduce((sum, item) => sum + Number(item.payableAmount || 0), 0);
    const headers = ['类型', '月份', '供应商', '采购单号', '采购时间', '商品', '数量', '单价', '采购总额', '审批状态', '审批人', '审批时间', '审批备注', '冲销状态', '冲销时间', '冲销备注', '已付', '待付', '备注'];
    const exportRows = [
        ['汇总', monthInput, supplierName, '-', '-', '-', '-', '-', totalAmount.toFixed(2), '-', '-', '-', '-', '-', '-', '-', totalPaid.toFixed(2), totalPayable.toFixed(2), `采购笔数=${rows.length}`],
        ...rows.map(item => [
            '明细',
            monthInput,
            supplierName,
            item.purchaseOrderNo || '-',
            item.purchaseDate ? item.purchaseDate.toLocaleString('zh-CN') : '-',
            item.productName || '-',
            Number(item.quantity || 0),
            Number(item.unitCost || 0).toFixed(2),
            Number(item.amount || 0).toFixed(2),
            formatPurchaseApprovalStatus(item.approvalStatus),
            item.approvalOperator || '-',
            item.approvalTime ? item.approvalTime.toLocaleString('zh-CN') : '-',
            item.approvalNote || '-',
            item.rollbackStatus || '-',
            item.rollbackTime ? item.rollbackTime.toLocaleString('zh-CN') : '-',
            item.rollbackNote || '-',
            Number(item.paidAmount || 0).toFixed(2),
            Number(item.payableAmount || 0).toFixed(2),
            item.note || '-'
        ])
    ];

    downloadCsvFile(`供应商月结单-${supplierName}-${monthInput}-${formatFileTimestamp()}.csv`, headers, exportRows);
    if (typeof showToast === 'function') {
        showToast(`已导出供应商月结单：${supplierName} ${monthInput}`, 'success');
    }
}

async function exportSupplierMonthlyStatementPdf() {
    const supplierName = String(prompt('请输入供应商名称（必填）', '') || '').trim();
    if (!supplierName) {
        return;
    }
    const defaultMonth = getCurrentYearMonthText();
    const monthInput = String(prompt('请输入结算月份（格式：YYYY-MM）', defaultMonth) || '').trim() || defaultMonth;
    if (!/^\d{4}-\d{2}$/.test(monthInput)) {
        alert('月份格式错误，请使用 YYYY-MM');
        return;
    }

    const products = Array.isArray(ERP.state?.products) ? ERP.state.products : [];
    const productMap = new Map(products.map(item => [String(item?.id), item]));
    const logs = await ensureDashboardPurchaseRecords(500);
    const rows = logs
        .map(record => parsePurchaseRecordForDashboard(record, productMap))
        .filter(item => {
            const date = item?.purchaseDate instanceof Date ? item.purchaseDate : null;
            if (!date) {
                return false;
            }
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            return key === monthInput && String(item.supplier || '').trim() === supplierName;
        });

    if (!rows.length) {
        if (typeof showToast === 'function') {
            showToast(`${monthInput} 未找到供应商 ${supplierName} 的采购记录`, 'info');
        }
        return;
    }

    const totalAmount = rows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalPaid = rows.reduce((sum, item) => sum + Number(item.paidAmount || 0), 0);
    const totalPayable = rows.reduce((sum, item) => sum + Number(item.payableAmount || 0), 0);
    const paymentStatusMap = { paid: '已付款', unpaid: '未付款', partial: '部分付款' };

    const tableRows = rows.map((item, idx) => `
        <tr>
            <td>${idx + 1}</td>
            <td>${escapeHtmlText(item.purchaseOrderNo || '-')}</td>
            <td>${escapeHtmlText(item.purchaseDate ? item.purchaseDate.toLocaleString('zh-CN') : '-')}</td>
            <td>${escapeHtmlText(item.productName || '-')}</td>
            <td>${Number(item.quantity || 0)}</td>
            <td>${Number(item.unitCost || 0).toFixed(2)}</td>
            <td>${Number(item.amount || 0).toFixed(2)}</td>
            <td>${escapeHtmlText(paymentStatusMap[String(item.paymentStatus || '').toLowerCase()] || '-')}</td>
            <td>${escapeHtmlText(formatPurchaseApprovalStatus(item.approvalStatus))}</td>
            <td>${escapeHtmlText(item.approvalOperator || '-')}</td>
            <td>${Number(item.paidAmount || 0).toFixed(2)}</td>
            <td>${Number(item.payableAmount || 0).toFixed(2)}</td>
            <td>${escapeHtmlText(item.note || '-')}</td>
        </tr>
    `).join('');

    const html = `
        <!doctype html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8" />
            <title>供应商月结单</title>
            <style>
                body { font-family: "Microsoft YaHei", Arial, sans-serif; color:#222; padding:20px; }
                h2 { margin:0 0 8px 0; }
                .meta { margin-bottom:12px; font-size:12px; color:#555; }
                .summary { margin-bottom:12px; font-size:12px; display:flex; gap:12px; flex-wrap:wrap; }
                table { width:100%; border-collapse:collapse; font-size:12px; }
                th, td { border:1px solid #ddd; padding:6px 8px; text-align:left; }
                th { background:#f5f5f5; }
            </style>
        </head>
        <body>
            <h2>供应商月结单</h2>
            <div class="meta">供应商：${escapeHtmlText(supplierName)} ｜ 月份：${escapeHtmlText(monthInput)} ｜ 生成时间：${new Date().toLocaleString('zh-CN')}</div>
            <div class="summary">
                <span>采购笔数：${rows.length}</span>
                <span>采购总额：${totalAmount.toFixed(2)}</span>
                <span>已付：${totalPaid.toFixed(2)}</span>
                <span>待付：${totalPayable.toFixed(2)}</span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>#</th><th>采购单号</th><th>采购时间</th><th>商品</th><th>数量</th><th>单价</th><th>总额</th>
                        <th>付款状态</th><th>审批状态</th><th>审批人</th><th>已付</th><th>待付</th><th>备注</th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) {
        alert('浏览器拦截了弹窗，请允许弹窗后重试');
        return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
    }, 300);
}

async function renderDashboardSupplierReconciliation() {
    const container = document.getElementById('dashboardSupplierReconciliation');
    if (!container || !window.ERP) {
        return;
    }

    const products = Array.isArray(ERP.state?.products) ? ERP.state.products : [];
    const productMap = new Map(products.map(item => [String(item?.id), item]));
    const purchaseLogs = await ensureDashboardPurchaseRecords(300);
    const purchaseRows = purchaseLogs.map(record => parsePurchaseRecordForDashboard(record, productMap));
    const stats = calculateSupplierReconciliationStats(purchaseRows);

    const monthRowsHtml = stats.monthlyRows.map(item => {
        const payRate = item.amount > 0 ? (item.paidAmount / item.amount) : 1;
        return `
            <div style="padding:6px 0;border-bottom:1px dashed #f0f0f0;font-size:12px;">
                <div style="display:flex;justify-content:space-between;gap:8px;">
                    <span style="color:#262626;">${item.monthKey}</span>
                    <span style="color:#595959;">${item.count} 批次</span>
                </div>
                <div style="color:#8c8c8c;margin-top:2px;">
                    应付 ${formatCurrency(item.amount)} / 已付 ${formatCurrency(item.paidAmount)} / 待付 ${formatCurrency(item.payableAmount)} / 付款率 ${(payRate * 100).toFixed(1)}%
                </div>
            </div>
        `;
    }).join('');

    const supplierRowsHtml = stats.topSuppliersCurrentMonth.map(item => `
        <div style="padding:6px 0;border-bottom:1px dashed #f0f0f0;font-size:12px;">
            <div style="display:flex;justify-content:space-between;gap:8px;">
                <span style="color:#262626;">${escapeHtmlText(item.supplier)}</span>
                <span style="color:#d46b08;">待付 ${formatCurrency(item.payableAmount)}</span>
            </div>
            <div style="color:#8c8c8c;margin-top:2px;">
                本月采购 ${formatCurrency(item.amount)} / 已付 ${formatCurrency(item.paidAmount)} / ${item.count} 批次
            </div>
            <div style="margin-top:4px;">
                <button class="ant-btn" style="height:24px;line-height:22px;padding:0 8px;font-size:12px;color:#237804;border-color:#b7eb8f;"
                    onclick='autoSettleSupplierPayables(${JSON.stringify(item.supplier)})'>
                    一键核销
                </button>
            </div>
        </div>
    `).join('');

    container.innerHTML = `
        <div style="flex:1;min-width:320px;padding:12px 14px;border:1px solid #ffd8bf;border-radius:8px;background:#fff2e8;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="font-size:14px;font-weight:600;color:#ad4e00;">供应商对账中心</div>
                <div style="font-size:12px;color:#8c8c8c;">当前月 ${stats.currentMonthKey}</div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:12px;margin-bottom:8px;">
                <span class="ant-tag" style="margin:0;">本月采购 ${formatCurrency(stats.currentMonth.amount)}</span>
                <span class="ant-tag" style="margin:0;">本月已付 ${formatCurrency(stats.currentMonth.paidAmount)}</span>
                <span class="ant-tag" style="margin:0;">本月待付 ${formatCurrency(stats.currentMonth.payableAmount)}</span>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
                <button class="ant-btn" style="height:26px;line-height:24px;padding:0 10px;font-size:12px;color:#0958d9;border-color:#91caff;"
                    onclick='exportPurchaseDetailsByMonth(${JSON.stringify(stats.currentMonthKey)})'>
                    导出当月采购明细
                </button>
                <button class="ant-btn" style="height:26px;line-height:24px;padding:0 10px;font-size:12px;color:#531dab;border-color:#d3adf7;"
                    onclick='exportSupplierMonthlyStatement()'>
                    导出供应商月结单
                </button>
                <button class="ant-btn" style="height:26px;line-height:24px;padding:0 10px;font-size:12px;color:#1d39c4;border-color:#adc6ff;"
                    onclick='exportSupplierMonthlyStatementPdf()'>
                    打印供应商月结单(PDF)
                </button>
            </div>
            <div style="font-size:12px;color:#8c8c8c;margin-bottom:4px;">最近月份对账</div>
            ${monthRowsHtml || '<div style="font-size:12px;color:#8c8c8c;">暂无采购对账数据</div>'}
            <div style="font-size:12px;color:#8c8c8c;margin-top:8px;margin-bottom:4px;">本月待付供应商TOP</div>
            ${supplierRowsHtml || '<div style="font-size:12px;color:#8c8c8c;">本月暂无供应商待付数据</div>'}
        </div>
    `;
}

function calculateRestockRecommendations(products = [], orders = [], itemRows = []) {
    const safeProducts = Array.isArray(products) ? products : [];
    const safeOrders = Array.isArray(orders) ? orders : [];
    const safeItems = Array.isArray(itemRows) ? itemRows : [];
    const now = new Date();
    const cutoffTimestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30).getTime();

    const orderTimeMap = new Map();
    safeOrders.forEach(order => {
        const orderDate = parseFinanceDate(order?.order_date);
        if (orderDate instanceof Date) {
            orderTimeMap.set(String(order?.id), orderDate.getTime());
        }
    });

    const recentSalesQtyMap = new Map();
    safeItems.forEach(item => {
        const orderId = String(item?.order_id || '');
        const orderTs = orderTimeMap.get(orderId);
        if (!Number.isFinite(orderTs) || orderTs < cutoffTimestamp) {
            return;
        }
        const productId = String(item?.product_id || '');
        if (!productId) {
            return;
        }
        const quantity = Math.max(Number(item?.quantity || 0), 0);
        if (!Number.isFinite(quantity) || quantity <= 0) {
            return;
        }
        recentSalesQtyMap.set(productId, (recentSalesQtyMap.get(productId) || 0) + quantity);
    });

    const rows = safeProducts.map(product => {
        const productId = String(product?.id || '');
        const stock = Math.max(Number(product?.stock_quantity || 0), 0);
        const minStock = Math.max(Number(product?.min_stock || 0), 0);
        const sold30 = Math.max(Number(recentSalesQtyMap.get(productId) || 0), 0);
        const dailySales = sold30 / 30;
        const coverDays = dailySales > 0 ? (stock / dailySales) : Number.POSITIVE_INFINITY;
        const targetStock = Math.ceil(Math.max(minStock * 2, dailySales * 14, minStock > 0 ? minStock : 0));
        const recommendQty = Math.max(targetStock - stock, 0);

        let riskLevel = 0;
        let reason = '';
        if (stock <= 0) {
            riskLevel = 4;
            reason = '已缺货';
        } else if (minStock > 0 && stock <= minStock) {
            riskLevel = 3;
            reason = '低于预警值';
        } else if (dailySales > 0 && coverDays < 7) {
            riskLevel = 2;
            reason = '7天内缺货风险';
        } else if (dailySales > 0 && coverDays < 14) {
            riskLevel = 1;
            reason = '建议补货';
        }

        return {
            productId,
            productName: product?.name || `商品#${productId || '-'}`,
            stock,
            minStock,
            sold30,
            dailySales,
            coverDays,
            targetStock,
            recommendQty,
            riskLevel,
            reason
        };
    }).filter(item => item.riskLevel > 0 || item.recommendQty > 0);

    rows.sort((left, right) => {
        const riskDiff = Number(right.riskLevel || 0) - Number(left.riskLevel || 0);
        if (riskDiff !== 0) return riskDiff;
        const qtyDiff = Number(right.recommendQty || 0) - Number(left.recommendQty || 0);
        if (qtyDiff !== 0) return qtyDiff;
        return Number(right.sold30 || 0) - Number(left.sold30 || 0);
    });

    const summary = {
        urgent: rows.filter(item => item.riskLevel >= 3).length,
        warning: rows.filter(item => item.riskLevel === 2).length,
        suggest: rows.filter(item => item.riskLevel === 1).length,
        totalRecommendQty: rows.reduce((sum, item) => sum + Number(item.recommendQty || 0), 0)
    };

    return {
        summary,
        rows: rows.slice(0, 12)
    };
}

async function createPurchaseFromRestock(productId, suggestedQty = 0) {
    if (!window.ERP || typeof ERP.adjustInventory !== 'function') {
        alert('当前版本不支持该操作，请刷新后重试');
        return;
    }

    const normalizedProductId = normalizeEntityId(productId);
    const product = (ERP.state?.products || []).find(item => isSameEntityId(item?.id, normalizedProductId));
    if (!product) {
        alert('未找到商品信息，请刷新后重试');
        return;
    }

    const defaultQty = Math.max(Number(suggestedQty || 0), 1);
    const qtyText = prompt(`请输入补货数量（商品：${product.name || '-'}）`, String(defaultQty));
    if (qtyText === null) {
        return;
    }
    const qty = Math.max(Math.floor(Number(String(qtyText).trim())), 0);
    if (!Number.isFinite(qty) || qty <= 0) {
        alert('补货数量无效，请输入大于 0 的整数');
        return;
    }

    const defaultCost = Math.max(Number(product?.cost ?? product?.cost_price ?? 0), 0);
    const costText = prompt(`请输入采购单价（默认 ${defaultCost.toFixed(2)}）`, defaultCost.toFixed(2));
    if (costText === null) {
        return;
    }
    const unitCost = Math.max(Number(String(costText).trim()), 0);
    if (!Number.isFinite(unitCost) || unitCost < 0) {
        alert('采购单价无效');
        return;
    }

    const defaultSupplier = String(product?.supplier || '系统补货').trim() || '系统补货';
    const supplierText = prompt('请输入供应商名称（默认：系统补货）', defaultSupplier);
    if (supplierText === null) {
        return;
    }
    const supplier = String(supplierText || '').trim() || '系统补货';
    const note = `补货建议自动生成：建议${defaultQty}，实际${qty}`;

    const result = await ERP.adjustInventory(normalizedProductId, qty, 'purchase', note, {
        unitCost,
        supplier,
        paymentStatus: 'unpaid',
        approvalStatus: 'pending',
        paidAmount: 0,
        purchaseDate: new Date().toISOString()
    });

    if (!result) {
        return;
    }

    await Promise.all([
        ERP.loadProducts(true),
        ERP.loadFinances(true),
        loadPurchaseRecords(120)
    ]);

    if (typeof renderInventory === 'function') {
        renderInventory(Array.isArray(ERP.state?.products) ? ERP.state.products : []);
    }
    updateStatistics();
}

async function createBulkPurchaseFromRestockRecommendations() {
    if (!window.ERP || typeof ERP.adjustInventory !== 'function') {
        alert('当前版本不支持该操作，请刷新后重试');
        return;
    }

    const products = Array.isArray(ERP.state?.products) ? ERP.state.products : [];
    const orders = Array.isArray(ERP.state?.orders) ? ERP.state.orders : [];
    const validOrders = orders.filter(order => {
        const status = normalizeOrderStatusValue(order?.status || '');
        return status !== 'cancelled' && status !== 'refunded';
    });
    const itemRows = await loadDashboardOrderItems(validOrders);
    const stats = calculateRestockRecommendations(products, validOrders, itemRows);
    const candidates = (stats.rows || []).filter(item => Number(item?.recommendQty || 0) > 0);

    if (!candidates.length) {
        if (typeof showToast === 'function') {
            showToast('当前没有可生成的补货建议', 'info');
        }
        return;
    }

    const totalQty = candidates.reduce((sum, item) => sum + Number(item?.recommendQty || 0), 0);
    const confirmed = confirm(`确认一键生成待付采购单吗？\n商品 ${candidates.length} 个，建议补货总量 ${totalQty}。`);
    if (!confirmed) {
        return;
    }

    let successCount = 0;
    for (const row of candidates) {
        const product = products.find(item => isSameEntityId(item?.id, row.productId));
        if (!product) {
            continue;
        }
        const qty = Math.max(Number(row?.recommendQty || 0), 0);
        const unitCost = Math.max(Number(product?.cost ?? product?.cost_price ?? 0), 0);
        if (qty <= 0 || unitCost <= 0) {
            continue;
        }
        const result = await ERP.adjustInventory(row.productId, qty, 'purchase', `补货建议自动生成：风险${row.riskLevel || 0}级`, {
            unitCost,
            supplier: String(product?.supplier || '系统补货').trim() || '系统补货',
            paymentStatus: 'unpaid',
            approvalStatus: 'pending',
            paidAmount: 0,
            purchaseDate: new Date().toISOString()
        });
        if (result) {
            successCount += 1;
        }
    }

    await Promise.all([
        ERP.loadProducts(true),
        ERP.loadFinances(true),
        loadPurchaseRecords(120)
    ]);
    if (typeof renderInventory === 'function') {
        renderInventory(Array.isArray(ERP.state?.products) ? ERP.state.products : []);
    }
    updateStatistics();
    if (typeof showToast === 'function') {
        showToast(`批量补货完成：成功 ${successCount}/${candidates.length} 个商品`, successCount === candidates.length ? 'success' : 'warning');
    }
}

async function renderDashboardRestockRecommendations() {
    const container = document.getElementById('dashboardRestockRecommendations');
    if (!container || !window.ERP) {
        return;
    }

    const products = Array.isArray(ERP.state?.products) ? ERP.state.products : [];
    const orders = Array.isArray(ERP.state?.orders) ? ERP.state.orders : [];
    const validOrders = orders.filter(order => {
        const status = normalizeOrderStatusValue(order?.status || '');
        return status !== 'cancelled' && status !== 'refunded';
    });
    const itemRows = await loadDashboardOrderItems(validOrders);
    const stats = calculateRestockRecommendations(products, validOrders, itemRows);

    const rowsHtml = stats.rows.slice(0, 8).map((item, index) => {
        const levelColor = item.riskLevel >= 3 ? '#cf1322' : (item.riskLevel === 2 ? '#d46b08' : '#1677ff');
        const coverText = Number.isFinite(item.coverDays) ? `${item.coverDays.toFixed(1)}天` : '∞';
        return `
            <div style="padding:6px 0;border-bottom:1px dashed #f0f0f0;">
                <div style="display:flex;justify-content:space-between;gap:8px;">
                    <span style="font-size:12px;color:#262626;">${index + 1}. ${escapeHtmlText(item.productName)}</span>
                    <span style="font-size:12px;color:${levelColor};">${item.reason}</span>
                </div>
                <div style="font-size:12px;color:#8c8c8c;margin-top:2px;">
                    库存 ${item.stock}（预警 ${item.minStock}）/ 近30天销量 ${item.sold30} / 可售 ${coverText} / 建议补货 ${item.recommendQty}
                </div>
                <div style="margin-top:4px;">
                    <button class="ant-btn" style="height:24px;line-height:22px;padding:0 8px;font-size:12px;color:#0958d9;border-color:#91caff;"
                        onclick='createPurchaseFromRestock(${JSON.stringify(item.productId)}, ${Number(item.recommendQty || 0)})'>
                        一键生成待付采购
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div style="flex:1;min-width:320px;padding:12px 14px;border:1px solid #ffccc7;border-radius:8px;background:#fff1f0;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="font-size:14px;font-weight:600;color:#cf1322;">智能补货建议</div>
                <div style="font-size:12px;color:#8c8c8c;">建议总量 ${stats.summary.totalRecommendQty}</div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:12px;margin-bottom:8px;">
                <span class="ant-tag" style="margin:0;">紧急/低预警 ${stats.summary.urgent}</span>
                <span class="ant-tag" style="margin:0;">7天风险 ${stats.summary.warning}</span>
                <span class="ant-tag" style="margin:0;">建议补货 ${stats.summary.suggest}</span>
            </div>
            <div style="margin-bottom:8px;">
                <button class="ant-btn ant-btn-primary" style="height:28px;line-height:26px;padding:0 10px;font-size:12px;"
                    onclick="createBulkPurchaseFromRestockRecommendations()">
                    一键生成建议补货待付采购单
                </button>
            </div>
            ${rowsHtml || '<div style="font-size:12px;color:#8c8c8c;">当前暂无补货建议</div>'}
        </div>
    `;
}

async function renderDashboardInventoryCapital() {
    const container = document.getElementById('dashboardInventoryCapital');
    if (!container || !window.ERP) {
        return;
    }

    const products = Array.isArray(ERP.state?.products) ? ERP.state.products : [];
    const orders = Array.isArray(ERP.state?.orders) ? ERP.state.orders : [];
    const validOrders = orders.filter(order => {
        const status = normalizeOrderStatusValue(order?.status || '');
        return status !== 'cancelled' && status !== 'refunded';
    });

    const itemRows = await loadDashboardOrderItems(validOrders);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentOrderSet = new Set(
        validOrders
            .filter(order => {
                const date = parseERPDate(order?.order_date || null);
                return date && date >= thirtyDaysAgo;
            })
            .map(order => String(order?.id || ''))
    );

    const soldQtyMap = new Map();
    (Array.isArray(itemRows) ? itemRows : []).forEach(item => {
        if (!recentOrderSet.has(String(item?.order_id || ''))) {
            return;
        }
        const productId = String(item?.product_id || '');
        const quantity = Math.max(Number(item?.quantity || 0), 0);
        if (!productId || quantity <= 0) {
            return;
        }
        soldQtyMap.set(productId, (soldQtyMap.get(productId) || 0) + quantity);
    });

    const rows = products.map(product => {
        const productId = String(product?.id || '');
        const stock = Math.max(Number(product?.stock_quantity ?? product?.stock ?? 0), 0);
        const unitCost = Math.max(Number(product?.cost ?? product?.cost_price ?? 0), 0);
        const stockValue = stock * unitCost;
        const soldQty30 = Math.max(Number(soldQtyMap.get(productId) || 0), 0);
        const avgDailySales = soldQty30 > 0 ? (soldQty30 / 30) : 0;
        const turnoverDays = avgDailySales > 0 ? (stock / avgDailySales) : null;
        const riskLevel = turnoverDays === null
            ? (stock > 0 ? 3 : 0)
            : (turnoverDays > 120 ? 3 : (turnoverDays > 60 ? 2 : 1));
        return {
            name: product?.name || `商品#${productId || '-'}`,
            stock,
            unitCost,
            stockValue,
            soldQty30,
            turnoverDays,
            riskLevel
        };
    }).filter(item => item.stock > 0 || item.stockValue > 0);

    rows.sort((left, right) => {
        const valueDiff = Number(right.stockValue || 0) - Number(left.stockValue || 0);
        if (valueDiff !== 0) return valueDiff;
        return Number(right.stock || 0) - Number(left.stock || 0);
    });

    const totalCapital = rows.reduce((sum, item) => sum + Number(item.stockValue || 0), 0);
    const highRiskCount = rows.filter(item => Number(item.riskLevel || 0) >= 3).length;
    const slowTurnoverCount = rows.filter(item => Number(item.riskLevel || 0) === 2).length;

    const rowsHtml = rows.slice(0, 8).map((item, index) => {
        const turnoverText = item.turnoverDays === null ? '暂无近30天销量' : `${item.turnoverDays.toFixed(1)} 天`;
        const levelColor = item.riskLevel >= 3 ? '#cf1322' : (item.riskLevel === 2 ? '#d46b08' : '#1677ff');
        return `
            <div style="padding:6px 0;border-bottom:1px dashed #f0f0f0;">
                <div style="display:flex;justify-content:space-between;gap:8px;">
                    <span style="font-size:12px;color:#262626;">${index + 1}. ${escapeHtmlText(item.name)}</span>
                    <span style="font-size:12px;color:${levelColor};">周转 ${turnoverText}</span>
                </div>
                <div style="font-size:12px;color:#8c8c8c;margin-top:2px;">
                    库存 ${item.stock} / 单位成本 ${formatCurrency(item.unitCost)} / 资金占用 ${formatCurrency(item.stockValue)} / 30天销量 ${item.soldQty30}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div style="flex:1;min-width:320px;padding:12px 14px;border:1px solid #d9f7be;border-radius:8px;background:#f6ffed;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="font-size:14px;font-weight:600;color:#389e0d;">库存资金占用与周转</div>
                <div style="font-size:12px;color:#8c8c8c;">库存资金 ${formatCurrency(totalCapital)}</div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:12px;margin-bottom:8px;">
                <span class="ant-tag" style="margin:0;">高风险 ${highRiskCount}</span>
                <span class="ant-tag" style="margin:0;">慢周转 ${slowTurnoverCount}</span>
                <span class="ant-tag" style="margin:0;">商品 ${rows.length}</span>
            </div>
            ${rowsHtml || '<div style="font-size:12px;color:#8c8c8c;">暂无库存数据</div>'}
        </div>
    `;
}

function calculateGrossMarginAnomalyStats(orders = [], customers = [], itemRows = []) {
    const safeOrders = Array.isArray(orders) ? orders : [];
    const customerMap = new Map((Array.isArray(customers) ? customers : []).map(item => [String(item?.id), item]));
    const itemCostMap = new Map();

    (Array.isArray(itemRows) ? itemRows : []).forEach(item => {
        const orderId = String(item?.order_id || '');
        if (!orderId) {
            return;
        }
        if (!itemCostMap.has(orderId)) {
            itemCostMap.set(orderId, {
                hasRows: false,
                hasCost: false
            });
        }
        const target = itemCostMap.get(orderId);
        target.hasRows = true;
        const totalCost = Number(item?.total_cost);
        const unitCost = Number(item?.unit_cost);
        if ((Number.isFinite(totalCost) && totalCost > 0) || (Number.isFinite(unitCost) && unitCost > 0)) {
            target.hasCost = true;
        }
    });

    const anomalyRows = [];
    let negativeCount = 0;
    let lowCount = 0;
    let missingCostCount = 0;

    safeOrders.forEach(order => {
        const status = normalizeOrderStatusValue(order?.status || '');
        if (status === 'cancelled' || status === 'refunded') {
            return;
        }

        const revenue = Math.max(Number(order?.total_amount || 0), 0);
        const cost = Math.max(Number(order?.total_cost || 0), 0);
        const fallbackProfit = revenue - cost;
        const profit = Number.isFinite(Number(order?.net_profit)) ? Number(order.net_profit) : fallbackProfit;
        const margin = revenue > 0 ? (profit / revenue) : null;
        const orderId = String(order?.id || '');
        const itemCostMeta = itemCostMap.get(orderId) || { hasRows: false, hasCost: false };

        let level = 0;
        let reason = '';
        if (profit < 0) {
            level = 4;
            reason = '负毛利';
            negativeCount += 1;
        } else if (margin !== null && margin < 0.1 && revenue > 0) {
            level = 3;
            reason = '低毛利(<10%)';
            lowCount += 1;
        } else if (revenue > 0 && cost <= 0 && itemCostMeta.hasRows && !itemCostMeta.hasCost) {
            level = 2;
            reason = '成本缺失';
            missingCostCount += 1;
        }

        if (level <= 0) {
            return;
        }

        const customer = customerMap.get(String(order?.customer_id || '')) || null;
        anomalyRows.push({
            orderId: order?.id,
            orderNumber: order?.order_number || `订单#${order?.id || '-'}`,
            customerName: customer?.name || '-',
            revenue,
            cost,
            profit,
            margin,
            level,
            reason,
            status
        });
    });

    anomalyRows.sort((left, right) => {
        const levelDiff = Number(right.level || 0) - Number(left.level || 0);
        if (levelDiff !== 0) return levelDiff;
        const profitDiff = Number(left.profit || 0) - Number(right.profit || 0);
        if (profitDiff !== 0) return profitDiff;
        return Number(right.revenue || 0) - Number(left.revenue || 0);
    });

    return {
        anomalyRows,
        summary: {
            total: anomalyRows.length,
            negativeCount,
            lowCount,
            missingCostCount
        }
    };
}

async function renderDashboardGrossMarginAlerts() {
    const container = document.getElementById('dashboardGrossMarginAlerts');
    if (!container || !window.ERP) {
        return;
    }

    const orders = Array.isArray(ERP.state?.orders) ? ERP.state.orders : [];
    const customers = Array.isArray(ERP.state?.customers) ? ERP.state.customers : [];
    const validOrders = orders.filter(order => {
        const status = normalizeOrderStatusValue(order?.status || '');
        return status !== 'cancelled' && status !== 'refunded';
    });
    const itemRows = await loadDashboardOrderItems(validOrders);
    const stats = calculateGrossMarginAnomalyStats(validOrders, customers, itemRows);

    const rowsHtml = stats.anomalyRows.slice(0, 10).map((item, index) => {
        const levelColor = item.level >= 4 ? '#cf1322' : (item.level === 3 ? '#d46b08' : '#1677ff');
        const marginText = item.margin === null ? '-' : `${(item.margin * 100).toFixed(1)}%`;
        return `
            <div style="padding:6px 0;border-bottom:1px dashed #f0f0f0;">
                <div style="display:flex;justify-content:space-between;gap:8px;">
                    <span style="font-size:12px;color:#262626;">${index + 1}. ${escapeHtmlText(item.orderNumber)} / ${escapeHtmlText(item.customerName)}</span>
                    <span style="font-size:12px;color:${levelColor};">${item.reason}</span>
                </div>
                <div style="font-size:12px;color:#8c8c8c;margin-top:2px;">
                    收入 ${formatCurrency(item.revenue)} / 成本 ${formatCurrency(item.cost)} / 毛利 ${formatCurrency(item.profit)} / 毛利率 ${marginText}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div style="flex:1;min-width:320px;padding:12px 14px;border:1px solid #ffccc7;border-radius:8px;background:#fff1f0;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="font-size:14px;font-weight:600;color:#cf1322;">毛利异常检测</div>
                <div style="font-size:12px;color:#8c8c8c;">异常 ${stats.summary.total} 单</div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:12px;margin-bottom:8px;">
                <span class="ant-tag" style="margin:0;">负毛利 ${stats.summary.negativeCount}</span>
                <span class="ant-tag" style="margin:0;">低毛利 ${stats.summary.lowCount}</span>
                <span class="ant-tag" style="margin:0;">成本缺失 ${stats.summary.missingCostCount}</span>
            </div>
            ${rowsHtml || '<div style="font-size:12px;color:#8c8c8c;">暂无毛利异常订单</div>'}
        </div>
    `;
}

function extractRiskApprovalReasonFromNotes(notes = '') {
    const text = String(notes || '');
    const match = text.match(/\[风控审批\]\s*(.*)/);
    if (!match) {
        return '';
    }
    return String(match[1] || '').trim();
}

function calculateOrderRiskApprovalLedger(orders = [], customers = []) {
    const customerMap = new Map(
        (Array.isArray(customers) ? customers : []).map(item => [String(item?.id || ''), item])
    );

    const rows = [];
    (Array.isArray(orders) ? orders : []).forEach(order => {
        const status = normalizeOrderStatusValue(order?.status || '');
        if (status === 'cancelled' || status === 'refunded') {
            return;
        }

        const orderItems = Array.isArray(order?.items) ? order.items : [];
        const totalAmount = Number(order?.total_amount || 0);
        const analysis = buildOrderRiskAnalysis(orderItems, totalAmount);
        const approvalReason = extractRiskApprovalReasonFromNotes(order?.notes || '');
        const shouldRecord = analysis.riskRank >= 3 || !!approvalReason;
        if (!shouldRecord) {
            return;
        }

        const alertsText = (analysis.alerts || []).map(alert => String(alert?.title || '')).filter(Boolean).join('、');
        const customer = customerMap.get(String(order?.customer_id || ''));
        const orderDate = parseERPDate(order?.order_date || new Date());

        rows.push({
            id: order?.id,
            orderNumber: order?.order_number || `订单#${order?.id || '-'}`,
            customerName: customer?.name || order?.customer_name || '-',
            orderDate,
            amount: totalAmount,
            grossProfit: Number(analysis?.grossProfit || 0),
            grossMargin: Number(analysis?.grossMargin || 0),
            riskRank: Number(analysis?.riskRank || 0),
            approvalReason,
            alertsText: alertsText || '高风险订单'
        });
    });

    rows.sort((left, right) => {
        const rankDiff = Number(right.riskRank || 0) - Number(left.riskRank || 0);
        if (rankDiff !== 0) return rankDiff;
        const rightDate = right.orderDate instanceof Date ? right.orderDate.getTime() : 0;
        const leftDate = left.orderDate instanceof Date ? left.orderDate.getTime() : 0;
        return rightDate - leftDate;
    });

    const missingReasonCount = rows.filter(item => !String(item.approvalReason || '').trim()).length;
    return {
        rows,
        total: rows.length,
        missingReasonCount,
        completedReasonCount: rows.length - missingReasonCount
    };
}

function renderDashboardRiskApprovals() {
    const container = document.getElementById('dashboardRiskApprovals');
    if (!container || !window.ERP) {
        return;
    }

    const orders = Array.isArray(ERP.state?.orders) ? ERP.state.orders : [];
    const customers = Array.isArray(ERP.state?.customers) ? ERP.state.customers : [];
    const ledger = calculateOrderRiskApprovalLedger(orders, customers);

    const rowsHtml = ledger.rows.slice(0, 10).map((item, index) => {
        const rankColor = item.riskRank >= 4 ? '#cf1322' : '#d46b08';
        const marginText = `${(Number(item.grossMargin || 0) * 100).toFixed(1)}%`;
        const reasonText = String(item.approvalReason || '').trim() || '未填写审批原因';
        const reasonColor = item.approvalReason ? '#262626' : '#cf1322';
        const orderDateText = item.orderDate instanceof Date ? item.orderDate.toLocaleDateString() : '-';
        const safeOrderId = escapeHtmlText(String(item.id || ''));
        return `
            <div style="padding:8px 0;border-bottom:1px dashed #f0f0f0;">
                <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
                    <span style="font-size:12px;color:#262626;">${index + 1}. <a href="javascript:void(0)" onclick="openOrderFromRiskLedger('${safeOrderId}')" style="color:#1677ff;">${escapeHtmlText(item.orderNumber)}</a> / ${escapeHtmlText(item.customerName)}</span>
                    <span style="font-size:12px;color:${rankColor};">风险${item.riskRank}级</span>
                </div>
                <div style="font-size:12px;color:#8c8c8c;margin-top:2px;">
                    ${orderDateText} · 金额 ${formatCurrency(item.amount)} · 毛利 ${formatCurrency(item.grossProfit)}（${marginText}） · ${escapeHtmlText(item.alertsText)}
                </div>
                <div style="font-size:12px;color:${reasonColor};margin-top:2px;">
                    审批原因：${escapeHtmlText(reasonText)}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div style="flex:1;min-width:320px;padding:12px 14px;border:1px solid #ffd591;border-radius:8px;background:#fffbe6;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="font-size:14px;font-weight:600;color:#ad6800;">风控审批台账</div>
                <div style="font-size:12px;color:#8c8c8c;">高风险 ${ledger.total} 单</div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:12px;margin-bottom:8px;">
                <span class="ant-tag" style="margin:0;">已填审批 ${ledger.completedReasonCount}</span>
                <span class="ant-tag" style="margin:0;color:#cf1322;border-color:#ffa39e;background:#fff1f0;">缺失审批 ${ledger.missingReasonCount}</span>
            </div>
            ${rowsHtml || '<div style="font-size:12px;color:#8c8c8c;">暂无高风险订单台账</div>'}
        </div>
    `;
}

function createAgingBucket() {
    return {
        d7: 0,
        d30: 0,
        d90: 0,
        d90p: 0,
        total: 0
    };
}

function getAgingDays(dateValue) {
    const date = parseFinanceDate(dateValue);
    if (!date) {
        return null;
    }
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const diff = Math.floor((todayStart - targetStart) / (24 * 60 * 60 * 1000));
    return Math.max(diff, 0);
}

function addAmountToAgingBucket(bucket, amount, days) {
    const safeAmount = Number(amount);
    if (!Number.isFinite(safeAmount) || safeAmount <= 0 || !Number.isFinite(days)) {
        return;
    }

    if (days <= 7) {
        bucket.d7 += safeAmount;
    } else if (days <= 30) {
        bucket.d30 += safeAmount;
    } else if (days <= 90) {
        bucket.d90 += safeAmount;
    } else {
        bucket.d90p += safeAmount;
    }
    bucket.total += safeAmount;
}

function renderAgingCard(title, bucket, tone = 'normal') {
    const titleColor = tone === 'warn' ? '#a8071a' : '#1d39c4';
    const borderColor = tone === 'warn' ? '#ffccc7' : '#d6e4ff';
    const bgColor = tone === 'warn' ? '#fff1f0' : '#f0f5ff';

    return `
        <div style="flex:1;min-width:280px;padding:12px 14px;border:1px solid ${borderColor};border-radius:8px;background:${bgColor};">
            <div style="font-size:14px;font-weight:600;color:${titleColor};margin-bottom:8px;">${title}</div>
            <div style="display:grid;grid-template-columns:repeat(2,minmax(120px,1fr));gap:6px 12px;font-size:12px;color:#555;">
                <div>0-7天：<strong>${formatCurrency(bucket.d7)}</strong></div>
                <div>8-30天：<strong>${formatCurrency(bucket.d30)}</strong></div>
                <div>31-90天：<strong>${formatCurrency(bucket.d90)}</strong></div>
                <div>90天以上：<strong>${formatCurrency(bucket.d90p)}</strong></div>
            </div>
            <div style="margin-top:10px;font-size:13px;color:#262626;">合计：<strong>${formatCurrency(bucket.total)}</strong></div>
        </div>
    `;
}

function renderFinanceAgingSummary() {
    const container = document.getElementById('financeAgingSummary');
    if (!container || !window.ERP) {
        return;
    }

    const receivable = createAgingBucket();
    const payable = createAgingBucket();
    const orders = Array.isArray(ERP.state?.orders) ? ERP.state.orders : [];
    const finances = Array.isArray(ERP.state?.finances) ? ERP.state.finances : [];

    orders.forEach(order => {
        const paymentStatus = String(order?.payment_status || 'unpaid');
        const orderStatus = String(order?.status || '');
        if (paymentStatus === 'paid') {
            return;
        }
        if (orderStatus === 'cancelled' || orderStatus === 'refunded') {
            return;
        }

        const amount = Number(order?.total_amount);
        const days = getAgingDays(order?.order_date);
        addAmountToAgingBucket(receivable, amount, days);
    });

    finances.forEach(finance => {
        const category = String(finance?.category || '');
        if (!category.includes('应付账款')) {
            return;
        }

        const amount = Math.abs(Number(finance?.amount || 0));
        const days = getAgingDays(finance?.transaction_date);
        addAmountToAgingBucket(payable, amount, days);
    });

    container.innerHTML = `
        ${renderAgingCard('应收账龄（未回款订单）', receivable, 'normal')}
        ${renderAgingCard('应付账龄（待付款采购）', payable, 'warn')}
    `;
}

function calculateFinanceCashflowOverview(monthInfo = null) {
    const targetMonth = monthInfo || getSelectedFinanceReportMonth();
    const year = targetMonth.year;
    const month = targetMonth.month;
    const orders = Array.isArray(ERP.state?.orders) ? ERP.state.orders : [];
    const finances = Array.isArray(ERP.state?.finances) ? ERP.state.finances : [];

    const ordersInMonth = orders.filter(order => isDateInYearMonth(order?.order_date, year, month));
    const financesInMonth = finances.filter(finance => isDateInYearMonth(finance?.transaction_date, year, month));

    const monthlyReceivable = ordersInMonth
        .filter(order => {
            const paymentStatus = String(order?.payment_status || 'unpaid').toLowerCase();
            const status = String(order?.status || '').toLowerCase();
            return paymentStatus !== 'paid' && status !== 'cancelled' && status !== 'refunded';
        })
        .reduce((sum, order) => sum + Math.max(Number(order?.total_amount || 0), 0), 0);

    const monthlyReceived = ordersInMonth
        .filter(order => String(order?.payment_status || '').toLowerCase() === 'paid')
        .reduce((sum, order) => sum + Math.max(Number(order?.total_amount || 0), 0), 0);

    const monthlyPayable = financesInMonth
        .filter(finance => String(finance?.category || '').includes('应付账款'))
        .reduce((sum, finance) => sum + Math.abs(Number(finance?.amount || 0)), 0);

    const monthlyPaid = financesInMonth
        .filter(finance => String(finance?.category || '').includes('采购付款'))
        .reduce((sum, finance) => sum + Math.abs(Number(finance?.amount || 0)), 0);

    return {
        monthKey: targetMonth.key,
        monthlyReceivable,
        monthlyPayable,
        monthlyReceived,
        monthlyPaid,
        ordersInMonth,
        financesInMonth
    };
}

function renderFinanceCashflowOverview() {
    const container = document.getElementById('financeCashflowOverview');
    if (!container || !window.ERP) {
        return;
    }

    const monthInfo = getSelectedFinanceReportMonth();
    const overview = calculateFinanceCashflowOverview(monthInfo);
    const monthText = overview.monthKey;

    const card = (title, amount, color, bg, border) => `
        <div style="flex:1;min-width:180px;padding:10px 12px;border:1px solid ${border};border-radius:8px;background:${bg};">
            <div style="font-size:12px;color:#8c8c8c;">${monthText} ${title}</div>
            <div style="font-size:20px;font-weight:600;color:${color};">${formatCurrency(amount)}</div>
        </div>
    `;

    container.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:12px;">
            ${card('应收', overview.monthlyReceivable, '#1d39c4', '#f0f5ff', '#adc6ff')}
            ${card('应付', overview.monthlyPayable, '#a8071a', '#fff1f0', '#ffa39e')}
            ${card('已回款', overview.monthlyReceived, '#08979c', '#e6fffb', '#87e8de')}
            ${card('已付款', overview.monthlyPaid, '#237804', '#f6ffed', '#b7eb8f')}
        </div>
    `;
}

function buildFinanceTrendRows(finances, days = 30) {
    const safeDays = Math.max(1, parseInt(days, 10) || 30);
    const now = new Date();
    const dayRows = [];
    const dayMap = new Map();

    for (let offset = safeDays - 1; offset >= 0; offset -= 1) {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const row = { key, label: `${date.getMonth() + 1}/${date.getDate()}`, income: 0, expense: 0, net: 0 };
        dayRows.push(row);
        dayMap.set(key, row);
    }

    (Array.isArray(finances) ? finances : []).forEach(item => {
        const date = parseFinanceDate(item?.transaction_date);
        if (!date) {
            return;
        }
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const row = dayMap.get(key);
        if (!row) {
            return;
        }

        const amount = Math.abs(Number(item?.amount || 0));
        if (!Number.isFinite(amount)) {
            return;
        }
        const type = String(item?.type || '');
        if (type === 'income') {
            row.income += amount;
        } else if (type === 'expense') {
            row.expense += amount;
        }
        row.net = row.income - row.expense;
    });

    return dayRows;
}

function calcFinanceSummaryFromRows(rows) {
    return rows.reduce((acc, row) => {
        acc.income += Number(row?.income || 0);
        acc.expense += Number(row?.expense || 0);
        return acc;
    }, { income: 0, expense: 0, net: 0 });
}

function renderFinanceTrendSummary(finances = null) {
    const container = document.getElementById('financeTrendSummary');
    if (!container) {
        return;
    }

    const source = getFinanceChartSourceRows(finances);
    const scopeValue = String(document.getElementById('financeChartScope')?.value || 'all').toLowerCase();
    const scopeText = scopeValue === 'filtered' ? '当前筛选' : '全部数据';
    const selectedRange = Math.max(1, parseInt(document.getElementById('financeTrendRange')?.value || '30', 10));
    const rows30 = buildFinanceTrendRows(source, 30);
    const rows7 = rows30.slice(-7);
    const rows1 = rows30.slice(-1);
    const rowsSelected = selectedRange === 30 ? rows30 : buildFinanceTrendRows(source, selectedRange);

    const summary1 = calcFinanceSummaryFromRows(rows1);
    summary1.net = summary1.income - summary1.expense;
    const summary7 = calcFinanceSummaryFromRows(rows7);
    summary7.net = summary7.income - summary7.expense;
    const summary30 = calcFinanceSummaryFromRows(rows30);
    summary30.net = summary30.income - summary30.expense;
    const summarySelected = calcFinanceSummaryFromRows(rowsSelected);
    summarySelected.net = summarySelected.income - summarySelected.expense;

    const maxDaily = Math.max(
        1,
        ...rowsSelected.map(row => Math.max(row.income, row.expense))
    );

    const barsHtml = rowsSelected.map(row => {
        const incomeWidth = Math.round((row.income / maxDaily) * 100);
        const expenseWidth = Math.round((row.expense / maxDaily) * 100);
        return `
            <div style="margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;font-size:12px;color:#595959;">
                    <span>${row.label}</span>
                    <span>净额 ${formatCurrency(row.net)}</span>
                </div>
                <div style="display:flex;gap:6px;margin-top:4px;">
                    <div style="height:8px;background:#ffd6e7;border-radius:999px;width:${incomeWidth}%;min-width:${row.income > 0 ? '10px' : '0'};" title="收入 ${formatCurrency(row.income)}"></div>
                    <div style="height:8px;background:#d9f7be;border-radius:999px;width:${expenseWidth}%;min-width:${row.expense > 0 ? '10px' : '0'};" title="支出 ${formatCurrency(row.expense)}"></div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:12px;">
            <div style="flex:1;min-width:180px;padding:10px 12px;border:1px solid #ffd6e7;border-radius:8px;background:#fff1f8;">
                <div style="font-size:12px;color:#8c8c8c;">今日净额</div>
                <div style="font-size:18px;font-weight:600;color:#cf1322;">${formatCurrency(summary1.net)}</div>
                <div style="font-size:12px;color:#8c8c8c;">收 ${formatCurrency(summary1.income)} / 支 ${formatCurrency(summary1.expense)}</div>
            </div>
            <div style="flex:1;min-width:180px;padding:10px 12px;border:1px solid #d6e4ff;border-radius:8px;background:#f0f5ff;">
                <div style="font-size:12px;color:#8c8c8c;">近7天净额</div>
                <div style="font-size:18px;font-weight:600;color:#1d39c4;">${formatCurrency(summary7.net)}</div>
                <div style="font-size:12px;color:#8c8c8c;">收 ${formatCurrency(summary7.income)} / 支 ${formatCurrency(summary7.expense)}</div>
            </div>
            <div style="flex:1;min-width:180px;padding:10px 12px;border:1px solid #d9f7be;border-radius:8px;background:#f6ffed;">
                <div style="font-size:12px;color:#8c8c8c;">近30天净额</div>
                <div style="font-size:18px;font-weight:600;color:#237804;">${formatCurrency(summary30.net)}</div>
                <div style="font-size:12px;color:#8c8c8c;">收 ${formatCurrency(summary30.income)} / 支 ${formatCurrency(summary30.expense)}</div>
            </div>
            <div style="flex:1;min-width:180px;padding:10px 12px;border:1px solid #ffe7ba;border-radius:8px;background:#fff7e6;">
                <div style="font-size:12px;color:#8c8c8c;">近${selectedRange}天净额</div>
                <div style="font-size:18px;font-weight:600;color:#d46b08;">${formatCurrency(summarySelected.net)}</div>
                <div style="font-size:12px;color:#8c8c8c;">收 ${formatCurrency(summarySelected.income)} / 支 ${formatCurrency(summarySelected.expense)}</div>
            </div>
        </div>
        <div style="margin-top:10px;padding:10px;border:1px solid #f0f0f0;border-radius:8px;background:#fff;">
            <div style="font-size:13px;font-weight:500;color:#262626;margin-bottom:8px;">近${selectedRange}天收支趋势（${scopeText}，粉=收入，绿=支出）</div>
            ${barsHtml || '<div style="font-size:12px;color:#999;">暂无数据</div>'}
        </div>
    `;
}

function buildMonthlyProfitRows(finances, months = 6) {
    const safeMonths = Math.max(3, parseInt(months, 10) || 6);
    const now = new Date();
    const monthRows = [];
    const monthMap = new Map();

    for (let offset = safeMonths - 1; offset >= 0; offset -= 1) {
        const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const row = {
            key,
            label: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
            income: 0,
            expense: 0,
            net: 0
        };
        monthRows.push(row);
        monthMap.set(key, row);
    }

    (Array.isArray(finances) ? finances : []).forEach(item => {
        const date = parseFinanceDate(item?.transaction_date);
        if (!date) {
            return;
        }
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const row = monthMap.get(key);
        if (!row) {
            return;
        }

        const amount = Math.abs(Number(item?.amount || 0));
        if (!Number.isFinite(amount)) {
            return;
        }

        const type = String(item?.type || '');
        if (type === 'income') {
            row.income += amount;
        } else if (type === 'expense') {
            row.expense += amount;
        }
        row.net = row.income - row.expense;
    });

    return monthRows;
}

function renderFinanceMonthlyProfitChart(finances = null) {
    const container = document.getElementById('financeMonthlyProfitChart');
    if (!container) {
        return;
    }

    const source = getFinanceChartSourceRows(finances);
    const scopeValue = String(document.getElementById('financeChartScope')?.value || 'all').toLowerCase();
    const scopeText = scopeValue === 'filtered' ? '当前筛选' : '全部数据';
    const monthRange = Math.max(3, parseInt(document.getElementById('financeMonthlyRange')?.value || '6', 10));
    const rows = buildMonthlyProfitRows(source, monthRange);
    const maxNet = Math.max(1, ...rows.map(item => Math.abs(item.net)));

    const rowsHtml = rows.map(item => {
        const ratio = Math.round((Math.abs(item.net) / maxNet) * 100);
        const netPositive = item.net >= 0;
        const barColor = netPositive ? '#1677ff' : '#fa8c16';
        return `
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                <div style="width:72px;color:#595959;font-size:12px;">${item.label}</div>
                <div style="flex:1;height:10px;background:#f5f5f5;border-radius:999px;overflow:hidden;">
                    <div style="height:10px;background:${barColor};width:${ratio}%;min-width:${Math.abs(item.net) > 0 ? '12px' : '0'};"></div>
                </div>
                <div style="width:120px;text-align:right;font-size:12px;color:${netPositive ? '#1677ff' : '#d46b08'};">
                    ${netPositive ? '+' : '-'}${formatCurrency(Math.abs(item.net))}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div style="padding:10px;border:1px solid #f0f0f0;border-radius:8px;background:#fff;">
            <div style="font-size:13px;font-weight:500;color:#262626;margin-bottom:8px;">月度利润图（近${monthRange}个月，${scopeText}）</div>
            ${rowsHtml || '<div style="font-size:12px;color:#999;">暂无数据</div>'}
            <div style="margin-top:8px;font-size:12px;color:#8c8c8c;">蓝色为正利润，橙色为负利润（按收入-支出）</div>
        </div>
    `;
}

function resolveFinanceOrderId(finance) {
    const rawOrderId = finance?.order_id ?? finance?.reference_id;
    if (rawOrderId === null || rawOrderId === undefined || rawOrderId === '') {
        return null;
    }
    return rawOrderId;
}

function isReceivableFinanceRecord(finance) {
    const type = String(finance?.type || '');
    const category = String(finance?.category || '');
    if (type !== 'income' || !category.includes('销售订单')) {
        return false;
    }

    const linkedOrderId = resolveFinanceOrderId(finance);
    if (linkedOrderId === null) {
        return false;
    }

    const order = (ERP.state?.orders || []).find(item => String(item?.id) === String(linkedOrderId));
    if (!order) {
        return false;
    }

    const paymentStatus = String(order?.payment_status || 'unpaid');
    const orderStatus = String(order?.status || '');
    if (paymentStatus === 'paid') {
        return false;
    }
    if (orderStatus === 'cancelled' || orderStatus === 'refunded') {
        return false;
    }
    return Number(finance?.amount || 0) > 0;
}

function isPayableFinanceRecord(finance) {
    const category = String(finance?.category || '');
    if (!category.includes('应付账款')) {
        return false;
    }
    return Number(finance?.amount || 0) > 0;
}

async function markReceivableAsPaid(orderId) {
    if (!window.ERP || typeof ERP.settleOrderReceivable !== 'function') {
        alert('当前版本不支持该操作，请刷新后重试');
        return;
    }

    const order = (ERP.state?.orders || []).find(item => String(item?.id) === String(orderId)) || null;
    if (!order) {
        alert('未找到订单信息，请刷新后重试');
        return;
    }

    if (String(order?.payment_status || '').toLowerCase() === 'paid') {
        if (typeof showToast === 'function') {
            showToast('该订单已回款', 'info');
        }
        return;
    }

    const amount = Number(order?.total_amount || 0);
    const orderNumber = order?.order_number || `订单#${orderId}`;
    const confirmText = `确认将 ${orderNumber} 标记为已回款吗？\n应收金额：${formatCurrency(amount)}`;
    if (!confirm(confirmText)) {
        return;
    }

    const note = prompt('可选：填写回款备注（可留空）', '') || '';
    const result = await ERP.settleOrderReceivable(orderId, {
        settleDate: new Date().toISOString(),
        note
    });

    if (!result) {
        return;
    }

    await Promise.all([
        ERP.loadOrders(true),
        ERP.loadFinances(true)
    ]);

    if (typeof searchOrders === 'function') {
        searchOrders();
    }
    if (typeof renderFinances === 'function') {
        syncFinanceViewRows(ERP.state.finances, 'all');
        renderFinances(ERP.state.finances);
    }
    updateStatistics();
}

async function markPayableAsPaid(financeId) {
    if (!window.ERP || typeof ERP.settlePayableFinance !== 'function') {
        alert('当前版本不支持该操作，请刷新后重试');
        return;
    }

    const current = (ERP.state?.finances || []).find(item => String(item?.id) === String(financeId)) || null;
    if (!current) {
        alert('未找到应付记录，请刷新重试');
        return;
    }

    const description = String(current?.description || '');
    if (description.includes('已驳回冲销')) {
        alert('该应付记录对应采购已驳回冲销，禁止结清');
        return;
    }
    if (typeof ERP.extractPurchaseOrderNoFromText === 'function' && typeof ERP.getPurchaseApprovalMetaByOrderNo === 'function') {
        const purchaseOrderNo = ERP.extractPurchaseOrderNoFromText(description);
        if (purchaseOrderNo) {
            const approvalMeta = await ERP.getPurchaseApprovalMetaByOrderNo(purchaseOrderNo);
            if (approvalMeta && String(approvalMeta.approvalStatus || '').toLowerCase() === 'rejected') {
                alert(`采购单 ${purchaseOrderNo} 已驳回，禁止结清应付`);
                return;
            }
        }
    }

    const amount = Math.abs(Number(current?.amount || 0));
    const amountInput = prompt(`请输入本次付款金额（最多 ${amount.toFixed(2)}）`, amount.toFixed(2));
    if (amountInput === null) {
        return;
    }
    const settleAmount = Number(String(amountInput).trim());
    if (!Number.isFinite(settleAmount) || settleAmount <= 0) {
        alert('付款金额无效，请输入大于 0 的数字');
        return;
    }
    const finalSettleAmount = Math.min(settleAmount, amount);
    const remainingAmount = Math.max(amount - finalSettleAmount, 0);
    const confirmText = `确认本次付款吗？\n应付总额：${formatCurrency(amount)}\n本次付款：${formatCurrency(finalSettleAmount)}\n付款后剩余：${formatCurrency(remainingAmount)}`;
    if (!confirm(confirmText)) {
        return;
    }

    const note = prompt('可选：填写结清备注（可留空）', '') || '';
    const result = await ERP.settlePayableFinance(financeId, {
        settleDate: new Date().toISOString(),
        note,
        paidAmount: finalSettleAmount
    });

    if (!result) {
        return;
    }

    const finances = await ERP.loadFinances(true);
    if (typeof renderFinances === 'function') {
        syncFinanceViewRows(finances, 'all');
        renderFinances(finances);
    }
    updateStatistics();
}

function getFinanceActionButtons(finance) {
    const buttons = [];
    const linkedOrderId = resolveFinanceOrderId(finance);
    const financeId = finance?.id;

    if (isReceivableFinanceRecord(finance) && linkedOrderId !== null) {
        buttons.push(`<button class="ant-btn erp-btn-compact erp-btn-info" onclick='markReceivableAsPaid(${JSON.stringify(linkedOrderId)})'>回款</button>`);
    }

    if (isPayableFinanceRecord(finance)) {
        const blockedByRejected = String(finance?.description || '').includes('已驳回冲销');
        if (blockedByRejected) {
            buttons.push(`<button class="ant-btn erp-btn-compact" disabled style="color:#8c8c8c;border-color:#d9d9d9;cursor:not-allowed;">已驳回</button>`);
        } else {
            buttons.push(`<button class="ant-btn erp-btn-compact erp-btn-success" onclick='markPayableAsPaid(${JSON.stringify(finance?.id)})'>结清</button>`);
        }
        buttons.push(`<button class="ant-btn erp-btn-compact erp-btn-purple" onclick='showPayablePaymentHistory(${JSON.stringify(financeId)})'>付款记录</button>`);
    }

    if (!isPayableFinanceRecord(finance) && isPurchasePaymentRecord(finance)) {
        buttons.push(`<button class="ant-btn erp-btn-compact erp-btn-purple" onclick='showPayablePaymentHistory(${JSON.stringify(financeId)})'>付款记录</button>`);
    }

    buttons.push(`<button class="ant-btn erp-btn-compact erp-btn-danger" onclick='deleteFinance(${JSON.stringify(finance?.id)})'>删除</button>`);
    return `<div class="erp-row-actions">${buttons.join('')}</div>`;
}

function exportFinanceCsvByCurrentView() {
    if (!window.ERP) {
        alert('ERP 尚未初始化');
        return;
    }

    const rows = Array.isArray(financeViewState.currentRows) && financeViewState.currentRows.length > 0
        ? financeViewState.currentRows
        : (Array.isArray(ERP.state?.finances) ? ERP.state.finances : []);

    if (!rows.length) {
        if (typeof showToast === 'function') {
            showToast('当前没有可导出的财务数据', 'info');
        }
        return;
    }

    const orders = Array.isArray(ERP.state?.orders) ? ERP.state.orders : [];
    const customers = Array.isArray(ERP.state?.customers) ? ERP.state.customers : [];
    const orderMap = new Map(orders.map(item => [String(item?.id), item]));
    const customerMap = new Map(customers.map(item => [String(item?.id), item]));

    const headers = ['类型', '分类', '金额', '关联订单号', '客户', '描述', '交易时间'];
    const exportRows = rows.map(item => {
        const typeText = item?.type === 'income' ? '收入' : (item?.type === 'expense' ? '支出' : '系统');
        const orderId = resolveFinanceOrderId(item);
        const order = orderId !== null ? orderMap.get(String(orderId)) : null;
        const customer = order ? customerMap.get(String(order.customer_id)) : null;
        const orderNumber = order?.order_number || (orderId !== null ? `订单#${orderId}` : '-');
        const customerName = customer?.name || '-';
        const date = parseFinanceDate(item?.transaction_date);

        return [
            typeText,
            item?.category || '-',
            Number(item?.amount || 0).toFixed(2),
            orderNumber,
            customerName,
            item?.description || '-',
            date ? date.toLocaleString('zh-CN') : (item?.transaction_date || '-')
        ];
    });

    const fileName = `财务明细-${financeViewState.source || 'all'}-${formatFileTimestamp()}.csv`;
    downloadCsvFile(fileName, headers, exportRows);
    if (typeof showToast === 'function') {
        showToast(`已导出 ${exportRows.length} 条财务记录`, 'success');
    }
}

function exportMonthlyBusinessReportCsv() {
    if (!window.ERP) {
        alert('ERP 尚未初始化');
        return;
    }

    const monthInfo = getSelectedFinanceReportMonth();
    const overview = calculateFinanceCashflowOverview(monthInfo);
    const monthKey = overview.monthKey;
    const financesInMonth = overview.financesInMonth || [];
    const ordersInMonth = overview.ordersInMonth || [];

    const monthlyIncome = financesInMonth
        .filter(item => String(item?.type || '').toLowerCase() === 'income')
        .reduce((sum, item) => sum + Math.abs(Number(item?.amount || 0)), 0);
    const monthlyExpense = financesInMonth
        .filter(item => String(item?.type || '').toLowerCase() === 'expense')
        .reduce((sum, item) => sum + Math.abs(Number(item?.amount || 0)), 0);
    const monthlyProfit = monthlyIncome - monthlyExpense;

    const headers = ['分组', '项目', '值', '说明'];
    const rows = [
        ['汇总', '月份', monthKey, '月度经营报告'],
        ['汇总', '订单数量', String(ordersInMonth.length), '当月订单数'],
        ['汇总', '财务记录数', String(financesInMonth.length), '当月财务流水'],
        ['现金流', '应收', overview.monthlyReceivable.toFixed(2), '当月未回款订单合计'],
        ['现金流', '应付', overview.monthlyPayable.toFixed(2), '当月应付账款合计'],
        ['现金流', '已回款', overview.monthlyReceived.toFixed(2), '当月已回款订单合计'],
        ['现金流', '已付款', overview.monthlyPaid.toFixed(2), '当月采购付款合计'],
        ['利润', '收入合计', monthlyIncome.toFixed(2), '当月收入流水'],
        ['利润', '支出合计', monthlyExpense.toFixed(2), '当月支出流水'],
        ['利润', '净利润', monthlyProfit.toFixed(2), '收入-支出']
    ];

    const topOrders = ordersInMonth
        .slice()
        .sort((left, right) => Number(right?.total_amount || 0) - Number(left?.total_amount || 0))
        .slice(0, 10);

    topOrders.forEach(order => {
        rows.push([
            '订单TOP',
            String(order?.order_number || `订单#${order?.id || '-'}`),
            Number(order?.total_amount || 0).toFixed(2),
            `状态:${order?.status || '-'} 支付:${order?.payment_status || '-'}`
        ]);
    });

    const fileName = `月度经营报告-${monthKey}-${formatFileTimestamp()}.csv`;
    downloadCsvFile(fileName, headers, rows);

    if (typeof showToast === 'function') {
        showToast(`已导出 ${monthKey} 月度经营报告`, 'success');
    }
}

function getSelectedFinanceDailyReportDateText() {
    const input = document.getElementById('financeDailyReportDate');
    const raw = String(input?.value || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return raw;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function isSameDateText(dateValue, dateText) {
    const date = parseFinanceDate(dateValue);
    if (!date || !dateText) {
        return false;
    }
    const normalized = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return normalized === dateText;
}

async function exportDailyBusinessReportCsv() {
    if (!window.ERP) {
        alert('ERP 尚未初始化');
        return;
    }

    const dateText = getSelectedFinanceDailyReportDateText();
    const orders = Array.isArray(ERP.state?.orders) ? ERP.state.orders : [];
    const finances = Array.isArray(ERP.state?.finances) ? ERP.state.finances : [];
    const customers = Array.isArray(ERP.state?.customers) ? ERP.state.customers : [];
    const customerMap = new Map(customers.map(item => [String(item?.id), item]));

    const ordersInDay = orders.filter(order => isSameDateText(order?.order_date, dateText));
    const validOrdersInDay = ordersInDay.filter(order => {
        const status = normalizeOrderStatusValue(order?.status || '');
        return status !== 'cancelled' && status !== 'refunded';
    });
    const financesInDay = finances.filter(finance => isSameDateText(finance?.transaction_date, dateText));

    const orderAmount = validOrdersInDay.reduce((sum, order) => sum + Math.max(Number(order?.total_amount || 0), 0), 0);
    const orderCost = validOrdersInDay.reduce((sum, order) => sum + Math.max(Number(order?.total_cost || 0), 0), 0);
    const orderProfit = validOrdersInDay.reduce((sum, order) => {
        const fallback = Math.max(Number(order?.total_amount || 0), 0) - Math.max(Number(order?.total_cost || 0), 0);
        const value = Number(order?.net_profit);
        return sum + (Number.isFinite(value) ? value : fallback);
    }, 0);
    const paidOrderAmount = validOrdersInDay
        .filter(order => String(order?.payment_status || '').toLowerCase() === 'paid')
        .reduce((sum, order) => sum + Math.max(Number(order?.total_amount || 0), 0), 0);
    const receivableAmount = validOrdersInDay
        .filter(order => String(order?.payment_status || '').toLowerCase() !== 'paid')
        .reduce((sum, order) => sum + Math.max(Number(order?.total_amount || 0), 0), 0);

    const incomeAmount = financesInDay
        .filter(finance => String(finance?.type || '').toLowerCase() === 'income')
        .reduce((sum, finance) => sum + Math.abs(Number(finance?.amount || 0)), 0);
    const expenseAmount = financesInDay
        .filter(finance => String(finance?.type || '').toLowerCase() === 'expense')
        .reduce((sum, finance) => sum + Math.abs(Number(finance?.amount || 0)), 0);
    const netCashflow = incomeAmount - expenseAmount;

    const itemRows = await loadDashboardOrderItems(validOrdersInDay);
    const topProductMap = new Map();
    itemRows.forEach(item => {
        const productName = String(item?.product_name || `商品#${item?.product_id || '-'}`);
        const quantity = Math.max(Number(item?.quantity || 0), 0);
        const revenue = Math.max(Number(item?.unit_price || 0), 0) * quantity;
        if (!topProductMap.has(productName)) {
            topProductMap.set(productName, { productName, quantity: 0, revenue: 0 });
        }
        const target = topProductMap.get(productName);
        target.quantity += quantity;
        target.revenue += revenue;
    });

    const topProducts = Array.from(topProductMap.values())
        .sort((left, right) => {
            const qtyDiff = Number(right.quantity || 0) - Number(left.quantity || 0);
            if (qtyDiff !== 0) return qtyDiff;
            return Number(right.revenue || 0) - Number(left.revenue || 0);
        })
        .slice(0, 10);

    const headers = ['分组', '项目', '值', '说明'];
    const rows = [
        ['日报', '日期', dateText, '自动经营日报'],
        ['订单', '订单总数', String(ordersInDay.length), '包含当日全部订单'],
        ['订单', '有效订单', String(validOrdersInDay.length), '排除取消与退款'],
        ['订单', '销售额', orderAmount.toFixed(2), '有效订单总金额'],
        ['订单', '销售成本', orderCost.toFixed(2), '有效订单总成本'],
        ['订单', '订单毛利', orderProfit.toFixed(2), '销售额-销售成本'],
        ['订单', '已回款订单金额', paidOrderAmount.toFixed(2), '支付状态为已支付'],
        ['订单', '待回款订单金额', receivableAmount.toFixed(2), '未支付订单金额'],
        ['财务', '收入流水', incomeAmount.toFixed(2), '按财务流水当日收入统计'],
        ['财务', '支出流水', expenseAmount.toFixed(2), '按财务流水当日支出统计'],
        ['财务', '净现金流', netCashflow.toFixed(2), '收入-支出']
    ];

    validOrdersInDay.slice(0, 20).forEach(order => {
        const customer = customerMap.get(String(order?.customer_id || '')) || null;
        rows.push([
            '订单明细',
            String(order?.order_number || `订单#${order?.id || '-'}`),
            Number(order?.total_amount || 0).toFixed(2),
            `客户:${customer?.name || '-'} 状态:${order?.status || '-'} 支付:${order?.payment_status || '-'}`
        ]);
    });

    topProducts.forEach(item => {
        rows.push([
            '商品TOP',
            item.productName,
            Number(item.revenue || 0).toFixed(2),
            `销量:${Number(item.quantity || 0)}`
        ]);
    });

    const fileName = `经营日报-${dateText}-${formatFileTimestamp()}.csv`;
    downloadCsvFile(fileName, headers, rows);

    if (typeof showToast === 'function') {
        showToast(`已导出 ${dateText} 经营日报`, 'success');
    }
}

function downloadJsonFile(fileName, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function markERPLoadedFlags(value) {
    if (!window.ERP || !ERP.state || !ERP.state.loaded) {
        return;
    }
    ERP.state.loaded.customers = value;
    ERP.state.loaded.products = value;
    ERP.state.loaded.orders = value;
    ERP.state.loaded.finances = value;
}

async function loadERPAllModules(options = {}) {
    if (!window.ERP) {
        return;
    }

    const forceRefresh = options?.forceRefresh === true;
    if (forceRefresh) {
        markERPLoadedFlags(false);
    }

    await Promise.all([
        ERP.loadCustomers(false),
        ERP.loadProducts(false),
        ERP.loadOrders(false),
        ERP.loadFinances(false)
    ]);
}

async function insertRowsByChunk(tableName, rows, chunkSize = 80) {
    if (!Array.isArray(rows) || rows.length === 0) {
        return 0;
    }

    let inserted = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error } = await supabaseClient
            .from(tableName)
            .insert(chunk);
        if (error) {
            throw error;
        }
        inserted += chunk.length;
    }
    return inserted;
}

async function exportERPBackupJson() {
    if (!window.ERP) {
        alert('ERP 尚未初始化');
        return;
    }

    try {
        await loadERPAllModules({ forceRefresh: true });

        const payload = {
            meta: {
                version: '2.0',
                exportedAt: new Date().toISOString(),
                source: 'WebStack ERP',
                userId: userData?.user?.id || null
            },
            data: {
                customers: ERP.state.customers || [],
                products: ERP.state.products || [],
                orders: ERP.state.orders || [],
                finances: ERP.state.finances || []
            }
        };

        const fileName = `erp-backup-${formatFileTimestamp()}.json`;
        downloadJsonFile(fileName, payload);
        if (typeof showToast === 'function') {
            showToast('备份导出成功', 'success');
        }
    } catch (error) {
        console.error('[ERP] 导出备份失败:', error);
        if (typeof showToast === 'function') {
            showToast('导出失败：' + (error?.message || '未知错误'), 'error');
        }
    }
}

function triggerERPBackupImport() {
    const input = document.getElementById('backupImportInput');
    if (!input) {
        alert('未找到导入控件');
        return;
    }
    input.click();
}

async function importERPBackupFromFile(event) {
    const input = event?.target;
    const file = input?.files?.[0];
    if (!file) {
        return;
    }

    if (!window.ERP || typeof supabaseClient === 'undefined') {
        alert('ERP 或数据库客户端未初始化');
        input.value = '';
        return;
    }

    try {
        const text = await file.text();
        const backup = JSON.parse(text);
        const payload = backup?.data || {};

        const customers = Array.isArray(payload.customers) ? payload.customers : [];
        const products = Array.isArray(payload.products) ? payload.products : [];
        const finances = Array.isArray(payload.finances) ? payload.finances : [];

        await loadERPAllModules({ forceRefresh: true });

        const currentUserId = userData?.user?.id;
        const existingCustomerKeys = new Set((ERP.state.customers || []).map(buildCustomerMergeKey).filter(Boolean));
        const existingProductKeys = new Set((ERP.state.products || []).map(buildProductMergeKey).filter(Boolean));
        const existingFinanceKeys = new Set(
            (ERP.state.finances || [])
                .filter(item => ['income', 'expense'].includes(String(item?.type || '').toLowerCase()))
                .filter(item => !isSystemLinkedFinanceCategory(item?.category))
                .map(buildFinanceMergeKey)
                .filter(Boolean)
        );

        const customerRows = customers
            .map(item => ({
                user_id: currentUserId,
                name: String(item?.name || '').trim(),
                contact_person: String(item?.contact_person || '').trim(),
                phone: String(item?.phone || '').trim(),
                email: String(item?.email || '').trim(),
                address: String(item?.address || '').trim(),
                notes: String(item?.notes || '').trim(),
                status: String(item?.status || 'active')
            }))
            .filter(item => item.name)
            .filter(item => {
                const key = buildCustomerMergeKey(item);
                if (!key || existingCustomerKeys.has(key)) {
                    return false;
                }
                existingCustomerKeys.add(key);
                return true;
            });

        const productRows = products
            .map(item => {
                const parsedPrice = Number(item?.price);
                const parsedCost = Number(item?.cost);
                return {
                user_id: currentUserId,
                    name: String(item?.name || '').trim(),
                    sku: item?.sku ? String(item.sku).trim() : null,
                    category: String(item?.category || '').trim(),
                    description: String(item?.description || '').trim(),
                    price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
                    cost: Number.isFinite(parsedCost) ? parsedCost : 0,
                    stock_quantity: parseInt(item?.stock_quantity, 10) || 0,
                    min_stock: parseInt(item?.min_stock, 10) || 0,
                    unit: String(item?.unit || 'piece').trim(),
                    status: String(item?.status || 'active')
                };
            })
            .filter(item => item.name)
            .filter(item => {
                const key = buildProductMergeKey(item);
                if (!key || existingProductKeys.has(key)) {
                    return false;
                }
                existingProductKeys.add(key);
                return true;
            });

        const financeRows = finances
            .map(item => ({
                user_id: currentUserId,
                type: String(item?.type || '').toLowerCase(),
                category: String(item?.category || '').trim(),
                amount: Number(item?.amount || 0),
                description: String(item?.description || '').trim(),
                reference_id: item?.reference_id || null,
                order_id: item?.order_id || null,
                transaction_date: toDbDateTimeString(item?.transaction_date || new Date().toISOString())
            }))
            .filter(item => ['income', 'expense'].includes(item.type))
            .filter(item => !isSystemLinkedFinanceCategory(item.category))
            .filter(item => Number.isFinite(item.amount) && item.amount > 0)
            .filter(item => {
                const key = buildFinanceMergeKey(item);
                if (!key || existingFinanceKeys.has(key)) {
                    return false;
                }
                existingFinanceKeys.add(key);
                return true;
            });

        const insertedCustomers = await insertRowsByChunk('erp_customers', customerRows);
        const insertedProducts = await insertRowsByChunk('erp_products', productRows);
        const insertedFinances = await insertRowsByChunk('erp_finances', financeRows);

        await loadERPAllModules({ forceRefresh: true });

        if (typeof renderCustomers === 'function') {
            renderCustomers(ERP.state.customers);
        }
        if (typeof renderProducts === 'function') {
            renderProducts(ERP.state.products);
        }
        if (typeof renderOrders === 'function') {
            renderOrders(ERP.state.orders);
        }
        if (typeof renderInventory === 'function') {
            renderInventory(ERP.state.products);
            populateInventoryProducts();
        }
        if (typeof renderFinances === 'function') {
            syncFinanceViewRows(ERP.state.finances, 'all');
            renderFinances(ERP.state.finances);
        }
        updateStatistics();
        await loadPurchaseRecords();

        if (typeof showToast === 'function') {
            showToast(`导入完成：客户${insertedCustomers}，产品${insertedProducts}，手工财务${insertedFinances}`, 'success');
        }
    } catch (error) {
        console.error('[ERP] 导入备份失败:', error);
        if (typeof showToast === 'function') {
            showToast('导入失败：' + (error?.message || '文件格式错误'), 'error');
        }
    } finally {
        if (input) {
            input.value = '';
        }
    }
}

// ==================== 状态文本转换 ====================
function getOrderStatusText(status) {
    return getOrderStatusTextByValue(status);
}

function getPaymentStatusText(status) {
    const statusMap = {
        'unpaid': '未支付',
        'partial': '部分支付',
        'paid': '已支付'
    };
    return statusMap[status] || status;
}

// ==================== 初始化 ====================

// 立即设置事件监听器（在 DOMContentLoaded 之前）
if (typeof window !== 'undefined') {
    window.addEventListener('userDataLoaded', function () {
        checkLoginStatus();
    });

    window.addEventListener('erpDataLoaded', function (event) {
        resetDashboardItemCache();
        updateStatistics(event.detail);
        refreshLowStockFromLatestData('erpDataLoaded');
        showERPContent();
        startERPRealtimeSync();

        // 自动渲染所有模块的数据，传递数据参数
        if (typeof renderCustomers === 'function') {
            renderCustomers(event.detail.customers);
        }
        if (window.ERP && typeof ERP.loadCustomers === 'function') {
            ERP.loadCustomers({ forceRefresh: true })
                .then(customers => {
                    if (typeof renderCustomers === 'function') {
                        renderCustomers(customers);
                    }
                })
                .catch(error => {
                    console.error('[ERP Ant] 加载完整客户数据失败:', error);
                });
        }
        if (typeof renderProducts === 'function') {
            renderProducts(event.detail.products);
        }
        if (typeof renderOrders === 'function') {
            searchOrders();
        }
        if (typeof renderInventory === 'function') {
            renderInventory(event.detail.products);
            populateInventoryProducts();
        }
        if (typeof renderFinances === 'function') {
            syncFinanceViewRows(event.detail.finances, 'all');
            renderFinances(event.detail.finances);
        }
        loadPurchaseRecords();
        renderFinanceAgingSummary();
    });

    window.addEventListener('erpFinanceChanged', async function () {
        if (typeof ERP === 'undefined') {
            return;
        }

        const finances = await ERP.loadFinances(true);
        if (typeof renderFinances === 'function') {
            syncFinanceViewRows(finances, 'all');
            renderFinances(finances);
        }
        updateStatistics();
        renderFinanceAgingSummary();
    });

    window.addEventListener('erpInventoryChanged', async function () {
        if (typeof ERP === 'undefined') {
            return;
        }

        const products = await ERP.loadProducts(true);
        if (typeof renderInventory === 'function') {
            renderInventory(products);
            populateInventoryProducts();
        }
        updateStatistics();
        await loadPurchaseRecords();
        await refreshLowStockFromLatestData('inventory-changed');
    });

    window.addEventListener('erpOrderPostProcessed', async function () {
        if (typeof ERP === 'undefined') {
            return;
        }

        ERP.state.loaded.orders = false;
        resetDashboardItemCache();
        await ERP.loadOrders(true);
        searchOrders();
        updateStatistics();
    });

    window.addEventListener('erpOrderChanged', async function () {
        if (typeof ERP === 'undefined') {
            return;
        }

        resetDashboardItemCache();
        await ERP.loadOrders(true);
        searchOrders();
        updateStatistics();
    });

    window.addEventListener('beforeunload', stopERPRealtimeSync);
}

document.addEventListener('DOMContentLoaded', function () {
    initFinanceFilters();
    setTimeout(() => refreshLowStockFromLatestData('dom-ready'), 1200);
    setTimeout(() => loadPurchaseRecords(), 1600);

    const inventoryTypeInput = document.getElementById('inventoryType');
    if (inventoryTypeInput) {
        inventoryTypeInput.addEventListener('change', toggleInventoryPurchaseFields);
    }

    const purchasePaymentInput = document.getElementById('inventoryPaymentStatus');
    if (purchasePaymentInput) {
        purchasePaymentInput.addEventListener('change', toggleInventoryPurchaseFields);
    }

    const backupInput = document.getElementById('backupImportInput');
    if (backupInput) {
        backupInput.addEventListener('change', importERPBackupFromFile);
    }

    const orderTotalInput = document.getElementById('orderTotalAmount');
    if (orderTotalInput) {
        orderTotalInput.addEventListener('input', function () {
            refreshOrderRiskPreview();
        });
    }

    const riskConfigInputIds = [
        'orderRiskAmountThreshold',
        'orderRiskDiscountThreshold',
        'orderRiskMarginThreshold',
        'orderRiskLowMarginAmountFloor'
    ];
    riskConfigInputIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', onOrderRiskConfigInputChange);
            el.addEventListener('blur', onOrderRiskConfigInputChange);
        }
    });
    syncOrderRiskConfigInputs(loadOrderRiskConfig());

    document.addEventListener('click', function (event) {
        const target = event.target instanceof Element ? event.target : null;
        const customerLink = target ? target.closest('.customer-profile-link') : null;
        if (!customerLink) {
            return;
        }

        event.preventDefault();
        const customerId = customerLink.getAttribute('data-customer-profile-id');
        if (customerId === null || customerId === '') {
            return;
        }

        handleCustomerProfileLink(event, customerId);
    });

    if (ERP_VERBOSE_LOG) {
        window.printERPDiagnostics = printERPDiagnostics;
        setTimeout(printERPDiagnostics, 1200);
    }

    const trackingInput = document.getElementById('orderTrackingNumber');
    if (trackingInput) {
        trackingInput.addEventListener('input', function () {
            renderOrderLogisticsCarrierCard(null);
            setOrderLogisticsStatus('填写快递单号后可查询实时轨迹');
            renderOrderLogisticsTimeline([]);
        });
    }

    const shippingCompanySelect = document.getElementById('orderShippingCompany');
    if (shippingCompanySelect) {
        shippingCompanySelect.addEventListener('change', function () {
            updateOrderTrackingParamHint();
            renderOrderLogisticsCarrierCard(null);
            setOrderLogisticsStatus('快递公司已变化，请重新查询轨迹');
            renderOrderLogisticsTimeline([]);
        });
    }

    const otherShippingCompany = document.getElementById('orderOtherShippingCompany');
    if (otherShippingCompany) {
        otherShippingCompany.addEventListener('input', function () {
            updateOrderTrackingParamHint();
            renderOrderLogisticsCarrierCard(null);
            setOrderLogisticsStatus('快递公司已变化，请重新查询轨迹');
            renderOrderLogisticsTimeline([]);
        });
    }

    const trackingParamInput = document.getElementById('orderTrackingParam');
    if (trackingParamInput) {
        trackingParamInput.addEventListener('input', function () {
            renderOrderLogisticsCarrierCard(null);
            setOrderLogisticsStatus('校验参数已变化，请重新查询轨迹');
            renderOrderLogisticsTimeline([]);
        });
    }

    updateOrderTrackingParamHint();
});
