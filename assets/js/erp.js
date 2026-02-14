/**
 * ERP 系统模块
 * 功能：客户管理、产品管理、订单管理、库存管理、财务管理
 * 作者：何哥
 * 版本：1.0.0
 */

const ERP = {
    // ==================== 配置 ====================
    config: {
        currentModule: 'dashboard', // 当前模块：dashboard, customers, products, orders, inventory, finance
        itemsPerPage: 10, // 每页显示数量
        requestTimeout: 30000, // 请求超时时间（毫秒）
    },

    runtime: {
        initPromise: null,
        initializedUserId: null
    },

    // ==================== 工具函数 ====================
    /**
     * 为 Promise 添加超时处理
     * @param {Promise} promise - 要执行的 Promise
     * @param {number} timeout - 超时时间（毫秒）
     * @returns {Promise} 带超时的 Promise
     */
    withTimeout(promise, timeout = this.config.requestTimeout) {
        return Promise.race([
            promise,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('请求超时，请检查网络连接')), timeout)
            )
        ]);
    },

    emitEvent(name, detail = {}) {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(name, { detail }));
        }
    },

    isSameId(left, right) {
        if (left === null || left === undefined || right === null || right === undefined) {
            return false;
        }
        return String(left) === String(right);
    },

    // ==================== 状态 ====================
    state: {
        customers: [],
        products: [],
        orders: [],
        finances: [],
        currentCustomerId: null,
        currentProductId: null,
        currentOrderId: null,
        cart: [], // 购物车（用于创建订单）
        // 加载状态标记
        loaded: {
            customers: false,
            products: false,
            orders: false,
            finances: false
        }
    },

    // ==================== 初始化 ====================
    async init() {
        // 检查用户登录状态
        if (!userData.isLoggedIn) {
            return;
        }

        const currentUserId = userData?.user?.id || null;

        if (this.runtime.initPromise) {
            return this.runtime.initPromise;
        }

        if (this.runtime.initializedUserId && this.runtime.initializedUserId === currentUserId) {
            return;
        }

        this.runtime.initPromise = (async () => {
            try {
                // 初始化时只加载统计数据，不加载详细数据
                await this.loadStatisticsOnly();
                this.runtime.initializedUserId = currentUserId;
            } finally {
                this.runtime.initPromise = null;
            }
        })();

        return this.runtime.initPromise;
    },

    // ==================== 只加载统计数据（快速初始化） ====================
    async loadStatisticsOnly() {
        try {
            const shouldKeepFullCustomers = this.state.loaded.customers && Array.isArray(this.state.customers) && this.state.customers.length > 0;

            // 只加载统计数据，不加载详细记录
            let [customers, products, orders, finances] = await Promise.all([
                shouldKeepFullCustomers ? Promise.resolve(this.state.customers) : this.loadCustomers({ lite: true }),
                this.loadProducts(true),
                this.loadOrders(true),
                this.loadFinances(true)
            ]);

            if (!shouldKeepFullCustomers) {
                this.state.customers = customers;
            } else {
                customers = this.state.customers;
            }
            this.state.products = products;
            this.state.orders = orders;
            this.state.finances = finances;

            // 触发数据加载完成事件
            window.dispatchEvent(new CustomEvent('erpDataLoaded', {
                detail: {
                    customers,
                    products,
                    orders,
                    finances
                }
            }));
        } catch (error) {
            console.error('[ERP] 加载统计数据失败:', error);
        }
    },

    // ==================== 数据加载 ====================
    async loadAllData() {
        try {
            // 并行加载所有数据
            const [customers, products, orders, finances] = await Promise.all([
                this.loadCustomers(),
                this.loadProducts(),
                this.loadOrders(),
                this.loadFinances()
            ]);

            this.state.customers = customers;
            this.state.products = products;
            this.state.orders = orders;
            this.state.finances = finances;

            // 触发数据加载完成事件
            window.dispatchEvent(new CustomEvent('erpDataLoaded', {
                detail: {
                    customers,
                    products,
                    orders,
                    finances
                }
            }));

        } catch (error) {
            console.error('[ERP] 加载数据失败:', error);
            if (typeof showToast === 'function') {
                showToast('加载数据失败，请刷新页面重试', 'error');
            }
        }
    },

    // ==================== 按需加载数据 ====================
    async loadCustomers(options = false) {
        let lite = false;
        let forceRefresh = false;

        if (typeof options === 'object' && options !== null) {
            lite = !!options.lite;
            forceRefresh = !!options.forceRefresh;
        } else {
            lite = options === true;
        }

        if (forceRefresh) {
            this.state.loaded.customers = false;
        }
        // 如果已加载且不是强制刷新，直接返回缓存
        if (this.state.loaded.customers && !forceRefresh) {
            return this.state.customers;
        }

        try {
            const query = supabaseClient
                .from('erp_customers')
                .select('*')
                .eq('user_id', userData.user.id);

            // 轻量模式只加载ID和名称
            const selectFields = lite ? 'id, name, status' : '*';

            const { data, error } = await query
                .select(selectFields)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            this.state.customers = data || [];
            this.state.loaded.customers = !lite;
            return this.state.customers;

        } catch (error) {
            console.error('[ERP] 加载客户数据失败:', error);
            return [];
        }
    },

    async loadProducts(lite = false) {
        // 如果已加载且不是强制刷新，直接返回缓存
        if (this.state.loaded.products && !lite) {
            return this.state.products;
        }

        try {
            const query = supabaseClient
                .from('erp_products')
                .select('*')
                .eq('user_id', userData.user.id);

            // 轻量模式只加载必要字段
            const selectFields = lite ? 'id, name, sku, category, unit, price, cost, stock_quantity, min_stock, status' : '*';

            const { data, error } = await query
                .select(selectFields)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            this.state.products = data || [];
            this.state.loaded.products = !lite;
            return this.state.products;

        } catch (error) {
            console.error('[ERP] 加载产品数据失败:', error);
            return [];
        }
    },

    async loadOrders(lite = false) {
        // 如果已加载且不是强制刷新，直接返回缓存
        if (this.state.loaded.orders && !lite) {
            return this.state.orders;
        }

        try {
            const selectFields = lite
                ? 'id, user_id, customer_id, order_number, order_date, total_amount, total_cost, net_profit, status, payment_status, shipping_status, shipping_company, tracking_number'
                : '*, customer:erp_customers(id, name, contact_person), items:erp_order_items(*)';

            const { data, error } = await supabaseClient
                .from('erp_orders')
                .select(selectFields)
                .eq('user_id', userData.user.id)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            this.state.orders = data || [];
            this.state.loaded.orders = !lite;
            return this.state.orders;

        } catch (error) {
            console.error('[ERP] 加载订单数据失败:', error);
            return [];
        }
    },

    async loadOrderDetail(orderId) {
        try {
            const { data, error } = await supabaseClient
                .from('erp_orders')
                .select('*, customer:erp_customers(id, name, contact_person), items:erp_order_items(*)')
                .eq('id', orderId)
                .eq('user_id', userData.user.id)
                .single();

            if (error) {
                throw error;
            }

            if (data) {
                const index = this.state.orders.findIndex(order => this.isSameId(order.id, data.id));
                if (index >= 0) {
                    this.state.orders[index] = data;
                } else {
                    this.state.orders.unshift(data);
                }
            }

            return data || null;
        } catch (error) {
            console.error('[ERP] 加载订单详情失败:', error);
            return null;
        }
    },

    async loadFinances(lite = false) {
        // 如果已加载且不是强制刷新，直接返回缓存
        if (this.state.loaded.finances && !lite) {
            return this.state.finances;
        }

        try {
            const selectFields = lite
                ? 'id, user_id, type, category, amount, description, reference_id, order_id, transaction_date'
                : '*';

            const { data, error } = await supabaseClient
                .from('erp_finances')
                .select(selectFields)
                .eq('user_id', userData.user.id)
                .order('transaction_date', { ascending: false });

            if (error) {
                throw error;
            }

            this.state.finances = data || [];
            this.state.loaded.finances = !lite;
            return this.state.finances;

        } catch (error) {
            console.error('[ERP] 加载财务数据失败:', error);
            return [];
        }
    },

    // ==================== 客户管理 ====================
    async loadCustomersLegacy() {
        try {
            const { data, error } = await supabaseClient
                .from('erp_customers')
                .select('*')
                .eq('user_id', userData.user.id)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            return data || [];

        } catch (error) {
            console.error('[ERP] 加载客户数据失败:', error);
            return [];
        }
    },

    async addCustomer(customerData) {
        try {
            const { data, error } = await supabaseClient
                .from('erp_customers')
                .insert([{
                    user_id: userData.user.id,
                    name: customerData.name,
                    contact_person: customerData.contact_person || '',
                    phone: customerData.phone || '',
                    email: customerData.email || '',
                    address: customerData.address || '',
                    notes: customerData.notes || '',
                    status: customerData.status || 'active'
                }])
                .select()
                .single();

            if (error) {
                throw error;
            }

            this.state.customers.unshift(data);

            if (typeof showToast === 'function') {
                showToast('客户添加成功', 'success');
            }

            return data;

        } catch (error) {
            console.error('[ERP] 添加客户失败:', error);
            if (typeof showToast === 'function') {
                showToast('添加客户失败: ' + error.message, 'error');
            }
            return null;
        }
    },

    async updateCustomer(customerId, customerData) {
        try {
            const { data, error } = await supabaseClient
                .from('erp_customers')
                .update({
                    name: customerData.name,
                    contact_person: customerData.contact_person || '',
                    phone: customerData.phone || '',
                    email: customerData.email || '',
                    address: customerData.address || '',
                    notes: customerData.notes || '',
                    status: customerData.status || 'active'
                })
                .eq('id', customerId)
                .eq('user_id', userData.user.id)
                .select()
                .single();

            if (error) {
                throw error;
            }

            // 更新本地状态
            const index = this.state.customers.findIndex(c => this.isSameId(c.id, customerId));
            if (index !== -1) {
                this.state.customers[index] = data;
            }

            if (typeof showToast === 'function') {
                showToast('客户更新成功', 'success');
            }

            return data;

        } catch (error) {
            console.error('[ERP] 更新客户失败:', error);
            if (typeof showToast === 'function') {
                showToast('更新客户失败: ' + error.message, 'error');
            }
            return null;
        }
    },

    async deleteCustomer(customerId) {
        try {
            const { error } = await supabaseClient
                .from('erp_customers')
                .delete()
                .eq('id', customerId)
                .eq('user_id', userData.user.id);

            if (error) {
                throw error;
            }

            // 更新本地状态
            this.state.customers = this.state.customers.filter(c => !this.isSameId(c.id, customerId));

            if (typeof showToast === 'function') {
                showToast('客户删除成功', 'success');
            }

            return true;

        } catch (error) {
            console.error('[ERP] 删除客户失败:', error);
            if (typeof showToast === 'function') {
                showToast('删除客户失败: ' + error.message, 'error');
            }
            return false;
        }
    },

    // ==================== 产品管理 ====================
    async loadProductsLegacy() {
        try {
            const { data, error } = await supabaseClient
                .from('erp_products')
                .select('*')
                .eq('user_id', userData.user.id)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            return data || [];

        } catch (error) {
            console.error('[ERP] 加载产品数据失败:', error);
            return [];
        }
    },

    async addProduct(productData) {
        try {
            const { data, error } = await supabaseClient
                .from('erp_products')
                .insert([{
                    user_id: userData.user.id,
                    name: productData.name,
                    sku: productData.sku || null,
                    category: productData.category || '',
                    description: productData.description || '',
                    price: parseFloat(productData.price) || 0,
                    cost: parseFloat(productData.cost) || 0,
                    stock_quantity: parseInt(productData.stock_quantity) || 0,
                    min_stock: parseInt(productData.min_stock) || 0,
                    unit: productData.unit || 'piece',
                    status: productData.status || 'active'
                }])
                .select()
                .single();

            if (error) {
                throw error;
            }

            this.state.products.unshift(data);

            if (typeof showToast === 'function') {
                showToast('产品添加成功', 'success');
            }

            return data;

        } catch (error) {
            console.error('[ERP] 添加产品失败:', error);
            if (typeof showToast === 'function') {
                showToast('添加产品失败: ' + error.message, 'error');
            }
            return null;
        }
    },

    async updateProduct(productId, productData) {
        try {
            const { data, error } = await supabaseClient
                .from('erp_products')
                .update({
                    name: productData.name,
                    sku: productData.sku || null,
                    category: productData.category || '',
                    description: productData.description || '',
                    price: parseFloat(productData.price) || 0,
                    cost: parseFloat(productData.cost) || 0,
                    stock_quantity: parseInt(productData.stock_quantity) || 0,
                    min_stock: parseInt(productData.min_stock) || 0,
                    unit: productData.unit || 'piece',
                    status: productData.status || 'active'
                })
                .eq('id', productId)
                .eq('user_id', userData.user.id)
                .select()
                .single();

            if (error) {
                throw error;
            }

            // 更新本地状态
            const index = this.state.products.findIndex(p => this.isSameId(p.id, productId));
            if (index !== -1) {
                this.state.products[index] = data;
            }

            if (typeof showToast === 'function') {
                showToast('产品更新成功', 'success');
            }

            return data;

        } catch (error) {
            console.error('[ERP] 更新产品失败:', error);
            if (typeof showToast === 'function') {
                showToast('更新产品失败: ' + error.message, 'error');
            }
            return null;
        }
    },

    async deleteProduct(productId) {
        try {
            const { error } = await supabaseClient
                .from('erp_products')
                .delete()
                .eq('id', productId)
                .eq('user_id', userData.user.id);

            if (error) {
                throw error;
            }

            // 更新本地状态
            this.state.products = this.state.products.filter(p => !this.isSameId(p.id, productId));

            if (typeof showToast === 'function') {
                showToast('产品删除成功', 'success');
            }

            return true;

        } catch (error) {
            console.error('[ERP] 删除产品失败:', error);
            if (typeof showToast === 'function') {
                showToast('删除产品失败: ' + error.message, 'error');
            }
            return false;
        }
    },

    // ==================== 订单管理 ====================
    async loadOrdersLegacy() {
        try {
            const { data, error } = await supabaseClient
                .from('erp_orders')
                .select(`
                    *,
                    customer:erp_customers(id, name, contact_person),
                    items:erp_order_items(*)
                `)
                .eq('user_id', userData.user.id)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            return data || [];

        } catch (error) {
            console.error('[ERP] 加载订单数据失败:', error);
            return [];
        }
    },

    async createOrder(orderData, items) {
        try {
            // 生成订单号
            const { data: orderNumData, error: orderNumError } = await supabaseClient
                .rpc('generate_order_number');

            if (orderNumError) {
                throw orderNumError;
            }

            const orderNumber = orderNumData;

            // 计算订单总金额
            const totalAmount = items.reduce((sum, item) => {
                return sum + (item.quantity * item.unit_price);
            }, 0);

            // 计算订单总成本
            let totalCost = 0;
            for (const item of items) {
                const product = this.state.products.find(p => this.isSameId(p.id, item.product_id));
                if (product) {
                    totalCost += (product.cost || 0) * item.quantity;
                }
            }

            // 计算净利润
            const netProfit = totalAmount - totalCost;

            // 创建订单
            const { data: order, error: orderError } = await supabaseClient
                .from('erp_orders')
                .insert([{
                    user_id: userData.user.id,
                    customer_id: orderData.customer_id || null,
                    order_number: orderNumber,
                    order_date: new Date().toISOString(),
                    total_amount: totalAmount,
                    total_cost: totalCost,
                    net_profit: netProfit,
                    status: 'pending',
                    payment_status: 'unpaid',
                    notes: orderData.notes || '',
                    shipping_company: orderData.shipping_company || null,
                    tracking_number: orderData.tracking_number || null,
                    shipping_status: orderData.shipping_status || 'not_shipped'
                }])
                .select()
                .single();

            if (orderError) {
                throw orderError;
            }

            // 创建订单明细
            const orderItems = items.map(item => {
                const product = this.state.products.find(p => this.isSameId(p.id, item.product_id));
                const unitCost = product ? (product.cost || 0) : 0;
                const itemTotalCost = unitCost * item.quantity;
                const itemTotalPrice = item.quantity * item.unit_price;
                const itemNetProfit = itemTotalPrice - itemTotalCost;

                return {
                    order_id: order.id,
                    product_id: item.product_id,
                    product_name: item.product_name,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    unit_cost: unitCost,
                    total_cost: itemTotalCost,
                    net_profit: itemNetProfit
                };
            });

            const { data: itemsData, error: itemsError } = await supabaseClient
                .from('erp_order_items')
                .insert(orderItems)
                .select();

            if (itemsError) {
                throw itemsError;
            }

            // 更新库存
            for (const item of items) {
                if (item.product_id) {
                    await this.updateStock(item.product_id, -item.quantity, 'sale', order.id);
                }
            }

            const { incomeDescription, costDescription, profitDescription } = this.buildOrderFinanceDescriptions(
                orderNumber,
                order.customer_id,
                items,
                totalAmount,
                totalCost,
                netProfit
            );

            // 创建财务记录（收入）
            await this.addFinanceRecord({
                type: 'income',
                category: '销售订单',
                amount: totalAmount,
                description: incomeDescription,
                reference_id: order.id,
                order_id: order.id
            });

            // 创建财务记录（成本）
            if (totalCost > 0) {
                await this.addFinanceRecord({
                    type: 'expense',
                    category: '销售成本',
                    amount: totalCost,
                    description: costDescription,
                    reference_id: order.id,
                    order_id: order.id
                });
            }

            // 创建财务记录（系统利润）
            await this.addOrderProfitFinance(order.id, orderNumber, netProfit, profitDescription);

            // 更新本地状态
            order.items = itemsData;
            this.state.orders.unshift(order);
            this.state.loaded.finances = false;

            if (typeof showToast === 'function') {
                showToast('订单创建成功', 'success');
            }

            return order;

        } catch (error) {
            console.error('[ERP] 创建订单失败:', error);
            if (typeof showToast === 'function') {
                showToast('创建订单失败: ' + error.message, 'error');
            }
            return null;
        }
    },

    async updateOrderStatus(orderId, status, paymentStatus = null) {
        try {
            const updateData = {
                status: status
            };

            if (paymentStatus) {
                updateData.payment_status = paymentStatus;
            }

            const { data, error } = await supabaseClient
                .from('erp_orders')
                .update(updateData)
                .eq('id', orderId)
                .eq('user_id', userData.user.id)
                .select()
                .single();

            if (error) {
                throw error;
            }

            // 更新本地状态
            const index = this.state.orders.findIndex(o => this.isSameId(o.id, orderId));
            if (index !== -1) {
                this.state.orders[index] = { ...this.state.orders[index], ...data };
            }

            if (typeof showToast === 'function') {
                showToast('订单状态更新成功', 'success');
            }

            return data;

        } catch (error) {
            console.error('[ERP] 更新订单状态失败:', error);
            if (typeof showToast === 'function') {
                showToast('更新订单状态失败: ' + error.message, 'error');
            }
            return null;
        }
    },

    async addOrder(orderData) {
        try {
            // 生成订单号
            const { data: orderNumData, error: orderNumError } = await supabaseClient
                .rpc('generate_order_number');

            if (orderNumError) {
                throw orderNumError;
            }

            const orderNumber = orderNumData;

            const manualTotalAmount = parseFloat(orderData.total_amount);

            // 计算订单总金额
            const calculatedTotalAmount = orderData.items.reduce((sum, item) => {
                return sum + (item.quantity * item.unit_price);
            }, 0);

            const totalAmount = Number.isFinite(manualTotalAmount) && manualTotalAmount > 0
                ? manualTotalAmount
                : calculatedTotalAmount;

            // 计算订单总成本
            let totalCost = 0;
            for (const item of orderData.items) {
                const product = this.state.products.find(p => this.isSameId(p.id, item.product_id));
                if (product) {
                    const itemCost = (product.cost || 0) * item.quantity;
                    totalCost += itemCost;
                }
            }

            // 计算净利润
            const netProfit = totalAmount - totalCost;

            // 创建订单
            const { data: order, error: orderError } = await supabaseClient
                .from('erp_orders')
                .insert([{
                    user_id: userData.user.id,
                    customer_id: orderData.customer_id || null,
                    order_number: orderNumber,
                    order_date: new Date().toISOString(),
                    total_amount: totalAmount,
                    total_cost: totalCost,
                    net_profit: netProfit,
                    status: orderData.status || 'pending',
                    payment_status: orderData.payment_status || 'unpaid',
                    notes: orderData.notes || '',
                    shipping_company: orderData.shipping_company || null,
                    tracking_number: orderData.tracking_number || null,
                    shipping_status: orderData.shipping_status || 'not_shipped'
                }])
                .select()
                .single();

            if (orderError) {
                throw orderError;
            }

            // 创建订单明细
            const orderItems = orderData.items.map(item => {
                const product = this.state.products.find(p => this.isSameId(p.id, item.product_id));
                const unitCost = product ? (product.cost || 0) : 0;
                const itemTotalCost = unitCost * item.quantity;
                const itemTotalPrice = item.quantity * item.unit_price;
                const itemNetProfit = itemTotalPrice - itemTotalCost;

                return {
                    order_id: order.id,
                    product_id: item.product_id,
                    product_name: item.product_name,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    unit_cost: unitCost,
                    total_cost: itemTotalCost,
                    net_profit: itemNetProfit
                };
            });

            const { data: itemsDataRaw, error: itemsError } = await supabaseClient
                .from('erp_order_items')
                .insert(orderItems)
                .select();

            if (itemsError) {
                console.error('[ERP] 订单明细写入失败，继续执行后处理:', itemsError);
            }

            const itemsData = itemsDataRaw || [];

            // 先返回订单创建结果，减少用户等待体感
            order.items = itemsData;
            this.state.orders.unshift(order);
            this.emitEvent('erpOrderChanged', { orderId: order.id, action: 'created' });

            // 库存/财务后处理改为异步执行，完成后会通过事件刷新页面
            this.postProcessOrder(order, orderData.items, {
                orderNumber,
                totalAmount,
                totalCost,
                netProfit
            }, {
                customerName: orderData.customer_name || ''
            }).catch(error => {
                console.error('[ERP] 订单后处理失败:', error);
                if (typeof showToast === 'function') {
                    showToast('订单已保存，库存/财务同步稍后自动重试', 'warning');
                }
            });

            if (typeof showToast === 'function') {
                showToast('订单创建成功', 'success');
            }

            return order;

        } catch (error) {
            console.error('[ERP] 创建订单失败:', error);
            if (typeof showToast === 'function') {
                showToast('创建订单失败: ' + error.message, 'error');
            }
            return null;
        }
    },

    buildOrderContext(orderNumber, customerId, items = [], context = {}) {
        const customer = (this.state.customers || []).find(item => this.isSameId(item.id, customerId));
        const fallbackCustomerName = String(context?.customerName || '').trim();
        const customerName = customer?.name || fallbackCustomerName || '未知客户';

        const itemNames = (items || []).map(item => {
            const product = (this.state.products || []).find(p => this.isSameId(p.id, item?.product_id));
            const productName = item?.product_name || product?.name || '';
            const quantity = Number(item?.quantity);

            if (!productName) {
                return '';
            }

            if (Number.isFinite(quantity) && quantity > 0) {
                return `${productName}x${quantity}`;
            }

            return productName;
        }).filter(Boolean);

        const productSummary = itemNames.length === 0
            ? '未识别商品'
            : `${itemNames.slice(0, 3).join('、')}${itemNames.length > 3 ? ` 等${itemNames.length}项` : ''}`;

        return `订单 ${orderNumber} | 客户:${customerName} | 商品:${productSummary}`;
    },

    buildOrderFinanceDescriptions(orderNumber, customerId, items = [], totalAmount = 0, totalCost = 0, netProfit = 0, context = {}) {
        const orderContext = this.buildOrderContext(orderNumber, customerId, items, context);
        const amountText = `¥${parseFloat(totalAmount || 0).toFixed(2)}`;
        const costText = `¥${parseFloat(totalCost || 0).toFixed(2)}`;
        const profitText = `¥${parseFloat(netProfit || 0).toFixed(2)}`;

        return {
            orderContext,
            incomeDescription: `${orderContext} | 销售额:${amountText} | 成本:${costText} | 利润:${profitText}`,
            costDescription: `${orderContext} | 销售成本:${costText}`,
            profitDescription: `${orderContext} | 系统利润:${profitText}`
        };
    },

    async postProcessOrder(order, items, summary, context = {}) {
        const { orderNumber, totalAmount, totalCost, netProfit } = summary;
        const { incomeDescription, costDescription, profitDescription } = this.buildOrderFinanceDescriptions(
            orderNumber,
            order.customer_id,
            items,
            totalAmount,
            totalCost,
            netProfit,
            context
        );

        let stockChanged = false;
        let financeChanged = false;

        // 更新库存（并行执行）
        const stockResults = await Promise.all((items || []).map(item => {
            if (!item.product_id) {
                return Promise.resolve();
            }
            return this.updateStock(item.product_id, -item.quantity, 'sale', order.id);
        }));
        stockChanged = stockResults.some(Boolean);

        // 创建财务记录（并行）
        const financeTasks = [
            this.addFinanceRecord({
                type: 'income',
                category: '销售订单',
                amount: totalAmount,
                description: incomeDescription,
                reference_id: order.id,
                order_id: order.id
            }),
            this.addOrderProfitFinance(order.id, orderNumber, netProfit, profitDescription)
        ];

        if (totalCost > 0) {
            financeTasks.push(this.addFinanceRecord({
                type: 'expense',
                category: '销售成本',
                amount: totalCost,
                description: costDescription,
                reference_id: order.id,
                order_id: order.id
            }));
        }

        const financeResults = await Promise.all(financeTasks);
        const hasFailed = financeResults.some(result => !result);
        financeChanged = financeResults.some(Boolean);

        if (hasFailed) {
            console.warn('[ERP] 订单财务记录部分写入失败，触发自动补录');
            await this.ensureOrderFinanceRecords(order, orderNumber, totalAmount, totalCost, netProfit, items);
            financeChanged = true;
        }

        if (stockChanged) {
            this.emitEvent('erpInventoryChanged', { orderId: order.id });
        }

        if (financeChanged) {
            this.state.loaded.finances = false;
            this.emitEvent('erpFinanceChanged', { orderId: order.id });
        }

        this.emitEvent('erpOrderPostProcessed', {
            orderId: order.id,
            orderNumber,
            financeChanged,
            stockChanged
        });
    },

    async updateOrder(orderId, orderData) {
        try {
            const localOrder = this.state.orders.find(o => this.isSameId(o.id, orderId)) || {};
            const orderNumber = localOrder.order_number || `订单#${orderId}`;
            const totalCost = parseFloat(localOrder.total_cost || 0);
            const manualTotalAmount = parseFloat(orderData.total_amount);
            const currentAmount = parseFloat(localOrder.total_amount || 0);
            const totalAmount = Number.isFinite(manualTotalAmount) && manualTotalAmount > 0
                ? manualTotalAmount
                : currentAmount;
            const netProfit = totalAmount - totalCost;

            const { data, error } = await supabaseClient
                .from('erp_orders')
                .update({
                    customer_id: orderData.customer_id || null,
                    status: orderData.status || 'pending',
                    payment_status: orderData.payment_status || 'unpaid',
                    total_amount: totalAmount,
                    total_cost: totalCost,
                    net_profit: netProfit,
                    notes: orderData.notes || '',
                    shipping_company: orderData.shipping_company || null,
                    tracking_number: orderData.tracking_number || null,
                    shipping_status: orderData.shipping_status || 'not_shipped'
                })
                .eq('id', orderId)
                .eq('user_id', userData.user.id)
                .select()
                .single();

            if (error) {
                throw error;
            }

            // 更新本地状态
            const index = this.state.orders.findIndex(o => this.isSameId(o.id, orderId));
            if (index !== -1) {
                this.state.orders[index] = { ...this.state.orders[index], ...data };
            }

            await this.syncOrderFinanceRecords(orderId, orderNumber, totalAmount, totalCost, netProfit);

            if (typeof showToast === 'function') {
                showToast('订单更新成功', 'success');
            }

            this.state.loaded.finances = false;

            return data;

        } catch (error) {
            console.error('[ERP] 更新订单失败:', error);
            if (typeof showToast === 'function') {
                showToast('更新订单失败: ' + error.message, 'error');
            }
            return null;
        }
    },

    async deleteOrder(orderId) {
        try {
            const { error } = await supabaseClient
                .from('erp_orders')
                .delete()
                .eq('id', orderId)
                .eq('user_id', userData.user.id);

            if (error) {
                throw error;
            }

            // 更新本地状态
            this.state.orders = this.state.orders.filter(o => !this.isSameId(o.id, orderId));

            if (typeof showToast === 'function') {
                showToast('订单删除成功', 'success');
            }

            return true;

        } catch (error) {
            console.error('[ERP] 删除订单失败:', error);
            if (typeof showToast === 'function') {
                showToast('删除订单失败: ' + error.message, 'error');
            }
            return false;
        }
    },

    // ==================== 库存管理 ====================
    async updateStock(productId, quantityChange, type, referenceId = null, notes = '') {
        try {
            // 获取当前库存
            const { data: product, error: productError } = await supabaseClient
                .from('erp_products')
                .select('stock_quantity')
                .eq('id', productId)
                .eq('user_id', userData.user.id)
                .single();

            if (productError) {
                throw productError;
            }

            const currentQuantity = product.stock_quantity;
            const newQuantity = currentQuantity + quantityChange;

            // 更新产品库存
            const { error: updateError } = await supabaseClient
                .from('erp_products')
                .update({ stock_quantity: newQuantity })
                .eq('id', productId)
                .eq('user_id', userData.user.id);

            if (updateError) {
                throw updateError;
            }

            // 记录库存变动
            const { error: logError } = await supabaseClient
                .from('erp_inventory_logs')
                .insert([{
                    user_id: userData.user.id,
                    product_id: productId,
                    quantity_change: quantityChange,
                    current_quantity: newQuantity,
                    type: type,
                    reference_id: referenceId,
                    notes: notes
                }]);

            if (logError) {
                throw logError;
            }

            // 更新本地状态
            const productIndex = this.state.products.findIndex(p => this.isSameId(p.id, productId));
            if (productIndex !== -1) {
                this.state.products[productIndex].stock_quantity = newQuantity;
            }

            this.emitEvent('erpInventoryChanged', {
                productId,
                quantityChange,
                currentQuantity: newQuantity,
                type,
                referenceId
            });

            return true;

        } catch (error) {
            console.error('[ERP] 更新库存失败:', error);
            if (typeof showToast === 'function') {
                showToast('更新库存失败: ' + error.message, 'error');
            }
            return false;
        }
    },

    async adjustInventory(productId, quantityChange, type, notes) {
        try {
            const result = await this.updateStock(productId, quantityChange, type, null, notes);

            if (result) {
                // 创建财务记录
                if (type === 'purchase') {
                    await this.addFinanceRecord({
                        type: 'expense',
                        category: '采购',
                        amount: Math.abs(quantityChange) * 0, // 这里需要根据实际情况计算
                        description: `库存调整 - ${type}`,
                        reference_id: productId
                    });
                }

                if (typeof showToast === 'function') {
                    showToast('库存调整成功', 'success');
                }
            }

            return result;

        } catch (error) {
            console.error('[ERP] 调整库存失败:', error);
            if (typeof showToast === 'function') {
                showToast('调整库存失败: ' + error.message, 'error');
            }
            return false;
        }
    },

    // ==================== 财务管理 ====================
    async loadFinancesLegacy() {
        try {
            const { data, error } = await supabaseClient
                .from('erp_finances')
                .select('*')
                .eq('user_id', userData.user.id)
                .order('transaction_date', { ascending: false });

            if (error) {
                throw error;
            }

            return data || [];

        } catch (error) {
            console.error('[ERP] 加载财务数据失败:', error);
            return [];
        }
    },

    async addFinanceRecord(financeData) {
        try {
            const { data, error } = await supabaseClient
                .from('erp_finances')
                .insert([{
                    user_id: userData.user.id,
                    type: financeData.type, // income, expense
                    category: financeData.category || '',
                    amount: parseFloat(financeData.amount),
                    description: financeData.description || '',
                    reference_id: financeData.reference_id || null,
                    transaction_date: financeData.transaction_date || new Date().toISOString()
                }])
                .select()
                .single();

            if (error) {
                throw error;
            }

            this.state.finances.unshift(data);
            this.emitEvent('erpFinanceChanged', { record: data, action: 'created' });

            return data;

        } catch (error) {
            console.error('[ERP] 添加财务记录失败:', error);
            return null;
        }
    },

    async addOrderProfitFinance(orderId, orderNumber, netProfit, profitDescription = '') {
        const profitAmount = parseFloat(netProfit || 0);
        const description = profitDescription || `订单 ${orderNumber} - 系统利润`;

        const systemResult = await this.addFinanceRecord({
            type: 'system',
            category: '利润',
            amount: profitAmount,
            description,
            reference_id: orderId,
            order_id: orderId
        });

        if (systemResult) {
            return systemResult;
        }

        const compatibleType = profitAmount >= 0 ? 'income' : 'expense';
        return this.addFinanceRecord({
            type: compatibleType,
            category: '利润(系统)',
            amount: Math.abs(profitAmount),
            description: `${description}（兼容模式）`,
            reference_id: orderId,
            order_id: orderId
        });
    },

    async ensureOrderFinanceRecords(order, orderNumber, totalAmount, totalCost, netProfit, items = []) {
        const { incomeDescription, costDescription, profitDescription } = this.buildOrderFinanceDescriptions(
            orderNumber,
            order.customer_id,
            items,
            totalAmount,
            totalCost,
            netProfit
        );

        const { data: existingRows, error } = await supabaseClient
            .from('erp_finances')
            .select('id, type, category')
            .eq('user_id', userData.user.id)
            .eq('reference_id', order.id);

        if (error) {
            console.error('[ERP] 补录财务记录前查询失败:', error);
            return;
        }

        const rows = existingRows || [];
        const hasIncome = rows.some(row => row.type === 'income' && row.category === '销售订单');
        const hasCost = rows.some(row => row.type === 'expense' && row.category === '销售成本');
        const hasProfit = rows.some(row => row.type === 'system' || row.category === '利润' || row.category === '利润(系统)');

        if (!hasIncome) {
            await this.addFinanceRecord({
                type: 'income',
                category: '销售订单',
                amount: totalAmount,
                description: incomeDescription,
                reference_id: order.id,
                order_id: order.id
            });
        }

        if (totalCost > 0 && !hasCost) {
            await this.addFinanceRecord({
                type: 'expense',
                category: '销售成本',
                amount: totalCost,
                description: costDescription,
                reference_id: order.id,
                order_id: order.id
            });
        }

        if (!hasProfit) {
            await this.addOrderProfitFinance(order.id, orderNumber, netProfit, profitDescription);
        }
    },

    async syncOrderFinanceRecords(orderId, orderNumber, totalAmount, totalCost, netProfit) {
        const localOrder = this.state.orders.find(order => this.isSameId(order.id, orderId)) || {};
        const { incomeDescription, costDescription, profitDescription } = this.buildOrderFinanceDescriptions(
            orderNumber,
            localOrder.customer_id,
            localOrder.items || [],
            totalAmount,
            totalCost,
            netProfit
        );

        const { data: rows, error } = await supabaseClient
            .from('erp_finances')
            .select('id, type, category')
            .eq('user_id', userData.user.id)
            .eq('reference_id', orderId);

        if (error) {
            console.error('[ERP] 同步订单财务记录失败:', error);
            return;
        }

        const records = rows || [];
        const incomeRow = records.find(row => row.type === 'income' && row.category === '销售订单');
        const costRow = records.find(row => row.type === 'expense' && row.category === '销售成本');
        const profitRow = records.find(row => row.type === 'system' || row.category === '利润' || row.category === '利润(系统)');

        if (incomeRow) {
            await supabaseClient
                .from('erp_finances')
                .update({ amount: totalAmount, description: incomeDescription })
                .eq('id', incomeRow.id)
                .eq('user_id', userData.user.id);
        }

        if (costRow) {
            await supabaseClient
                .from('erp_finances')
                .update({ amount: totalCost, description: costDescription })
                .eq('id', costRow.id)
                .eq('user_id', userData.user.id);
        }

        if (profitRow) {
            await supabaseClient
                .from('erp_finances')
                .update({
                    amount: profitRow.type === 'system' ? netProfit : Math.abs(netProfit),
                    description: profitDescription
                })
                .eq('id', profitRow.id)
                .eq('user_id', userData.user.id);
        }

        await this.ensureOrderFinanceRecords(
            { id: orderId, customer_id: localOrder.customer_id },
            orderNumber,
            totalAmount,
            totalCost,
            netProfit,
            localOrder.items || []
        );
    },

    async addFinance(financeData) {
        try {
            const result = await this.addFinanceRecord(financeData);

            if (result) {
                if (typeof showToast === 'function') {
                    showToast('财务记录添加成功', 'success');
                }
            }

            return result;

        } catch (error) {
            console.error('[ERP] 添加财务失败:', error);
            if (typeof showToast === 'function') {
                showToast('添加财务失败: ' + error.message, 'error');
            }
            return null;
        }
    },

    async deleteFinance(financeId) {
        try {
            const { error } = await supabaseClient
                .from('erp_finances')
                .delete()
                .eq('id', financeId)
                .eq('user_id', userData.user.id);

            if (error) {
                throw error;
            }

            // 更新本地状态
            this.state.finances = this.state.finances.filter(f => !this.isSameId(f.id, financeId));

            if (typeof showToast === 'function') {
                showToast('财务记录删除成功', 'success');
            }

            return true;

        } catch (error) {
            console.error('[ERP] 删除财务记录失败:', error);
            if (typeof showToast === 'function') {
                showToast('删除财务记录失败: ' + error.message, 'error');
            }
            return false;
        }
    },

    // ==================== 统计数据 ====================
    getStatistics() {
        const calculateInventoryRisk = (products = []) => {
            return (products || []).filter(product => {
                const parsedStock = Number(product?.stock_quantity);
                const parsedMinStock = Number(product?.min_stock);
                const stock = Number.isFinite(parsedStock) ? parsedStock : 0;
                const minStock = Number.isFinite(parsedMinStock) ? parsedMinStock : 0;
                return minStock > 0 ? stock <= minStock : stock <= 3;
            }).length;
        };

        const stats = {
            customers: {
                total: this.state.customers.length,
                active: this.state.customers.filter(c => c.status === 'active').length,
                inactive: this.state.customers.filter(c => c.status === 'inactive').length
            },
            products: {
                total: this.state.products.length,
                active: this.state.products.filter(p => p.status === 'active').length,
                lowStock: calculateInventoryRisk(this.state.products),
                totalValue: this.state.products.reduce((sum, p) => sum + (p.price * p.stock_quantity), 0)
            },
            orders: {
                total: this.state.orders.length,
                pending: this.state.orders.filter(o => o.status === 'pending').length,
                processing: this.state.orders.filter(o => o.status === 'processing').length,
                completed: this.state.orders.filter(o => o.status === 'completed').length,
                totalRevenue: this.state.orders
                    .filter(o => o.status === 'completed')
                    .reduce((sum, o) => sum + parseFloat(o.total_amount), 0)
            },
            finances: {
                totalIncome: this.state.finances
                    .filter(f => f.type === 'income')
                    .reduce((sum, f) => sum + parseFloat(f.amount), 0),
                totalExpense: this.state.finances
                    .filter(f => f.type === 'expense')
                    .reduce((sum, f) => sum + parseFloat(f.amount), 0),
                netProfit: 0 // 将在下面计算
            }
        };

        stats.finances.netProfit = stats.finances.totalIncome - stats.finances.totalExpense;

        return stats;
    },

    // ==================== 搜索功能 ====================
    searchCustomers(keyword) {
        if (!keyword) return this.state.customers;

        const lowerKeyword = keyword.toLowerCase();
        return this.state.customers.filter(customer =>
            customer.name.toLowerCase().includes(lowerKeyword) ||
            customer.contact_person?.toLowerCase().includes(lowerKeyword) ||
            customer.phone?.includes(keyword) ||
            customer.email?.toLowerCase().includes(lowerKeyword)
        );
    },

    searchProducts(keyword) {
        if (!keyword) return this.state.products;

        const lowerKeyword = keyword.toLowerCase();
        return this.state.products.filter(product =>
            product.name.toLowerCase().includes(lowerKeyword) ||
            product.sku?.toLowerCase().includes(lowerKeyword) ||
            product.category?.toLowerCase().includes(lowerKeyword)
        );
    },

    searchOrders(keyword) {
        if (!keyword) return this.state.orders;

        const lowerKeyword = keyword.toLowerCase();
        return this.state.orders.filter(order =>
            order.order_number?.toLowerCase().includes(lowerKeyword) ||
            order.customer?.name?.toLowerCase().includes(lowerKeyword)
        );
    }
};

if (typeof window !== 'undefined') {
    window.ERP = ERP;
}

// ==================== 页面加载时初始化 ====================

// 立即设置事件监听器（在 DOMContentLoaded 之前）
window.addEventListener('userDataLoaded', function() {
    console.log('[ERP] userDataLoaded 事件触发');
    if (userData.isLoggedIn) {
        console.log('[ERP] 用户已登录，开始初始化 ERP');
        ERP.init();
    }
});

// 页面加载完成后，检查用户是否已经登录
document.addEventListener('DOMContentLoaded', function() {
    console.log('[ERP] DOMContentLoaded 触发');
    console.log('[ERP] userData.isLoggedIn:', userData.isLoggedIn);
    // 如果用户数据已经加载（userDataLoaded 事件可能在 DOMContentLoaded 之前触发）
    if (userData.isLoggedIn) {
        console.log('[ERP] 用户已登录，开始初始化 ERP（DOMContentLoaded）');
        ERP.init();
    }
});
