/**
 * 移动端ERP - 个人中心模块
 */

window.ProfileModule = {
  name: 'profile',
  user: null,

  async init() {
    await this.loadUserInfo();
    this.render();
    this.bindEvents();
  },

  async loadUserInfo() {
    try {
      this.user = MobileERP.getCurrentUser();
    } catch (error) {
      console.error('加载用户信息失败:', error);
    }
  },

  safeNumber(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  },

  parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  },

  isWithinDays(value, days = 1) {
    const date = this.parseDate(value);
    if (!date) return false;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const from = new Date(start);
    from.setDate(start.getDate() - Math.max(0, Number(days || 0) - 1));
    return date.getTime() >= from.getTime() && date.getTime() <= now.getTime();
  },

  async showStatsReport() {
    try {
      window.Loading.show('生成经营报表...');

      const [stats, orders, finances] = await Promise.all([
        window.API.getDashboardStats(),
        window.API.getOrders({ limit: 500, offset: 0 }),
        window.API.getFinanceRecords({ limit: 500, offset: 0 })
      ]);

      const orderRows = Array.isArray(orders) ? orders : [];
      const financeRows = Array.isArray(finances) ? finances : [];
      const completedStatuses = new Set(['completed', 'signed', 'delivered']);

      const orders7d = orderRows.filter(item => this.isWithinDays(item?.order_date || item?.created_at, 7));
      const orders30d = orderRows.filter(item => this.isWithinDays(item?.order_date || item?.created_at, 30));
      const completed30d = orders30d.filter(item => completedStatuses.has(String(item?.status || '').toLowerCase()));
      const sales30d = completed30d.reduce((sum, item) => sum + this.safeNumber(item?.total_amount), 0);

      const finance30d = financeRows.filter(item => this.isWithinDays(item?.transaction_date || item?.created_at, 30));
      const income30d = finance30d
        .filter(item => String(item?.type || '').toLowerCase() === 'income')
        .reduce((sum, item) => sum + Math.abs(this.safeNumber(item?.amount)), 0);
      const expense30d = finance30d
        .filter(item => String(item?.type || '').toLowerCase() === 'expense')
        .reduce((sum, item) => sum + Math.abs(this.safeNumber(item?.amount)), 0);
      const profit30d = income30d - expense30d;

      window.Loading.hide();

      await window.Modal.show({
        title: '经营数据报表',
        confirmText: '查看财务',
        cancelText: '关闭',
        content: `
          <div style="text-align:left;">
            <div style="padding:10px;border:1px solid #dbeafe;border-radius:10px;background:#eff6ff;margin-bottom:10px;">
              <div style="font-size:12px;color:#1d4ed8;margin-bottom:6px;">核心指标</div>
              <div style="font-size:13px;line-height:1.8;color:#1f2937;">
                <div>今日订单：<strong>${this.safeNumber(stats?.todayOrders)}</strong></div>
                <div>待发货：<strong>${this.safeNumber(stats?.pendingOrders)}</strong></div>
                <div>库存预警：<strong>${this.safeNumber(stats?.lowStockProducts)}</strong></div>
                <div>客户总数：<strong>${this.safeNumber(stats?.totalCustomers)}</strong></div>
              </div>
            </div>
            <div style="padding:10px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;">
              <div style="font-size:12px;color:#64748b;margin-bottom:6px;">近30天经营</div>
              <div style="font-size:13px;line-height:1.8;color:#1f2937;">
                <div>订单数：<strong>${orders30d.length}</strong>（近7天：${orders7d.length}）</div>
                <div>已完成订单：<strong>${completed30d.length}</strong></div>
                <div>销售额：<strong>${window.Utils.formatMoney(sales30d)}</strong></div>
                <div>收入：<strong style="color:#16a34a;">${window.Utils.formatMoney(income30d)}</strong></div>
                <div>支出：<strong style="color:#dc2626;">${window.Utils.formatMoney(expense30d)}</strong></div>
                <div>利润：<strong style="color:${profit30d >= 0 ? '#16a34a' : '#dc2626'};">${window.Utils.formatMoney(profit30d)}</strong></div>
              </div>
            </div>
          </div>
        `,
        onConfirm: async () => {
          window.Router.push('/finance');
          return true;
        }
      });
    } catch (error) {
      window.Loading.hide();
      console.error('生成数据报表失败:', error);
      window.Toast.error(error?.message || '生成报表失败');
    }
  },

  render() {
    const container = document.getElementById('profileContent');
    if (!container) return;

    const email = this.user?.email || '未登录';
    const initial = email.charAt(0).toUpperCase();

    container.innerHTML = `
      <!-- 用户信息 -->
      <div class="profile-header">
        <div class="profile-avatar">${initial}</div>
        <div class="profile-name">${email}</div>
        <div class="profile-role">管理员</div>
      </div>

      <!-- 功能菜单 -->
      <div class="profile-menu">
        <div class="profile-menu-section">
          <div class="profile-menu-title">工作区</div>
          <div class="list">
            <div class="list-item" id="profileStatsBtn">
              <div class="list-item-icon" style="background-color: #e6f7ff;">
                <i class="fa fa-bar-chart" style="color: #1890ff;"></i>
              </div>
              <div class="list-item-content">
                <div class="list-item-title">数据报表</div>
                <div class="list-item-desc">查看经营数据分析</div>
              </div>
              <i class="fa fa-angle-right list-item-arrow"></i>
            </div>
          </div>
        </div>

        <div class="profile-menu-section">
          <div class="profile-menu-title">系统设置</div>
          <div class="list">
            <div class="list-item" id="profileNotificationBtn">
              <div class="list-item-icon" style="background-color: #fff7e6;">
                <i class="fa fa-bell-o" style="color: #faad14;"></i>
              </div>
              <div class="list-item-content">
                <div class="list-item-title">消息通知</div>
                <div class="list-item-desc">管理通知设置</div>
              </div>
              <i class="fa fa-angle-right list-item-arrow"></i>
            </div>
            <div class="list-item" id="profileCacheBtn">
              <div class="list-item-icon" style="background-color: #fff1f0;">
                <i class="fa fa-trash-o" style="color: #f5222d;"></i>
              </div>
              <div class="list-item-content">
                <div class="list-item-title">清除缓存</div>
                <div class="list-item-desc">清除本地缓存数据</div>
              </div>
              <i class="fa fa-angle-right list-item-arrow"></i>
            </div>
          </div>
        </div>

        <div class="profile-menu-section">
          <div class="profile-menu-title">关于</div>
          <div class="list">
            <div class="list-item" id="profileAboutBtn">
              <div class="list-item-icon" style="background-color: #f0f0f0;">
                <i class="fa fa-info-circle" style="color: #8c8c8c;"></i>
              </div>
              <div class="list-item-content">
                <div class="list-item-title">关于我们</div>
                <div class="list-item-desc">版本 1.0.0</div>
              </div>
              <i class="fa fa-angle-right list-item-arrow"></i>
            </div>
          </div>
        </div>
      </div>

      <!-- 退出登录 -->
      <div class="profile-logout">
        <button class="btn btn-error btn-block btn-lg" id="logoutBtn">
          <i class="fa fa-sign-out"></i> 退出登录
        </button>
      </div>
    `;
  },

  bindEvents() {
    // 数据报表
    document.getElementById('profileStatsBtn')?.addEventListener('click', () => {
      this.showStatsReport();
    });

    // 消息通知
    document.getElementById('profileNotificationBtn')?.addEventListener('click', () => {
      window.Toast.info('消息通知功能开发中');
    });

    // 清除缓存
    document.getElementById('profileCacheBtn')?.addEventListener('click', async () => {
      const confirmed = await window.Modal.confirm('确认清除所有本地缓存？', '清除缓存');
      if (!confirmed) return;

      try {
        await window.Storage.clearCache();
        window.Storage.clear();
        window.Toast.success('缓存已清除');
      } catch (error) {
        console.error('清除缓存失败:', error);
        window.Toast.error('清除缓存失败');
      }
    });

    // 关于我们
    document.getElementById('profileAboutBtn')?.addEventListener('click', () => {
      window.Modal.alert(
        '何哥ERP移动版 v1.0.0<br><br>一个轻量级的移动端ERP系统，支持订单、客户、产品、库存、财务管理。',
        '关于我们'
      );
    });

    // 退出登录
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
      const confirmed = await window.Modal.confirm('确认退出登录？', '退出登录');
      if (!confirmed) return;

      try {
        const authClient = window.supabaseClient || window.supabase;
        if (!authClient || !authClient.auth) {
          throw new Error('认证服务未初始化');
        }
        await authClient.auth.signOut();
        window.Toast.success('已退出登录');
        setTimeout(() => {
          window.location.href = 'mobile-login-simple.html';
        }, 1000);
      } catch (error) {
        console.error('退出登录失败:', error);
        window.Toast.error('退出登录失败');
      }
    });
  }
};
