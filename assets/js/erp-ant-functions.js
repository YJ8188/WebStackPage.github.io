/**
 * ERP Ant Design 界面 - 业务逻辑函数
 * 从 erp.html 提取并适配用于 erp-ant.html
 */

// ==================== 登录状态检查 ====================
let erpRealtimeSyncTimer = null;
let erpRealtimeSyncInProgress = false;

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
                }
                showERPContent();
                if (typeof ERP !== 'undefined' && ERP.init) {
                    ERP.init();
                }
                return;
            }
        }
    } catch (error) {
        console.warn('[ERP Ant] checkLoginStatus 获取会话失败:', error?.message || error);
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
        console.warn('[ERP Debug] showCustomerProfile: ERP state unavailable');
        return;
    }

    const normalizedCustomerId = normalizeEntityId(customerId);
    const customer = ERP.state.customers.find(item => isSameEntityId(item.id, normalizedCustomerId));

    console.info('[ERP Debug] customer profile click', {
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

    console.info('[ERP Debug] handleCustomerProfileLink', {
        rawCustomerId: customerId,
        normalizedCustomerId,
        href: event?.currentTarget?.getAttribute?.('href') || null
    });

    if (normalizedCustomerId === null) {
        console.warn('[ERP Debug] customerId is empty');
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

    console.info('[ERP Debug] low stock statistics', {
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
}

// ==================== 单位转换 ====================
function printERPDiagnostics() {
    try {
        const inventory = getERPInventoryDiagnostics();
        console.info('[ERP Debug] Diagnostics Snapshot', {
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

async function refreshLowStockFromLatestData(reason = 'manual') {
    if (!window.ERP || typeof ERP.loadProducts !== 'function') {
        return;
    }

    try {
        const latestProducts = await ERP.loadProducts(true);
        if (Array.isArray(latestProducts)) {
            ERP.state.products = latestProducts;
        }

        const diagnostics = getERPInventoryDiagnostics();
        renderLowStockSummary(diagnostics, diagnostics.lowStockCount);

        console.info('[ERP Debug] low stock refreshed', {
            reason,
            lowStockCount: diagnostics.lowStockCount,
            productsCount: diagnostics.rows.length
        });
        console.table(diagnostics.rows);
    } catch (error) {
        console.warn('[ERP Debug] refreshLowStockFromLatestData failed', error?.message || error);
    }
}

async function syncERPRealtimeData() {
    if (erpRealtimeSyncInProgress || typeof ERP === 'undefined' || !userData?.isLoggedIn) {
        return;
    }

    erpRealtimeSyncInProgress = true;
    try {
        await Promise.all([
            ERP.loadProducts(true),
            ERP.loadOrders(true),
            ERP.loadFinances(true)
        ]);

        updateStatistics();
        await refreshLowStockFromLatestData('realtime-sync');
        if (typeof renderHeaderNotices === 'function') {
            renderHeaderNotices();
        }
    } catch (error) {
        console.warn('[ERP Ant] 实时同步失败:', error?.message || error);
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

        const statusSelect = document.getElementById('orderStatus');
        const validStatus = order.status && statusSelect.querySelector(`option[value="${order.status}"]`);
        statusSelect.value = validStatus ? order.status : 'pending';

        const paymentStatusSelect = document.getElementById('orderPaymentStatus');
        const validPaymentStatus = order.payment_status && paymentStatusSelect.querySelector(`option[value="${order.payment_status}"]`);
        paymentStatusSelect.value = validPaymentStatus ? order.payment_status : 'unpaid';

        // 物流信息
        const shippingCompany = order.shipping_company || '';
        document.getElementById('orderShippingCompany').value = shippingCompany;
        document.getElementById('orderTrackingNumber').value = order.tracking_number || '';

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
                const row = document.createElement('div');
                row.className = 'order-item';
                row.style.cssText = 'border: 1px dashed #d9d9d9; padding: 10px; margin-bottom: 8px; background: #fff;';
                row.innerHTML = `
                    <div style="margin-bottom:8px;">
                        <select class="ant-select product-select" style="width:100%;" onchange="updateOrderItemTotal(this)">
                            <option value="">选择产品</option>
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
        document.getElementById('orderStatus').value = 'pending';
        document.getElementById('orderPaymentStatus').value = 'unpaid';
        document.getElementById('orderShippingCompany').value = '';
        document.getElementById('orderTrackingNumber').value = '';
        document.getElementById('orderShippingStatus').value = 'not_shipped';
        document.getElementById('otherShippingCompanyGroup').style.display = 'none';
        document.getElementById('orderOtherShippingCompany').value = '';
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
        const productId = parseInt(select.value);
        const quantity = parseInt(quantityInput.value) || 0;

        if (productId && quantity > 0) {
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
                renderOrders(ERP.state.orders);
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
            renderOrders(ERP.state.orders);
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
            renderOrders();
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
        const productId = parseInt(select.value);
        const quantity = parseInt(quantityInput.value) || 0;

        if (productId && quantity > 0) {
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
    let order = ERP.state.orders.find(o => isSameEntityId(o.id, orderId));

    const hasDetailItems = !!(order && Array.isArray(order.items));
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
            renderOrders(orders);
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
            renderOrders(orders);
        }
        updateStatistics();
    }
}

function searchOrders() {
    const keyword = document.getElementById('orderSearch').value.toLowerCase();
    const filtered = ERP.state.orders.filter(order => {
        const customer = ERP.state.customers.find(c => c.id === order.customer_id);
        return order.order_number.toLowerCase().includes(keyword) ||
            (customer && customer.name.toLowerCase().includes(keyword));
    });
    renderOrders(filtered);
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
    const keyword = document.getElementById('financeSearch').value.toLowerCase();
    const filtered = ERP.state.finances.filter(finance =>
        finance.description.toLowerCase().includes(keyword) ||
        (finance.category && finance.category.toLowerCase().includes(keyword))
    );
    renderFinances(filtered);
}

function filterFinancesByMonth() {
    const monthFilter = document.getElementById('financeMonth').value;
    const yearFilter = document.getElementById('financeYear').value;

    let filtered = ERP.state.finances;

    if (yearFilter || monthFilter) {
        filtered = filtered.filter(finance => {
            const date = new Date(finance.transaction_date);
            const financeYear = date.getFullYear().toString();
            const financeMonth = (date.getMonth() + 1).toString();

            const yearMatch = !yearFilter || financeYear === yearFilter;
            const monthMatch = !monthFilter || financeMonth === monthFilter;

            return yearMatch && monthMatch;
        });
    }

    renderFinances(filtered);
}

function initFinanceFilters() {
    const monthSelect = document.getElementById('financeMonth');
    const yearSelect = document.getElementById('financeYear');
    if (!monthSelect || !yearSelect) return;

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    for (let year = currentYear; year >= currentYear - 5; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year + '年';
        if (year === currentYear) {
            option.selected = true;
        }
        yearSelect.appendChild(option);
    }

    const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    months.forEach((month, index) => {
        const option = document.createElement('option');
        option.value = index + 1;
        option.textContent = month;
        if (index + 1 === currentMonth) {
            option.selected = true;
        }
        monthSelect.appendChild(option);
    });
}

// ==================== 状态文本转换 ====================
function getOrderStatusText(status) {
    const statusMap = {
        'pending': '待处理',
        'processing': '处理中',
        'completed': '已完成',
        'cancelled': '已取消'
    };
    return statusMap[status] || status;
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
            renderOrders(event.detail.orders);
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
        const orders = await ERP.loadOrders(true);
        if (typeof renderOrders === 'function') {
            renderOrders(orders);
        }
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

    window.printERPDiagnostics = printERPDiagnostics;
    setTimeout(printERPDiagnostics, 1200);
});
