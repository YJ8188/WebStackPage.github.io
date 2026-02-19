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

  async init() {
    this.bindEvents();
    await this.loadCustomers();
  },

  bindEvents() {
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
        handler: () => window.Router.push('/customer/detail', { id: customer.id })
      },
      {
        text: '编辑客户',
        icon: 'edit',
        handler: () => this.showEditCustomerModal(customer)
      },
      {
        text: '查看订单',
        icon: 'file-text-o',
        handler: () => window.Router.push('/orders', { customer_id: customer.id })
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

  async showAddCustomerModal() {
    // TODO: 实现添加客户表单
    window.Toast.info('添加客户功能开发中');
  },

  async showEditCustomerModal(customer) {
    // TODO: 实现编辑客户表单
    window.Toast.info('编辑客户功能开发中');
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


