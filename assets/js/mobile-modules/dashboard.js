/**
 * 移动端ERP - 仪表盘模块
 */

window.DashboardModule = {
  name: 'dashboard',

  async init() {
    await this.render();
    await this.loadData();
    this.bindEvents();
  },

  async render() {
    const page = document.getElementById('dashboardPage');
    if (!page) return;

    page.innerHTML = `
      <!-- 统计卡片 -->
      <div class="dashboard-stats">
        <div class="dashboard-stat-card">
          <div class="dashboard-stat-label">今日订单</div>
          <div class="dashboard-stat-value" id="todayOrders">-</div>
          <div class="dashboard-stat-trend">
            <i class="fa fa-arrow-up"></i>
            <span>较昨日</span>
          </div>
        </div>
        <div class="dashboard-stat-card">
          <div class="dashboard-stat-label">待发货</div>
          <div class="dashboard-stat-value" id="pendingOrders">-</div>
          <div class="dashboard-stat-trend">
            <i class="fa fa-clock-o"></i>
            <span>待处理</span>
          </div>
        </div>
        <div class="dashboard-stat-card">
          <div class="dashboard-stat-label">库存预警</div>
          <div class="dashboard-stat-value" id="lowStockProducts">-</div>
          <div class="dashboard-stat-trend">
            <i class="fa fa-exclamation-triangle"></i>
            <span>需补货</span>
          </div>
        </div>
        <div class="dashboard-stat-card">
          <div class="dashboard-stat-label">客户总数</div>
          <div class="dashboard-stat-value" id="totalCustomers">-</div>
          <div class="dashboard-stat-trend">
            <i class="fa fa-users"></i>
            <span>活跃客户</span>
          </div>
        </div>
      </div>

      <!-- 快捷操作 -->
      <div class="dashboard-shortcuts">
        <div class="dashboard-shortcuts-title">快捷操作</div>
        <div class="dashboard-shortcuts-grid">
          <div class="dashboard-shortcut-item" data-action="newOrder">
            <div class="dashboard-shortcut-icon blue">
              <i class="fa fa-plus"></i>
            </div>
            <div class="dashboard-shortcut-label">新建订单</div>
          </div>
          <div class="dashboard-shortcut-item" data-action="inventory">
            <div class="dashboard-shortcut-icon pink">
              <i class="fa fa-cube"></i>
            </div>
            <div class="dashboard-shortcut-label">库存管理</div>
          </div>
          <div class="dashboard-shortcut-item" data-action="customers">
            <div class="dashboard-shortcut-icon cyan">
              <i class="fa fa-users"></i>
            </div>
            <div class="dashboard-shortcut-label">客户管理</div>
          </div>
          <div class="dashboard-shortcut-item" data-action="products">
            <div class="dashboard-shortcut-icon green">
              <i class="fa fa-cubes"></i>
            </div>
            <div class="dashboard-shortcut-label">产品管理</div>
          </div>
        </div>
      </div>

      <!-- 待办事项 -->
      <div class="dashboard-todos">
        <div class="dashboard-todos-header">
          <div class="dashboard-todos-title">待办事项</div>
          <div class="dashboard-todos-count" id="todosCount">0</div>
        </div>
        <div id="todosList"></div>
      </div>
    `;

    page.classList.remove('hidden');
  },

  async loadData() {
    try {
      // 加载统计数据
      const stats = await window.API.getDashboardStats();

      document.getElementById('todayOrders').textContent = stats.todayOrders || 0;
      document.getElementById('pendingOrders').textContent = stats.pendingOrders || 0;
      document.getElementById('lowStockProducts').textContent = stats.lowStockProducts || 0;
      document.getElementById('totalCustomers').textContent = stats.totalCustomers || 0;

      // 加载待办事项
      await this.loadTodos();

    } catch (error) {
      console.error('加载仪表盘数据失败:', error);
      window.Toast.error('加载数据失败');
    }
  },

  async loadTodos() {
    try {
      const todos = [];

      // 获取待审核订单
      const pendingOrders = await window.API.getOrders({ status: 'pending', limit: 5 });
      pendingOrders.forEach(order => {
        todos.push({
          type: 'warning',
          icon: 'fa-file-text-o',
          title: '待审核订单',
          desc: `订单号: ${order.order_number}`,
          badge: order.customer?.name || '',
          action: () => window.Router.push('/order/detail', { id: order.id })
        });
      });

      // 获取库存预警产品
      const products = await window.API.getProducts({ limit: 100 });
      const lowStockProducts = products.filter(p => window.Utils.checkStockWarning(p));
      if (lowStockProducts.length > 0) {
        todos.push({
          type: 'error',
          icon: 'fa-exclamation-triangle',
          title: '库存预警',
          desc: `${lowStockProducts.length}个产品库存不足`,
          badge: lowStockProducts.length,
          action: () => window.Router.push('/inventory')
        });
      }

      // 获取待发货订单
      const shippingOrders = await window.API.getOrders({ status: 'approved', limit: 5 });
      shippingOrders.forEach(order => {
        todos.push({
          type: 'info',
          icon: 'fa-truck',
          title: '待发货订单',
          desc: `订单号: ${order.order_number}`,
          badge: order.customer?.name || '',
          action: () => window.Router.push('/order/detail', { id: order.id })
        });
      });

      this.renderTodos(todos);

    } catch (error) {
      console.error('加载待办事项失败:', error);
    }
  },

  renderTodos(todos) {
    const container = document.getElementById('todosList');
    const countEl = document.getElementById('todosCount');

    if (!container) return;

    countEl.textContent = todos.length;

    if (todos.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fa fa-check-circle"></i></div>
          <div class="empty-text">暂无待办事项</div>
        </div>
      `;
      return;
    }

    container.innerHTML = todos.map(todo => `
      <div class="dashboard-todo-item" data-todo-id="${todo.title}">
        <div class="dashboard-todo-icon ${todo.type}">
          <i class="fa ${todo.icon}"></i>
        </div>
        <div class="dashboard-todo-content">
          <div class="dashboard-todo-title">${todo.title}</div>
          <div class="dashboard-todo-desc">${todo.desc}</div>
        </div>
        ${todo.badge ? `<div class="dashboard-todo-badge tag tag-${todo.type}">${todo.badge}</div>` : ''}
      </div>
    `).join('');

    // 绑定点击事件
    todos.forEach((todo, index) => {
      const item = container.children[index];
      if (item && todo.action) {
        item.addEventListener('click', todo.action);
      }
    });
  },

  bindEvents() {
    // 快捷操作
    document.querySelectorAll('.dashboard-shortcut-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        this.handleShortcut(action);
      });
    });
  },

  handleShortcut(action) {
    const actions = {
      newOrder: () => window.Router.push('/orders'),
      inventory: () => window.Router.push('/inventory'),
      customers: () => window.Router.push('/customers'),
      products: () => window.Router.push('/products')
    };

    const handler = actions[action];
    if (handler) {
      handler();
    }
  }
};
