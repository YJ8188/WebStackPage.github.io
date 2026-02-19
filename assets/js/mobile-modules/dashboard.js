/**
 * 移动端ERP - 仪表盘模块
 */

window.DashboardModule = {
  name: 'dashboard',
  eventsBound: false,
  latestStats: null,

  async init() {
    await this.render();
    await this.loadData();
    if (!this.eventsBound) {
      this.bindEvents();
      this.eventsBound = true;
    }
  },

  async render() {
    const page = document.getElementById('dashboardPage');
    if (!page) return;

    page.innerHTML = `
      <!-- 统计卡片 -->
      <div class="dashboard-stats">
        <div class="dashboard-stat-card" data-stat="todayOrders">
          <div class="dashboard-stat-label">今日订单</div>
          <div class="dashboard-stat-value" id="todayOrders">-</div>
          <div class="dashboard-stat-trend">
            <i class="fa fa-arrow-up"></i>
            <span>按今日</span>
          </div>
        </div>
        <div class="dashboard-stat-card" data-stat="pendingOrders">
          <div class="dashboard-stat-label">待发货</div>
          <div class="dashboard-stat-value" id="pendingOrders">-</div>
          <div class="dashboard-stat-trend">
            <i class="fa fa-clock-o"></i>
            <span>待处理</span>
          </div>
        </div>
        <div class="dashboard-stat-card" data-stat="lowStockProducts">
          <div class="dashboard-stat-label">库存预警</div>
          <div class="dashboard-stat-value" id="lowStockProducts">-</div>
          <div class="dashboard-stat-trend">
            <i class="fa fa-exclamation-triangle"></i>
            <span>需补货</span>
          </div>
        </div>
        <div class="dashboard-stat-card" data-stat="totalCustomers">
          <div class="dashboard-stat-label">客户总数</div>
          <div class="dashboard-stat-value" id="totalCustomers">-</div>
          <div class="dashboard-stat-trend">
            <i class="fa fa-users"></i>
            <span>客户管理</span>
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
          <div class="dashboard-shortcut-item" data-action="finance">
            <div class="dashboard-shortcut-icon purple">
              <i class="fa fa-line-chart"></i>
            </div>
            <div class="dashboard-shortcut-label">财务管理</div>
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
      this.latestStats = stats;

      document.getElementById('todayOrders').textContent = stats.todayOrders || 0;
      document.getElementById('pendingOrders').textContent = stats.pendingOrders || 0;
      document.getElementById('lowStockProducts').textContent = stats.lowStockProducts || 0;
      document.getElementById('totalCustomers').textContent = stats.totalCustomers || 0;

      const pendingTrendText = document.querySelector('.dashboard-stat-card[data-stat="pendingOrders"] .dashboard-stat-trend span');
      if (pendingTrendText) {
        pendingTrendText.textContent = stats.pendingOrders > 0 ? '待处理' : '无待发货';
      }

      const lowStockTrendText = document.querySelector('.dashboard-stat-card[data-stat="lowStockProducts"] .dashboard-stat-trend span');
      if (lowStockTrendText) {
        lowStockTrendText.textContent = stats.lowStockProducts > 0 ? '需补货' : '库存正常';
      }

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

      // 获取待处理订单
      const pendingOrders = await window.API.getOrders({ status: 'pending', limit: 5 });
      pendingOrders.forEach(order => {
        todos.push({
          type: 'warning',
          icon: 'fa-file-text-o',
          title: '待处理订单',
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
      const shippingOrders = await window.API.getOrders({ status: 'confirmed', limit: 5 });
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
    const page = document.getElementById('dashboardPage');
    if (!page) return;
    if (page.dataset.shortcutBound === '1') return;

    page.addEventListener('click', (event) => {
      const shortcutItem = event.target.closest('.dashboard-shortcut-item');
      if (shortcutItem && page.contains(shortcutItem)) {
        const action = shortcutItem.dataset.action;
        this.handleShortcut(action);
        return;
      }

      const statCard = event.target.closest('.dashboard-stat-card');
      if (!statCard || !page.contains(statCard)) return;
      const statType = statCard.dataset.stat;
      this.handleStatCard(statType);
    });

    page.dataset.shortcutBound = '1';
  },

  handleShortcut(action) {
    const actions = {
      newOrder: () => window.OrderModule.showCreateOrderModal(),
      inventory: () => window.Router.push('/inventory'),
      customers: () => window.Router.push('/customers'),
      products: () => window.Router.push('/products'),
      finance: () => window.Router.push('/finance')
    };

    const handler = actions[action];
    if (handler) {
      handler();
    }
  },

  handleStatCard(statType) {
    const stats = this.latestStats || {};
    const actions = {
      todayOrders: () => {
        if (!Number(stats.todayOrders || 0)) {
          window.Toast.info('当前日期暂无订单');
          return;
        }
        window.Router.push('/orders', { quick: 'today' });
      },
      pendingOrders: () => {
        if (!Number(stats.pendingOrders || 0)) {
          window.Toast.info('当前没有待发货订单');
          return;
        }
        window.Router.push('/orders', { quick: 'to_ship' });
      },
      lowStockProducts: () => {
        if (!Number(stats.lowStockProducts || 0)) {
          window.Toast.info('当前没有库存预警，无需补货');
          return;
        }
        window.Router.push('/inventory', { type: 'warning' });
      },
      totalCustomers: () => {
        if (!Number(stats.totalCustomers || 0)) {
          window.Toast.info('当前没有客户数据');
          return;
        }
        window.Router.push('/customers');
      }
    };

    const handler = actions[statType];
    if (handler) {
      handler();
    }
  }
};
