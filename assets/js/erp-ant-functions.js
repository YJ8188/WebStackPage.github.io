/**
 * ERP Ant Design 界面 - 业务逻辑函数
 * 从 erp.html 提取并适配用于 erp-ant.html
 */

// ==================== 登录状态检查 ====================
function checkLoginStatus() {
    if (typeof userData !== 'undefined' && userData.isLoggedIn) {
        showERPContent();
        // 初始化 ERP 数据加载
        if (typeof ERP !== 'undefined' && ERP.init) {
            ERP.init();
        }
    } else {
        showNotLoggedIn();
    }
}

function showLoading() {
    document.getElementById('loadingContainer').style.display = 'block';
    document.getElementById('notLoggedIn').style.display = 'none';
    document.getElementById('erpContent').style.display = 'none';
}

function showNotLoggedIn() {
    document.getElementById('loadingContainer').style.display = 'none';
    document.getElementById('notLoggedIn').style.display = 'block';
    document.getElementById('erpContent').style.display = 'none';
}

function showERPContent() {
    document.getElementById('loadingContainer').style.display = 'none';
    document.getElementById('notLoggedIn').style.display = 'none';
    document.getElementById('erpContent').style.display = 'block';
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
    
    const statLowStock = document.getElementById('statLowStock');
    if (statLowStock) statLowStock.textContent = stats.products.lowStock;

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
            result = await ERP.updateCustomer(parseInt(customerId), customerData);
        } else {
            // 乐观更新：先关闭模态框，显示保存成功，然后异步保存
            hideCustomerModal();
            renderCustomers();
            updateStatistics();
            
            // 异步保存到数据库
            result = await ERP.addCustomer(customerData);
            
            if (result) {
                // 客户保存成功
            }
        }

        if (result && customerId) {
            // 客户更新成功
            hideCustomerModal();
            renderCustomers();
            updateStatistics();
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
    const customer = ERP.state.customers.find(c => c.id === customerId);
    if (customer) {
        showCustomerModal(customer);
    }
}

async function deleteCustomer(customerId) {
    if (!confirm('确定要删除这个客户吗？')) {
        return;
    }

    // 乐观更新：先从本地状态中移除，然后异步删除
    const customerIndex = ERP.state.customers.findIndex(c => c.id === customerId);
    if (customerIndex !== -1) {
        const deletedCustomer = ERP.state.customers.splice(customerIndex, 1)[0];
        renderCustomers();
        updateStatistics();
        
        // 异步删除数据库
        try {
            await ERP.deleteCustomer(customerId);
            // 客户删除成功
        } catch (error) {
            console.error('[ERP Ant] 删除客户失败:', error);
            alert('删除失败：' + (error.message || '网络错误，请检查连接'));
            // 恢复本地状态
            ERP.state.customers.splice(customerIndex, 0, deletedCustomer);
            renderCustomers();
            updateStatistics();
        }
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
            result = await ERP.updateProduct(parseInt(productId), productData);
        } else {
            // 乐观更新：先关闭模态框，显示保存成功，然后异步保存
            hideProductModal();
            renderProducts();
            updateStatistics();
            
            // 异步保存到数据库
            result = await ERP.addProduct(productData);
            
            if (result) {
                // 产品保存成功
            }
        }

        if (result && productId) {
            // 产品更新成功
            hideProductModal();
            renderProducts();
            updateStatistics();
        }
    } catch (error) {
        console.error('[ERP Ant] 保存产品失败:', error);
        alert('保存失败：' + (error.message || '网络错误，请检查连接'));
        // 如果是创建产品失败，需要重新加载数据
        if (!productId) {
            await ERP.loadProducts();
            renderProducts();
            updateStatistics();
        }
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
}

async function editProduct(productId) {
    const product = ERP.state.products.find(p => p.id === productId);
    if (product) {
        showProductModal(product);
    }
}

