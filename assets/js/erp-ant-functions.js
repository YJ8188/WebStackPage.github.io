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

let bulkCompleteSignedOrdersInProgress = false;

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
            console.info('[ERP Ant] 客户已保存: ', result);
            
            if (result) {
                // 重新加载数据并更新显示
                const customers = await ERP.loadCustomers({ forceRefresh: true });
                console.info('[ERP Ant] 重新加载客户数据条数: ', customers.length);
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
            console.info('[ERP Ant] 重新加载客户数据条数: ', customers.length);
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
    console.info('[ERP Ant] 删除客户请求: customerId=', customerId);
    if (!confirm('确定要删除这个客户吗？')) {
        return;
    }

    try {
        console.info('[ERP Ant] 删除客户已提交到后端: ', customerId);
        await ERP.deleteCustomer(customerId);
        console.info('[ERP Ant] 重新加载客户数据...');
        const customers = await ERP.loadCustomers({ forceRefresh: true });
        console.info('[ERP Ant] 重新加载客户数据条数: ', customers.length);
        
        if (typeof renderCustomers === 'function') {
            console.info('[ERP Ant] renderCustomers 函数存在，正在调用...');
            renderCustomers(customers);
            console.info('[ERP Ant] renderCustomers 调用完成');
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
            console.info('[ERP Ant] 产品已保存: ', result);
            
            if (result) {
                // 重新加载数据并更新显示
                const products = await ERP.loadProducts(true);
                console.info('[ERP Ant] 重新加载产品数据条数: ', products.length);
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
            console.info('[ERP Ant] 重新加载产品数据条数: ', products.length);
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
        console.info('[ERP Ant] 删除产品已提交到后端: ', productId);
        await ERP.deleteProduct(productId);
        console.info('[ERP Ant] 重新加载产品数据...');
        const products = await ERP.loadProducts(true);
        console.info('[ERP Ant] 重新加载产品数据条数: ', products.length);
        
        if (typeof renderProducts === 'function') {
            console.info('[ERP Ant] renderProducts 函数存在，正在调用...');
            renderProducts(products);
            console.info('[ERP Ant] renderProducts 调用完成');
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

    // 加载客户列表
    customerSelect.innerHTML = '<option value="">请选择客户</option>' +
        ERP.state.customers.map(customer =>
            `<option value="${customer.id}">${customer.name}</option>`
        ).join('');

    if (order) {
        title.textContent = '编辑订单';
        document.getElementById('orderId').value = order.id;
        customerSelect.value = order.customer_id;
        document.getElementById('orderNotes').value = order.notes || '';

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
    }

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

    const orderData = {
        customer_id: normalizeEntityId(customerId),
        customer_name: (document.getElementById('orderCustomer')?.selectedOptions?.[0]?.text || '').trim(),
        notes: document.getElementById('orderNotes').value,
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
            console.info('[ERP Ant] 订单已保存: ', result);
            
            if (result) {
                // 直接使用本地状态刷新，避免额外全量查询导致卡顿
                searchOrders();
                updateStatistics();

                if (ERP.config.currentModule === 'finance') {
                    const finances = await ERP.loadFinances(true);
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
        console.info('[ERP Ant] 删除订单已提交到后端: ', orderId);
        await ERP.deleteOrder(orderId);
        console.info('[ERP Ant] 重新加载订单数据...');
        const orders = await ERP.loadOrders(true);
        console.info('[ERP Ant] 重新加载订单数据条数: ', orders.length);
        
        if (typeof renderOrders === 'function') {
            console.info('[ERP Ant] renderOrders 函数存在，正在调用...');
            searchOrders();
            console.info('[ERP Ant] renderOrders 调用完成');
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
        `<button class="ant-btn" onclick="showOrderApprovalHistory(${orderIdLiteral})" style="color:#13c2c2; border-color:#87e8de;">审批记录</button>`
    ];

    if (status === 'pending') {
        buttons.push(
            `<button class="ant-btn" onclick="updateOrderStatusByAction(${orderIdLiteral}, 'confirmed', '订单审批通过')" style="color:#1890ff; border-color:#91d5ff;">审批通过</button>`,
            `<button class="ant-btn" onclick="updateOrderStatusByAction(${orderIdLiteral}, 'cancelled', '订单审批驳回')" style="color:#cf1322; border-color:#ffccc7;">驳回</button>`
        );
    }

    if (status === 'shipped' || status === 'signed') {
        buttons.push(
            `<button class="ant-btn" onclick="updateOrderStatusByAction(${orderIdLiteral}, 'refunded', '退款审批')" style="color:#722ed1; border-color:#d3adf7;">退款审批</button>`
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
    productSelect.innerHTML = '<option value="">请选择产品</option>' +
        ERP.state.products.map(product =>
            `<option value="${product.id}">${product.name} - ${product.sku || ''}</option>`
        ).join('');
}

async function saveInventory() {
    const productId = document.getElementById('inventoryProduct').value;
    const quantityChange = parseInt(document.getElementById('inventoryQuantityChange').value);
    const type = document.getElementById('inventoryType').value;
    const notes = document.getElementById('inventoryNotes').value;

    if (!productId || !quantityChange) {
        alert('请选择产品并输入调整数量');
        return;
    }

    try {
        // 先关闭模态框，然后异步保存
        hideInventoryModal();
        
        // 保存到数据库
        const result = await ERP.adjustInventory(productId, quantityChange, type, notes);
        console.info('[ERP Ant] 库存调整已保存: ', result);
        
        if (result) {
            // 重新加载数据并更新显示
            const products = await ERP.loadProducts(true);
            console.info('[ERP Ant] 重新加载产品数据条数: ', products.length);
            renderInventory(products);
            
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
    }
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
        console.info('[ERP Ant] 保存的本地时间:', transactionDate);
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
        console.info('[ERP Ant] 财务记录已保存: ', result);
        
        if (result) {
            // 重新加载数据并更新显示
            const finances = await ERP.loadFinances(true);
            console.info('[ERP Ant] 重新加载财务数据条数: ', finances.length);
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
        renderFinances(finances);
        updateStatistics();
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
}

async function deleteFinance(financeId) {
        console.info('[ERP Ant] 删除财务记录请求: financeId=', financeId);
        if (!confirm('确定要删除这条财务记录吗？')) {
            return;
        }
        
        // 防止重复调用
        if (window.deletingFinance) {
            console.info('[ERP Ant] 删除操作正在进行中，忽略重复调用');
            return;
        }
        window.deletingFinance = true;
        try {
            await ERP.deleteFinance(financeId);
            console.info('[ERP Ant] 删除财务记录已提交到后端: ', financeId);
            const finances = await ERP.loadFinances(true);
            console.info('[ERP Ant] 重新加载财务数据条数: ', finances.length);
            console.info('[ERP Ant] 调用 renderFinances 函数，数据: ', finances);
            
            // 检查 renderFinances 函数是否存在
            if (typeof renderFinances === 'function') {
                console.info('[ERP Ant] renderFinances 函数存在，正在调用...');
                renderFinances(finances);
                console.info('[ERP Ant] renderFinances 调用完成');
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

    renderFinances(filtered);
}

function onFinanceDateRangeChange() {
    const rangePreset = String(document.getElementById('financeDateRange')?.value || 'all');
    const startInput = document.getElementById('financeDateStart');
    const endInput = document.getElementById('financeDateEnd');
    if (!startInput || !endInput) {
        return;
    }

    const isCustom = rangePreset === 'custom';
    startInput.disabled = !isCustom;
    endInput.disabled = !isCustom;

    if (!isCustom) {
        startInput.value = '';
        endInput.value = '';
    }

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

    applyFinanceFilters();
}

function initFinanceFilters() {
    const rangeSelect = document.getElementById('financeDateRange');
    const startInput = document.getElementById('financeDateStart');
    const endInput = document.getElementById('financeDateEnd');

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

    applyFinanceFilters();
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
            renderFinances(event.detail.finances);
        }
    });

    window.addEventListener('erpFinanceChanged', async function () {
        if (typeof ERP === 'undefined') {
            return;
        }

        const finances = await ERP.loadFinances(true);
        if (typeof renderFinances === 'function') {
            renderFinances(finances);
        }
        updateStatistics();
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
        await refreshLowStockFromLatestData('inventory-changed');
    });

    window.addEventListener('erpOrderPostProcessed', async function () {
        if (typeof ERP === 'undefined') {
            return;
        }

        ERP.state.loaded.orders = false;
        await ERP.loadOrders(true);
        searchOrders();
        updateStatistics();
    });

    window.addEventListener('erpOrderChanged', async function () {
        if (typeof ERP === 'undefined') {
            return;
        }

        await ERP.loadOrders(true);
        searchOrders();
        updateStatistics();
    });

    window.addEventListener('beforeunload', stopERPRealtimeSync);
}

document.addEventListener('DOMContentLoaded', function () {
    initFinanceFilters();
    setTimeout(() => refreshLowStockFromLatestData('dom-ready'), 1200);

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
