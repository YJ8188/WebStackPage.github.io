/**
 * 移动端ERP - API封装
 * 负责: Supabase API调用、请求队列、错误处理
 */

class API {
  constructor() {
    this.supabase = null;
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.tableNames = {
      customers: 'erp_customers',
      products: 'erp_products',
      orders: 'erp_orders',
      orderItems: 'erp_order_items',
      inventoryRecords: 'erp_inventory_logs',
      financeRecords: 'erp_finances'
    };
    this.init();
  }

  resolveSupabaseClient() {
    const client = window.supabaseClient || window.supabase;
    if (client && typeof client.from === 'function') {
      return client;
    }
    return null;
  }

  ensureSupabaseClient() {
    if (this.supabase && typeof this.supabase.from === 'function') {
      return this.supabase;
    }
    this.supabase = this.resolveSupabaseClient();
    if (!this.supabase) {
      throw new Error('数据库客户端未初始化，请刷新页面后重试');
    }
    return this.supabase;
  }

  init() {
    this.supabase = this.resolveSupabaseClient();
    if (!this.supabase) {
      console.error('Supabase客户端未加载或初始化失败');
    }
  }

  // 通用请求方法
  async request(fn, options = {}) {
    const { showLoading = false, showError = true, offline = false } = options;

    try {
      if (showLoading) {
        window.Loading?.show();
      }

      // 检查网络状态
      if (!navigator.onLine && !offline) {
        throw new Error('网络未连接');
      }

      if (!offline) {
        this.ensureSupabaseClient();
      }

      const result = await fn();

      if (showLoading) {
        window.Loading?.hide();
      }

      return result;

    } catch (error) {
      if (showLoading) {
        window.Loading?.hide();
      }

      if (showError) {
        const message = error.message || '请求失败';
        window.Toast?.show(message, 'error');
      }

      throw error;
    }
  }

  // ==================== 客户管理 ====================

  async getCustomers(options = {}) {
    const { keyword = '', limit = 20, offset = 0 } = options;

    return this.request(async () => {
      let query = this.supabase
        .from(this.tableNames.customers)
        .select('*')
        .order('created_at', { ascending: false });

      if (keyword) {
        query = query.or(`name.ilike.%${keyword}%,contact_person.ilike.%${keyword}%,phone.ilike.%${keyword}%`);
      }

      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    }, options);
  }

  async getCustomer(id) {
    return this.request(async () => {
      const { data, error } = await this.supabase
        .from(this.tableNames.customers)
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    });
  }

  async createCustomer(customer) {
    return this.request(async () => {
      const { data, error } = await this.supabase
        .from(this.tableNames.customers)
        .insert([customer])
        .select()
        .single();

      if (error) throw error;
      return data;
    }, { showLoading: true, showError: true });
  }

  async updateCustomer(id, updates) {
    return this.request(async () => {
      const { data, error } = await this.supabase
        .from(this.tableNames.customers)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }, { showLoading: true, showError: true });
  }

  async deleteCustomer(id) {
    return this.request(async () => {
      const { error } = await this.supabase
        .from(this.tableNames.customers)
        .delete()
        .eq('id', id);

      if (error) throw error;
    }, { showLoading: true, showError: true });
  }

  // ==================== 产品管理 ====================

  async getProducts(options = {}) {
    const { keyword = '', category = '', limit = 20, offset = 0 } = options;

    return this.request(async () => {
      let query = this.supabase
        .from(this.tableNames.products)
        .select('*')
        .order('created_at', { ascending: false });

      if (keyword) {
        query = query.or(`name.ilike.%${keyword}%,sku.ilike.%${keyword}%`);
      }

      if (category) {
        query = query.eq('category', category);
      }

      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    }, options);
  }

  async getProduct(id) {
    return this.request(async () => {
      const { data, error } = await this.supabase
        .from(this.tableNames.products)
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    });
  }

  async createProduct(product) {
    return this.request(async () => {
      const { data, error } = await this.supabase
        .from(this.tableNames.products)
        .insert([product])
        .select()
        .single();

      if (error) throw error;
      return data;
    }, { showLoading: true, showError: true });
  }

  async updateProduct(id, updates) {
    return this.request(async () => {
      const { data, error } = await this.supabase
        .from(this.tableNames.products)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }, { showLoading: true, showError: true });
  }

  // ==================== 订单管理 ====================

