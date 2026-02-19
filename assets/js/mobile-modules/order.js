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

  async init() {
    this.bindEvents();
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
                  <div class="order-item-price">${window.Utils.formatMoney(item.price)}</div>
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
            <div class="order-item-price">${window.Utils.formatMoney(item.price)}</div>
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
          <button class="btn btn-primary flex-1" onclick="OrderModule.approveOrder('${order.id}')">审核通过</button>
        ` : ''}
        ${order.status === 'approved' ? `
          <button class="btn btn-primary btn-block" onclick="OrderModule.shipOrder('${order.id}')">标记发货</button>
        ` : ''}
        ${order.status === 'shipped' ? `
          <button class="btn btn-success btn-block" onclick="OrderModule.completeOrder('${order.id}')">确认签收</button>
        ` : ''}
      </div>
    `;
  },

  async approveOrder(orderId) {
    const confirmed = await window.Modal.confirm('确认审核通过该订单？');
    if (!confirmed) return;

    try {
      await window.API.updateOrderStatus(orderId, 'approved');
      window.Toast.success('审核成功');
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

  async completeOrder(orderId) {
    const confirmed = await window.Modal.confirm('确认订单已签收？');
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

