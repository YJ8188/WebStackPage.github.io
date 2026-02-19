/**
 * 移动端ERP - 订单模块
 */

window.OrderModule = {
  name: 'order',
  currentStatus: '',
  searchKeyword: '',
  routeFilter: {
    quick: '',
    customerId: ''
  },
  currentPage: 1,
  pageSize: 20,
  orders: [],
  currentDetailOrderId: '',
  currentDetailOrder: null,
  hasMore: true,
  eventsBound: false,
  emptyHintShown: false,

  async init(routeParams = {}) {
    if (!this.eventsBound) {
      this.bindEvents();
      this.eventsBound = true;
    }
    this.applyRouteFilters(routeParams);
    await this.loadOrders();
  },

  bindEvents() {
    // 状态标签切换
    document.querySelectorAll('#orderTabs .tab-item').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#orderTabs .tab-item').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentStatus = tab.dataset.status;
        if (this.routeFilter.quick === 'to_ship') {
          this.routeFilter.quick = '';
        }
        this.currentPage = 1;
        this.orders = [];
        this.hasMore = true;
        this.emptyHintShown = false;
        this.loadOrders();
      });
    });

    // 搜索按钮
    document.getElementById('ordersSearchBtn')?.addEventListener('click', () => {
      this.showSearchModal();
    });

    // 订单详情更多操作
    document.getElementById('orderDetailMoreBtn')?.addEventListener('click', () => {
      this.showOrderDetailMoreActions();
    });

    // 滚动加载更多
    const content = document.getElementById('ordersContent');
    if (content) {
      content.addEventListener('scroll', window.Utils.throttle(() => {
        if (content.scrollHeight - content.scrollTop - content.clientHeight < 100) {
          this.loadMore();
        }
      }, 300));
    }
  },

  applyRouteFilters(routeParams = {}) {
    const params = routeParams && typeof routeParams === 'object' ? routeParams : {};
    const quick = String(params.quick || '').trim().toLowerCase();
    const customerId = String(params.customer_id || '').trim();
    const keyword = String(params.keyword || '').trim();

    this.routeFilter = {
      quick,
      customerId
    };
    this.searchKeyword = keyword;

    if (params.status !== undefined) {
      this.currentStatus = String(params.status || '').trim();
    } else if (customerId) {
      this.currentStatus = '';
    } else if (quick === 'to_ship' || quick === 'today') {
      this.currentStatus = '';
    }

    document.querySelectorAll('#orderTabs .tab-item').forEach(tab => {
      const matched = String(tab.dataset.status || '') === String(this.currentStatus || '');
      tab.classList.toggle('active', matched);
    });

    if (!document.querySelector('#orderTabs .tab-item.active')) {
      const defaultTab = document.querySelector('#orderTabs .tab-item[data-status=""]');
      if (defaultTab) defaultTab.classList.add('active');
    }

    this.currentPage = 1;
    this.orders = [];
    this.hasMore = true;
    this.emptyHintShown = false;
  },

  async loadOrders() {
    try {
      window.Loading.show('加载订单...');

      const offset = (this.currentPage - 1) * this.pageSize;
      const keyword = String(this.searchKeyword || '').trim();
      const requestOptions = {
        status: this.currentStatus,
        limit: this.pageSize,
        offset
      };

      if (this.routeFilter.customerId) {
        requestOptions.customerId = this.routeFilter.customerId;
      }

      if (this.routeFilter.quick === 'today') {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        requestOptions.dateFrom = start.toISOString();
        requestOptions.dateTo = end.toISOString();
      }

      if (this.routeFilter.quick === 'to_ship') {
        requestOptions.shippingStatus = 'not_shipped';
        if (!this.currentStatus) {
          requestOptions.statuses = ['pending', 'confirmed', 'approved', 'processing'];
          delete requestOptions.status;
        }
      }

      if (keyword) {
        requestOptions.limit = 300;
        requestOptions.offset = 0;
      }

      const newOrders = await window.API.getOrders(requestOptions);
      const orderRows = Array.isArray(newOrders) ? newOrders : [];

      if (keyword) {
        this.hasMore = false;
        this.orders = this.filterOrdersByKeyword(orderRows, keyword);
      } else {
        if (orderRows.length < this.pageSize) {
          this.hasMore = false;
        }
        this.orders = this.currentPage === 1 ? orderRows : [...this.orders, ...orderRows];
      }
      this.renderOrders();

      if (this.currentPage === 1 && this.orders.length === 0 && !this.emptyHintShown) {
        if (keyword) {
          window.Toast.info('未找到匹配的订单');
        } else if (this.routeFilter.quick === 'today') {
          window.Toast.info('当前日期暂无订单');
        } else if (this.routeFilter.quick === 'to_ship') {
          window.Toast.info('当前没有待发货订单');
        } else if (this.routeFilter.customerId) {
          window.Toast.info('该客户当前暂无订单');
        }
        this.emptyHintShown = true;
      }

      window.Loading.hide();
    } catch (error) {
      window.Loading.hide();
      console.error('加载订单失败:', error);
      window.Toast.error('加载订单失败');
    }
  },

  async loadMore() {
    if (String(this.searchKeyword || '').trim()) return;
    if (!this.hasMore) return;
    this.currentPage++;
    await this.loadOrders();
  },

  renderOrders() {
    const container = document.getElementById('ordersContent');
    if (!container) return;

    if (this.orders.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fa fa-inbox"></i></div>
          <div class="empty-text">暂无订单</div>
        </div>
      `;
      return;
    }

    const keyword = String(this.searchKeyword || '').trim();
    const searchInfo = keyword
      ? `
      <div style="margin:0 0 10px 0;padding:8px 10px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <span style="font-size:12px;color:#1d4ed8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">搜索：${this.escapeHtml(keyword)}</span>
        <button id="clearOrderSearchBtn" type="button" style="border:none;background:none;color:#2563eb;font-size:12px;font-weight:600;cursor:pointer;">清除</button>
      </div>
      `
      : '';

    container.innerHTML = `
      ${searchInfo}
      <div class="order-list">
        ${this.orders.map(order => this.renderOrderCard(order)).join('')}
      </div>
      ${this.hasMore ? '<div class="infinite-scroll-loading">加载更多...</div>' : '<div class="infinite-scroll-finished">没有更多了</div>'}
    `;

    const clearSearchBtn = container.querySelector('#clearOrderSearchBtn');
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        this.searchKeyword = '';
        this.currentPage = 1;
        this.orders = [];
        this.hasMore = true;
        this.emptyHintShown = false;
        await this.loadOrders();
      });
    }

    // 绑定点击事件
    container.querySelectorAll('.order-card').forEach((card, index) => {
      card.addEventListener('click', () => {
        window.Router.push('/order/detail', { id: this.orders[index].id });
      });
    });
  },

  renderOrderCard(order) {
    const statusColor = window.Utils.getOrderStatusColor(order.status);
    const statusText = window.Utils.getOrderStatusText(order.status);
    const customerName = order.customer?.name || '未知客户';
    const customerInitial = customerName.charAt(0);
    const totalAmount = window.Utils.formatMoney(order.total_amount);
    const createTime = window.Utils.formatRelativeTime(order.created_at);

    return `
      <div class="order-card" data-order-id="${order.id}">
        <div class="order-card-header">
          <div class="order-number">${order.order_number}</div>
          <div class="tag tag-${statusColor}">${statusText}</div>
        </div>
        <div class="order-card-body">
          <div class="order-customer">
            <div class="order-customer-avatar">${customerInitial}</div>
            <div class="order-customer-info">
              <div class="order-customer-name">${customerName}</div>
              <div class="order-customer-phone">${order.customer?.phone || '-'}</div>
            </div>
          </div>
          ${order.items && order.items.length > 0 ? `
            <div class="order-items">
              ${order.items.slice(0, 3).map(item => `
                <div class="order-item">
                  <div class="order-item-name">${item.product_name || '-'}</div>
                  <div class="order-item-quantity">x${item.quantity}</div>
                  <div class="order-item-price">${window.Utils.formatMoney(item.price ?? item.unit_price)}</div>
                </div>
              `).join('')}
              ${order.items.length > 3 ? `<div class="text-tertiary text-sm">还有${order.items.length - 3}件商品...</div>` : ''}
            </div>
          ` : ''}
          <div class="order-total">
            <div class="order-total-label">订单总额</div>
            <div class="order-total-amount">${totalAmount}</div>
          </div>
        </div>
        <div class="order-card-footer">
          <div class="order-time">${createTime}</div>
          <div class="order-actions">
            <i class="fa fa-angle-right" style="color: var(--text-disabled);"></i>
          </div>
        </div>
      </div>
    `;
  },

  async showSearchModal() {
    const currentKeyword = String(this.searchKeyword || '').trim();
    const modalPromise = window.Modal.show({
      title: '订单搜索',
      confirmText: '搜索',
      cancelText: '取消',
      content: `
        <div style="text-align:left;">
          <div style="margin-bottom:8px;color:#475569;font-size:12px;">关键词</div>
          <input id="mobileOrderSearchInput" type="text" maxlength="60" placeholder="订单号 / 客户名 / 手机号 / 商品名"
            value="${this.escapeHtml(currentKeyword)}"
            style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;" />
          <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <span style="font-size:12px;color:#94a3b8;">支持组合状态筛选</span>
            <button id="clearOrderSearchInputBtn" type="button"
              style="height:28px;padding:0 10px;border:1px solid #e2e8f0;border-radius:999px;background:#fff;color:#475569;font-size:12px;cursor:pointer;">清空</button>
          </div>
        </div>
      `,
      onConfirm: async () => {
        const keyword = String(document.getElementById('mobileOrderSearchInput')?.value || '').trim();
        this.searchKeyword = keyword;
        this.currentPage = 1;
        this.orders = [];
        this.hasMore = true;
        this.emptyHintShown = false;
        await this.loadOrders();
        return true;
      }
    });

    setTimeout(() => {
      const input = document.getElementById('mobileOrderSearchInput');
      const clearBtn = document.getElementById('clearOrderSearchInputBtn');
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        input.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') {
            input.value = '';
          }
        });
      }
      clearBtn?.addEventListener('click', () => {
        if (!input) return;
        input.value = '';
        input.focus();
      });
    }, 0);

    await modalPromise;
  },

  filterOrdersByKeyword(orders = [], keyword = '') {
    const normalizedKeyword = String(keyword || '').trim().toLowerCase();
    if (!normalizedKeyword) return Array.isArray(orders) ? orders : [];

    const rows = Array.isArray(orders) ? orders : [];
    return rows.filter(order => {
      const searchableTexts = [
        order?.order_number,
        order?.tracking_number,
        order?.shipping_company,
        order?.notes,
        order?.customer?.name,
        order?.customer?.phone,
        order?.customer?.contact_person,
        ...(Array.isArray(order?.items) ? order.items.map(item => item?.product_name) : [])
      ]
        .map(item => String(item || '').toLowerCase())
        .filter(Boolean);

      return searchableTexts.some(text => text.includes(normalizedKeyword));
    });
  },

  escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  normalizeOrderStatusValue(status) {
    const raw = String(status || '').trim().toLowerCase();
    const aliasMap = {
      approved: 'confirmed',
      delivered: 'signed'
    };
    const normalized = aliasMap[raw] || raw || 'pending';
    const validSet = new Set(['pending', 'confirmed', 'shipped', 'signed', 'completed', 'cancelled', 'refunded']);
    return validSet.has(normalized) ? normalized : 'pending';
  },

  normalizeShippingStatusValue(status) {
    const raw = String(status || '').trim().toLowerCase();
    const aliasMap = {
      signed: 'delivered',
      sign: 'delivered',
      intransit: 'in_transit',
      transit: 'in_transit'
    };
    const normalized = aliasMap[raw] || raw || 'not_shipped';
    const validSet = new Set(['not_shipped', 'shipped', 'in_transit', 'delivered', 'rejected', 'returned']);
    return validSet.has(normalized) ? normalized : 'not_shipped';
  },

  getShippingStatusText(status) {
    const map = {
      not_shipped: '未发货',
      shipped: '已发货',
      in_transit: '运输中',
      delivered: '已签收',
      rejected: '已拒收',
      returned: '已退回'
    };
    const normalized = this.normalizeShippingStatusValue(status);
    return map[normalized] || '未知状态';
  },

  inferFulfillmentFromLogisticsResult(result = {}, timeline = []) {
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

    if (!sourceText) return null;
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
  },

  resolveNextOrderStatus(currentStatus, targetStatus) {
    const current = this.normalizeOrderStatusValue(currentStatus);
    const target = this.normalizeOrderStatusValue(targetStatus);
    if (current === target) return current;
    if (['completed', 'cancelled', 'refunded'].includes(current)) return current;

    const stageFlow = ['pending', 'confirmed', 'shipped', 'signed', 'completed'];
    const currentIndex = stageFlow.indexOf(current);
    const targetIndex = stageFlow.indexOf(target);
    if (currentIndex < 0 || targetIndex < 0) return current;
    return targetIndex > currentIndex ? target : current;
  },

  shouldApplyShippingStatus(currentStatus, nextStatus) {
    const current = this.normalizeShippingStatusValue(currentStatus);
    const next = this.normalizeShippingStatusValue(nextStatus);
    if (current === next) return false;
    if (current === 'delivered') return false;

    const rankMap = {
      not_shipped: 0,
      shipped: 1,
      in_transit: 2,
      rejected: 3,
      returned: 3,
      delivered: 4
    };

    if (['rejected', 'returned'].includes(next)) {
      return current !== 'delivered';
    }

    return (rankMap[next] ?? 0) > (rankMap[current] ?? 0);
  },

  async promptTrackingParam() {
    let inputValue = '';
    const confirmed = await window.Modal.show({
      title: '补充物流校验参数',
      confirmText: '继续查询',
      cancelText: '取消',
      content: `
        <div style="text-align:left;">
          <div style="font-size:12px;color:#64748b;margin-bottom:8px;">顺丰等快递可能需要收件人手机号后4位。</div>
          <input id="mobileTrackingParamInput" type="text" maxlength="8" placeholder="请输入后4位（仅数字）"
            style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;" />
        </div>
      `,
      onConfirm: async () => {
        inputValue = String(document.getElementById('mobileTrackingParamInput')?.value || '').trim();
        if (!inputValue) {
          window.Toast.error('请输入校验参数后再查询');
          return false;
        }
        return true;
      }
    });

    return confirmed ? inputValue : '';
  },

  async queryLogisticsWithFallback(trackingNumber, shippingCompany = '', options = {}) {
    const normalizedTracking = String(trackingNumber || '').trim();
    const normalizedCompany = String(shippingCompany || '').trim();
    let param = String(options?.param || '').trim();

    const invokeQuery = (forceRefresh = false) => window.API.queryLogistics(
      normalizedTracking,
      normalizedCompany,
      { param, forceRefresh }
    );

    try {
      return await invokeQuery(options?.forceRefresh === true);
    } catch (error) {
      const message = String(error?.message || error || '');
      const needParam = /后4位|手机号|校验|param/i.test(message);
      if (!param && needParam) {
        param = await this.promptTrackingParam();
        if (!param) throw error;
        return await invokeQuery(true);
      }
      throw error;
    }
  },

  async showCreateOrderModal() {
    try {
      const [customers, products] = await Promise.all([
        window.API.getCustomers({ limit: 200, offset: 0 }),
        window.API.getProducts({ limit: 500, offset: 0 })
      ]);

      const customerList = Array.isArray(customers) ? customers : [];
      const productList = (Array.isArray(products) ? products : []).filter(item => item && item.id !== undefined && item.id !== null);

      if (productList.length === 0) {
        window.Toast.error('暂无可下单商品，请先在产品管理新增商品');
        return;
      }

      const customerMap = new Map(customerList.map(item => [String(item.id), item]));
      const productMap = new Map(productList.map(item => [String(item.id), item]));
      const defaultProduct = productList[0];
      const defaultUnitPrice = Number(defaultProduct.price || 0).toFixed(2);

      const customerOptions = [
        '<option value="">不指定客户（散客）</option>',
        ...customerList.map(item => `<option value="${this.escapeHtml(item.id)}">${this.escapeHtml(item.name || `客户#${item.id}`)}</option>`)
      ].join('');

      const shippingOptions = [
        '<option value="">自动识别快递公司</option>',
        '<option value="顺丰速运">顺丰速运</option>',
        '<option value="中通快递">中通快递</option>',
        '<option value="圆通速递">圆通速递</option>',
        '<option value="申通快递">申通快递</option>',
        '<option value="韵达快递">韵达快递</option>',
        '<option value="京东快递">京东快递</option>',
        '<option value="邮政快递">邮政快递</option>'
      ].join('');

      const productOptions = productList.map(item => {
        const idText = this.escapeHtml(item.id);
        const nameText = this.escapeHtml(item.name || `商品#${item.id}`);
        const priceText = Number(item.price || 0).toFixed(2);
        const stockText = Number(item.stock_quantity || 0);
        return `<option value="${idText}" data-price="${priceText}" data-stock="${stockText}">${nameText}（库存:${stockText}）</option>`;
      }).join('');

      const modalPromise = window.Modal.show({
        title: '新建订单',
        confirmText: '创建订单',
        cancelText: '取消',
        content: `
          <div style="text-align:left;">
            <div style="margin-bottom:10px;">
              <div style="margin-bottom:6px;color:#475569;font-size:12px;">客户</div>
              <select id="createOrderCustomer" style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;">${customerOptions}</select>
            </div>
            <div style="margin-bottom:10px;">
              <div style="margin-bottom:6px;color:#475569;font-size:12px;">商品</div>
              <select id="createOrderProduct" style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;">${productOptions}</select>
            </div>
            <div style="display:flex;gap:8px;margin-bottom:10px;">
              <div style="flex:1;">
                <div style="margin-bottom:6px;color:#475569;font-size:12px;">数量</div>
                <input id="createOrderQuantity" type="number" min="1" value="1" style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;" />
              </div>
              <div style="flex:1;">
                <div style="margin-bottom:6px;color:#475569;font-size:12px;">单价(¥)</div>
                <input id="createOrderUnitPrice" type="number" min="0" step="0.01" value="${defaultUnitPrice}" style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;" />
              </div>
            </div>
            <div style="margin-bottom:10px;">
              <div style="margin-bottom:6px;color:#475569;font-size:12px;">备注</div>
              <textarea id="createOrderNotes" rows="2" placeholder="选填" style="width:100%;border:1px solid #d9d9d9;border-radius:8px;padding:8px 10px;resize:none;"></textarea>
            </div>
            <div style="margin-bottom:10px;border-top:1px solid #eef2f7;padding-top:10px;">
              <div style="font-size:12px;color:#475569;margin-bottom:6px;">快递公司（可选）</div>
              <select id="createOrderShippingCompany" style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;">${shippingOptions}</select>
            </div>
            <div style="margin-bottom:10px;">
              <div style="font-size:12px;color:#475569;margin-bottom:6px;">快递单号（可选）</div>
              <input id="createOrderTrackingNumber" type="text" placeholder="填写后将自动识别物流状态" style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;" />
            </div>
            <div id="createOrderTrackingParamGroup" style="display:none;margin-bottom:10px;">
              <div style="font-size:12px;color:#475569;margin-bottom:6px;">物流校验参数（顺丰可选）</div>
              <input id="createOrderTrackingParam" type="text" placeholder="顺丰可填收件人手机号后4位" style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;" />
            </div>
            <div id="createOrderStockHint" style="font-size:12px;color:#64748b;">当前库存：${Number(defaultProduct.stock_quantity || 0)}</div>
          </div>
        `,
        onConfirm: async () => {
          const customerId = String(document.getElementById('createOrderCustomer')?.value || '').trim();
          const productId = String(document.getElementById('createOrderProduct')?.value || '').trim();
          const quantity = parseInt(document.getElementById('createOrderQuantity')?.value, 10);
          const unitPrice = Number(document.getElementById('createOrderUnitPrice')?.value);
          const notes = String(document.getElementById('createOrderNotes')?.value || '').trim();
          const shippingCompany = String(document.getElementById('createOrderShippingCompany')?.value || '').trim();
          const trackingNumber = String(document.getElementById('createOrderTrackingNumber')?.value || '').trim();
          const trackingParam = String(document.getElementById('createOrderTrackingParam')?.value || '').trim();

          if (!productId) {
            window.Toast.error('请选择商品');
            return false;
          }
          if (!Number.isFinite(quantity) || quantity <= 0) {
            window.Toast.error('数量必须大于 0');
            return false;
          }
          if (!Number.isFinite(unitPrice) || unitPrice < 0) {
            window.Toast.error('单价格式不正确');
            return false;
          }

          const product = productMap.get(productId);
          if (!product) {
            window.Toast.error('商品不存在，请重试');
            return false;
          }

          const stock = Number(product.stock_quantity || 0);
          if (stock < quantity) {
            window.Toast.error(`库存不足，当前库存 ${stock}`);
            return false;
          }

          const customer = customerId ? customerMap.get(customerId) : null;
          const initialShippingStatus = trackingNumber ? 'shipped' : 'not_shipped';

          let result = await window.API.createOrderWithItems({
            customer_id: customerId || null,
            customer_name: customer?.name || '',
            notes,
            status: 'pending',
            payment_status: 'unpaid',
            shipping_status: initialShippingStatus,
            shipping_company: shippingCompany || null,
            tracking_number: trackingNumber || null,
            items: [{
              product_id: product.id,
              product_name: product.name || '未命名商品',
              quantity,
              unit_price: unitPrice
            }]
          });

          if (!result) {
            window.Toast.error('创建订单失败');
            return false;
          }

          if (trackingNumber) {
            try {
              const logisticsResult = await this.queryLogisticsWithFallback(
                trackingNumber,
                shippingCompany,
                { param: trackingParam, forceRefresh: true }
              );
              const suggestion = this.inferFulfillmentFromLogisticsResult(
                logisticsResult,
                Array.isArray(logisticsResult?.timeline) ? logisticsResult.timeline : []
              );

              if (suggestion) {
                const nextOrderStatus = this.resolveNextOrderStatus(result?.status, suggestion.orderStatus);
                const nextShippingStatus = this.normalizeShippingStatusValue(suggestion.shippingStatus);
                const updatePayload = {};

                if (nextOrderStatus !== this.normalizeOrderStatusValue(result?.status)) {
                  updatePayload.status = nextOrderStatus;
                }
                if (this.shouldApplyShippingStatus(result?.shipping_status, nextShippingStatus)) {
                  updatePayload.shipping_status = nextShippingStatus;
                }

                if (Object.keys(updatePayload).length > 0) {
                  const updatedOrder = await window.API.updateOrder(result.id, updatePayload);
                  result = { ...result, ...updatedOrder };
                }
              }
            } catch (logisticsError) {
              window.Toast.info(`订单已创建，物流待稍后同步：${String(logisticsError?.message || logisticsError)}`);
            }
          }

          if (result._inventorySyncWarning) {
            window.Toast.info('订单已创建，库存同步稍后自动完成');
          } else {
            window.Toast.success(`订单创建成功：${result.order_number || ''}`);
          }

          this.currentPage = 1;
          this.orders = [];
          this.hasMore = true;
          await this.loadOrders();
          window.Router.push('/orders');
          return true;
        }
      });

      setTimeout(() => {
        const productSelect = document.getElementById('createOrderProduct');
        const unitPriceInput = document.getElementById('createOrderUnitPrice');
        const stockHint = document.getElementById('createOrderStockHint');
        const shippingCompanySelect = document.getElementById('createOrderShippingCompany');
        const trackingParamGroup = document.getElementById('createOrderTrackingParamGroup');
        const trackingParamInput = document.getElementById('createOrderTrackingParam');
        if (!productSelect || !unitPriceInput || !stockHint || !shippingCompanySelect || !trackingParamGroup || !trackingParamInput) return;

        const refreshProductFields = () => {
          const currentProduct = productMap.get(String(productSelect.value || ''));
          if (!currentProduct) return;
          unitPriceInput.value = Number(currentProduct.price || 0).toFixed(2);
          stockHint.textContent = `当前库存：${Number(currentProduct.stock_quantity || 0)}`;
        };

        const refreshTrackingParamVisibility = () => {
          const company = String(shippingCompanySelect.value || '').trim();
          const showParam = /顺丰|sf/i.test(company);
          trackingParamGroup.style.display = showParam ? '' : 'none';
          if (!showParam) {
            trackingParamInput.value = '';
          }
        };

        productSelect.addEventListener('change', refreshProductFields);
        shippingCompanySelect.addEventListener('change', refreshTrackingParamVisibility);
        refreshProductFields();
        refreshTrackingParamVisibility();
      }, 0);

      await modalPromise;
    } catch (error) {
      console.error('打开新建订单失败:', error);
      window.Toast.error(error.message || '打开新建订单失败');
    }
  },

  // 订单详情
  async loadOrderDetail(orderId) {
    try {
      window.Loading.show('加载详情...');

      const order = await window.API.getOrder(orderId);
      this.currentDetailOrderId = String(orderId || order?.id || '').trim();
      this.currentDetailOrder = order || null;
      this.renderOrderDetail(order);

      window.Loading.hide();
    } catch (error) {
      window.Loading.hide();
      console.error('加载订单详情失败:', error);
      window.Toast.error('加载订单详情失败');
      window.Router.back();
    }
  },

  renderOrderDetail(order) {
    const container = document.getElementById('orderDetailContent');
    if (!container) return;

    const statusColor = window.Utils.getOrderStatusColor(order.status);
    const statusText = window.Utils.getOrderStatusText(order.status);
    const totalAmount = window.Utils.formatMoney(order.total_amount);

    container.innerHTML = `
      <!-- 订单状态 -->
      <div class="order-detail-section">
        <div class="order-detail-title">
          <i class="fa fa-info-circle"></i>
          订单状态
        </div>
        <div class="tag tag-${statusColor}" style="font-size: 16px; padding: 6px 12px;">${statusText}</div>
      </div>

      <!-- 客户信息 -->
      <div class="order-detail-section">
        <div class="order-detail-title">
          <i class="fa fa-user"></i>
          客户信息
        </div>
        <div class="order-detail-row">
          <div class="order-detail-label">客户名称</div>
          <div class="order-detail-value">${order.customer?.name || '-'}</div>
        </div>
        <div class="order-detail-row">
          <div class="order-detail-label">联系电话</div>
          <div class="order-detail-value">${order.customer?.phone || '-'}</div>
        </div>
        <div class="order-detail-row">
          <div class="order-detail-label">联系人</div>
          <div class="order-detail-value">${order.customer?.contact_person || '-'}</div>
        </div>
      </div>

      <!-- 订单信息 -->
      <div class="order-detail-section">
        <div class="order-detail-title">
          <i class="fa fa-file-text-o"></i>
          订单信息
        </div>
        <div class="order-detail-row">
          <div class="order-detail-label">订单号</div>
          <div class="order-detail-value">${order.order_number}</div>
        </div>
        <div class="order-detail-row">
          <div class="order-detail-label">创建时间</div>
          <div class="order-detail-value">${window.Utils.formatDate(order.created_at, 'YYYY-MM-DD HH:mm')}</div>
        </div>
        ${order.notes ? `
          <div class="order-detail-row">
            <div class="order-detail-label">备注</div>
            <div class="order-detail-value">${order.notes}</div>
          </div>
        ` : ''}
      </div>

      <!-- 产品列表 -->
      <div class="order-detail-section">
        <div class="order-detail-title">
          <i class="fa fa-cubes"></i>
          产品明细
        </div>
        ${order.items && order.items.length > 0 ? order.items.map(item => `
                <div class="order-item">
                  <div class="order-item-name">${item.product_name || '-'}</div>
                  <div class="order-item-quantity">x${item.quantity}</div>
                  <div class="order-item-price">${window.Utils.formatMoney(item.price ?? item.unit_price)}</div>
                </div>
          `).join('') : '<div class="text-tertiary text-sm">暂无产品</div>'}
        <div class="divider"></div>
        <div class="order-total">
          <div class="order-total-label">订单总额</div>
          <div class="order-total-amount">${totalAmount}</div>
        </div>
      </div>

      <!-- 物流信息 -->
      ${order.shipping_company || order.tracking_number ? `
        <div class="order-logistics">
          <div class="order-logistics-header">
            <div class="order-logistics-title">物流信息</div>
            <div class="order-logistics-status">${this.getShippingStatusText(order.shipping_status || 'not_shipped')}</div>
          </div>
          <div class="order-logistics-info">
            <div class="order-logistics-icon">
              <i class="fa fa-truck"></i>
            </div>
            <div class="order-logistics-detail">
              <div class="order-logistics-company">${order.shipping_company || '-'}</div>
              <div class="order-logistics-number">${order.tracking_number || '-'}</div>
            </div>
          </div>
          ${order.tracking_number ? `
            <div style="display:flex;gap:8px;">
              <button class="btn btn-default flex-1" onclick="OrderModule.showOrderLogisticsDetails('${order.id}')">
                <i class="fa fa-list-ul"></i> 查看物流详情
              </button>
              <button class="btn btn-default flex-1" onclick="OrderModule.syncOrderLogistics('${order.id}')">
                <i class="fa fa-refresh"></i> 同步状态
              </button>
            </div>
          ` : ''}
        </div>
      ` : ''}

      <!-- 操作按钮 -->
      <div class="order-action-bar">
        ${order.status === 'pending' ? `
          <button class="btn btn-default flex-1" onclick="OrderModule.rejectOrder('${order.id}')">拒绝</button>
          <button class="btn btn-primary flex-1" onclick="OrderModule.approveOrder('${order.id}')">确认订单</button>
        ` : ''}
        ${['confirmed', 'approved'].includes(String(order.status || '').toLowerCase()) ? `
          <button class="btn btn-primary btn-block" onclick="OrderModule.shipOrder('${order.id}')">标记发货</button>
        ` : ''}
        ${order.status === 'shipped' ? `
          <button class="btn btn-success btn-block" onclick="OrderModule.signOrder('${order.id}')">确认签收</button>
        ` : ''}
        ${['signed', 'delivered'].includes(String(order.status || '').toLowerCase()) ? `
          <button class="btn btn-success btn-block" onclick="OrderModule.completeOrder('${order.id}')">完成订单</button>
        ` : ''}
      </div>
    `;
  },

  async copyText(text) {
    const content = String(text || '').trim();
    if (!content) return false;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(content);
        return true;
      }
    } catch (error) {
    }

    const textarea = document.createElement('textarea');
    textarea.value = content;
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (error) {
      copied = false;
    }
    document.body.removeChild(textarea);
    return copied;
  },

  async showOrderDetailMoreActions() {
    try {
      const currentId = String(this.currentDetailOrderId || '').trim();
      if (!currentId) {
        window.Toast.info('订单详情尚未加载完成');
        return;
      }

      let order = this.currentDetailOrder;
      if (!order || String(order?.id || '') !== currentId) {
        order = await window.API.getOrder(currentId);
        this.currentDetailOrder = order || null;
      }
      if (!order) {
        window.Toast.error('订单数据不存在');
        return;
      }

      const trackingNumber = String(order?.tracking_number || '').trim();
      const actions = [
        {
          text: '刷新详情',
          icon: 'refresh',
          handler: async () => {
            await this.loadOrderDetail(currentId);
            window.Toast.success('订单详情已刷新');
          }
        },
        {
          text: '复制订单号',
          icon: 'copy',
          handler: async () => {
            const orderNo = String(order?.order_number || '').trim();
            if (!orderNo) {
              window.Toast.info('当前订单没有订单号');
              return;
            }
            const copied = await this.copyText(orderNo);
            if (copied) {
              window.Toast.success('订单号已复制');
            } else {
              window.Toast.error('复制失败，请手动复制');
            }
          }
        }
      ];

      if (trackingNumber) {
        actions.push(
          {
            text: '查看物流详情',
            icon: 'list-ul',
            handler: async () => {
              await this.showOrderLogisticsDetails(currentId);
            }
          },
          {
            text: '同步物流状态',
            icon: 'refresh',
            handler: async () => {
              await this.syncOrderLogistics(currentId);
            }
          }
        );
      }

      actions.push({
        text: '删除订单',
        icon: 'trash',
        danger: true,
        handler: async () => {
          await this.deleteOrder(currentId, order);
        }
      });

      await window.ActionSheet.show({
        title: `订单 ${order.order_number || ''}`,
        actions
      });
    } catch (error) {
      console.error('打开订单更多操作失败:', error);
      window.Toast.error('打开更多操作失败');
    }
  },

  async deleteOrder(orderId, order = null) {
    const safeOrderId = String(orderId || '').trim();
    if (!safeOrderId) {
      window.Toast.error('订单ID无效');
      return;
    }

    const orderNumber = String(order?.order_number || '').trim();
    const confirmed = await window.Modal.confirm(
      `确认删除订单${orderNumber ? `「${orderNumber}」` : ''}？<br><span style="color:#dc2626;">删除后将回补库存并清理关联财务记录。</span>`,
      '删除订单'
    );
    if (!confirmed) return;

    try {
      await window.API.deleteOrder(safeOrderId);
      window.Toast.success('订单已删除');

      this.currentDetailOrderId = '';
      this.currentDetailOrder = null;
      this.currentPage = 1;
      this.orders = [];
      this.hasMore = true;
      this.emptyHintShown = false;

      window.Router.push('/orders');
    } catch (error) {
      console.error('删除订单失败:', error);
      window.Toast.error(error?.message || '删除订单失败');
    }
  },

  buildLogisticsEventText(event) {
    const rawDisplayText = String(event?.displayText || '').trim();
    if (rawDisplayText) return rawDisplayText;
    const statusText = String(event?.status || '').trim();
    const descText = String(event?.description || '').trim();
    const locationText = String(event?.location || '').trim();
    return [statusText, descText, locationText].filter(Boolean).join(' ｜ ') || '状态更新';
  },

  async applyLogisticsSuggestion(order, logisticsResult) {
    if (!order || !order.id) return false;
    const timeline = Array.isArray(logisticsResult?.timeline) ? logisticsResult.timeline : [];
    const suggestion = this.inferFulfillmentFromLogisticsResult(logisticsResult, timeline);
    if (!suggestion) return false;

    const nextOrderStatus = this.resolveNextOrderStatus(order?.status, suggestion.orderStatus);
    const nextShippingStatus = this.normalizeShippingStatusValue(suggestion.shippingStatus);
    const updatePayload = {};

    if (nextOrderStatus !== this.normalizeOrderStatusValue(order?.status)) {
      updatePayload.status = nextOrderStatus;
    }
    if (this.shouldApplyShippingStatus(order?.shipping_status, nextShippingStatus)) {
      updatePayload.shipping_status = nextShippingStatus;
    }

    if (Object.keys(updatePayload).length === 0) {
      return false;
    }

    await window.API.updateOrder(order.id, updatePayload);
    return true;
  },

  async showOrderLogisticsDetails(orderId) {
    try {
      window.Loading.show('加载物流轨迹...');
      const order = await window.API.getOrder(orderId);
      const trackingNumber = String(order?.tracking_number || '').trim();
      const shippingCompany = String(order?.shipping_company || '').trim();
      if (!trackingNumber) {
        throw new Error('该订单未填写快递单号');
      }

      const logisticsResult = await this.queryLogisticsWithFallback(
        trackingNumber,
        shippingCompany,
        { forceRefresh: true }
      );
      const timeline = Array.isArray(logisticsResult?.timeline) ? logisticsResult.timeline : [];
      await this.applyLogisticsSuggestion(order, logisticsResult);
      window.Loading.hide();

      const providerName = this.escapeHtml(String(logisticsResult?.providerName || shippingCompany || '17TRACK'));
      const latestStatus = this.escapeHtml(String(logisticsResult?.latestStatusText || logisticsResult?.latestStatusCode || '已同步'));

      const timelineHtml = timeline.length > 0
        ? timeline.slice(0, 30).map((item, index) => {
          const displayText = this.escapeHtml(this.buildLogisticsEventText(item));
          const timeText = this.escapeHtml(String(item?.time || '-'));
          return `
            <div style="position:relative;padding-left:18px;padding-bottom:10px;">
              <span style="position:absolute;left:0;top:5px;width:8px;height:8px;border-radius:50%;background:${index === 0 ? '#16a34a' : '#cbd5e1'};"></span>
              <div style="font-size:13px;color:${index === 0 ? '#0f172a' : '#475569'};line-height:1.5;">${displayText}</div>
              <div style="font-size:12px;color:#94a3b8;margin-top:2px;">${timeText}</div>
            </div>
          `;
        }).join('')
        : '<div style="font-size:12px;color:#94a3b8;padding:8px 0;">暂无物流轨迹</div>';

      await window.Modal.show({
        title: '物流轨迹详情',
        confirmText: '关闭',
        showCancel: false,
        content: `
          <div style="text-align:left;">
            <div style="padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc;margin-bottom:10px;">
              <div style="font-size:13px;color:#334155;"><strong>快递：</strong>${providerName}</div>
              <div style="font-size:13px;color:#334155;"><strong>单号：</strong>${this.escapeHtml(trackingNumber)}</div>
              <div style="font-size:13px;color:#334155;"><strong>最新状态：</strong>${latestStatus}</div>
            </div>
            <div style="max-height:320px;overflow:auto;border:1px solid #e5e7eb;border-radius:8px;padding:10px;background:#fff;">
              ${timelineHtml}
            </div>
          </div>
        `
      });

      await this.loadOrderDetail(orderId);
    } catch (error) {
      window.Loading.hide();
      console.error('加载物流详情失败:', error);
      window.Toast.error(error?.message || '加载物流详情失败');
    }
  },

  async syncOrderLogistics(orderId) {
    try {
      window.Loading.show('同步物流中...');
      const order = await window.API.getOrder(orderId);
      const trackingNumber = String(order?.tracking_number || '').trim();
      const shippingCompany = String(order?.shipping_company || '').trim();

      if (!trackingNumber) {
        throw new Error('该订单未填写快递单号');
      }

      const logisticsResult = await this.queryLogisticsWithFallback(
        trackingNumber,
        shippingCompany,
        { forceRefresh: true }
      );
      await this.applyLogisticsSuggestion(order, logisticsResult);

      await this.loadOrderDetail(orderId);
      window.Loading.hide();
      window.Toast.success('物流状态已同步');
    } catch (error) {
      window.Loading.hide();
      console.error('同步物流状态失败:', error);
      window.Toast.error(error?.message || '同步物流状态失败');
    }
  },

  async approveOrder(orderId) {
    const confirmed = await window.Modal.confirm('确认将订单状态更新为「已确认」？');
    if (!confirmed) return;

    try {
      await window.API.updateOrderStatus(orderId, 'confirmed');
      window.Toast.success('订单已确认');
      await this.loadOrderDetail(orderId);
    } catch (error) {
      console.error('审核订单失败:', error);
      window.Toast.error('审核失败');
    }
  },

  async rejectOrder(orderId) {
    const confirmed = await window.Modal.confirm('确认拒绝该订单？', '拒绝订单');
    if (!confirmed) return;

    try {
      await window.API.updateOrderStatus(orderId, 'cancelled');
      window.Toast.success('已拒绝订单');
      window.Router.back();
    } catch (error) {
      console.error('拒绝订单失败:', error);
      window.Toast.error('操作失败');
    }
  },

  async shipOrder(orderId) {
    const confirmed = await window.Modal.confirm('确认标记为已发货？');
    if (!confirmed) return;

    try {
      await window.API.updateOrder(orderId, {
        status: 'shipped',
        shipping_status: 'shipped'
      });
      window.Toast.success('已标记发货');
      await this.loadOrderDetail(orderId);
    } catch (error) {
      console.error('标记发货失败:', error);
      window.Toast.error('操作失败');
    }
  },

  async signOrder(orderId) {
    const confirmed = await window.Modal.confirm('确认订单已签收？');
    if (!confirmed) return;

    try {
      await window.API.updateOrder(orderId, {
        status: 'signed',
        shipping_status: 'delivered'
      });
      window.Toast.success('已标记签收');
      await this.loadOrderDetail(orderId);
    } catch (error) {
      console.error('签收订单失败:', error);
      window.Toast.error('操作失败');
    }
  },

  async completeOrder(orderId) {
    const confirmed = await window.Modal.confirm('确认完成该订单？');
    if (!confirmed) return;

    try {
      await window.API.updateOrderStatus(orderId, 'completed');
      window.Toast.success('订单已完成');
      await this.loadOrderDetail(orderId);
    } catch (error) {
      console.error('完成订单失败:', error);
      window.Toast.error('操作失败');
    }
  }
};