  async getOrders(options = {}) {
    const { status = '', keyword = '', limit = 20, offset = 0 } = options;

    return this.request(async () => {
      let query = this.supabase
        .from(this.tableNames.orders)
        .select(`
          *,
          customer:erp_customers(id, name, phone, contact_person),
          items:erp_order_items(*)
        `)
        .order('created_at', { ascending: false });

      if (status) {
        const normalizedStatus = String(status || '').trim().toLowerCase();
        const statusAliasMap = {
          confirmed: ['confirmed', 'approved'],
          signed: ['signed', 'delivered']
        };
        const aliasStatus = statusAliasMap[normalizedStatus];
        if (Array.isArray(aliasStatus) && aliasStatus.length > 1) {
          query = query.in('status', aliasStatus);
        } else {
          query = query.eq('status', normalizedStatus);
        }
      }

      if (keyword) {
        query = query.or(`order_number.ilike.%${keyword}%`);
      }

      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    }, options);
  }

  async getOrder(id) {
    return this.request(async () => {
      const { data, error } = await this.supabase
        .from(this.tableNames.orders)
        .select(`
          *,
          customer:erp_customers(*),
          items:erp_order_items(
            *,
            product:erp_products(*)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    });
  }

  async createOrder(order) {
    return this.request(async () => {
      const { data, error } = await this.supabase
        .from(this.tableNames.orders)
        .insert([order])
        .select()
        .single();

      if (error) throw error;
      return data;
    }, { showLoading: true, showError: true });
  }

  async createOrderWithItems(payload = {}) {
    return this.request(async () => {
      const client = this.ensureSupabaseClient();
      const orderItems = Array.isArray(payload.items) ? payload.items : [];
      if (orderItems.length === 0) {
        throw new Error('请至少选择一个商品');
      }

      const productIds = [...new Set(
        orderItems
          .map(item => item?.product_id)
          .filter(id => id !== null && id !== undefined && String(id).trim() !== '')
      )];

      if (productIds.length === 0) {
        throw new Error('商品信息不完整');
      }

      const { data: productRows, error: productError } = await client
        .from(this.tableNames.products)
        .select('id, name, price, cost, stock_quantity')
        .in('id', productIds);

      if (productError) throw productError;

      const productMap = new Map((productRows || []).map(item => [String(item.id), item]));
      const normalizedItems = [];
      let totalAmount = 0;
      let totalCost = 0;

      for (const item of orderItems) {
        const productId = String(item?.product_id || '').trim();
        const quantity = parseInt(item?.quantity, 10);
        const product = productMap.get(productId);

        if (!product) {
          throw new Error('部分商品不存在或已被删除');
        }
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error(`商品「${product.name || productId}」数量不合法`);
        }

        const currentStock = Number(product?.stock_quantity || 0);
        if (currentStock < quantity) {
          throw new Error(`商品「${product.name || productId}」库存不足，当前库存：${currentStock}`);
        }

        const unitPrice = Number(item?.unit_price ?? product?.price ?? 0);
        const unitCost = Number(product?.cost || 0);
        const itemTotalPrice = unitPrice * quantity;
        const itemTotalCost = unitCost * quantity;

        totalAmount += itemTotalPrice;
        totalCost += itemTotalCost;
        normalizedItems.push({
          product_id: product.id,
          product_name: item?.product_name || product?.name || '未命名商品',
          quantity,
          unit_price: unitPrice,
          unit_cost: unitCost,
          total_cost: itemTotalCost,
          net_profit: itemTotalPrice - itemTotalCost,
          current_stock: currentStock
        });
      }

      let orderNumber = `ORD-${Date.now()}`;
      const { data: orderNumberData, error: orderNumberError } = await client.rpc('generate_order_number');
      if (!orderNumberError && orderNumberData) {
        orderNumber = orderNumberData;
      }

      const currentUser = window.MobileERP?.getCurrentUser?.() || null;
      const status = String(payload.status || 'pending').trim().toLowerCase() || 'pending';
      const paymentStatus = String(payload.payment_status || 'unpaid').trim().toLowerCase() || 'unpaid';
      const shippingStatus = String(payload.shipping_status || 'not_shipped').trim().toLowerCase() || 'not_shipped';

      const { data: orderRow, error: orderError } = await client
        .from(this.tableNames.orders)
        .insert([{
          user_id: currentUser?.id || null,
          customer_id: payload.customer_id || null,
          order_number: orderNumber,
          order_date: new Date().toISOString(),
          total_amount: totalAmount,
          total_cost: totalCost,
          net_profit: totalAmount - totalCost,
          status,
          payment_status: paymentStatus,
          notes: payload.notes || '',
          shipping_company: payload.shipping_company || null,
          tracking_number: payload.tracking_number || null,
          shipping_status: shippingStatus
        }])
        .select('*')
        .single();

      if (orderError) throw orderError;

      const rows = normalizedItems.map(item => ({
        order_id: orderRow.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        unit_cost: item.unit_cost,
        total_cost: item.total_cost,
        net_profit: item.net_profit
      }));

      const { error: orderItemsError } = await client
        .from(this.tableNames.orderItems)
        .insert(rows);
      if (orderItemsError) throw orderItemsError;

      const inventoryTasks = normalizedItems.map(async (item) => {
        const nextStock = Math.max(0, Number(item.current_stock || 0) - Number(item.quantity || 0));
        const { error: updateStockError } = await client
          .from(this.tableNames.products)
          .update({ stock_quantity: nextStock })
          .eq('id', item.product_id);
        if (updateStockError) throw updateStockError;

        const { error: logError } = await client
          .from(this.tableNames.inventoryRecords)
          .insert([{
            product_id: item.product_id,
            quantity_change: -Math.abs(Number(item.quantity || 0)),
            type: 'order_lock',
            reference_id: orderRow.id,
            notes: `订单${orderNumber}创建锁定库存`
          }]);
        if (logError) throw logError;
      });

      const inventoryResults = await Promise.allSettled(inventoryTasks);
      const inventoryFailed = inventoryResults.some(result => result.status === 'rejected');

      const { data: fullOrder } = await client
        .from(this.tableNames.orders)
        .select(`
          *,
          customer:erp_customers(id, name, phone, contact_person),
          items:erp_order_items(*)
        `)
        .eq('id', orderRow.id)
        .single();

      return {
        ...(fullOrder || orderRow),
        _inventorySyncWarning: inventoryFailed
      };
    }, { showLoading: true, showError: true });
  }

  async updateOrder(id, updates) {
    return this.request(async () => {
      const { data, error } = await this.supabase
        .from(this.tableNames.orders)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }, { showLoading: true, showError: true });
  }

  async updateOrderStatus(id, status) {
    return this.updateOrder(id, { status });
  }

  // ==================== 库存管理 ====================

  async getInventoryRecords(options = {}) {
    const { type = '', limit = 20, offset = 0 } = options;

    return this.request(async () => {
      let query = this.supabase
        .from(this.tableNames.inventoryRecords)
        .select(`
          *,
          product:erp_products(*)
        `)
        .order('created_at', { ascending: false });

      if (type) {
        query = query.eq('type', type);
      }

      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    }, options);
  }

  async createInventoryRecord(record) {
    return this.request(async () => {
      const { data, error } = await this.supabase
        .from(this.tableNames.inventoryRecords)
        .insert([record])
        .select()
        .single();

      if (error) throw error;
      return data;
    }, { showLoading: true, showError: true });
  }

  // ==================== 财务管理 ====================

  async getFinanceRecords(options = {}) {
    const { type = '', limit = 20, offset = 0 } = options;

    return this.request(async () => {
      let query = this.supabase
        .from(this.tableNames.financeRecords)
        .select('*')
        .order('transaction_date', { ascending: false });

      if (type) {
        query = query.eq('type', type);
      }

      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    }, options);
  }

  // ==================== 统计数据 ====================

  async getDashboardStats() {
    return this.request(async () => {
      // 并行请求多个统计数据
      const [ordersResult, productsResult, customersResult] = await Promise.all([
        this.supabase.from(this.tableNames.orders).select('id, total_amount, status, created_at'),
        this.supabase.from(this.tableNames.products).select('id, stock_quantity, min_stock'),
        this.supabase.from(this.tableNames.customers).select('id')
      ]);

      const orders = ordersResult.data || [];
      const products = productsResult.data || [];
      const customers = customersResult.data || [];

      // 计算统计数据
      const stats = {
        todayOrders: orders.filter(o => {
          const today = new Date().toDateString();
          return new Date(o.created_at).toDateString() === today;
        }).length,
        pendingOrders: orders.filter(o => ['confirmed', 'approved'].includes(String(o.status || '').toLowerCase())).length,
        lowStockProducts: products.filter(p => p.stock_quantity <= (p.min_stock || 0)).length,
        totalCustomers: customers.length,
        totalRevenue: orders
          .filter(o => o.status === 'completed')
          .reduce((sum, o) => sum + (o.total_amount || 0), 0)
      };

      return stats;
    });
  }
}

// 导出全局实例
window.API = new API();
