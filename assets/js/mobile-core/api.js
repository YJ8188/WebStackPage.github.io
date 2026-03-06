/**
 * 移动端ERP - API封装
 * 负责: Supabase API调用、请求队列、错误处理
 */

class API {
  constructor() {
    this.supabase = null;
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.logisticsCache = new Map();
    this.tableNames = {
      customers: 'erp_customers',
      products: 'erp_products',
      orders: 'erp_orders',
      orderItems: 'erp_order_items',
      inventoryRecords: 'erp_inventory_logs',
      financeRecords: 'erp_finances',
      notes: 'erp_notes'
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

  getCurrentUserId() {
    return window.MobileERP?.getCurrentUser?.()?.id || null;
  }

  normalizeSearchKeyword(value) {
    return String(value ?? '')
      .trim()
      .replace(/[(),]/g, ' ')
      .replace(/["']/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  escapeNoteHtmlText(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  buildNoteHtmlFromPlainText(value) {
    const normalized = String(value ?? '').replace(/\r\n/g, '\n');
    if (!normalized.trim()) {
      return '';
    }
    return normalized
      .split('\n')
      .map(line => {
        const safeLine = this.escapeNoteHtmlText(line).replace(/ {2}/g, ' &nbsp;');
        return safeLine ? `<p>${safeLine}</p>` : '<p><br></p>';
      })
      .join('');
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
      const userId = this.getCurrentUserId();
      let query = this.supabase
        .from(this.tableNames.customers)
        .select('*')
        .order('created_at', { ascending: false });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const safeKeyword = this.normalizeSearchKeyword(keyword);
      if (safeKeyword) {
        query = query.or(`name.ilike.%${safeKeyword}%,contact_person.ilike.%${safeKeyword}%,phone.ilike.%${safeKeyword}%`);
      }

      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    }, options);
  }

  async getCustomer(id) {
    return this.request(async () => {
      const userId = this.getCurrentUserId();
      let query = this.supabase
        .from(this.tableNames.customers)
        .select('*')
        .eq('id', id);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query.single();

      if (error) throw error;
      return data;
    });
  }

  async createCustomer(customer) {
    return this.request(async () => {
      const userId = this.getCurrentUserId();
      const { data, error } = await this.supabase
        .from(this.tableNames.customers)
        .insert([{
          ...customer,
          user_id: userId || customer?.user_id || null
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    }, { showLoading: true, showError: true });
  }

  async updateCustomer(id, updates) {
    return this.request(async () => {
      const userId = this.getCurrentUserId();
      let query = this.supabase
        .from(this.tableNames.customers)
        .update(updates)
        .eq('id', id);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query
        .select()
        .single();

      if (error) throw error;
      return data;
    }, { showLoading: true, showError: true });
  }

  async deleteCustomer(id) {
    return this.request(async () => {
      const userId = this.getCurrentUserId();
      let query = this.supabase
        .from(this.tableNames.customers)
        .delete()
        .eq('id', id);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { error } = await query;

      if (error) throw error;
    }, { showLoading: true, showError: true });
  }

  // ==================== 产品管理 ====================

  async getProducts(options = {}) {
    const { keyword = '', category = '', limit = 20, offset = 0 } = options;

    return this.request(async () => {
      const userId = this.getCurrentUserId();
      let query = this.supabase
        .from(this.tableNames.products)
        .select('*')
        .order('created_at', { ascending: false });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const safeKeyword = this.normalizeSearchKeyword(keyword);
      if (safeKeyword) {
        query = query.or(`name.ilike.%${safeKeyword}%,sku.ilike.%${safeKeyword}%`);
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
      const userId = this.getCurrentUserId();
      let query = this.supabase
        .from(this.tableNames.products)
        .select('*')
        .eq('id', id);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query.single();

      if (error) throw error;
      return data;
    });
  }

  async createProduct(product) {
    return this.request(async () => {
      const userId = this.getCurrentUserId();
      const { data, error } = await this.supabase
        .from(this.tableNames.products)
        .insert([{
          ...product,
          user_id: userId || product?.user_id || null
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    }, { showLoading: true, showError: true });
  }

  async updateProduct(id, updates) {
    return this.request(async () => {
      const userId = this.getCurrentUserId();
      let query = this.supabase
        .from(this.tableNames.products)
        .update(updates)
        .eq('id', id);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query
        .select()
        .single();

      if (error) throw error;
      return data;
    }, { showLoading: true, showError: true });
  }

  // ==================== 订单管理 ====================

  async getOrders(options = {}) {
    const {
      status = '',
      statuses = null,
      keyword = '',
      customerId = '',
      shippingStatus = '',
      dateFrom = '',
      dateTo = '',
      limit = 20,
      offset = 0
    } = options;

    return this.request(async () => {
      const userId = this.getCurrentUserId();
      let query = this.supabase
        .from(this.tableNames.orders)
        .select(`
          *,
          customer:erp_customers(id, name, phone, contact_person),
          items:erp_order_items(*)
        `)
        .order('created_at', { ascending: false });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const statusList = Array.isArray(statuses)
        ? statuses.map(item => String(item || '').trim().toLowerCase()).filter(Boolean)
        : [];

      if (statusList.length > 0) {
        query = query.in('status', statusList);
      } else if (status) {
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

      const safeKeyword = this.normalizeSearchKeyword(keyword);
      if (safeKeyword) {
        query = query.or(`order_number.ilike.%${safeKeyword}%`);
      }

      if (customerId !== '' && customerId !== null && customerId !== undefined) {
        query = query.eq('customer_id', customerId);
      }

      if (shippingStatus) {
        query = query.eq('shipping_status', String(shippingStatus || '').trim().toLowerCase());
      }

      if (dateFrom) {
        query = query.gte('order_date', dateFrom);
      }

      if (dateTo) {
        query = query.lte('order_date', dateTo);
      }

      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    }, options);
  }

  async getOrder(id) {
    return this.request(async () => {
      const userId = this.getCurrentUserId();
      let query = this.supabase
        .from(this.tableNames.orders)
        .select(`
          *,
          customer:erp_customers(*),
          items:erp_order_items(
            *,
            product:erp_products(*)
          )
        `)
        .eq('id', id);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query.single();

      if (error) throw error;
      return data;
    });
  }

  async createOrder(order) {
    return this.request(async () => {
      const userId = this.getCurrentUserId();
      const { data, error } = await this.supabase
        .from(this.tableNames.orders)
        .insert([{
          ...order,
          user_id: userId || order?.user_id || null
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    }, { showLoading: true, showError: true });
  }

  async createOrderWithItems(payload = {}) {
    return this.request(async () => {
      const client = this.ensureSupabaseClient();
      const currentUser = window.MobileERP?.getCurrentUser?.() || null;
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

      let productQuery = client
        .from(this.tableNames.products)
        .select('id, name, price, cost, stock_quantity');
      if (currentUser?.id) {
        productQuery = productQuery.eq('user_id', currentUser.id);
      }
      const { data: productRows, error: productError } = await productQuery.in('id', productIds);

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
        let updateStockQuery = client
          .from(this.tableNames.products)
          .update({ stock_quantity: nextStock })
          .eq('id', item.product_id);
        if (currentUser?.id) {
          updateStockQuery = updateStockQuery.eq('user_id', currentUser.id);
        }
        const { error: updateStockError } = await updateStockQuery;
        if (updateStockError) throw updateStockError;

        const { error: logError } = await client
          .from(this.tableNames.inventoryRecords)
          .insert([{
            user_id: currentUser?.id || null,
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
      if (inventoryFailed) {
        for (const item of normalizedItems) {
          let rollbackProductQuery = client
            .from(this.tableNames.products)
            .update({ stock_quantity: Number(item.current_stock || 0) })
            .eq('id', item.product_id);
          if (currentUser?.id) {
            rollbackProductQuery = rollbackProductQuery.eq('user_id', currentUser.id);
          }
          await rollbackProductQuery;
        }

        await client
          .from(this.tableNames.inventoryRecords)
          .delete()
          .eq('reference_id', orderRow.id)
          .eq('type', 'order_lock');

        await client
          .from(this.tableNames.orderItems)
          .delete()
          .eq('order_id', orderRow.id);

        let rollbackOrderQuery = client
          .from(this.tableNames.orders)
          .delete()
          .eq('id', orderRow.id);
        if (currentUser?.id) {
          rollbackOrderQuery = rollbackOrderQuery.eq('user_id', currentUser.id);
        }
        await rollbackOrderQuery;

        throw new Error('订单库存同步失败，订单已自动回滚，请重试');
      }

      let fullOrderQuery = client
        .from(this.tableNames.orders)
        .select(`
          *,
          customer:erp_customers(id, name, phone, contact_person),
          items:erp_order_items(*)
        `)
        .eq('id', orderRow.id);
      if (currentUser?.id) {
        fullOrderQuery = fullOrderQuery.eq('user_id', currentUser.id);
      }
      const { data: fullOrder } = await fullOrderQuery.single();

      return {
        ...(fullOrder || orderRow),
        _inventorySyncWarning: inventoryFailed
      };
    }, { showLoading: true, showError: true });
  }

  async updateOrder(id, updates) {
    return this.request(async () => {
      const userId = this.getCurrentUserId();
      let query = this.supabase
        .from(this.tableNames.orders)
        .update(updates)
        .eq('id', id);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query
        .select()
        .single();

      if (error) throw error;
      return data;
    }, { showLoading: true, showError: true });
  }

  async updateOrderStatus(id, status) {
    return this.updateOrder(id, { status });
  }

  async deleteOrder(id) {
    return this.request(async () => {
      const client = this.ensureSupabaseClient();
      const userId = this.getCurrentUserId();
      const orderId = String(id || '').trim();
      if (!orderId) {
        throw new Error('订单ID无效');
      }

      let orderQuery = client
        .from(this.tableNames.orders)
        .select(`
          id,
          order_number,
          user_id,
          items:erp_order_items(id, product_id, quantity)
        `)
        .eq('id', orderId);
      if (userId) {
        orderQuery = orderQuery.eq('user_id', userId);
      }
      const { data: orderRow, error: orderError } = await orderQuery.single();
      if (orderError) throw orderError;
      if (!orderRow) {
        throw new Error('订单不存在或无权限删除');
      }

      const normalizedItems = (Array.isArray(orderRow.items) ? orderRow.items : [])
        .map(item => ({
          product_id: String(item?.product_id || '').trim(),
          quantity: Math.max(0, Number(item?.quantity || 0))
        }))
        .filter(item => item.product_id && item.quantity > 0);

      const restoredRecords = [];
      const rollbackRestoredStock = async () => {
        for (const item of restoredRecords) {
          try {
            const rollbackStock = Math.max(0, Number(item?.before_stock || 0));
            let rollbackProductQuery = client
              .from(this.tableNames.products)
              .update({ stock_quantity: rollbackStock })
              .eq('id', item.product_id);
            if (userId) {
              rollbackProductQuery = rollbackProductQuery.eq('user_id', userId);
            }
            await rollbackProductQuery;

            await client
              .from(this.tableNames.inventoryRecords)
              .insert([{
                user_id: userId || null,
                product_id: item.product_id,
                quantity_change: -Math.abs(Number(item?.quantity || 0)),
                current_quantity: rollbackStock,
                type: 'order_lock',
                reference_id: orderId,
                notes: `删除订单失败，回滚库存回补（${orderRow.order_number || orderId}）`
              }]);
          } catch (rollbackError) {
            console.error('库存回滚失败:', rollbackError);
          }
        }
      };

      for (const item of normalizedItems) {
        let productQuery = client
          .from(this.tableNames.products)
          .select('id, stock_quantity')
          .eq('id', item.product_id);
        if (userId) {
          productQuery = productQuery.eq('user_id', userId);
        }
        const { data: productRow, error: productError } = await productQuery.single();
        if (productError) throw productError;

        const beforeStock = Number(productRow?.stock_quantity || 0);
        const nextStock = Math.max(0, beforeStock + Math.abs(Number(item.quantity || 0)));

        let updateProductQuery = client
          .from(this.tableNames.products)
          .update({ stock_quantity: nextStock })
          .eq('id', item.product_id);
        if (userId) {
          updateProductQuery = updateProductQuery.eq('user_id', userId);
        }
        const { error: updateProductError } = await updateProductQuery;
        if (updateProductError) throw updateProductError;

        const { error: stockLogError } = await client
          .from(this.tableNames.inventoryRecords)
          .insert([{
            user_id: userId || null,
            product_id: item.product_id,
            quantity_change: Math.abs(Number(item.quantity || 0)),
            current_quantity: nextStock,
            type: 'sale_reversal',
            reference_id: orderId,
            notes: `删除订单回补库存（${orderRow.order_number || orderId}）`
          }]);
        if (stockLogError) throw stockLogError;

        restoredRecords.push({
          product_id: item.product_id,
          quantity: Math.abs(Number(item.quantity || 0)),
          before_stock: beforeStock
        });
      }

      let financeRefQuery = client
        .from(this.tableNames.financeRecords)
        .delete()
        .eq('reference_id', orderId);
      if (userId) {
        financeRefQuery = financeRefQuery.eq('user_id', userId);
      }
      const { error: financeRefError } = await financeRefQuery;
      if (financeRefError) {
        await rollbackRestoredStock();
        throw financeRefError;
      }

      let financeOrderQuery = client
        .from(this.tableNames.financeRecords)
        .delete()
        .eq('order_id', orderId);
      if (userId) {
        financeOrderQuery = financeOrderQuery.eq('user_id', userId);
      }
      const { error: financeOrderError } = await financeOrderQuery;
      if (financeOrderError && financeOrderError.code !== '42703') {
        await rollbackRestoredStock();
        throw financeOrderError;
      }

      let deleteOrderQuery = client
        .from(this.tableNames.orders)
        .delete()
        .eq('id', orderId);
      if (userId) {
        deleteOrderQuery = deleteOrderQuery.eq('user_id', userId);
      }
      let { error: deleteOrderError } = await deleteOrderQuery;

      if (deleteOrderError && (deleteOrderError.code === '23503' || String(deleteOrderError.message || '').toLowerCase().includes('foreign key'))) {
        const { error: deleteItemsError } = await client
          .from(this.tableNames.orderItems)
          .delete()
          .eq('order_id', orderId);
        if (deleteItemsError) {
          await rollbackRestoredStock();
          throw deleteItemsError;
        }

        let retryDeleteOrderQuery = client
          .from(this.tableNames.orders)
          .delete()
          .eq('id', orderId);
        if (userId) {
          retryDeleteOrderQuery = retryDeleteOrderQuery.eq('user_id', userId);
        }
        const retryResult = await retryDeleteOrderQuery;
        deleteOrderError = retryResult.error;
      }

      if (deleteOrderError) {
        await rollbackRestoredStock();
        throw deleteOrderError;
      }

      return true;
    }, { showLoading: true, showError: true });
  }

  async queryLogistics(trackingNumber, shippingCompany = '', options = {}) {
    return this.request(async () => {
      const client = this.ensureSupabaseClient();
      if (!client.functions || typeof client.functions.invoke !== 'function') {
        throw new Error('未检测到物流服务客户端，请刷新页面后重试');
      }

      const normalizedTracking = String(trackingNumber || '').trim();
      const normalizedCompany = String(shippingCompany || '').trim();
      const normalizedParam = String(options?.param || '').trim();
      const forceRefresh = options?.forceRefresh === true;

      if (!normalizedTracking) {
        throw new Error('请先填写快递单号');
      }

      const cacheKey = `${normalizedTracking}|${normalizedCompany}|${normalizedParam}`;
      if (!forceRefresh && this.logisticsCache.has(cacheKey)) {
        return this.logisticsCache.get(cacheKey);
      }

      const { data, error } = await client.functions.invoke('logistics-track', {
        body: {
          trackingNumber: normalizedTracking,
          shippingCompany: normalizedCompany,
          param: normalizedParam
        }
      });

      if (error) {
        let errorMessage = String(error?.message || '物流查询失败');
        const context = error?.context;
        if (context && typeof context.json === 'function') {
          try {
            const payload = await context.json();
            const serverMessage = payload?.message || payload?.error || payload?.msg;
            if (serverMessage) {
              errorMessage = String(serverMessage);
            }
          } catch (contextParseError) {
            const parseMessage = String(contextParseError?.message || '').trim();
            if (parseMessage) {
              errorMessage = `${errorMessage}（${parseMessage}）`;
            }
          }
        }
        throw new Error(errorMessage);
      }

      if (!data || data.ok !== true) {
        throw new Error(data?.message || '物流查询失败');
      }

      this.logisticsCache.set(cacheKey, data);
      return data;
    }, { showLoading: options?.showLoading === true, showError: true });
  }

  // ==================== 库存管理 ====================

  async getInventoryRecords(options = {}) {
    const { type = '', productId = '', limit = 20, offset = 0 } = options;

    return this.request(async () => {
      const userId = this.getCurrentUserId();
      let query = this.supabase
        .from(this.tableNames.inventoryRecords)
        .select(`
          *,
          product:erp_products(*)
        `)
        .order('created_at', { ascending: false });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (type) {
        query = query.eq('type', type);
      }

      if (productId !== '' && productId !== null && productId !== undefined) {
        query = query.eq('product_id', productId);
      }

      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    }, options);
  }

  async createInventoryRecord(record) {
    return this.request(async () => {
      const userId = this.getCurrentUserId();
      const { data, error } = await this.supabase
        .from(this.tableNames.inventoryRecords)
        .insert([{
          ...record,
          user_id: userId || record?.user_id || null
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    }, { showLoading: true, showError: true });
  }

  // ==================== 财务管理 ====================

  isBankBusinessFinanceRecord(record = {}) {
    const businessType = String(record?.business_type || '').trim().toLowerCase();
    const category = String(record?.category || '').trim();
    const description = String(record?.description || '').trim();
    if (['credit_card', 'credit_card_repayment', 'credit_card_swipe', 'credit_card_repayment_payment'].includes(businessType)) {
      return true;
    }
    if (category.includes('信用卡') || category.includes('银行手续费') || category.includes('还款记录')) {
      return true;
    }
    return /银行[:：]/.test(description) || /刷卡|还款/.test(description);
  }

  async getFinanceRecords(options = {}) {
    const {
      type = '',
      keyword = '',
      category = '',
      dateFrom = '',
      dateTo = '',
      limit = 20,
      offset = 0
    } = options;

    return this.request(async () => {
      const userId = this.getCurrentUserId();
      let query = this.supabase
        .from(this.tableNames.financeRecords)
        .select('*')
        .order('transaction_date', { ascending: false });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (type) {
        query = query.eq('type', type);
      }

      if (keyword) {
        const safeKeyword = this.normalizeSearchKeyword(keyword);
        if (safeKeyword) {
          query = query.or(`category.ilike.%${safeKeyword}%,description.ilike.%${safeKeyword}%`);
        }
      }

      if (category) {
        const safeCategory = String(category || '').trim();
        if (safeCategory) {
          query = query.ilike('category', `%${safeCategory}%`);
        }
      }

      if (dateFrom) {
        const fromText = String(dateFrom).trim();
        const normalizedFrom = fromText.length === 10 ? `${fromText}T00:00:00` : fromText;
        query = query.gte('transaction_date', normalizedFrom);
      }

      if (dateTo) {
        const toText = String(dateTo).trim();
        const normalizedTo = toText.length === 10 ? `${toText}T23:59:59` : toText;
        query = query.lte('transaction_date', normalizedTo);
      }

      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    }, options);
  }

  async getBankBusinessRecords(options = {}) {
    const {
      type = '',
      keyword = '',
      bank = '',
      limit = 20,
      offset = 0
    } = options;

    return this.request(async () => {
      const userId = this.getCurrentUserId();
      const safeOffset = Math.max(0, Number(offset) || 0);
      const safeLimit = Math.max(1, Number(limit) || 20);
      const fetchUpper = Math.max(safeOffset + safeLimit * 4 - 1, 79);

      let query = this.supabase
        .from(this.tableNames.financeRecords)
        .select('*')
        .order('transaction_date', { ascending: false })
        .range(0, fetchUpper);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const typeKey = String(type || '').trim().toLowerCase();
      const keywordText = String(keyword || '').trim().toLowerCase();
      const bankText = String(bank || '').trim().toLowerCase();

      const filtered = (Array.isArray(data) ? data : [])
        .filter(item => this.isBankBusinessFinanceRecord(item))
        .filter(item => {
          const rowType = String(item?.type || '').trim().toLowerCase();
          if (typeKey && rowType !== typeKey) {
            return false;
          }
          if (keywordText) {
            const combined = [
              item?.category,
              item?.description,
              item?.card_bank,
              item?.swipe_card_bank,
              item?.settlement_bank,
              item?.settlement_card_tail
            ].map(value => String(value || '').toLowerCase()).join(' ');
            if (!combined.includes(keywordText)) {
              return false;
            }
          }
          if (bankText) {
            const bankCombined = [
              item?.card_bank,
              item?.swipe_card_bank,
              item?.settlement_bank,
              item?.description
            ].map(value => String(value || '').toLowerCase()).join(' ');
            if (!bankCombined.includes(bankText)) {
              return false;
            }
          }
          return true;
        });

      return filtered.slice(safeOffset, safeOffset + safeLimit);
    }, options);
  }

  async createFinanceRecord(financeData = {}) {
    return this.request(async () => {
      const userId = this.getCurrentUserId();
      const normalizedType = String(financeData?.type || '').trim().toLowerCase();
      const type = ['income', 'expense', 'system'].includes(normalizedType) ? normalizedType : 'expense';
      const amountValue = Number(financeData?.amount || 0);
      const amount = Number.isFinite(amountValue) ? Math.abs(amountValue) : 0;

      const insertPayload = {
        user_id: userId || financeData?.user_id || null,
        type,
        category: String(financeData?.category || '').trim(),
        amount,
        description: String(financeData?.description || '').trim(),
        reference_id: financeData?.reference_id || null,
        order_id: financeData?.order_id || null,
        transaction_date: financeData?.transaction_date || new Date().toISOString(),
        business_type: financeData?.business_type || null,
        card_bank: financeData?.card_bank || null,
        card_bill_day: financeData?.card_bill_day ?? null,
        card_repayment_day: financeData?.card_repayment_day ?? null,
        card_repayment_amount: financeData?.card_repayment_amount ?? null,
        card_swipe_amount: financeData?.card_swipe_amount ?? null,
        card_actual_amount: financeData?.card_actual_amount ?? null,
        card_fee_amount: financeData?.card_fee_amount ?? null,
        card_fee_rate: financeData?.card_fee_rate ?? null,
        card_tail: financeData?.card_tail || null,
        swipe_card_bank: financeData?.swipe_card_bank || null,
        settlement_bank: financeData?.settlement_bank || null,
        settlement_card_tail: financeData?.settlement_card_tail || null,
        reminder_enabled: typeof financeData?.reminder_enabled === 'boolean' ? financeData.reminder_enabled : null,
        reminder_days_before: financeData?.reminder_days_before ?? null,
        reminder_date: financeData?.reminder_date || null
      };

      let { data, error } = await this.supabase
        .from(this.tableNames.financeRecords)
        .insert([insertPayload])
        .select()
        .single();

      if (error && error.code === '42703') {
        const fallbackPayload = {
          user_id: insertPayload.user_id,
          type: insertPayload.type,
          category: insertPayload.category,
          amount: insertPayload.amount,
          description: insertPayload.description,
          reference_id: insertPayload.reference_id,
          order_id: insertPayload.order_id,
          transaction_date: insertPayload.transaction_date
        };
        const retry = await this.supabase
          .from(this.tableNames.financeRecords)
          .insert([fallbackPayload])
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;
      return data;
    }, { showLoading: true, showError: true });
  }

  // ==================== 日常笔记 ====================

  async getNotes(options = {}) {
    const {
      keyword = '',
      pinnedOnly = false,
      limit = 20,
      offset = 0
    } = options;

    return this.request(async () => {
      const userId = this.getCurrentUserId();
      let query = this.supabase
        .from(this.tableNames.notes)
        .select('id,user_id,title,content_text,content_html,is_pinned,created_at,updated_at')
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (pinnedOnly) {
        query = query.eq('is_pinned', true);
      }

      const safeKeyword = this.normalizeSearchKeyword(keyword);
      if (safeKeyword) {
        query = query.or(`title.ilike.%${safeKeyword}%,content_text.ilike.%${safeKeyword}%`);
      }

      query = query.range(offset, offset + limit - 1);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }, options);
  }

  async createNote(noteData = {}) {
    return this.request(async () => {
      const userId = this.getCurrentUserId();
      const now = new Date().toISOString();
      const contentText = String(noteData?.content_text || '').trim();
      const contentHtml = String(noteData?.content_html || '').trim() || this.buildNoteHtmlFromPlainText(contentText);
      const payload = {
        user_id: userId || noteData?.user_id || null,
        title: String(noteData?.title || '').trim(),
        content_text: contentText,
        content_html: contentHtml,
        is_pinned: !!noteData?.is_pinned,
        created_at: now,
        updated_at: now
      };

      const { data, error } = await this.supabase
        .from(this.tableNames.notes)
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      return data;
    }, { showLoading: true, showError: true });
  }

  async updateNote(noteId, noteData = {}) {
    return this.request(async () => {
      const userId = this.getCurrentUserId();
      const payload = {
        updated_at: new Date().toISOString()
      };

      const hasTitle = Object.prototype.hasOwnProperty.call(noteData, 'title');
      const hasPinned = Object.prototype.hasOwnProperty.call(noteData, 'is_pinned');
      const hasContentText = Object.prototype.hasOwnProperty.call(noteData, 'content_text');
      const hasContentHtml = Object.prototype.hasOwnProperty.call(noteData, 'content_html');

      if (hasTitle) {
        payload.title = String(noteData?.title || '').trim();
      }
      if (hasPinned) {
        payload.is_pinned = !!noteData?.is_pinned;
      }
      if (hasContentText) {
        const contentText = String(noteData?.content_text || '').trim();
        payload.content_text = contentText;
        if (!hasContentHtml) {
          payload.content_html = this.buildNoteHtmlFromPlainText(contentText);
        }
      }
      if (hasContentHtml) {
        payload.content_html = String(noteData?.content_html || '').trim();
      }

      let query = this.supabase
        .from(this.tableNames.notes)
        .update(payload)
        .eq('id', noteId);
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query.select().single();
      if (error) throw error;
      return data;
    }, { showLoading: true, showError: true });
  }

  async deleteNote(noteId) {
    return this.request(async () => {
      const userId = this.getCurrentUserId();
      let query = this.supabase
        .from(this.tableNames.notes)
        .delete()
        .eq('id', noteId);
      if (userId) {
        query = query.eq('user_id', userId);
      }
      const { error } = await query;
      if (error) throw error;
      return true;
    }, { showLoading: true, showError: true });
  }

  // ==================== 统计数据 ====================

  async getDashboardStats() {
    return this.request(async () => {
      const userId = this.getCurrentUserId();
      // 并行请求多个统计数据
      const [ordersResult, productsResult, customersResult] = await Promise.all([
        (userId
          ? this.supabase.from(this.tableNames.orders).select('id, total_amount, status, shipping_status, order_date, created_at').eq('user_id', userId)
          : this.supabase.from(this.tableNames.orders).select('id, total_amount, status, shipping_status, order_date, created_at')),
        (userId
          ? this.supabase.from(this.tableNames.products).select('id, stock_quantity, min_stock').eq('user_id', userId)
          : this.supabase.from(this.tableNames.products).select('id, stock_quantity, min_stock')),
        (userId
          ? this.supabase.from(this.tableNames.customers).select('id').eq('user_id', userId)
          : this.supabase.from(this.tableNames.customers).select('id'))
      ]);

      const orders = ordersResult.data || [];
      const products = productsResult.data || [];
      const customers = customersResult.data || [];

      const normalizeShippingStatus = (value) => {
        const raw = String(value || '').trim().toLowerCase();
        const aliasMap = {
          signed: 'delivered',
          sign: 'delivered',
          intransit: 'in_transit',
          transit: 'in_transit'
        };
        const normalized = aliasMap[raw] || raw || 'not_shipped';
        const validSet = new Set(['not_shipped', 'shipped', 'in_transit', 'delivered', 'rejected', 'returned']);
        return validSet.has(normalized) ? normalized : 'not_shipped';
      };

      const isSameDay = (value) => {
        if (!value) return false;
        const dateParts = window.Utils?.getDateParts?.(value);
        const nowParts = window.Utils?.getDateParts?.(new Date());
        if (!dateParts || !nowParts) return false;
        return dateParts.year === nowParts.year
          && dateParts.month === nowParts.month
          && dateParts.day === nowParts.day;
      };

      // 计算统计数据
      const stats = {
        todayOrders: orders.filter(o => {
          return isSameDay(o.order_date || o.created_at);
        }).length,
        pendingOrders: orders.filter(o => {
          const status = String(o.status || '').trim().toLowerCase();
          if (['cancelled', 'completed', 'refunded', 'signed', 'delivered'].includes(status)) {
            return false;
          }
          const shippingStatus = normalizeShippingStatus(o.shipping_status);
          return ['pending', 'confirmed', 'approved', 'processing'].includes(status)
            && shippingStatus === 'not_shipped';
        }).length,
        lowStockProducts: products.filter(p => {
          const stock = Number(p?.stock_quantity || 0);
          const minStock = Number(p?.min_stock || 0);
          return minStock > 0 ? stock <= minStock : stock <= 3;
        }).length,
        totalCustomers: customers.length,
        totalRevenue: orders
          .filter(o => String(o.status || '').toLowerCase() === 'completed')
          .reduce((sum, o) => sum + (o.total_amount || 0), 0)
      };

      return stats;
    });
  }
}

// 导出全局实例
window.API = new API();