async function deleteProduct(productId) {
    if (!confirm('确定要删除这个产品吗？')) {
        return;
    }

    // 乐观更新：先从本地状态中移除，然后异步删除
    const productIndex = ERP.state.products.findIndex(p => p.id === productId);
    if (productIndex !== -1) {
        const deletedProduct = ERP.state.products.splice(productIndex, 1)[0];
        renderProducts();
        updateStatistics();
        
        // 异步删除数据库
        try {
            await ERP.deleteProduct(productId);
            // 产品删除成功
        } catch (error) {
            console.error('[ERP Ant] 删除产品失败:', error);
            alert('删除失败：' + (error.message || '网络错误，请检查连接'));
            // 恢复本地状态
            ERP.state.products.splice(productIndex, 0, deletedProduct);
            renderProducts();
            updateStatistics();
        }
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
        paymentStatusSelect.value = validPaymentStatus ? order.paymentStatus : 'unpaid';

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
    } else {
        title.textContent = '创建订单';
        form.reset();
        document.getElementById('orderId').value = '';
        document.getElementById('orderItems').innerHTML = '';
        document.getElementById('orderTotalAmount').value = '¥0.00';
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
        const productId = parseInt(select.value);
        const quantity = parseInt(quantityInput.value) || 0;

        if (productId && quantity > 0) {
            const selectedOption = select.options[select.selectedIndex];
            const productName = selectedOption?.dataset.name || '';
            const price = parseFloat(selectedOption?.dataset.price) || 0;

            orderItems.push({
                product_id: productId,
                product_name: productName,
                quantity: quantity,
                unit_price: price
            });
        }
    });

    if (orderItems.length === 0) {
        alert('请至少添加一个产品');
        return;
    }

    const orderData = {
        customer_id: parseInt(customerId),
        notes: document.getElementById('orderNotes').value,
        status: document.getElementById('orderStatus').value,
        payment_status: document.getElementById('orderPaymentStatus').value,
        shipping_company: document.getElementById('orderShippingCompany').value === '其他'
            ? document.getElementById('orderOtherShippingCompany').value
            : document.getElementById('orderShippingCompany').value,
        tracking_number: document.getElementById('orderTrackingNumber').value,
        shipping_status: document.getElementById('orderShippingStatus').value,
        items: orderItems
    };

    const saveBtn = document.querySelector('#orderModal .ant-btn-primary');
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = '保存中...';

    try {
        let result;
        if (orderId) {
            result = await ERP.updateOrder(parseInt(orderId), orderData);
        } else {
            // 乐观更新：先关闭模态框，显示保存成功，然后异步保存
            hideOrderModal();
            renderOrders();
            updateStatistics();
            
            // 异步保存到数据库
            result = await ERP.addOrder(orderData);
            
            if (result) {
                // 订单保存成功
            }
        }

        if (result && orderId) {
            // 订单更新成功
            hideOrderModal();
            renderOrders();
            updateStatistics();
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

async function editOrder(orderId) {
    const order = ERP.state.orders.find(o => o.id === orderId);
    if (order) {
        showOrderModal(order);
    }
}

async function deleteOrder(orderId) {
    if (!confirm('确定要删除这个订单吗？')) {
        return;
    }

    // 乐观更新：先从本地状态中移除，然后异步删除
    const orderIndex = ERP.state.orders.findIndex(o => o.id === orderId);
    if (orderIndex !== -1) {
        const deletedOrder = ERP.state.orders.splice(orderIndex, 1)[0];
        renderOrders();
        updateStatistics();
        
        // 异步删除数据库
        try {
            await ERP.deleteOrder(orderId);
            // 订单删除成功
        } catch (error) {
            console.error('[ERP Ant] 删除订单失败:', error);
            alert('删除失败：' + (error.message || '网络错误，请检查连接'));
            // 恢复本地状态
            ERP.state.orders.splice(orderIndex, 0, deletedOrder);
            renderOrders();
            updateStatistics();
        }
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

    // 乐观更新：先关闭模态框，显示保存成功，然后异步保存
    hideInventoryModal();
    renderInventory();
    
    // 异步保存到数据库
            try {
                const result = await ERP.adjustInventory(productId, quantityChange, type, notes);
                if (result) {
                    // 库存调整成功
                }
            } catch (error) {
                console.error('[ERP Ant] 库存调整失败:', error);
                alert('保存失败：' + (error.message || '网络错误，请检查连接'));
                // 重新加载数据
                await ERP.loadProducts();
                renderInventory();
            }}

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
    document.getElementById('financeTransactionDate').value = new Date().toISOString().split('T')[0];
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
    const financeData = {
        type: document.getElementById('financeType').value,
        category: document.getElementById('financeCategory').value,
        amount: parseFloat(document.getElementById('financeAmount').value),
        description: document.getElementById('financeDescription').value,
        transaction_date: document.getElementById('financeTransactionDate').value
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
        // 乐观更新：先关闭模态框，显示保存成功，然后异步保存
        hideFinanceModal();
        renderFinances();
        updateStatistics();
        
        // 异步保存到数据库
        const result = await ERP.addFinance(financeData);
        
        if (result) {
            // 财务记录保存成功
        }
    } catch (error) {
        console.error('[ERP Ant] 保存财务记录失败:', error);
        alert('保存失败：' + (error.message || '网络错误，请检查连接'));
        // 重新加载数据
        await ERP.loadFinances();
        renderFinances();
        updateStatistics();
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
}

async function deleteFinance(financeId) {
    if (!confirm('确定要删除这条财务记录吗？')) {
        return;
    }

    // 乐观更新：先从本地状态中移除，然后异步删除
    const financeIndex = ERP.state.finances.findIndex(f => f.id === financeId);
    if (financeIndex !== -1) {
        const deletedFinance = ERP.state.finances.splice(financeIndex, 1)[0];
        renderFinances();
        updateStatistics();
        
        // 异步删除数据库
        try {
            await ERP.deleteFinance(financeId);
            // 财务记录删除成功
        } catch (error) {
            console.error('[ERP Ant] 删除财务记录失败:', error);
            alert('删除失败：' + (error.message || '网络错误，请检查连接'));
            // 恢复本地状态
            ERP.state.finances.splice(financeIndex, 0, deletedFinance);
            renderFinances();
            updateStatistics();
        }
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
        showERPContent();

        // 自动渲染所有模块的数据，传递数据参数
        if (typeof renderCustomers === 'function') {
            renderCustomers(event.detail.customers);
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
}

document.addEventListener('DOMContentLoaded', function () {
    initFinanceFilters();
});
