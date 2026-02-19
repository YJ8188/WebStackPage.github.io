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
        query = query.eq('status', status);
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
        pendingOrders: orders.filter(o => o.status === 'pending').length,
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
