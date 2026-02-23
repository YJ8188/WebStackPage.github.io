/**
 * ERP Ant Design 界面 - 业务逻辑函数
 * 从 erp.html 提取并适配用于 erp-ant.html
 */

// ==================== 登录状态检查 ====================
let erpRealtimeSyncTimer = null;
let erpRealtimeSyncInProgress = false;
const ERP_VERBOSE_LOG = typeof window !== 'undefined' && window.__DEBUG_MODE__ === true;
let erpPageViewState = 'loading';
const erpStatsRenderState = {
    lastFingerprint: '',
    lastRenderAt: 0,
    pendingTimer: null,
    lastDashboardFingerprint: '',
    lastDashboardRenderAt: 0
};

function erpDebugLog(level, ...args) {
    if (!ERP_VERBOSE_LOG) {
        return;
    }

    const logger = console[level] || console.log;
    logger(...args);
}

function setERPPageView(nextView) {
    if (erpPageViewState === nextView) {
        return;
    }

    const loadingContainer = document.getElementById('loadingContainer');
    const notLoggedIn = document.getElementById('notLoggedIn');
    const erpContent = document.getElementById('erpContent');

    if (!loadingContainer || !notLoggedIn || !erpContent) {
        erpPageViewState = nextView;
        return;
    }

    loadingContainer.style.display = nextView === 'loading' ? 'block' : 'none';
    notLoggedIn.style.display = nextView === 'notLoggedIn' ? 'block' : 'none';
    erpContent.style.display = nextView === 'content' ? 'block' : 'none';

    erpPageViewState = nextView;
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
const bankBusinessViewState = {
    currentRows: [],
    source: 'all',
    activeTab: 'repayment'
};
const bankBusinessSelectionState = {
    selectedIds: new Set(),
    visibleIds: [],
    visibleIdsBySection: {
        repayment: [],
        swipe: []
    }
};
const bankBusinessEditState = {
    financeId: null,
    mode: '',
    cardTail: ''
};
const bankRepaymentQuickState = {
    active: false,
    sourceFinanceId: null,
    sourceOutstanding: 0,
    sourceSnapshot: null
};
const bankRepaymentHistoryState = {
    bank: '',
    cardTail: '',
    rows: []
};
let bankEmailImportPreviewData = null;
const qqMailAuthViewState = {
    loaded: false,
    status: null
};
const dailyNotesViewState = {
    keyword: '',
    currentId: null,
    isDraftMode: false,
    editorSessionToken: 0,
    draftPinned: false,
    initialized: false,
    autoSaveTimer: null,
    autoSaveDelay: 5000,
    draftCacheTimer: null,
    draftCacheDelay: 300,
    isAutoSaving: false,
    pendingAutoSave: false,
    pendingSessionToken: 0,
    listBound: false,
    isApplyingState: false,
    lastSavedSignature: '',
    historyRows: [],
    contextMenuEl: null,
    contextMenuRange: null,
    contextMenuVisible: false,
    contextTargetLinkHref: '',
    contextTargetLinkNode: null,
    imageCompression: {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.82
    }
};
const tablePaginationState = {
    customers: { page: 1, pageSize: 10 },
    products: { page: 1, pageSize: 10 },
    orders: { page: 1, pageSize: 10 },
    inventory: { page: 1, pageSize: 10 },
    finances: { page: 1, pageSize: 10 },
    banking: { page: 1, pageSize: 10 },
    bankingRepayment: { page: 1, pageSize: 10 },
    bankingSwipe: { page: 1, pageSize: 10 },
    purchaseRecords: { page: 1, pageSize: 10 }
};
const tableRenderCacheState = {
    customers: [],
    products: [],
    orders: [],
    inventory: [],
    finances: [],
    banking: [],
    bankingRepayment: [],
    bankingSwipe: [],
    purchaseRecords: []
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

function cacheTableRenderRows(moduleKey, rows = []) {
    if (!Object.prototype.hasOwnProperty.call(tableRenderCacheState, moduleKey)) {
        return;
    }
    tableRenderCacheState[moduleKey] = Array.isArray(rows) ? [...rows] : [];
}

function getCachedTableRenderRows(moduleKey) {
    if (!Object.prototype.hasOwnProperty.call(tableRenderCacheState, moduleKey)) {
        return [];
    }
    return Array.isArray(tableRenderCacheState[moduleKey]) ? [...tableRenderCacheState[moduleKey]] : [];
}

function ensureTablePaginationModuleState(moduleKey) {
    if (!Object.prototype.hasOwnProperty.call(tablePaginationState, moduleKey)) {
        tablePaginationState[moduleKey] = { page: 1, pageSize: 10 };
    }
    const state = tablePaginationState[moduleKey];
    const safePageSize = Math.max(5, parseInt(state.pageSize, 10) || 10);
    const safePage = Math.max(1, parseInt(state.page, 10) || 1);
    state.pageSize = safePageSize;
    state.page = safePage;
    return state;
}

function getPaginatedRows(moduleKey, rows = []) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const state = ensureTablePaginationModuleState(moduleKey);
    const total = sourceRows.length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > totalPages) {
        state.page = totalPages;
    }
    const startIndex = (state.page - 1) * state.pageSize;
    const pagedRows = sourceRows.slice(startIndex, startIndex + state.pageSize);
    return {
        rows: pagedRows,
        total,
        page: state.page,
        pageSize: state.pageSize,
        totalPages,
        from: total === 0 ? 0 : startIndex + 1,
        to: Math.min(startIndex + state.pageSize, total)
    };
}

function buildPaginationPageList(currentPage, totalPages) {
    const pages = [];
    if (totalPages <= 7) {
        for (let page = 1; page <= totalPages; page += 1) {
            pages.push(page);
        }
        return pages;
    }

    pages.push(1);
    const left = Math.max(2, currentPage - 1);
    const right = Math.min(totalPages - 1, currentPage + 1);

    if (left > 2) {
        pages.push('ellipsis-left');
    }
    for (let page = left; page <= right; page += 1) {
        pages.push(page);
    }
    if (right < totalPages - 1) {
        pages.push('ellipsis-right');
    }
    pages.push(totalPages);
    return pages;
}

function renderTablePagination(moduleKey, containerId, pageData) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }

    const data = pageData || getPaginatedRows(moduleKey, getCachedTableRenderRows(moduleKey));
    if (!data || data.total <= 0) {
        container.innerHTML = '';
        return;
    }

    const pageList = buildPaginationPageList(data.page, data.totalPages);
    container.innerHTML = `
        <div class="erp-table-pagination">
            <div class="erp-table-pagination-info">共 ${data.total} 条，当前 ${data.from}-${data.to}</div>
            <div class="erp-table-pagination-actions">
                <button class="ant-btn erp-pagination-btn" type="button" ${data.page <= 1 ? 'disabled' : ''}
                    onclick="setTablePaginationPage('${moduleKey}', ${data.page - 1})">上一页</button>
                ${pageList.map(item => {
                    if (typeof item !== 'number') {
                        return '<span class="erp-pagination-ellipsis">...</span>';
                    }
                    return `<button class="ant-btn erp-pagination-btn ${item === data.page ? 'is-active' : ''}" type="button"
                        onclick="setTablePaginationPage('${moduleKey}', ${item})">${item}</button>`;
                }).join('')}
                <button class="ant-btn erp-pagination-btn" type="button" ${data.page >= data.totalPages ? 'disabled' : ''}
                    onclick="setTablePaginationPage('${moduleKey}', ${data.page + 1})">下一页</button>
                <select class="ant-select erp-pagination-size" onchange="setTablePaginationSize('${moduleKey}', this.value)">
                    ${[10, 20, 50].map(size => `<option value="${size}" ${size === data.pageSize ? 'selected' : ''}>${size}/页</option>`).join('')}
                </select>
            </div>
        </div>
    `;
}

function rerenderByPaginationModule(moduleKey) {
    const rows = getCachedTableRenderRows(moduleKey);
    switch (moduleKey) {
        case 'customers':
            if (typeof renderCustomers === 'function') renderCustomers(rows);
            break;
        case 'products':
            if (typeof renderProducts === 'function') renderProducts(rows);
            break;
        case 'orders':
            if (typeof renderOrders === 'function') renderOrders(rows);
            break;
        case 'inventory':
            if (typeof renderInventory === 'function') renderInventory(rows);
            break;
        case 'finances':
            if (typeof renderFinances === 'function') renderFinances(rows);
            break;
        case 'banking':
            if (typeof renderBankBusiness === 'function') renderBankBusiness(rows);
            break;
        case 'bankingRepayment':
        case 'bankingSwipe':
            if (typeof renderBankBusiness === 'function') {
                renderBankBusiness(Array.isArray(bankBusinessViewState.currentRows) ? bankBusinessViewState.currentRows : rows);
            }
            break;
        case 'purchaseRecords':
            if (typeof renderPurchaseRecords === 'function') renderPurchaseRecords(rows);
            break;
        default:
            break;
    }
}

function setTablePaginationPage(moduleKey, page) {
    const state = ensureTablePaginationModuleState(moduleKey);
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    state.page = safePage;
    rerenderByPaginationModule(moduleKey);
}

function setTablePaginationSize(moduleKey, pageSize) {
    const state = ensureTablePaginationModuleState(moduleKey);
    const safeSize = Math.max(5, parseInt(pageSize, 10) || 10);
    state.pageSize = safeSize;
    state.page = 1;
    rerenderByPaginationModule(moduleKey);
}

function normalizeBankBusinessRowId(value) {
    return String(value ?? '').trim();
}

function syncBankBusinessSelectionVisibleRows(rows = [], section = 'all') {
    const normalizedIds = (Array.isArray(rows) ? rows : [])
        .map(item => normalizeBankBusinessRowId(item?.id))
        .filter(Boolean);

    if (section === 'repayment' || section === 'swipe') {
        bankBusinessSelectionState.visibleIdsBySection[section] = normalizedIds;
        bankBusinessSelectionState.visibleIds = Array.from(new Set([
            ...bankBusinessSelectionState.visibleIdsBySection.repayment,
            ...bankBusinessSelectionState.visibleIdsBySection.swipe
        ]));
        return;
    }

    bankBusinessSelectionState.visibleIds = normalizedIds;
    bankBusinessSelectionState.visibleIdsBySection.repayment = [];
    bankBusinessSelectionState.visibleIdsBySection.swipe = [];
}

function pruneBankBusinessSelectionByAllRows() {
    const rows = dedupeBankBusinessRowsForDisplay(getBankBusinessRecords()
        .map(parseBankBusinessRecord)
        .filter(item => !item?.isRepaymentPayment));
    const allIds = new Set(rows.map(item => normalizeBankBusinessRowId(item?.id)).filter(Boolean));
    Array.from(bankBusinessSelectionState.selectedIds).forEach(id => {
        if (!allIds.has(id)) {
            bankBusinessSelectionState.selectedIds.delete(id);
        }
    });
}

function isBankBusinessRowSelected(financeId) {
    const id = normalizeBankBusinessRowId(financeId);
    return id ? bankBusinessSelectionState.selectedIds.has(id) : false;
}

function renderBankBusinessHeaderCheckboxState(section = 'all') {
    const sectionConfig = [
        { key: 'repayment', checkboxId: 'bankingRepaymentSelectAllCheckbox' },
        { key: 'swipe', checkboxId: 'bankingSwipeSelectAllCheckbox' }
    ];
    const targets = section === 'all'
        ? sectionConfig
        : sectionConfig.filter(item => item.key === section);

    targets.forEach((target) => {
        const checkbox = document.getElementById(target.checkboxId);
        if (!checkbox) {
            return;
        }
        const visibleIds = bankBusinessSelectionState.visibleIdsBySection[target.key] || [];
        const selectedVisible = visibleIds.filter(id => bankBusinessSelectionState.selectedIds.has(id)).length;
        checkbox.checked = visibleIds.length > 0 && selectedVisible === visibleIds.length;
        checkbox.indeterminate = selectedVisible > 0 && selectedVisible < visibleIds.length;
    });
}

function updateBankBusinessBatchActionState() {
    const selectedCount = bankBusinessSelectionState.selectedIds.size;
    const deleteBtn = document.getElementById('bankingBatchDeleteBtn');
    const textEl = document.getElementById('bankingSelectedCount');
    if (deleteBtn) {
        deleteBtn.disabled = selectedCount === 0;
    }
    if (textEl) {
        textEl.textContent = `已选 ${selectedCount} 条`;
    }
}

function applyBankBusinessTabUI(activeTab = 'repayment') {
    const resolvedTab = activeTab === 'swipe' ? 'swipe' : 'repayment';
    bankBusinessViewState.activeTab = resolvedTab;

    const repaymentBtn = document.getElementById('bankingTabRepaymentBtn');
    const swipeBtn = document.getElementById('bankingTabSwipeBtn');
    const repaymentSection = document.getElementById('bankingRepaymentSection');
    const swipeSection = document.getElementById('bankingSwipeSection');

    if (repaymentBtn) {
        repaymentBtn.classList.toggle('ant-btn-primary', resolvedTab === 'repayment');
    }
    if (swipeBtn) {
        swipeBtn.classList.toggle('ant-btn-primary', resolvedTab === 'swipe');
    }
    if (repaymentSection) {
        repaymentSection.style.display = resolvedTab === 'repayment' ? '' : 'none';
    }
    if (swipeSection) {
        swipeSection.style.display = resolvedTab === 'swipe' ? '' : 'none';
    }
}

function setBankBusinessTab(tab = 'repayment') {
    applyBankBusinessTabUI(tab);
    renderBankBusinessHeaderCheckboxState(tab);
}

function onBankBusinessRowCheckedChange(financeId, checked) {
    const id = normalizeBankBusinessRowId(financeId);
    if (!id) return;
    if (checked) {
        bankBusinessSelectionState.selectedIds.add(id);
    } else {
        bankBusinessSelectionState.selectedIds.delete(id);
    }
    renderBankBusinessHeaderCheckboxState();
    updateBankBusinessBatchActionState();
}

function onBankBusinessSelectAllVisible(checked, section = 'all') {
    const shouldCheck = !!checked;
    const sectionIds = section === 'repayment' || section === 'swipe'
        ? (bankBusinessSelectionState.visibleIdsBySection[section] || [])
        : (bankBusinessSelectionState.visibleIds || []);

    sectionIds.forEach(id => {
        if (shouldCheck) {
            bankBusinessSelectionState.selectedIds.add(id);
        } else {
            bankBusinessSelectionState.selectedIds.delete(id);
        }
    });

    const rowSelector = section === 'repayment' || section === 'swipe'
        ? `.erp-banking-row-checkbox[data-section="${section}"]`
        : '.erp-banking-row-checkbox';
    document.querySelectorAll(rowSelector).forEach(checkbox => {
        checkbox.checked = shouldCheck;
    });

    renderBankBusinessHeaderCheckboxState(section);
    updateBankBusinessBatchActionState();
}

function getSelectedBankBusinessRows() {
    const selectedIds = bankBusinessSelectionState.selectedIds;
    const rows = dedupeBankBusinessRowsForDisplay(getBankBusinessRecords()
        .map(parseBankBusinessRecord)
        .filter(item => !item?.isRepaymentPayment));
    return rows.filter(item => selectedIds.has(normalizeBankBusinessRowId(item?.id)));
}

const financeSelectionState = {
    selectedIds: new Set(),
    visibleIds: []
};
let financeColumnVisibilityState = null;
const FINANCE_COLUMN_DEFINITIONS = [
    { key: 'type', label: '类型' },
    { key: 'category', label: '分类' },
    { key: 'amount', label: '金额' },
    { key: 'order', label: '关联订单' },
    { key: 'description', label: '描述' },
    { key: 'date', label: '交易时间' },
    { key: 'actions', label: '操作' }
];
const FINANCE_COLUMN_DEFAULT_VISIBILITY = FINANCE_COLUMN_DEFINITIONS.reduce((acc, item) => {
    acc[item.key] = true;
    return acc;
}, {});

function normalizeFinanceRowId(value) {
    const raw = String(value ?? '').trim();
    return raw;
}

function getFinanceColumnVisibilityStorageKey() {
    const userId = String(window?.userData?.user?.id || window?.userData?.user?.email || 'guest').trim() || 'guest';
    return `erpFinanceColumnVisibility_${userId}`;
}

function loadFinanceColumnVisibility() {
    try {
        const raw = localStorage.getItem(getFinanceColumnVisibilityStorageKey());
        if (!raw) {
            return { ...FINANCE_COLUMN_DEFAULT_VISIBILITY };
        }
        const parsed = JSON.parse(raw);
        const result = { ...FINANCE_COLUMN_DEFAULT_VISIBILITY };
        FINANCE_COLUMN_DEFINITIONS.forEach(item => {
            if (Object.prototype.hasOwnProperty.call(parsed, item.key)) {
                result[item.key] = !!parsed[item.key];
            }
        });
        return result;
    } catch (error) {
        return { ...FINANCE_COLUMN_DEFAULT_VISIBILITY };
    }
}

function saveFinanceColumnVisibility(visibility) {
    try {
        localStorage.setItem(getFinanceColumnVisibilityStorageKey(), JSON.stringify(visibility || {}));
    } catch (error) {
        console.error('[ERP Ant] 保存财务列配置失败:', error);
    }
}

function getFinanceColumnVisibility() {
    if (!financeColumnVisibilityState) {
        financeColumnVisibilityState = loadFinanceColumnVisibility();
    }
    return { ...financeColumnVisibilityState };
}

function setFinanceColumnVisibility(columnKey, visible) {
    if (!financeColumnVisibilityState) {
        financeColumnVisibilityState = loadFinanceColumnVisibility();
    }
    financeColumnVisibilityState[columnKey] = !!visible;
    saveFinanceColumnVisibility(financeColumnVisibilityState);
    applyFinanceColumnVisibilityToTable();
}

function resetFinanceColumnVisibility() {
    financeColumnVisibilityState = { ...FINANCE_COLUMN_DEFAULT_VISIBILITY };
    saveFinanceColumnVisibility(financeColumnVisibilityState);
    renderFinanceColumnSettingsPanel();
    applyFinanceColumnVisibilityToTable();
}

function applyFinanceColumnVisibilityToTable() {
    const visibility = getFinanceColumnVisibility();
    FINANCE_COLUMN_DEFINITIONS.forEach(item => {
        const visible = visibility[item.key] !== false;
        document.querySelectorAll(`[data-finance-col="${item.key}"]`).forEach(cell => {
            cell.style.display = visible ? '' : 'none';
        });
        document.querySelectorAll(`[data-finance-cell="${item.key}"]`).forEach(cell => {
            cell.style.display = visible ? '' : 'none';
        });
    });
}

function renderFinanceColumnSettingsPanel() {
    const panel = document.getElementById('financeColumnSettingsPanel');
    if (!panel) {
        return;
    }

    const visibility = getFinanceColumnVisibility();
    panel.innerHTML = `
        <p class="erp-inline-settings-title">财务列显示设置</p>
        <div class="erp-inline-settings-list">
            ${FINANCE_COLUMN_DEFINITIONS.map(item => `
                <label class="erp-inline-settings-item">
                    <input type="checkbox" ${visibility[item.key] !== false ? 'checked' : ''}
                        onchange="setFinanceColumnVisibility('${item.key}', this.checked)">
                    <span>${item.label}</span>
                </label>
            `).join('')}
            <button class="ant-btn erp-btn-compact" type="button" onclick="resetFinanceColumnVisibility()">恢复默认</button>
        </div>
    `;
}

function toggleFinanceColumnSettings(forceVisible = null) {
    const panel = document.getElementById('financeColumnSettingsPanel');
    if (!panel) {
        return;
    }
    const shouldShow = typeof forceVisible === 'boolean'
        ? forceVisible
        : panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !shouldShow);
    if (shouldShow) {
        renderFinanceColumnSettingsPanel();
        applyFinanceColumnVisibilityToTable();
    }
}

function toggleFinanceMoreActions(forceVisible = null) {
    const panel = document.getElementById('financeMoreActionsPanel');
    const button = document.getElementById('financeMoreActionsBtn');
    if (!panel) {
        return;
    }

    const shouldShow = typeof forceVisible === 'boolean'
        ? forceVisible
        : panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !shouldShow);

    if (button) {
        button.classList.toggle('is-open', shouldShow);
        button.innerHTML = shouldShow
            ? '<i class="fa fa-angle-up"></i> 收起操作'
            : '<i class="fa fa-cog"></i> 更多操作';
    }
}

function syncFinanceSelectionVisibleRows(rows = []) {
    financeSelectionState.visibleIds = (Array.isArray(rows) ? rows : [])
        .map(item => normalizeFinanceRowId(item?.id))
        .filter(Boolean);
}

function pruneFinanceSelectionByAllRows() {
    const baseRows = Array.isArray(window?.ERP?.state?.finances) ? window.ERP.state.finances : [];
    const allRows = (typeof getGeneralFinanceRecords === 'function')
        ? getGeneralFinanceRecords(baseRows)
        : baseRows;
    const allIds = new Set((Array.isArray(allRows) ? allRows : [])
        .map(item => normalizeFinanceRowId(item?.id))
        .filter(Boolean));
    Array.from(financeSelectionState.selectedIds).forEach(id => {
        if (!allIds.has(id)) {
            financeSelectionState.selectedIds.delete(id);
        }
    });
}

function isFinanceRowSelected(financeId) {
    const id = normalizeFinanceRowId(financeId);
    return id ? financeSelectionState.selectedIds.has(id) : false;
}

function renderFinanceHeaderCheckboxState() {
    const checkbox = document.getElementById('financeSelectAllCheckbox');
    if (!checkbox) {
        return;
    }
    const visibleIds = financeSelectionState.visibleIds || [];
    const selectedVisible = visibleIds.filter(id => financeSelectionState.selectedIds.has(id)).length;
    checkbox.checked = visibleIds.length > 0 && selectedVisible === visibleIds.length;
    checkbox.indeterminate = selectedVisible > 0 && selectedVisible < visibleIds.length;
}

function updateFinanceBatchActionState() {
    const selectedCount = financeSelectionState.selectedIds.size;
    const deleteBtn = document.getElementById('financeBatchDeleteBtn');
    const exportBtn = document.getElementById('financeBatchExportBtn');
    const textEl = document.getElementById('financeSelectedCount');
    if (deleteBtn) {
        deleteBtn.disabled = selectedCount === 0;
    }
    if (exportBtn) {
        exportBtn.disabled = selectedCount === 0;
    }
    if (textEl) {
        textEl.textContent = `已选 ${selectedCount} 条`;
    }
}

function onFinanceRowCheckedChange(financeId, checked) {
    const id = normalizeFinanceRowId(financeId);
    if (!id) {
        return;
    }
    if (checked) {
        financeSelectionState.selectedIds.add(id);
    } else {
        financeSelectionState.selectedIds.delete(id);
    }
    renderFinanceHeaderCheckboxState();
    updateFinanceBatchActionState();
}

function onFinanceSelectAllVisible(checked) {
    const shouldCheck = !!checked;
    (financeSelectionState.visibleIds || []).forEach(id => {
        if (shouldCheck) {
            financeSelectionState.selectedIds.add(id);
        } else {
            financeSelectionState.selectedIds.delete(id);
        }
    });
    document.querySelectorAll('.erp-finance-row-checkbox').forEach(checkbox => {
        checkbox.checked = shouldCheck;
    });
    renderFinanceHeaderCheckboxState();
    updateFinanceBatchActionState();
}

function getSelectedFinanceRows() {
    const selectedIds = financeSelectionState.selectedIds;
    const baseRows = Array.isArray(window?.ERP?.state?.finances) ? window.ERP.state.finances : [];
    const rows = (typeof getGeneralFinanceRecords === 'function')
        ? getGeneralFinanceRecords(baseRows)
        : baseRows;
    return rows.filter(item => selectedIds.has(normalizeFinanceRowId(item?.id)));
}

function exportFinanceRowsCsv(rows = [], fileLabel = '已选财务') {
    const exportRowsSource = Array.isArray(rows) ? rows : [];
    if (!exportRowsSource.length) {
        if (typeof showToast === 'function') {
            showToast('当前没有可导出的财务数据', 'info');
        }
        return;
    }

    const orders = Array.isArray(window?.ERP?.state?.orders) ? window.ERP.state.orders : [];
    const customers = Array.isArray(window?.ERP?.state?.customers) ? window.ERP.state.customers : [];
    const orderMap = new Map(orders.map(item => [String(item?.id), item]));
    const customerMap = new Map(customers.map(item => [String(item?.id), item]));
    const headers = ['类型', '分类', '金额', '关联订单号', '客户', '描述', '交易时间'];
    const exportRows = exportRowsSource.map(item => {
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
            toDateTimeText(date || item?.transaction_date || '-')
        ];
    });

    const fileName = `${fileLabel}-${formatFileTimestamp()}.csv`;
    downloadCsvFile(fileName, headers, exportRows);
    if (typeof showToast === 'function') {
        showToast(`已导出 ${exportRows.length} 条财务记录`, 'success');
    }
}

function batchExportSelectedFinances() {
    const rows = getSelectedFinanceRows();
    exportFinanceRowsCsv(rows, '财务已选记录');
}

async function batchDeleteSelectedFinances() {
    const rows = getSelectedFinanceRows();
    if (!rows.length) {
        if (typeof showToast === 'function') {
            showToast('请先勾选要删除的财务记录', 'info');
        }
        return;
    }

    const deleteTargetIds = Array.from(new Set(rows
        .map(row => {
            if (row?.__virtual_bank_fee === true) {
                const sourceId = row?.__source_finance_id;
                return sourceId === null || sourceId === undefined ? '' : String(sourceId).trim();
            }
            return normalizeFinanceRowId(row?.id);
        })
        .filter(Boolean)));

    if (!deleteTargetIds.length) {
        if (typeof showToast === 'function') {
            showToast('未找到可删除的来源记录', 'warning');
        }
        return;
    }

    const shouldDelete = window.confirm(`确认删除选中的 ${rows.length} 条记录吗？将实际删除 ${deleteTargetIds.length} 条来源财务记录。`);
    if (!shouldDelete) {
        return;
    }

    let successCount = 0;
    let failCount = 0;
    for (const financeId of deleteTargetIds) {
        try {
            await ERP.deleteFinance(financeId);
            successCount += 1;
        } catch (error) {
            failCount += 1;
            console.error('[ERP Ant] 批量删除财务记录失败:', error);
        }
    }

    rows.forEach(row => {
        financeSelectionState.selectedIds.delete(normalizeFinanceRowId(row?.id));
    });
    deleteTargetIds.forEach(id => {
        financeSelectionState.selectedIds.delete(normalizeFinanceRowId(id));
    });

    const finances = await ERP.loadFinances(true);
    if (typeof applyFinanceFilters === 'function') {
        applyFinanceFilters();
    } else {
        if (typeof syncFinanceViewRows === 'function') {
            syncFinanceViewRows(finances, 'all');
        }
        if (typeof renderFinances === 'function') {
            renderFinances(finances);
        }
    }
    updateStatistics();
    if (typeof showToast === 'function') {
        showToast(`批量删除完成：成功 ${successCount}，失败 ${failCount}`, failCount > 0 ? 'warning' : 'success');
    }
}

function syncFinanceTableEnhancements(visibleRows = []) {
    syncFinanceSelectionVisibleRows(visibleRows);
    pruneFinanceSelectionByAllRows();
    renderFinanceHeaderCheckboxState();
    updateFinanceBatchActionState();
    renderFinanceColumnSettingsPanel();
    applyFinanceColumnVisibilityToTable();
}

const TABLE_BATCH_CONFIG = {
    customers: {
        label: '客户',
        selectedCountId: 'customersSelectedCount',
        exportBtnId: 'customersBatchExportBtn',
        deleteBtnId: 'customersBatchDeleteBtn',
        headerCheckboxId: 'customersSelectAllCheckbox',
        panelId: 'customersColumnSettingsPanel',
        columnDefs: [
            { key: 'name', label: '客户名称' },
            { key: 'contact', label: '联系人' },
            { key: 'phone', label: '电话' },
            { key: 'email', label: '邮箱' },
            { key: 'address', label: '地址' },
            { key: 'notes', label: '备注' },
            { key: 'status', label: '状态' },
            { key: 'actions', label: '操作' }
        ]
    },
    orders: {
        label: '订单',
        selectedCountId: 'ordersSelectedCount',
        exportBtnId: 'ordersBatchExportBtn',
        deleteBtnId: 'ordersBatchDeleteBtn',
        headerCheckboxId: 'ordersSelectAllCheckbox',
        panelId: 'ordersColumnSettingsPanel',
        columnDefs: [
            { key: 'order_no', label: '订单号' },
            { key: 'customer', label: '客户' },
            { key: 'date', label: '订单日期' },
            { key: 'amount', label: '金额' },
            { key: 'status', label: '状态' },
            { key: 'payment', label: '支付' },
            { key: 'shipping', label: '发货状态' },
            { key: 'logistics', label: '物流信息' },
            { key: 'actions', label: '操作' }
        ]
    }
};
const tableBatchState = {
    customers: { selectedIds: new Set(), visibleIds: [] },
    orders: { selectedIds: new Set(), visibleIds: [] }
};
const tableColumnVisibilityCache = {};

function normalizeTableRowId(value) {
    return String(value ?? '').trim();
}

function getCurrentUserIdentityKey() {
    return String(window?.userData?.user?.id || window?.userData?.user?.email || 'guest').trim() || 'guest';
}

function getTableColumnStorageKey(moduleKey) {
    return `erpTableColumnVisibility_${moduleKey}_${getCurrentUserIdentityKey()}`;
}

function getTableColumnDefaultVisibility(moduleKey) {
    const defs = TABLE_BATCH_CONFIG[moduleKey]?.columnDefs || [];
    return defs.reduce((acc, item) => {
        acc[item.key] = true;
        return acc;
    }, {});
}

function loadTableColumnVisibility(moduleKey) {
    const defaults = getTableColumnDefaultVisibility(moduleKey);
    try {
        const raw = localStorage.getItem(getTableColumnStorageKey(moduleKey));
        if (!raw) {
            return defaults;
        }
        const parsed = JSON.parse(raw);
        const result = { ...defaults };
        Object.keys(result).forEach(key => {
            if (Object.prototype.hasOwnProperty.call(parsed, key)) {
                result[key] = !!parsed[key];
            }
        });
        return result;
    } catch (error) {
        return defaults;
    }
}

function saveTableColumnVisibility(moduleKey, visibility) {
    try {
        localStorage.setItem(getTableColumnStorageKey(moduleKey), JSON.stringify(visibility || {}));
    } catch (error) {
        console.error('[ERP Ant] 保存表格列配置失败:', error);
    }
}

function getTableColumnVisibility(moduleKey) {
    if (!tableColumnVisibilityCache[moduleKey]) {
        tableColumnVisibilityCache[moduleKey] = loadTableColumnVisibility(moduleKey);
    }
    return { ...(tableColumnVisibilityCache[moduleKey] || {}) };
}

function setTableColumnVisibility(moduleKey, columnKey, visible) {
    if (!TABLE_BATCH_CONFIG[moduleKey]) {
        return;
    }
    if (!tableColumnVisibilityCache[moduleKey]) {
        tableColumnVisibilityCache[moduleKey] = loadTableColumnVisibility(moduleKey);
    }
    tableColumnVisibilityCache[moduleKey][columnKey] = !!visible;
    saveTableColumnVisibility(moduleKey, tableColumnVisibilityCache[moduleKey]);
    applyTableColumnVisibility(moduleKey);
}

function resetTableColumnVisibility(moduleKey) {
    if (!TABLE_BATCH_CONFIG[moduleKey]) {
        return;
    }
    tableColumnVisibilityCache[moduleKey] = getTableColumnDefaultVisibility(moduleKey);
    saveTableColumnVisibility(moduleKey, tableColumnVisibilityCache[moduleKey]);
    renderTableColumnSettingsPanel(moduleKey);
    applyTableColumnVisibility(moduleKey);
}

function applyTableColumnVisibility(moduleKey) {
    const visibility = getTableColumnVisibility(moduleKey);
    const defs = TABLE_BATCH_CONFIG[moduleKey]?.columnDefs || [];
    defs.forEach(item => {
        const visible = visibility[item.key] !== false;
        document.querySelectorAll(`[data-table-col="${moduleKey}:${item.key}"]`).forEach(cell => {
            cell.style.display = visible ? '' : 'none';
        });
        document.querySelectorAll(`[data-table-cell="${moduleKey}:${item.key}"]`).forEach(cell => {
            cell.style.display = visible ? '' : 'none';
        });
    });
}

function renderTableColumnSettingsPanel(moduleKey) {
    const config = TABLE_BATCH_CONFIG[moduleKey];
    if (!config) {
        return;
    }
    const panel = document.getElementById(config.panelId);
    if (!panel) {
        return;
    }

    const visibility = getTableColumnVisibility(moduleKey);
    panel.innerHTML = `
        <p class="erp-inline-settings-title">${config.label}列显示设置</p>
        <div class="erp-inline-settings-list">
            ${config.columnDefs.map(item => `
                <label class="erp-inline-settings-item">
                    <input type="checkbox" ${visibility[item.key] !== false ? 'checked' : ''}
                        onchange="setTableColumnVisibility('${moduleKey}', '${item.key}', this.checked)">
                    <span>${item.label}</span>
                </label>
            `).join('')}
            <button class="ant-btn erp-btn-compact" type="button" onclick="resetTableColumnVisibility('${moduleKey}')">恢复默认</button>
        </div>
    `;
}

function toggleModuleColumnSettings(moduleKey, forceVisible = null) {
    const config = TABLE_BATCH_CONFIG[moduleKey];
    if (!config) {
        return;
    }
    const panel = document.getElementById(config.panelId);
    if (!panel) {
        return;
    }
    const shouldShow = typeof forceVisible === 'boolean'
        ? forceVisible
        : panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !shouldShow);
    if (shouldShow) {
        renderTableColumnSettingsPanel(moduleKey);
        applyTableColumnVisibility(moduleKey);
    }
}

function getAllRowsByModuleKey(moduleKey) {
    switch (moduleKey) {
        case 'customers':
            return Array.isArray(window?.ERP?.state?.customers) ? window.ERP.state.customers : [];
        case 'orders':
            return Array.isArray(window?.ERP?.state?.orders) ? window.ERP.state.orders : [];
        default:
            return [];
    }
}

function syncModuleSelectionVisibleRows(moduleKey, rows = []) {
    const state = tableBatchState[moduleKey];
    if (!state) {
        return;
    }
    state.visibleIds = (Array.isArray(rows) ? rows : [])
        .map(item => normalizeTableRowId(item?.id))
        .filter(Boolean);
}

function pruneModuleSelectionByAllRows(moduleKey) {
    const state = tableBatchState[moduleKey];
    if (!state) {
        return;
    }
    const allRows = getAllRowsByModuleKey(moduleKey);
    const allIds = new Set(allRows.map(item => normalizeTableRowId(item?.id)).filter(Boolean));
    Array.from(state.selectedIds).forEach(id => {
        if (!allIds.has(id)) {
            state.selectedIds.delete(id);
        }
    });
}

function isModuleRowSelected(moduleKey, rowId) {
    const state = tableBatchState[moduleKey];
    if (!state) {
        return false;
    }
    const id = normalizeTableRowId(rowId);
    return id ? state.selectedIds.has(id) : false;
}

function renderModuleHeaderCheckboxState(moduleKey) {
    const config = TABLE_BATCH_CONFIG[moduleKey];
    const state = tableBatchState[moduleKey];
    if (!config || !state) {
        return;
    }
    const checkbox = document.getElementById(config.headerCheckboxId);
    if (!checkbox) {
        return;
    }
    const visibleIds = state.visibleIds || [];
    const selectedVisible = visibleIds.filter(id => state.selectedIds.has(id)).length;
    checkbox.checked = visibleIds.length > 0 && selectedVisible === visibleIds.length;
    checkbox.indeterminate = selectedVisible > 0 && selectedVisible < visibleIds.length;
}

function updateModuleBatchActionState(moduleKey) {
    const config = TABLE_BATCH_CONFIG[moduleKey];
    const state = tableBatchState[moduleKey];
    if (!config || !state) {
        return;
    }
    const selectedCount = state.selectedIds.size;
    const deleteBtn = document.getElementById(config.deleteBtnId);
    const exportBtn = document.getElementById(config.exportBtnId);
    const textEl = document.getElementById(config.selectedCountId);

    if (deleteBtn) {
        deleteBtn.disabled = selectedCount === 0;
    }
    if (exportBtn) {
        exportBtn.disabled = selectedCount === 0;
    }
    if (textEl) {
        textEl.textContent = `已选 ${selectedCount} 条`;
    }
}

function onModuleRowCheckedChange(moduleKey, rowId, checked) {
    const state = tableBatchState[moduleKey];
    if (!state) {
        return;
    }
    const id = normalizeTableRowId(rowId);
    if (!id) {
        return;
    }
    if (checked) {
        state.selectedIds.add(id);
    } else {
        state.selectedIds.delete(id);
    }
    renderModuleHeaderCheckboxState(moduleKey);
    updateModuleBatchActionState(moduleKey);
}

function onModuleSelectAllVisible(moduleKey, checked) {
    const state = tableBatchState[moduleKey];
    if (!state) {
        return;
    }
    const shouldCheck = !!checked;
    (state.visibleIds || []).forEach(id => {
        if (shouldCheck) {
            state.selectedIds.add(id);
        } else {
            state.selectedIds.delete(id);
        }
    });
    document.querySelectorAll(`.erp-table-row-checkbox[data-module="${moduleKey}"]`).forEach(checkbox => {
        checkbox.checked = shouldCheck;
    });
    renderModuleHeaderCheckboxState(moduleKey);
    updateModuleBatchActionState(moduleKey);
}

function getSelectedRowsByModule(moduleKey) {
    const state = tableBatchState[moduleKey];
    if (!state) {
        return [];
    }
    const allRows = getAllRowsByModuleKey(moduleKey);
    return allRows.filter(item => state.selectedIds.has(normalizeTableRowId(item?.id)));
}

function syncModuleTableEnhancements(moduleKey, visibleRows = []) {
    if (!TABLE_BATCH_CONFIG[moduleKey]) {
        return;
    }
    syncModuleSelectionVisibleRows(moduleKey, visibleRows);
    pruneModuleSelectionByAllRows(moduleKey);
    renderModuleHeaderCheckboxState(moduleKey);
    updateModuleBatchActionState(moduleKey);
    renderTableColumnSettingsPanel(moduleKey);
    applyTableColumnVisibility(moduleKey);
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
    const sourceRows = Array.isArray(rows) ? rows : [];
    financeViewState.currentRows = (typeof getGeneralFinanceRecords === 'function')
        ? getGeneralFinanceRecords(sourceRows)
        : [...sourceRows];
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

function formatChartAxisCurrency(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) {
        return '¥0';
    }
    const abs = Math.abs(amount);
    if (abs >= 10000) {
        return `¥${(amount / 10000).toFixed(1)}万`;
    }
    if (abs >= 1000) {
        return `¥${Math.round(amount)}`;
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

function getFinanceMonthlyTargetStorageKey(monthKey) {
    const safeMonth = String(monthKey || getCurrentYearMonthText()).trim();
    const userId = String(userData?.user?.id || userData?.user?.email || 'guest').trim() || 'guest';
    return `erp_finance_monthly_target_${userId}_${safeMonth}`;
}

function loadFinanceMonthlyTarget(monthKey) {
    const key = getFinanceMonthlyTargetStorageKey(monthKey);
    const raw = localStorage.getItem(key);
    const value = Number(raw || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
}

function saveFinanceMonthlyTarget() {
    const monthInfo = getSelectedFinanceReportMonth();
    const input = document.getElementById('financeMonthlyTarget');
    const targetValue = Number(input?.value || 0);
    if (!input || !Number.isFinite(targetValue) || targetValue < 0) {
        if (typeof showToast === 'function') {
            showToast('目标金额无效，请输入非负数字', 'warning');
        }
        return;
    }
    const key = getFinanceMonthlyTargetStorageKey(monthInfo.key);
    localStorage.setItem(key, String(targetValue));
    if (typeof showToast === 'function') {
        showToast(`已保存 ${monthInfo.key} 月净利润目标：${formatCurrency(targetValue)}`, 'success');
    }
    renderFinanceTrendSummary();
}

function syncFinanceMonthlyTargetInput() {
    const monthInfo = getSelectedFinanceReportMonth();
    const input = document.getElementById('financeMonthlyTarget');
    if (!input) {
        return;
    }
    const targetValue = loadFinanceMonthlyTarget(monthInfo.key);
    input.value = targetValue > 0 ? String(targetValue) : '';
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
    const allRows = getGeneralFinanceRecords(Array.isArray(ERP.state?.finances) ? ERP.state.finances : []);

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
    syncFinanceMonthlyTargetInput();
    renderFinanceTrendSummary();
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
        const currentPartMap = getShanghaiDatePartMap(new Date());
        if (!currentPartMap) {
            return new Date().toISOString();
        }
        return `${currentPartMap.year}-${currentPartMap.month}-${currentPartMap.day} ${currentPartMap.hour || '00'}:${currentPartMap.minute || '00'}:${currentPartMap.second || '00'}`;
    }

    if (raw.includes(' ')) {
        const match = raw.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})(?::(\d{2}))?$/);
        if (match) {
            return `${match[1]} ${match[2]}:${match[3] || '00'}`;
        }
        return raw;
    }

    if (raw.includes('T')) {
        const plainLocalMatch = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/);
        if (plainLocalMatch) {
            return `${plainLocalMatch[1]} ${plainLocalMatch[2]}:${plainLocalMatch[3] || '00'}`;
        }

        const shanghaiPartMap = getShanghaiDatePartMap(raw);
        if (shanghaiPartMap) {
            return `${shanghaiPartMap.year}-${shanghaiPartMap.month}-${shanghaiPartMap.day} ${shanghaiPartMap.hour || '00'}:${shanghaiPartMap.minute || '00'}:${shanghaiPartMap.second || '00'}`;
        }
        return '';
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
        if (typeof refreshQQMailAuthStatus === 'function') {
            setTimeout(() => refreshQQMailAuthStatus(true), 0);
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
                if (typeof refreshQQMailAuthStatus === 'function') {
                    setTimeout(() => refreshQQMailAuthStatus(true), 0);
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
    setERPPageView('loading');
}

function showNotLoggedIn() {
    stopERPRealtimeSync();
    setERPPageView('notLoggedIn');
}

function showERPContent() {
    setERPPageView('content');
    startERPRealtimeSync();
}

const CUSTOMER_META_LABELS = {
    tier: '[客户等级]',
    creditLimit: '[信用额度]',
    paymentTermDays: '[账期天数]'
};

function toSafeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parseCustomerMetaFromNotes(notes) {
    const text = String(notes || '').trim();
    const lines = text ? text.split('\n').map(item => String(item || '').trim()) : [];
    const meta = {
        tier: '',
        creditLimit: 0,
        paymentTermDays: 0
    };

    lines.forEach(line => {
        if (line.startsWith(CUSTOMER_META_LABELS.tier)) {
            meta.tier = line.replace(CUSTOMER_META_LABELS.tier, '').trim();
        }
        if (line.startsWith(CUSTOMER_META_LABELS.creditLimit)) {
            const amountText = line.replace(CUSTOMER_META_LABELS.creditLimit, '').replace(/[^\d.-]/g, '').trim();
            meta.creditLimit = Math.max(0, toSafeNumber(amountText, 0));
        }
        if (line.startsWith(CUSTOMER_META_LABELS.paymentTermDays)) {
            const dayText = line.replace(CUSTOMER_META_LABELS.paymentTermDays, '').replace(/[^\d.-]/g, '').trim();
            meta.paymentTermDays = Math.max(0, Math.floor(toSafeNumber(dayText, 0)));
        }
    });

    return meta;
}

function stripCustomerMetaLines(notes) {
    const text = String(notes || '').trim();
    if (!text) {
        return '';
    }
    return text
        .split('\n')
        .map(item => String(item || '').trim())
        .filter(line =>
            line
            && !line.startsWith(CUSTOMER_META_LABELS.tier)
            && !line.startsWith(CUSTOMER_META_LABELS.creditLimit)
            && !line.startsWith(CUSTOMER_META_LABELS.paymentTermDays)
        )
        .join('\n')
        .trim();
}

function buildCustomerNotesWithMeta(baseNotes, meta = {}) {
    const safeBase = stripCustomerMetaLines(baseNotes);
    const lines = safeBase ? [safeBase] : [];
    const safeTier = String(meta.tier || '').trim();
    const safeCredit = Math.max(0, toSafeNumber(meta.creditLimit, 0));
    const safeTermDays = Math.max(0, Math.floor(toSafeNumber(meta.paymentTermDays, 0)));

    if (safeTier) {
        lines.push(`${CUSTOMER_META_LABELS.tier} ${safeTier}`);
    }
    if (safeCredit > 0) {
        lines.push(`${CUSTOMER_META_LABELS.creditLimit} ${safeCredit.toFixed(2)}`);
    }
    if (safeTermDays > 0) {
        lines.push(`${CUSTOMER_META_LABELS.paymentTermDays} ${safeTermDays}天`);
    }
    return lines.join('\n').trim();
}

function getCustomerSmeMeta(customer) {
    const fromNotes = parseCustomerMetaFromNotes(customer?.notes || '');
    const tier = String(customer?.customer_tier || fromNotes.tier || '').trim();
    const creditLimit = Math.max(0, toSafeNumber(customer?.credit_limit, fromNotes.creditLimit));
    const paymentTermDays = Math.max(0, Math.floor(toSafeNumber(customer?.payment_term_days, fromNotes.paymentTermDays)));
    return {
        tier,
        creditLimit,
        paymentTermDays
    };
}

function calculateCustomerOutstandingReceivable(customerId, excludeOrderId = null) {
    const orders = Array.isArray(ERP.state?.orders) ? ERP.state.orders : [];
    return orders.reduce((sum, order) => {
        if (!isSameEntityId(order?.customer_id, customerId)) {
            return sum;
        }
        if (excludeOrderId !== null && excludeOrderId !== undefined && isSameEntityId(order?.id, excludeOrderId)) {
            return sum;
        }
        const status = normalizeOrderStatusValue(order?.status || 'pending');
        const paymentStatus = String(order?.payment_status || 'unpaid').toLowerCase();
        if (['cancelled', 'refunded'].includes(status) || paymentStatus === 'paid') {
            return sum;
        }
        return sum + Math.max(0, toSafeNumber(order?.total_amount, 0));
    }, 0);
}

function appendOrderPaymentTermNotes(baseNotes, customerMeta = {}, orderTotal = 0) {
    const safeBase = String(baseNotes || '')
        .split('\n')
        .map(item => String(item || '').trim())
        .filter(line => line && !line.startsWith('[预计回款]') && !line.startsWith('[订单账期]'))
        .join('\n')
        .trim();

    const lines = safeBase ? [safeBase] : [];
    const paymentTermDays = Math.max(0, Math.floor(toSafeNumber(customerMeta.paymentTermDays, 0)));
    if (paymentTermDays > 0) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + paymentTermDays);
        const dueDateText = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`;
        lines.push(`[订单账期] ${paymentTermDays}天`);
        lines.push(`[预计回款] ${dueDateText}`);
    }
    if (toSafeNumber(orderTotal, 0) > 0) {
        lines.push(`[订单金额] ${toSafeNumber(orderTotal, 0).toFixed(2)}`);
    }
    return lines.join('\n').trim();
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
    const customerMeta = getCustomerSmeMeta(customer);
    const outstandingReceivable = calculateCustomerOutstandingReceivable(customer.id);
    const availableCredit = customerMeta.creditLimit > 0
        ? Math.max(customerMeta.creditLimit - outstandingReceivable, 0)
        : 0;
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
                <div><strong>客户等级：</strong>${customerMeta.tier || '-'}</div>
                <div><strong>信用额度：</strong>${customerMeta.creditLimit > 0 ? `¥${customerMeta.creditLimit.toFixed(2)}` : '-'}</div>
                <div><strong>账期：</strong>${customerMeta.paymentTermDays > 0 ? `${customerMeta.paymentTermDays}天` : '-'}</div>
                <div><strong>当前应收：</strong><span style="color:#cf1322;">¥${outstandingReceivable.toFixed(2)}</span></div>
                <div><strong>可用授信：</strong>${customerMeta.creditLimit > 0 ? `¥${availableCredit.toFixed(2)}` : '-'}</div>
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
        `客户等级：${customerMeta.tier || '-'}`,
        `信用额度：${customerMeta.creditLimit > 0 ? `¥${customerMeta.creditLimit.toFixed(2)}` : '-'}`,
        `账期：${customerMeta.paymentTermDays > 0 ? `${customerMeta.paymentTermDays}天` : '-'}`,
        `当前应收：¥${outstandingReceivable.toFixed(2)}`,
        `可用授信：${customerMeta.creditLimit > 0 ? `¥${availableCredit.toFixed(2)}` : '-'}`,
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
function toNumericHash(value, seed = 0) {
    const text = String(value ?? '');
    let hash = seed;
    for (let index = 0; index < text.length; index += 1) {
        hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
    }
    return Math.abs(hash);
}

function buildERPStatsFingerprint(stats) {
    const products = Array.isArray(ERP?.state?.products) ? ERP.state.products : [];
    const orders = Array.isArray(ERP?.state?.orders) ? ERP.state.orders : [];
    const finances = Array.isArray(ERP?.state?.finances) ? ERP.state.finances : [];

    const productHash = products.reduce((sum, product) => (
        sum
        + toNumericHash(product?.id, 7)
        + Math.round(Number(product?.stock_quantity) || 0)
        + Math.round(Number(product?.min_stock) || 0)
    ), 0);

    const orderHash = orders.reduce((sum, order) => (
        sum
        + toNumericHash(order?.id, 11)
        + toNumericHash(order?.status, 13)
        + toNumericHash(order?.payment_status, 17)
        + Math.round(Number(order?.total_amount) || 0)
    ), 0);

    const financeHash = finances.reduce((sum, finance) => (
        sum
        + toNumericHash(finance?.id, 19)
        + toNumericHash(finance?.type, 23)
        + Math.round(Number(finance?.amount) || 0)
    ), 0);

    return [
        Number(stats?.customers?.total || 0),
        Number(stats?.customers?.active || 0),
        Number(stats?.products?.total || 0),
        Number(stats?.products?.lowStock || 0),
        Number(stats?.orders?.total || 0),
        Number(stats?.orders?.pending || 0),
        Number(Math.round(stats?.finances?.totalIncome || 0)),
        Number(Math.round(stats?.finances?.netProfit || 0)),
        products.length,
        orders.length,
        finances.length,
        productHash,
        orderHash,
        financeHash
    ].join('|');
}

function queueStatisticsRefresh(data, options = {}, delay = 140) {
    if (erpStatsRenderState.pendingTimer) {
        clearTimeout(erpStatsRenderState.pendingTimer);
    }
    erpStatsRenderState.pendingTimer = setTimeout(() => {
        erpStatsRenderState.pendingTimer = null;
        updateStatistics(data, { ...options, force: true });
    }, delay);
}

function updateStatistics(data) {
    if (typeof ERP === 'undefined' || !ERP.getStatistics) return;

    const options = (data && typeof data === 'object' && (Object.prototype.hasOwnProperty.call(data, 'force') || Object.prototype.hasOwnProperty.call(data, 'silent')))
        ? data
        : {};
    const forceRefresh = options.force === true;
    const now = Date.now();

    const stats = ERP.getStatistics();
    const fingerprint = buildERPStatsFingerprint(stats);

    if (!forceRefresh) {
        const recentRender = now - erpStatsRenderState.lastRenderAt < 180;
        const unchanged = fingerprint === erpStatsRenderState.lastFingerprint;
        if (unchanged) {
            return;
        }
        if (recentRender) {
            queueStatisticsRefresh(data, options, 220);
            return;
        }
    }

    erpStatsRenderState.lastFingerprint = fingerprint;
    erpStatsRenderState.lastRenderAt = now;

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
    if (isFinanceModuleActive()) {
        refreshFinanceCharts();
    }

    const isDashboardModule = ERP?.config?.currentModule === 'dashboard';
    const dashboardNeedRefresh = forceRefresh
        || erpStatsRenderState.lastDashboardFingerprint !== fingerprint
        || (now - erpStatsRenderState.lastDashboardRenderAt) > 20000;

    if (isDashboardModule && dashboardNeedRefresh) {
        erpStatsRenderState.lastDashboardFingerprint = fingerprint;
        erpStatsRenderState.lastDashboardRenderAt = now;
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

    if (ERP?.runtime?.orderMutationInProgress) {
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

function clearModalFieldValidation(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) {
        return;
    }
    modal.querySelectorAll('.erp-field-invalid').forEach(node => node.classList.remove('erp-field-invalid'));
    modal.querySelectorAll('.erp-field-error').forEach(node => node.remove());
}

function getFieldErrorMessageNode(target) {
    if (!target || !target.parentElement) {
        return null;
    }
    const next = target.nextElementSibling;
    if (next && next.classList && next.classList.contains('erp-field-error')) {
        return next;
    }
    return null;
}

function setFieldError(target, message = '') {
    if (!target || !target.classList) {
        return;
    }
    target.classList.add('erp-field-invalid');

    let node = getFieldErrorMessageNode(target);
    if (!node && target.parentElement) {
        node = document.createElement('div');
        node.className = 'erp-field-error';
        target.insertAdjacentElement('afterend', node);
    }
    if (node) {
        node.textContent = String(message || '').trim() || '该字段填写不正确';
    }
}

function clearFieldError(target) {
    if (!target || !target.classList) {
        return;
    }
    target.classList.remove('erp-field-invalid');
    const node = getFieldErrorMessageNode(target);
    if (node) {
        node.remove();
    }
}

function validateFieldElement(target, options = {}) {
    if (!target) {
        return true;
    }
    const rule = String(target.getAttribute('data-validate') || '').trim().toLowerCase();
    if (!rule) {
        return true;
    }

    const silent = options?.silent === true;
    const message = String(target.getAttribute('data-error-message') || '').trim() || '该字段填写不正确';
    const value = String(target.value || '').trim();

    let valid = true;
    if (rule === 'required') {
        valid = value.length > 0;
    } else if (rule === 'positive') {
        valid = Number.isFinite(Number(value)) && Number(value) > 0;
    } else if (rule === 'nonzero') {
        valid = Number.isFinite(Number(value)) && Number(value) !== 0;
    }

    if (valid) {
        clearFieldError(target);
        return true;
    }

    setFieldError(target, message);
    if (!silent) {
        if (typeof showToast === 'function') {
            showToast(message, 'warning');
        } else {
            alert(message);
        }
    }
    return false;
}

function markFieldInvalid(fieldId, message = '') {
    const target = document.getElementById(fieldId);
    if (target && target.classList) {
        setFieldError(target, message);
        if (typeof target.focus === 'function') {
            target.focus();
        }
    } else if (message) {
        if (typeof showToast === 'function') {
            showToast(message, 'warning');
        } else {
            alert(message);
        }
    }
    if (message && !target) {
        if (typeof showToast === 'function') {
            showToast(message, 'warning');
        } else {
            alert(message);
        }
    }
    return false;
}

if (!window.__erpFieldValidationBound) {
    const clearInvalidClass = (event) => {
        const node = event?.target;
        if (node && node.classList && node.getAttribute('data-validate')) {
            validateFieldElement(node, { silent: true });
            return;
        }
        if (node && node.classList && node.classList.contains('erp-field-invalid')) {
            clearFieldError(node);
        }
    };
    document.addEventListener('input', clearInvalidClass, true);
    document.addEventListener('change', clearInvalidClass, true);
    document.addEventListener('blur', clearInvalidClass, true);
    window.__erpFieldValidationBound = true;
}

function isElementVisible(node) {
    if (!node) {
        return false;
    }
    if (node.type === 'hidden') {
        return false;
    }
    if (node.closest('[style*="display: none"]')) {
        return false;
    }
    return node.offsetParent !== null || getComputedStyle(node).position === 'fixed';
}

function getModalFocusableFields(current) {
    const modalForm = current?.closest?.('.erp-modal-form');
    if (!modalForm) {
        return [];
    }
    return Array.from(modalForm.querySelectorAll('input, select, textarea, button'))
        .filter(node => !node.disabled && isElementVisible(node));
}

if (!window.__erpEnterNavigateBound) {
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' || event.shiftKey) {
            return;
        }
        const target = event.target;
        if (!target || !target.closest || !target.closest('.erp-modal-form')) {
            return;
        }
        if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') {
            return;
        }
        event.preventDefault();
        const fields = getModalFocusableFields(target);
        const currentIndex = fields.indexOf(target);
        if (currentIndex < 0) {
            return;
        }
        for (let index = currentIndex + 1; index < fields.length; index += 1) {
            const next = fields[index];
            if (next && typeof next.focus === 'function') {
                next.focus();
                if (next.tagName === 'INPUT' && next.type !== 'checkbox' && next.type !== 'radio') {
                    next.select?.();
                }
                break;
            }
        }
    }, true);
    window.__erpEnterNavigateBound = true;
}

// ==================== 客户管理 ====================
function showCustomerModal(customer = null) {
    const modal = document.getElementById('customerModal');
    if (!modal) {
        console.error('[ERP Ant] 找不到 customerModal 元素');
        return;
    }

    const title = document.getElementById('customerModalTitle');
    const form = document.getElementById('customerForm');

    if (customer) {
        const customerMeta = getCustomerSmeMeta(customer);
        title.textContent = '编辑客户';
        document.getElementById('customerId').value = customer.id;
        document.getElementById('customerName').value = customer.name;
        document.getElementById('customerContactPerson').value = customer.contact_person || '';
        document.getElementById('customerPhone').value = customer.phone || '';
        document.getElementById('customerEmail').value = customer.email || '';
        document.getElementById('customerAddress').value = customer.address || '';
        document.getElementById('customerNotes').value = stripCustomerMetaLines(customer.notes || '');
        document.getElementById('customerTier').value = customerMeta.tier || '';
        document.getElementById('customerCreditLimit').value = customerMeta.creditLimit > 0 ? customerMeta.creditLimit.toFixed(2) : '';
        document.getElementById('customerPaymentTermDays').value = customerMeta.paymentTermDays > 0 ? String(customerMeta.paymentTermDays) : '';

        const statusSelect = document.getElementById('customerStatus');
        const validStatus = customer.status && statusSelect.querySelector(`option[value="${customer.status}"]`);
        statusSelect.value = validStatus ? customer.status : 'active';
    } else {
        title.textContent = '添加客户';
        form.reset();
        document.getElementById('customerId').value = '';
        document.getElementById('customerStatus').value = 'active';
        document.getElementById('customerTier').value = '';
        document.getElementById('customerCreditLimit').value = '';
        document.getElementById('customerPaymentTermDays').value = '';
    }

    modal.classList.add('active');
    modal.style.display = 'flex';
    clearModalFieldValidation('customerModal');
}

function hideCustomerModal() {
    const modal = document.getElementById('customerModal');
    modal.classList.remove('active');
    modal.style.display = '';
}

async function saveCustomer() {
    clearModalFieldValidation('customerModal');
    const customerId = document.getElementById('customerId').value;
    const customerMeta = {
        tier: String(document.getElementById('customerTier')?.value || '').trim(),
        creditLimit: Math.max(0, toSafeNumber(document.getElementById('customerCreditLimit')?.value, 0)),
        paymentTermDays: Math.max(0, Math.floor(toSafeNumber(document.getElementById('customerPaymentTermDays')?.value, 0)))
    };
    const customerData = {
        name: document.getElementById('customerName').value,
        contact_person: document.getElementById('customerContactPerson').value,
        phone: document.getElementById('customerPhone').value,
        email: document.getElementById('customerEmail').value,
        address: document.getElementById('customerAddress').value,
        notes: buildCustomerNotesWithMeta(document.getElementById('customerNotes').value, customerMeta),
        status: document.getElementById('customerStatus').value
    };

    if (!customerData.name) {
        markFieldInvalid('customerName', '请输入客户名称');
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
    clearModalFieldValidation('productModal');
}

function hideProductModal() {
    const modal = document.getElementById('productModal');
    modal.classList.remove('active');
    modal.style.display = '';
}

async function saveProduct() {
    clearModalFieldValidation('productModal');
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

    if (!productData.name) {
        markFieldInvalid('productName', '请输入产品名称');
        return;
    }
    if (!productData.price || Number(productData.price) <= 0) {
        markFieldInvalid('productPrice', '请输入有效售价');
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
    confirmed: ['shipped', 'signed', 'completed', 'cancelled'],
    shipped: ['signed', 'refunded'],
    signed: ['completed', 'refunded'],
    completed: [],
    refunded: [],
    cancelled: []
};

const ERP_ORDER_STAGE_FLOW = [
    { key: 'pending', text: '待处理' },
    { key: 'confirmed', text: '已确认' },
    { key: 'shipped', text: '已发货' },
    { key: 'signed', text: '已签收' },
    { key: 'completed', text: '已完成' }
];

function normalizeOrderStatusValue(status) {
    const raw = String(status || '').trim().toLowerCase();
    const legacyMap = {
        processing: 'confirmed'
    };
    const normalized = legacyMap[raw] || raw || 'pending';
    return ERP_ORDER_STATUS_META[normalized] ? normalized : 'pending';
}

function normalizeShippingStatusValue(status) {
    const raw = String(status || '').trim().toLowerCase();
    const legacyMap = {
        signed: 'delivered',
        sign: 'delivered',
        intransit: 'in_transit',
        transit: 'in_transit'
    };
    const normalized = legacyMap[raw] || raw || 'not_shipped';
    const validSet = new Set(['not_shipped', 'shipped', 'in_transit', 'delivered', 'rejected', 'returned']);
    return validSet.has(normalized) ? normalized : 'not_shipped';
}

function resolveNextOrderStatusByTarget(currentStatus, targetStatus) {
    const from = normalizeOrderStatusValue(currentStatus);
    const to = normalizeOrderStatusValue(targetStatus);
    if (from === to) {
        return from;
    }

    const allowed = ERP_ORDER_STATUS_TRANSITIONS[from] || [];
    if (allowed.includes(to)) {
        return to;
    }

    const stageFlow = ERP_ORDER_STAGE_FLOW.map(item => item.key);
    const fromIndex = stageFlow.indexOf(from);
    const toIndex = stageFlow.indexOf(to);
    if (fromIndex < 0 || toIndex < 0 || toIndex <= fromIndex) {
        return from;
    }

    for (let index = fromIndex + 1; index <= toIndex; index += 1) {
        const candidate = stageFlow[index];
        if (allowed.includes(candidate)) {
            return candidate;
        }
    }
    return from;
}

function getOrderStatusTextByValue(status) {
    const normalized = normalizeOrderStatusValue(status);
    return ERP_ORDER_STATUS_META[normalized]?.text || '待处理';
}

function getOrderSummaryPaymentText(status) {
    const map = {
        unpaid: '未支付',
        partial: '部分支付',
        paid: '已支付'
    };
    const key = String(status || '').trim().toLowerCase();
    return map[key] || '未支付';
}

function getOrderSummaryShippingText(status) {
    const map = {
        not_shipped: '未发货',
        shipped: '已发货',
        in_transit: '运输中',
        signed: '已签收',
        delivered: '已签收',
        rejected: '已拒收',
        returned: '已退货'
    };
    const key = normalizeShippingStatusValue(status);
    return map[key] || '未发货';
}

function renderOrderModalStage(status) {
    const stageEl = document.getElementById('orderSummaryStage');
    if (!stageEl) {
        return;
    }
    const normalizedStatus = normalizeOrderStatusValue(status || 'pending');
    const currentIndex = Math.max(0, ERP_ORDER_STAGE_FLOW.findIndex(item => item.key === normalizedStatus));

    stageEl.innerHTML = ERP_ORDER_STAGE_FLOW.map((item, index) => {
        const stateClass = index < currentIndex
            ? 'is-done'
            : (index === currentIndex ? 'is-current' : 'is-wait');
        return `<span class="erp-order-stage-item ${stateClass}">${item.text}</span>`;
    }).join('');
}

function renderOrderModalSummary(sourceOrder = null, riskAnalysis = null) {
    const summaryEl = document.getElementById('orderModalSummary');
    if (!summaryEl) {
        return;
    }

    const orderIdInput = document.getElementById('orderId');
    const orderId = normalizeEntityId(orderIdInput?.value);
    const stateOrder = orderId !== null
        ? (ERP.state.orders || []).find(order => isSameEntityId(order?.id, orderId))
        : null;
    const currentOrder = sourceOrder || stateOrder || null;

    const orderNoEl = document.getElementById('orderSummaryNo');
    const customerEl = document.getElementById('orderSummaryCustomer');
    const itemsEl = document.getElementById('orderSummaryItems');
    const itemsSubEl = document.getElementById('orderSummaryItemsSub');
    const amountEl = document.getElementById('orderSummaryAmount');
    const amountSubEl = document.getElementById('orderSummaryAmountSub');
    const statusEl = document.getElementById('orderSummaryStatus');
    const statusSubEl = document.getElementById('orderSummaryStatusSub');
    const riskEl = document.getElementById('orderSummaryRisk');
    const riskSubEl = document.getElementById('orderSummaryRiskSub');
    const historyBtn = document.getElementById('orderModalHistoryBtn');

    const customerSelect = document.getElementById('orderCustomer');
    const customerId = normalizeEntityId(customerSelect?.value);
    const selectedCustomer = customerId !== null
        ? (ERP.state.customers || []).find(item => isSameEntityId(item?.id, customerId))
        : null;

    const orderNumber = String(
        currentOrder?.order_number
        || (orderId !== null ? `订单#${orderId}` : '新建订单')
    ).trim();
    const customerName = String(
        selectedCustomer?.name
        || currentOrder?.customer_name
        || (customerSelect?.selectedOptions?.[0]?.text || '').replace('请选择客户', '').trim()
        || '-'
    ).trim();

    const formItems = getOrderItems();
    const currentItems = formItems.length > 0
        ? formItems.map(item => ({
            productName: String(item?.productName || '').trim(),
            quantity: Math.max(Number(item?.quantity || 0), 0),
            unitPrice: Math.max(Number(item?.unitPrice || 0), 0)
        }))
        : (Array.isArray(currentOrder?.items) ? currentOrder.items.map(item => ({
            productName: String(item?.product_name || '').trim(),
            quantity: Math.max(Number(item?.quantity || 0), 0),
            unitPrice: Math.max(Number(item?.unit_price || 0), 0)
        })) : []);

    const totalAmountInput = document.getElementById('orderTotalAmount');
    const currentTotalAmount = Math.max(
        Number(totalAmountInput?.value || currentOrder?.total_amount || 0) || 0,
        0
    );
    const suggestedTotal = currentItems.reduce((sum, item) => (
        sum + Math.max(Number(item.unitPrice || 0), 0) * Math.max(Number(item.quantity || 0), 0)
    ), 0);

    const normalizedStatus = normalizeOrderStatusValue(
        document.getElementById('orderStatus')?.value || currentOrder?.status || 'pending'
    );
    const paymentStatus = String(
        document.getElementById('orderPaymentStatus')?.value || currentOrder?.payment_status || 'unpaid'
    ).trim().toLowerCase();
    const shippingStatus = normalizeShippingStatusValue(
        document.getElementById('orderShippingStatus')?.value || currentOrder?.shipping_status || 'not_shipped'
    );

    const normalizedItems = currentItems.map(item => ({
        product_id: null,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: item.unitPrice
    }));
    const analysis = riskAnalysis || buildOrderRiskAnalysis(normalizedItems, currentTotalAmount || suggestedTotal);
    const riskRank = Number(analysis?.riskRank || 0);
    const riskText = riskRank >= 3 ? '高风险' : (riskRank >= 2 ? '关注' : '正常');
    const riskClass = riskRank >= 3 ? 'is-danger' : (riskRank >= 2 ? 'is-warning' : 'is-normal');

    const itemCount = currentItems.length;
    const itemPreview = currentItems
        .slice(0, 2)
        .map(item => {
            if (!item.productName) return '';
            return item.quantity > 0 ? `${item.productName}×${item.quantity}` : item.productName;
        })
        .filter(Boolean)
        .join('；');
    const itemPreviewText = itemPreview || '暂无商品明细';
    const itemMoreText = itemCount > 2 ? `（共 ${itemCount} 项）` : '';

    if (orderNoEl) orderNoEl.textContent = orderNumber;
    if (customerEl) customerEl.textContent = customerName || '-';
    if (itemsEl) itemsEl.textContent = `${itemCount} 项`;
    if (itemsSubEl) itemsSubEl.textContent = `${itemPreviewText}${itemMoreText}`;
    if (amountEl) amountEl.textContent = formatCurrency(currentTotalAmount);
    if (amountSubEl) amountSubEl.textContent = `建议价 ${formatCurrency(suggestedTotal)}`;
    if (statusEl) statusEl.textContent = getOrderStatusTextByValue(normalizedStatus);
    if (statusSubEl) {
        statusSubEl.textContent = `${getOrderSummaryPaymentText(paymentStatus)} · ${getOrderSummaryShippingText(shippingStatus)}`;
    }
    if (riskEl) {
        riskEl.textContent = riskText;
        riskEl.classList.remove('is-danger', 'is-warning', 'is-normal');
        riskEl.classList.add(riskClass);
    }
    if (riskSubEl) {
        const alertsCount = Array.isArray(analysis?.alerts) ? analysis.alerts.length : 0;
        riskSubEl.textContent = alertsCount > 0 ? `触发 ${alertsCount} 条风控规则` : '当前未触发风控规则';
    }

    if (historyBtn) {
        historyBtn.style.display = orderId !== null ? '' : 'none';
    }

    renderOrderModalStage(normalizedStatus);
}

function openCurrentOrderApprovalHistory() {
    const orderId = normalizeEntityId(document.getElementById('orderId')?.value);
    if (orderId === null) {
        if (typeof showToast === 'function') {
            showToast('请先保存订单后再查看审批记录', 'warning');
        }
        return;
    }
    if (typeof showOrderApprovalHistory === 'function') {
        showOrderApprovalHistory(orderId);
    }
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

function inferFulfillmentFromLogisticsResult(result = {}, timeline = []) {
    const firstEvent = Array.isArray(timeline) && timeline.length > 0 ? timeline[0] : null;
    const sourceText = [
        result?.latestStatusText,
        result?.latestStatusCode,
        firstEvent?.displayText,
        firstEvent?.status,
        firstEvent?.description,
        firstEvent?.location
    ]
        .map(value => String(value || '').trim().toLowerCase())
        .join(' ');

    if (!sourceText) {
        return null;
    }

    const includesAny = keywords => keywords.some(keyword => sourceText.includes(keyword));

    if (includesAny(['签收', '妥投', '已送达', '投递成功', 'delivered', 'signed'])) {
        return { shippingStatus: 'delivered', orderStatus: 'signed' };
    }
    if (includesAny(['拒收', 'rejected'])) {
        return { shippingStatus: 'rejected', orderStatus: 'shipped' };
    }
    if (includesAny(['退回', '退货', '返回', 'returned', 'return'])) {
        return { shippingStatus: 'returned', orderStatus: 'shipped' };
    }
    if (includesAny(['运输中', '在途', '派送中', '中转', 'in transit', 'transit'])) {
        return { shippingStatus: 'in_transit', orderStatus: 'shipped' };
    }
    if (includesAny(['已发货', '已揽收', '揽件', '出库', 'shipped', 'picked up'])) {
        return { shippingStatus: 'shipped', orderStatus: 'shipped' };
    }
    return null;
}

function applyLogisticsStatusToOrderForm(suggestion = null) {
    if (!suggestion) {
        return { changed: false, orderStatus: null, shippingStatus: null };
    }

    const orderStatusSelect = document.getElementById('orderStatus');
    const shippingStatusSelect = document.getElementById('orderShippingStatus');
    const paymentStatusSelect = document.getElementById('orderPaymentStatus');
    const currentOrderStatus = normalizeOrderStatusValue(orderStatusSelect?.value || 'pending');
    const currentShippingStatus = normalizeShippingStatusValue(shippingStatusSelect?.value || 'not_shipped');
    const currentPaymentStatus = String(paymentStatusSelect?.value || 'unpaid').trim().toLowerCase();

    const nextShippingStatus = normalizeShippingStatusValue(suggestion.shippingStatus || currentShippingStatus);
    let nextOrderStatus = resolveNextOrderStatusByTarget(currentOrderStatus, suggestion.orderStatus || currentOrderStatus);
    if (nextShippingStatus === 'delivered' && currentPaymentStatus === 'paid') {
        nextOrderStatus = resolveNextOrderStatusByTarget(nextOrderStatus, 'completed');
    }
    const changed = nextOrderStatus !== currentOrderStatus || nextShippingStatus !== currentShippingStatus;

    if (shippingStatusSelect && shippingStatusSelect.querySelector(`option[value="${nextShippingStatus}"]`)) {
        shippingStatusSelect.value = nextShippingStatus;
    }

    if (orderStatusSelect) {
        refreshOrderStatusOptions(nextOrderStatus, false);
        if (orderStatusSelect.querySelector(`option[value="${nextOrderStatus}"]`)) {
            orderStatusSelect.value = nextOrderStatus;
        }
    }

    if (changed) {
        renderOrderModalSummary();
    }

    return {
        changed,
        orderStatus: nextOrderStatus,
        shippingStatus: nextShippingStatus
    };
}

async function persistOrderFulfillmentAutoSync(updatePayload = {}) {
    const orderId = normalizeEntityId(document.getElementById('orderId')?.value);
    if (orderId === null || !window.ERP || typeof ERP.updateOrder !== 'function') {
        return false;
    }

    const currentOrder = (ERP.state?.orders || []).find(order => isSameEntityId(order?.id, orderId));
    if (!currentOrder) {
        return false;
    }

    const currentOrderStatus = normalizeOrderStatusValue(currentOrder?.status || 'pending');
    const currentShippingStatus = normalizeShippingStatusValue(currentOrder?.shipping_status || 'not_shipped');
    const nextShippingStatus = normalizeShippingStatusValue(updatePayload?.shippingStatus || currentShippingStatus);
    const paymentStatusFromForm = String(document.getElementById('orderPaymentStatus')?.value || currentOrder?.payment_status || 'unpaid').trim().toLowerCase();
    let nextOrderStatus = resolveNextOrderStatusByTarget(currentOrderStatus, updatePayload?.orderStatus || currentOrderStatus);
    if (nextShippingStatus === 'delivered' && paymentStatusFromForm === 'paid') {
        nextOrderStatus = resolveNextOrderStatusByTarget(nextOrderStatus, 'completed');
    }

    if (nextOrderStatus === currentOrderStatus && nextShippingStatus === currentShippingStatus) {
        return false;
    }

    const shippingCompanyFromForm = String(getOrderShippingCompanyFromForm() || '').trim();
    const trackingNumberFromForm = normalizeTrackingNumber(document.getElementById('orderTrackingNumber')?.value || '');

    const saveData = {
        customer_id: normalizeEntityId(currentOrder?.customer_id),
        notes: String(currentOrder?.notes || ''),
        status: nextOrderStatus,
        payment_status: paymentStatusFromForm,
        shipping_company: shippingCompanyFromForm || String(currentOrder?.shipping_company || ''),
        tracking_number: trackingNumberFromForm || String(currentOrder?.tracking_number || ''),
        shipping_status: nextShippingStatus,
        total_amount: Number(currentOrder?.total_amount || 0),
        items: Array.isArray(currentOrder?.items) ? currentOrder.items : []
    };

    const updated = await ERP.updateOrder(orderId, saveData);
    if (!updated) {
        return false;
    }

    if (typeof searchOrders === 'function') {
        searchOrders();
    }
    updateStatistics();
    return true;
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

        const fulfillmentSuggestion = inferFulfillmentFromLogisticsResult(result, timeline);
        const formUpdateResult = applyLogisticsStatusToOrderForm(fulfillmentSuggestion);
        const shouldAutoPersist = options?.autoPersist !== false;
        if (formUpdateResult.changed && shouldAutoPersist) {
            const persisted = await persistOrderFulfillmentAutoSync(formUpdateResult);
            if (persisted && typeof showToast === 'function') {
                const statusText = getOrderStatusTextByValue(formUpdateResult.orderStatus);
                const shippingMap = {
                    not_shipped: '未发货',
                    shipped: '已发货',
                    in_transit: '运输中',
                    delivered: '已签收',
                    rejected: '已拒收',
                    returned: '已退货'
                };
                const shippingText = shippingMap[formUpdateResult.shippingStatus] || '已同步';
                showToast(`已根据物流轨迹自动同步：${statusText} / ${shippingText}`, 'success');
            }
        }
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
    renderOrderModalSummary(null, analysis);
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

function buildOrderItemRowHtml(productOptionsHtml = '', quantity = 1, unitPrice = 0) {
    const safeQuantity = Math.max(1, Number(quantity || 1));
    const safeUnitPrice = Math.max(0, Number(unitPrice || 0));
    return `
        <div class="erp-order-item-top">
            <label class="erp-order-item-label">商品</label>
            <select class="ant-select product-select" style="width:100%;" onchange="updateOrderItemTotal(this)">
                <option value="">选择产品</option>
                ${productOptionsHtml}
            </select>
        </div>
        <div class="erp-order-item-main">
            <div class="erp-order-item-field">
                <label class="erp-order-item-label">数量</label>
                <input type="number" class="ant-input item-quantity" value="${safeQuantity}" min="1" onchange="updateOrderItemTotal(this)">
            </div>
            <div class="erp-order-item-field">
                <label class="erp-order-item-label">单价</label>
                <input type="number" class="ant-input item-unit-price" value="${safeUnitPrice.toFixed(2)}" min="0" step="0.01" onchange="updateOrderItemTotal(this)" placeholder="单价">
            </div>
            <div class="erp-order-item-field">
                <label class="erp-order-item-label">小计</label>
                <input type="text" class="ant-input item-total erp-order-item-total" readonly value="¥0.00">
            </div>
            <button type="button" class="ant-btn erp-btn-danger erp-btn-compact" onclick="removeOrderItem(this)">删除</button>
        </div>
    `;
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
                row.className = 'order-item erp-order-item-card';
                row.innerHTML = buildOrderItemRowHtml(
                    `${fallbackOption}${ERP.state.products.map(p => `<option value="${p.id}" data-name="${p.name}" data-price="${p.price}">${p.name} - ¥${p.price}</option>`).join('')}`,
                    detail.quantity || 1,
                    parseFloat(detail.unit_price || 0)
                );
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
    clearModalFieldValidation('orderModal');
}

function hideOrderModal() {
    const modal = document.getElementById('orderModal');
    modal.classList.remove('active');
    modal.style.display = '';
}

async function saveOrder() {
    clearModalFieldValidation('orderModal');
    const orderId = document.getElementById('orderId').value;
    const customerId = document.getElementById('orderCustomer').value;

    if (!customerId) {
        markFieldInvalid('orderCustomer', '请选择客户');
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
        markFieldInvalid('orderItems', '请至少添加一个产品');
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
    const selectedCustomer = (ERP.state.customers || []).find(item => isSameEntityId(item?.id, normalizeEntityId(customerId))) || null;
    const customerMeta = getCustomerSmeMeta(selectedCustomer || {});
    const outstandingReceivable = calculateCustomerOutstandingReceivable(
        normalizeEntityId(customerId),
        orderId ? normalizeEntityId(orderId) : null
    );
    const projectedReceivable = outstandingReceivable + Math.max(0, toSafeNumber(totalAmount, 0));
    if (customerMeta.creditLimit > 0 && projectedReceivable > customerMeta.creditLimit) {
        const overLimitAmount = projectedReceivable - customerMeta.creditLimit;
        const shouldContinue = confirm(
            `客户「${selectedCustomer?.name || '-'}」将超出信用额度。\n`
            + `信用额度：${formatCurrency(customerMeta.creditLimit)}\n`
            + `当前应收：${formatCurrency(outstandingReceivable)}\n`
            + `本单金额：${formatCurrency(totalAmount)}\n`
            + `超出额度：${formatCurrency(overLimitAmount)}\n\n是否继续保存？`
        );
        if (!shouldContinue) {
            return;
        }
    }
    const riskReasonInput = document.getElementById('orderRiskApprovalReason');
    const riskApprovalReason = String(riskReasonInput?.value || '').trim();
    if (riskAnalysis.riskRank >= 3 && !riskApprovalReason) {
        markFieldInvalid('orderRiskApprovalReason', '高风险订单必须填写审批原因后才能保存');
        return;
    }

    const originalNotes = String(document.getElementById('orderNotes').value || '').trim();
    const baseNotes = originalNotes
        .split('\n')
        .filter(line => {
            const text = String(line || '').trim();
            return text
                && !text.startsWith('[风控审批]')
                && !text.startsWith('[订单账期]')
                && !text.startsWith('[预计回款]')
                && !text.startsWith('[订单金额]');
        })
        .join('\n')
        .trim();
    const notesWithPaymentMeta = appendOrderPaymentTermNotes(baseNotes, customerMeta, totalAmount);

    const orderData = {
        customer_id: normalizeEntityId(customerId),
        customer_name: (document.getElementById('orderCustomer')?.selectedOptions?.[0]?.text || '').trim(),
        notes: (() => {
            if (riskAnalysis.riskRank >= 3) {
                const approvalLine = `[风控审批] ${riskApprovalReason}`;
                return notesWithPaymentMeta ? `${notesWithPaymentMeta}\n${approvalLine}` : approvalLine;
            }
            return notesWithPaymentMeta;
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
            }
        }

        if (result && orderId) {
            // 订单更新成功
            hideOrderModal();
            
            // 直接使用本地状态刷新，减少等待
            searchOrders();
            updateStatistics();
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

function batchExportSelectedOrders() {
    const rows = getSelectedRowsByModule('orders');
    if (!rows.length) {
        if (typeof showToast === 'function') {
            showToast('请先勾选要导出的订单', 'info');
        }
        return;
    }

    const customers = Array.isArray(ERP.state?.customers) ? ERP.state.customers : [];
    const customerMap = new Map(customers.map(item => [String(item?.id), item]));
    const headers = ['订单号', '客户', '订单日期', '金额', '状态', '支付状态', '发货状态', '物流公司', '运单号', '备注'];
    const exportRows = rows.map(order => {
        const customer = customerMap.get(String(order?.customer_id || ''));
        return [
            order?.order_number || `订单#${order?.id || '-'}`,
            customer?.name || '-',
            order?.order_date || '-',
            Number(order?.total_amount || 0).toFixed(2),
            getOrderStatusText(order?.status),
            getPaymentStatusText(order?.payment_status),
            getShippingStatusText(order?.shipping_status),
            order?.shipping_company || '-',
            order?.tracking_number || '-',
            order?.notes || '-'
        ];
    });

    downloadCsvFile(`订单已选记录-${formatFileTimestamp()}.csv`, headers, exportRows);
    if (typeof showToast === 'function') {
        showToast(`已导出 ${exportRows.length} 条订单记录`, 'success');
    }
}

async function batchDeleteSelectedOrders() {
    const rows = getSelectedRowsByModule('orders');
    if (!rows.length) {
        if (typeof showToast === 'function') {
            showToast('请先勾选要删除的订单', 'info');
        }
        return;
    }

    const shouldDelete = window.confirm(`确认删除选中的 ${rows.length} 条订单吗？该操作会同步影响财务记录。`);
    if (!shouldDelete) {
        return;
    }

    let successCount = 0;
    let failCount = 0;
    for (const row of rows) {
        try {
            await ERP.deleteOrder(row.id);
            tableBatchState.orders.selectedIds.delete(normalizeTableRowId(row.id));
            successCount += 1;
        } catch (error) {
            failCount += 1;
            console.error('[ERP Ant] 批量删除订单失败:', error);
        }
    }

    await Promise.all([
        ERP.loadOrders(true),
        ERP.loadFinances(true)
    ]);
    searchOrders();
    applyFinanceFilters();
    updateStatistics();
    if (typeof showToast === 'function') {
        showToast(`批量删除订单完成：成功 ${successCount}，失败 ${failCount}`, failCount > 0 ? 'warning' : 'success');
    }
}

function batchExportSelectedCustomers() {
    const rows = getSelectedRowsByModule('customers');
    if (!rows.length) {
        if (typeof showToast === 'function') {
            showToast('请先勾选要导出的客户', 'info');
        }
        return;
    }

    const headers = ['客户名称', '联系人', '电话', '邮箱', '地址', '备注', '状态'];
    const exportRows = rows.map(item => [
        item?.name || '-',
        item?.contact_person || '-',
        item?.phone || '-',
        item?.email || '-',
        item?.address || '-',
        item?.notes || '-',
        item?.status === 'active' ? '活跃' : '停用'
    ]);
    downloadCsvFile(`客户已选记录-${formatFileTimestamp()}.csv`, headers, exportRows);
    if (typeof showToast === 'function') {
        showToast(`已导出 ${exportRows.length} 条客户记录`, 'success');
    }
}

async function batchDeleteSelectedCustomers() {
    const rows = getSelectedRowsByModule('customers');
    if (!rows.length) {
        if (typeof showToast === 'function') {
            showToast('请先勾选要删除的客户', 'info');
        }
        return;
    }

    const shouldDelete = window.confirm(`确认删除选中的 ${rows.length} 条客户记录吗？`);
    if (!shouldDelete) {
        return;
    }

    let successCount = 0;
    let failCount = 0;
    for (const row of rows) {
        try {
            await ERP.deleteCustomer(row.id);
            tableBatchState.customers.selectedIds.delete(normalizeTableRowId(row.id));
            successCount += 1;
        } catch (error) {
            failCount += 1;
            console.error('[ERP Ant] 批量删除客户失败:', error);
        }
    }

    await ERP.loadCustomers({ forceRefresh: true });
    searchCustomers();
    updateStatistics();
    if (typeof showToast === 'function') {
        showToast(`批量删除客户完成：成功 ${successCount}，失败 ${failCount}`, failCount > 0 ? 'warning' : 'success');
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
    return toDateTimeText(date);
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
        body.innerHTML = '<div class="erp-history-loading">审批记录加载中...</div>';
        return;
    }

    if (errorMessage || orderApprovalHistoryState.errorMessage) {
        body.innerHTML = `<div class="erp-history-error">${escapeHtmlText(errorMessage || orderApprovalHistoryState.errorMessage)}</div>`;
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
                <td class="erp-cell-nowrap">${indexText}</td>
                <td class="erp-cell-nowrap">${actionText}</td>
                <td>${fromText} → ${toText}</td>
                <td class="erp-cell-nowrap">${operatorText}</td>
                <td title="${remarkText}"><span class="erp-cell-ellipsis">${remarkText}</span></td>
                <td class="erp-cell-nowrap">${timeText}</td>
            </tr>
        `;
    }).join('');

    const tableContent = filteredRecords.length > 0
        ? `
            <div class="ant-table-wrapper erp-block-card erp-history-table">
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
        : '<div class="erp-history-empty">当前筛选条件下暂无审批记录</div>';

    body.innerHTML = `
        <div class="search-form erp-history-toolbar">
            <div class="search-item">
                <label class="search-label">筛选关键词:</label>
                <input type="text" id="orderApprovalHistorySearch" class="ant-input erp-history-input"
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
                <button class="ant-btn" onclick="resetOrderApprovalHistoryFilters()">重置</button>
            </div>
            <div class="search-item">
                <button class="ant-btn erp-btn-blue" onclick="exportOrderApprovalHistoryCsv()">
                    导出审批CSV
                </button>
            </div>
        </div>
        <div class="erp-history-meta">
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
                        <td class="erp-cell-nowrap">${toDateTimeText(date || '-')}</td>
                        <td><span class="erp-amount-text is-expense">${formatCurrency(Math.abs(Number(item?.amount || 0)))}</span></td>
                        <td><span class="erp-cell-ellipsis">${escapeHtmlText(item?.description || '-')}</span></td>
                        <td class="erp-cell-nowrap">${item?.id || '-'}</td>
                    </tr>
                `;
            }).join('')
        : '<tr><td colspan="4" class="erp-history-empty-cell">暂无付款记录</td></tr>';

    bodyEl.innerHTML = `
        <div class="erp-history-summary-grid">
            <div class="erp-history-summary-card">
                <div class="erp-history-summary-label">累计已付款</div>
                <div class="erp-history-summary-value is-paid">${formatCurrency(totalPaid)}</div>
            </div>
            <div class="erp-history-summary-card is-warning">
                <div class="erp-history-summary-label">当前剩余应付</div>
                <div class="erp-history-summary-value is-payable">${formatCurrency(remainingAmount)}</div>
            </div>
        </div>
        <div class="ant-table-wrapper erp-block-card erp-history-table">
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
                toDateTimeText(date || item?.transaction_date || '-'),
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
    modal.style.zIndex = '1300';
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

function getOrderPaymentFilterValue() {
    const paymentSelect = document.getElementById('orderPaymentFilter');
    return String(paymentSelect?.value || 'all').trim().toLowerCase();
}

function getOrderShippingFilterValue() {
    const shippingSelect = document.getElementById('orderShippingFilter');
    return String(shippingSelect?.value || 'all').trim().toLowerCase();
}

function getOrderRiskFilterValue() {
    const riskSelect = document.getElementById('orderRiskFilter');
    return String(riskSelect?.value || 'all').trim().toLowerCase();
}

function getOrderDateRangePresetValue() {
    const rangeSelect = document.getElementById('orderDateRange');
    return String(rangeSelect?.value || 'all').trim();
}

function getOrderRangeFromPreset(preset = 'all') {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    switch (preset) {
        case 'today':
            return { start: todayStart, end: todayEnd };
        case 'thisWeek': {
            const day = now.getDay();
            const mondayOffset = day === 0 ? -6 : (1 - day);
            const start = new Date(todayStart);
            start.setDate(start.getDate() + mondayOffset);
            return { start, end: todayEnd };
        }
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

function parseOrderDateForFilter(value) {
    if (!value) {
        return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return parsed;
}

function getOrderDateRangeFilterBounds() {
    const rangePreset = getOrderDateRangePresetValue();
    const customStart = String(document.getElementById('orderDateStart')?.value || '').trim();
    const customEnd = String(document.getElementById('orderDateEnd')?.value || '').trim();

    if (rangePreset === 'custom') {
        return {
            start: customStart ? new Date(`${customStart}T00:00:00`) : null,
            end: customEnd ? new Date(`${customEnd}T23:59:59.999`) : null
        };
    }
    return getOrderRangeFromPreset(rangePreset);
}

function updateOrderQuickRangeButtons() {
    const rangePreset = getOrderDateRangePresetValue();
    const buttons = document.querySelectorAll('[data-order-range-btn]');
    buttons.forEach(button => {
        const buttonPreset = String(button.getAttribute('data-order-range-btn') || '').trim();
        button.classList.toggle('is-active', buttonPreset === rangePreset);
    });
}

function setOrderDateRangePreset(preset = 'all') {
    const rangeSelect = document.getElementById('orderDateRange');
    if (rangeSelect) {
        rangeSelect.value = String(preset || 'all');
    }
    onOrderDateRangeChange();
}

function onOrderDateRangeChange() {
    const rangePreset = getOrderDateRangePresetValue();
    const startInput = document.getElementById('orderDateStart');
    const endInput = document.getElementById('orderDateEnd');
    const isCustom = rangePreset === 'custom';

    if (startInput) {
        startInput.disabled = !isCustom;
        if (!isCustom) {
            startInput.value = '';
        }
    }
    if (endInput) {
        endInput.disabled = !isCustom;
        if (!isCustom) {
            endInput.value = '';
        }
    }

    updateOrderQuickRangeButtons();
    searchOrders();
}

function initOrderFilters() {
    const rangeSelect = document.getElementById('orderDateRange');
    const startInput = document.getElementById('orderDateStart');
    const endInput = document.getElementById('orderDateEnd');
    const paymentSelect = document.getElementById('orderPaymentFilter');
    const shippingSelect = document.getElementById('orderShippingFilter');
    const riskSelect = document.getElementById('orderRiskFilter');

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
    if (paymentSelect) {
        paymentSelect.value = 'all';
    }
    if (shippingSelect) {
        shippingSelect.value = 'all';
    }
    if (riskSelect) {
        riskSelect.value = 'all';
    }

    updateOrderQuickRangeButtons();
}

function isOrderShippingDelayRisk(order) {
    const status = normalizeOrderStatusValue(order?.status || 'pending');
    const shippingStatus = normalizeShippingStatusValue(order?.shipping_status || 'not_shipped');
    if (status !== 'confirmed') {
        return false;
    }
    if (['shipped', 'in_transit', 'delivered', 'returned', 'rejected'].includes(shippingStatus)) {
        return false;
    }
    const orderDate = parseOrderDateForFilter(order?.order_date);
    if (!orderDate) {
        return false;
    }
    return (Date.now() - orderDate.getTime()) > (48 * 60 * 60 * 1000);
}

function isOrderSignDelayRisk(order) {
    const status = normalizeOrderStatusValue(order?.status || 'pending');
    const shippingStatus = normalizeShippingStatusValue(order?.shipping_status || 'not_shipped');
    if (!['shipped', 'signed'].includes(status) && !['shipped', 'in_transit'].includes(shippingStatus)) {
        return false;
    }
    if (['signed', 'completed', 'refunded', 'cancelled'].includes(status) || shippingStatus === 'delivered') {
        return false;
    }
    const orderDate = parseOrderDateForFilter(order?.order_date);
    if (!orderDate) {
        return false;
    }
    return (Date.now() - orderDate.getTime()) > (7 * 24 * 60 * 60 * 1000);
}

function getOrderFulfillmentRiskStats(orders = []) {
    const rows = Array.isArray(orders) ? orders : [];
    let shipDelay = 0;
    let signDelay = 0;
    rows.forEach(order => {
        if (isOrderShippingDelayRisk(order)) {
            shipDelay += 1;
        }
        if (isOrderSignDelayRisk(order)) {
            signDelay += 1;
        }
    });
    return {
        shipDelay,
        signDelay
    };
}

function filterOrdersBySearchAndStatus(orders) {
    const keyword = getOrderSearchKeyword();
    const statusFilter = getOrderStatusFilterValue();
    const paymentFilter = getOrderPaymentFilterValue();
    const shippingFilter = getOrderShippingFilterValue();
    const riskFilter = getOrderRiskFilterValue();
    const { start: orderDateStart, end: orderDateEnd } = getOrderDateRangeFilterBounds();
    const customers = Array.isArray(ERP.state?.customers) ? ERP.state.customers : [];

    return (Array.isArray(orders) ? orders : []).filter(order => {
        const orderNumber = String(order?.order_number || `订单#${order?.id || ''}`).toLowerCase();
        const customer = customers.find(item => isSameEntityId(item?.id, order?.customer_id));
        const customerName = String(customer?.name || order?.customer_name || '').toLowerCase();
        const normalizedStatus = normalizeOrderStatusValue(order?.status || 'pending');
        const paymentStatus = String(order?.payment_status || 'unpaid').trim().toLowerCase();
        const shippingStatus = normalizeShippingStatusValue(order?.shipping_status || 'not_shipped');
        const orderDate = parseOrderDateForFilter(order?.order_date);

        const matchKeyword = !keyword
            || orderNumber.includes(keyword)
            || customerName.includes(keyword);
        const matchStatus = statusFilter === 'all' || normalizedStatus === statusFilter;
        const matchPayment = paymentFilter === 'all' || paymentStatus === paymentFilter;
        const matchShipping = shippingFilter === 'all' || shippingStatus === shippingFilter;
        const matchDateStart = !orderDateStart || (orderDate && orderDate >= orderDateStart);
        const matchDateEnd = !orderDateEnd || (orderDate && orderDate <= orderDateEnd);
        const matchDate = matchDateStart && matchDateEnd;
        const matchRisk = riskFilter === 'all'
            || (riskFilter === 'ship_delay' && isOrderShippingDelayRisk(order))
            || (riskFilter === 'sign_delay' && isOrderSignDelayRisk(order));

        return matchKeyword && matchStatus && matchPayment && matchShipping && matchDate && matchRisk;
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

function getOrderFulfillmentStage(order) {
    const status = normalizeOrderStatusValue(order?.status || 'pending');
    const shippingStatus = normalizeShippingStatusValue(order?.shipping_status || 'not_shipped');

    if (['cancelled', 'refunded'].includes(status)) {
        return null;
    }
    if (status === 'completed') {
        return 'completed';
    }
    if (status === 'signed' || shippingStatus === 'delivered') {
        return 'transit';
    }
    if (status === 'shipped' || ['shipped', 'in_transit', 'returned', 'rejected'].includes(shippingStatus)) {
        return 'transit';
    }
    if (status === 'confirmed') {
        return 'confirmed';
    }
    return 'pending';
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
    const allRisk = getOrderFulfillmentRiskStats(allRows);
    const visibleRisk = getOrderFulfillmentRiskStats(visibleRows);

    const visibleTotal = Math.max(visibleRows.length, 1);
    const finishedCount = visibleStats.completed + visibleStats.refunded;
    const finishedRate = visibleRows.length > 0 ? Math.round((finishedCount / visibleTotal) * 100) : 0;
    const visibleFulfillmentCounters = { pending: 0, confirmed: 0, transit: 0, completed: 0 };
    const allFulfillmentCounters = { pending: 0, confirmed: 0, transit: 0, completed: 0 };
    visibleRows.forEach(order => {
        const stage = getOrderFulfillmentStage(order);
        if (stage && Object.prototype.hasOwnProperty.call(visibleFulfillmentCounters, stage)) {
            visibleFulfillmentCounters[stage] += 1;
        }
    });
    allRows.forEach(order => {
        const stage = getOrderFulfillmentStage(order);
        if (stage && Object.prototype.hasOwnProperty.call(allFulfillmentCounters, stage)) {
            allFulfillmentCounters[stage] += 1;
        }
    });
    const pendingAndWaitShip = visibleFulfillmentCounters.pending + visibleFulfillmentCounters.confirmed;
    const inTransitCount = visibleFulfillmentCounters.transit;

    summaryEl.innerHTML = `
        <div class="erp-order-summary-grid">
            <div class="erp-order-summary-item">
                <div class="erp-order-summary-label">筛选结果</div>
                <div class="erp-order-summary-value">${visibleRows.length}/${allRows.length}</div>
                <div class="erp-order-summary-sub">当前筛选 / 全部订单</div>
            </div>
            <div class="erp-order-summary-item">
                <div class="erp-order-summary-label">待处理</div>
                <div class="erp-order-summary-value">${pendingAndWaitShip}</div>
                <div class="erp-order-summary-sub">待审批 ${visibleFulfillmentCounters.pending}，待发货 ${visibleFulfillmentCounters.confirmed}</div>
            </div>
            <div class="erp-order-summary-item">
                <div class="erp-order-summary-label">在途订单</div>
                <div class="erp-order-summary-value">${inTransitCount}</div>
                <div class="erp-order-summary-sub">总在途 ${allFulfillmentCounters.transit}</div>
            </div>
            <div class="erp-order-summary-item">
                <div class="erp-order-summary-label">履约完成率</div>
                <div class="erp-order-summary-value">${finishedRate}%</div>
                <div class="erp-order-summary-sub">已完成 ${visibleStats.completed}，已退款 ${visibleStats.refunded}</div>
            </div>
            <div class="erp-order-summary-item">
                <div class="erp-order-summary-label">超48小时未发货</div>
                <div class="erp-order-summary-value is-danger">${visibleRisk.shipDelay}</div>
                <div class="erp-order-summary-sub">总计 ${allRisk.shipDelay}</div>
            </div>
            <div class="erp-order-summary-item">
                <div class="erp-order-summary-label">超7天未签收</div>
                <div class="erp-order-summary-value is-warning">${visibleRisk.signDelay}</div>
                <div class="erp-order-summary-sub">总计 ${allRisk.signDelay}</div>
            </div>
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
        const orderDate = toYmdText(order?.order_date || '');
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
    const paymentSelect = document.getElementById('orderPaymentFilter');
    const shippingSelect = document.getElementById('orderShippingFilter');
    const riskSelect = document.getElementById('orderRiskFilter');
    const rangeSelect = document.getElementById('orderDateRange');
    if (keywordInput) {
        keywordInput.value = '';
    }
    if (statusSelect) {
        statusSelect.value = 'all';
    }
    if (paymentSelect) {
        paymentSelect.value = 'all';
    }
    if (shippingSelect) {
        shippingSelect.value = 'all';
    }
    if (riskSelect) {
        riskSelect.value = 'all';
    }
    if (rangeSelect) {
        rangeSelect.value = 'all';
    }
    onOrderDateRangeChange();
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
    clearModalFieldValidation('inventoryModal');
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
    clearModalFieldValidation('inventoryModal');
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

    if (!productId) {
        markFieldInvalid('inventoryProduct', '请选择产品');
        return;
    }

    if (!quantityChange) {
        markFieldInvalid('inventoryQuantityChange', '请输入调整数量');
        return;
    }

    if (type === 'purchase' && unitCost < 0) {
        markFieldInvalid('inventoryUnitCost', '采购单价不能小于 0');
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
    cacheTableRenderRows('purchaseRecords', rows);
    const pageData = getPaginatedRows('purchaseRecords', rows);
    const visibleRows = pageData.rows;
    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:16px;color:#999;">暂无采购记录</td></tr>';
        renderTablePagination('purchaseRecords', 'purchaseRecordsPager', pageData);
        return;
    }

    const products = Array.isArray(ERP.state?.products) ? ERP.state.products : [];
    const productMap = new Map(products.map(item => [String(item?.id), item]));
    const canApprovePurchase = isCurrentUserPurchaseApprover();

    tbody.innerHTML = visibleRows.map(record => {
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
        const paymentPillClass = paymentStatus === 'paid'
            ? 'is-active'
            : (paymentStatus === 'unpaid' ? 'is-inactive' : 'is-system');
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
                : `<span class="erp-action-note">仅管理员可审批</span>`)
            : (canApprovePurchase
                ? `
                    <button class="ant-btn erp-btn-compact erp-btn-warning"
                        onclick='setPurchaseApprovalStatus(${JSON.stringify(record?.id)}, "pending")'>改待审</button>
                `
                : `<span class="erp-action-note">仅管理员可改审</span>`);
        const extraAction = `
            <button class="ant-btn erp-btn-compact erp-btn-purple"
                onclick='showPurchaseApprovalLog(${JSON.stringify(record?.id)})'>日志</button>
        `;

        return `
            <tr>
                <td data-table-cell="purchase:date" class="erp-cell-nowrap">${toDateTimeText(displayTime || '-')}</td>
                <td data-table-cell="purchase:order_no">${escapeHtmlText(purchaseOrderNo)}</td>
                <td data-table-cell="purchase:product">${escapeHtmlText(productName)}</td>
                <td data-table-cell="purchase:qty"><span class="erp-qty-text is-safe">${Number.isFinite(quantity) ? quantity : '-'}</span></td>
                <td data-table-cell="purchase:unit_cost"><span class="erp-amount-text is-expense">${formatCurrency(unitCost)}</span></td>
                <td data-table-cell="purchase:amount"><span class="erp-amount-text is-expense">${formatCurrency(amount)}</span></td>
                <td data-table-cell="purchase:supplier">${escapeHtmlText(supplier)}</td>
                <td data-table-cell="purchase:payment"><span class="erp-type-pill ${paymentPillClass}">${escapeHtmlText(paymentText)}</span></td>
                <td data-table-cell="purchase:approval">
                    <span class="erp-status-pill"
                        style="--erp-pill-color:${approvalColor};--erp-pill-bg:${approvalBg};--erp-pill-border:${approvalBorder};"
                        title="${escapeHtmlText(approvalTagTitle || '-')}"
                    >${escapeHtmlText(approvalText)}</span>
                </td>
                <td data-table-cell="purchase:notes" title="${escapeHtmlText(noteText)}"><span class="erp-cell-ellipsis">${escapeHtmlText(noteText)}</span></td>
                <td data-table-cell="purchase:actions" class="erp-action-cell"><div class="erp-row-actions">${approvalActions}${extraAction}</div></td>
            </tr>
        `;
    }).join('');
    renderTablePagination('purchaseRecords', 'purchaseRecordsPager', pageData);
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
const ERP_CREDIT_CARD_BANKS = [
    '中国工商银行', '中国农业银行', '中国银行', '中国建设银行', '交通银行', '中国邮政储蓄银行',
    '招商银行', '浦发银行', '中信银行', '中国民生银行', '兴业银行', '平安银行', '华夏银行',
    '广发银行', '光大银行', '浙商银行', '渤海银行', '恒丰银行',
    '北京银行', '上海银行', '江苏银行', '南京银行', '宁波银行', '杭州银行', '徽商银行',
    '广州银行', '东莞银行', '天津银行', '重庆银行', '成都银行', '长沙银行', '青岛银行',
    '郑州银行', '兰州银行', '西安银行', '厦门银行', '苏州银行', '齐鲁银行', '江西银行',
    '哈尔滨银行', '盛京银行', '吉林银行', '汉口银行', '中原银行', '渤海银行', '桂林银行',
    '农商银行信用卡', '其他银行'
];

const ERP_FINANCE_BUSINESS_PRESET = {
    life_expense: { type: 'expense', category: '生活消费' },
    salary_income: { type: 'income', category: '工资到账' }
};

function toValidDay(rawValue, fallback = 1) {
    const day = Math.floor(Number(rawValue));
    if (!Number.isFinite(day)) {
        return fallback;
    }
    return Math.min(31, Math.max(1, day));
}

function toAmount(value, fallback = 0) {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : fallback;
}

function formatFinanceDateText(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getCreditReminderDate(transactionDateText, repaymentDay, reminderDaysBefore = 0) {
    const baseDate = transactionDateText ? new Date(transactionDateText) : new Date();
    if (Number.isNaN(baseDate.getTime())) {
        return null;
    }

    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const repayment = toValidDay(repaymentDay, 1);
    const currentMonthLastDay = new Date(year, month + 1, 0).getDate();
    let dueDate = new Date(year, month, Math.min(repayment, currentMonthLastDay), 9, 0, 0);
    if (dueDate.getTime() < baseDate.getTime()) {
        const nextMonthLastDay = new Date(year, month + 2, 0).getDate();
        dueDate = new Date(year, month + 1, Math.min(repayment, nextMonthLastDay), 9, 0, 0);
    }

    const reminderDate = new Date(dueDate);
    reminderDate.setDate(dueDate.getDate() - Math.max(0, Math.floor(Number(reminderDaysBefore) || 0)));
    return Number.isNaN(reminderDate.getTime()) ? null : reminderDate;
}

const BANK_CARD_OPTION_PREFIX = '__CARD__';

function normalizeTail4(raw) {
    return String(raw || '').replace(/\D/g, '').slice(-4);
}

function buildBankCardOptionValue(bank, cardTail = '') {
    const bankName = String(bank || '').trim();
    const tail = normalizeTail4(cardTail);
    if (!bankName) {
        return '';
    }
    if (!tail) {
        return bankName;
    }
    return `${BANK_CARD_OPTION_PREFIX}${encodeURIComponent(bankName)}|${tail}`;
}

function parseBankCardOptionValue(rawValue) {
    const raw = String(rawValue || '').trim();
    if (!raw) {
        return { bank: '', cardTail: '' };
    }
    if (!raw.startsWith(BANK_CARD_OPTION_PREFIX)) {
        return { bank: raw, cardTail: '' };
    }
    const payload = raw.slice(BANK_CARD_OPTION_PREFIX.length);
    const splitIndex = payload.lastIndexOf('|');
    if (splitIndex < 0) {
        return { bank: decodeURIComponent(payload || ''), cardTail: '' };
    }
    const bank = decodeURIComponent(payload.slice(0, splitIndex) || '');
    const cardTail = normalizeTail4(payload.slice(splitIndex + 1));
    return { bank, cardTail };
}

function collectKnownBankCards() {
    const cardMap = new Map();
    const addCard = (bank, cardTail) => {
        const bankName = String(bank || '').trim();
        const tail = normalizeTail4(cardTail);
        if (!bankName || !tail) {
            return;
        }
        cardMap.set(`${bankName}#${tail}`, { bank: bankName, cardTail: tail });
    };

    const records = getBankBusinessRecords().map(parseBankBusinessRecord);
    records.forEach(item => {
        addCard(item?.bank, item?.cardTail);
        addCard(item?.swipeCardBank, item?.cardTail);
        addCard(item?.settlementBank, item?.settlementCardTail);
    });

    return Array.from(cardMap.values()).sort((left, right) => {
        const byBank = String(left.bank || '').localeCompare(String(right.bank || ''), 'zh-CN');
        if (byBank !== 0) return byBank;
        return String(left.cardTail || '').localeCompare(String(right.cardTail || ''), 'en');
    });
}

function populateCreditCardBanks(selectId, options = {}) {
    const bankSelect = document.getElementById(selectId);
    if (!bankSelect) {
        return;
    }
    const includeKnownCardTail = options.includeKnownCardTail !== false;
    const previousValue = String(bankSelect.value || '').trim();
    const knownCards = includeKnownCardTail ? collectKnownBankCards() : [];
    const knownCardOptionHtml = knownCards.map(item => {
        const value = buildBankCardOptionValue(item.bank, item.cardTail);
        const label = `${item.bank}（尾号${item.cardTail}）`;
        return `<option value="${escapeHtmlText(value)}">${escapeHtmlText(label)}</option>`;
    }).join('');
    const presetOptionHtml = ERP_CREDIT_CARD_BANKS.map(name => `<option value="${escapeHtmlText(name)}">${escapeHtmlText(name)}</option>`).join('');
    bankSelect.innerHTML = `<option value="">请选择银行</option>${knownCardOptionHtml}${presetOptionHtml}`;

    const hasExact = Array.from(bankSelect.options).some(opt => String(opt.value) === previousValue);
    if (hasExact) {
        bankSelect.value = previousValue;
        return;
    }

    const parsedPrev = parseBankCardOptionValue(previousValue);
    if (parsedPrev.bank) {
        const fallback = Array.from(bankSelect.options).find(opt => String(opt.value) === parsedPrev.bank);
        if (fallback) {
            bankSelect.value = fallback.value;
            return;
        }
    }
    bankSelect.value = '';
}

function syncTailInputByBankSelect(selectId, tailInputId) {
    const selectEl = document.getElementById(selectId);
    const tailInputEl = document.getElementById(tailInputId);
    if (!selectEl || !tailInputEl) return;

    const { bank, cardTail } = parseBankCardOptionValue(selectEl.value);
    if (!bank) {
        tailInputEl.value = '';
        return;
    }
    if (cardTail) {
        tailInputEl.value = cardTail;
    }
}

function setSelectValueWithFallback(selectId, preferredValue, fallbackValue = '') {
    const selectEl = document.getElementById(selectId);
    if (!selectEl) return;
    const preferred = String(preferredValue || '').trim();
    const fallback = String(fallbackValue || '').trim();
    selectEl.value = preferred;
    if (preferred && selectEl.value !== preferred) {
        selectEl.value = fallback;
    }
}

function normalizeFinanceDateTimeForDb(dateValue) {
    let transactionDate = String(dateValue || '').trim();
    if (!transactionDate) {
        const currentPartMap = getShanghaiDatePartMap(new Date());
        if (!currentPartMap) {
            transactionDate = new Date().toISOString();
        } else {
            return `${currentPartMap.year}-${currentPartMap.month}-${currentPartMap.day} ${currentPartMap.hour || '00'}:${currentPartMap.minute || '00'}:${currentPartMap.second || '00'}`;
        }
    }
    if (!transactionDate.includes('T')) {
        const plainDateTimeMatch = transactionDate.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})(?::(\d{2}))?$/);
        if (plainDateTimeMatch) {
            return `${plainDateTimeMatch[1]} ${plainDateTimeMatch[2]}:${plainDateTimeMatch[3] || '00'}`;
        }
        return transactionDate;
    }

    const plainLocalMatch = transactionDate.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/);
    if (plainLocalMatch) {
        return `${plainLocalMatch[1]} ${plainLocalMatch[2]}:${plainLocalMatch[3] || '00'}`;
    }

    const shanghaiPartMap = getShanghaiDatePartMap(transactionDate);
    if (!shanghaiPartMap) {
        return '';
    }
    return `${shanghaiPartMap.year}-${shanghaiPartMap.month}-${shanghaiPartMap.day} ${shanghaiPartMap.hour || '00'}:${shanghaiPartMap.minute || '00'}:${shanghaiPartMap.second || '00'}`;
}

function toMoneyText(value) {
    const amount = Number(value || 0);
    const safe = Number.isFinite(amount) ? amount : 0;
    return `¥${safe.toFixed(2)}`;
}

function isBankBusinessFinanceRecord(record) {
    const businessType = String(record?.business_type || '').trim().toLowerCase();
    const category = String(record?.category || '').trim();
    const description = String(record?.description || '').trim();
    if (['credit_card', 'credit_card_repayment', 'credit_card_swipe', 'credit_card_repayment_payment'].includes(businessType)) return true;
    if (category.includes('信用卡业务') || category.includes('信用卡还款') || category.includes('信用卡刷卡') || category.includes('银行手续费')) return true;
    return /银行[:：]/.test(description) && /刷卡[:：]/.test(description);
}

function getBankBusinessRecords(rows = null) {
    const sourceRows = Array.isArray(rows)
        ? rows
        : (Array.isArray(ERP.state?.finances) ? ERP.state.finances : []);
    return sourceRows.filter(isBankBusinessFinanceRecord);
}

function parseBankFeeAmountFromFinance(record) {
    const businessType = String(record?.business_type || '').trim().toLowerCase();
    const category = String(record?.category || '').trim();
    const description = String(record?.description || '');
    const isSwipeRecord = businessType === 'credit_card_swipe'
        || category.includes('信用卡刷卡')
        || /刷卡[:：]/.test(description);
    if (!isSwipeRecord) {
        return 0;
    }

    const directFee = Number(record?.card_fee_amount);
    if (Number.isFinite(directFee) && directFee > 0) {
        return directFee;
    }
    const match = description.match(/手续费[:：]\s*[¥￥]?\s*([0-9]+(?:\.[0-9]+)?)/);
    if (!match || !match[1]) {
        return 0;
    }
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function createBankFeeMirrorRows(rows = []) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const bankRows = sourceRows.filter(isBankBusinessFinanceRecord);
    if (!bankRows.length) {
        return [];
    }

    return bankRows
        .map((record, index) => {
            const feeAmount = parseBankFeeAmountFromFinance(record);
            if (!(feeAmount > 0)) {
                return null;
            }

            const sourceId = String(record?.id ?? `${index}`);
            const description = String(record?.description || '');
            const bankMatch = description.match(/(?:银行|还款卡|刷卡卡)[:：]\s*([^；\n]+)/);
            const bankName = bankMatch?.[1] ? String(bankMatch[1]).trim() : '信用卡业务';
            const sourceDateObj = parseBankTransactionDate(record, description);
            const sourceDatePartMap = getShanghaiDatePartMap(sourceDateObj || record?.transaction_date || record?.created_at || null);
            const sourceDate = sourceDatePartMap
                ? `${sourceDatePartMap.year}-${sourceDatePartMap.month}-${sourceDatePartMap.day} ${sourceDatePartMap.hour || '00'}:${sourceDatePartMap.minute || '00'}:${sourceDatePartMap.second || '00'}`
                : (record?.transaction_date || record?.created_at || new Date().toISOString());

            return {
                id: `bank-fee::${sourceId}`,
                type: 'expense',
                category: '银行手续费',
                amount: feeAmount,
                description: `银行手续费（来源：${bankName}）`,
                transaction_date: sourceDate,
                reference_id: null,
                order_id: null,
                __virtual_bank_fee: true,
                __source_finance_id: record?.id ?? null
            };
        })
        .filter(Boolean);
}

function getGeneralFinanceRecords(rows = null) {
    const sourceRows = Array.isArray(rows)
        ? rows
        : (Array.isArray(ERP.state?.finances) ? ERP.state.finances : []);
    const existingVirtualFeeRows = sourceRows.filter(item => item?.__virtual_bank_fee === true);
    const materialRows = sourceRows.filter(item => item?.__virtual_bank_fee !== true);
    const generalRows = materialRows.filter(item => !isBankBusinessFinanceRecord(item));
    const derivedFeeRows = createBankFeeMirrorRows(materialRows);

    if (derivedFeeRows.length > 0) {
        return [...generalRows, ...derivedFeeRows];
    }
    if (existingVirtualFeeRows.length > 0) {
        return [...generalRows, ...existingVirtualFeeRows];
    }
    return generalRows;
}

if (typeof window !== 'undefined') {
    window.isBankBusinessFinanceRecord = isBankBusinessFinanceRecord;
    window.getBankBusinessRecords = getBankBusinessRecords;
    window.getGeneralFinanceRecords = getGeneralFinanceRecords;
}

function parseBankBusinessAmount(record, fieldName, regex) {
    const value = Number(record?.[fieldName]);
    if (Number.isFinite(value)) {
        return value;
    }
    const description = String(record?.description || '');
    const match = description.match(regex);
    if (!match) {
        return NaN;
    }
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : NaN;
}

function parseBankCreditLimit(record, description = '') {
    const directValue = Number(record?.card_credit_limit);
    if (Number.isFinite(directValue) && directValue > 0) {
        return directValue;
    }
    const source = String(description || '');
    const patterns = [
        /(?:信用额度|授信额度|总额度|Total\s*Credit\s*Limit|Credit\s*Limit)[:：]?\s*[¥￥]?\s*(?:CNY|RMB)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
        /(?:Daily\s*Credit\s*Limit)[:：]?\s*[¥￥]?\s*(?:CNY|RMB)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i
    ];
    for (const pattern of patterns) {
        const match = source.match(pattern);
        if (!match || !match[1]) continue;
        const value = Number(String(match[1]).replace(/,/g, ''));
        if (Number.isFinite(value) && value > 0) {
            return value;
        }
    }
    return NaN;
}

function parseBankTransactionDate(record, description = '') {
    const rawValue = record?.transaction_date || record?.created_at || null;
    const descText = String(description || '');
    const rawText = String(rawValue || '').trim();
    const isManualRepayment = descText.includes('来源：手动登记还款')
        || String(record?.business_type || '').trim().toLowerCase() === 'credit_card_repayment_payment';

    if (isManualRepayment) {
        const createdAtDate = parseFinanceDate(record?.created_at || null);
        if (createdAtDate instanceof Date && !Number.isNaN(createdAtDate.getTime())) {
            return createdAtDate;
        }
    }

    if (rawText) {
        const dateTimeHead = rawText.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
        const hasExplicitTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(rawText);
        if (dateTimeHead && hasExplicitTimezone) {
            const normalizedLocalText = `${dateTimeHead[1]} ${dateTimeHead[2]}`;
            const localDate = parseFinanceDate(normalizedLocalText);
            if (localDate instanceof Date && !Number.isNaN(localDate.getTime())) {
                return localDate;
            }
        }
    }

    return parseFinanceDate(rawValue || new Date());
}

function parseBankBusinessRecord(record) {
    const description = String(record?.description || '');
    const businessType = String(record?.business_type || '').trim().toLowerCase();
    const category = String(record?.category || '').trim();
    const isRepaymentPayment = businessType === 'credit_card_repayment_payment' || category.includes('还款记录');
    const isRepayment = !isRepaymentPayment && (businessType === 'credit_card_repayment' || category.includes('信用卡还款'));
    const isFeeOnly = businessType === 'credit_card_fee' || category.includes('银行手续费');
    const isSwipe = isFeeOnly || businessType === 'credit_card_swipe' || category.includes('信用卡刷卡');
    const bankMatch = description.match(/银行[:：]\s*([^；\n]+)/);
    const swipeBankMatch = description.match(/刷卡卡[:：]\s*([^；\n]+)/);
    const settlementBankMatch = description.match(/到账卡[:：]\s*([^（；\n]+)/);
    const settlementTailMatch = description.match(/尾号\s*(\d{3,4})/);
    const cardTailByBankLine = description.match(/(?:银行|还款卡|刷卡卡)[:：][^；\n]*?尾号\s*(\d{3,4})/);
    const cardTailByCardNo = description.match(/Card\s*No\.?\s*(\d{4})/i);
    const billMatch = description.match(/账单日[:：](?:每月)?\s*(\d{1,2})日?/);
    const repaymentMatch = description.match(/还款日[:：](?:每月)?\s*(\d{1,2})日?/);
    const reminderDayMatch = description.match(/提前\s*(\d+)\s*天/);
    const reminderDateMatch = description.match(/(?:提醒[^0-9]{0,10}|提醒日[:：]\s*)(\d{4}-\d{2}-\d{2})/);
    const feeRateMatch = description.match(/费率[:：]\s*([0-9]+(?:\.[0-9]+)?)%/);
    const creditLimit = parseBankCreditLimit(record, description);

    const repaymentAmountRaw = parseBankBusinessAmount(record, 'card_repayment_amount', /应还[:：]\s*[¥￥]?\s*([0-9]+(?:\.[0-9]+)?)/);
    const swipeAmountRaw = parseBankBusinessAmount(record, 'card_swipe_amount', /刷卡[:：]\s*[¥￥]?\s*([0-9]+(?:\.[0-9]+)?)/);
    const actualAmountRaw = parseBankBusinessAmount(record, 'card_actual_amount', /到账[:：]\s*[¥￥]?\s*([0-9]+(?:\.[0-9]+)?)/);
    const feeAmountRaw = parseBankBusinessAmount(record, 'card_fee_amount', /手续费[:：]\s*[¥￥]?\s*([0-9]+(?:\.[0-9]+)?)/);
    const swipeAmount = isFeeOnly ? 0 : swipeAmountRaw;
    const repaymentAmount = Number.isFinite(repaymentAmountRaw)
        ? repaymentAmountRaw
        : ((isRepayment || isRepaymentPayment) ? Math.abs(Number(record?.amount || 0)) : 0);
    const actualAmount = Number.isFinite(actualAmountRaw)
        ? actualAmountRaw
        : ((isSwipe && !isFeeOnly) ? Math.abs(Number(record?.amount || 0)) : 0);
    const feeAmount = Number.isFinite(feeAmountRaw)
        ? feeAmountRaw
        : (isFeeOnly
            ? Math.abs(Number(record?.amount || 0))
            : (Number.isFinite(swipeAmount) && Number.isFinite(actualAmount) ? Math.max(0, swipeAmount - actualAmount) : 0));
    const feeRateRaw = Number(record?.card_fee_rate);
    const feeRate = Number.isFinite(feeRateRaw)
        ? feeRateRaw
        : (feeRateMatch ? Number(feeRateMatch[1]) : (Number.isFinite(swipeAmount) && swipeAmount > 0 ? (feeAmount / swipeAmount) * 100 : 0));

    let reminderEnabled = record?.reminder_enabled;
    if (typeof reminderEnabled !== 'boolean') {
        reminderEnabled = !/提醒[:：]\s*关闭/.test(description);
    }
    if (!isRepayment) {
        reminderEnabled = false;
    }

    const reminderDaysBeforeRaw = Math.max(0, Math.floor(toAmount(record?.reminder_days_before || reminderDayMatch?.[1], 0)));
    const reminderDaysBefore = isRepayment
        ? (reminderDaysBeforeRaw || (reminderEnabled ? 3 : 0))
        : 0;
    const reminderDateRaw = parseFinanceDate(record?.reminder_date || reminderDateMatch?.[1] || null);
    const reminderDate = isRepayment
        ? (reminderDateRaw || (reminderEnabled
            ? getCreditReminderDate(record?.transaction_date || record?.created_at || new Date(), toValidDay(record?.card_repayment_day || repaymentMatch?.[1], 0), reminderDaysBefore)
            : null))
        : null;
    const cleanedDescription = description
        .split(/[；;]+/)
        .map(part => String(part || '').trim())
        .filter(Boolean)
        .filter(part => !/^(银行|刷卡卡|到账卡|应还|刷卡|到账|手续费|费率|账单日|还款日|提醒|建议|信用额度|授信额度|剩余额度|可用额度)[:：]/.test(part))
        .join('；')
        .trim();

    const parsedBank = String(record?.card_bank || record?.swipe_card_bank || bankMatch?.[1] || swipeBankMatch?.[1] || '未识别银行').trim();
    const parsedSwipeCardBank = String(record?.swipe_card_bank || swipeBankMatch?.[1] || '').trim();
    const parsedSettlementBank = String(record?.settlement_bank || settlementBankMatch?.[1] || '').trim();
    const parsedSettlementTail = String(record?.settlement_card_tail || settlementTailMatch?.[1] || '').trim();
    const parsedCardTail = String(record?.card_tail || cardTailByBankLine?.[1] || cardTailByCardNo?.[1] || '').trim();
    const availableLimit = Number.isFinite(creditLimit) && creditLimit > 0
        ? Number((creditLimit - repaymentAmount).toFixed(2))
        : NaN;

    const fallbackBillDayFromDate = (() => {
        if (!isRepayment) return 0;
        const sourceDate = parseFinanceDate(record?.transaction_date || record?.created_at || null);
        if (!(sourceDate instanceof Date) || Number.isNaN(sourceDate.getTime())) return 0;
        return toValidDay(sourceDate.getDate(), 0);
    })();

    return {
        id: record?.id,
        bank: parsedBank,
        billDay: toValidDay(record?.card_bill_day || billMatch?.[1] || fallbackBillDayFromDate, 0),
        repaymentDay: toValidDay(record?.card_repayment_day || repaymentMatch?.[1], 0),
        reminderEnabled,
        reminderDaysBefore,
        reminderDate,
        businessType,
        repaymentAmount: Number.isFinite(repaymentAmount) ? repaymentAmount : 0,
        creditLimit: Number.isFinite(creditLimit) ? Number(creditLimit.toFixed(2)) : NaN,
        availableLimit: Number.isFinite(availableLimit) ? availableLimit : NaN,
        cardTail: parsedCardTail,
        swipeCardBank: isSwipe ? (parsedSwipeCardBank || parsedBank || '未识别') : '',
        settlementBank: isSwipe ? (parsedSettlementBank || '未识别') : '',
        settlementCardTail: isSwipe ? parsedSettlementTail : '',
        swipeAmount: (isSwipe && !isFeeOnly) ? (Number.isFinite(swipeAmount) ? swipeAmount : 0) : 0,
        actualAmount: (isSwipe && !isFeeOnly) ? (Number.isFinite(actualAmount) ? actualAmount : Math.abs(Number(record?.amount || 0))) : 0,
        feeAmount: isSwipe ? (Number.isFinite(feeAmount) ? feeAmount : 0) : 0,
        feeRate: isSwipe ? (Number.isFinite(feeRate) ? feeRate : 0) : 0,
        isRepayment,
        isRepaymentPayment,
        isSwipe,
        isFeeOnly,
        transactionDate: parseBankTransactionDate(record, description),
        description: cleanedDescription || '-',
        raw: record
    };
}

function getBankBusinessCycleMonthKey(record) {
    const partMap = getShanghaiDatePartMap(
        record?.transactionDate
        || record?.raw?.transaction_date
        || record?.raw?.created_at
        || null
    );
    if (!partMap?.year || !partMap?.month) {
        return '';
    }
    return `${partMap.year}-${partMap.month}`;
}

function buildBankBusinessDisplayDedupKey(record) {
    if (!record?.isRepayment || record?.isRepaymentPayment) {
        return '';
    }
    const bank = String(record?.bank || '').trim().toLowerCase();
    const tail = normalizeTail4(record?.cardTail || '') || 'no_tail';
    const billDay = toValidDay(record?.billDay, 0) || 0;
    const repaymentDay = toValidDay(record?.repaymentDay, 0) || 0;
    const cycleMonth = getBankBusinessCycleMonthKey(record) || 'unknown_month';
    return `repayment|${bank || 'unknown_bank'}|${tail}|${billDay}|${repaymentDay}|${cycleMonth}`;
}

function getBankBusinessFreshTimestamp(record, fieldName) {
    const raw = record?.raw?.[fieldName] ?? null;
    const date = parseFinanceDate(raw);
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return 0;
    }
    return date.getTime();
}

function shouldReplaceBankBusinessDisplayRow(candidate, current) {
    const candidateUpdated = getBankBusinessFreshTimestamp(candidate, 'updated_at');
    const currentUpdated = getBankBusinessFreshTimestamp(current, 'updated_at');
    if (candidateUpdated !== currentUpdated) {
        return candidateUpdated > currentUpdated;
    }

    const candidateTx = candidate?.transactionDate instanceof Date ? candidate.transactionDate.getTime() : 0;
    const currentTx = current?.transactionDate instanceof Date ? current.transactionDate.getTime() : 0;
    if (candidateTx !== currentTx) {
        return candidateTx > currentTx;
    }

    const candidateCreated = getBankBusinessFreshTimestamp(candidate, 'created_at');
    const currentCreated = getBankBusinessFreshTimestamp(current, 'created_at');
    if (candidateCreated !== currentCreated) {
        return candidateCreated > currentCreated;
    }

    const candidateId = String(candidate?.id || '');
    const currentId = String(current?.id || '');
    return candidateId > currentId;
}

function dedupeBankBusinessRowsForDisplay(rows = []) {
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
        return [];
    }

    const keepMap = new Map();
    const passthrough = [];

    list.forEach((row) => {
        const key = buildBankBusinessDisplayDedupKey(row);
        if (!key) {
            passthrough.push(row);
            return;
        }
        const current = keepMap.get(key);
        if (!current || shouldReplaceBankBusinessDisplayRow(row, current)) {
            keepMap.set(key, row);
        }
    });

    return [...passthrough, ...Array.from(keepMap.values())];
}

function getBankReminderStatus(record) {
    if (!record?.isRepayment || record?.isRepaymentPayment) {
        return { text: '-', className: 'is-off', isDue: false };
    }
    const repaymentAmount = Number(record?.repaymentAmount);
    const descriptionText = String(record?.description || '').trim();
    const settledByDescription = /(状态[:：]\s*已结清|已还清|账单已结清|当月已还清)/.test(descriptionText);
    const settledByAmount = Number.isFinite(repaymentAmount) && repaymentAmount <= 0;
    if (settledByDescription || settledByAmount) {
        return { text: '当月已还清', className: 'is-on', isDue: false };
    }
    if (!record.reminderEnabled) {
        return { text: '已关闭', className: 'is-off', isDue: false };
    }
    const effectiveReminderDate = getEffectiveBankReminderDate(record);
    if (!effectiveReminderDate) {
        return { text: `已开启（提前${record.reminderDaysBefore}天）`, className: 'is-on', isDue: false };
    }
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    if (effectiveReminderDate.getTime() <= todayEnd.getTime()) {
        return { text: `待处理：${formatFinanceDateText(effectiveReminderDate)}`, className: 'is-due', isDue: true };
    }
    return { text: `提醒日：${formatFinanceDateText(effectiveReminderDate)}`, className: 'is-on', isDue: false };
}

function formatBankBillRepaymentText(record) {
    if (!record?.isRepayment || record?.isRepaymentPayment) {
        return '-';
    }
    const baseDate = record?.transactionDate instanceof Date && !Number.isNaN(record.transactionDate.getTime())
        ? record.transactionDate
        : new Date();
    const billDay = toValidDay(record?.billDay, 0);
    const repaymentDay = toValidDay(record?.repaymentDay, 0);
    const dueDate = getBankRepaymentDueDate(record);
    if (!repaymentDay || !(dueDate instanceof Date) || Number.isNaN(dueDate.getTime())) {
        const billText = billDay ? `${baseDate.getMonth() + 1}月${billDay}日` : '-';
        return `${billText} / -`;
    }

    const dueYear = dueDate.getFullYear();
    const dueMonth = dueDate.getMonth();
    let billYear = baseDate.getFullYear();
    let billMonth = baseDate.getMonth();
    if (billDay) {
        if (repaymentDay < billDay) {
            const billDate = new Date(dueYear, dueMonth - 1, 1);
            billYear = billDate.getFullYear();
            billMonth = billDate.getMonth();
        } else {
            billYear = dueYear;
            billMonth = dueMonth;
        }
    }
    const billTextBase = billDay ? `${billMonth + 1}月${billDay}日` : '-';
    const billText = billDay && billYear !== dueYear ? `${billYear}年${billTextBase}` : billTextBase;
    const repaymentTextBase = `${dueMonth + 1}月${repaymentDay}日`;
    const repaymentText = dueYear === billYear ? repaymentTextBase : `${dueYear}年${repaymentTextBase}`;
    return `${billText} / ${repaymentText}`;
}

function getBankRepaymentDueDateByCycle(record) {
    const baseDate = record?.transactionDate instanceof Date && !Number.isNaN(record.transactionDate.getTime())
        ? record.transactionDate
        : new Date();
    const billDay = toValidDay(record?.billDay, 0);
    const repaymentDay = toValidDay(record?.repaymentDay, 0);
    if (!billDay || !repaymentDay) {
        return null;
    }
    const recommendation = buildBankCycleRecommendation(baseDate, billDay, repaymentDay);
    const dueDate = recommendation?.dueDate;
    if (!(dueDate instanceof Date) || Number.isNaN(dueDate.getTime())) {
        return null;
    }
    return dueDate;
}

function getBankRepaymentDueDate(record) {
    const baseDate = record?.transactionDate instanceof Date && !Number.isNaN(record.transactionDate.getTime())
        ? record.transactionDate
        : new Date();
    const dueDateByCycle = getBankRepaymentDueDateByCycle(record);
    const repaymentDay = toValidDay(record?.repaymentDay, 0);
    if (!repaymentDay && !dueDateByCycle) {
        return null;
    }

    const reminderDate = record?.reminderDate instanceof Date && !Number.isNaN(record.reminderDate.getTime())
        ? record.reminderDate
        : null;
    const reminderDaysBefore = Math.max(0, Number(record?.reminderDaysBefore || 0));
    let dueDateByReminder = null;
    if (reminderDate) {
        const dueByReminder = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate(), 23, 59, 59, 999);
        dueByReminder.setDate(dueByReminder.getDate() + reminderDaysBefore);
        if (repaymentDay) {
            const lastDay = new Date(dueByReminder.getFullYear(), dueByReminder.getMonth() + 1, 0).getDate();
            dueByReminder.setDate(Math.min(repaymentDay, lastDay));
        }
        dueDateByReminder = Number.isNaN(dueByReminder.getTime()) ? null : dueByReminder;
    }

    const candidates = [dueDateByCycle, dueDateByReminder]
        .filter(date => date instanceof Date && !Number.isNaN(date.getTime()));
    if (!candidates.length) {
        return null;
    }

    if (candidates.length === 1) {
        return candidates[0];
    }

    const toScore = (date) => {
        const diffDays = (date.getTime() - baseDate.getTime()) / 86400000;
        let score = Math.abs(diffDays);
        if (diffDays < -2) score += 500;
        if (diffDays > 65) score += 120;
        return score;
    };
    return candidates.sort((left, right) => toScore(left) - toScore(right))[0];
}

function getEffectiveBankReminderDate(record) {
    if (!record?.reminderEnabled) {
        return null;
    }
    const rawReminder = record?.reminderDate instanceof Date && !Number.isNaN(record.reminderDate.getTime())
        ? record.reminderDate
        : null;
    const reminderDaysBefore = Math.max(0, Number(record?.reminderDaysBefore || 0));
    const dueDate = getBankRepaymentDueDate(record);
    if (!(dueDate instanceof Date) || Number.isNaN(dueDate.getTime())) {
        return rawReminder;
    }
    const expectedReminder = new Date(dueDate);
    expectedReminder.setDate(expectedReminder.getDate() - reminderDaysBefore);
    if (!rawReminder) {
        return expectedReminder;
    }
    const diffDays = Math.abs(rawReminder.getTime() - expectedReminder.getTime()) / 86400000;
    if (diffDays > 10) {
        return expectedReminder;
    }
    return rawReminder;
}

function getBankRepaymentDueDateForSort(record) {
    const dueDate = getBankRepaymentDueDate(record);
    if (!(dueDate instanceof Date) || Number.isNaN(dueDate.getTime())) {
        return Number.POSITIVE_INFINITY;
    }
    return dueDate.getTime();
}

function syncBankBusinessRows(rows = [], source = 'all') {
    bankBusinessViewState.currentRows = Array.isArray(rows) ? [...rows] : [];
    bankBusinessViewState.source = source;
}

function updateBankBusinessSummary(rows = [], rawRows = []) {
    const list = Array.isArray(rows) ? rows : [];
    const source = Array.isArray(rawRows) ? rawRows : [];

    const repaymentRemaining = list.reduce((sum, row) => sum + (row?.isRepayment ? Number(row?.repaymentAmount || 0) : 0), 0);
    const repaidAmount = source.reduce((sum, row) => {
        if (!row?.isRepaymentPayment) return sum;
        const value = Number(row?.repaymentAmount || row?.raw?.amount || 0);
        return sum + Math.max(0, value);
    }, 0);
    const repaymentTotal = repaymentRemaining + repaidAmount;

    const totalSwipe = list.reduce((sum, row) => sum + (row?.isSwipe ? Number(row?.swipeAmount || 0) : 0), 0);
    const totalActual = list.reduce((sum, row) => sum + (row?.isSwipe ? Number(row?.actualAmount || 0) : 0), 0);
    const totalFee = list.reduce((sum, row) => sum + (row?.isSwipe ? Number(row?.feeAmount || 0) : 0), 0);

    let dueCount = list.filter(row => getBankReminderStatus(row).isDue).length;
    if (typeof window !== 'undefined' && typeof window.getBankRepaymentReminderNotices === 'function') {
        const notices = window.getBankRepaymentReminderNotices(new Date());
        if (Array.isArray(notices)) {
            dueCount = notices.length;
        }
    }

    const repaymentTotalEl = document.getElementById('bankingSummaryRepaymentTotal');
    const repaidEl = document.getElementById('bankingSummaryRepaid');
    const repaymentRemainingEl = document.getElementById('bankingSummaryRepaymentRemaining');
    const swipeEl = document.getElementById('bankingSummarySwipe');
    const actualEl = document.getElementById('bankingSummaryActual');
    const feeEl = document.getElementById('bankingSummaryFee');
    const dueHintEl = document.getElementById('bankingSummaryDueHint');

    if (repaymentTotalEl) repaymentTotalEl.textContent = toMoneyText(repaymentTotal);
    if (repaidEl) repaidEl.textContent = toMoneyText(repaidAmount);
    if (repaymentRemainingEl) repaymentRemainingEl.textContent = toMoneyText(repaymentRemaining);
    if (swipeEl) swipeEl.textContent = toMoneyText(totalSwipe);
    if (actualEl) actualEl.textContent = toMoneyText(totalActual);
    if (feeEl) feeEl.textContent = toMoneyText(totalFee);
    if (dueHintEl) {
        dueHintEl.textContent = `3天内到期提醒：${dueCount} 条`;
        dueHintEl.style.color = dueCount > 0 ? '#cf1322' : '#64748b';
    }
}

function syncBankBusinessTableHeightByPageSize(pageSize = 10, wrapperId = 'bankingTableWrapper') {
    const wrapper = document.getElementById(wrapperId);
    if (!wrapper) {
        return;
    }
    const size = Number(pageSize) || 10;
    wrapper.classList.toggle('erp-table-scroll-expanded', size > 10);

    wrapper.style.maxHeight = 'none';
    wrapper.style.overflowY = 'visible';
    wrapper.style.overflowX = 'auto';
}

function buildBankBusinessRowHtml(item, section = 'repayment') {
    const itemIdText = String(item?.id ?? '').replace(/"/g, '&quot;');
    const reminderMeta = getBankReminderStatus(item);
    const dateText = toDateTimeText(item?.transactionDate || item?.raw?.transaction_date || '-');
    const billRepaymentText = formatBankBillRepaymentText(item);
    const reminderClass = `erp-bank-reminder ${reminderMeta.className}`;
    const settlementText = (item.isSwipe && !item.isFeeOnly)
        ? (item.settlementBank === '未识别'
            ? '未识别'
            : `${item.settlementBank}${item.settlementCardTail ? `（尾号${item.settlementCardTail}）` : ''}`)
        : '-';
    const repaymentAmountText = item.isRepayment ? toMoneyText(item.repaymentAmount) : '-';
    const swipeAmountText = (item.isSwipe && !item.isFeeOnly) ? toMoneyText(item.swipeAmount) : '-';
    const actualAmountText = (item.isSwipe && !item.isFeeOnly) ? toMoneyText(item.actualAmount) : '-';
    const feeAmountText = item.isSwipe ? toMoneyText(item.feeAmount) : '-';
    const feeRateText = (item.isSwipe && Number(item.feeRate || 0) > 0) ? `${Number(item.feeRate || 0).toFixed(2)}%` : '-';
    const bankMainText = `${safeText(item.bank || '-')}${item.cardTail ? `（尾号${safeText(item.cardTail)}）` : ''}`;
    const remarksText = safeText(item.description);
    const actionCellHtml = `
        <td class="erp-action-cell">
            <div class="erp-row-actions">
                ${section === 'repayment' && item.isRepayment ? `<button class="ant-btn erp-btn-compact" onclick='quickCreateBankRepayment(${JSON.stringify(item.id)})'>还款</button>` : ''}
                ${section === 'repayment' ? `<button class="ant-btn erp-btn-compact" onclick='showBankRepaymentHistory(${JSON.stringify(item.id)})'>还款记录</button>` : ''}
                <button class="ant-btn erp-btn-compact" onclick='editBankBusiness(${JSON.stringify(item.id)})'>修改</button>
                <button class="ant-btn erp-btn-danger erp-btn-compact" onclick='deleteBankBusiness(${JSON.stringify(item.id)})'>删除</button>
            </div>
        </td>
    `;

    if (section === 'swipe') {
        return `
            <tr>
                <td class="banking-col-select">
                    <input class="erp-banking-row-checkbox" type="checkbox" data-id="${itemIdText}" data-section="${safeText(section)}"
                        ${isBankBusinessRowSelected(item?.id) ? 'checked' : ''}
                        onchange="onBankBusinessRowCheckedChange(this.getAttribute('data-id'), this.checked)">
                </td>
                <td class="erp-cell-nowrap">${safeText(dateText)}</td>
                <td>
                    <div class="erp-finance-cell-main">${bankMainText}</div>
                </td>
                <td>${safeText(settlementText)}</td>
                <td><span class="erp-amount-text">${safeText(swipeAmountText)}</span></td>
                <td><span class="erp-amount-text is-income">${safeText(actualAmountText)}</span></td>
                <td>
                    <div class="erp-finance-cell-main"><span class="erp-amount-text is-expense">${safeText(feeAmountText)}</span></div>
                    <div class="erp-finance-cell-sub">费率：${safeText(feeRateText)}</div>
                </td>
                <td title="${remarksText}"><span class="erp-cell-ellipsis">${remarksText}</span></td>
                ${actionCellHtml}
            </tr>
        `;
    }

    return `
        <tr>
            <td class="banking-col-select">
                <input class="erp-banking-row-checkbox" type="checkbox" data-id="${itemIdText}" data-section="${safeText(section)}"
                    ${isBankBusinessRowSelected(item?.id) ? 'checked' : ''}
                    onchange="onBankBusinessRowCheckedChange(this.getAttribute('data-id'), this.checked)">
            </td>
            <td class="erp-cell-nowrap">${safeText(dateText)}</td>
            <td>
                <div class="erp-finance-cell-main">${bankMainText}</div>
            </td>
            <td><span class="erp-amount-text is-expense">${safeText(repaymentAmountText)}</span></td>
            <td>${safeText(billRepaymentText)}</td>
            <td><span class="${reminderClass}">${safeText(reminderMeta.text)}</span></td>
            <td title="${remarksText}"><span class="erp-cell-ellipsis">${remarksText}</span></td>
            ${actionCellHtml}
        </tr>
    `;
}

function renderBankBusinessSection(options = {}) {
    const {
        section = 'repayment',
        moduleKey = 'banking',
        wrapperId = '',
        tbodyId = '',
        pagerId = '',
        emptyText = '暂无数据',
        rows = []
    } = options;
    const tbody = document.getElementById(tbodyId);
    if (!tbody) {
        return;
    }

    const paginationState = ensureTablePaginationModuleState(moduleKey);
    syncBankBusinessTableHeightByPageSize(paginationState.pageSize, wrapperId);

    const sourceRows = Array.isArray(rows) ? rows : [];
    if (!sourceRows.length) {
        const emptyColspan = section === 'swipe' ? 9 : 8;
        tbody.innerHTML = `<tr><td colspan="${emptyColspan}" style="text-align:center; padding:20px; color:#999;">${emptyText}</td></tr>`;
        syncBankBusinessSelectionVisibleRows([], section);
        if (typeof cacheTableRenderRows === 'function') {
            cacheTableRenderRows(moduleKey, []);
        }
        if (typeof renderTablePagination === 'function') {
            renderTablePagination(moduleKey, pagerId, { total: 0 });
        }
        return;
    }

    if (typeof cacheTableRenderRows === 'function') {
        cacheTableRenderRows(moduleKey, sourceRows);
    }
    const pageData = (typeof getPaginatedRows === 'function')
        ? getPaginatedRows(moduleKey, sourceRows)
        : { rows: sourceRows };
    syncBankBusinessTableHeightByPageSize(pageData?.pageSize || paginationState.pageSize, wrapperId);
    const visibleRows = Array.isArray(pageData.rows) ? pageData.rows : sourceRows;
    syncBankBusinessSelectionVisibleRows(visibleRows, section);

    tbody.innerHTML = visibleRows.map(item => buildBankBusinessRowHtml(item, section)).join('');

    if (typeof renderTablePagination === 'function') {
        renderTablePagination(moduleKey, pagerId, pageData);
    }
}

function renderBankBusiness(rows = null) {
    const sourceAll = Array.isArray(rows)
        ? rows
        : (Array.isArray(bankBusinessViewState.currentRows) && bankBusinessViewState.currentRows.length
            ? bankBusinessViewState.currentRows
            : getBankBusinessRecords().map(parseBankBusinessRecord));
    const source = dedupeBankBusinessRowsForDisplay(
        sourceAll.filter(item => !item?.isRepaymentPayment)
    );

    const sorted = [...source].sort((a, b) => {
        const leftDueTs = getBankRepaymentDueDateForSort(a);
        const rightDueTs = getBankRepaymentDueDateForSort(b);
        if (leftDueTs !== rightDueTs) {
            return leftDueTs - rightDueTs;
        }
        const leftBank = String(a?.bank || '').trim();
        const rightBank = String(b?.bank || '').trim();
        const bankCompare = leftBank.localeCompare(rightBank, 'zh-CN');
        if (bankCompare !== 0) {
            return bankCompare;
        }
        const left = a?.transactionDate instanceof Date ? a.transactionDate.getTime() : 0;
        const right = b?.transactionDate instanceof Date ? b.transactionDate.getTime() : 0;
        return right - left;
    });

    updateBankBusinessSummary(sorted, sourceAll);

    const repaymentRows = sorted.filter(item => item?.isRepayment && !item?.isRepaymentPayment);
    const swipeRows = sorted.filter(item => item?.isSwipe && !item?.isRepaymentPayment);

    syncBankBusinessSelectionVisibleRows([], 'repayment');
    syncBankBusinessSelectionVisibleRows([], 'swipe');

    renderBankBusinessSection({
        section: 'repayment',
        moduleKey: 'bankingRepayment',
        wrapperId: 'bankingRepaymentTableWrapper',
        tbodyId: 'bankingRepaymentTableBody',
        pagerId: 'bankingRepaymentPager',
        emptyText: '暂无信用卡还款流水',
        rows: repaymentRows
    });

    renderBankBusinessSection({
        section: 'swipe',
        moduleKey: 'bankingSwipe',
        wrapperId: 'bankingSwipeTableWrapper',
        tbodyId: 'bankingSwipeTableBody',
        pagerId: 'bankingSwipePager',
        emptyText: '暂无刷卡流水',
        rows: swipeRows
    });

    pruneBankBusinessSelectionByAllRows();
    const activeTab = bankBusinessViewState.activeTab === 'swipe' ? 'swipe' : 'repayment';
    applyBankBusinessTabUI(activeTab);
    renderBankBusinessHeaderCheckboxState(activeTab);
    updateBankBusinessBatchActionState();
}

function applyBankBusinessFilters() {
    const bankKeyword = String(document.getElementById('bankingSearchBank')?.value || '').trim().toLowerCase();
    const reminderFilter = String(document.getElementById('bankingReminderFilter')?.value || 'all').trim();
    const dateStartText = String(document.getElementById('bankingDateStart')?.value || '').trim();
    const dateEndText = String(document.getElementById('bankingDateEnd')?.value || '').trim();
    const startDate = dateStartText ? new Date(`${dateStartText}T00:00:00`) : null;
    const endDate = dateEndText ? new Date(`${dateEndText}T23:59:59.999`) : null;

    const sourceRows = getBankBusinessRecords().map(parseBankBusinessRecord);
    const filtered = sourceRows.filter(item => {
        const bankMatch = !bankKeyword
            || String(item.bank || '').toLowerCase().includes(bankKeyword)
            || String(item.swipeCardBank || '').toLowerCase().includes(bankKeyword)
            || String(item.settlementBank || '').toLowerCase().includes(bankKeyword)
            || String(item.description || '').toLowerCase().includes(bankKeyword);

        const date = item.transactionDate;
        const dateMatch = (!startDate || (date && date >= startDate))
            && (!endDate || (date && date <= endDate));

        const reminderMeta = getBankReminderStatus(item);
        const reminderMatch = reminderFilter === 'all'
            || (reminderFilter === 'enabled' && item.reminderEnabled)
            || (reminderFilter === 'disabled' && !item.reminderEnabled)
            || (reminderFilter === 'due' && reminderMeta.isDue)
            || (reminderFilter === 'future' && item.reminderEnabled && !reminderMeta.isDue);

        return bankMatch && dateMatch && reminderMatch;
    });

    syncBankBusinessRows(filtered, 'filtered');
    renderBankBusiness(filtered);
}

function setBankBusinessCurrentMonthRange() {
    const startInput = document.getElementById('bankingDateStart');
    const endInput = document.getElementById('bankingDateEnd');
    if (!startInput || !endInput) return;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const formatDateInputValue = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    startInput.value = formatDateInputValue(monthStart);
    endInput.value = formatDateInputValue(now);
}

function resetBankBusinessFilters() {
    const bankInput = document.getElementById('bankingSearchBank');
    const reminderInput = document.getElementById('bankingReminderFilter');
    if (bankInput) bankInput.value = '';
    if (reminderInput) reminderInput.value = 'all';
    setBankBusinessCurrentMonthRange();
    applyBankBusinessFilters();
}

async function refreshBankBusinessModule(buttonEl = null) {
    const button = buttonEl && typeof buttonEl === 'object'
        ? buttonEl
        : null;
    const originalHtml = button?.innerHTML || '<i class="fa fa-refresh"></i> 刷新';
    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 刷新中...';
    }

    try {
        await Promise.all([
            ERP.loadFinances(true),
            refreshQQMailAuthStatus(true)
        ]);
        applyBankBusinessFilters();
        await refreshBankSmartPlanIfVisible();
        if (typeof showToast === 'function') {
            showToast('银行业务与授权状态已实时同步', 'success');
        }
    } catch (error) {
        console.error('[ERP Ant] 刷新银行业务失败:', error);
        if (typeof showToast === 'function') {
            showToast(`刷新失败：${error?.message || '请稍后重试'}`, 'error');
        }
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = originalHtml;
        }
    }
}

function getDailyNoteEditorElement() {
    return document.getElementById('dailyNoteEditor');
}

function getDailyNoteTitleElement() {
    return document.getElementById('dailyNoteTitle');
}

function getDailyNoteHistoryListElement() {
    return document.getElementById('dailyNoteHistoryList');
}

function getDailyNoteContextMenuElement() {
    return dailyNotesViewState.contextMenuEl;
}

function resetDailyNoteContextLinkTarget() {
    dailyNotesViewState.contextTargetLinkHref = '';
    dailyNotesViewState.contextTargetLinkNode = null;
}

function getDailyNoteHistoryStorageKey(noteId) {
    const userId = String(window?.userData?.user?.id || 'guest').trim() || 'guest';
    const safeNoteId = String(noteId || '').trim() || 'draft';
    return `erp_note_history_${userId}_${safeNoteId}`;
}

function getDailyNoteDraftStorageKey(noteId = 'draft') {
    const userId = String(window?.userData?.user?.id || 'guest').trim() || 'guest';
    const safeNoteId = String(noteId || 'draft').trim() || 'draft';
    return `erp_note_draft_${userId}_${safeNoteId}`;
}

function readDailyNoteLocalDraft(noteId = 'draft') {
    try {
        const raw = localStorage.getItem(getDailyNoteDraftStorageKey(noteId));
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
            return null;
        }
        return {
            note_id: parsed.note_id ?? null,
            title: String(parsed.title ?? '').trim(),
            content_html: normalizeDailyNoteHtml(parsed.content_html || ''),
            content_text: String(parsed.content_text || '').trim(),
            is_pinned: !!parsed.is_pinned,
            pending_sync: !!parsed.pending_sync,
            updated_at: parsed.updated_at || null
        };
    } catch (error) {
        return null;
    }
}

function writeDailyNoteLocalDraft(noteId = 'draft', payload = {}, pendingSync = true) {
    try {
        const data = {
            note_id: noteId === 'draft' ? null : String(noteId || ''),
            title: String(payload?.title ?? '').trim(),
            content_html: String(payload?.content_html || ''),
            content_text: String(payload?.content_text || '').trim(),
            is_pinned: !!payload?.is_pinned,
            pending_sync: !!pendingSync,
            updated_at: new Date().toISOString()
        };
        localStorage.setItem(getDailyNoteDraftStorageKey(noteId), JSON.stringify(data));
    } catch (error) {
        console.warn('[ERP Notes] 写入本地草稿失败:', error?.message || error);
    }
}

function removeDailyNoteLocalDraft(noteId = 'draft') {
    try {
        localStorage.removeItem(getDailyNoteDraftStorageKey(noteId));
    } catch (error) {
        // ignore
    }
}

function getActiveDailyNoteDraftId() {
    const currentId = normalizeEntityId(dailyNotesViewState.currentId);
    return currentId === null ? 'draft' : String(currentId);
}

function collectDailyNoteDraftFormData() {
    const editorEl = getDailyNoteEditorElement();
    const titleEl = getDailyNoteTitleElement();
    if (!editorEl || !titleEl) {
        return null;
    }
    const html = String(editorEl.innerHTML || '');
    const text = String(editorEl.textContent || '')
        .replace(/\s+/g, ' ')
        .trim();
    return {
        title: String(titleEl.value ?? '').trim(),
        content_html: html,
        content_text: text,
        is_pinned: !!dailyNotesViewState.draftPinned
    };
}

function clearDailyNoteDraftCacheTimer() {
    if (dailyNotesViewState.draftCacheTimer) {
        clearTimeout(dailyNotesViewState.draftCacheTimer);
        dailyNotesViewState.draftCacheTimer = null;
    }
}

function cacheDailyNoteDraftFromForm(pendingSync = true, immediate = false) {
    if (dailyNotesViewState.isApplyingState) {
        return;
    }

    const flush = () => {
        const payload = collectDailyNoteDraftFormData();
        if (!payload) {
            return;
        }
        const hasContent = !!payload.content_text || getNoteContentHasMedia(payload.content_html);
        const hasTitle = !!payload.title;
        const draftId = getActiveDailyNoteDraftId();
        if (!hasContent && !hasTitle) {
            if (draftId === 'draft') {
                removeDailyNoteLocalDraft('draft');
            }
            return;
        }
        writeDailyNoteLocalDraft(draftId, payload, pendingSync);
    };

    if (immediate) {
        clearDailyNoteDraftCacheTimer();
        flush();
        return;
    }

    clearDailyNoteDraftCacheTimer();
    dailyNotesViewState.draftCacheTimer = setTimeout(() => {
        flush();
    }, dailyNotesViewState.draftCacheDelay);
}

function normalizeDailyNoteUrl(rawUrl = '') {
    const value = String(rawUrl || '').trim();
    if (!value) {
        return '';
    }
    const withProtocol = /^www\./i.test(value) ? `https://${value}` : value;
    try {
        const parsed = new URL(withProtocol);
        if (!/^https?:$/i.test(parsed.protocol)) {
            return '';
        }
        return parsed.href;
    } catch (error) {
        return '';
    }
}

function isDailyNoteSingleUrlText(rawText = '') {
    const value = String(rawText || '').trim();
    if (!value) {
        return false;
    }
    if (/\s/.test(value)) {
        return false;
    }
    return !!normalizeDailyNoteUrl(value);
}

function normalizeDailyNoteEditorLists() {
    const editorEl = getDailyNoteEditorElement();
    if (!editorEl) {
        return;
    }
    editorEl.querySelectorAll('ul').forEach((listEl) => {
        listEl.style.listStyleType = 'disc';
        listEl.style.paddingLeft = '1.45em';
        listEl.style.margin = '0.5em 0';
    });
    editorEl.querySelectorAll('ol').forEach((listEl) => {
        listEl.style.listStyleType = 'decimal';
        listEl.style.paddingLeft = '1.45em';
        listEl.style.margin = '0.5em 0';
    });
    editorEl.querySelectorAll('li').forEach((itemEl) => {
        itemEl.style.margin = '0.22em 0';
        itemEl.style.paddingLeft = '0.1em';
    });
}

function cacheDailyNoteSelectionRange() {
    const editorEl = getDailyNoteEditorElement();
    const selection = window.getSelection?.();
    if (!editorEl || !selection || selection.rangeCount < 1) {
        dailyNotesViewState.contextMenuRange = null;
        return;
    }
    const range = selection.getRangeAt(0);
    if (!editorEl.contains(range.commonAncestorContainer)) {
        dailyNotesViewState.contextMenuRange = null;
        return;
    }
    dailyNotesViewState.contextMenuRange = range.cloneRange();
}

function restoreDailyNoteSelectionRange() {
    const range = dailyNotesViewState.contextMenuRange;
    if (!range) {
        return;
    }
    const selection = window.getSelection?.();
    if (!selection) {
        return;
    }
    selection.removeAllRanges();
    selection.addRange(range);
}

function hideDailyNoteContextMenu() {
    const menuEl = getDailyNoteContextMenuElement();
    if (!menuEl) {
        resetDailyNoteContextLinkTarget();
        return;
    }
    menuEl.classList.remove('is-visible');
    menuEl.classList.remove('has-link-target');
    menuEl.style.left = '-9999px';
    menuEl.style.top = '-9999px';
    dailyNotesViewState.contextMenuVisible = false;
    resetDailyNoteContextLinkTarget();
}

function showDailyNoteContextMenu(clientX = 0, clientY = 0) {
    const menuEl = ensureDailyNoteContextMenu();
    if (!menuEl) {
        return;
    }
    if (dailyNotesViewState.contextTargetLinkHref) {
        menuEl.classList.add('has-link-target');
    } else {
        menuEl.classList.remove('has-link-target');
    }
    menuEl.classList.add('is-visible');
    menuEl.style.visibility = 'hidden';
    menuEl.style.left = `${Math.max(8, Number(clientX) || 0)}px`;
    menuEl.style.top = `${Math.max(8, Number(clientY) || 0)}px`;

    const width = menuEl.offsetWidth || 180;
    const height = menuEl.offsetHeight || 280;
    const maxLeft = Math.max(8, window.innerWidth - width - 8);
    const maxTop = Math.max(8, window.innerHeight - height - 8);
    const finalLeft = Math.min(Math.max(8, Number(clientX) || 0), maxLeft);
    const finalTop = Math.min(Math.max(8, Number(clientY) || 0), maxTop);

    menuEl.style.left = `${finalLeft}px`;
    menuEl.style.top = `${finalTop}px`;
    menuEl.style.visibility = 'visible';
    dailyNotesViewState.contextMenuVisible = true;
}

async function pasteDailyNoteFromClipboard() {
    const editorEl = getDailyNoteEditorElement();
    if (!editorEl) {
        return;
    }
    editorEl.focus();
    try {
        if (navigator.clipboard?.readText && window.isSecureContext) {
            const text = String(await navigator.clipboard.readText() || '');
            if (text) {
                if (isDailyNoteSingleUrlText(text)) {
                    insertDailyNoteHtml(`<a href="${escapeHtmlText(normalizeDailyNoteUrl(text))}" target="_blank" rel="noopener noreferrer">${escapeHtmlText(text.trim())}</a>`);
                } else {
                    document.execCommand('insertText', false, text);
                    scheduleDailyNoteAutoSave();
                }
                return;
            }
        }
        const applied = document.execCommand('paste');
        if (!applied) {
            throw new Error('paste_not_supported');
        }
        scheduleDailyNoteAutoSave();
    } catch (error) {
        showToast('浏览器限制右键粘贴，请使用 Ctrl+V', 'warning');
    }
}

async function copyTextToClipboard(text = '') {
    const value = String(text || '').trim();
    if (!value) {
        return false;
    }
    try {
        if (navigator.clipboard?.writeText && window.isSecureContext) {
            await navigator.clipboard.writeText(value);
            return true;
        }
    } catch (error) {
        // fallback below
    }
    try {
        const textArea = document.createElement('textarea');
        textArea.value = value;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textArea);
        return !!ok;
    } catch (error) {
        return false;
    }
}

function handleDailyNoteContextMenuAction(action = '') {
    const key = String(action || '').trim();
    if (!key) {
        return;
    }
    restoreDailyNoteSelectionRange();
    switch (key) {
    case 'undo':
        execDailyNoteCommand('undo');
        break;
    case 'redo':
        execDailyNoteCommand('redo');
        break;
    case 'cut':
        execDailyNoteCommand('cut');
        break;
    case 'copy':
        execDailyNoteCommand('copy');
        break;
    case 'paste':
        pasteDailyNoteFromClipboard();
        break;
    case 'open-link': {
        const link = normalizeDailyNoteUrl(dailyNotesViewState.contextTargetLinkHref);
        if (link) {
            window.open(link, '_blank', 'noopener,noreferrer');
        }
        break;
    }
    case 'copy-link':
        copyTextToClipboard(dailyNotesViewState.contextTargetLinkHref)
            .then((ok) => {
                if (ok) {
                    showToast('链接已复制', 'success');
                } else {
                    showToast('复制失败，请重试', 'error');
                }
            });
        break;
    case 'remove-link': {
        const linkNode = dailyNotesViewState.contextTargetLinkNode;
        if (linkNode && linkNode.parentNode) {
            const parent = linkNode.parentNode;
            while (linkNode.firstChild) {
                parent.insertBefore(linkNode.firstChild, linkNode);
            }
            parent.removeChild(linkNode);
            scheduleDailyNoteAutoSave();
        } else {
            execDailyNoteCommand('unlink');
        }
        break;
    }
    case 'bold':
        execDailyNoteCommand('bold');
        break;
    case 'italic':
        execDailyNoteCommand('italic');
        break;
    case 'underline':
        execDailyNoteCommand('underline');
        break;
    case 'bullet':
        insertDailyNoteBulletList();
        break;
    case 'ordered':
        execDailyNoteCommand('insertOrderedList');
        break;
    case 'divider':
        insertDailyNoteDivider();
        break;
    case 'link':
        insertDailyNoteLink();
        break;
    case 'clear':
        execDailyNoteCommand('removeFormat');
        break;
    default:
        break;
    }
    hideDailyNoteContextMenu();
}

function ensureDailyNoteContextMenu() {
    if (dailyNotesViewState.contextMenuEl && document.body.contains(dailyNotesViewState.contextMenuEl)) {
        return dailyNotesViewState.contextMenuEl;
    }
    const menuEl = document.createElement('div');
    menuEl.id = 'dailyNoteContextMenu';
    menuEl.className = 'erp-notes-context-menu';
    menuEl.innerHTML = `
        <button type="button" data-action="open-link" class="erp-notes-link-action"><i class="fa fa-external-link"></i> 打开链接</button>
        <button type="button" data-action="copy-link" class="erp-notes-link-action"><i class="fa fa-link"></i> 复制链接</button>
        <button type="button" data-action="remove-link" class="erp-notes-link-action"><i class="fa fa-unlink"></i> 删除链接</button>
        <div class="erp-notes-context-divider erp-notes-link-action"></div>
        <button type="button" data-action="undo"><i class="fa fa-undo"></i> 撤销</button>
        <button type="button" data-action="redo"><i class="fa fa-repeat"></i> 重做</button>
        <div class="erp-notes-context-divider"></div>
        <button type="button" data-action="cut"><i class="fa fa-scissors"></i> 剪切</button>
        <button type="button" data-action="copy"><i class="fa fa-copy"></i> 复制</button>
        <button type="button" data-action="paste"><i class="fa fa-clipboard"></i> 粘贴</button>
        <div class="erp-notes-context-divider"></div>
        <button type="button" data-action="bold"><i class="fa fa-bold"></i> 加粗</button>
        <button type="button" data-action="italic"><i class="fa fa-italic"></i> 斜体</button>
        <button type="button" data-action="underline"><i class="fa fa-underline"></i> 下划线</button>
        <button type="button" data-action="bullet"><i class="fa fa-list-ul"></i> 项目符号</button>
        <button type="button" data-action="ordered"><i class="fa fa-list-ol"></i> 有序列表</button>
        <button type="button" data-action="link"><i class="fa fa-link"></i> 插入链接</button>
        <button type="button" data-action="divider"><i class="fa fa-minus"></i> 分割线</button>
        <button type="button" data-action="clear"><i class="fa fa-eraser"></i> 清除格式</button>
    `;
    menuEl.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const button = target ? target.closest('button[data-action]') : null;
        if (!button) {
            return;
        }
        handleDailyNoteContextMenuAction(button.dataset.action || '');
    });
    document.body.appendChild(menuEl);
    dailyNotesViewState.contextMenuEl = menuEl;
    return menuEl;
}

function handleDailyNoteEditorContextMenu(event) {
    const editorEl = getDailyNoteEditorElement();
    if (!editorEl || !editorEl.contains(event.target)) {
        hideDailyNoteContextMenu();
        return;
    }
    const target = event.target instanceof Element ? event.target : null;
    const linkEl = target ? target.closest('a[href]') : null;
    if (linkEl && editorEl.contains(linkEl)) {
        dailyNotesViewState.contextTargetLinkHref = String(linkEl.getAttribute('href') || linkEl.href || '').trim();
        dailyNotesViewState.contextTargetLinkNode = linkEl;
    } else {
        resetDailyNoteContextLinkTarget();
    }
    event.preventDefault();
    cacheDailyNoteSelectionRange();
    showDailyNoteContextMenu(event.clientX, event.clientY);
}

function handleDailyNoteGlobalPointerDown(event) {
    if (!dailyNotesViewState.contextMenuVisible) {
        return;
    }
    const menuEl = getDailyNoteContextMenuElement();
    if (!menuEl) {
        return;
    }
    if (menuEl.contains(event.target)) {
        return;
    }
    hideDailyNoteContextMenu();
}

function handleDailyNoteGlobalKeydown(event) {
    if (event.key === 'Escape') {
        hideDailyNoteContextMenu();
    }
}

function readLocalDailyNoteHistory(noteId) {
    const key = getDailyNoteHistoryStorageKey(noteId);
    try {
        const parsed = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function writeLocalDailyNoteHistory(noteId, rows = []) {
    const key = getDailyNoteHistoryStorageKey(noteId);
    const list = Array.isArray(rows) ? rows.slice(0, 80) : [];
    localStorage.setItem(key, JSON.stringify(list));
}

function clearDailyNoteAutoSaveTimer() {
    if (dailyNotesViewState.autoSaveTimer) {
        clearTimeout(dailyNotesViewState.autoSaveTimer);
        dailyNotesViewState.autoSaveTimer = null;
    }
}

function nextDailyNoteEditorSessionToken() {
    dailyNotesViewState.editorSessionToken = Number(dailyNotesViewState.editorSessionToken || 0) + 1;
    return dailyNotesViewState.editorSessionToken;
}

function buildDailyNoteSignature(payload = {}) {
    const title = String(payload?.title || '').trim();
    const html = normalizeDailyNoteHtml(payload?.content_html || '');
    const pinned = payload?.is_pinned ? '1' : '0';
    return `${title}||${html}||${pinned}`;
}

function getNoteContentHasMedia(html = '') {
    return /<img\b/i.test(String(html || ''));
}

function normalizeDailyNoteHtml(rawHtml = '') {
    const container = document.createElement('div');
    container.innerHTML = String(rawHtml || '');
    container.querySelectorAll('script,style,iframe,object,embed').forEach(node => node.remove());
    container.querySelectorAll('*').forEach((element) => {
        [...element.attributes].forEach((attr) => {
            if (/^on/i.test(attr.name)) {
                element.removeAttribute(attr.name);
            }
        });
    });
    return container.innerHTML.trim();
}

function getDailyNoteTextFromHtml(rawHtml = '') {
    const container = document.createElement('div');
    container.innerHTML = String(rawHtml || '');
    return String(container.textContent || container.innerText || '')
        .replace(/\s+/g, ' ')
        .trim();
}

function getDailyNotesRows() {
    const rows = Array.isArray(window?.ERP?.state?.notes) ? window.ERP.state.notes : [];
    return [...rows].sort((left, right) => {
        const leftPinned = left?.is_pinned ? 1 : 0;
        const rightPinned = right?.is_pinned ? 1 : 0;
        if (leftPinned !== rightPinned) {
            return rightPinned - leftPinned;
        }
        const leftTs = new Date(left?.updated_at || left?.created_at || 0).getTime();
        const rightTs = new Date(right?.updated_at || right?.created_at || 0).getTime();
        return rightTs - leftTs;
    });
}

function updateDailyNoteMetaText(text = '') {
    const metaEl = document.getElementById('dailyNoteMeta');
    if (!metaEl) {
        return;
    }
    metaEl.textContent = text || '支持粘贴图片、超链接、文字排版；按 Ctrl+V 可直接贴图。';
}

function setDailyNoteSavedSignature(payload = {}) {
    dailyNotesViewState.lastSavedSignature = buildDailyNoteSignature(payload);
}

function scheduleDailyNoteAutoSave() {
    if (dailyNotesViewState.isApplyingState) {
        return;
    }
    clearDailyNoteAutoSaveTimer();
    const sessionToken = Number(dailyNotesViewState.editorSessionToken || 0);
    dailyNotesViewState.pendingSessionToken = sessionToken;
    if (dailyNotesViewState.autoSaveDelay <= 0) {
        Promise.resolve().then(() => runDailyNoteAutoSave(sessionToken));
        return;
    }
    dailyNotesViewState.autoSaveTimer = setTimeout(() => {
        runDailyNoteAutoSave(sessionToken);
    }, dailyNotesViewState.autoSaveDelay);
}

async function runDailyNoteAutoSave(sessionToken = 0) {
    if (dailyNotesViewState.isAutoSaving) {
        dailyNotesViewState.pendingAutoSave = true;
        dailyNotesViewState.pendingSessionToken = Number(sessionToken || dailyNotesViewState.editorSessionToken || 0);
        return;
    }
    dailyNotesViewState.isAutoSaving = true;
    try {
        await saveDailyNote({
            silent: true,
            source: 'auto',
            sessionToken
        });
    } finally {
        dailyNotesViewState.isAutoSaving = false;
        if (dailyNotesViewState.pendingAutoSave) {
            dailyNotesViewState.pendingAutoSave = false;
            const nextToken = Number(dailyNotesViewState.pendingSessionToken || dailyNotesViewState.editorSessionToken || 0);
            runDailyNoteAutoSave(nextToken).catch(error => {
                console.error('[ERP Notes] 实时自动保存失败:', error);
            });
        }
    }
}

function applyDailyNoteEditorState(note = null) {
    const titleEl = getDailyNoteTitleElement();
    const editorEl = getDailyNoteEditorElement();
    if (!titleEl || !editorEl) {
        return;
    }
    dailyNotesViewState.isApplyingState = true;
    nextDailyNoteEditorSessionToken();

    if (!note) {
        const draft = readDailyNoteLocalDraft('draft');
        const draftHtml = String(draft?.content_html || '').trim();
        titleEl.value = String(draft?.title || '');
        editorEl.innerHTML = draftHtml;
        dailyNotesViewState.currentId = null;
        dailyNotesViewState.isDraftMode = true;
        dailyNotesViewState.draftPinned = !!draft?.is_pinned;
        setDailyNoteSavedSignature({
            title: draft?.title || '',
            content_html: draftHtml,
            is_pinned: !!draft?.is_pinned
        });
        normalizeDailyNoteEditorLists();
        if (draft) {
            const draftTime = toDateTimeText(draft?.updated_at || null);
            updateDailyNoteMetaText(`已恢复本地草稿 · ${draft?.pending_sync ? '待同步数据库' : '已缓存'} · ${draftTime}`);
        } else {
            updateDailyNoteMetaText('新建笔记中，支持粘贴图片、链接、清单内容。');
        }
        setTimeout(() => {
            dailyNotesViewState.isApplyingState = false;
        }, 0);
        return;
    }

    const remotePayload = {
        title: String(note?.title || ''),
        content_html: String(note?.content_html || '').trim(),
        is_pinned: !!note?.is_pinned,
        updated_at: note?.updated_at || note?.created_at || null
    };
    const localDraft = readDailyNoteLocalDraft(String(note?.id ?? ''));
    let effectivePayload = { ...remotePayload };
    let usingLocalDraft = false;
    if (localDraft) {
        const localTs = new Date(localDraft?.updated_at || 0).getTime();
        const remoteTs = new Date(remotePayload?.updated_at || 0).getTime();
        if (localDraft?.pending_sync || localTs > remoteTs) {
            effectivePayload = {
                ...effectivePayload,
                title: localDraft?.title ?? effectivePayload.title,
                content_html: String(localDraft?.content_html || '').trim(),
                is_pinned: !!localDraft?.is_pinned
            };
            usingLocalDraft = true;
        }
    }

    titleEl.value = String(effectivePayload.title || '');
    editorEl.innerHTML = String(effectivePayload.content_html || '').trim();
    dailyNotesViewState.currentId = note?.id ?? null;
    dailyNotesViewState.isDraftMode = false;
    dailyNotesViewState.draftPinned = !!effectivePayload.is_pinned;
    normalizeDailyNoteEditorLists();
    setDailyNoteSavedSignature({
        title: effectivePayload.title || '',
        content_html: effectivePayload.content_html || '',
        is_pinned: effectivePayload.is_pinned
    });
    const updateText = toDateTimeText(note?.updated_at || note?.created_at || null);
    if (usingLocalDraft && localDraft?.pending_sync) {
        const localText = toDateTimeText(localDraft?.updated_at || null);
        updateDailyNoteMetaText(`${effectivePayload?.is_pinned ? '已置顶' : '未置顶'} · 本地已更新待同步 · ${localText}`);
    } else {
        updateDailyNoteMetaText(`${effectivePayload?.is_pinned ? '已置顶' : '未置顶'} · 最近更新 ${updateText}`);
    }
    setTimeout(() => {
        dailyNotesViewState.isApplyingState = false;
    }, 0);
}

function renderDailyNotesList(rows = []) {
    const listEl = document.getElementById('dailyNotesList');
    const countEl = document.getElementById('dailyNotesCount');
    if (!listEl) {
        return;
    }
    const list = Array.isArray(rows) ? rows : [];
    if (countEl) {
        countEl.textContent = `${list.length} 条`;
    }

    if (!list.length) {
        listEl.innerHTML = '<div class="erp-note-item"><div class="erp-note-item-snippet">暂无笔记，点击“新建笔记”开始记录。</div></div>';
        return;
    }

    listEl.innerHTML = list.map((note) => {
        const idText = escapeHtmlText(String(note?.id ?? ''));
        const title = escapeHtmlText(String(note?.title || '未命名笔记'));
        const snippetSource = String(note?.content_text || getDailyNoteTextFromHtml(note?.content_html || '') || '').trim();
        const snippet = escapeHtmlText(snippetSource.slice(0, 66) || '（空白内容）');
        const timeText = escapeHtmlText(toDateTimeText(note?.updated_at || note?.created_at || null));
        const isActive = dailyNotesViewState.currentId !== null && isSameEntityId(note?.id, dailyNotesViewState.currentId);
        const pinnedTag = note?.is_pinned ? '<span class="erp-type-pill is-active" style="margin-left:6px;">置顶</span>' : '';
        return `
            <div class="erp-note-item ${isActive ? 'active' : ''}" data-note-id="${idText}" tabindex="0" role="button">
                <div class="erp-note-item-title">${title}${pinnedTag}</div>
                <div class="erp-note-item-snippet">${snippet}</div>
                <div class="erp-note-item-time">${timeText}</div>
            </div>
        `;
    }).join('');
}

function renderDailyNotesModule() {
    const rows = getDailyNotesRows();
    const keyword = String(dailyNotesViewState.keyword || '').trim().toLowerCase();
    const filteredRows = !keyword
        ? rows
        : rows.filter((note) => {
            const title = String(note?.title || '').toLowerCase();
            const text = String(note?.content_text || '').toLowerCase();
            return title.includes(keyword) || text.includes(keyword);
        });

    renderDailyNotesList(filteredRows);

    if (dailyNotesViewState.isDraftMode && dailyNotesViewState.currentId === null) {
        return;
    }

    const current = filteredRows.find(note => isSameEntityId(note?.id, dailyNotesViewState.currentId))
        || rows.find(note => isSameEntityId(note?.id, dailyNotesViewState.currentId))
        || filteredRows[0]
        || null;
    applyDailyNoteEditorState(current);
}

async function createDailyNote() {
    cacheDailyNoteDraftFromForm(true, true);
    clearDailyNoteAutoSaveTimer();
    dailyNotesViewState.currentId = null;
    dailyNotesViewState.isDraftMode = true;
    dailyNotesViewState.draftPinned = false;
    applyDailyNoteEditorState(null);
    const titleEl = getDailyNoteTitleElement();
    if (titleEl) {
        titleEl.focus();
    }
}

function searchDailyNotes(keyword = '') {
    dailyNotesViewState.keyword = String(keyword || '').trim();
    renderDailyNotesModule();
}

function selectDailyNote(noteId) {
    cacheDailyNoteDraftFromForm(true, true);
    clearDailyNoteAutoSaveTimer();
    const rows = getDailyNotesRows();
    const note = rows.find(item => isSameEntityId(item?.id, noteId)) || null;
    dailyNotesViewState.isDraftMode = false;
    applyDailyNoteEditorState(note);
    renderDailyNotesList(String(dailyNotesViewState.keyword || '').trim()
        ? rows.filter(item => {
            const keyword = String(dailyNotesViewState.keyword || '').trim().toLowerCase();
            return String(item?.title || '').toLowerCase().includes(keyword)
                || String(item?.content_text || '').toLowerCase().includes(keyword);
        })
        : rows);
}

function handleDailyNotesListClick(event) {
    const listEl = document.getElementById('dailyNotesList');
    const target = event?.target instanceof Element ? event.target : null;
    if (!listEl || !target) {
        return;
    }
    const noteItem = target.closest('.erp-note-item[data-note-id]');
    if (!noteItem || !listEl.contains(noteItem)) {
        return;
    }
    const noteId = normalizeEntityId(noteItem.getAttribute('data-note-id'));
    if (noteId === null) {
        return;
    }
    selectDailyNote(noteId);
}

function handleDailyNotesListKeydown(event) {
    if (!event || (event.key !== 'Enter' && event.key !== ' ')) {
        return;
    }
    const target = event.target instanceof Element ? event.target : null;
    const noteItem = target ? target.closest('.erp-note-item[data-note-id]') : null;
    if (!noteItem) {
        return;
    }
    event.preventDefault();
    const noteId = normalizeEntityId(noteItem.getAttribute('data-note-id'));
    if (noteId === null) {
        return;
    }
    selectDailyNote(noteId);
}

function collectDailyNoteFormData() {
    const titleEl = getDailyNoteTitleElement();
    const editorEl = getDailyNoteEditorElement();
    const html = normalizeDailyNoteHtml(editorEl?.innerHTML || '');
    const text = getDailyNoteTextFromHtml(html);
    return {
        title: String(titleEl?.value || '').trim(),
        content_html: html,
        content_text: text,
        is_pinned: !!dailyNotesViewState.draftPinned
    };
}

async function pushDailyNoteHistorySnapshot(noteId, snapshot = {}, source = 'manual') {
    if (!noteId || !snapshot) {
        return;
    }
    const payload = {
        note_id: noteId,
        title: String(snapshot?.title || '').trim() || '未命名笔记',
        content_html: normalizeDailyNoteHtml(snapshot?.content_html || ''),
        content_text: String(snapshot?.content_text || getDailyNoteTextFromHtml(snapshot?.content_html || '') || '').trim(),
        is_pinned: !!snapshot?.is_pinned,
        source,
        created_at: new Date().toISOString()
    };
    if (!payload.content_html && !payload.content_text && !payload.title) {
        return;
    }

    if (window.ERP && typeof ERP.addNoteVersion === 'function') {
        const result = await ERP.addNoteVersion(payload.note_id, payload);
        if (result) {
            return;
        }
    }

    const existing = readLocalDailyNoteHistory(noteId);
    existing.unshift({
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ...payload
    });
    writeLocalDailyNoteHistory(noteId, existing);
}

async function loadDailyNoteHistoryRows(noteId) {
    if (!noteId) {
        return [];
    }
    if (window.ERP && typeof ERP.loadNoteVersions === 'function') {
        const rows = await ERP.loadNoteVersions(noteId, 80);
        if (Array.isArray(rows) && rows.length) {
            return rows;
        }
    }
    return readLocalDailyNoteHistory(noteId);
}

function renderDailyNoteHistoryModal(rows = []) {
    const listEl = getDailyNoteHistoryListElement();
    if (!listEl) {
        return;
    }
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
        listEl.innerHTML = '<div class="erp-note-history-item"><div class="erp-note-history-meta">暂无历史版本</div></div>';
        return;
    }
    listEl.innerHTML = list.map((item) => {
        const idText = escapeHtmlText(String(item?.id || ''));
        const title = escapeHtmlText(String(item?.title || '未命名笔记'));
        const snippet = escapeHtmlText(String(item?.content_text || '').slice(0, 100) || '（无正文）');
        const timeText = escapeHtmlText(toDateTimeText(item?.created_at || item?.updated_at || null));
        const sourceText = escapeHtmlText(String(item?.source || 'manual'));
        return `
            <div class="erp-note-history-item">
                <div class="erp-note-history-title">${title}</div>
                <div class="erp-note-history-snippet">${snippet}</div>
                <div class="erp-note-history-meta">${timeText} · 来源：${sourceText}</div>
                <div class="erp-note-history-actions">
                    <button class="ant-btn" type="button" onclick="rollbackDailyNoteVersion('${idText}')">回滚到此版本</button>
                </div>
            </div>
        `;
    }).join('');
}

async function showDailyNoteHistoryModal() {
    const noteId = dailyNotesViewState.currentId;
    if (!noteId) {
        showToast('请先选择一条笔记，再查看历史版本', 'info');
        return;
    }
    const modal = document.getElementById('dailyNoteHistoryModal');
    if (!modal) {
        return;
    }
    modal.classList.add('active');
    modal.style.display = 'flex';
    const rows = await loadDailyNoteHistoryRows(noteId);
    dailyNotesViewState.historyRows = rows;
    renderDailyNoteHistoryModal(rows);
}

function hideDailyNoteHistoryModal() {
    const modal = document.getElementById('dailyNoteHistoryModal');
    if (!modal) {
        return;
    }
    modal.classList.remove('active');
    modal.style.display = '';
}

async function rollbackDailyNoteVersion(versionId) {
    const noteId = dailyNotesViewState.currentId;
    if (!noteId) {
        showToast('当前没有可回滚的笔记', 'warning');
        return;
    }
    const historyRows = Array.isArray(dailyNotesViewState.historyRows) ? dailyNotesViewState.historyRows : [];
    const target = historyRows.find(item => String(item?.id || '') === String(versionId || ''));
    if (!target) {
        showToast('未找到对应历史版本', 'error');
        return;
    }
    if (!window.confirm('确认回滚到该历史版本吗？当前内容会被覆盖。')) {
        return;
    }

    const currentRows = getDailyNotesRows();
    const current = currentRows.find(item => isSameEntityId(item?.id, noteId));
    if (current) {
        await pushDailyNoteHistorySnapshot(noteId, current, 'rollback_backup');
    }

    const payload = {
        title: target.title || '未命名笔记',
        content_html: target.content_html || '',
        content_text: target.content_text || '',
        is_pinned: !!target.is_pinned
    };
    const updated = await ERP.updateNote(noteId, payload);
    if (!updated) {
        showToast('回滚失败，请稍后重试', 'error');
        return;
    }

    removeDailyNoteLocalDraft(String(noteId));
    dailyNotesViewState.currentId = noteId;
    renderDailyNotesModule();
    const rows = await loadDailyNoteHistoryRows(noteId);
    dailyNotesViewState.historyRows = rows;
    renderDailyNoteHistoryModal(rows);
    showToast('已回滚到历史版本', 'success');
}

async function saveDailyNote(options = {}) {
    if (!window.ERP || typeof ERP.addNote !== 'function' || typeof ERP.updateNote !== 'function') {
        if (!options?.silent) {
            showToast('笔记模块未就绪，请刷新页面', 'error');
        }
        return;
    }
    const payload = collectDailyNoteFormData();
    const titleRaw = String(getDailyNoteTitleElement()?.value || '').trim();
    const hasContent = !!payload.content_text || getNoteContentHasMedia(payload.content_html);
    if (!hasContent && !titleRaw) {
        if (!options?.silent) {
            showToast('笔记内容不能为空', 'warning');
        }
        return null;
    }

    const currentSignature = buildDailyNoteSignature(payload);
    if (currentSignature === dailyNotesViewState.lastSavedSignature) {
        return null;
    }

    const isEdit = !!dailyNotesViewState.currentId;
    const draftIdBeforeSave = getActiveDailyNoteDraftId();
    writeDailyNoteLocalDraft(draftIdBeforeSave, payload, true);
    const source = String(options?.source || 'manual');

    if (isEdit) {
        const currentRows = getDailyNotesRows();
        const current = currentRows.find(item => isSameEntityId(item?.id, dailyNotesViewState.currentId));
        if (current) {
            const currentStoredSignature = buildDailyNoteSignature({
                title: current?.title || '',
                content_html: current?.content_html || '',
                is_pinned: current?.is_pinned
            });
            if (currentStoredSignature !== currentSignature) {
                await pushDailyNoteHistorySnapshot(dailyNotesViewState.currentId, current, source);
            }
        }
    }

    const saved = isEdit
        ? await ERP.updateNote(dailyNotesViewState.currentId, payload)
        : await ERP.addNote(payload);
    if (!saved) {
        updateDailyNoteMetaText('数据库保存失败，内容已保存在本地草稿，稍后自动重试');
        if (!options?.silent) {
            showToast(isEdit ? '保存笔记失败' : '创建笔记失败', 'error');
        }
        return null;
    }

    const sessionToken = Number(options?.sessionToken || 0);
    if (sessionToken > 0 && sessionToken !== Number(dailyNotesViewState.editorSessionToken || 0)) {
        return saved;
    }
    removeDailyNoteLocalDraft(draftIdBeforeSave);
    removeDailyNoteLocalDraft(String(saved.id || ''));
    dailyNotesViewState.isDraftMode = false;
    dailyNotesViewState.currentId = saved.id;
    setDailyNoteSavedSignature({
        title: payload.title,
        content_html: payload.content_html,
        is_pinned: payload.is_pinned
    });
    renderDailyNotesModule();
    if (!options?.silent) {
        showToast(isEdit ? '笔记已保存' : '笔记已创建', 'success');
    } else {
        const updateText = toDateTimeText(new Date());
        updateDailyNoteMetaText(`自动保存成功 · ${updateText}`);
    }
    return saved;
}

async function deleteDailyNote(noteId = null) {
    if (!window.ERP || typeof ERP.deleteNote !== 'function') {
        showToast('笔记模块未就绪，请刷新页面', 'error');
        return;
    }
    const targetId = noteId ?? dailyNotesViewState.currentId;
    if (!targetId) {
        showToast('请先选择需要删除的笔记', 'info');
        return;
    }
    if (!window.confirm('确认删除这条笔记吗？删除后不可恢复。')) {
        return;
    }
    const ok = await ERP.deleteNote(targetId);
    if (!ok) {
        showToast('删除笔记失败', 'error');
        return;
    }
    removeDailyNoteLocalDraft(String(targetId));
    dailyNotesViewState.currentId = null;
    dailyNotesViewState.isDraftMode = false;
    renderDailyNotesModule();
    showToast('笔记已删除', 'success');
}

async function toggleDailyNotePinned() {
    if (!window.ERP || typeof ERP.updateNote !== 'function') {
        showToast('笔记模块未就绪，请刷新页面', 'error');
        return;
    }
    if (!dailyNotesViewState.currentId) {
        dailyNotesViewState.draftPinned = !dailyNotesViewState.draftPinned;
        updateDailyNoteMetaText(`${dailyNotesViewState.draftPinned ? '新建笔记将保存为置顶' : '新建笔记未置顶'}`);
        return;
    }
    const payload = collectDailyNoteFormData();
    payload.is_pinned = !dailyNotesViewState.draftPinned;
    const updated = await ERP.updateNote(dailyNotesViewState.currentId, payload);
    if (!updated) {
        showToast('更新置顶状态失败', 'error');
        return;
    }
    removeDailyNoteLocalDraft(String(dailyNotesViewState.currentId));
    dailyNotesViewState.currentId = updated.id;
    renderDailyNotesModule();
    showToast(updated.is_pinned ? '已置顶笔记' : '已取消置顶', 'success');
}

function execDailyNoteCommand(command, value = null) {
    const editorEl = getDailyNoteEditorElement();
    if (!editorEl) {
        return;
    }
    editorEl.focus();
    document.execCommand(command, false, value);
    if (command === 'insertUnorderedList' || command === 'insertOrderedList') {
        window.requestAnimationFrame(() => normalizeDailyNoteEditorLists());
    }
    scheduleDailyNoteAutoSave();
}

function insertDailyNoteBulletList() {
    execDailyNoteCommand('insertUnorderedList');
    normalizeDailyNoteEditorLists();
}

function insertDailyNoteDivider() {
    execDailyNoteCommand('insertHorizontalRule');
}

function setDailyNoteTextColor(color = '') {
    const safeColor = String(color || '').trim();
    if (!safeColor) {
        return;
    }
    execDailyNoteCommand('foreColor', safeColor);
}

function setDailyNoteHighlightColor(color = '') {
    const safeColor = String(color || '').trim();
    if (!safeColor) {
        return;
    }
    const editorEl = getDailyNoteEditorElement();
    if (!editorEl) {
        return;
    }
    editorEl.focus();
    let applied = false;
    try {
        applied = document.execCommand('hiliteColor', false, safeColor);
    } catch (error) {
        applied = false;
    }
    if (!applied) {
        document.execCommand('backColor', false, safeColor);
    }
    scheduleDailyNoteAutoSave();
}

function setDailyNoteFontFamily(fontFamily = '') {
    const safeFont = String(fontFamily || '').trim();
    if (!safeFont) {
        return;
    }
    execDailyNoteCommand('fontName', safeFont);
}

function setDailyNoteFontSize(fontSize = '') {
    const safeSize = String(fontSize || '').trim();
    if (!safeSize) {
        return;
    }
    execDailyNoteCommand('fontSize', safeSize);
}

function insertDailyNoteChecklist() {
    const editorEl = getDailyNoteEditorElement();
    if (!editorEl) return;
    editorEl.focus();
    const html = '<div><label><input type="checkbox" style="margin-right:6px;">待办事项</label></div>';
    document.execCommand('insertHTML', false, html);
    scheduleDailyNoteAutoSave();
}

function insertDailyNoteLink() {
    const url = String(window.prompt('请输入超链接地址（http/https）：', 'https://') || '').trim();
    if (!url) {
        return;
    }
    const normalized = normalizeDailyNoteUrl(url);
    if (!normalized) {
        showToast('链接格式不正确，请输入 http/https 地址', 'warning');
        return;
    }
    execDailyNoteCommand('createLink', normalized);
    scheduleDailyNoteAutoSave();
}

function insertDailyNoteHtml(html = '') {
    const editorEl = getDailyNoteEditorElement();
    if (!editorEl) {
        return false;
    }
    const safeHtml = String(html || '').trim();
    if (!safeHtml) {
        return false;
    }
    editorEl.focus();
    const applied = document.execCommand('insertHTML', false, safeHtml);
    if (!applied) {
        return false;
    }
    scheduleDailyNoteAutoSave();
    return true;
}

function triggerDailyNoteImagePicker() {
    const input = document.getElementById('dailyNoteImageInput');
    if (!input) {
        return;
    }
    input.value = '';
    input.click();
}

function insertDailyNoteImageDataUrl(dataUrl = '') {
    if (!dataUrl) {
        return;
    }
    execDailyNoteCommand('insertImage', dataUrl);
}

function estimateDataUrlBytes(dataUrl = '') {
    const body = String(dataUrl || '').split(',')[1] || '';
    return Math.floor((body.length * 3) / 4);
}

function formatFileSize(size = 0) {
    const value = Math.max(0, Number(size || 0));
    if (value < 1024) return `${value}B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}KB`;
    return `${(value / (1024 * 1024)).toFixed(2)}MB`;
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function loadImageElementByDataUrl(dataUrl = '') {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = dataUrl;
    });
}

async function compressImageFileToDataUrl(file) {
    if (!file || !file.type.startsWith('image/')) {
        return null;
    }
    const originalDataUrl = await readFileAsDataUrl(file);
    if (file.type === 'image/gif') {
        return {
            dataUrl: originalDataUrl,
            originalBytes: estimateDataUrlBytes(originalDataUrl),
            compressedBytes: estimateDataUrlBytes(originalDataUrl),
            compressed: false
        };
    }

    const image = await loadImageElementByDataUrl(originalDataUrl);
    const maxWidth = Number(dailyNotesViewState.imageCompression?.maxWidth || 1600);
    const maxHeight = Number(dailyNotesViewState.imageCompression?.maxHeight || 1600);
    const quality = Number(dailyNotesViewState.imageCompression?.quality || 0.82);
    const ratio = Math.min(1, maxWidth / image.width, maxHeight / image.height);
    const targetWidth = Math.max(1, Math.round(image.width * ratio));
    const targetHeight = Math.max(1, Math.round(image.height * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return {
            dataUrl: originalDataUrl,
            originalBytes: estimateDataUrlBytes(originalDataUrl),
            compressedBytes: estimateDataUrlBytes(originalDataUrl),
            compressed: false
        };
    }
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
    const originalBytes = estimateDataUrlBytes(originalDataUrl);
    const compressedBytes = estimateDataUrlBytes(compressedDataUrl);
    if (compressedBytes >= originalBytes && ratio === 1) {
        return {
            dataUrl: originalDataUrl,
            originalBytes,
            compressedBytes: originalBytes,
            compressed: false
        };
    }
    return {
        dataUrl: compressedDataUrl,
        originalBytes,
        compressedBytes,
        compressed: true
    };
}

async function handleDailyNoteImageSelect(event) {
    const files = Array.from(event?.target?.files || []);
    for (const file of files) {
        if (!file.type.startsWith('image/')) {
            continue;
        }
        try {
            const result = await compressImageFileToDataUrl(file);
            if (!result?.dataUrl) {
                continue;
            }
            insertDailyNoteImageDataUrl(result.dataUrl);
            const detail = result.compressed
                ? `图片已压缩：${formatFileSize(result.originalBytes)} → ${formatFileSize(result.compressedBytes)}`
                : `图片已插入：${formatFileSize(result.originalBytes)}`;
            updateDailyNoteMetaText(detail);
            scheduleDailyNoteAutoSave();
        } catch (error) {
            console.error('[ERP Notes] 图片处理失败:', error);
            showToast('图片处理失败，请重试', 'error');
        }
    }
}

async function handleDailyNoteEditorPaste(event) {
    const items = Array.from(event?.clipboardData?.items || []);
    const imageItems = items.filter(item => item.type && item.type.startsWith('image/'));
    if (imageItems.length) {
        event.preventDefault();
        for (const item of imageItems) {
            const file = item.getAsFile();
            if (!file) {
                continue;
            }
            try {
                const result = await compressImageFileToDataUrl(file);
                if (!result?.dataUrl) {
                    continue;
                }
                insertDailyNoteImageDataUrl(result.dataUrl);
                const detail = result.compressed
                    ? `粘贴图片已压缩：${formatFileSize(result.originalBytes)} → ${formatFileSize(result.compressedBytes)}`
                    : `粘贴图片已插入：${formatFileSize(result.originalBytes)}`;
                updateDailyNoteMetaText(detail);
            } catch (error) {
                console.error('[ERP Notes] 粘贴图片处理失败:', error);
            }
        }
        scheduleDailyNoteAutoSave();
        return;
    }

    const clipboardText = String(event?.clipboardData?.getData('text/plain') || '').trim();
    if (clipboardText && isDailyNoteSingleUrlText(clipboardText)) {
        const normalized = normalizeDailyNoteUrl(clipboardText);
        if (normalized) {
            event.preventDefault();
            insertDailyNoteHtml(`<a href="${escapeHtmlText(normalized)}" target="_blank" rel="noopener noreferrer">${escapeHtmlText(clipboardText)}</a>`);
            updateDailyNoteMetaText('已自动将链接转换为超链接');
            return;
        }
    }
}

function initDailyNotesModule() {
    if (dailyNotesViewState.initialized) {
        return;
    }
    const editorEl = getDailyNoteEditorElement();
    const titleEl = getDailyNoteTitleElement();
    const listEl = document.getElementById('dailyNotesList');

    if (editorEl) {
        editorEl.setAttribute('data-placeholder', '记录文字、图片、超链接，内容自动保存到当前账号。');
        editorEl.addEventListener('paste', handleDailyNoteEditorPaste);
        editorEl.addEventListener('input', () => {
            cacheDailyNoteDraftFromForm(true, false);
            scheduleDailyNoteAutoSave();
        });
        editorEl.addEventListener('click', (event) => {
            const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
            if (!target) {
                return;
            }
            event.preventDefault();
            const href = normalizeDailyNoteUrl(target.getAttribute('href') || target.href || '');
            if (!href) {
                return;
            }
            window.open(href, '_blank', 'noopener,noreferrer');
        });
        editorEl.addEventListener('contextmenu', handleDailyNoteEditorContextMenu);
    }
    if (titleEl) {
        titleEl.addEventListener('input', () => {
            cacheDailyNoteDraftFromForm(true, false);
            scheduleDailyNoteAutoSave();
        });
        titleEl.addEventListener('keydown', (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                event.preventDefault();
                saveDailyNote({ silent: false, source: 'manual' });
            }
        });
    }
    if (listEl && !dailyNotesViewState.listBound) {
        listEl.addEventListener('click', handleDailyNotesListClick);
        listEl.addEventListener('keydown', handleDailyNotesListKeydown);
        dailyNotesViewState.listBound = true;
    }

    ensureDailyNoteContextMenu();
    document.addEventListener('mousedown', handleDailyNoteGlobalPointerDown, true);
    document.addEventListener('keydown', handleDailyNoteGlobalKeydown, true);
    document.addEventListener('scroll', hideDailyNoteContextMenu, true);
    window.addEventListener('blur', hideDailyNoteContextMenu);
    window.addEventListener('beforeunload', () => {
        cacheDailyNoteDraftFromForm(true, true);
    });

    dailyNotesViewState.initialized = true;
}

function buildSmartCardPlanRows() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const maxAgeMs = 180 * 24 * 60 * 60 * 1000;
    const allRows = getBankBusinessRecords().map(parseBankBusinessRecord);
    const repaymentRowsAll = allRows.filter(item => item?.isRepayment && !item?.isRepaymentPayment);
    const paymentRows = allRows.filter(item => item?.isRepaymentPayment);

    const buildCardKey = (row) => {
        const bank = String(row?.bank || '').trim();
        const tail = normalizeTail4(row?.cardTail || '');
        return tail ? `${bank}#${tail}` : `${bank}#__NO_TAIL`;
    };
    const extractSourceIdFromPayment = (row) => {
        const desc = String(row?.description || '');
        const hit = desc.match(/来源账单ID[:：]\s*([a-zA-Z0-9_-]+)/i);
        return String(hit?.[1] || '').trim();
    };

    const hasTailByBank = new Set();
    repaymentRowsAll.forEach((row) => {
        const bank = String(row?.bank || '').trim();
        const tail = normalizeTail4(row?.cardTail || '');
        if (bank && tail) {
            hasTailByBank.add(bank);
        }
    });

    const sourceRows = repaymentRowsAll.filter((row) => {
        const bank = String(row?.bank || '').trim();
        if (!bank) return false;
        const tail = normalizeTail4(row?.cardTail || '');
        if (!tail && hasTailByBank.has(bank)) return false;
        if (!row?.billDay || !row?.repaymentDay) return false;
        const txDate = row?.transactionDate instanceof Date ? row.transactionDate : null;
        if (txDate && !Number.isNaN(txDate.getTime()) && (now.getTime() - txDate.getTime()) > maxAgeMs) {
            return false;
        }
        return true;
    });

    const latestByCard = new Map();
    sourceRows.forEach((row) => {
        const key = buildCardKey(row);
        const prev = latestByCard.get(key);
        const prevTs = prev?.transactionDate instanceof Date ? prev.transactionDate.getTime() : 0;
        const currTs = row?.transactionDate instanceof Date ? row.transactionDate.getTime() : 0;
        if (!prev || currTs >= prevTs) {
            latestByCard.set(key, row);
        }
    });

    const paymentBuckets = new Map();
    paymentRows.forEach((row) => {
        const amount = Math.max(0, Number(row?.repaymentAmount || row?.raw?.amount || 0));
        if (!(amount > 0)) return;
        const key = buildCardKey(row);
        const date = row?.transactionDate instanceof Date ? row.transactionDate : parseFinanceDate(row?.raw?.transaction_date || row?.raw?.created_at || null);
        const sourceId = extractSourceIdFromPayment(row);
        const payload = {
            amount,
            sourceId,
            date: date instanceof Date && !Number.isNaN(date.getTime()) ? date : null,
            used: false
        };
        if (!paymentBuckets.has(key)) paymentBuckets.set(key, []);
        paymentBuckets.get(key).push(payload);
    });
    paymentBuckets.forEach((list) => {
        list.sort((a, b) => {
            const left = a?.date instanceof Date ? a.date.getTime() : 0;
            const right = b?.date instanceof Date ? b.date.getTime() : 0;
            return left - right;
        });
    });

    const calcPriorityWeight = (daysToDue, amount) => {
        const dueWeight = daysToDue < 0
            ? 5
            : (daysToDue <= 2 ? 4 : (daysToDue <= 7 ? 3 : (daysToDue <= 15 ? 2 : 1)));
        return dueWeight * 1000000 + Math.max(0, Number(amount || 0));
    };
    const getRepayActionText = (daysToDue, dueDate, amount, suggestRepayDate) => {
        const safeAmount = Math.max(0, Number(amount || 0));
        const firstRepay = Math.max(0, Number((safeAmount * 0.5).toFixed(2)));
        if (daysToDue < 0) return `今日先还 ${toMoneyText(firstRepay)}，尽快结清 ${toMoneyText(safeAmount)}。`;
        if (daysToDue <= 2) return `建议全额还款 ${toMoneyText(safeAmount)}（最晚 ${formatRuleDate(dueDate)}）。`;
        if (daysToDue <= 7) return `先还 ${toMoneyText(firstRepay)}，${formatRuleDate(suggestRepayDate)} 前还清。`;
        return `账单后可刷卡，${formatRuleDate(suggestRepayDate)} 前还清。`;
    };

    const planRows = [];
    latestByCard.forEach((row) => {
        const dueDate = getBankRepaymentDueDate(row);
        if (!(dueDate instanceof Date) || Number.isNaN(dueDate.getTime())) return;

        const rawAmount = Math.max(0, Number(row?.repaymentAmount || 0));
        const cardKey = buildCardKey(row);
        const rowId = String(row?.id || row?.raw?.id || '').trim();
        const payments = paymentBuckets.get(cardKey) || [];
        const txDate = row?.transactionDate instanceof Date ? row.transactionDate : null;
        const repayWindowEnd = addDaysToDate(dueDate, 45);
        let paidAmount = 0;

        // 优先：按来源账单ID精确抵扣
        payments.forEach((payment) => {
            if (payment.used || !rowId || !payment.sourceId || payment.sourceId !== rowId) return;
            payment.used = true;
            paidAmount += Number(payment.amount || 0);
        });
        // 兜底：按同卡+时间窗口抵扣
        payments.forEach((payment) => {
            if (payment.used) return;
            const payDate = payment?.date instanceof Date ? payment.date : null;
            if (payDate && txDate && payDate.getTime() < addDaysToDate(txDate, -2).getTime()) return;
            if (payDate && payDate.getTime() > repayWindowEnd.getTime()) return;
            if (paidAmount >= rawAmount - 0.0001) return;
            payment.used = true;
            paidAmount += Number(payment.amount || 0);
        });

        const descriptionText = String(row?.description || '').trim();
        const settledByDescription = /(状态[:：]\s*已结清|已还清|账单已结清|当月已还清)/.test(descriptionText);
        const outstandingAmount = Number(Math.max(0, rawAmount - paidAmount).toFixed(2));
        const settled = settledByDescription || outstandingAmount <= 0.0001;

        const nextCycleRecommendation = buildBankCycleRecommendation(addDaysToDate(dueDate, 1), row.billDay, row.repaymentDay);
        if (!nextCycleRecommendation) return;

        const cardLabel = `${row.bank || '未识别'}${row.cardTail ? `（尾号${row.cardTail}）` : ''}`;
        if (settled) {
            const cycleDueDate = nextCycleRecommendation.dueDate;
            const cycleDays = Math.ceil((new Date(cycleDueDate.getFullYear(), cycleDueDate.getMonth(), cycleDueDate.getDate()).getTime() - today.getTime()) / 86400000);
            planRows.push({
                key: `${row.bank || ''}_${row.cardTail || ''}`,
                cardLabel,
                billDay: row.billDay || 0,
                repaymentDay: row.repaymentDay || 0,
                repaymentAmount: 0,
                recommendSwipeStart: nextCycleRecommendation.recommendSwipeStart,
                recommendSwipeEnd: nextCycleRecommendation.recommendSwipeEnd,
                recommendRepayDate: addDaysToDate(cycleDueDate, -2),
                dueDate: cycleDueDate,
                daysToDue: cycleDays,
                urgency: 'cycle',
                priorityWeight: -cycleDays,
                planType: 'cycle',
                actionText: `本期已还清，下期可在 ${formatRuleDate(nextCycleRecommendation.recommendSwipeStart)}~${formatRuleDate(nextCycleRecommendation.recommendSwipeEnd)} 刷卡。`
            });
            return;
        }

        const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate(), 0, 0, 0, 0);
        const daysToDue = Math.ceil((dueDay.getTime() - today.getTime()) / 86400000);
        const urgency = daysToDue < 0 ? 'overdue' : (daysToDue <= 2 ? 'urgent' : (daysToDue <= 7 ? 'soon' : 'normal'));
        const suggestRepayDate = addDaysToDate(dueDate, -2);
        planRows.push({
            key: `${row.bank || ''}_${row.cardTail || ''}`,
            cardLabel,
            billDay: row.billDay || 0,
            repaymentDay: row.repaymentDay || 0,
            repaymentAmount: outstandingAmount,
            recommendSwipeStart: nextCycleRecommendation.recommendSwipeStart,
            recommendSwipeEnd: nextCycleRecommendation.recommendSwipeEnd,
            recommendRepayDate: suggestRepayDate,
            dueDate,
            daysToDue,
            urgency,
            priorityWeight: calcPriorityWeight(daysToDue, outstandingAmount),
            planType: 'repay',
            actionText: getRepayActionText(daysToDue, dueDate, outstandingAmount, suggestRepayDate)
        });
    });

    return planRows.sort((a, b) => {
        if (a.planType !== b.planType) {
            return a.planType === 'repay' ? -1 : 1;
        }
        if (a.planType === 'repay') {
            const weightDiff = b.priorityWeight - a.priorityWeight;
            if (weightDiff !== 0) return weightDiff;
            const dueDiff = a.dueDate.getTime() - b.dueDate.getTime();
            if (dueDiff !== 0) return dueDiff;
            return (b.repaymentAmount || 0) - (a.repaymentAmount || 0);
        }
        const swipeDiff = a.recommendSwipeStart.getTime() - b.recommendSwipeStart.getTime();
        if (swipeDiff !== 0) return swipeDiff;
        return a.dueDate.getTime() - b.dueDate.getTime();
    }).map((item, index) => ({ ...item, priorityRank: index + 1 }));
}

function renderBankSmartPlan() {
    const container = document.getElementById('bankingSmartPlanContent');
    if (!container) return;
    const planRows = buildSmartCardPlanRows();
    if (!planRows.length) {
        container.innerHTML = '暂无可计算建议。请先确保银行业务里有“账单日+还款日”的还款记录。';
        return;
    }

    const repayRows = planRows.filter(item => item.planType === 'repay');
    const cycleRows = planRows.filter(item => item.planType === 'cycle');
    const totalRepay = repayRows.reduce((sum, item) => sum + Number(item?.repaymentAmount || 0), 0);
    const urgentCount = repayRows.filter(item => item.urgency === 'urgent' || item.urgency === 'overdue').length;
    const nearestDue = (repayRows.length ? repayRows : planRows).slice().sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];
    const headerText = repayRows.length >= 2
        ? `优先处理：${safeText(repayRows[0].cardLabel)} → ${safeText(repayRows[1].cardLabel)}`
        : (repayRows.length === 1
            ? `优先处理：${safeText(repayRows[0].cardLabel)}`
            : (cycleRows.length >= 2
                ? `本期已处理完，下一账期刷卡优先：${safeText(cycleRows[0].cardLabel)} → ${safeText(cycleRows[1].cardLabel)}`
                : `本期已处理完，下一账期可优先刷卡：${safeText((cycleRows[0] || planRows[0]).cardLabel)}`));
    const formatRuleDateShort = (date) => {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '-';
        return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    const rowsHtml = planRows.map((item) => {
        const urgencyText = item.urgency === 'overdue'
            ? '已逾期'
            : (item.urgency === 'urgent'
                ? `紧急（${item.daysToDue}天）`
                : (item.urgency === 'soon'
                    ? `临近（${item.daysToDue}天）`
                    : (item.urgency === 'cycle'
                        ? `下期规划（${item.daysToDue}天）`
                        : `正常（${item.daysToDue}天）`)));
        const urgencyStyle = item.urgency === 'overdue'
            ? 'color:#dc2626;'
            : (item.urgency === 'urgent'
                ? 'color:#dc2626;'
                : (item.urgency === 'soon'
                    ? 'color:#d97706;'
                    : (item.urgency === 'cycle' ? 'color:#2563eb;' : 'color:#166534;')));
        return `
            <tr>
                <td><span class="erp-smart-plan-rank ${item.urgency === 'overdue' || item.urgency === 'urgent' ? 'is-danger' : ''}">P${item.priorityRank}</span></td>
                <td>
                    <div class="erp-smart-plan-card-main">${safeText(item.cardLabel)}</div>
                    <div class="erp-smart-plan-card-sub">${item.planType === 'repay' ? `应还：${safeText(toMoneyText(item.repaymentAmount))}` : '状态：本期已还清'}</div>
                </td>
                <td class="erp-smart-plan-date-cell">${safeText(`${item.billDay || '-'}日 / ${item.repaymentDay || '-'}日`)}</td>
                <td class="erp-smart-plan-date-cell">${safeText(formatRuleDate(item.dueDate))}</td>
                <td class="erp-smart-plan-window-cell" title="${safeText(`${formatRuleDate(item.recommendSwipeStart)} ~ ${formatRuleDate(item.recommendSwipeEnd)}`)}">${safeText(`${formatRuleDateShort(item.recommendSwipeStart)} ~ ${formatRuleDateShort(item.recommendSwipeEnd)}`)}</td>
                <td class="erp-smart-plan-date-cell">${safeText(formatRuleDate(item.recommendRepayDate))}</td>
                <td class="erp-smart-plan-urgency-cell"><span style="${urgencyStyle}font-weight:600;">${safeText(urgencyText)}</span></td>
                <td class="erp-smart-plan-action-cell" title="${safeText(item.actionText)}">${safeText(item.actionText)}</td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="erp-smart-plan-headline">${headerText}</div>
        <div class="erp-smart-plan-kpis">
            <span class="erp-smart-plan-kpi">待处理卡数：<strong>${repayRows.length}</strong></span>
            <span class="erp-smart-plan-kpi">下期规划卡数：<strong>${cycleRows.length}</strong></span>
            <span class="erp-smart-plan-kpi">紧急卡数：<strong>${urgentCount}</strong></span>
            <span class="erp-smart-plan-kpi">总应还：<strong>${safeText(toMoneyText(totalRepay))}</strong></span>
            <span class="erp-smart-plan-kpi">最近还款日：<strong>${safeText(formatRuleDate(nearestDue?.dueDate))}</strong></span>
        </div>
        <div class="erp-smart-plan-desc">规则：先按“待还款优先”，再按“紧急程度 + 应还金额”排序；已还清卡自动进入下期刷卡规划。</div>
        <div class="ant-table-wrapper erp-smart-plan-table-wrap">
            <div class="ant-table">
                <table class="erp-smart-plan-table">
                    <thead class="ant-table-thead">
                        <tr>
                            <th>优先级</th>
                            <th>卡片</th>
                            <th>账单/还款日</th>
                            <th>本期还款日</th>
                            <th>推荐刷卡窗口</th>
                            <th>建议还款日</th>
                            <th>紧急程度</th>
                            <th>操作建议</th>
                        </tr>
                    </thead>
                    <tbody class="ant-table-tbody">${rowsHtml}</tbody>
                </table>
            </div>
        </div>
    `;

    const tableWrap = container.querySelector('.erp-smart-plan-table-wrap');
    if (tableWrap) {
        tableWrap.scrollLeft = 0;
    }
}

async function refreshBankSmartPlan() {
    await ERP.loadFinances(true);
    renderBankSmartPlan();
}

async function handleRefreshBankSmartPlan(buttonEl) {
    const button = buttonEl && typeof buttonEl === 'object'
        ? buttonEl
        : document.querySelector('#bankingSmartPlanModal .modal-footer .ant-btn');
    const content = document.getElementById('bankingSmartPlanContent');
    const originalText = button?.textContent || '重新计算';

    if (button) {
        button.disabled = true;
        button.textContent = '计算中...';
    }
    const previousContent = content?.innerHTML || '';
    if (content) {
        content.dataset.reloading = '1';
        content.innerHTML = '<div class="erp-form-hint-card">正在重新为您计算，请稍候...</div>';
    }

    try {
        await refreshBankSmartPlan();
        if (typeof showToast === 'function') {
            showToast('智能倒卡建议已更新', 'success');
        }
    } catch (error) {
        console.error('[ERP Ant] 智能倒卡重新计算失败:', error);
        if (content && previousContent) {
            content.innerHTML = previousContent;
        }
        if (typeof showToast === 'function') {
            showToast(`重新计算失败：${error?.message || '请稍后重试'}`, 'error');
        }
    } finally {
        if (content) {
            delete content.dataset.reloading;
        }
        if (button) {
            button.disabled = false;
            button.textContent = originalText;
        }
    }
}

async function handleRefreshQQMailAuthStatus(buttonEl) {
    const button = buttonEl && typeof buttonEl === 'object'
        ? buttonEl
        : null;
    const originalText = button?.textContent || '刷新授权状态';
    if (button) {
        button.disabled = true;
        button.textContent = '刷新中...';
    }
    try {
        const status = await refreshQQMailAuthStatus(true);
        if (typeof showToast === 'function') {
            showToast(status ? '授权状态已更新' : '未获取到授权状态', status ? 'success' : 'info');
        }
    } catch (error) {
        console.error('[ERP Ant] 刷新授权状态失败:', error);
        if (typeof showToast === 'function') {
            showToast(`刷新授权状态失败：${error?.message || '请稍后重试'}`, 'error');
        }
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText;
        }
    }
}

async function showBankSmartPlanModal() {
    const modal = document.getElementById('bankingSmartPlanModal');
    const content = document.getElementById('bankingSmartPlanContent');
    if (!modal) return;
    if (content) {
        content.textContent = '正在生成建议...';
    }
    modal.classList.add('active');
    modal.style.display = 'flex';
    try {
        await refreshBankSmartPlan();
    } catch (error) {
        if (content) {
            content.textContent = '生成建议失败，请稍后重试。';
        }
    }
}

function hideBankSmartPlanModal() {
    const modal = document.getElementById('bankingSmartPlanModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.style.display = '';
}

function isBankSmartPlanModalVisible() {
    const modal = document.getElementById('bankingSmartPlanModal');
    if (!modal) return false;
    return modal.classList.contains('active') || modal.style.display === 'flex';
}

async function refreshBankSmartPlanIfVisible() {
    if (!isBankSmartPlanModalVisible()) {
        return;
    }
    try {
        await refreshBankSmartPlan();
    } catch (error) {
        console.error('[ERP Ant] 智能倒卡自动刷新失败:', error);
    }
}

function recalculateBankBusinessFee() {
    const swipeInput = document.getElementById('bankingSwipeAmount');
    const actualInput = document.getElementById('bankingActualAmount');
    const feeInput = document.getElementById('bankingFeeAmount');
    const feeRateInput = document.getElementById('bankingFeeRate');
    if (!swipeInput || !actualInput || !feeInput) return;
    const swipe = Math.max(0, toAmount(swipeInput.value, 0));
    const actual = Math.max(0, toAmount(actualInput.value, 0));
    const fee = Math.max(0, swipe - actual);
    feeInput.value = fee.toFixed(2);
    if (feeRateInput) {
        const rate = swipe > 0 ? (fee / swipe) * 100 : 0;
        feeRateInput.value = `${rate.toFixed(2)}%`;
    }
}

function getMonthlyDateByDay(baseDate, day, monthOffset = 0) {
    const target = new Date(baseDate.getFullYear(), baseDate.getMonth() + monthOffset, 1, 9, 0, 0, 0);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(Math.max(1, day), lastDay));
    return target;
}

function getUpcomingMonthlyDate(baseDate, day) {
    const thisMonth = getMonthlyDateByDay(baseDate, day, 0);
    const baseDayStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0, 0, 0);
    const thisMonthDayStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), thisMonth.getDate(), 0, 0, 0, 0);
    if (baseDayStart.getTime() <= thisMonthDayStart.getTime()) {
        return thisMonth;
    }
    return getMonthlyDateByDay(baseDate, day, 1);
}

function addDaysToDate(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + Number(days || 0));
    return next;
}

function formatRuleDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return '-';
    }
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildBankCycleRecommendation(baseDateRaw, billDayRaw, repaymentDayRaw) {
    const billDay = toValidDay(billDayRaw, 0);
    const repaymentDay = toValidDay(repaymentDayRaw, 0);
    if (!billDay || !repaymentDay) {
        return null;
    }

    const baseDate = parseFinanceDate(baseDateRaw) || new Date();
    const nextBillDate = getUpcomingMonthlyDate(baseDate, billDay);
    const recommendSwipeStart = addDaysToDate(nextBillDate, 1);
    const recommendSwipeEnd = addDaysToDate(nextBillDate, 5);
    const dueDate = repaymentDay > billDay
        ? getMonthlyDateByDay(nextBillDate, repaymentDay, 0)
        : getMonthlyDateByDay(nextBillDate, repaymentDay, 1);
    const recommendRepayDate = addDaysToDate(dueDate, -2);
    const remindSuggestDate = addDaysToDate(dueDate, -3);

    return {
        billDay,
        repaymentDay,
        nextBillDate,
        recommendSwipeStart,
        recommendSwipeEnd,
        dueDate,
        recommendRepayDate,
        remindSuggestDate
    };
}

function updateBankingRuleHint() {
    const hintEl = document.getElementById('bankingRuleHint');
    if (!hintEl) return;

    const billDay = document.getElementById('bankingRepaymentBillDay')?.value;
    const repaymentDay = document.getElementById('bankingRepaymentDay')?.value;
    const transactionDate = document.getElementById('bankingRepaymentTransactionDate')?.value;
    const repaymentAmount = Math.max(0, toAmount(document.getElementById('bankingRepaymentAmount')?.value, 0));
    const recommendation = buildBankCycleRecommendation(transactionDate, billDay, repaymentDay);

    if (!recommendation) {
        hintEl.textContent = '规则建议：请先填写账单日与还款日，系统将自动推荐最佳刷卡时间与还款时间。';
        return;
    }

    hintEl.innerHTML = [
        `规则建议：账单日后刷卡更容易拿到更长免息期。`,
        repaymentAmount > 0 ? `本期应还金额：${toMoneyText(repaymentAmount)}。` : '本期应还金额：未填写。',
        `推荐刷卡窗口：${formatRuleDate(recommendation.recommendSwipeStart)} 至 ${formatRuleDate(recommendation.recommendSwipeEnd)}。`,
        `下次账单日：${formatRuleDate(recommendation.nextBillDate)}；下次还款日：${formatRuleDate(recommendation.dueDate)}。`,
        `推荐还款时间：${formatRuleDate(recommendation.recommendRepayDate)}（建议至少提前 2 天），提醒可设在 ${formatRuleDate(recommendation.remindSuggestDate)}。`
    ].join('<br>');
}

function getNowDateTimeLocalValue() {
    return getShanghaiDateTimeInputValue(new Date());
}

function resetBankRepaymentQuickState() {
    bankRepaymentQuickState.active = false;
    bankRepaymentQuickState.sourceFinanceId = null;
    bankRepaymentQuickState.sourceOutstanding = 0;
    bankRepaymentQuickState.sourceSnapshot = null;
}

function setRepaymentFieldGroupVisible(fieldId, visible) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    const group = field.closest('.form-group');
    if (group) {
        group.style.display = visible ? '' : 'none';
    }
}

function setRepaymentGridVisible(fieldId, visible) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    const grid = field.closest('.erp-form-grid-2');
    if (grid) {
        grid.style.display = visible ? '' : 'none';
    }
}

function toggleBankRepaymentQuickMode(enabled, context = {}) {
    const modal = document.getElementById('bankingRepaymentModal');
    const amountInput = document.getElementById('bankingRepaymentAmount');
    const ruleHintEl = document.getElementById('bankingRuleHint');
    if (!modal || !amountInput) return;

    setRepaymentFieldGroupVisible('bankingRepaymentTransactionDate', !enabled);
    setRepaymentFieldGroupVisible('bankingRepaymentCardBank', !enabled);
    setRepaymentFieldGroupVisible('bankingRepaymentCardTail', !enabled);
    setRepaymentGridVisible('bankingRepaymentBillDay', !enabled);
    setRepaymentGridVisible('bankingRepaymentReminderEnabled', !enabled);
    setRepaymentFieldGroupVisible('bankingRepaymentDescription', !enabled);

    const amountLabel = amountInput.closest('.form-group')?.querySelector('label');
    if (amountLabel) {
        amountLabel.innerHTML = enabled
            ? '本次还款金额 <span class="erp-required-star">*</span>'
            : '应还金额 <span class="erp-required-star">*</span>';
    }

    if (ruleHintEl) {
        ruleHintEl.style.display = '';
        if (enabled) {
            const outstanding = Math.max(0, Number(context.outstanding || 0));
            ruleHintEl.textContent = `当前应还：${toMoneyText(outstanding)}。请输入本次还款金额，可部分还款或一次还清，保存后自动扣减应还金额。`;
        } else {
            updateBankingRuleHint();
        }
    }
    amountInput.placeholder = enabled ? '请输入本次还款金额（支持部分还款）' : '本期需还金额';
}

function showBankRepaymentModal(prefill = null, options = {}) {
    const modal = document.getElementById('bankingRepaymentModal');
    const form = document.getElementById('bankingRepaymentForm');
    if (!modal || !form) {
        return;
    }
    form.reset();

    document.getElementById('bankingRepaymentTransactionDate').value = getNowDateTimeLocalValue();
    document.getElementById('bankingRepaymentBillDay').value = '20';
    document.getElementById('bankingRepaymentDay').value = '5';
    document.getElementById('bankingRepaymentReminderEnabled').value = '1';
    document.getElementById('bankingRepaymentReminderDaysBefore').value = '3';
    document.getElementById('bankingRepaymentAmount').value = '';
    document.getElementById('bankingRepaymentCardTail').value = '';
    populateCreditCardBanks('bankingRepaymentCardBank', { includeKnownCardTail: true });
    if (form.dataset.bindRuleListener !== '1') {
        document.getElementById('bankingRepaymentBillDay')?.addEventListener('input', updateBankingRuleHint);
        document.getElementById('bankingRepaymentDay')?.addEventListener('input', updateBankingRuleHint);
        document.getElementById('bankingRepaymentTransactionDate')?.addEventListener('change', updateBankingRuleHint);
        document.getElementById('bankingRepaymentAmount')?.addEventListener('input', updateBankingRuleHint);
        form.dataset.bindRuleListener = '1';
    }
    if (form.dataset.bindBankTailListener !== '1') {
        document.getElementById('bankingRepaymentCardBank')?.addEventListener('change', () => {
            syncTailInputByBankSelect('bankingRepaymentCardBank', 'bankingRepaymentCardTail');
        });
        form.dataset.bindBankTailListener = '1';
    }

    const titleEl = modal.querySelector('.modal-header h3');
    const saveBtn = modal.querySelector('.modal-footer .ant-btn-primary');
    const isQuickRepay = options?.quickRepay === true;
    const isEdit = options?.mode === 'edit' || (!!prefill && options?.mode !== 'create' && !!prefill.id);
    if (isEdit && prefill) {
        bankBusinessEditState.financeId = prefill.id || null;
        bankBusinessEditState.mode = 'repayment';
        bankBusinessEditState.cardTail = String(prefill.cardTail || '').trim();
        if (titleEl) titleEl.textContent = '修改还款业务';
        if (saveBtn) saveBtn.textContent = '保存修改';
        document.getElementById('bankingRepaymentTransactionDate').value = prefill.transactionDate
            ? `${prefill.transactionDate.getFullYear()}-${String(prefill.transactionDate.getMonth() + 1).padStart(2, '0')}-${String(prefill.transactionDate.getDate()).padStart(2, '0')}T${String(prefill.transactionDate.getHours()).padStart(2, '0')}:${String(prefill.transactionDate.getMinutes()).padStart(2, '0')}`
            : getNowDateTimeLocalValue();
        setSelectValueWithFallback(
            'bankingRepaymentCardBank',
            buildBankCardOptionValue(prefill.bank || '', prefill.cardTail || ''),
            prefill.bank || ''
        );
        document.getElementById('bankingRepaymentCardTail').value = normalizeTail4(prefill.cardTail || '');
        document.getElementById('bankingRepaymentBillDay').value = prefill.billDay || '';
        document.getElementById('bankingRepaymentDay').value = prefill.repaymentDay || '';
        document.getElementById('bankingRepaymentReminderEnabled').value = prefill.reminderEnabled ? '1' : '0';
        document.getElementById('bankingRepaymentReminderDaysBefore').value = String(Math.max(0, Number(prefill.reminderDaysBefore || 0)));
        document.getElementById('bankingRepaymentAmount').value = Number(prefill.repaymentAmount || 0) > 0 ? String(prefill.repaymentAmount) : '';
        document.getElementById('bankingRepaymentDescription').value = prefill.description && prefill.description !== '-' ? prefill.description : '';
    } else if (prefill) {
        const prefillDate = prefill.transactionDate instanceof Date && !Number.isNaN(prefill.transactionDate.getTime())
            ? prefill.transactionDate
            : new Date();
        document.getElementById('bankingRepaymentTransactionDate').value = `${prefillDate.getFullYear()}-${String(prefillDate.getMonth() + 1).padStart(2, '0')}-${String(prefillDate.getDate()).padStart(2, '0')}T${String(prefillDate.getHours()).padStart(2, '0')}:${String(prefillDate.getMinutes()).padStart(2, '0')}`;
        setSelectValueWithFallback(
            'bankingRepaymentCardBank',
            buildBankCardOptionValue(prefill.bank || '', prefill.cardTail || ''),
            prefill.bank || ''
        );
        document.getElementById('bankingRepaymentCardTail').value = normalizeTail4(prefill.cardTail || '');
        document.getElementById('bankingRepaymentBillDay').value = prefill.billDay || '20';
        document.getElementById('bankingRepaymentDay').value = prefill.repaymentDay || '5';
        document.getElementById('bankingRepaymentReminderEnabled').value = prefill.reminderEnabled === false ? '0' : '1';
        document.getElementById('bankingRepaymentReminderDaysBefore').value = String(Math.max(0, Number(prefill.reminderDaysBefore || 3)));
        document.getElementById('bankingRepaymentAmount').value = Number(prefill.repaymentAmount || 0) > 0 ? String(prefill.repaymentAmount) : '';
        document.getElementById('bankingRepaymentDescription').value = prefill.description && prefill.description !== '-' ? String(prefill.description) : '';
        bankBusinessEditState.financeId = null;
        bankBusinessEditState.mode = '';
        bankBusinessEditState.cardTail = '';
        if (titleEl) titleEl.textContent = isQuickRepay ? '登记还款' : '新增还款业务';
        if (saveBtn) saveBtn.textContent = isQuickRepay ? '确认还款' : '保存';
        if (isQuickRepay) {
            bankRepaymentQuickState.active = true;
            bankRepaymentQuickState.sourceFinanceId = prefill.id ?? null;
            bankRepaymentQuickState.sourceOutstanding = Math.max(0, Number(prefill.repaymentAmount || 0));
            bankRepaymentQuickState.sourceSnapshot = cloneQuickRepaymentSourceSnapshot(prefill);
        }
    } else {
        bankBusinessEditState.financeId = null;
        bankBusinessEditState.mode = '';
        bankBusinessEditState.cardTail = '';
        if (titleEl) titleEl.textContent = isQuickRepay ? '登记还款' : '新增还款业务';
        if (saveBtn) saveBtn.textContent = isQuickRepay ? '确认还款' : '保存';
    }

    if (isQuickRepay) {
        toggleBankRepaymentQuickMode(true, { outstanding: bankRepaymentQuickState.sourceOutstanding });
        const amountInput = document.getElementById('bankingRepaymentAmount');
        if (amountInput && Number(bankRepaymentQuickState.sourceOutstanding) > 0) {
            amountInput.value = String(bankRepaymentQuickState.sourceOutstanding);
        }
    } else {
        toggleBankRepaymentQuickMode(false);
        resetBankRepaymentQuickState();
    }

    if (!isQuickRepay) {
        updateBankingRuleHint();
    }
    clearModalFieldValidation('bankingRepaymentModal');
    modal.classList.add('active');
    modal.style.display = 'flex';
}

function hideBankRepaymentModal() {
    const modal = document.getElementById('bankingRepaymentModal');
    if (!modal) return;
    if (bankBusinessEditState.mode === 'repayment') {
        bankBusinessEditState.financeId = null;
        bankBusinessEditState.mode = '';
        bankBusinessEditState.cardTail = '';
    }
    toggleBankRepaymentQuickMode(false);
    resetBankRepaymentQuickState();
    modal.classList.remove('active');
    modal.style.display = '';
}

function showBankSwipeModal(prefill = null) {
    const modal = document.getElementById('bankingSwipeModal');
    const form = document.getElementById('bankingSwipeForm');
    if (!modal || !form) {
        return;
    }
    form.reset();

    document.getElementById('bankingSwipeTransactionDate').value = getNowDateTimeLocalValue();
    document.getElementById('bankingFeeAmount').value = '0.00';
    document.getElementById('bankingFeeRate').value = '0.00%';
    document.getElementById('bankingSwipeCardTail').value = '';
    document.getElementById('bankingSettlementCardTail').value = '';
    populateCreditCardBanks('bankingSwipeCardBank', { includeKnownCardTail: true });
    populateCreditCardBanks('bankingSettlementBank', { includeKnownCardTail: true });

    if (form.dataset.bindFeeListener !== '1') {
        document.getElementById('bankingSwipeAmount')?.addEventListener('input', recalculateBankBusinessFee);
        document.getElementById('bankingActualAmount')?.addEventListener('input', recalculateBankBusinessFee);
        form.dataset.bindFeeListener = '1';
    }
    if (form.dataset.bindBankTailListener !== '1') {
        document.getElementById('bankingSwipeCardBank')?.addEventListener('change', () => {
            syncTailInputByBankSelect('bankingSwipeCardBank', 'bankingSwipeCardTail');
        });
        document.getElementById('bankingSettlementBank')?.addEventListener('change', () => {
            syncTailInputByBankSelect('bankingSettlementBank', 'bankingSettlementCardTail');
        });
        form.dataset.bindBankTailListener = '1';
    }

    const titleEl = modal.querySelector('.modal-header h3');
    const saveBtn = modal.querySelector('.modal-footer .ant-btn-primary');
    if (prefill) {
        bankBusinessEditState.financeId = prefill.id || null;
        bankBusinessEditState.mode = 'swipe';
        bankBusinessEditState.cardTail = String(prefill.cardTail || '').trim();
        if (titleEl) titleEl.textContent = '修改刷卡业务';
        if (saveBtn) saveBtn.textContent = '保存修改';
        document.getElementById('bankingSwipeTransactionDate').value = prefill.transactionDate
            ? `${prefill.transactionDate.getFullYear()}-${String(prefill.transactionDate.getMonth() + 1).padStart(2, '0')}-${String(prefill.transactionDate.getDate()).padStart(2, '0')}T${String(prefill.transactionDate.getHours()).padStart(2, '0')}:${String(prefill.transactionDate.getMinutes()).padStart(2, '0')}`
            : getNowDateTimeLocalValue();
        setSelectValueWithFallback(
            'bankingSwipeCardBank',
            buildBankCardOptionValue(prefill.swipeCardBank || prefill.bank || '', prefill.cardTail || ''),
            prefill.swipeCardBank || prefill.bank || ''
        );
        document.getElementById('bankingSwipeCardTail').value = normalizeTail4(prefill.cardTail || '');
        setSelectValueWithFallback(
            'bankingSettlementBank',
            prefill.settlementBank && prefill.settlementBank !== '未识别'
                ? buildBankCardOptionValue(prefill.settlementBank, prefill.settlementCardTail || '')
                : '',
            prefill.settlementBank && prefill.settlementBank !== '未识别' ? prefill.settlementBank : ''
        );
        document.getElementById('bankingSettlementCardTail').value = prefill.settlementCardTail || '';
        document.getElementById('bankingSwipeAmount').value = Number(prefill.swipeAmount || 0) > 0 ? String(prefill.swipeAmount) : '';
        document.getElementById('bankingActualAmount').value = Number(prefill.actualAmount || 0) > 0 ? String(prefill.actualAmount) : '';
        document.getElementById('bankingSwipeDescription').value = prefill.description && prefill.description !== '-' ? prefill.description : '';
        recalculateBankBusinessFee();
    } else {
        bankBusinessEditState.financeId = null;
        bankBusinessEditState.mode = '';
        bankBusinessEditState.cardTail = '';
        if (titleEl) titleEl.textContent = '新增刷卡业务';
        if (saveBtn) saveBtn.textContent = '保存';
    }

    clearModalFieldValidation('bankingSwipeModal');
    modal.classList.add('active');
    modal.style.display = 'flex';
}

function hideBankSwipeModal() {
    const modal = document.getElementById('bankingSwipeModal');
    if (!modal) return;
    if (bankBusinessEditState.mode === 'swipe') {
        bankBusinessEditState.financeId = null;
        bankBusinessEditState.mode = '';
        bankBusinessEditState.cardTail = '';
    }
    modal.classList.remove('active');
    modal.style.display = '';
}

function showBankEmailImportModal() {
    const modal = document.getElementById('bankingEmailImportModal');
    const form = document.getElementById('bankingEmailImportForm');
    if (!modal || !form) return;
    form.reset();
    const previewEl = document.getElementById('bankingEmailImportPreview');
    if (previewEl) {
        previewEl.textContent = '暂未解析，请先粘贴账单内容后点击“解析预览”。';
    }
    const reminderInput = document.getElementById('bankingEmailReminderDaysBefore');
    if (reminderInput) reminderInput.value = '3';
    bankEmailImportPreviewData = null;
    clearModalFieldValidation('bankingEmailImportModal');
    modal.classList.add('active');
    modal.style.display = 'flex';
}

function hideBankEmailImportModal() {
    const modal = document.getElementById('bankingEmailImportModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.style.display = '';
}

function maskQQEmail(value) {
    const email = String(value || '').trim();
    if (!email || !email.includes('@')) return '';
    const [name, domain] = email.split('@');
    if (!name) return `***@${domain || ''}`;
    if (name.length <= 2) return `${name[0] || '*'}***@${domain || ''}`;
    return `${name.slice(0, 2)}***@${domain || ''}`;
}

function getQQMailSyncStatusLabel(value) {
    const status = String(value || '').trim().toLowerCase();
    if (!status) return '';
    if (status === 'success') return '成功';
    if (status === 'partial') return '部分成功';
    if (status === 'failed') return '失败';
    if (status === 'unknown') return '未知';
    return status;
}

function renderQQMailAuthStatus(statusData = null) {
    const statusTextEl = document.getElementById('qqMailAuthStatusText');
    const hintEl = document.getElementById('qqMailAuthHint');
    if (!statusTextEl) return;

    const enabled = !!statusData?.is_enabled;
    const email = String(statusData?.email_address || '').trim();
    const masked = email ? maskQQEmail(email) : '';
    if (enabled && masked) {
        const lastSyncAt = statusData?.last_sync_at ? toDateTimeText(statusData.last_sync_at) : '';
        const lastSyncStatus = getQQMailSyncStatusLabel(statusData?.last_sync_status);
        const syncMsg = String(statusData?.last_sync_message || '').trim();
        const hasSyncRecord = !!(lastSyncAt || lastSyncStatus || syncMsg);
        const syncSuffix = hasSyncRecord
            ? `，最近同步：${lastSyncAt || '时间未知'}${lastSyncStatus ? `（${lastSyncStatus}）` : ''}`
            : '，尚未执行自动同步（请先在 GitHub Actions 手动运行一次 qq-mail-sync）';
        statusTextEl.textContent = `已授权（${masked}）${syncSuffix}`;
        statusTextEl.style.color = '#15803d';
        if (hintEl) {
            hintEl.textContent = syncMsg
                ? `当前授权账号：${masked}；最近结果：${syncMsg}`
                : hasSyncRecord
                    ? `当前授权账号：${masked}，自动同步已启用。`
                    : `当前授权账号：${masked}，请先在仓库 Actions 手动执行一次 qq-mail-sync 验证链路。`;
        }
    } else if (email) {
        statusTextEl.textContent = `已配置但已停用（${masked || email}）`;
        statusTextEl.style.color = '#b45309';
        if (hintEl) hintEl.textContent = '当前授权已停用，可重新启用自动同步。';
    } else {
        statusTextEl.textContent = '未授权';
        statusTextEl.style.color = '#64748b';
        if (hintEl) hintEl.textContent = '保存后，GitHub Actions 会按计划自动读取账单并导入银行业务。';
    }
}

async function invokeQQMailAuthFunction(action, payload = {}) {
    if (typeof supabaseClient === 'undefined') {
        throw new Error('Supabase 客户端未初始化');
    }
    const currentUserId = typeof getCurrentERPUserId === 'function'
        ? getCurrentERPUserId()
        : String(window?.userData?.user?.id || '').trim();
    const response = await supabaseClient.functions.invoke('qq-mail-auth', {
        body: {
            action,
            user_id: currentUserId || undefined,
            ...payload
        }
    });
    if (response.error) {
        throw response.error;
    }
    const data = response.data || {};
    if (data.ok === false) {
        throw new Error(data.message || '请求失败');
    }
    return data;
}

async function refreshQQMailAuthStatus(force = false) {
    if (!force && qqMailAuthViewState.loaded && qqMailAuthViewState.status) {
        renderQQMailAuthStatus(qqMailAuthViewState.status);
        return qqMailAuthViewState.status;
    }
    try {
        const data = await invokeQQMailAuthFunction('status');
        qqMailAuthViewState.loaded = true;
        qqMailAuthViewState.status = data.data || null;
        renderQQMailAuthStatus(qqMailAuthViewState.status);
        return qqMailAuthViewState.status;
    } catch (error) {
        qqMailAuthViewState.loaded = true;
        qqMailAuthViewState.status = null;
        renderQQMailAuthStatus(null);
        const statusTextEl = document.getElementById('qqMailAuthStatusText');
        if (statusTextEl) {
            statusTextEl.textContent = '授权功能未就绪';
            statusTextEl.style.color = '#b91c1c';
        }
        return null;
    }
}

function showQQMailAuthModal() {
    const modal = document.getElementById('qqMailAuthModal');
    const form = document.getElementById('qqMailAuthForm');
    if (!modal || !form) return;
    form.reset();
    const status = qqMailAuthViewState.status || null;
    const emailInput = document.getElementById('qqMailAuthEmail');
    const hostInput = document.getElementById('qqMailImapHost');
    const portInput = document.getElementById('qqMailImapPort');
    const enabledInput = document.getElementById('qqMailAuthEnabled');
    const codeInput = document.getElementById('qqMailAuthCode');
    if (emailInput && status?.email_address) emailInput.value = status.email_address;
    if (hostInput) hostInput.value = status?.imap_host || 'imap.qq.com';
    if (portInput) portInput.value = String(status?.imap_port || 993);
    if (enabledInput) enabledInput.checked = !!status?.is_enabled;
    if (codeInput) codeInput.value = '';
    renderQQMailAuthStatus(status);
    clearModalFieldValidation('qqMailAuthModal');
    modal.classList.add('active');
    modal.style.display = 'flex';
}

function hideQQMailAuthModal() {
    const modal = document.getElementById('qqMailAuthModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.style.display = '';
}

async function saveQQMailAuthConfig() {
    clearModalFieldValidation('qqMailAuthModal');
    const email = String(document.getElementById('qqMailAuthEmail')?.value || '').trim();
    const authCode = String(document.getElementById('qqMailAuthCode')?.value || '').trim();
    const imapHost = String(document.getElementById('qqMailImapHost')?.value || 'imap.qq.com').trim() || 'imap.qq.com';
    const imapPort = Math.max(1, Math.min(65535, Math.floor(toAmount(document.getElementById('qqMailImapPort')?.value, 993))));
    const isEnabled = !!document.getElementById('qqMailAuthEnabled')?.checked;

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        markFieldInvalid('qqMailAuthEmail', '请输入有效的邮箱地址');
        return;
    }
    if (!authCode) {
        markFieldInvalid('qqMailAuthCode', '请输入QQ邮箱IMAP授权码');
        return;
    }

    const saveBtn = document.querySelector('#qqMailAuthModal .ant-btn-primary');
    const originalText = saveBtn?.textContent || '';
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';
    }

    try {
        await invokeQQMailAuthFunction('save', {
            email_address: email,
            auth_code: authCode,
            imap_host: imapHost,
            imap_port: imapPort,
            is_enabled: isEnabled
        });
        await refreshQQMailAuthStatus(true);
        hideQQMailAuthModal();
        showToast('QQ邮箱授权保存成功', 'success');
    } catch (error) {
        console.error('[ERP Ant] 保存QQ邮箱授权失败:', error);
        showToast('保存授权失败：' + (error?.message || '未知错误'), 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    }
}

async function disableQQMailAuth() {
    const actionBtn = document.querySelector('#qqMailAuthModal .ant-btn');
    const originalText = actionBtn?.textContent || '';
    if (actionBtn) {
        actionBtn.disabled = true;
        actionBtn.textContent = '停用中...';
    }
    try {
        await invokeQQMailAuthFunction('disable');
        await refreshQQMailAuthStatus(true);
        hideQQMailAuthModal();
        showToast('QQ邮箱授权已停用', 'success');
    } catch (error) {
        console.error('[ERP Ant] 停用QQ邮箱授权失败:', error);
        showToast('停用失败：' + (error?.message || '未知错误'), 'error');
    } finally {
        if (actionBtn) {
            actionBtn.disabled = false;
            actionBtn.textContent = originalText;
        }
    }
}

const BANK_PDF_JS_CDN_LIST = [
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js',
    'https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.min.js'
];

const BANK_PDF_WORKER_CDN_LIST = [
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js',
    'https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.worker.min.js'
];

let bankPdfJsLoaderPromise = null;

function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
        const existing = Array.from(document.querySelectorAll('script[src]'))
            .find(node => String(node.src || '').includes(src));
        if (existing) {
            if (existing.dataset.loaded === 'true') {
                resolve();
                return;
            }
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error(`脚本加载失败: ${src}`)), { once: true });
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => {
            script.dataset.loaded = 'true';
            resolve();
        };
        script.onerror = () => reject(new Error(`脚本加载失败: ${src}`));
        document.head.appendChild(script);
    });
}

async function ensureBankPdfJsReady() {
    if (window.pdfjsLib) {
        if (!window.pdfjsLib.GlobalWorkerOptions?.workerSrc) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = BANK_PDF_WORKER_CDN_LIST[0];
        }
        return window.pdfjsLib;
    }
    if (bankPdfJsLoaderPromise) {
        return bankPdfJsLoaderPromise;
    }
    bankPdfJsLoaderPromise = (async () => {
        let lastError = null;
        for (let i = 0; i < BANK_PDF_JS_CDN_LIST.length; i += 1) {
            const scriptSrc = BANK_PDF_JS_CDN_LIST[i];
            try {
                await loadScriptOnce(scriptSrc);
                if (!window.pdfjsLib) {
                    throw new Error('PDF 引擎初始化失败');
                }
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = BANK_PDF_WORKER_CDN_LIST[i] || BANK_PDF_WORKER_CDN_LIST[0];
                return window.pdfjsLib;
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError || new Error('PDF 引擎加载失败');
    })();
    return bankPdfJsLoaderPromise;
}

async function extractTextFromBankPdfFile(file) {
    const pdfjsLib = await ensureBankPdfJsReady();
    const rawData = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: rawData });
    const pdfDocument = await loadingTask.promise;
    const pageCount = Number(pdfDocument.numPages || 0);
    const maxPages = Math.min(pageCount, 30);
    const blocks = [];
    for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
        const page = await pdfDocument.getPage(pageNo);
        const textContent = await page.getTextContent();
        const textLine = Array.isArray(textContent?.items)
            ? textContent.items.map(item => String(item?.str || '').trim()).filter(Boolean).join(' ')
            : '';
        if (textLine) blocks.push(textLine);
    }
    try {
        await loadingTask.destroy();
    } catch (_) {
        // ignore
    }
    return {
        pageCount,
        text: normalizeEmailStatementText(blocks.join('\n'))
    };
}

async function onBankEmailStatementFileChange(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;
    const textArea = document.getElementById('bankingEmailStatementText');
    if (!textArea) return;
    try {
        const name = String(file.name || '').toLowerCase();
        const isPdf = name.endsWith('.pdf') || String(file.type || '').toLowerCase().includes('pdf');
        let parsedText = '';
        let parsedHint = '';
        if (isPdf) {
            const pdfResult = await extractTextFromBankPdfFile(file);
            parsedText = String(pdfResult?.text || '');
            parsedHint = `（PDF ${Math.max(0, Number(pdfResult?.pageCount || 0))} 页）`;
        } else {
            const rawText = await file.text();
            parsedText = normalizeEmailStatementText(rawText);
        }

        if (!parsedText || parsedText.length < 8) {
            showToast('文件内容为空或为图片型PDF，请先OCR后再导入', 'error');
            return;
        }

        textArea.value = parsedText;
        bankEmailImportPreviewData = null;
        const previewEl = document.getElementById('bankingEmailImportPreview');
        if (previewEl) {
            previewEl.textContent = `文件已加载：${file.name}${parsedHint}，请点击“解析预览”。`;
        }
    } catch (error) {
        console.error('[ERP Ant] 读取邮箱账单文件失败:', error);
        showToast('读取文件失败，请检查文件内容或网络后重试', 'error');
    }
}

function normalizeEmailStatementText(rawText) {
    let text = String(rawText || '');
    text = text.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<\/div>/gi, '\n');
    if (typeof document !== 'undefined') {
        const decoder = document.createElement('textarea');
        decoder.innerHTML = text;
        text = decoder.value;
    }
    text = text.replace(/<[^>]+>/g, ' ');
    text = text.replace(/\r/g, '\n');
    text = text.replace(/[ \t]+/g, ' ');
    text = text.replace(/\n{3,}/g, '\n\n');
    return text.trim();
}

function parseMoneyToken(value) {
    const source = String(value || '');
    const cleaned = source
        .replace(/[,，\s]/g, '')
        .replace(/(?:CNY|RMB|USD|HKD|元|人民币)/gi, '')
        .replace(/[¥￥]/g, '');
    const numeric = cleaned.match(/-?\d+(?:\.\d+)?/);
    const amount = Number(numeric ? numeric[0] : NaN);
    return Number.isFinite(amount) ? amount : NaN;
}

function matchMoneyByPatterns(text, patterns = []) {
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match || !match[1]) continue;
        const amount = parseMoneyToken(match[1]);
        if (Number.isFinite(amount)) return amount;
    }
    return NaN;
}

function parseDateToken(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    let normalized = raw.replace(/年/g, '-').replace(/月/g, '-').replace(/日/g, '').replace(/\./g, '-').replace(/\//g, '-');
    normalized = normalized.replace(/\s+/g, '');

    let match = normalized.match(/(20\d{2})(\d{2})(\d{2})/);
    if (match) {
        const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 9, 0, 0);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    match = normalized.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
    if (match) {
        const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 9, 0, 0);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    match = normalized.match(/(\d{1,2})-(\d{1,2})/);
    if (match) {
        const now = new Date();
        const date = new Date(now.getFullYear(), Number(match[1]) - 1, Number(match[2]), 9, 0, 0);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
}

function matchDateByPatterns(text, patterns = []) {
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match || !match[1]) continue;
        const date = parseDateToken(match[1]);
        if (date) return date;
    }
    return null;
}

function detectBankNameFromText(text) {
    const sourceText = String(text || '');
    const compactText = sourceText.replace(/\s+/g, '');
    const exact = ERP_CREDIT_CARD_BANKS.find(name => {
        if (!name) return false;
        const compactName = String(name).replace(/\s+/g, '');
        return sourceText.includes(name) || compactText.includes(compactName);
    });
    if (exact) return exact;

    const aliasMap = [
        { regex: /(浦东发展银行|上海浦东发展银行|浦发银行|浦发信用卡|SPDB)/i, name: '浦发银行' },
        { regex: /(中信银行|中信信用卡|中信银行信用卡中心|CITIC)/i, name: '中信银行' },
        { regex: /(中国民生银行|民生银行|民生信用卡|CMBC)/i, name: '中国民生银行' },
        { regex: /(中国光大银行|光大银行|光大信用卡|CEB)/i, name: '光大银行' },
        { regex: /(招商银行|招行信用卡|CMB)/i, name: '招商银行' },
        { regex: /(交通银行|交行信用卡|BCM)/i, name: '交通银行' },
        { regex: /(中国建设银行|建设银行|建行信用卡|CCB)/i, name: '中国建设银行' },
        { regex: /(中国银行|中银信用卡|BOC)/i, name: '中国银行' },
        { regex: /(中国工商银行|工商银行|工行信用卡|ICBC)/i, name: '中国工商银行' },
        { regex: /(中国农业银行|农业银行|农行信用卡|ABC)/i, name: '中国农业银行' },
        { regex: /(平安银行|平安信用卡|PAB)/i, name: '平安银行' },
        { regex: /(华夏银行|华夏信用卡)/i, name: '华夏银行' }
    ];
    for (const item of aliasMap) {
        if (item.regex.test(sourceText) || item.regex.test(compactText)) {
            return item.name;
        }
    }

    const match = compactText.match(/([^，。；、:：\s]{2,18}银行)/);
    return match ? String(match[1]).trim() : '';
}

function detectBankBusinessModeByText(text) {
    const sourceText = String(text || '');
    const swipeSignals = ['刷卡金额', '刷卡：', '到账金额', '到账卡', '手续费', '费率'];
    const repaymentSignals = ['本期应还', '应还金额', '最后还款日', '账单日', '信用卡账单'];
    const hasSwipeSignal = swipeSignals.some(keyword => sourceText.includes(keyword));
    const hasRepaymentSignal = repaymentSignals.some(keyword => sourceText.includes(keyword));
    if (hasSwipeSignal && !hasRepaymentSignal) return 'swipe';
    return 'repayment';
}

function extractCardTailFromText(text) {
    const source = String(text || '');
    if (!source) return '';
    const scoreMap = new Map();
    const addCandidate = (tail, score = 1) => {
        const value = String(tail || '').replace(/\D/g, '').slice(-4);
        if (!/^\d{4}$/.test(value)) return;
        scoreMap.set(value, (scoreMap.get(value) || 0) + score);
    };

    const maskedCardPatterns = [
        /(?:卡号|Card\s*Number|Card\s*No\.?)[^\n]{0,80}?(?:\d{4}[-\s]?\d{2}\*{2}[-\s]?\*{4}[-\s]?(\d{4}))/ig,
        /(?:\d{4}[-\s]?\d{2}\*{2}[-\s]?\*{4}[-\s]?(\d{4}))/g,
        /(?:\*{2,}[-\s]*){1,4}(\d{4})\b/g
    ];
    for (const pattern of maskedCardPatterns) {
        for (const match of source.matchAll(pattern)) {
            addCandidate(match?.[1], 8);
        }
    }

    const cardNoTablePattern = /(?:^|\n)\s*(?:20\d{6})\s+(?:20\d{6})[\s\S]{0,90}?\b(\d{4})\b\s+[¥￥$]?\s*-?\d/g;
    for (const match of source.matchAll(cardNoTablePattern)) {
        addCandidate(match?.[1], 6);
    }

    const cardNoHeaderIndex = source.search(/Card\s*No\.?|卡号末四位|卡号后四位/i);
    if (cardNoHeaderIndex >= 0) {
        const cardNoWindow = source.slice(cardNoHeaderIndex, Math.min(source.length, cardNoHeaderIndex + 2200));
        const cardNoDigits = cardNoWindow.match(/\b\d{4}\b/g) || [];
        cardNoDigits.forEach((tail) => addCandidate(tail, 1));
    }

    const labeledPatterns = [
        /(?:卡片尾号|卡号末四位|卡号末4位|账户尾号|尾号|末四位|末4位|Card\s*No\.?|CardNo\.?)[^0-9]{0,48}((?:\d[\s\-*•·]*){4,10})/ig,
        /(?:\*{2,}|X{2,}|x{2,})\s*((?:\d[\s\-]*){4,6})/g
    ];
    for (const pattern of labeledPatterns) {
        for (const match of source.matchAll(pattern)) {
            const digits = String(match?.[1] || '').replace(/\D/g, '');
            if (digits.length >= 4) addCandidate(digits.slice(-4), 1);
        }
    }

    const ranked = Array.from(scoreMap.entries())
        .sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]));
    return ranked[0]?.[0] || '';
}

function parseEmailStatementContent(rawText, mode = 'auto') {
    const normalizedText = normalizeEmailStatementText(rawText);
    if (!normalizedText || normalizedText.length < 10) {
        return { ok: false, message: '账单内容过短，无法解析' };
    }
    const compactText = normalizedText.replace(/\s+/g, '');
    const parseText = `${normalizedText}\n${compactText}`;

    const modeText = String(mode || 'auto').trim();
    const businessMode = modeText === 'auto' ? detectBankBusinessModeByText(parseText) : modeText;
    const bankName = detectBankNameFromText(parseText);
    const cardTail = extractCardTailFromText(parseText);

    const billDayMatch = parseText.match(/账单日[：:\s]*(?:每月)?\s*(\d{1,2})\s*日?(?!\d)/);
    const billDayEnglishMatch = parseText.match(/(?:Statement\s*Due\s*Date|Statement\s*Date)[^0-9]{0,30}(\d{1,2})(?!\d)/i);
    const repaymentDayMatch = parseText.match(/(?:还款日|到期还款日|最后还款日)[：:\s]*(?:每月)?\s*(\d{1,2})\s*日?(?!\d)/);
    const dueDate = matchDateByPatterns(parseText, [
        /(?:最后还款日|到期还款日|本期还款日|Payment\s*Due\s*Date)[：:\s]*([0-9]{8})/i,
        /(?:最后还款日|到期还款日|本期还款日|Payment\s*Due\s*Date)[：:\s]*([0-9]{4}[年\/\-.][0-9]{1,2}[月\/\-.][0-9]{1,2}日?)/i,
        /(?:最后还款日|到期还款日|本期还款日|Payment\s*Due\s*Date)[：:\s]*([0-9]{1,2}[\/\-.][0-9]{1,2})/i
    ]);
    const statementDate = matchDateByPatterns(parseText, [
        /(?:账单日期|账单日|交易日期|记账日|Statement\s*Date)[：:\s]*([0-9]{8})/i,
        /(?:账单日期|账单日|交易日期|记账日|Statement\s*Date)[：:\s]*([0-9]{4}[年\/\-.][0-9]{1,2}[月\/\-.][0-9]{1,2}日?)/i,
        /(?:账单日期|账单日|交易日期|记账日|Statement\s*Date)[：:\s]*([0-9]{1,2}[\/\-.][0-9]{1,2})/i
    ]);

    const repaymentAmount = matchMoneyByPatterns(parseText, [
        /(?:本期应还(?:款)?(?:总额|金额)?|应还(?:款)?(?:总额|金额)?|到期应还|本期还款总额|Total\s*Statement\s*Balance|Total\s*Payment)[^0-9¥￥]{0,24}([¥￥]?\s*(?:CNY|RMB)?\s*[\d,]+(?:\.\d{1,2})?)/i,
        /(?:最低应还(?:金额|款额)?|Min\.?\s*Payment|Minimum\s*Payment)[^0-9¥￥]{0,24}([¥￥]?\s*(?:CNY|RMB)?\s*[\d,]+(?:\.\d{1,2})?)/i
    ]);
    const swipeAmount = matchMoneyByPatterns(parseText, [
        /(?:刷卡(?:金额)?|交易金额|Transaction\s*Amount)[^0-9¥￥]{0,24}([¥￥]?\s*(?:CNY|RMB)?\s*[\d,]+(?:\.\d{1,2})?)/i
    ]);
    const actualAmount = matchMoneyByPatterns(parseText, [
        /(?:到账(?:金额)?|实到(?:金额)?|入账金额|Actual\s*Amount|Net\s*Amount)[^0-9¥￥]{0,24}([¥￥]?\s*(?:CNY|RMB)?\s*[\d,]+(?:\.\d{1,2})?)/i
    ]);
    const feeAmount = matchMoneyByPatterns(parseText, [
        /(?:手续费|服务费|通道费|Fee)[^0-9¥￥]{0,24}([¥￥]?\s*(?:CNY|RMB)?\s*[\d,]+(?:\.\d{1,2})?)/i
    ]);
    const creditLimit = matchMoneyByPatterns(parseText, [
        /(?:信用额度|授信额度|总信用额度|Total\s*Credit\s*Limit|Credit\s*Limit)[^0-9¥￥]{0,30}([¥￥]?\s*(?:CNY|RMB)?\s*[\d,]+(?:\.\d{1,2})?)/i
    ]);
    const feeRateMatch = parseText.match(/(?:费率|Fee\s*Rate)[^0-9]{0,12}([0-9]+(?:\.[0-9]+)?)\s*%/i);
    const feeRate = feeRateMatch ? Number(feeRateMatch[1]) : NaN;

    const settlementBankMatch = parseText.match(/(?:到账卡|储蓄卡|收款卡)[：:\s]*([^\s；，。]+)/);
    const settlementBank = settlementBankMatch ? String(settlementBankMatch[1]).trim() : '';
    const settlementTailMatch = parseText.match(/(?:到账卡|储蓄卡|收款卡)[^0-9]{0,16}(?:尾号|末(?:四|4)位)?\s*(\d{4})/);
    const settlementTail = settlementTailMatch ? String(settlementTailMatch[1]) : '';

    let billDay = toValidDay(billDayMatch?.[1], 0);
    let repaymentDay = toValidDay(repaymentDayMatch?.[1], 0);
    if (dueDate) {
        repaymentDay = dueDate.getDate();
    }
    if (!billDay && billDayEnglishMatch?.[1]) billDay = toValidDay(billDayEnglishMatch[1], 0);
    if (!billDay && statementDate) billDay = statementDate.getDate();

    const descriptionLine = normalizedText.split('\n')
        .map(line => String(line || '').trim())
        .find(line => line.length >= 4 && !/^(账单|应还|还款|刷卡|到账|手续费|费率|银行|尾号|提醒)/.test(line));

    const missingFields = [];
    if (!bankName) missingFields.push('银行名称');
    if (businessMode === 'repayment' && !(Number.isFinite(repaymentAmount) && repaymentAmount > 0)) missingFields.push('应还金额');
    if (businessMode === 'swipe' && !(Number.isFinite(swipeAmount) && swipeAmount > 0)) missingFields.push('刷卡金额');

    let confidence = 0;
    if (bankName) confidence += 35;
    if (cardTail) confidence += 10;
    if (businessMode === 'repayment' && Number.isFinite(repaymentAmount) && repaymentAmount > 0) confidence += 35;
    if (businessMode === 'swipe' && Number.isFinite(swipeAmount) && swipeAmount > 0) confidence += 35;
    if (billDay) confidence += 10;
    if (repaymentDay) confidence += 10;
    confidence = Math.min(100, Math.max(0, confidence));

    return {
        ok: true,
        mode: businessMode,
        bankName: bankName || '',
        cardTail,
        billDay,
        repaymentDay,
        dueDate,
        statementDate,
        repaymentAmount: Number.isFinite(repaymentAmount) ? repaymentAmount : 0,
        swipeAmount: Number.isFinite(swipeAmount) ? swipeAmount : 0,
        actualAmount: Number.isFinite(actualAmount) ? actualAmount : 0,
        feeAmount: Number.isFinite(feeAmount) ? feeAmount : 0,
        feeRate: Number.isFinite(feeRate) ? feeRate : 0,
        creditLimit: Number.isFinite(creditLimit) ? creditLimit : 0,
        settlementBank: settlementBank || '',
        settlementTail: settlementTail || '',
        descriptionLine: descriptionLine || '',
        missingFields,
        confidence
    };
}

function renderBankEmailImportPreview(parsed) {
    const previewEl = document.getElementById('bankingEmailImportPreview');
    if (!previewEl) return;
    if (!parsed || !parsed.ok) {
        previewEl.textContent = parsed?.message || '解析失败，请检查账单内容格式';
        return;
    }
    const modeText = parsed.mode === 'swipe' ? '刷卡业务' : '还款业务';
    const dueText = parsed.dueDate ? formatFinanceDateText(parsed.dueDate) : '-';
    const statementText = parsed.statementDate ? formatFinanceDateText(parsed.statementDate) : '-';
    const issueText = parsed.missingFields.length ? `缺失字段：${parsed.missingFields.join('、')}` : '关键字段完整，可直接导入';
    previewEl.innerHTML = [
        `识别模式：${safeText(modeText)}（置信度 ${parsed.confidence}%）`,
        `银行：${safeText(parsed.bankName || '-')} / 尾号：${safeText(parsed.cardTail || '-')}`,
        `账单日：${safeText(parsed.billDay || '-')} / 还款日：${safeText(parsed.repaymentDay || '-')} / 到期日：${safeText(dueText)}`,
        `应还金额：${safeText(toMoneyText(parsed.repaymentAmount || 0))} / 刷卡金额：${safeText(toMoneyText(parsed.swipeAmount || 0))} / 到账金额：${safeText(toMoneyText(parsed.actualAmount || 0))}`,
        `手续费：${safeText(toMoneyText(parsed.feeAmount || 0))} / 费率：${safeText(Number(parsed.feeRate || 0).toFixed(2))}%`,
        `账单日期：${safeText(statementText)} / 备注摘要：${safeText(parsed.descriptionLine || '-')}`,
        `${safeText(issueText)}`
    ].join('<br>');
}

function previewBankEmailStatement() {
    const text = String(document.getElementById('bankingEmailStatementText')?.value || '').trim();
    const mode = String(document.getElementById('bankingEmailImportMode')?.value || 'auto').trim();
    const parsed = parseEmailStatementContent(text, mode);
    bankEmailImportPreviewData = parsed?.ok ? parsed : null;
    renderBankEmailImportPreview(parsed);
    if (!parsed.ok) {
        showToast(parsed.message || '解析失败，请检查内容', 'error');
        return;
    }
    showToast(`解析完成：${parsed.mode === 'swipe' ? '刷卡业务' : '还款业务'}`, 'success');
}

async function importBankEmailStatement() {
    const text = String(document.getElementById('bankingEmailStatementText')?.value || '').trim();
    if (!text) {
        markFieldInvalid('bankingEmailStatementText', '请先粘贴账单内容');
        return;
    }
    const mode = String(document.getElementById('bankingEmailImportMode')?.value || 'auto').trim();
    const reminderDaysBefore = Math.max(0, Math.floor(toAmount(document.getElementById('bankingEmailReminderDaysBefore')?.value, 3)));
    const parsed = parseEmailStatementContent(text, mode);
    renderBankEmailImportPreview(parsed);
    if (!parsed.ok) {
        showToast(parsed.message || '解析失败，无法导入', 'error');
        return;
    }

    const transactionDateRaw = parsed.statementDate ? parsed.statementDate.toISOString() : new Date().toISOString();
    const transactionDate = normalizeFinanceDateTimeForDb(transactionDateRaw);
    if (!transactionDate) {
        showToast('账单日期解析失败，请手工录入', 'error');
        return;
    }

    const importNote = parsed.descriptionLine ? `摘要：${parsed.descriptionLine}` : '邮箱账单自动解析';
    if (parsed.mode === 'swipe') {
        const swipeCardBank = parsed.bankName || '';
        const settlementBank = parsed.settlementBank || swipeCardBank || '未识别';
        const swipeAmount = Number(parsed.swipeAmount || 0);
        const actualAmount = Number(parsed.actualAmount || 0) > 0 ? Number(parsed.actualAmount) : swipeAmount;
        if (!swipeCardBank || swipeAmount <= 0 || actualAmount <= 0) {
            showToast('刷卡账单关键字段不足，请改用手工录入或完善账单内容', 'error');
            return;
        }
        const feeAmount = Number(parsed.feeAmount || Math.max(0, swipeAmount - actualAmount));
        const feeRate = Number(parsed.feeRate || (swipeAmount > 0 ? (feeAmount / swipeAmount) * 100 : 0));
        const settlementCardText = `${settlementBank}${parsed.settlementTail ? `（尾号${parsed.settlementTail}）` : ''}`;
        const financeData = {
            business_type: 'credit_card_swipe',
            type: 'income',
            category: '信用卡刷卡',
            amount: actualAmount,
            description: [
                importNote,
                '来源：邮箱账单解析',
                `银行：${swipeCardBank}`,
                `刷卡卡：${swipeCardBank}${parsed.cardTail ? `（尾号${parsed.cardTail}）` : ''}`,
                `到账卡：${settlementCardText}`,
                `刷卡：${toMoneyText(swipeAmount)}`,
                `到账：${toMoneyText(actualAmount)}`,
                `手续费：${toMoneyText(feeAmount)}`,
                `费率：${Number.isFinite(feeRate) ? feeRate.toFixed(2) : '0.00'}%`
            ].filter(Boolean).join('；'),
            transaction_date: transactionDate,
            card_bank: swipeCardBank,
            card_swipe_amount: swipeAmount,
            card_actual_amount: actualAmount,
            card_fee_amount: feeAmount,
            card_fee_rate: Number.isFinite(feeRate) ? Number(feeRate.toFixed(4)) : 0,
            swipe_card_bank: swipeCardBank,
            settlement_bank: settlementBank,
            settlement_card_tail: parsed.settlementTail || null
        };
        await persistBankBusinessFinance(financeData, '#bankingEmailImportModal', hideBankEmailImportModal);
        return;
    }

    const bank = parsed.bankName || '';
    const repaymentAmount = Number(parsed.repaymentAmount || 0);
    if (!bank || repaymentAmount <= 0) {
        showToast('还款账单关键字段不足，请改用手工录入或完善账单内容', 'error');
        return;
    }
    const billDay = toValidDay(parsed.billDay, 20);
    const repaymentDay = toValidDay(parsed.repaymentDay || parsed.dueDate?.getDate(), 5);
    const reminderDate = getCreditReminderDate(transactionDate, repaymentDay, reminderDaysBefore);
    const recommendation = buildBankCycleRecommendation(transactionDate, billDay, repaymentDay);
    const recommendationText = recommendation
        ? `建议：账单后刷卡 ${formatRuleDate(recommendation.recommendSwipeStart)}~${formatRuleDate(recommendation.recommendSwipeEnd)}，还款建议 ${formatRuleDate(recommendation.recommendRepayDate)}`
        : '';

    const financeData = {
        business_type: 'credit_card_repayment',
        type: 'expense',
        category: '信用卡还款',
        amount: repaymentAmount,
        description: [
            importNote,
            '来源：邮箱账单解析',
            `银行：${bank}${parsed.cardTail ? `（尾号${parsed.cardTail}）` : ''}`,
            `应还：${toMoneyText(repaymentAmount)}`,
            `账单日：每月${billDay}日`,
            `还款日：每月${repaymentDay}日`,
            `提醒：提前${reminderDaysBefore}天（${reminderDate ? formatFinanceDateText(reminderDate) : '待计算'}）`,
            recommendationText
        ].filter(Boolean).join('；'),
        transaction_date: transactionDate,
        card_bank: bank,
        card_bill_day: billDay,
        card_repayment_day: repaymentDay,
        card_repayment_amount: repaymentAmount,
        reminder_enabled: true,
        reminder_days_before: reminderDaysBefore,
        reminder_date: reminderDate ? reminderDate.toISOString() : null
    };
    await persistBankBusinessFinance(financeData, '#bankingEmailImportModal', hideBankEmailImportModal);
}

async function persistBankBusinessFinance(financeData, modalSelector, hideModal, options = {}) {
    const editId = options?.editId || null;
    const saveBtn = document.querySelector(`${modalSelector} .ant-btn-primary`);
    const originalText = saveBtn ? saveBtn.textContent : '';
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = editId ? '修改中...' : '保存中...';
    }

    try {
        hideModal();
        const result = editId ? await ERP.updateFinance(editId, financeData) : await ERP.addFinance(financeData);
        if (result) {
            const finances = await ERP.loadFinances(true);
            const generalRows = getGeneralFinanceRecords(finances);
            syncFinanceViewRows(generalRows, 'all');
            renderFinances(generalRows);
            applyBankBusinessFilters();
            updateStatistics();
            await refreshBankSmartPlanIfVisible();
            showToast(editId ? '银行业务修改成功' : '银行业务保存成功', 'success');
        }
    } catch (error) {
        console.error('[ERP Ant] 保存银行业务失败:', error);
        showToast((editId ? '修改失败：' : '保存失败：') + (error?.message || '网络错误，请稍后重试'), 'error');
    } finally {
        bankBusinessEditState.financeId = null;
        bankBusinessEditState.mode = '';
        bankBusinessEditState.cardTail = '';
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    }
}

async function submitQuickBankRepayment() {
    clearModalFieldValidation('bankingRepaymentModal');
    const source = resolveQuickRepaymentSource();
    if (!source) {
        showToast('未找到可登记的还款账单，请刷新后重试', 'error');
        return;
    }
    const isRepaymentCandidate = source.isRepayment === true
        || (
            Number(source?.repaymentAmount || 0) > 0
            && !source?.isSwipe
            && (toValidDay(source?.billDay, 0) > 0 || toValidDay(source?.repaymentDay, 0) > 0)
        );
    if (!isRepaymentCandidate) {
        showToast('当前记录不是“信用卡还款”账单，不能登记还款', 'warning');
        return;
    }

    const paymentAmount = Math.max(0, toAmount(document.getElementById('bankingRepaymentAmount')?.value, NaN));
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
        markFieldInvalid('bankingRepaymentAmount', '请输入本次还款金额');
        return;
    }

    const currentOutstanding = Math.max(0, Number(source.repaymentAmount || bankRepaymentQuickState.sourceOutstanding || 0));
    if (paymentAmount > currentOutstanding + 0.0001) {
        markFieldInvalid('bankingRepaymentAmount', `本次还款不能大于当前应还（${toMoneyText(currentOutstanding)}）`);
        return;
    }
    const remainingAmount = Number(Math.max(0, currentOutstanding - paymentAmount).toFixed(2));

    const bank = String(source.bank || '').trim();
    const cardTail = normalizeTail4(source.cardTail || '');
    const billDay = toValidDay(source.billDay, 0);
    const repaymentDay = toValidDay(source.repaymentDay, 0);
    const sourceTransactionDate = normalizeFinanceDateTimeForDb(source?.raw?.transaction_date || source?.transactionDate || new Date().toISOString());
    const payTransactionDate = normalizeFinanceDateTimeForDb(getNowDateTimeLocalValue());
    if (!sourceTransactionDate || !payTransactionDate) {
        showToast('还款日期解析失败，请重试', 'error');
        return;
    }

    const saveBtn = document.querySelector('#bankingRepaymentModal .ant-btn-primary');
    const originalText = saveBtn ? saveBtn.textContent : '';
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = '处理中...';
    }

    try {
        const paymentRecord = {
            business_type: 'credit_card_repayment_payment',
            type: 'expense',
            category: '还款记录',
            amount: paymentAmount,
            description: [
                '来源：手动登记还款',
                `来源账单ID：${String(source?.id || '')}`,
                `银行：${bank}${cardTail ? `（尾号${cardTail}）` : ''}`,
                `本次还款：${toMoneyText(paymentAmount)}`,
                `原应还：${toMoneyText(currentOutstanding)}`,
                `剩余应还：${toMoneyText(remainingAmount)}`
            ].join('；'),
            transaction_date: payTransactionDate,
            reference_id: source?.id ?? source?.raw?.reference_id ?? null,
            card_bank: bank,
            card_bill_day: billDay || null,
            card_repayment_day: repaymentDay || null,
            card_repayment_amount: paymentAmount,
            reminder_enabled: false,
            reminder_days_before: null,
            reminder_date: null
        };
        const inserted = await ERP.addFinance(paymentRecord);
        if (!inserted) {
            throw new Error('还款登记失败，请稍后重试');
        }

        const reminderEnabled = remainingAmount > 0 ? !!source.reminderEnabled : false;
        const reminderDaysBefore = reminderEnabled ? Math.max(0, Number(source.reminderDaysBefore || 3)) : 0;
        const reminderDateObj = reminderEnabled
            ? (source.reminderDate instanceof Date && !Number.isNaN(source.reminderDate.getTime())
                ? source.reminderDate
                : getCreditReminderDate(sourceTransactionDate, repaymentDay, reminderDaysBefore))
            : null;
        const recommendation = buildBankCycleRecommendation(sourceTransactionDate, billDay, repaymentDay);
        const recommendationText = recommendation
            ? `建议：账单后刷卡 ${formatRuleDate(recommendation.recommendSwipeStart)}~${formatRuleDate(recommendation.recommendSwipeEnd)}，还款建议 ${formatRuleDate(recommendation.recommendRepayDate)}`
            : '';
        const reminderText = reminderEnabled
            ? `提醒：提前${reminderDaysBefore}天（${reminderDateObj ? formatFinanceDateText(reminderDateObj) : '待计算'}）`
            : '提醒：关闭';
        const baseDescription = source.description && source.description !== '-' ? source.description : '登记还款';
        const updatedSourceRecord = {
            business_type: 'credit_card_repayment',
            type: 'expense',
            category: '信用卡还款',
            amount: remainingAmount,
            reference_id: source?.raw?.reference_id ?? null,
            order_id: source?.raw?.order_id ?? null,
            description: [
                baseDescription,
                `银行：${bank}${cardTail ? `（尾号${cardTail}）` : ''}`,
                `应还：${toMoneyText(remainingAmount)}`,
                `账单日：${billDay ? `每月${billDay}日` : '-'}`,
                `还款日：${repaymentDay ? `每月${repaymentDay}日` : '-'}`,
                reminderText,
                recommendationText,
                remainingAmount <= 0 ? '状态：已结清' : ''
            ].filter(Boolean).join('；'),
            transaction_date: sourceTransactionDate,
            card_bank: bank,
            card_bill_day: billDay || null,
            card_repayment_day: repaymentDay || null,
            card_repayment_amount: remainingAmount,
            reminder_enabled: reminderEnabled,
            reminder_days_before: reminderEnabled ? reminderDaysBefore : 0,
            reminder_date: reminderDateObj ? reminderDateObj.toISOString() : null
        };
        const updated = await ERP.updateFinance(source.id, updatedSourceRecord);
        if (!updated) {
            throw new Error('扣减应还金额失败，请稍后重试');
        }

        hideBankRepaymentModal();
        const finances = await ERP.loadFinances(true);
        const generalRows = getGeneralFinanceRecords(finances);
        syncFinanceViewRows(generalRows, 'all');
        renderFinances(generalRows);
        applyBankBusinessFilters();
        updateStatistics();
        await refreshBankSmartPlanIfVisible();
        showToast(remainingAmount > 0 ? `登记成功，剩余应还 ${toMoneyText(remainingAmount)}` : '登记成功，账单已结清', 'success');
    } catch (error) {
        console.error('[ERP Ant] 登记还款失败:', error);
        showToast(`登记失败：${error?.message || '请稍后重试'}`, 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    }
}

async function saveBankRepayment() {
    if (bankRepaymentQuickState.active) {
        await submitQuickBankRepayment();
        return;
    }
    clearModalFieldValidation('bankingRepaymentModal');
    const transactionDateRaw = document.getElementById('bankingRepaymentTransactionDate')?.value;
    const selectedBankValue = String(document.getElementById('bankingRepaymentCardBank')?.value || '').trim();
    const selectedBankMeta = parseBankCardOptionValue(selectedBankValue);
    const bank = String(selectedBankMeta.bank || '').trim();
    const billDay = toValidDay(document.getElementById('bankingRepaymentBillDay')?.value, 0);
    const repaymentDay = toValidDay(document.getElementById('bankingRepaymentDay')?.value, 0);
    const reminderEnabled = String(document.getElementById('bankingRepaymentReminderEnabled')?.value || '1') === '1';
    const reminderDaysBefore = Math.max(0, Math.floor(toAmount(document.getElementById('bankingRepaymentReminderDaysBefore')?.value, 3)));
    const repaymentAmount = Math.max(0, toAmount(document.getElementById('bankingRepaymentAmount')?.value, NaN));
    const customDescription = String(document.getElementById('bankingRepaymentDescription')?.value || '').trim();
    const manualCardTail = normalizeTail4(document.getElementById('bankingRepaymentCardTail')?.value || '');
    const preservedCardTail = bankBusinessEditState.mode === 'repayment'
        ? String(bankBusinessEditState.cardTail || '').trim()
        : '';
    const cardTail = normalizeTail4(manualCardTail || selectedBankMeta.cardTail || preservedCardTail);

    if (!bank) {
        markFieldInvalid('bankingRepaymentCardBank', '请选择发卡银行');
        return;
    }
    if (!billDay) {
        markFieldInvalid('bankingRepaymentBillDay', '账单日需在 1-31 之间');
        return;
    }
    if (!repaymentDay) {
        markFieldInvalid('bankingRepaymentDay', '还款日需在 1-31 之间');
        return;
    }
    if (!Number.isFinite(repaymentAmount) || repaymentAmount <= 0) {
        markFieldInvalid('bankingRepaymentAmount', '请输入应还金额');
        return;
    }

    const transactionDate = normalizeFinanceDateTimeForDb(transactionDateRaw);
    if (!transactionDate) {
        showToast('交易时间格式错误', 'error');
        return;
    }

    const reminderDate = reminderEnabled
        ? getCreditReminderDate(transactionDate, repaymentDay, reminderDaysBefore)
        : null;
    const recommendation = buildBankCycleRecommendation(transactionDate, billDay, repaymentDay);
    const reminderText = reminderEnabled
        ? `提醒：提前${reminderDaysBefore}天（${reminderDate ? formatFinanceDateText(reminderDate) : '待计算'}）`
        : '提醒：关闭';
    const recommendationText = recommendation
        ? `建议：账单后刷卡 ${formatRuleDate(recommendation.recommendSwipeStart)}~${formatRuleDate(recommendation.recommendSwipeEnd)}，还款建议 ${formatRuleDate(recommendation.recommendRepayDate)}`
        : '';

    const financeData = {
        business_type: 'credit_card_repayment',
        type: 'expense',
        category: '信用卡还款',
        amount: repaymentAmount,
        description: [
            customDescription,
            `银行：${bank}${cardTail ? `（尾号${cardTail}）` : ''}`,
            `应还：${toMoneyText(repaymentAmount)}`,
            `账单日：每月${billDay}日`,
            `还款日：每月${repaymentDay}日`,
            reminderText,
            recommendationText
        ].filter(Boolean).join('；'),
        transaction_date: transactionDate,
        card_bank: bank,
        card_bill_day: billDay,
        card_repayment_day: repaymentDay,
        card_repayment_amount: repaymentAmount,
        card_tail: cardTail || null,
        reminder_enabled: reminderEnabled,
        reminder_days_before: reminderDaysBefore,
        reminder_date: reminderDate ? reminderDate.toISOString() : null
    };

    await persistBankBusinessFinance(financeData, '#bankingRepaymentModal', hideBankRepaymentModal, {
        editId: bankBusinessEditState.mode === 'repayment' ? bankBusinessEditState.financeId : null
    });
}

async function saveBankSwipe() {
    clearModalFieldValidation('bankingSwipeModal');
    const transactionDateRaw = document.getElementById('bankingSwipeTransactionDate')?.value;
    const swipeBankMeta = parseBankCardOptionValue(document.getElementById('bankingSwipeCardBank')?.value || '');
    const settlementBankMeta = parseBankCardOptionValue(document.getElementById('bankingSettlementBank')?.value || '');
    const swipeCardBank = String(swipeBankMeta.bank || '').trim();
    const settlementBank = String(settlementBankMeta.bank || '').trim();
    const swipeCardTailInput = normalizeTail4(document.getElementById('bankingSwipeCardTail')?.value || '');
    const preservedSwipeCardTail = bankBusinessEditState.mode === 'swipe'
        ? normalizeTail4(bankBusinessEditState.cardTail || '')
        : '';
    const swipeCardTail = normalizeTail4(swipeCardTailInput || swipeBankMeta.cardTail || preservedSwipeCardTail);
    const settlementTailInput = normalizeTail4(document.getElementById('bankingSettlementCardTail')?.value || '');
    const settlementCardTail = normalizeTail4(settlementTailInput || settlementBankMeta.cardTail);
    const swipeAmount = Math.max(0, toAmount(document.getElementById('bankingSwipeAmount')?.value, NaN));
    const actualAmount = Math.max(0, toAmount(document.getElementById('bankingActualAmount')?.value, NaN));
    const feeAmount = Math.max(0, toAmount(document.getElementById('bankingFeeAmount')?.value, swipeAmount - actualAmount));
    const feeRate = swipeAmount > 0
        ? ((feeAmount / swipeAmount) * 100)
        : Number(String(document.getElementById('bankingFeeRate')?.value || '').replace('%', ''));
    const customDescription = String(document.getElementById('bankingSwipeDescription')?.value || '').trim();

    if (!swipeCardBank) {
        markFieldInvalid('bankingSwipeCardBank', '请选择刷卡信用卡银行');
        return;
    }
    if (!settlementBank) {
        markFieldInvalid('bankingSettlementBank', '请选择到账储蓄卡银行');
        return;
    }
    if (!Number.isFinite(swipeAmount) || swipeAmount <= 0) {
        markFieldInvalid('bankingSwipeAmount', '请输入刷卡金额');
        return;
    }
    if (!Number.isFinite(actualAmount) || actualAmount <= 0) {
        markFieldInvalid('bankingActualAmount', '请输入实际到账金额');
        return;
    }
    if (actualAmount > swipeAmount) {
        markFieldInvalid('bankingActualAmount', '到账金额不能大于刷卡金额');
        return;
    }

    const transactionDate = normalizeFinanceDateTimeForDb(transactionDateRaw);
    if (!transactionDate) {
        showToast('交易时间格式错误', 'error');
        return;
    }
    const settlementCardText = `${settlementBank}${settlementCardTail ? `（尾号${settlementCardTail}）` : ''}`;

    const financeData = {
        business_type: 'credit_card_swipe',
        type: 'income',
        category: '信用卡刷卡',
        amount: actualAmount,
        description: [
            customDescription,
            `银行：${swipeCardBank}${swipeCardTail ? `（尾号${swipeCardTail}）` : ''}`,
            `刷卡卡：${swipeCardBank}${swipeCardTail ? `（尾号${swipeCardTail}）` : ''}`,
            `到账卡：${settlementCardText}`,
            `刷卡：${toMoneyText(swipeAmount)}`,
            `到账：${toMoneyText(actualAmount)}`,
            `手续费：${toMoneyText(feeAmount)}`,
            `费率：${Number.isFinite(feeRate) ? feeRate.toFixed(2) : '0.00'}%`
        ].filter(Boolean).join('；'),
        transaction_date: transactionDate,
        card_bank: swipeCardBank,
        card_swipe_amount: swipeAmount,
        card_actual_amount: actualAmount,
        card_fee_amount: feeAmount,
        card_fee_rate: Number.isFinite(feeRate) ? Number(feeRate.toFixed(4)) : 0,
        card_tail: swipeCardTail || null,
        swipe_card_bank: swipeCardBank,
        settlement_bank: settlementBank,
        settlement_card_tail: settlementCardTail || null
    };

    await persistBankBusinessFinance(financeData, '#bankingSwipeModal', hideBankSwipeModal, {
        editId: bankBusinessEditState.mode === 'swipe' ? bankBusinessEditState.financeId : null
    });
}

function showBankBusinessModal() {
    showBankRepaymentModal();
}

function hideBankBusinessModal() {
    hideBankRepaymentModal();
}

async function saveBankBusiness() {
    await saveBankRepayment();
}

function findParsedBankBusinessById(financeId) {
    const normalizedId = String(financeId || '').trim();
    if (!normalizedId) {
        return null;
    }
    const sourceRows = Array.isArray(ERP.state?.finances) ? ERP.state.finances : [];
    const raw = sourceRows.find(item => String(item?.id || '') === normalizedId);
    return raw ? parseBankBusinessRecord(raw) : null;
}

function cloneQuickRepaymentSourceSnapshot(source) {
    if (!source || typeof source !== 'object') {
        return null;
    }
    const reminderDate = source?.reminderDate instanceof Date
        ? new Date(source.reminderDate.getTime())
        : parseFinanceDate(source?.reminderDate || null);
    const transactionDate = source?.transactionDate instanceof Date
        ? new Date(source.transactionDate.getTime())
        : parseFinanceDate(source?.transactionDate || source?.raw?.transaction_date || null);
    const raw = source?.raw && typeof source.raw === 'object'
        ? { ...source.raw }
        : null;
    return {
        ...source,
        reminderDate,
        transactionDate,
        raw
    };
}

function resolveQuickRepaymentSource() {
    const sourceId = String(bankRepaymentQuickState.sourceFinanceId || '').trim();
    if (!sourceId) {
        return cloneQuickRepaymentSourceSnapshot(bankRepaymentQuickState.sourceSnapshot);
    }

    const byState = findParsedBankBusinessById(sourceId);
    if (byState) {
        return byState;
    }

    const snapshot = cloneQuickRepaymentSourceSnapshot(bankRepaymentQuickState.sourceSnapshot);
    if (snapshot && String(snapshot?.id || '').trim() === sourceId) {
        return snapshot;
    }

    const fallbackRows = Array.isArray(bankBusinessViewState.currentRows)
        ? bankBusinessViewState.currentRows
        : [];
    const fallback = fallbackRows.find(item => String(item?.id || '').trim() === sourceId);
    if (fallback) {
        if (fallback?.raw) {
            return parseBankBusinessRecord(fallback.raw);
        }
        return cloneQuickRepaymentSourceSnapshot(fallback);
    }
    return null;
}

function quickCreateBankRepayment(financeId) {
    const source = findParsedBankBusinessById(financeId);
    if (!source) {
        showToast('未找到对应银行业务记录', 'error');
        return;
    }
    if (!source?.isRepayment) {
        showToast('该记录不是还款账单，请在“修改”中调整后再登记还款', 'warning');
        return;
    }

    const sourceBank = String(source?.bank || source?.swipeCardBank || '').trim();
    if (!sourceBank) {
        showToast('当前记录缺少银行信息，无法快速还款', 'warning');
        return;
    }

    showBankRepaymentModal({
        id: source.id ?? null,
        raw: source.raw || null,
        isRepayment: true,
        transactionDate: source.transactionDate instanceof Date ? source.transactionDate : new Date(),
        bank: sourceBank,
        cardTail: normalizeTail4(source.cardTail || ''),
        billDay: source.billDay || 20,
        repaymentDay: source.repaymentDay || 5,
        reminderEnabled: source.reminderEnabled !== false,
        reminderDaysBefore: Math.max(0, Number(source.reminderDaysBefore || 3)),
        repaymentAmount: Math.max(0, Number(source.repaymentAmount || 0)),
        description: source.description && source.description !== '-' ? String(source.description) : '登记还款'
    }, { mode: 'create', quickRepay: true });
}

function hideBankRepaymentHistoryModal() {
    const modal = document.getElementById('bankingRepaymentHistoryModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.style.display = '';
    bankRepaymentHistoryState.bank = '';
    bankRepaymentHistoryState.cardTail = '';
    bankRepaymentHistoryState.rows = [];
}

function openBankRepaymentHistoryModal() {
    const modal = document.getElementById('bankingRepaymentHistoryModal');
    if (!modal) return;
    modal.classList.add('active');
    modal.style.display = 'flex';
}

function renderBankRepaymentHistoryModal(bank, cardTail, rows) {
    const titleEl = document.getElementById('bankingRepaymentHistoryTitle');
    const bodyEl = document.getElementById('bankingRepaymentHistoryBody');
    if (!bodyEl) return;

    const cardLabel = `${String(bank || '-').trim()}${cardTail ? `（尾号${cardTail}）` : ''}`;
    if (titleEl) {
        titleEl.textContent = `还款记录 - ${cardLabel}`;
    }

    const list = Array.isArray(rows) ? rows.slice() : [];
    const totalAmount = list.reduce((sum, item) => sum + Math.max(0, Number(item?.repaymentAmount || 0)), 0);
    const rowsHtml = list.length
        ? list
            .sort((left, right) => {
                const l = left?.transactionDate instanceof Date ? left.transactionDate.getTime() : 0;
                const r = right?.transactionDate instanceof Date ? right.transactionDate.getTime() : 0;
                return r - l;
            })
            .map(item => {
                const reminderMeta = getBankReminderStatus(item);
                return `
                    <tr>
                        <td class="erp-cell-nowrap">${escapeHtmlText(toDateTimeText(item?.transactionDate || item?.raw?.transaction_date || '-'))}</td>
                        <td><span class="erp-amount-text is-expense">${escapeHtmlText(toMoneyText(item?.repaymentAmount || 0))}</span></td>
                        <td>${escapeHtmlText(formatBankBillRepaymentText(item))}</td>
                        <td>${escapeHtmlText(reminderMeta.text)}</td>
                        <td title="${escapeHtmlText(item?.description || '-')}"><span class="erp-cell-ellipsis">${escapeHtmlText(item?.description || '-')}</span></td>
                    </tr>
                `;
            }).join('')
        : '<tr><td colspan="5" class="erp-history-empty-cell">暂无还款记录</td></tr>';

    bodyEl.innerHTML = `
        <div class="erp-history-summary-grid">
            <div class="erp-history-summary-card">
                <div class="erp-history-summary-label">记录数量</div>
                <div class="erp-history-summary-value">${list.length}</div>
            </div>
            <div class="erp-history-summary-card is-warning">
                <div class="erp-history-summary-label">累计还款金额</div>
                <div class="erp-history-summary-value is-payable">${escapeHtmlText(toMoneyText(totalAmount))}</div>
            </div>
        </div>
        <div class="ant-table-wrapper erp-block-card erp-history-table">
            <div class="ant-table">
                <table>
                    <thead class="ant-table-thead">
                        <tr>
                            <th>还款时间</th>
                            <th>还款金额</th>
                            <th>账单/还款日</th>
                            <th>提醒状态</th>
                            <th>备注</th>
                        </tr>
                    </thead>
                    <tbody class="ant-table-tbody">${rowsHtml}</tbody>
                </table>
            </div>
        </div>
    `;
}

function showBankRepaymentHistory(financeId) {
    const source = findParsedBankBusinessById(financeId);
    if (!source) {
        showToast('未找到对应银行业务记录', 'error');
        return;
    }

    const bank = String(source?.bank || source?.swipeCardBank || '').trim();
    const cardTail = normalizeTail4(source?.cardTail || '');
    if (!bank) {
        showToast('该记录缺少银行信息，无法查询还款记录', 'warning');
        return;
    }

    const allRows = getBankBusinessRecords().map(parseBankBusinessRecord);
    const repaymentRows = allRows.filter(item => {
        if (!item?.isRepaymentPayment) return false;
        if (String(item?.bank || '').trim() !== bank) return false;
        if (cardTail) {
            return normalizeTail4(item?.cardTail || '') === cardTail;
        }
        return true;
    });

    bankRepaymentHistoryState.bank = bank;
    bankRepaymentHistoryState.cardTail = cardTail;
    bankRepaymentHistoryState.rows = repaymentRows;

    openBankRepaymentHistoryModal();
    renderBankRepaymentHistoryModal(bank, cardTail, repaymentRows);
}

function editBankBusiness(financeId) {
    const parsed = findParsedBankBusinessById(financeId);
    if (!parsed) {
        showToast('未找到可修改的银行业务记录', 'error');
        return;
    }
    if (parsed.isSwipe) {
        showBankSwipeModal(parsed);
        return;
    }
    showBankRepaymentModal(parsed);
}

function deleteBankBusiness(financeId) {
    deleteFinance(financeId);
}

async function batchDeleteSelectedBankBusiness() {
    const rows = getSelectedBankBusinessRows();
    if (!rows.length) {
        if (typeof showToast === 'function') {
            showToast('请先勾选要删除的银行业务记录', 'info');
        }
        return;
    }

    const shouldDelete = confirm(`确认删除选中的 ${rows.length} 条银行业务记录吗？`);
    if (!shouldDelete) {
        return;
    }

    let successCount = 0;
    let failCount = 0;
    for (const row of rows) {
        try {
            await ERP.deleteFinance(row.id);
            successCount += 1;
        } catch (error) {
            failCount += 1;
            console.error('[ERP Ant] 批量删除银行业务失败:', error);
        }
    }

    rows.forEach(row => {
        bankBusinessSelectionState.selectedIds.delete(normalizeBankBusinessRowId(row?.id));
    });

    await ERP.loadFinances(true);
    applyBankBusinessFilters();
    if (typeof applyFinanceFilters === 'function') {
        applyFinanceFilters();
    }
    updateStatistics();

    if (typeof showToast === 'function') {
        showToast(`批量删除银行业务完成：成功 ${successCount}，失败 ${failCount}`, failCount > 0 ? 'warning' : 'success');
    }
}

const PERSONAL_BANKING_TABLES = {
    connections: 'erp_bank_connections',
    syncLogs: 'erp_bank_sync_logs',
    statementEntries: 'erp_bank_statement_entries'
};

const personalBankingState = {
    connections: [],
    syncLogs: [],
    statementEntries: [],
    useLocalFallback: false,
    lastErrorMessage: ''
};

function getCurrentERPUserId() {
    const directUserId = (typeof userData !== 'undefined' && userData?.user?.id)
        ? String(userData.user.id).trim()
        : '';
    if (directUserId) {
        return directUserId;
    }
    return String(window?.userData?.user?.id || '').trim();
}

async function ensureERPUserSessionReady() {
    let userId = getCurrentERPUserId();
    if (userId) {
        return userId;
    }

    try {
        if (typeof checkLoginStatus === 'function') {
            await checkLoginStatus();
            userId = getCurrentERPUserId();
            if (userId) {
                return userId;
            }
        }

        if (typeof supabaseClient !== 'undefined' && supabaseClient?.auth?.getSession) {
            const { data, error } = await supabaseClient.auth.getSession();
            if (!error && data?.session?.user?.id) {
                if (typeof userData !== 'undefined') {
                    userData.isLoggedIn = true;
                    userData.user = data.session.user;
                }
                return String(data.session.user.id).trim();
            }
        }
    } catch (error) {
        console.error('[ERP] 校验登录会话失败:', error);
    }

    return '';
}

function personalBankingStorageKey() {
    const userId = getCurrentERPUserId() || 'guest';
    return `erp_personal_banking_${userId}`;
}

function loadLocalPersonalBankingData() {
    try {
        const raw = localStorage.getItem(personalBankingStorageKey());
        if (!raw) {
            return { connections: [], syncLogs: [], statementEntries: [] };
        }
        const parsed = JSON.parse(raw);
        return {
            connections: Array.isArray(parsed?.connections) ? parsed.connections : [],
            syncLogs: Array.isArray(parsed?.syncLogs) ? parsed.syncLogs : [],
            statementEntries: Array.isArray(parsed?.statementEntries) ? parsed.statementEntries : []
        };
    } catch (error) {
        return { connections: [], syncLogs: [], statementEntries: [] };
    }
}

function saveLocalPersonalBankingData(payload) {
    try {
        localStorage.setItem(personalBankingStorageKey(), JSON.stringify(payload || { connections: [], syncLogs: [], statementEntries: [] }));
    } catch (error) {
        console.error('[ERP] 保存个人账单本地缓存失败:', error);
    }
}

function syncLocalPersonalBankingFromState() {
    saveLocalPersonalBankingData({
        connections: personalBankingState.connections,
        syncLogs: personalBankingState.syncLogs,
        statementEntries: personalBankingState.statementEntries
    });
}

function isTableMissingError(error) {
    const code = String(error?.code || '').trim().toUpperCase();
    const message = String(error?.message || '').toLowerCase();
    const hint = String(error?.hint || '').toLowerCase();
    return code === '42P01'
        || code === 'PGRST205'
        || message.includes('could not find the table')
        || (message.includes('relation') && message.includes('does not exist'))
        || hint.includes('perhaps you meant the table');
}

function getShanghaiDatePartMap(value) {
    const date = parseFinanceDate(value);
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return null;
    }
    const formatter = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    const partMap = {};
    formatter.formatToParts(date).forEach(part => {
        if (part?.type && part.type !== 'literal') {
            partMap[part.type] = String(part.value || '').padStart(part.type === 'year' ? 4 : 2, '0');
        }
    });
    if (!partMap.year || !partMap.month || !partMap.day) {
        return null;
    }
    return partMap;
}

function getShanghaiDateTimeInputValue(value) {
    const partMap = getShanghaiDatePartMap(value);
    if (!partMap) {
        return '';
    }
    return `${partMap.year}-${partMap.month}-${partMap.day}T${partMap.hour || '00'}:${partMap.minute || '00'}`;
}

function toYmdText(value) {
    const partMap = getShanghaiDatePartMap(value);
    if (!partMap) {
        return '-';
    }
    return `${partMap.year}-${partMap.month}-${partMap.day}`;
}

function toDateTimeText(value) {
    const partMap = getShanghaiDatePartMap(value);
    if (!partMap) {
        return '-';
    }
    return `${partMap.year}/${partMap.month}/${partMap.day} ${partMap.hour || '00'}:${partMap.minute || '00'}:${partMap.second || '00'}`;
}

function normalizePersonalBankProviderText(provider) {
    const value = String(provider || '').trim();
    if (!value) {
        return '个人账单导入';
    }
    return '个人账单导入';
}

function normalizePersonalBankAuthStatusText(status) {
    const map = {
        active: '有效',
        pending: '待授权',
        expired: '已过期'
    };
    return map[String(status || '').trim()] || '未知';
}

function normalizePersonalBankAuthClass(status, expiresAt) {
    const statusText = String(status || '').trim();
    if (statusText === 'active') {
        const expireDate = parseFinanceDate(expiresAt);
        if (expireDate instanceof Date && !Number.isNaN(expireDate.getTime()) && expireDate.getTime() < Date.now()) {
            return 'is-expense';
        }
        return 'is-income';
    }
    if (statusText === 'pending') {
        return 'is-system';
    }
    return 'is-expense';
}

function ensurePersonalBankingStateLoaded() {
    if (!Array.isArray(personalBankingState.connections)) {
        personalBankingState.connections = [];
    }
    if (!Array.isArray(personalBankingState.syncLogs)) {
        personalBankingState.syncLogs = [];
    }
    if (!Array.isArray(personalBankingState.statementEntries)) {
        personalBankingState.statementEntries = [];
    }
}

function normalizePersonalConnectionRecords(records = []) {
    return (Array.isArray(records) ? records : []).map(item => ({
        ...item,
        provider: 'manual_statement'
    }));
}

function populatePersonalBankSyncConnectionOptions(selectedConnectionId = '') {
    const select = document.getElementById('personalBankSyncConnectionId');
    if (!select) return;

    const selected = String(selectedConnectionId || select.value || '').trim();
    const options = personalBankingState.connections.map(item => {
        const id = String(item?.id || '').trim();
        if (!id) return '';
        const name = `${item?.bank_name || '未知银行'}${item?.account_mask ? `（尾号${String(item.account_mask).slice(-4)}）` : ''}`;
        return `<option value="${safeText(id)}" ${id === selected ? 'selected' : ''}>${safeText(name)}</option>`;
    }).filter(Boolean);

    if (options.length === 0) {
        select.innerHTML = '<option value="">暂无可用连接</option>';
        return;
    }
    select.innerHTML = options.join('');
}

function renderPersonalBankingCenter() {
    ensurePersonalBankingStateLoaded();

    const connTotal = personalBankingState.connections.length;
    const now = Date.now();
    const activeConnections = personalBankingState.connections.filter(item => {
        if (String(item?.auth_status || '') !== 'active') {
            return false;
        }
        const expiresAt = parseFinanceDate(item?.consent_expires_at || null);
        if (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime())) {
            return true;
        }
        return expiresAt.getTime() >= now;
    });
    const expiringConnections = personalBankingState.connections.filter(item => {
        const expiresAt = parseFinanceDate(item?.consent_expires_at || null);
        if (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime())) {
            return false;
        }
        const diffDays = (expiresAt.getTime() - now) / (24 * 60 * 60 * 1000);
        return diffDays >= 0 && diffDays <= 7;
    });

    const latestLog = personalBankingState.syncLogs
        .slice()
        .sort((a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime())[0] || null;

    const connTotalEl = document.getElementById('personalBankConnTotal');
    const connActiveEl = document.getElementById('personalBankConnActive');
    const connExpiringEl = document.getElementById('personalBankConnExpiring');
    const lastSyncEl = document.getElementById('personalBankLastSync');
    const syncStateEl = document.getElementById('personalBankSyncState');
    if (connTotalEl) connTotalEl.textContent = String(connTotal);
    if (connActiveEl) connActiveEl.textContent = String(activeConnections.length);
    if (connExpiringEl) connExpiringEl.textContent = String(expiringConnections.length);
    if (lastSyncEl) lastSyncEl.textContent = latestLog ? toDateTimeText(latestLog.created_at) : '-';
    if (syncStateEl) {
        const stateText = latestLog
            ? (latestLog.status === 'success' ? '最近成功' : (latestLog.status === 'partial' ? '最近无新增' : '最近失败'))
            : '未开始';
        syncStateEl.textContent = stateText + (personalBankingState.useLocalFallback ? '（本地缓存）' : '');
    }

    const connBody = document.getElementById('personalBankConnectionsBody');
    if (connBody) {
        if (personalBankingState.connections.length === 0) {
            connBody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#94a3b8;">暂无连接，请先新增个人连接</td></tr>';
        } else {
            connBody.innerHTML = personalBankingState.connections.map(item => {
                const authClass = normalizePersonalBankAuthClass(item?.auth_status, item?.consent_expires_at);
                const autoSyncText = item?.auto_sync_enabled ? '开启' : '关闭';
                const connId = String(item?.id || '').trim();
                const connIdJsText = connId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                return `
                    <tr>
                        <td>${safeText(normalizePersonalBankProviderText(item?.provider))}</td>
                        <td>${safeText(item?.bank_name || '-')}</td>
                        <td>${safeText(item?.account_mask ? `尾号${String(item.account_mask).slice(-4)}` : '-')}</td>
                        <td><span class="erp-type-pill ${authClass}">${safeText(normalizePersonalBankAuthStatusText(item?.auth_status))}</span></td>
                        <td>${safeText(toYmdText(item?.consent_expires_at || null))}</td>
                        <td>${safeText(autoSyncText)}</td>
                        <td>${safeText(toDateTimeText(item?.last_synced_at || null))}</td>
                        <td class="erp-action-cell">
                            <div class="erp-row-actions">
                                <button class="ant-btn erp-btn-blue erp-btn-compact" onclick="showPersonalBankSyncModal('${connIdJsText}')">同步</button>
                                <button class="ant-btn erp-btn-danger erp-btn-compact" onclick="deletePersonalBankConnection('${connIdJsText}')">移除</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    const logBody = document.getElementById('personalBankSyncLogsBody');
    if (logBody) {
        if (personalBankingState.syncLogs.length === 0) {
            logBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;">暂无同步日志</td></tr>';
        } else {
            const logs = personalBankingState.syncLogs
                .slice()
                .sort((a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime())
                .slice(0, 20);
            logBody.innerHTML = logs.map(log => {
                const status = String(log?.status || 'unknown');
                const statusClass = status === 'success' ? 'is-income' : (status === 'partial' ? 'is-system' : 'is-expense');
                const statusText = status === 'success' ? '成功' : (status === 'partial' ? '无新增' : '失败');
                const inserted = Number(log?.inserted_count || 0);
                const rangeText = `${toYmdText(log?.range_start)} ~ ${toYmdText(log?.range_end)}`;
                return `
                    <tr>
                        <td>${safeText(toDateTimeText(log?.created_at || null))}</td>
                        <td>${safeText(log?.bank_name || '-')} / ${safeText(normalizePersonalBankProviderText(log?.provider))}</td>
                        <td>${safeText(rangeText)}</td>
                        <td><span class="erp-type-pill ${statusClass}">${safeText(statusText)}</span></td>
                        <td>${safeText(String(inserted))}</td>
                        <td><span class="erp-cell-ellipsis" title="${safeText(log?.message || '-')}">${safeText(log?.message || '-')}</span></td>
                    </tr>
                `;
            }).join('');
        }
    }

    populatePersonalBankSyncConnectionOptions();
}

function showPersonalBankConnectionModal() {
    const modal = document.getElementById('personalBankConnectionModal');
    const form = document.getElementById('personalBankConnectionForm');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('personalBankProvider').value = 'manual_statement';
    document.getElementById('personalBankAuthStatus').value = 'active';
    document.getElementById('personalBankAutoSyncEnabled').checked = true;
    const expireInput = document.getElementById('personalBankConsentExpireDate');
    if (expireInput) {
        const expireDate = new Date();
        expireDate.setDate(expireDate.getDate() + 30);
        expireInput.value = `${expireDate.getFullYear()}-${String(expireDate.getMonth() + 1).padStart(2, '0')}-${String(expireDate.getDate()).padStart(2, '0')}`;
    }
    clearModalFieldValidation('personalBankConnectionModal');
    modal.classList.add('active');
    modal.style.display = 'flex';
}

function hidePersonalBankConnectionModal() {
    const modal = document.getElementById('personalBankConnectionModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.style.display = '';
}

function getPersonalBankConnectionFormData() {
    const provider = 'manual_statement';
    const bankName = String(document.getElementById('personalBankName')?.value || '').trim();
    const accountMask = String(document.getElementById('personalBankAccountMask')?.value || '').replace(/\D/g, '').slice(-4);
    const authStatus = String(document.getElementById('personalBankAuthStatus')?.value || 'active').trim();
    const consentExpireDate = String(document.getElementById('personalBankConsentExpireDate')?.value || '').trim();
    const connectorRef = String(document.getElementById('personalBankConnectorRef')?.value || '').trim();
    const autoSyncEnabled = !!document.getElementById('personalBankAutoSyncEnabled')?.checked;

    const consentExpiresAt = consentExpireDate ? `${consentExpireDate} 23:59:59` : null;
    return {
        provider,
        bank_name: bankName,
        account_mask: accountMask || null,
        auth_status: authStatus || 'active',
        consent_expires_at: consentExpiresAt,
        connector_ref: connectorRef || null,
        auto_sync_enabled: autoSyncEnabled
    };
}

async function savePersonalBankConnection() {
    clearModalFieldValidation('personalBankConnectionModal');
    const userId = await ensureERPUserSessionReady();
    if (!userId) {
        showToast('请先登录后再配置个人账单连接', 'error');
        return;
    }

    const payload = getPersonalBankConnectionFormData();
    if (!payload.bank_name) {
        markFieldInvalid('personalBankName', '请输入银行名称');
        return;
    }

    const saveBtn = document.querySelector('#personalBankConnectionModal .ant-btn-primary');
    const originalText = saveBtn?.textContent || '';
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';
    }

    try {
        const fullPayload = {
            user_id: userId,
            ...payload
        };
        if (personalBankingState.useLocalFallback || typeof supabaseClient === 'undefined') {
            const nowIso = new Date().toISOString();
            personalBankingState.connections.unshift({
                ...fullPayload,
                id: `local_conn_${Date.now()}`,
                created_at: nowIso,
                updated_at: nowIso,
                last_synced_at: null
            });
            syncLocalPersonalBankingFromState();
        } else {
            const { data, error } = await supabaseClient
                .from(PERSONAL_BANKING_TABLES.connections)
                .insert([fullPayload])
                .select()
                .single();
            if (error) {
                if (isTableMissingError(error)) {
                    personalBankingState.useLocalFallback = true;
                    const nowIso = new Date().toISOString();
                    personalBankingState.connections.unshift({
                        ...fullPayload,
                        id: `local_conn_${Date.now()}`,
                        created_at: nowIso,
                        updated_at: nowIso,
                        last_synced_at: null
                    });
                    syncLocalPersonalBankingFromState();
                    showToast('数据库未创建个人账单表，已自动切换为本地缓存模式', 'warning');
                } else {
                    throw error;
                }
            } else if (data) {
                personalBankingState.connections.unshift(data);
            }
        }

        hidePersonalBankConnectionModal();
        renderPersonalBankingCenter();
        showToast('个人账单连接已保存', 'success');
    } catch (error) {
        console.error('[ERP] 保存个人账单连接失败:', error);
        showToast('保存失败：' + (error?.message || '未知错误'), 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    }
}

function showPersonalBankSyncModal(connectionId = '') {
    const modal = document.getElementById('personalBankSyncModal');
    const form = document.getElementById('personalBankSyncForm');
    if (!modal || !form) return;

    form.reset();
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);
    const toInputDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    document.getElementById('personalBankSyncStartDate').value = toInputDate(startDate);
    document.getElementById('personalBankSyncEndDate').value = toInputDate(endDate);
    document.getElementById('personalBankSyncMode').value = 'ledger_smart';
    populatePersonalBankSyncConnectionOptions(connectionId);
    clearModalFieldValidation('personalBankSyncModal');
    modal.classList.add('active');
    modal.style.display = 'flex';
}

function hidePersonalBankSyncModal() {
    const modal = document.getElementById('personalBankSyncModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.style.display = '';
}

async function refreshPersonalBankingCenter() {
    const userId = await ensureERPUserSessionReady();
    if (!userId) {
        personalBankingState.connections = [];
        personalBankingState.syncLogs = [];
        personalBankingState.statementEntries = [];
        renderPersonalBankingCenter();
        return;
    }

    if (typeof supabaseClient === 'undefined' || personalBankingState.useLocalFallback) {
        const localData = loadLocalPersonalBankingData();
        personalBankingState.connections = normalizePersonalConnectionRecords(localData.connections);
        personalBankingState.syncLogs = localData.syncLogs;
        personalBankingState.statementEntries = localData.statementEntries;
        personalBankingState.useLocalFallback = true;
        renderPersonalBankingCenter();
        return;
    }

    try {
        const [connResp, logResp, statementResp] = await Promise.all([
            supabaseClient.from(PERSONAL_BANKING_TABLES.connections).select('*').eq('user_id', userId).order('created_at', { ascending: false }),
            supabaseClient.from(PERSONAL_BANKING_TABLES.syncLogs).select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
            supabaseClient.from(PERSONAL_BANKING_TABLES.statementEntries).select('*').eq('user_id', userId).order('statement_date', { ascending: false }).limit(100)
        ]);

        if (connResp.error || logResp.error || statementResp.error) {
            const firstError = connResp.error || logResp.error || statementResp.error;
            if (isTableMissingError(firstError)) {
                personalBankingState.useLocalFallback = true;
                const localData = loadLocalPersonalBankingData();
                personalBankingState.connections = normalizePersonalConnectionRecords(localData.connections);
                personalBankingState.syncLogs = localData.syncLogs;
                personalBankingState.statementEntries = localData.statementEntries;
                personalBankingState.lastErrorMessage = firstError.message || '个人账单数据表不存在';
                renderPersonalBankingCenter();
                return;
            }
            throw firstError;
        }

        personalBankingState.connections = normalizePersonalConnectionRecords(Array.isArray(connResp.data) ? connResp.data : []);
        personalBankingState.syncLogs = Array.isArray(logResp.data) ? logResp.data : [];
        personalBankingState.statementEntries = Array.isArray(statementResp.data) ? statementResp.data : [];
        personalBankingState.useLocalFallback = false;
        renderPersonalBankingCenter();
    } catch (error) {
        console.error('[ERP] 加载个人账单同步中心失败:', error);
        showToast('个人账单同步中心加载失败，已回退本地缓存', 'warning');
        personalBankingState.useLocalFallback = true;
        const localData = loadLocalPersonalBankingData();
        personalBankingState.connections = normalizePersonalConnectionRecords(localData.connections);
        personalBankingState.syncLogs = localData.syncLogs;
        personalBankingState.statementEntries = localData.statementEntries;
        renderPersonalBankingCenter();
    }
}

function resolveConnectionById(connectionId) {
    const idText = String(connectionId || '').trim();
    if (!idText) {
        return null;
    }
    return personalBankingState.connections.find(item => String(item?.id || '') === idText) || null;
}

async function deletePersonalBankConnection(connectionId) {
    const target = resolveConnectionById(connectionId);
    if (!target) {
        showToast('连接不存在或已被删除', 'warning');
        return;
    }
    const confirmed = confirm(`确认移除连接：${target.bank_name || '未知银行'}？`);
    if (!confirmed) return;

    const userId = getCurrentERPUserId();
    const idText = String(connectionId);

    try {
        if (personalBankingState.useLocalFallback || typeof supabaseClient === 'undefined') {
            personalBankingState.connections = personalBankingState.connections.filter(item => String(item?.id || '') !== idText);
            syncLocalPersonalBankingFromState();
        } else {
            const { error } = await supabaseClient
                .from(PERSONAL_BANKING_TABLES.connections)
                .delete()
                .eq('id', idText)
                .eq('user_id', userId);
            if (error) throw error;
            personalBankingState.connections = personalBankingState.connections.filter(item => String(item?.id || '') !== idText);
        }
        renderPersonalBankingCenter();
        showToast('连接已移除', 'success');
    } catch (error) {
        console.error('[ERP] 删除个人账单连接失败:', error);
        showToast('移除失败：' + (error?.message || '未知错误'), 'error');
    }
}

function normalizeBankKeyword(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/银行/g, '')
        .replace(/信用卡/g, '')
        .replace(/储蓄卡/g, '')
        .replace(/\s+/g, '');
}

function matchFinanceWithConnection(finance, connection, mode = 'ledger_smart') {
    const bankKeywordRaw = String(connection?.bank_name || '').trim();
    const bankKeyword = normalizeBankKeyword(bankKeywordRaw);
    if (!bankKeyword) return false;

    const tail = String(connection?.account_mask || '').replace(/\D/g, '').slice(-4);
    const candidateTextRaw = [
        String(finance?.card_bank || ''),
        String(finance?.swipe_card_bank || ''),
        String(finance?.settlement_bank || ''),
        String(finance?.description || '')
    ].join(' ');
    const candidateText = candidateTextRaw.toLowerCase();
    const candidateBankNormalized = normalizeBankKeyword(candidateTextRaw);

    const bankMatch = candidateBankNormalized.includes(bankKeyword) || candidateText.includes(bankKeywordRaw.toLowerCase());
    const tailMatch = tail
        ? candidateText.includes(`尾号${tail}`) || candidateText.includes(tail) || String(finance?.settlement_card_tail || '').includes(tail)
        : false;

    if (mode === 'ledger_strict') {
        return bankMatch && (tail ? tailMatch : true);
    }

    return bankMatch || (tail ? tailMatch : false);
}

async function buildLedgerSyncEntries(connection, startDate, endDate, mode = 'ledger_smart') {
    const userId = getCurrentERPUserId();
    let sourceRows = Array.isArray(window?.ERP?.state?.finances) ? window.ERP.state.finances : [];
    if ((!sourceRows || sourceRows.length === 0) && typeof ERP?.loadFinances === 'function') {
        sourceRows = await ERP.loadFinances(true);
    }

    const start = parseFinanceDate(startDate);
    const end = parseFinanceDate(endDate);
    const startTime = start instanceof Date ? start.setHours(0, 0, 0, 0) : 0;
    const endTime = end instanceof Date ? end.setHours(23, 59, 59, 999) : Number.MAX_SAFE_INTEGER;

    return (Array.isArray(sourceRows) ? sourceRows : [])
        .filter(item => String(item?.user_id || userId) === userId)
        .filter(item => {
            const time = new Date(item?.transaction_date || item?.created_at || 0).getTime();
            if (!Number.isFinite(time)) return false;
            return time >= startTime && time <= endTime;
        })
        .filter(item => matchFinanceWithConnection(item, connection, mode))
        .map(item => {
            const amount = Math.abs(Number(item?.amount || 0));
            if (!Number.isFinite(amount) || amount <= 0) return null;
            return {
                user_id: userId,
                connection_id: connection.id,
                provider: connection.provider,
                bank_name: connection.bank_name,
                account_mask: connection.account_mask || null,
                statement_date: normalizeFinanceDateTimeForDb(item?.transaction_date || item?.created_at || new Date().toISOString()),
                statement_type: String(item?.type || '').toLowerCase() === 'expense' ? 'debit' : 'credit',
                amount,
                currency: 'CNY',
                description: `${item?.category || '账本'}：${String(item?.description || '').trim() || '无备注'}`,
                source_channel: 'erp_ledger',
                external_ref: `erp_finance:${item?.id}`,
                ext_payload: {
                    finance_id: item?.id || null,
                    category: item?.category || null
                }
            };
        })
        .filter(Boolean);
}

async function upsertPersonalBankStatementEntries(entries = []) {
    const list = Array.isArray(entries) ? entries : [];
    if (!list.length) return 0;

    if (personalBankingState.useLocalFallback || typeof supabaseClient === 'undefined') {
        const localData = loadLocalPersonalBankingData();
        const existingRefs = new Set((localData.statementEntries || []).map(item => String(item?.external_ref || '')));
        const toInsert = list.filter(item => {
            const ref = String(item?.external_ref || '');
            if (!ref || existingRefs.has(ref)) {
                return false;
            }
            existingRefs.add(ref);
            return true;
        }).map(item => ({ ...item, id: `local_stmt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` }));
        localData.statementEntries = [...toInsert, ...(localData.statementEntries || [])];
        saveLocalPersonalBankingData(localData);
        personalBankingState.statementEntries = localData.statementEntries;
        return toInsert.length;
    }

    const { data, error } = await supabaseClient
        .from(PERSONAL_BANKING_TABLES.statementEntries)
        .upsert(list, { onConflict: 'user_id,external_ref' })
        .select('id');
    if (error) throw error;
    return Array.isArray(data) ? data.length : 0;
}

async function appendPersonalBankSyncLog(payload) {
    const row = {
        user_id: getCurrentERPUserId(),
        connection_id: payload?.connection_id || null,
        provider: payload?.provider || null,
        bank_name: payload?.bank_name || '',
        range_start: payload?.range_start || null,
        range_end: payload?.range_end || null,
        status: payload?.status || 'failed',
        inserted_count: Number(payload?.inserted_count || 0),
        message: payload?.message || '',
        created_at: payload?.created_at || new Date().toISOString()
    };

    if (personalBankingState.useLocalFallback || typeof supabaseClient === 'undefined') {
        const localData = loadLocalPersonalBankingData();
        localData.syncLogs = [row, ...(localData.syncLogs || [])].slice(0, 50);
        saveLocalPersonalBankingData(localData);
        personalBankingState.syncLogs = localData.syncLogs;
        return;
    }

    const { error } = await supabaseClient.from(PERSONAL_BANKING_TABLES.syncLogs).insert([row]);
    if (error) throw error;
}

async function updatePersonalBankConnectionLastSync(connectionId, syncTimeIso) {
    const idText = String(connectionId || '').trim();
    if (!idText) return;

    personalBankingState.connections = personalBankingState.connections.map(item => {
        if (String(item?.id || '') !== idText) return item;
        return { ...item, last_synced_at: syncTimeIso };
    });

    if (personalBankingState.useLocalFallback || typeof supabaseClient === 'undefined') {
        syncLocalPersonalBankingFromState();
        return;
    }

    const userId = getCurrentERPUserId();
    const { error } = await supabaseClient
        .from(PERSONAL_BANKING_TABLES.connections)
        .update({ last_synced_at: syncTimeIso })
        .eq('id', idText)
        .eq('user_id', userId);
    if (error && !isTableMissingError(error)) {
        throw error;
    }
}

async function runPersonalBankSync() {
    const userId = await ensureERPUserSessionReady();
    if (!userId) {
        showToast('请先登录后再执行同步', 'error');
        return;
    }

    clearModalFieldValidation('personalBankSyncModal');
    const connectionId = String(document.getElementById('personalBankSyncConnectionId')?.value || '').trim();
    const startDate = String(document.getElementById('personalBankSyncStartDate')?.value || '').trim();
    const endDate = String(document.getElementById('personalBankSyncEndDate')?.value || '').trim();
    const mode = String(document.getElementById('personalBankSyncMode')?.value || 'ledger_smart').trim();
    const note = String(document.getElementById('personalBankSyncNote')?.value || '').trim();

    if (!connectionId) {
        markFieldInvalid('personalBankSyncConnectionId', '请选择连接');
        return;
    }
    if (!startDate) {
        markFieldInvalid('personalBankSyncStartDate', '请选择开始日期');
        return;
    }
    if (!endDate) {
        markFieldInvalid('personalBankSyncEndDate', '请选择结束日期');
        return;
    }
    if (new Date(startDate).getTime() > new Date(endDate).getTime()) {
        markFieldInvalid('personalBankSyncEndDate', '结束日期不能早于开始日期');
        return;
    }

    const connection = resolveConnectionById(connectionId);
    if (!connection) {
        showToast('连接不存在，请刷新后重试', 'error');
        return;
    }

    const runBtn = document.querySelector('#personalBankSyncModal .ant-btn-primary');
    const originalText = runBtn?.textContent || '';
    if (runBtn) {
        runBtn.disabled = true;
        runBtn.textContent = '同步中...';
    }

    let logStatus = 'failed';
    let insertedCount = 0;
    let logMessage = '';
    const syncTimeIso = new Date().toISOString();

    try {
        const ledgerMode = mode === 'ledger_strict' ? 'ledger_strict' : 'ledger_smart';
        const ledgerEntries = await buildLedgerSyncEntries(connection, startDate, endDate, ledgerMode);
        const inserted = await upsertPersonalBankStatementEntries(ledgerEntries);
        insertedCount += inserted;
        logStatus = inserted > 0 ? 'success' : 'partial';
        logMessage = inserted > 0
            ? `${ledgerMode === 'ledger_strict' ? '严格匹配' : '智能匹配'}完成，新增${inserted}条`
            : `${ledgerMode === 'ledger_strict' ? '严格匹配' : '智能匹配'}完成，未发现可新增记录（新增0条）`;

        await updatePersonalBankConnectionLastSync(connectionId, syncTimeIso);
        await appendPersonalBankSyncLog({
            connection_id: connection.id,
            provider: 'manual_statement',
            bank_name: connection.bank_name,
            range_start: startDate,
            range_end: endDate,
            status: logStatus,
            inserted_count: insertedCount,
            message: note ? `${logMessage}；备注：${note}` : logMessage,
            created_at: syncTimeIso
        });

        hidePersonalBankSyncModal();
        await refreshPersonalBankingCenter();
        showToast(`同步完成：${logMessage}`, logStatus === 'failed' ? 'error' : 'success');
    } catch (error) {
        console.error('[ERP] 执行个人账单同步失败:', error);
        logMessage = error?.message || '未知错误';
        try {
            await appendPersonalBankSyncLog({
                connection_id: connection.id,
                provider: 'manual_statement',
                bank_name: connection.bank_name,
                range_start: startDate,
                range_end: endDate,
                status: 'failed',
                inserted_count: insertedCount,
                message: note ? `${logMessage}；备注：${note}` : logMessage,
                created_at: syncTimeIso
            });
        } catch (logError) {
            console.error('[ERP] 写入个人账单同步日志失败:', logError);
        }
        await refreshPersonalBankingCenter();
        showToast('同步失败：' + logMessage, 'error');
    } finally {
        if (runBtn) {
            runBtn.disabled = false;
            runBtn.textContent = originalText;
        }
    }
}

function applyFinanceBusinessPreset() {
    const businessType = String(document.getElementById('financeBusinessType')?.value || '').trim();
    const preset = ERP_FINANCE_BUSINESS_PRESET[businessType] || ERP_FINANCE_BUSINESS_PRESET.life_expense;
    const typeSelect = document.getElementById('financeType');
    const categoryInput = document.getElementById('financeCategory');

    if (typeSelect) {
        typeSelect.disabled = false;
        typeSelect.value = preset.type;
    }
    if (categoryInput && !String(categoryInput.value || '').trim()) {
        categoryInput.value = preset.category;
    }
}

function bindFinanceModalBusinessEvents() {
    const form = document.getElementById('financeForm');
    if (!form || form.dataset.businessEventsBound === '1') {
        return;
    }

    document.getElementById('financeBusinessType')?.addEventListener('change', () => {
        const categoryInput = document.getElementById('financeCategory');
        if (categoryInput) {
            categoryInput.value = '';
        }
        applyFinanceBusinessPreset();
    });
    form.dataset.businessEventsBound = '1';
}

function showFinanceModal() {
    const modal = document.getElementById('financeModal');
    if (!modal) {
        console.error('[ERP Ant] 找不到 financeModal 元素');
        return;
    }

    const form = document.getElementById('financeForm');
    if (!form) {
        return;
    }

    form.reset();
    document.getElementById('financeId').value = '';
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('financeTransactionDate').value = `${year}-${month}-${day}T${hours}:${minutes}`;
    document.getElementById('financeBusinessType').value = 'life_expense';
    document.getElementById('financeType').value = 'expense';
    document.getElementById('financeCategory').value = '生活消费';

    bindFinanceModalBusinessEvents();
    applyFinanceBusinessPreset();
    modal.classList.add('active');
    modal.style.display = 'flex';
    clearModalFieldValidation('financeModal');
}

function hideFinanceModal() {
    const modal = document.getElementById('financeModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.style.display = '';
}

async function saveFinance() {
    clearModalFieldValidation('financeModal');
    const businessType = String(document.getElementById('financeBusinessType')?.value || '').trim() || 'life_expense';
    const type = String(document.getElementById('financeType')?.value || '').trim() || 'expense';
    const categoryInput = document.getElementById('financeCategory');
    const amountInput = document.getElementById('financeAmount');
    const description = String(document.getElementById('financeDescription')?.value || '').trim();
    const transactionDateRaw = document.getElementById('financeTransactionDate')?.value;
    const transactionDate = normalizeFinanceDateTimeForDb(transactionDateRaw);
    const amount = toAmount(amountInput?.value, NaN);

    if (!transactionDate) {
        showToast('交易时间格式错误', 'error');
        return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
        markFieldInvalid('financeAmount', '请输入金额');
        return;
    }

    const preset = ERP_FINANCE_BUSINESS_PRESET[businessType] || ERP_FINANCE_BUSINESS_PRESET.life_expense;
    const category = String(categoryInput?.value || '').trim() || preset.category;
    const financeData = {
        business_type: businessType,
        type: preset.type || type,
        category,
        amount,
        description,
        transaction_date: transactionDate
    };

    const saveBtn = document.querySelector('#financeModal .ant-btn-primary');
    const originalText = saveBtn ? saveBtn.textContent : '';
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';
    }

    try {
        hideFinanceModal();
        const result = await ERP.addFinance(financeData);
        if (result) {
            const finances = await ERP.loadFinances(true);
            const generalRows = getGeneralFinanceRecords(finances);
            syncFinanceViewRows(generalRows, 'all');
            renderFinances(generalRows);
            applyBankBusinessFilters();
            updateStatistics();
            showToast('财务记录保存成功', 'success');
        }
    } catch (error) {
        console.error('[ERP Ant] 保存财务记录失败:', error);
        showToast('保存失败：' + (error.message || '网络错误，请检查连接'), 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
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
            const generalRows = getGeneralFinanceRecords(finances);
            
            // 检查 renderFinances 函数是否存在
            if (typeof renderFinances === 'function') {
                erpDebugLog('info', '[ERP Ant] renderFinances 函数存在，正在调用...');
                syncFinanceViewRows(generalRows, 'all');
                renderFinances(generalRows);
                erpDebugLog('info', '[ERP Ant] renderFinances 调用完成');
            } else {
                console.error('[ERP Ant] renderFinances 函数不存在！');
            }
            if (typeof applyBankBusinessFilters === 'function') {
                applyBankBusinessFilters();
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
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    const raw = String(value || '').trim();
    if (!raw) {
        return null;
    }

    const hasExplicitTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
    if (!hasExplicitTimezone) {
        const plainMatch = raw.match(
            /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
        );
        if (plainMatch) {
            const year = Number(plainMatch[1]);
            const month = Number(plainMatch[2]);
            const day = Number(plainMatch[3]);
            const hour = Number(plainMatch[4] || 0);
            const minute = Number(plainMatch[5] || 0);
            const second = Number(plainMatch[6] || 0);
            const utcMs = Date.UTC(year, month - 1, day, hour - 8, minute, second);
            const shanghaiDate = new Date(utcMs);
            return Number.isNaN(shanghaiDate.getTime()) ? null : shanghaiDate;
        }
    }

    const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
}

function parseERPDate(value) {
    return parseFinanceDate(value);
}

function getFinanceRangeFromPreset(preset) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    switch (preset) {
        case 'today':
            return { start: todayStart, end: todayEnd };
        case 'thisWeek': {
            const day = now.getDay();
            const mondayOffset = day === 0 ? -6 : (1 - day);
            const start = new Date(todayStart);
            start.setDate(start.getDate() + mondayOffset);
            return { start, end: todayEnd };
        }
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

function parseFinanceAmountFilterValue(rawValue) {
    const text = String(rawValue ?? '').trim();
    if (!text) {
        return null;
    }
    const parsed = Number(text);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return null;
    }
    return parsed;
}

function getFinanceRangePresetText(preset) {
    const map = {
        all: '全部',
        today: '今天',
        thisWeek: '本周',
        yesterday: '昨天',
        last7: '近7天',
        last30: '近30天',
        thisMonth: '本月',
        custom: '自定义'
    };
    return map[String(preset || 'all')] || '全部';
}

function updateFinanceFilterSummary(summary = {}) {
    const summaryEl = document.getElementById('financeFilterSummary');
    if (!summaryEl) {
        return;
    }

    const parts = [];
    if (summary.rangePreset && summary.rangePreset !== 'all') {
        parts.push(`日期：${getFinanceRangePresetText(summary.rangePreset)}`);
    }
    if (summary.keyword) {
        parts.push(`关键词：${summary.keyword}`);
    }
    if (summary.typeFilter && summary.typeFilter !== 'all') {
        const typeText = summary.typeFilter === 'income'
            ? '收入'
            : (summary.typeFilter === 'expense' ? '支出' : '系统');
        parts.push(`类型：${typeText}`);
    }
    if (summary.linkedFilter && summary.linkedFilter !== 'all') {
        parts.push(`关联：${summary.linkedFilter === 'linked' ? '仅已关联' : '仅未关联'}`);
    }
    if (summary.minAmount !== null || summary.maxAmount !== null) {
        const minText = summary.minAmount !== null ? formatCurrency(summary.minAmount) : '不限';
        const maxText = summary.maxAmount !== null ? formatCurrency(summary.maxAmount) : '不限';
        parts.push(`金额：${minText} ~ ${maxText}`);
    }

    const total = Number.isFinite(Number(summary.total)) ? Number(summary.total) : 0;
    const matched = Number.isFinite(Number(summary.matched)) ? Number(summary.matched) : 0;
    if (!parts.length) {
        summaryEl.textContent = `当前筛选：全部数据 · 共 ${matched}/${total} 条`;
        return;
    }
    summaryEl.textContent = `当前筛选：${parts.join(' ｜ ')} · 共 ${matched}/${total} 条`;
}

function applyFinanceFilters() {
    const keyword = String(document.getElementById('financeSearch')?.value || '').trim().toLowerCase();
    const rangePreset = String(document.getElementById('financeDateRange')?.value || 'all');
    const customStart = String(document.getElementById('financeDateStart')?.value || '').trim();
    const customEnd = String(document.getElementById('financeDateEnd')?.value || '').trim();
    const typeFilter = String(document.getElementById('financeTypeFilter')?.value || 'all').trim().toLowerCase();
    const linkedFilter = String(document.getElementById('financeOrderLinkFilter')?.value || 'all').trim().toLowerCase();
    let minAmount = parseFinanceAmountFilterValue(document.getElementById('financeAmountMin')?.value);
    let maxAmount = parseFinanceAmountFilterValue(document.getElementById('financeAmountMax')?.value);

    if (minAmount !== null && maxAmount !== null && minAmount > maxAmount) {
        const temp = minAmount;
        minAmount = maxAmount;
        maxAmount = temp;
    }

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

    const sourceRows = getGeneralFinanceRecords(Array.isArray(ERP.state.finances) ? ERP.state.finances : []);
    const filtered = sourceRows.filter(finance => {
        const targetDate = parseFinanceDate(finance?.transaction_date);
        if ((startDate || endDate) && !targetDate) {
            return false;
        }

        const linkedOrderId = finance?.order_id ?? finance?.reference_id;
        const linkedOrderIdText = String(linkedOrderId ?? '').trim();
        const hasLinkedOrder = linkedOrderIdText.length > 0;
        const linkedOrder = hasLinkedOrder ? orderMap.get(linkedOrderIdText) : null;
        const linkedCustomer = linkedOrder ? customerMap.get(String(linkedOrder.customer_id)) : null;
        const normalizedType = String(finance?.type || '').trim().toLowerCase();
        const amount = Math.abs(Number(finance?.amount || 0));
        const safeAmount = Number.isFinite(amount) ? amount : 0;

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
        const typeMatch = typeFilter === 'all' || normalizedType === typeFilter;
        const linkedMatch = linkedFilter === 'all'
            || (linkedFilter === 'linked' && hasLinkedOrder)
            || (linkedFilter === 'unlinked' && !hasLinkedOrder);
        const minAmountMatch = minAmount === null || safeAmount >= minAmount;
        const maxAmountMatch = maxAmount === null || safeAmount <= maxAmount;

        return keywordMatch && startMatch && endMatch && typeMatch && linkedMatch && minAmountMatch && maxAmountMatch;
    });

    const isDefaultFilter = rangePreset === 'all'
        && !keyword
        && typeFilter === 'all'
        && linkedFilter === 'all'
        && minAmount === null
        && maxAmount === null;

    syncFinanceViewRows(filtered, isDefaultFilter ? 'all' : 'filtered');
    renderFinances(filtered);
    renderFinanceAgingSummary();
    updateFinanceFilterSummary({
        rangePreset,
        keyword,
        typeFilter,
        linkedFilter,
        minAmount,
        maxAmount,
        total: sourceRows.length,
        matched: filtered.length
    });
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
    const typeSelect = document.getElementById('financeTypeFilter');
    const linkedSelect = document.getElementById('financeOrderLinkFilter');
    const minAmountInput = document.getElementById('financeAmountMin');
    const maxAmountInput = document.getElementById('financeAmountMax');

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
    if (typeSelect) {
        typeSelect.value = 'all';
    }
    if (linkedSelect) {
        linkedSelect.value = 'all';
    }
    if (minAmountInput) {
        minAmountInput.value = '';
    }
    if (maxAmountInput) {
        maxAmountInput.value = '';
    }

    onFinanceDateRangeChange();
}

function initFinanceFilters() {
    const rangeSelect = document.getElementById('financeDateRange');
    const startInput = document.getElementById('financeDateStart');
    const endInput = document.getElementById('financeDateEnd');
    const typeSelect = document.getElementById('financeTypeFilter');
    const linkedSelect = document.getElementById('financeOrderLinkFilter');
    const minAmountInput = document.getElementById('financeAmountMin');
    const maxAmountInput = document.getElementById('financeAmountMax');
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
    if (typeSelect) {
        typeSelect.value = 'all';
    }
    if (linkedSelect) {
        linkedSelect.value = 'all';
    }
    if (minAmountInput) {
        minAmountInput.value = '';
    }
    if (maxAmountInput) {
        maxAmountInput.value = '';
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
    toggleFinanceMoreActions(false);
    syncFinanceMonthlyTargetInput();
    syncFinanceViewRows(getGeneralFinanceRecords(Array.isArray(ERP.state?.finances) ? ERP.state.finances : []), 'all');
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

    const cards = [
        { title: '今日订单', value: `${todayOrdersCount} 笔`, subtitle: '按下单日期统计', color: '#1d39c4' },
        { title: '今日回款', value: formatCurrency(todayReceivedAmount), subtitle: '仅统计回款确认', color: '#08979c' },
        { title: '待回款', value: formatCurrency(pendingReceivableAmount), subtitle: '未支付订单合计', color: '#cf1322' },
        { title: '待付款', value: formatCurrency(pendingPayableAmount), subtitle: '应付账款余额', color: '#d48806' },
        { title: '库存预警', value: `${diagnostics.lowStockCount}/${diagnostics.rows.length}`, subtitle: '库存 ≤ 商品预警值', color: '#7a3d00' },
        { title: '逾期预警', value: `${risk.totalOverdueCount} 笔`, subtitle: `超过30天，总额 ${formatCurrency(risk.totalOverdueAmount)}`, color: '#722ed1' }
    ];

    container.innerHTML = `
        <div class="erp-dashboard-metric-grid">
            ${cards.map(card => `
                <div class="erp-dashboard-metric-card" style="--metric-color:${card.color};">
                    <div class="erp-dashboard-metric-title">${card.title}</div>
                    <div class="erp-dashboard-metric-value">${card.value}</div>
                    <div class="erp-dashboard-metric-sub">${card.subtitle}</div>
                </div>
            `).join('')}
        </div>
    `;
}

function buildSalesFunnelStats() {
    const orders = Array.isArray(ERP.state?.orders) ? ERP.state.orders : [];
    const validOrders = orders.filter(order => {
        const status = normalizeOrderStatusValue(order?.status || '');
        return status !== 'cancelled' && status !== 'refunded';
    });

    const counters = {
        pending: 0,
        confirmed: 0,
        transit: 0,
        completed: 0
    };

    validOrders.forEach(order => {
        const stage = getOrderFulfillmentStage(order);
        if (stage && Object.prototype.hasOwnProperty.call(counters, stage)) {
            counters[stage] += 1;
        }
    });

    const total = validOrders.length;
    const completedRate = total > 0 ? (counters.completed / total) : 0;
    const pendingOver3Days = validOrders.filter(order => getOrderFulfillmentStage(order) === 'pending')
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
            <div class="erp-dashboard-bar-row">
                <span class="erp-dashboard-bar-label">${step.title}</span>
                <div class="erp-dashboard-bar-track">
                    <div class="erp-dashboard-bar-fill" style="width:${widthPercent}%;background:${step.color};"></div>
                </div>
                <span class="erp-dashboard-bar-value">${step.count} 单（${ratioText}）</span>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="erp-dashboard-chart-card">
            <div class="erp-dashboard-chart-header">
                <div class="erp-dashboard-chart-title">销售漏斗</div>
                <div class="erp-dashboard-chart-subtitle">有效订单 ${funnel.total} 笔</div>
            </div>
            <div class="erp-dashboard-chart-body">
                <div class="erp-dashboard-kpi-stack">
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">总订单</div>
                        <div class="erp-dashboard-kpi-value">${funnel.total}</div>
                    </div>
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">完成率</div>
                        <div class="erp-dashboard-kpi-value is-success">${(funnel.completedRate * 100).toFixed(1)}%</div>
                    </div>
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">超3天待审批</div>
                        <div class="erp-dashboard-kpi-value is-danger">${funnel.pendingOver3Days} 单</div>
                    </div>
                </div>
                <div class="erp-dashboard-bar-list">
                    ${barsHtml || '<div class="erp-dashboard-chart-subtitle">暂无订单数据</div>'}
                </div>
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
        const shippingStatus = normalizeShippingStatusValue(order?.shipping_status || 'not_shipped');
        const orderLogs = logMap.get(orderId) || [];

        const signedLog = orderLogs.find(item => item?.toStatus === 'signed')
            || orderLogs.find(item => item?.toStatus === 'completed');

        if (signedLog && (status === 'signed' || status === 'completed' || shippingStatus === 'delivered')) {
            const diffDays = Math.max(0, Math.floor((signedLog.createdAt.getTime() - orderDate.getTime()) / (24 * 60 * 60 * 1000)));
            deliveredDays.push(diffDays);
            return;
        }

        const fallbackCompletedAt = parseFinanceDate(
            order?.signed_at
            || order?.delivered_at
            || order?.updated_at
            || order?.modified_at
            || order?.created_at
        );
        if ((status === 'signed' || status === 'completed' || shippingStatus === 'delivered') && fallbackCompletedAt) {
            const diffDays = Math.max(0, Math.floor((fallbackCompletedAt.getTime() - orderDate.getTime()) / (24 * 60 * 60 * 1000)));
            deliveredDays.push(diffDays);
            return;
        }

        if (status === 'shipped' || ['shipped', 'in_transit'].includes(shippingStatus)) {
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
        <div class="erp-dashboard-chart-card">
            <div class="erp-dashboard-chart-header">
                <div class="erp-dashboard-chart-title">订单交付时效</div>
                <div class="erp-dashboard-chart-subtitle">加载中...</div>
            </div>
        </div>
    `;

    const logs = await loadDashboardOrderStatusLogs(orders);
    const perf = calculateOrderDeliveryPerformance(orders, logs);
    const totalDelivered = Math.max(perf.deliveredCount, 1);
    const bar = (label, value, color) => {
        const width = Math.max(6, Math.round((value / totalDelivered) * 100));
        return `
            <div class="erp-dashboard-bar-row">
                <span class="erp-dashboard-bar-label">${label}</span>
                <div class="erp-dashboard-bar-track">
                    <div class="erp-dashboard-bar-fill" style="width:${width}%;background:${color};"></div>
                </div>
                <span class="erp-dashboard-bar-value">${value} 单</span>
            </div>
        `;
    };

    container.innerHTML = `
        <div class="erp-dashboard-chart-card">
            <div class="erp-dashboard-chart-header">
                <div class="erp-dashboard-chart-title">订单交付时效</div>
                <div class="erp-dashboard-chart-subtitle">可计算签收 ${perf.deliveredCount} 单</div>
            </div>
            <div class="erp-dashboard-chart-body">
                <div class="erp-dashboard-kpi-stack">
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">平均签收时长</div>
                        <div class="erp-dashboard-kpi-value">${perf.avgDays.toFixed(1)} 天</div>
                    </div>
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">P80 时长</div>
                        <div class="erp-dashboard-kpi-value is-warning">${perf.p80Days} 天</div>
                    </div>
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">3天内签收率</div>
                        <div class="erp-dashboard-kpi-value is-success">${(perf.onTimeRate * 100).toFixed(1)}%</div>
                    </div>
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">在途超5天</div>
                        <div class="erp-dashboard-kpi-value is-danger">${perf.longTransitCount} 单</div>
                    </div>
                </div>
                <div class="erp-dashboard-bar-list">
                    ${bar('1天内签收', perf.bucket.d1, '#1677ff')}
                    ${bar('2-3天签收', perf.bucket.d3, '#13c2c2')}
                    ${bar('4-7天签收', perf.bucket.d7, '#faad14')}
                    ${bar('7天以上签收', perf.bucket.d7p, '#f5222d')}
                    <div class="erp-dashboard-chart-subtitle">在途订单 ${perf.inTransitCount} 单；基于状态日志 + 订单更新时间兜底计算</div>
                </div>
            </div>
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

    const totalQuantity = ranked.reduce((sum, item) => sum + Number(item?.quantity || 0), 0);
    const totalRevenue = ranked.reduce((sum, item) => sum + Number(item?.revenue || 0), 0);
    const maxQuantity = Math.max(1, ...ranked.map(item => Number(item?.quantity || 0)));

    const rankRowsHtml = ranked.map((item, index) => {
        const quantity = Number(item?.quantity || 0);
        const widthPercent = Math.max(6, Math.round((quantity / maxQuantity) * 100));
        return `
            <div class="erp-dashboard-bar-row">
                <span class="erp-dashboard-bar-label">${index + 1}. ${item.productName}</span>
                <div class="erp-dashboard-bar-track">
                    <div class="erp-dashboard-bar-fill" style="width:${widthPercent}%;background:#1677ff;"></div>
                </div>
                <span class="erp-dashboard-bar-value">${quantity} 件</span>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="erp-dashboard-chart-card">
            <div class="erp-dashboard-chart-header">
                <div class="erp-dashboard-chart-title">产品销量分布</div>
                <div class="erp-dashboard-chart-subtitle">有效订单 ${validOrders.length} 笔</div>
            </div>
            <div class="erp-dashboard-chart-body">
                <div class="erp-dashboard-kpi-stack">
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">TOP商品数</div>
                        <div class="erp-dashboard-kpi-value">${ranked.length}</div>
                    </div>
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">TOP销量总计</div>
                        <div class="erp-dashboard-kpi-value is-success">${totalQuantity}</div>
                    </div>
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">TOP销售额</div>
                        <div class="erp-dashboard-kpi-value">${formatCurrency(totalRevenue)}</div>
                    </div>
                </div>
                <div class="erp-dashboard-bar-list">
                    ${rankRowsHtml || '<div class="erp-dashboard-chart-subtitle">暂无订单商品数据</div>'}
                </div>
            </div>
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
    const widthBase = Math.max(...ranking.map(row => Math.abs(Number(row?.profit || 0))), 1);

    const rowsHtml = ranking.map((item, index) => {
        const margin = item.revenue > 0 ? ((item.profit / item.revenue) * 100) : 0;
        const profit = Number(item?.profit || 0);
        const widthPercent = Math.max(6, Math.round((Math.abs(profit) / widthBase) * 100));
        const color = profit >= 0 ? '#13c2c2' : '#f5222d';
        return `
            <div class="erp-dashboard-bar-row">
                <span class="erp-dashboard-bar-label">${index + 1}. ${item.productName}</span>
                <div class="erp-dashboard-bar-track">
                    <div class="erp-dashboard-bar-fill" style="width:${widthPercent}%;background:${color};"></div>
                </div>
                <span class="erp-dashboard-bar-value">利润 ${formatCurrency(item.profit)} / ${margin.toFixed(1)}%</span>
            </div>
        `;
    }).join('');

    const positiveCount = ranking.filter(item => Number(item?.profit || 0) >= 0).length;
    const avgMargin = ranking.length > 0
        ? ranking.reduce((sum, item) => {
            const revenue = Number(item?.revenue || 0);
            const profit = Number(item?.profit || 0);
            const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
            return sum + margin;
        }, 0) / ranking.length
        : 0;

    container.innerHTML = `
        <div class="erp-dashboard-chart-card">
            <div class="erp-dashboard-chart-header">
                <div class="erp-dashboard-chart-title">产品销售金额分布</div>
                <div class="erp-dashboard-chart-subtitle">TOP利润 ${formatCurrency(totalProfit)}</div>
            </div>
            <div class="erp-dashboard-chart-body">
                <div class="erp-dashboard-kpi-stack">
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">TOP商品数</div>
                        <div class="erp-dashboard-kpi-value">${ranking.length}</div>
                    </div>
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">盈利商品</div>
                        <div class="erp-dashboard-kpi-value is-success">${positiveCount}</div>
                    </div>
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">平均毛利率</div>
                        <div class="erp-dashboard-kpi-value ${avgMargin >= 0 ? 'is-success' : 'is-danger'}">${avgMargin.toFixed(1)}%</div>
                    </div>
                </div>
                <div class="erp-dashboard-bar-list">
                    ${rowsHtml || '<div class="erp-dashboard-chart-subtitle">暂无可计算利润数据</div>'}
                </div>
            </div>
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

    const stageRows = [
        { label: '新客', value: lifecycle.summary.newCustomers, color: '#1677ff' },
        { label: '活跃', value: lifecycle.summary.activeCustomers, color: '#13c2c2' },
        { label: '沉睡', value: lifecycle.summary.sleepingCustomers, color: '#fa8c16' }
    ];
    const maxStageValue = Math.max(1, ...stageRows.map(item => Number(item?.value || 0)));
    const stageBarsHtml = stageRows.map(item => {
        const widthPercent = Math.max(6, Math.round((Number(item?.value || 0) / maxStageValue) * 100));
        return `
            <div class="erp-dashboard-bar-row">
                <span class="erp-dashboard-bar-label">${item.label}</span>
                <div class="erp-dashboard-bar-track">
                    <div class="erp-dashboard-bar-fill" style="width:${widthPercent}%;background:${item.color};"></div>
                </div>
                <span class="erp-dashboard-bar-value">${item.value} 人</span>
            </div>
        `;
    }).join('');

    const customerRowsHtml = lifecycle.rows.slice(0, 5).map(item => `
        <div class="erp-dashboard-chart-subtitle">
            ${item.customerName}：${item.orderCount}单 / ${formatCurrency(item.totalAmount)}（最近${Number.isFinite(item.lastDays) ? `${item.lastDays}天` : '-'}）
        </div>
    `).join('');

    container.innerHTML = `
        <div class="erp-dashboard-chart-card">
            <div class="erp-dashboard-chart-header">
                <div class="erp-dashboard-chart-title">客户生命周期</div>
                <div class="erp-dashboard-chart-subtitle">客户 ${lifecycle.summary.totalCustomers} 人</div>
            </div>
            <div class="erp-dashboard-chart-body">
                <div class="erp-dashboard-kpi-stack">
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">客户总数</div>
                        <div class="erp-dashboard-kpi-value">${lifecycle.summary.totalCustomers}</div>
                    </div>
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">新客</div>
                        <div class="erp-dashboard-kpi-value is-success">${lifecycle.summary.newCustomers}</div>
                    </div>
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">活跃</div>
                        <div class="erp-dashboard-kpi-value">${lifecycle.summary.activeCustomers}</div>
                    </div>
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">沉睡</div>
                        <div class="erp-dashboard-kpi-value is-warning">${lifecycle.summary.sleepingCustomers}</div>
                    </div>
                </div>
                <div class="erp-dashboard-bar-list">
                    ${stageBarsHtml}
                    ${customerRowsHtml || '<div class="erp-dashboard-chart-subtitle">暂无客户生命周期数据</div>'}
                </div>
            </div>
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
    const segmentRows = [
        { label: '核心价值', value: rfm.summary.highValue, color: '#237804' },
        { label: '成长维护', value: rfm.summary.growth, color: '#1677ff' },
        { label: '普通维系', value: rfm.summary.normal, color: '#fa8c16' },
        { label: '召回预警', value: rfm.summary.risk, color: '#cf1322' }
    ];
    const maxSegmentValue = Math.max(1, ...segmentRows.map(item => Number(item?.value || 0)));
    const segmentBarsHtml = segmentRows.map(item => {
        const widthPercent = Math.max(6, Math.round((Number(item?.value || 0) / maxSegmentValue) * 100));
        return `
            <div class="erp-dashboard-bar-row">
                <span class="erp-dashboard-bar-label">${item.label}</span>
                <div class="erp-dashboard-bar-track">
                    <div class="erp-dashboard-bar-fill" style="width:${widthPercent}%;background:${item.color};"></div>
                </div>
                <span class="erp-dashboard-bar-value">${item.value} 人</span>
            </div>
        `;
    }).join('');

    const avgScore = rfm.rows.length > 0
        ? rfm.rows.reduce((sum, item) => sum + Number(item?.totalScore || 0), 0) / rfm.rows.length
        : 0;

    const rowsHtml = rfm.rows.slice(0, 6).map(item => `
        <div class="erp-dashboard-chart-subtitle">
            ${item.customerName}：${item.segment}（R${item.scoreR}F${item.scoreF}M${item.scoreM}） ${item.frequency}单 / ${formatCurrency(item.monetary)}
        </div>
    `).join('');

    container.innerHTML = `
        <div class="erp-dashboard-chart-card">
            <div class="erp-dashboard-chart-header">
                <div class="erp-dashboard-chart-title">客户RFM评分</div>
                <div class="erp-dashboard-chart-subtitle">客户 ${rfm.summary.totalCustomers} 人</div>
            </div>
            <div class="erp-dashboard-chart-body">
                <div class="erp-dashboard-kpi-stack">
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">平均RFM总分</div>
                        <div class="erp-dashboard-kpi-value">${avgScore.toFixed(1)}</div>
                    </div>
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">核心价值客户</div>
                        <div class="erp-dashboard-kpi-value is-success">${rfm.summary.highValue}</div>
                    </div>
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">召回预警客户</div>
                        <div class="erp-dashboard-kpi-value is-danger">${rfm.summary.risk}</div>
                    </div>
                </div>
                <div class="erp-dashboard-bar-list">
                    ${segmentBarsHtml}
                    ${rowsHtml || '<div class="erp-dashboard-chart-subtitle">暂无可评分客户</div>'}
                </div>
            </div>
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
        toDateTimeText(item.purchaseDate || '-'),
        item.supplier || '-',
        item.productName || '-',
        Number(item.quantity || 0),
        Number(item.unitCost || 0).toFixed(2),
        Number(item.amount || 0).toFixed(2),
        paymentStatusMap[String(item.paymentStatus || '').toLowerCase()] || String(item.paymentStatus || '-'),
        formatPurchaseApprovalStatus(item.approvalStatus),
        item.approvalOperator || '-',
        toDateTimeText(item.approvalTime || '-'),
        item.approvalNote || '-',
        item.rollbackStatus || '-',
        toDateTimeText(item.rollbackTime || '-'),
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
            toDateTimeText(item.purchaseDate || '-'),
            item.productName || '-',
            Number(item.quantity || 0),
            Number(item.unitCost || 0).toFixed(2),
            Number(item.amount || 0).toFixed(2),
            formatPurchaseApprovalStatus(item.approvalStatus),
            item.approvalOperator || '-',
            toDateTimeText(item.approvalTime || '-'),
            item.approvalNote || '-',
            item.rollbackStatus || '-',
            toDateTimeText(item.rollbackTime || '-'),
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
            <td>${escapeHtmlText(toDateTimeText(item.purchaseDate || '-'))}</td>
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
            <div class="meta">供应商：${escapeHtmlText(supplierName)} ｜ 月份：${escapeHtmlText(monthInput)} ｜ 生成时间：${toDateTimeText(new Date())}</div>
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

    const riskRows = [
        { label: '紧急/低预警', value: Number(stats?.summary?.urgent || 0), color: '#cf1322' },
        { label: '7天风险', value: Number(stats?.summary?.warning || 0), color: '#d48806' },
        { label: '建议补货', value: Number(stats?.summary?.suggest || 0), color: '#1677ff' }
    ];
    const maxRiskValue = Math.max(1, ...riskRows.map(item => Number(item?.value || 0)));
    const riskBarsHtml = riskRows.map(item => {
        const widthPercent = Math.max(6, Math.round((Number(item?.value || 0) / maxRiskValue) * 100));
        return `
            <div class="erp-dashboard-bar-row">
                <span class="erp-dashboard-bar-label">${item.label}</span>
                <div class="erp-dashboard-bar-track">
                    <div class="erp-dashboard-bar-fill" style="width:${widthPercent}%;background:${item.color};"></div>
                </div>
                <span class="erp-dashboard-bar-value">${item.value} 个</span>
            </div>
        `;
    }).join('');

    const recommendRows = stats.rows.slice(0, 5);
    const maxRecommendQty = Math.max(1, ...recommendRows.map(item => Number(item?.recommendQty || 0)));
    const recommendRowsHtml = recommendRows.map(item => {
        const coverText = Number.isFinite(item.coverDays) ? `${item.coverDays.toFixed(1)}天` : '∞';
        const levelColor = item.riskLevel >= 3 ? '#cf1322' : (item.riskLevel === 2 ? '#d48806' : '#1677ff');
        const widthPercent = Math.max(6, Math.round((Number(item?.recommendQty || 0) / maxRecommendQty) * 100));
        return `
            <div class="erp-dashboard-bar-row">
                <span class="erp-dashboard-bar-label">${escapeHtmlText(item.productName)}</span>
                <div class="erp-dashboard-bar-track">
                    <div class="erp-dashboard-bar-fill" style="width:${widthPercent}%;background:${levelColor};"></div>
                </div>
                <span class="erp-dashboard-bar-value">补货 ${Number(item?.recommendQty || 0)}</span>
            </div>
            <div class="erp-dashboard-chart-subtitle">
                库存 ${Number(item?.stock || 0)}（预警 ${Number(item?.minStock || 0)}）/ 30天销量 ${Number(item?.sold30 || 0)} / 可售 ${coverText}
                <button class="ant-btn erp-btn-compact erp-btn-blue" style="margin-left:8px;"
                    onclick='createPurchaseFromRestock(${JSON.stringify(item.productId)}, ${Number(item.recommendQty || 0)})'>生成待付采购</button>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="erp-dashboard-chart-card">
            <div class="erp-dashboard-chart-header">
                <div class="erp-dashboard-chart-title">智能补货建议</div>
                <div class="erp-dashboard-chart-subtitle">建议总量 ${Number(stats?.summary?.totalRecommendQty || 0)}</div>
            </div>
            <div class="erp-dashboard-chart-body">
                <div class="erp-dashboard-kpi-stack">
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">建议补货总量</div>
                        <div class="erp-dashboard-kpi-value is-danger">${Number(stats?.summary?.totalRecommendQty || 0)}</div>
                    </div>
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">建议商品数</div>
                        <div class="erp-dashboard-kpi-value">${stats.rows.length}</div>
                    </div>
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">紧急商品</div>
                        <div class="erp-dashboard-kpi-value is-warning">${Number(stats?.summary?.urgent || 0)}</div>
                    </div>
                    <button class="ant-btn ant-btn-primary" type="button" onclick="createBulkPurchaseFromRestockRecommendations()"
                        ${stats.rows.length > 0 ? '' : 'disabled'}>
                        一键生成建议补货待付采购单
                    </button>
                </div>
                <div class="erp-dashboard-bar-list">
                    ${riskBarsHtml}
                    ${recommendRowsHtml || '<div class="erp-dashboard-chart-subtitle">当前暂无补货建议</div>'}
                </div>
            </div>
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
    const parseOrderDate = (typeof parseERPDate === 'function')
        ? parseERPDate
        : ((typeof parseFinanceDate === 'function')
            ? parseFinanceDate
            : (value => {
                const raw = String(value || '').trim();
                if (!raw) return null;
                const date = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'));
                return Number.isNaN(date.getTime()) ? null : date;
            }));
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentOrderSet = new Set(
        validOrders
            .filter(order => {
                const date = parseOrderDate(order?.order_date || null);
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

    const topRows = rows.slice(0, 6);
    const maxStockValue = Math.max(1, ...topRows.map(item => Number(item?.stockValue || 0)));
    const capitalBarsHtml = topRows.map(item => {
        const turnoverText = item.turnoverDays === null ? '暂无销量' : `${item.turnoverDays.toFixed(1)}天`;
        const levelColor = item.riskLevel >= 3 ? '#cf1322' : (item.riskLevel === 2 ? '#d48806' : '#1677ff');
        const widthPercent = Math.max(6, Math.round((Number(item?.stockValue || 0) / maxStockValue) * 100));
        return `
            <div class="erp-dashboard-bar-row">
                <span class="erp-dashboard-bar-label">${escapeHtmlText(item.name)}</span>
                <div class="erp-dashboard-bar-track">
                    <div class="erp-dashboard-bar-fill" style="width:${widthPercent}%;background:${levelColor};"></div>
                </div>
                <span class="erp-dashboard-bar-value">${formatCurrency(item.stockValue)}</span>
            </div>
            <div class="erp-dashboard-chart-subtitle">库存 ${item.stock} / 单位成本 ${formatCurrency(item.unitCost)} / 周转 ${turnoverText} / 30天销量 ${item.soldQty30}</div>
        `;
    }).join('');

    const highRiskRows = rows
        .filter(item => Number(item?.riskLevel || 0) >= 2)
        .slice(0, 3)
        .map(item => {
            const turnoverText = item.turnoverDays === null ? '暂无销量' : `${item.turnoverDays.toFixed(1)}天`;
            return `<div class="erp-dashboard-chart-subtitle">${escapeHtmlText(item.name)}：周转 ${turnoverText}，占用 ${formatCurrency(item.stockValue)}</div>`;
        })
        .join('');

    container.innerHTML = `
        <div class="erp-dashboard-chart-card">
            <div class="erp-dashboard-chart-header">
                <div class="erp-dashboard-chart-title">库存资金占用与周转</div>
                <div class="erp-dashboard-chart-subtitle">库存资金 ${formatCurrency(totalCapital)}</div>
            </div>
            <div class="erp-dashboard-chart-body">
                <div class="erp-dashboard-kpi-stack">
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">库存资金占用</div>
                        <div class="erp-dashboard-kpi-value">${formatCurrency(totalCapital)}</div>
                    </div>
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">高风险商品</div>
                        <div class="erp-dashboard-kpi-value is-danger">${highRiskCount}</div>
                    </div>
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">慢周转商品</div>
                        <div class="erp-dashboard-kpi-value is-warning">${slowTurnoverCount}</div>
                    </div>
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">在库商品数</div>
                        <div class="erp-dashboard-kpi-value">${rows.length}</div>
                    </div>
                </div>
                <div class="erp-dashboard-bar-list">
                    ${capitalBarsHtml || '<div class="erp-dashboard-chart-subtitle">暂无库存数据</div>'}
                    ${highRiskRows}
                </div>
            </div>
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

    const reasonRows = [
        { label: '负毛利', value: Number(stats?.summary?.negativeCount || 0), color: '#cf1322' },
        { label: '低毛利(<10%)', value: Number(stats?.summary?.lowCount || 0), color: '#d48806' },
        { label: '成本缺失', value: Number(stats?.summary?.missingCostCount || 0), color: '#1677ff' }
    ];
    const maxReasonValue = Math.max(1, ...reasonRows.map(item => Number(item?.value || 0)));
    const reasonBarsHtml = reasonRows.map(item => {
        const widthPercent = Math.max(6, Math.round((Number(item?.value || 0) / maxReasonValue) * 100));
        return `
            <div class="erp-dashboard-bar-row">
                <span class="erp-dashboard-bar-label">${item.label}</span>
                <div class="erp-dashboard-bar-track">
                    <div class="erp-dashboard-bar-fill" style="width:${widthPercent}%;background:${item.color};"></div>
                </div>
                <span class="erp-dashboard-bar-value">${item.value} 单</span>
            </div>
        `;
    }).join('');

    const topRows = stats.anomalyRows.slice(0, 6);
    const maxRiskRevenue = Math.max(1, ...topRows.map(item => Number(item?.revenue || 0)));
    const rowsHtml = topRows.map(item => {
        const levelColor = item.level >= 4 ? '#cf1322' : (item.level === 3 ? '#d48806' : '#1677ff');
        const marginText = item.margin === null ? '-' : `${(item.margin * 100).toFixed(1)}%`;
        const widthPercent = Math.max(6, Math.round((Number(item?.revenue || 0) / maxRiskRevenue) * 100));
        return `
            <div class="erp-dashboard-bar-row">
                <span class="erp-dashboard-bar-label">${escapeHtmlText(item.orderNumber)}</span>
                <div class="erp-dashboard-bar-track">
                    <div class="erp-dashboard-bar-fill" style="width:${widthPercent}%;background:${levelColor};"></div>
                </div>
                <span class="erp-dashboard-bar-value">${escapeHtmlText(item.reason)}</span>
            </div>
            <div class="erp-dashboard-chart-subtitle">
                ${escapeHtmlText(item.customerName)}：收入 ${formatCurrency(item.revenue)} / 成本 ${formatCurrency(item.cost)} / 毛利 ${formatCurrency(item.profit)} / 毛利率 ${marginText}
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="erp-dashboard-chart-card">
            <div class="erp-dashboard-chart-header">
                <div class="erp-dashboard-chart-title">毛利异常检测</div>
                <div class="erp-dashboard-chart-subtitle">异常 ${Number(stats?.summary?.total || 0)} 单</div>
            </div>
            <div class="erp-dashboard-chart-body">
                <div class="erp-dashboard-kpi-stack">
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">异常订单总数</div>
                        <div class="erp-dashboard-kpi-value is-danger">${Number(stats?.summary?.total || 0)}</div>
                    </div>
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">负毛利订单</div>
                        <div class="erp-dashboard-kpi-value is-danger">${Number(stats?.summary?.negativeCount || 0)}</div>
                    </div>
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">低毛利订单</div>
                        <div class="erp-dashboard-kpi-value is-warning">${Number(stats?.summary?.lowCount || 0)}</div>
                    </div>
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">成本缺失订单</div>
                        <div class="erp-dashboard-kpi-value">${Number(stats?.summary?.missingCostCount || 0)}</div>
                    </div>
                </div>
                <div class="erp-dashboard-bar-list">
                    ${reasonBarsHtml}
                    ${rowsHtml || '<div class="erp-dashboard-chart-subtitle">暂无毛利异常订单</div>'}
                </div>
            </div>
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

    const rankBuckets = { level4: 0, level3: 0, level2: 0 };
    ledger.rows.forEach(item => {
        const rank = Number(item?.riskRank || 0);
        if (rank >= 4) rankBuckets.level4 += 1;
        else if (rank >= 3) rankBuckets.level3 += 1;
        else if (rank >= 2) rankBuckets.level2 += 1;
    });

    const rankRows = [
        { label: '风险4级+', value: rankBuckets.level4, color: '#cf1322' },
        { label: '风险3级', value: rankBuckets.level3, color: '#d48806' },
        { label: '风险2级', value: rankBuckets.level2, color: '#1677ff' }
    ];
    const maxRankValue = Math.max(1, ...rankRows.map(item => Number(item?.value || 0)));
    const rankBarsHtml = rankRows.map(item => {
        const widthPercent = Math.max(6, Math.round((Number(item?.value || 0) / maxRankValue) * 100));
        return `
            <div class="erp-dashboard-bar-row">
                <span class="erp-dashboard-bar-label">${item.label}</span>
                <div class="erp-dashboard-bar-track">
                    <div class="erp-dashboard-bar-fill" style="width:${widthPercent}%;background:${item.color};"></div>
                </div>
                <span class="erp-dashboard-bar-value">${item.value} 单</span>
            </div>
        `;
    }).join('');

    const rowsHtml = ledger.rows.slice(0, 6).map(item => {
        const rankColor = item.riskRank >= 4 ? '#cf1322' : '#d48806';
        const marginText = `${(Number(item.grossMargin || 0) * 100).toFixed(1)}%`;
        const reasonText = String(item.approvalReason || '').trim() || '未填写审批原因';
        const reasonColor = item.approvalReason ? '#262626' : '#cf1322';
        const orderDateText = toYmdText(item.orderDate || '-');
        const safeOrderId = escapeHtmlText(String(item.id || ''));
        return `
            <div class="erp-dashboard-chart-subtitle">
                <a href="javascript:void(0)" onclick="openOrderFromRiskLedger('${safeOrderId}')" style="color:#1677ff;">${escapeHtmlText(item.orderNumber)}</a>
                / ${escapeHtmlText(item.customerName)} · 风险${item.riskRank}级 · ${orderDateText}
                · 金额 ${formatCurrency(item.amount)} · 毛利 ${formatCurrency(item.grossProfit)}（${marginText}）
                · <span style="color:${rankColor};">${escapeHtmlText(item.alertsText)}</span>
            </div>
            <div class="erp-dashboard-chart-subtitle" style="color:${reasonColor};">审批原因：${escapeHtmlText(reasonText)}</div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="erp-dashboard-chart-card">
            <div class="erp-dashboard-chart-header">
                <div class="erp-dashboard-chart-title">风控审批台账</div>
                <div class="erp-dashboard-chart-subtitle">高风险 ${ledger.total} 单</div>
            </div>
            <div class="erp-dashboard-chart-body">
                <div class="erp-dashboard-kpi-stack">
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">高风险订单</div>
                        <div class="erp-dashboard-kpi-value is-danger">${ledger.total}</div>
                    </div>
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">已填审批原因</div>
                        <div class="erp-dashboard-kpi-value is-success">${ledger.completedReasonCount}</div>
                    </div>
                    <div class="erp-dashboard-kpi-box">
                        <div class="erp-dashboard-kpi-label">缺失审批原因</div>
                        <div class="erp-dashboard-kpi-value is-warning">${ledger.missingReasonCount}</div>
                    </div>
                </div>
                <div class="erp-dashboard-bar-list">
                    ${rankBarsHtml}
                    ${rowsHtml || '<div class="erp-dashboard-chart-subtitle">暂无高风险订单台账</div>'}
                </div>
            </div>
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

function buildFinanceTrendLineChart(rows = []) {
    const safeRows = Array.isArray(rows) ? rows : [];
    if (!safeRows.length) {
        return '<div style="font-size:12px;color:#999;">暂无数据</div>';
    }

    const width = 860;
    const height = 220;
    const paddingLeft = 48;
    const paddingRight = 16;
    const paddingTop = 14;
    const paddingBottom = 28;
    const innerWidth = Math.max(1, width - paddingLeft - paddingRight);
    const innerHeight = Math.max(1, height - paddingTop - paddingBottom);
    const maxValue = Math.max(
        1,
        ...safeRows.map(row => Math.max(Number(row?.income || 0), Number(row?.expense || 0)))
    );

    const xFor = index => (
        paddingLeft + (safeRows.length <= 1 ? (innerWidth / 2) : (index / (safeRows.length - 1)) * innerWidth)
    );
    const yFor = value => (
        paddingTop + (1 - (Math.max(0, Number(value || 0)) / maxValue)) * innerHeight
    );
    const toPoints = getter => safeRows
        .map((row, index) => `${xFor(index).toFixed(1)},${yFor(getter(row)).toFixed(1)}`)
        .join(' ');

    const incomePoints = toPoints(row => row?.income || 0);
    const expensePoints = toPoints(row => row?.expense || 0);
    const baselineY = paddingTop + innerHeight;
    const incomeAreaPoints = `${paddingLeft},${baselineY} ${incomePoints} ${paddingLeft + innerWidth},${baselineY}`;
    const expenseAreaPoints = `${paddingLeft},${baselineY} ${expensePoints} ${paddingLeft + innerWidth},${baselineY}`;

    const gridFractions = [0, 0.25, 0.5, 0.75, 1];
    const gridLines = gridFractions.map(fraction => {
        const y = (paddingTop + innerHeight * fraction).toFixed(1);
        return `<line x1="${paddingLeft}" y1="${y}" x2="${paddingLeft + innerWidth}" y2="${y}" stroke="#eef2f7" stroke-width="1"></line>`;
    }).join('');
    const yLabels = [1, 0.75, 0.5, 0.25, 0].map(scale => {
        const y = yFor(maxValue * scale).toFixed(1);
        return `<text x="${paddingLeft - 6}" y="${y}" text-anchor="end" dominant-baseline="middle" fill="#94a3b8" font-size="11">${formatChartAxisCurrency(maxValue * scale)}</text>`;
    }).join('');

    const xLabelIndexes = Array.from(new Set([
        0,
        Math.max(0, Math.floor((safeRows.length - 1) * 0.25)),
        Math.max(0, Math.floor((safeRows.length - 1) * 0.5)),
        Math.max(0, Math.floor((safeRows.length - 1) * 0.75)),
        safeRows.length - 1
    ]))
        .filter(index => index >= 0 && index < safeRows.length);
    const xLabels = xLabelIndexes.map(index => {
        const row = safeRows[index];
        return `<text x="${xFor(index).toFixed(1)}" y="${height - 8}" text-anchor="middle" fill="#94a3b8" font-size="11">${escapeHtmlText(row?.label || '')}</text>`;
    }).join('');

    const latestRow = safeRows[safeRows.length - 1] || {};
    const latestIndex = safeRows.length - 1;
    const latestIncomeX = xFor(latestIndex).toFixed(1);
    const latestIncomeY = yFor(latestRow?.income || 0).toFixed(1);
    const latestExpenseY = yFor(latestRow?.expense || 0).toFixed(1);

    return `
        <div class="erp-finance-trend-legend">
            <span class="income"><i></i>收入</span>
            <span class="expense"><i></i>支出</span>
        </div>
        <div class="erp-finance-trend-chart-wrap">
            <svg class="erp-finance-trend-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-label="收支趋势折线图">
                ${gridLines}
                ${yLabels}
                <polygon points="${incomeAreaPoints}" fill="rgba(245,34,123,0.12)"></polygon>
                <polygon points="${expenseAreaPoints}" fill="rgba(82,196,26,0.12)"></polygon>
                <polyline points="${incomePoints}" fill="none" stroke="#f5227b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></polyline>
                <polyline points="${expensePoints}" fill="none" stroke="#52c41a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></polyline>
                <circle cx="${latestIncomeX}" cy="${latestIncomeY}" r="3.5" fill="#f5227b"></circle>
                <circle cx="${latestIncomeX}" cy="${latestExpenseY}" r="3.5" fill="#52c41a"></circle>
                ${xLabels}
            </svg>
        </div>
    `;
}

const ERP_FINANCE_CHART_INSTANCES = {
    trend: null,
    monthly: null
};
let erpFinanceChartResizeBound = false;
const ERP_FINANCE_CHART_RETRY_TIMERS = {
    trend: null,
    monthly: null
};
const ERP_FINANCE_CHART_RESIZE_TIMERS = {
    trend: [],
    monthly: []
};

function isChartInstanceAlive(instance) {
    if (!instance || typeof instance.resize !== 'function') {
        return false;
    }
    if (typeof instance.isDisposed === 'function' && instance.isDisposed()) {
        return false;
    }
    return true;
}

function clearFinanceChartResizeTimers(key) {
    const timers = ERP_FINANCE_CHART_RESIZE_TIMERS[key];
    if (!Array.isArray(timers) || !timers.length) {
        return;
    }
    timers.forEach(timerId => {
        try {
            clearTimeout(timerId);
        } catch (error) {
            // 忽略清理异常
        }
    });
    ERP_FINANCE_CHART_RESIZE_TIMERS[key] = [];
}

function safeResizeFinanceChart(instance, sourceLabel = 'unknown') {
    if (!isChartInstanceAlive(instance)) {
        return false;
    }
    try {
        instance.resize();
        return true;
    } catch (error) {
        console.error(`[ERP] 财务图表 resize 失败(${sourceLabel}):`, error?.message || error);
        return false;
    }
}

function bindFinanceChartResizeOnce() {
    if (erpFinanceChartResizeBound || typeof window === 'undefined') {
        return;
    }
    window.addEventListener('resize', () => {
        Object.values(ERP_FINANCE_CHART_INSTANCES).forEach(instance => {
            safeResizeFinanceChart(instance, 'window');
        });
    });
    erpFinanceChartResizeBound = true;
}

function disposeFinanceChartInstance(key) {
    clearFinanceChartResizeTimers(key);
    if (ERP_FINANCE_CHART_RETRY_TIMERS[key]) {
        clearTimeout(ERP_FINANCE_CHART_RETRY_TIMERS[key]);
        ERP_FINANCE_CHART_RETRY_TIMERS[key] = null;
    }
    const instance = ERP_FINANCE_CHART_INSTANCES[key];
    if (instance && typeof instance.dispose === 'function') {
        try {
            instance.dispose();
        } catch (error) {
            console.error('[ERP] 财务图表销毁失败:', error?.message || error);
        }
    }
    ERP_FINANCE_CHART_INSTANCES[key] = null;
}

function isFinanceModuleActive() {
    const financeView = document.getElementById('financeView');
    const hasActiveClass = !!(financeView && financeView.classList.contains('active'));
    const currentModule = String(ERP?.config?.currentModule || '').trim().toLowerCase();
    return hasActiveClass || currentModule === 'finance';
}

function isChartHostVisible(element) {
    if (!element) {
        return false;
    }
    const rect = element.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) {
        return false;
    }
    if (element.offsetParent === null && !element.closest('.module-view.active')) {
        return false;
    }
    return true;
}

function queueFinanceChartRetry(key, callback, attempt) {
    if (attempt >= 4) {
        return false;
    }
    const delay = [80, 180, 320, 520][attempt] || 520;
    if (ERP_FINANCE_CHART_RETRY_TIMERS[key]) {
        clearTimeout(ERP_FINANCE_CHART_RETRY_TIMERS[key]);
    }
    ERP_FINANCE_CHART_RETRY_TIMERS[key] = setTimeout(() => {
        ERP_FINANCE_CHART_RETRY_TIMERS[key] = null;
        callback(attempt + 1);
    }, delay);
    return true;
}

function queueFinanceChartResize(key) {
    const instance = ERP_FINANCE_CHART_INSTANCES[key];
    if (!isChartInstanceAlive(instance)) {
        return;
    }
    clearFinanceChartResizeTimers(key);
    requestAnimationFrame(() => {
        if (ERP_FINANCE_CHART_INSTANCES[key] !== instance) {
            return;
        }
        safeResizeFinanceChart(instance, 'raf');
    });
    const timer1 = setTimeout(() => {
        if (ERP_FINANCE_CHART_INSTANCES[key] !== instance) {
            return;
        }
        safeResizeFinanceChart(instance, 't+100');
    }, 100);
    const timer2 = setTimeout(() => {
        if (ERP_FINANCE_CHART_INSTANCES[key] !== instance) {
            return;
        }
        safeResizeFinanceChart(instance, 't+260');
    }, 260);
    ERP_FINANCE_CHART_RESIZE_TIMERS[key].push(timer1, timer2);
}

function formatTrendAxisLabel(value, index, totalCount) {
    const total = Math.max(1, Number(totalCount || 0));
    if (total <= 8) {
        return value;
    }
    const step = Math.max(1, Math.ceil(total / 8));
    if (index % step === 0 || index === total - 1) {
        return value;
    }
    return '';
}

function renderFinanceTrendEChart(rows = [], attempt = 0) {
    if (!window.echarts || !Array.isArray(rows) || rows.length === 0) {
        disposeFinanceChartInstance('trend');
        return false;
    }

    const chartEl = document.getElementById('financeTrendEChartCanvas');
    if (!chartEl) {
        disposeFinanceChartInstance('trend');
        return false;
    }

    if (!isChartHostVisible(chartEl)) {
        return queueFinanceChartRetry('trend', nextAttempt => renderFinanceTrendEChart(rows, nextAttempt), attempt);
    }

    bindFinanceChartResizeOnce();
    disposeFinanceChartInstance('trend');
    const chart = window.echarts.init(chartEl, null, { renderer: 'canvas' });
    ERP_FINANCE_CHART_INSTANCES.trend = chart;

    const labels = rows.map(item => String(item?.label || '-'));
    const incomeData = rows.map(item => {
        const value = Number(item?.income || 0);
        return Number.isFinite(value) ? value : 0;
    });
    const expenseData = rows.map(item => {
        const value = Number(item?.expense || 0);
        return Number.isFinite(value) ? value : 0;
    });
    const maxValue = Math.max(1, ...incomeData, ...expenseData);

    const option = {
        animationDuration: 450,
        animationEasing: 'cubicOut',
        grid: { left: 64, right: 24, top: 22, bottom: 52 },
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            borderWidth: 0,
            textStyle: { color: '#f8fafc', fontSize: 12 },
            formatter(params) {
                const list = Array.isArray(params) ? params : [];
                const index = Number(list[0]?.dataIndex || 0);
                const row = rows[index] || {};
                return [
                    `<div style="margin-bottom:4px;">${escapeHtmlText(row?.label || '-')}</div>`,
                    `<div>收入：${formatCurrency(row?.income || 0)}</div>`,
                    `<div>支出：${formatCurrency(row?.expense || 0)}</div>`,
                    `<div>净额：${formatCurrency((row?.income || 0) - (row?.expense || 0))}</div>`
                ].join('');
            }
        },
        legend: { show: false },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: labels,
            axisLine: { lineStyle: { color: '#dbe4f0' } },
            axisTick: { show: false },
            axisLabel: {
                color: '#64748b',
                fontSize: 11,
                interval: 0,
                margin: 12,
                formatter: (value, index) => formatTrendAxisLabel(value, index, labels.length)
            },
            splitLine: { show: true, lineStyle: { color: '#f5f8fc', type: 'dashed' } }
        },
        yAxis: {
            type: 'value',
            min: 0,
            max: Math.ceil(maxValue * 1.12 * 100) / 100,
            splitNumber: 5,
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: {
                color: '#64748b',
                fontSize: 11,
                formatter: value => formatChartAxisCurrency(value)
            },
            splitLine: { lineStyle: { color: '#eaf0f8', type: 'dashed' } }
        },
        series: [
            {
                name: '收入',
                type: 'line',
                smooth: 0.1,
                showSymbol: false,
                symbol: 'circle',
                symbolSize: 6,
                lineStyle: { width: 2.6, color: '#d61f69', shadowColor: 'rgba(214,31,105,0.25)', shadowBlur: 6 },
                itemStyle: { color: '#f5227b' },
                areaStyle: { color: 'rgba(245,34,123,0.05)' },
                data: incomeData
            },
            {
                name: '支出',
                type: 'line',
                smooth: 0.1,
                showSymbol: false,
                symbol: 'circle',
                symbolSize: 6,
                lineStyle: { width: 2.6, color: '#3f9f15', shadowColor: 'rgba(63,159,21,0.25)', shadowBlur: 6 },
                itemStyle: { color: '#52c41a' },
                areaStyle: { color: 'rgba(82,196,26,0.05)' },
                data: expenseData
            }
        ]
    };
    try {
        chart.setOption(option, true);
    } catch (error) {
        console.error('[ERP] 收支趋势图渲染失败，已降级为静态图:', error?.message || error);
        disposeFinanceChartInstance('trend');
        return false;
    }
    queueFinanceChartResize('trend');
    return true;
}

function buildFinanceMonthlyProfitLineChart(rows = []) {
    const safeRows = Array.isArray(rows) ? rows : [];
    if (!safeRows.length) {
        return '<div style="font-size:12px;color:#999;">暂无数据</div>';
    }

    const width = 860;
    const height = 220;
    const paddingLeft = 48;
    const paddingRight = 16;
    const paddingTop = 14;
    const paddingBottom = 28;
    const innerWidth = Math.max(1, width - paddingLeft - paddingRight);
    const innerHeight = Math.max(1, height - paddingTop - paddingBottom);
    const maxAbs = Math.max(1, ...safeRows.map(item => Math.abs(Number(item?.net || 0))));
    const chartMax = maxAbs * 1.15;
    const chartMin = -chartMax;
    const range = chartMax - chartMin;

    const xFor = index => (
        paddingLeft + (safeRows.length <= 1 ? (innerWidth / 2) : (index / (safeRows.length - 1)) * innerWidth)
    );
    const yFor = value => {
        const normalized = (Number(value || 0) - chartMin) / range;
        return paddingTop + (1 - normalized) * innerHeight;
    };

    const netPoints = safeRows
        .map((item, index) => `${xFor(index).toFixed(1)},${yFor(item?.net || 0).toFixed(1)}`)
        .join(' ');

    const zeroY = yFor(0).toFixed(1);
    const gridFractions = [0, 0.25, 0.5, 0.75, 1];
    const gridLines = gridFractions.map(fraction => {
        const y = (paddingTop + innerHeight * fraction).toFixed(1);
        return `<line x1="${paddingLeft}" y1="${y}" x2="${paddingLeft + innerWidth}" y2="${y}" stroke="#eef2f7" stroke-width="1"></line>`;
    }).join('');
    const yTicks = [chartMax, chartMax / 2, 0, chartMin / 2, chartMin];
    const yLabels = yTicks.map(value => {
        const y = yFor(value).toFixed(1);
        return `<text x="${paddingLeft - 6}" y="${y}" text-anchor="end" dominant-baseline="middle" fill="#94a3b8" font-size="11">${formatChartAxisCurrency(value)}</text>`;
    }).join('');

    const xLabelIndexes = Array.from(new Set([
        0,
        Math.max(0, Math.floor((safeRows.length - 1) * 0.25)),
        Math.max(0, Math.floor((safeRows.length - 1) * 0.5)),
        Math.max(0, Math.floor((safeRows.length - 1) * 0.75)),
        safeRows.length - 1
    ]))
        .filter(index => index >= 0 && index < safeRows.length);
    const xLabels = xLabelIndexes.map(index => {
        const row = safeRows[index];
        return `<text x="${xFor(index).toFixed(1)}" y="${height - 8}" text-anchor="middle" fill="#94a3b8" font-size="11">${escapeHtmlText(row?.label || '')}</text>`;
    }).join('');

    const latestRow = safeRows[safeRows.length - 1] || { net: 0 };
    const latestX = xFor(safeRows.length - 1).toFixed(1);
    const latestY = yFor(latestRow.net || 0).toFixed(1);
    const strokeColor = Number(latestRow.net || 0) >= 0 ? '#1677ff' : '#fa8c16';
    const posFill = Number(latestRow.net || 0) >= 0 ? 'rgba(22,119,255,0.10)' : 'rgba(250,140,22,0.10)';

    const areaPoints = `${paddingLeft},${zeroY} ${netPoints} ${paddingLeft + innerWidth},${zeroY}`;

    return `
        <div class="erp-finance-monthly-legend">
            <span class="line"><i></i>净利润走势</span>
            <span class="zero"><i></i>零轴</span>
        </div>
        <div class="erp-finance-trend-chart-wrap">
            <svg class="erp-finance-trend-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-label="月度净利润走势图">
                ${gridLines}
                <line x1="${paddingLeft}" y1="${zeroY}" x2="${paddingLeft + innerWidth}" y2="${zeroY}" stroke="#dbeafe" stroke-width="1.5" stroke-dasharray="4 3"></line>
                ${yLabels}
                <polygon points="${areaPoints}" fill="${posFill}"></polygon>
                <polyline points="${netPoints}" fill="none" stroke="${strokeColor}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></polyline>
                <circle cx="${latestX}" cy="${latestY}" r="3.8" fill="${strokeColor}"></circle>
                ${xLabels}
            </svg>
        </div>
    `;
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
    const monthInfo = getSelectedFinanceReportMonth();
    const monthRows = buildMonthlyProfitRows(source, 24);
    const currentMonthRow = monthRows.find(item => String(item?.key) === monthInfo.key) || { net: 0, income: 0, expense: 0 };
    const monthlyTarget = loadFinanceMonthlyTarget(monthInfo.key);
    const targetRate = monthlyTarget > 0 ? (currentMonthRow.net / monthlyTarget) : 0;
    const targetRatePercent = monthlyTarget > 0 ? Math.max(0, Math.min(999, Math.round(targetRate * 100))) : 0;
    const targetTone = monthlyTarget <= 0
        ? '#8c8c8c'
        : (targetRate >= 1 ? '#237804' : (targetRate >= 0.7 ? '#d46b08' : '#cf1322'));

    const fallbackTrendChartHtml = buildFinanceTrendLineChart(rowsSelected);

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
            <div style="flex:1;min-width:220px;padding:10px 12px;border:1px solid #d9d9d9;border-radius:8px;background:#fff;">
                <div style="font-size:12px;color:#8c8c8c;">${monthInfo.key} 净利润目标</div>
                <div style="font-size:18px;font-weight:600;color:${targetTone};">${monthlyTarget > 0 ? `${targetRatePercent}%` : '未设置目标'}</div>
                <div style="font-size:12px;color:#8c8c8c;">当前 ${formatCurrency(currentMonthRow.net)} / 目标 ${formatCurrency(monthlyTarget)}</div>
                <div style="margin-top:6px;height:6px;background:#f0f0f0;border-radius:999px;overflow:hidden;">
                    <div style="height:6px;background:${targetTone};width:${monthlyTarget > 0 ? Math.max(4, Math.min(100, targetRatePercent)) : 0}%;"></div>
                </div>
            </div>
        </div>
        <div style="margin-top:10px;padding:10px;border:1px solid #f0f0f0;border-radius:8px;background:#fff;">
            <div style="font-size:13px;font-weight:500;color:#262626;margin-bottom:8px;">近${selectedRange}天收支走势图（${scopeText}）</div>
            <div id="financeTrendEChartCanvas" class="erp-finance-echart-canvas"></div>
            <div id="financeTrendFallback" style="display:none;">${fallbackTrendChartHtml}</div>
        </div>
    `;

    const rendered = renderFinanceTrendEChart(rowsSelected);
    const fallbackEl = document.getElementById('financeTrendFallback');
    if (fallbackEl) {
        fallbackEl.style.display = rendered ? 'none' : '';
    }
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

function renderFinanceMonthlyProfitEChart(rows = [], attempt = 0) {
    if (!window.echarts || !Array.isArray(rows) || rows.length === 0) {
        disposeFinanceChartInstance('monthly');
        return false;
    }

    const chartEl = document.getElementById('financeMonthlyEChartCanvas');
    if (!chartEl) {
        disposeFinanceChartInstance('monthly');
        return false;
    }

    if (!isChartHostVisible(chartEl)) {
        return queueFinanceChartRetry('monthly', nextAttempt => renderFinanceMonthlyProfitEChart(rows, nextAttempt), attempt);
    }

    bindFinanceChartResizeOnce();
    disposeFinanceChartInstance('monthly');
    const chart = window.echarts.init(chartEl, null, { renderer: 'canvas' });
    ERP_FINANCE_CHART_INSTANCES.monthly = chart;

    const labels = rows.map(item => String(item?.label || '-'));
    const netData = rows.map(item => {
        const value = Number(item?.net || 0);
        return Number.isFinite(value) ? value : 0;
    });
    const maxAbs = Math.max(1, ...netData.map(value => Math.abs(value)));
    const bound = Math.ceil(maxAbs * 1.2 * 100) / 100;

    const option = {
        animationDuration: 450,
        animationEasing: 'cubicOut',
        grid: { left: 64, right: 24, top: 24, bottom: 52 },
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            borderWidth: 0,
            textStyle: { color: '#f8fafc', fontSize: 12 },
            formatter(params) {
                const list = Array.isArray(params) ? params : [];
                const index = Number(list[0]?.dataIndex || 0);
                const row = rows[index] || {};
                return [
                    `<div style="margin-bottom:4px;">${escapeHtmlText(row?.label || '-')}</div>`,
                    `<div>收入：${formatCurrency(row?.income || 0)}</div>`,
                    `<div>支出：${formatCurrency(row?.expense || 0)}</div>`,
                    `<div>净利润：${formatCurrency(row?.net || 0)}</div>`
                ].join('');
            }
        },
        legend: { show: false },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: labels,
            axisLine: { lineStyle: { color: '#dbe4f0' } },
            axisTick: { show: false },
            axisLabel: {
                color: '#64748b',
                fontSize: 11,
                interval: 0,
                margin: 12,
                formatter: (value, index) => formatTrendAxisLabel(value, index, labels.length)
            },
            splitLine: { show: true, lineStyle: { color: '#f5f8fc', type: 'dashed' } }
        },
        yAxis: {
            type: 'value',
            min: -bound,
            max: bound,
            splitNumber: 5,
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: {
                color: '#64748b',
                fontSize: 11,
                formatter: value => formatChartAxisCurrency(value)
            },
            splitLine: { lineStyle: { color: '#eaf0f8', type: 'dashed' } }
        },
        series: [
            {
                name: '净利润',
                type: 'line',
                smooth: 0.1,
                showSymbol: false,
                symbol: 'circle',
                symbolSize: 6,
                lineStyle: { width: 2.8, shadowColor: 'rgba(22,119,255,0.28)', shadowBlur: 7 },
                itemStyle: { color: '#1677ff' },
                areaStyle: { color: 'rgba(22,119,255,0.04)' },
                data: netData,
                markLine: {
                    silent: true,
                    symbol: 'none',
                    lineStyle: { color: '#cbd5e1', type: 'dashed', width: 1.5 },
                    data: [{ yAxis: 0 }]
                }
            }
        ]
    };
    try {
        chart.setOption(option, true);
    } catch (error) {
        console.error('[ERP] 月度利润图渲染失败，已降级为静态图:', error?.message || error);
        disposeFinanceChartInstance('monthly');
        return false;
    }
    queueFinanceChartResize('monthly');
    return true;
}

function refreshFinanceCharts() {
    if (!isFinanceModuleActive()) {
        return;
    }
    try {
        renderFinanceAgingSummary();
        renderFinanceTrendSummary();
        renderFinanceMonthlyProfitChart();
        renderFinanceCashflowOverview();
        renderFinanceRiskAlerts();
    } catch (error) {
        console.error('[ERP] 财务看板刷新失败:', error?.message || error);
    }
}

if (typeof window !== 'undefined') {
    window.refreshFinanceCharts = refreshFinanceCharts;
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
    const fallbackMonthlyChartHtml = buildFinanceMonthlyProfitLineChart(rows);
    const latest = rows[rows.length - 1] || { net: 0 };
    const latestPositive = Number(latest.net || 0) >= 0;

    container.innerHTML = `
        <div style="padding:10px;border:1px solid #f0f0f0;border-radius:8px;background:#fff;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
                <div style="font-size:13px;font-weight:500;color:#262626;">月度利润走势图（近${monthRange}个月，${scopeText}）</div>
                <div style="font-size:12px;color:${latestPositive ? '#1677ff' : '#d46b08'};">最新月净利润：${latestPositive ? '+' : '-'}${formatCurrency(Math.abs(Number(latest.net || 0)))}</div>
            </div>
            <div id="financeMonthlyEChartCanvas" class="erp-finance-echart-canvas"></div>
            <div id="financeMonthlyFallback" style="display:none;">${fallbackMonthlyChartHtml}</div>
            <div style="margin-top:8px;font-size:12px;color:#8c8c8c;">蓝线为净利润走势，虚线为零轴（按收入-支出）</div>
        </div>
    `;

    const rendered = renderFinanceMonthlyProfitEChart(rows);
    const fallbackEl = document.getElementById('financeMonthlyFallback');
    if (fallbackEl) {
        fallbackEl.style.display = rendered ? 'none' : '';
    }
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
    if (finance?.__virtual_bank_fee === true) {
        if (finance?.__source_finance_id !== null && finance?.__source_finance_id !== undefined && String(finance.__source_finance_id).trim() !== '') {
            return `<div class="erp-row-actions"><button class="ant-btn erp-btn-danger erp-btn-compact" onclick='deleteBankFeeSourceRecord(${JSON.stringify(finance.__source_finance_id)})'>删除来源</button></div>`;
        }
        return `<div class="erp-row-actions"><button class="ant-btn erp-btn-compact" disabled style="color:#8c8c8c;border-color:#d9d9d9;cursor:not-allowed;">来源银行业务</button></div>`;
    }

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

async function deleteBankFeeSourceRecord(sourceFinanceId) {
    const financeId = sourceFinanceId;
    if (financeId === null || financeId === undefined || String(financeId).trim() === '') {
        if (typeof showToast === 'function') {
            showToast('未找到来源银行业务记录', 'warning');
        }
        return;
    }

    const confirmed = confirm('确认删除来源银行业务记录吗？删除后该手续费镜像也会消失。');
    if (!confirmed) {
        return;
    }

    const deleted = await ERP.deleteFinance(financeId);
    if (!deleted) {
        return;
    }

    const finances = await ERP.loadFinances(true);
    if (typeof renderFinances === 'function') {
        syncFinanceViewRows(finances, 'all');
        renderFinances(finances);
    }

    if (typeof applyBankBusinessFilters === 'function') {
        applyBankBusinessFilters();
    } else if (typeof renderBankBusiness === 'function') {
        renderBankBusiness();
    }

    updateStatistics();
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
            toDateTimeText(date || item?.transaction_date || '-')
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
    if (Object.prototype.hasOwnProperty.call(ERP.state.loaded, 'notes')) {
        ERP.state.loaded.notes = value;
    }
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
        ERP.loadFinances(false),
        typeof ERP.loadNotes === 'function' ? ERP.loadNotes(false) : Promise.resolve([])
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
        if (typeof applyBankBusinessFilters === 'function') {
            applyBankBusinessFilters();
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
        if (typeof applyBankBusinessFilters === 'function') {
            applyBankBusinessFilters();
        }
        if (typeof renderDailyNotesModule === 'function' && window.ERP && typeof ERP.loadNotes === 'function') {
            ERP.loadNotes(false)
                .then(() => renderDailyNotesModule())
                .catch(error => {
                    console.error('[ERP Ant] 加载笔记数据失败:', error);
                });
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
        if (typeof applyBankBusinessFilters === 'function') {
            applyBankBusinessFilters();
        }
        updateStatistics();
        renderFinanceAgingSummary();
        await refreshBankSmartPlanIfVisible();
    });

    window.addEventListener('erpNotesChanged', async function () {
        if (typeof ERP === 'undefined' || typeof ERP.loadNotes !== 'function') {
            return;
        }
        if (!ERP.state?.loaded?.notes) {
            await ERP.loadNotes(false);
        }
        if (typeof renderDailyNotesModule === 'function') {
            renderDailyNotesModule();
        }
    });

    window.addEventListener('erpInventoryChanged', async function () {
        if (typeof ERP === 'undefined') {
            return;
        }

        const products = await ERP.loadProducts(true);
        if (typeof renderProducts === 'function') {
            renderProducts(products);
        }
        if (typeof renderInventory === 'function') {
            renderInventory(products);
            populateInventoryProducts();
        }
        updateStatistics();
        await loadPurchaseRecords();
        await refreshLowStockFromLatestData('inventory-changed');
    });

    window.addEventListener('erpOrderPostProcessed', async function (event) {
        if (typeof ERP === 'undefined') {
            return;
        }

        resetDashboardItemCache();
        if (ERP.config.currentModule === 'orders') {
            searchOrders();
        }
        updateStatistics(event?.detail || {});
    });

    window.addEventListener('erpOrderChanged', async function (event) {
        if (typeof ERP === 'undefined') {
            return;
        }

        const action = String(event?.detail?.action || '').trim();
        const useLocalStateActions = new Set(['created', 'deleted', 'status-updated', 'payment-settled', 'updated']);

        resetDashboardItemCache();
        if (!useLocalStateActions.has(action)) {
            ERP.state.loaded.orders = false;
            await ERP.loadOrders(true);
        }
        searchOrders();
        updateStatistics(event?.detail || {});
    });

    window.addEventListener('beforeunload', stopERPRealtimeSync);
}

document.addEventListener('DOMContentLoaded', function () {
    initFinanceFilters();
    setBankBusinessCurrentMonthRange();
    applyBankBusinessFilters();
    refreshQQMailAuthStatus();
    initOrderFilters();
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

    ['orderCustomer', 'orderStatus', 'orderPaymentStatus', 'orderShippingStatus'].forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field) {
            return;
        }
        field.addEventListener('change', function () {
            renderOrderModalSummary();
        });
    });

    const totalAmountInput = document.getElementById('orderTotalAmount');
    if (totalAmountInput) {
        totalAmountInput.addEventListener('input', function () {
            refreshOrderRiskPreview();
        });
    }

    updateOrderTrackingParamHint();
    initDailyNotesModule();
});
