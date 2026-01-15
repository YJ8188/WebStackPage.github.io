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
    },

    // ==================== 初始化 ====================
    async init() {
        console.log('[ERP] 初始化ERP系统...');

        // 检查用户登录状态
        if (!userData.isLoggedIn) {
            console.log('[ERP] 用户未登录，跳过初始化');
            return;
        }

        // 加载所有数据
        await this.loadAllData();

        console.log('[ERP] ERP系统初始化完成');
    },

    // ==================== 数据加载 ====================
    async loadAllData() {
        console.log('[ERP] 开始加载所有数据...');

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

            console.log('[ERP] 数据加载完成:', {
                customers: customers.length,
                products: products.length,
                orders: orders.length,
                finances: finances.length
            });

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

    // ==================== 客户管理 ====================
    async loadCustomers() {
        console.log('[ERP] 加载客户数据...');

        try {
            const { data, error } = await supabaseClient
                .from('erp_customers')
                .select('*')
                .eq('user_id', userData.user.id)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            console.log('[ERP] 客户数据加载成功:', data.length);
            return data || [];

        } catch (error) {
            console.error('[ERP] 加载客户数据失败:', error);
            return [];
        }
    },

    async addCustomer(customerData) {
        console.log('[ERP] 添加客户:', customerData);

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

            console.log('[ERP] 客户添加成功:', data);
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
        console.log('[ERP] 更新客户:', customerId, customerData);

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

            console.log('[ERP] 客户更新成功:', data);

            // 更新本地状态
            const index = this.state.customers.findIndex(c => c.id === customerId);
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
        console.log('[ERP] 删除客户:', customerId);

        try {
            const { error } = await supabaseClient
                .from('erp_customers')
                .delete()
                .eq('id', customerId)
                .eq('user_id', userData.user.id);

            if (error) {
                throw error;
            }

            console.log('[ERP] 客户删除成功');

            // 更新本地状态
            this.state.customers = this.state.customers.filter(c => c.id !== customerId);

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
    async loadProducts() {
        console.log('[ERP] 加载产品数据...');

        try {
            const { data, error } = await supabaseClient
                .from('erp_products')
                .select('*')
                .eq('user_id', userData.user.id)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            console.log('[ERP] 产品数据加载成功:', data.length);
            return data || [];

        } catch (error) {
            console.error('[ERP] 加载产品数据失败:', error);
            return [];
        }
    },

    async addProduct(productData) {
        console.log('[ERP] 添加产品:', productData);

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

            console.log('[ERP] 产品添加成功:', data);
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
        console.log('[ERP] 更新产品:', productId, productData);

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

            console.log('[ERP] 产品更新成功:', data);

            // 更新本地状态
            const index = this.state.products.findIndex(p => p.id === productId);
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
        console.log('[ERP] 删除产品:', productId);

        try {
            const { error } = await supabaseClient
                .from('erp_products')
                .delete()
                .eq('id', productId)
                .eq('user_id', userData.user.id);

            if (error) {
                throw error;
            }

            console.log('[ERP] 产品删除成功');

            // 更新本地状态
            this.state.products = this.state.products.filter(p => p.id !== productId);

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
    async loadOrders() {
        console.log('[ERP] 加载订单数据...');

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

            console.log('[ERP] 订单数据加载成功:', data.length);
            return data || [];

        } catch (error) {
            console.error('[ERP] 加载订单数据失败:', error);
            return [];
        }
    },

    async createOrder(orderData, items) {
        console.log('[ERP] 创建订单:', orderData, items);

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

            // 创建订单
            const { data: order, error: orderError } = await supabaseClient
                .from('erp_orders')
                .insert([{
                    user_id: userData.user.id,
                    customer_id: orderData.customer_id || null,
                    order_number: orderNumber,
                    order_date: new Date().toISOString(),
                    total_amount: totalAmount,
                    status: 'pending',
                    payment_status: 'unpaid',
                    notes: orderData.notes || ''
                }])
                .select()
                .single();

            if (orderError) {
                throw orderError;
            }

            console.log('[ERP] 订单创建成功:', order);

            // 创建订单明细
            const orderItems = items.map(item => ({
                order_id: order.id,
                product_id: item.product_id,
                product_name: item.product_name,
                quantity: item.quantity,
                unit_price: item.unit_price
            }));

            const { data: itemsData, error: itemsError } = await supabaseClient
                .from('erp_order_items')
                .insert(orderItems)
                .select();

            if (itemsError) {
                throw itemsError;
            }

            console.log('[ERP] 订单明细创建成功:', itemsData);

            // 更新库存
            for (const item of items) {
                if (item.product_id) {
                    await this.updateStock(item.product_id, -item.quantity, 'sale', order.id);
                }
            }

            // 创建财务记录
            await this.addFinanceRecord({
                type: 'income',
                category: '销售订单',
                amount: totalAmount,
                description: `订单 ${orderNumber}`,
                reference_id: order.id
            });

            // 更新本地状态
            order.items = itemsData;
            this.state.orders.unshift(order);

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
        console.log('[ERP] 更新订单状态:', orderId, status, paymentStatus);

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

            console.log('[ERP] 订单状态更新成功:', data);

            // 更新本地状态
            const index = this.state.orders.findIndex(o => o.id === orderId);
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
        console.log('[ERP] 添加订单:', orderData);

        try {
            // 生成订单号
            const { data: orderNumData, error: orderNumError } = await supabaseClient
                .rpc('generate_order_number');

            if (orderNumError) {
                throw orderNumError;
            }

            const orderNumber = orderNumData;

            // 计算订单总金额
            const totalAmount = orderData.items.reduce((sum, item) => {
                return sum + (item.quantity * item.unit_price);
            }, 0);

            // 创建订单
            const { data: order, error: orderError } = await supabaseClient
                .from('erp_orders')
                .insert([{
                    user_id: userData.user.id,
                    customer_id: orderData.customer_id || null,
                    order_number: orderNumber,
                    order_date: new Date().toISOString(),
                    total_amount: totalAmount,
                    status: orderData.status || 'pending',
                    payment_status: orderData.payment_status || 'unpaid',
                    notes: orderData.notes || ''
                }])
                .select()
                .single();

            if (orderError) {
                throw orderError;
            }

            console.log('[ERP] 订单创建成功:', order);

            // 创建订单明细
            const orderItems = orderData.items.map(item => ({
                order_id: order.id,
                product_id: item.product_id,
                product_name: item.product_name,
                quantity: item.quantity,
                unit_price: item.unit_price
            }));

            const { data: itemsData, error: itemsError } = await supabaseClient
                .from('erp_order_items')
                .insert(orderItems)
                .select();

            if (itemsError) {
                throw itemsError;
            }

            console.log('[ERP] 订单明细创建成功:', itemsData);

            // 更新库存
            for (const item of orderData.items) {
                if (item.product_id) {
                    await this.updateStock(item.product_id, -item.quantity, 'sale', order.id);
                }
            }

            // 创建财务记录
            await this.addFinanceRecord({
                type: 'income',
                category: '销售订单',
                amount: totalAmount,
                description: `订单 ${orderNumber}`,
                reference_id: order.id
            });

            // 更新本地状态
            order.items = itemsData;
            this.state.orders.unshift(order);

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

    async updateOrder(orderId, orderData) {
        console.log('[ERP] 更新订单:', orderId, orderData);

        try {
            const { data, error } = await supabaseClient
                .from('erp_orders')
                .update({
                    customer_id: orderData.customer_id || null,
                    status: orderData.status || 'pending',
                    payment_status: orderData.payment_status || 'unpaid',
                    notes: orderData.notes || ''
                })
                .eq('id', orderId)
                .eq('user_id', userData.user.id)
                .select()
                .single();

            if (error) {
                throw error;
            }

            console.log('[ERP] 订单更新成功:', data);

            // 更新本地状态
            const index = this.state.orders.findIndex(o => o.id === orderId);
            if (index !== -1) {
                this.state.orders[index] = { ...this.state.orders[index], ...data };
            }

            if (typeof showToast === 'function') {
                showToast('订单更新成功', 'success');
            }

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
        console.log('[ERP] 删除订单:', orderId);

        try {
            const { error } = await supabaseClient
                .from('erp_orders')
                .delete()
                .eq('id', orderId)
                .eq('user_id', userData.user.id);

            if (error) {
                throw error;
            }

            console.log('[ERP] 订单删除成功');

            // 更新本地状态
            this.state.orders = this.state.orders.filter(o => o.id !== orderId);

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
        console.log('[ERP] 更新库存:', productId, quantityChange, type);

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

            console.log('[ERP] 库存更新成功');

            // 更新本地状态
            const productIndex = this.state.products.findIndex(p => p.id === productId);
            if (productIndex !== -1) {
                this.state.products[productIndex].stock_quantity = newQuantity;
            }

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
        console.log('[ERP] 调整库存:', productId, quantityChange, type, notes);

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
    async loadFinances() {
        console.log('[ERP] 加载财务数据...');

        try {
            const { data, error } = await supabaseClient
                .from('erp_finances')
                .select('*')
                .eq('user_id', userData.user.id)
                .order('transaction_date', { ascending: false });

            if (error) {
                throw error;
            }

            console.log('[ERP] 财务数据加载成功:', data.length);
            return data || [];

        } catch (error) {
            console.error('[ERP] 加载财务数据失败:', error);
            return [];
        }
    },

    async addFinanceRecord(financeData) {
        console.log('[ERP] 添加财务记录:', financeData);

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

            console.log('[ERP] 财务记录添加成功:', data);
            this.state.finances.unshift(data);

            return data;

        } catch (error) {
            console.error('[ERP] 添加财务记录失败:', error);
            return null;
        }
    },

    async addFinance(financeData) {
        console.log('[ERP] 添加财务:', financeData);

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
        console.log('[ERP] 删除财务记录:', financeId);

        try {
            const { error } = await supabaseClient
                .from('erp_finances')
                .delete()
                .eq('id', financeId)
                .eq('user_id', userData.user.id);

            if (error) {
                throw error;
            }

            console.log('[ERP] 财务记录删除成功');

            // 更新本地状态
            this.state.finances = this.state.finances.filter(f => f.id !== financeId);

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
        console.log('[ERP] 获取统计数据...');

        const stats = {
            customers: {
                total: this.state.customers.length,
                active: this.state.customers.filter(c => c.status === 'active').length,
                inactive: this.state.customers.filter(c => c.status === 'inactive').length
            },
            products: {
                total: this.state.products.length,
                active: this.state.products.filter(p => p.status === 'active').length,
                lowStock: this.state.products.filter(p => p.stock_quantity <= p.min_stock).length,
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

        console.log('[ERP] 统计数据:', stats);
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

// ==================== 页面加载时初始化 ====================
document.addEventListener('DOMContentLoaded', function() {
    // 等待用户数据加载完成
    window.addEventListener('userDataLoaded', function() {
        if (userData.isLoggedIn) {
            ERP.init();
        }
    });

    // 如果用户数据已经加载
    if (userData.isLoggedIn) {
        ERP.init();
    }
});
