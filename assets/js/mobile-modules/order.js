/**
 * 移动端ERP - 订单模块
 */

window.OrderModule = {
  name: 'order',
  currentStatus: '',
  currentPage: 1,
  pageSize: 20,
  orders: [],
  hasMore: true,
  eventsBound: false,

  async init() {
    if (!this.eventsBound) {
      this.bindEvents();
      this.eventsBound = true;
    }
    await this.loadOrders();
  },

  bindEvents() {
    // 状态标签切换
    document.querySelectorAll('#orderTabs .tab-item').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#orderTabs .tab-item').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentStatus = tab.dataset.status;
        this.currentPage = 1;
        this.orders = [];
        this.hasMore = true;
        this.loadOrders();
      });
    });

    // 搜索按钮
    document.getElementById('ordersSearchBtn')?.addEventListener('click', () => {
      this.showSearchModal();
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

  async loadOrders() {
    try {
      window.Loading.show('加载订单...');

      const offset = (this.currentPage - 1) * this.pageSize;
      const newOrders = await window.API.getOrders({
        status: this.currentStatus,
        limit: this.pageSize,
        offset
      });

      if (newOrders.length < this.pageSize) {
        this.hasMore = false;
      }

      this.orders = this.currentPage === 1 ? newOrders : [...this.orders, ...newOrders];
      this.renderOrders();

      window.Loading.hide();
    } catch (error) {
      window.Loading.hide();
      console.error('加载订单失败:', error);
      window.Toast.error('加载订单失败');
    }
  },

  async loadMore() {
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

    container.innerHTML = `
      <div class="order-list">
        ${this.orders.map(order => this.renderOrderCard(order)).join('')}
      </div>
      ${this.hasMore ? '<div class="infinite-scroll-loading">加载更多...</div>' : '<div class="infinite-scroll-finished">没有更多了</div>'}
    `;

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
    // TODO: 实现搜索功能
    window.Toast.info('搜索功能开发中');
  },

  escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
      const defaultProductId = String(defaultProduct.id);
      const defaultUnitPrice = Number(defaultProduct.price || 0).toFixed(2);

      const customerOptions = [
        '<option value="">不指定客户（散客）</option>',
        ...customerList.map(item => `<option value="${this.escapeHtml(item.id)}">${this.escapeHtml(item.name || `客户#${item.id}`)}</option>`)
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
            <div id="createOrderStockHint" style="font-size:12px;color:#64748b;">当前库存：${Number(defaultProduct.stock_quantity || 0)}</div>
          </div>
        `,
        onConfirm: async () => {
          const customerId = String(document.getElementById('createOrderCustomer')?.value || '').trim();
          const productId = String(document.getElementById('createOrderProduct')?.value || '').trim();
          const quantity = parseInt(document.getElementById('createOrderQuantity')?.value, 10);
          const unitPrice = Number(document.getElementById('createOrderUnitPrice')?.value);
          const notes = String(document.getElementById('createOrderNotes')?.value || '').trim();

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

          const result = await window.API.createOrderWithItems({
            customer_id: customerId || null,
            customer_name: customer?.name || '',
            notes,
            status: 'pending',
            payment_status: 'unpaid',
            shipping_status: 'not_shipped',
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
        if (!productSelect || !unitPriceInput || !stockHint) return;

        const refreshProductFields = () => {
          const currentProduct = productMap.get(String(productSelect.value || ''));
          if (!currentProduct) return;
          unitPriceInput.value = Number(currentProduct.price || 0).toFixed(2);
          stockHint.textContent = `当前库存：${Number(currentProduct.stock_quantity || 0)}`;
        };

        productSelect.addEventListener('change', refreshProductFields);
        refreshProductFields();
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
            <div class="order-logistics-status">运输中</div>
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
      await window.API.updateOrderStatus(orderId, 'shipped');
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
      await window.API.updateOrderStatus(orderId, 'signed');
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
