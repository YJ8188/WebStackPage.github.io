/**
 * 移动端ERP - 客户模块
 */

window.CustomerModule = {
  name: 'customer',
  currentPage: 1,
  pageSize: 20,
  customers: [],
  hasMore: true,
  searchKeyword: '',
  eventsBound: false,

  async init() {
    if (!this.eventsBound) {
      this.bindEvents();
      this.eventsBound = true;
    }
    this.currentPage = 1;
    this.customers = [];
    this.hasMore = true;
    await this.loadCustomers();
  },

  bindEvents() {
    if (document.body.dataset.customerEventsBound === '1') {
      return;
    }

    // 搜索输入
    const searchInput = document.getElementById('customersSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', window.Utils.debounce((e) => {
        this.searchKeyword = e.target.value.trim();
        this.currentPage = 1;
        this.customers = [];
        this.hasMore = true;
        this.loadCustomers();
      }, 500));
    }

    // 添加客户按钮
    document.getElementById('customersAddBtn')?.addEventListener('click', () => {
      this.showAddCustomerModal();
    });

    // 滚动加载更多
    const content = document.getElementById('customersContent');
    if (content) {
      content.addEventListener('scroll', window.Utils.throttle(() => {
        if (content.scrollHeight - content.scrollTop - content.clientHeight < 100) {
          this.loadMore();
        }
      }, 300));
    }

    document.body.dataset.customerEventsBound = '1';
  },

  async loadCustomers() {
    try {
      if (this.currentPage === 1) {
        window.Loading.show('加载客户...');
      }

      const offset = (this.currentPage - 1) * this.pageSize;
      const newCustomers = await window.API.getCustomers({
        keyword: this.searchKeyword,
        limit: this.pageSize,
        offset
      });

      if (newCustomers.length < this.pageSize) {
        this.hasMore = false;
      }

      this.customers = this.currentPage === 1 ? newCustomers : [...this.customers, ...newCustomers];
      this.renderCustomers();

      window.Loading.hide();
    } catch (error) {
      window.Loading.hide();
      console.error('加载客户失败:', error);
      window.Toast.error('加载客户失败');
    }
  },

  async loadMore() {
    if (!this.hasMore) return;
    this.currentPage++;
    await this.loadCustomers();
  },

  renderCustomers() {
    const container = document.getElementById('customersContent');
    if (!container) return;

    if (this.customers.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fa fa-users"></i></div>
          <div class="empty-text">${this.searchKeyword ? '未找到相关客户' : '暂无客户'}</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="customer-list">
        ${this.customers.map(customer => this.renderCustomerItem(customer)).join('')}
      </div>
      ${this.hasMore ? '<div class="infinite-scroll-loading">加载更多...</div>' : '<div class="infinite-scroll-finished">没有更多了</div>'}
    `;

    // 绑定点击事件
    container.querySelectorAll('.customer-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        this.showCustomerDetail(this.customers[index]);
      });
    });
  },

  renderCustomerItem(customer) {
    const initial = customer.name ? customer.name.charAt(0) : '?';
    const isVip = customer.level === 'VIP' || customer.level === 'vip';

    return `
      <div class="customer-item" data-customer-id="${customer.id}">
        <div class="customer-avatar ${isVip ? 'vip' : ''}">${initial}</div>
        <div class="customer-info">
          <div class="customer-name">
            ${customer.name || '未命名'}
            ${isVip ? '<span class="customer-vip-badge">VIP</span>' : ''}
          </div>
          ${customer.contact_person ? `<div class="customer-contact">${customer.contact_person}</div>` : ''}
          <div class="customer-phone">${customer.phone || '-'}</div>
        </div>
        <div class="customer-meta">
          <div class="customer-orders">${customer.order_count || 0}笔订单</div>
          ${customer.total_amount ? `<div class="customer-amount">${window.Utils.formatMoney(customer.total_amount)}</div>` : ''}
        </div>
      </div>
    `;
  },

  async showCustomerDetail(customer) {
    const actions = [
      {
        text: '查看详情',
        icon: 'eye',
        handler: () => this.showCustomerInfoModalById(customer.id)
      },
      {
        text: '编辑客户',
        icon: 'edit',
        handler: () => this.showEditCustomerModal(customer)
      },
      {
        text: '查看订单',
        icon: 'file-text-o',
        handler: () => this.openCustomerOrders(customer.id, customer.name)
      },
      {
        text: '删除客户',
        icon: 'trash-o',
        handler: () => this.deleteCustomer(customer.id),
        danger: true
      }
    ];

    await window.ActionSheet.show({
      title: customer.name,
      actions
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

  async getCustomerOrdersSummary(customerId) {
    const orders = await window.API.getOrders({
      customerId,
      limit: 200,
      offset: 0
    });
    const orderList = Array.isArray(orders) ? orders : [];
    const totalAmount = orderList.reduce((sum, order) => sum + Math.max(Number(order?.total_amount || 0), 0), 0);
    return {
      orders: orderList,
      orderCount: orderList.length,
      totalAmount
    };
  },

  async showCustomerInfoModalById(customerId) {
    try {
      window.Loading.show('加载客户详情...');
      const [customer, summary] = await Promise.all([
        window.API.getCustomer(customerId),
        this.getCustomerOrdersSummary(customerId)
      ]);
      window.Loading.hide();

      if (!customer) {
        window.Toast.error('客户不存在或已删除');
        return;
      }

      await window.Modal.show({
        title: `${this.escapeHtml(customer.name || '客户详情')}`,
        confirmText: '关闭',
        showCancel: false,
        content: `
          <div style="text-align:left;font-size:13px;line-height:1.7;color:#334155;">
            <div><strong>联系人：</strong>${this.escapeHtml(customer.contact_person || '-')}</div>
            <div><strong>电话：</strong>${this.escapeHtml(customer.phone || '-')}</div>
            <div><strong>地址：</strong>${this.escapeHtml(customer.address || '-')}</div>
            <div><strong>等级：</strong>${this.escapeHtml(customer.level || '普通')}</div>
            <div><strong>累计订单：</strong>${summary.orderCount} 笔</div>
            <div><strong>累计金额：</strong>${window.Utils.formatMoney(summary.totalAmount)}</div>
            <div style="margin-top:6px;"><strong>备注：</strong>${this.escapeHtml(customer.notes || '-')}</div>
          </div>
        `
      });
    } catch (error) {
      window.Loading.hide();
      console.error('加载客户详情失败:', error);
      window.Toast.error('加载客户详情失败');
    }
  },

  buildCustomerFormHtml(customer = {}) {
    const name = this.escapeHtml(customer.name || '');
    const contactPerson = this.escapeHtml(customer.contact_person || '');
    const phone = this.escapeHtml(customer.phone || '');
    const address = this.escapeHtml(customer.address || '');
    const notes = this.escapeHtml(customer.notes || '');
    const level = String(customer.level || '').toLowerCase();

    return `
      <div style="text-align:left;">
        <div style="margin-bottom:10px;">
          <div style="margin-bottom:6px;color:#475569;font-size:12px;">客户名称</div>
          <input id="customerFormName" type="text" value="${name}" placeholder="请输入客户名称"
            style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;" />
        </div>
        <div style="margin-bottom:10px;">
          <div style="margin-bottom:6px;color:#475569;font-size:12px;">联系人</div>
          <input id="customerFormContact" type="text" value="${contactPerson}" placeholder="请输入联系人"
            style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;" />
        </div>
        <div style="margin-bottom:10px;">
          <div style="margin-bottom:6px;color:#475569;font-size:12px;">联系电话</div>
          <input id="customerFormPhone" type="tel" value="${phone}" placeholder="请输入联系电话"
            style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;" />
        </div>
        <div style="margin-bottom:10px;">
          <div style="margin-bottom:6px;color:#475569;font-size:12px;">地址</div>
          <input id="customerFormAddress" type="text" value="${address}" placeholder="请输入地址"
            style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;" />
        </div>
        <div style="margin-bottom:10px;">
          <div style="margin-bottom:6px;color:#475569;font-size:12px;">客户等级</div>
          <select id="customerFormLevel" style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;">
            <option value="normal" ${level === 'vip' ? '' : 'selected'}>普通</option>
            <option value="vip" ${level === 'vip' ? 'selected' : ''}>VIP</option>
          </select>
        </div>
        <div>
          <div style="margin-bottom:6px;color:#475569;font-size:12px;">备注</div>
          <textarea id="customerFormNotes" rows="3" placeholder="选填"
            style="width:100%;border:1px solid #d9d9d9;border-radius:8px;padding:8px 10px;resize:none;">${notes}</textarea>
        </div>
      </div>
    `;
  },

  readCustomerFormData() {
    const name = String(document.getElementById('customerFormName')?.value || '').trim();
    const contactPerson = String(document.getElementById('customerFormContact')?.value || '').trim();
    const phone = String(document.getElementById('customerFormPhone')?.value || '').trim();
    const address = String(document.getElementById('customerFormAddress')?.value || '').trim();
    const level = String(document.getElementById('customerFormLevel')?.value || 'normal').trim().toLowerCase();
    const notes = String(document.getElementById('customerFormNotes')?.value || '').trim();

    if (!name) {
      throw new Error('请填写客户名称');
    }
    if (phone && !window.Utils.validatePhone(phone)) {
      throw new Error('联系电话格式不正确');
    }

    return {
      name,
      contact_person: contactPerson,
      phone,
      address,
      level: level === 'vip' ? 'VIP' : 'normal',
      notes
    };
  },

  async showAddCustomerModal() {
    await window.Modal.show({
      title: '添加客户',
      confirmText: '保存',
      cancelText: '取消',
      content: this.buildCustomerFormHtml({}),
      onConfirm: async () => {
        try {
          const payload = this.readCustomerFormData();
          await window.API.createCustomer(payload);
          window.Toast.success('客户已添加');
          this.currentPage = 1;
          this.customers = [];
          this.hasMore = true;
          await this.loadCustomers();
          return true;
        } catch (error) {
          window.Toast.error(error?.message || '添加客户失败');
          return false;
        }
      }
    });
  },

  async showEditCustomerModal(customer) {
    try {
      const latest = await window.API.getCustomer(customer.id);
      await window.Modal.show({
        title: '编辑客户',
        confirmText: '保存',
        cancelText: '取消',
        content: this.buildCustomerFormHtml(latest || customer || {}),
        onConfirm: async () => {
          try {
            const payload = this.readCustomerFormData();
            await window.API.updateCustomer(customer.id, payload);
            window.Toast.success('客户信息已更新');
            this.currentPage = 1;
            this.customers = [];
            this.hasMore = true;
            await this.loadCustomers();
            return true;
          } catch (error) {
            window.Toast.error(error?.message || '更新客户失败');
            return false;
          }
        }
      });
    } catch (error) {
      console.error('加载客户失败:', error);
      window.Toast.error('加载客户失败');
    }
  },

  async openCustomerOrders(customerId, customerName = '') {
    try {
      const rows = await window.API.getOrders({
        customerId,
        limit: 1,
        offset: 0
      });
      if (!Array.isArray(rows) || rows.length === 0) {
        window.Toast.info(`客户${customerName ? `「${customerName}」` : ''}当前暂无订单`);
        return;
      }
      window.Router.push('/orders', { customer_id: customerId });
    } catch (error) {
      console.error('查询客户订单失败:', error);
      window.Toast.error('查询客户订单失败');
    }
  },

  async deleteCustomer(customerId) {
    const confirmed = await window.Modal.confirm('确认删除该客户？删除后无法恢复。', '删除客户');
    if (!confirmed) return;

    try {
      await window.API.deleteCustomer(customerId);
      window.Toast.success('删除成功');
      this.currentPage = 1;
      this.customers = [];
      this.hasMore = true;
      await this.loadCustomers();
    } catch (error) {
      console.error('删除客户失败:', error);
      window.Toast.error('删除失败');
    }
  }
};

