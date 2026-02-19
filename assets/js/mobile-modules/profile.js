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
          <div class="profile-menu-title">数据统计</div>
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
            <div class="list-item" id="profileExportBtn">
              <div class="list-item-icon" style="background-color: #f6ffed;">
                <i class="fa fa-download" style="color: #52c41a;"></i>
              </div>
              <div class="list-item-content">
                <div class="list-item-title">数据导出</div>
                <div class="list-item-desc">导出订单、客户等数据</div>
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
      window.Toast.info('数据报表功能开发中');
    });

    // 数据导出
    document.getElementById('profileExportBtn')?.addEventListener('click', () => {
      window.Toast.info('数据导出功能开发中');
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

