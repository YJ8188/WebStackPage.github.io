/**
 * 主应用模块
 * 整合所有功能模块的入口点
 */

// 导入依赖模块
import { userDataManager } from './user-data.js';
import { cardManager } from './card-manager.js';
import { notificationManager } from './notification-manager.js';
import { favoriteManager } from './favorite-manager.js';
import { searchManager } from './search-manager.js';
import { uiManager } from './ui-manager.js';
import { securityManager } from './security.js';

/**
 * 主应用类
 */
class App {
  constructor() {
    this.isInitialized = false;
    this.modules = new Map();
    this.isOnline = navigator.onLine;
    
    // 绑定上下文
    this.bindGlobalMethods();
    
    // 初始化
    this.init();
  }

  /**
   * 绑定全局方法
   */
  bindGlobalMethods() {
    // 将主要方法绑定到全局对象
    window.app = {
      // 用户相关
      toggleDarkMode: this.toggleDarkMode.bind(this),
      showToast: this.showToast.bind(this),
      showConfirm: this.showConfirm.bind(this),
      showLoading: this.showLoading.bind(this),
      hideLoading: this.hideLoading.bind(this),
      
      // 卡片相关
      toggleCardVisibility: cardManager.toggleCardVisibility.bind(cardManager),
      toggleHiddenPanel: cardManager.toggleHiddenPanel.bind(cardManager),
      restoreAllCards: cardManager.restoreAllCards.bind(cardManager),
      
      // 收藏相关
      addFavorite: favoriteManager.addFavorite.bind(favoriteManager),
      removeFavorite: favoriteManager.removeFavorite.bind(favoriteManager),
      
      // 通知相关
      addReminder: notificationManager.addReminder.bind(notificationManager),
      deleteReminder: notificationManager.deleteReminder.bind(notificationManager),
      toggleNotificationCenter: notificationManager.toggleNotificationCenter.bind(notificationManager),
      
      // 搜索相关
      performSearch: searchManager.performSearch.bind(searchManager),
      clearSearch: searchManager.clearSearch.bind(searchManager),
      changeSearchEngine: searchManager.changeSearchEngine.bind(searchManager),
      
      // UI相关
      toggleSidebar: uiManager.toggleSidebar.bind(uiManager),
      scrollToTop: uiManager.scrollToTop.bind(uiManager),
      
      // 数据相关
      exportData: this.exportData.bind(this),
      importData: this.importData.bind(this),
      
      // 调试相关
      debug: this.debug.bind(this)
    };
    
    console.log('[App] 全局方法已绑定');
  }

  /**
   * 初始化应用
   */
  async init() {
    if (this.isInitialized) {
      console.log('[App] 应用已初始化，跳过重复初始化');
      return;
    }

    try {
      this.isInitialized = true;
      console.log('[App] 开始初始化应用');
      
      // 设置网络状态监听
      this.setupNetworkListeners();
      
      // 初始化安全模块
      this.initSecurity();
      
      // 初始化UI模块
      this.initUI();
      
      // 等待所有模块加载完成
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', async () => {
          await this.initializeModules();
          this.setupEventListeners();
          this.checkUserStatus();
        });
      } else {
        await this.initializeModules();
        this.setupEventListeners();
        this.checkUserStatus();
      }
      
      console.log('[App] 应用初始化完成');
      
      // 显示欢迎消息
      this.showWelcomeMessage();
      
    } catch (error) {
      console.error('[App] 应用初始化失败:', error);
      this.showToast('应用初始化失败', 'error');
    }
  }

  /**
   * 初始化安全模块
   */
  initSecurity() {
    try {
      securityManager.init();
      console.log('[App] 安全模块已初始化');
    } catch (error) {
      console.error('[App] 安全模块初始化失败:', error);
    }
  }

  /**
   * 初始化UI模块
   */
  initUI() {
    try {
      uiManager.init();
      console.log('[App] UI模块已初始化');
    } catch (error) {
      console.error('[   UI模块初始化失败:', error);
    }
  }

  /**
   * 初始化所有模块
   */
  async initializeModules() {
    console.log('[App] 开始初始化模块');
    
    // 并行初始化所有模块
    const modulePromises = [
      Promise.resolve().then(() => cardManager.init()),
      Promise.resolve().then(() => notificationManager.init()),
      Promise.resolve().then(() => favoriteManager.init()),
      Promise.resolve().then(() => searchManager.init()),
      Promise.resolve().then(() => userDataManager.init())
    ];
    
    await Promise.all(modulePromises);
    
    console.log('[App] 所有模块初始化完成');
  }

  /**
   * 设置网络状态监听
   */
  setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.showToast('网络连接已恢复', 'success');
      
      // 网络恢复时同步数据
      if (userDataManager.isLoggedIn) {
        userDataManager.syncAllData();
      }
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.showToast('网络连接已断开', 'warning');
    });
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 监听页面可见性变化
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('[App] 页面变为可见');
        this.checkUserStatus();
      }
    });
    
    // 监听页面卸载
    window.addEventListener('beforeunload', () => {
      console.log('[App] 页面即将卸载');
      this.cleanup();
    });
    
    // 监听错误事件
    window.addEventListener('error', (event) => {
      console.error('[App] 页面错误:', event.error);
      this.handleGlobalError(event);
    });
  }

  /**
   * 检查用户状态
   */
  checkUserStatus() {
    try {
      const user = userDataManager.user;
      
      if (user) {
        console.log(`[App] 当前用户: ${user.email}`);
        
        // 更新UI显示
        this.updateUserUI(user);
        
        // 触发用户数据加载事件
        this.dispatchUserDataLoaded();
      } else {
        console.log('[App] 用户未登录');
        
        // 重置UI显示
        this.updateUserUI(null);
      }
    } catch (error) {
      console.error('[App] 检查用户状态失败:', error);
    }
  }

  /**
   * 更新用户UI
   */
  updateUserUI(user) {
    const loginBtn = document.getElementById('loginBtn');
    const loginText = document.getElementById('loginText');
    
    if (!loginBtn || !loginText) return;
    
    if (user) {
      loginBtn.href = 'javascript:void(0)';
      loginText.textContent = user.email || '个人中心';
      loginBtn.title = '个人中心';
    } else {
      loginBtn.href = 'login.html';
      loginText.textContent = '登录';
      loginBtn.title = '登录';
    }
  }

  /**
   * 触发用户数据加载事件
   */
  dispatchUserDataLoaded() {
    const event = new CustomEvent('userDataLoaded', {
      detail: {
        user: userDataManager.user,
        config: userDataManager.config
      }
    });
    
    document.dispatchEvent(event);
    console.log('[App] 已触发 userDataLoaded 事件');
  }

  /**
   * 显示欢迎消息
   */
  showWelcomeMessage() {
    const hour = new Date().getHours();
    let greeting = '早上好';
    
    if (hour >= 6 && hour < 12) {
      greeting = '早上好';
    } else if (hour >= 12 && hour < 18) {
      greeting = '下午好';
    } else {
      greeting = '晚上好';
    }
    
    // 随机选择欢迎消息
    const messages = [
      `${greeting}！欢迎使用何哥导航系统`,
      `${greeting}！今天是个美好的一天！`,
      `${greeting}！欢迎回来！`,
      '欢迎使用何哥技术员网址导航'
    ];
    
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    
    setTimeout(() => {
      this.showToast(randomMessage, 'success', 5000);
    }, 1000);
  }

  /**
   * 切换暗黑模式
   */
  async toggleDarkMode() {
    try {
      await userDataManager.toggleDarkMode();
      this.updateTheme();
    } catch (error) {
      console.error('[App] 切换暗黑模式失败:', error);
    }
  }

  /**
   * 更新主题
   */
  updateTheme() {
    const isDarkMode = userDataManager.config.darkMode;
    const body = document.body;
    const darkModeIcon = document.getElementById('darkModeIcon');
    const darkModeIconDesktop = document.getElementById('darkModeIconDesktop');
    
    // 更新data-theme属性
    body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    
    // 更新图标
    if (darkModeIcon) {
      darkModeIcon.className = isDarkMode ? 'fa fa-sun-o' : 'fa fa-moon-o';
    }
    
    if (darkModeIconDesktop) {
      darkModeIconDesktop.className = isDarkMode ? 'fa fa-sun-o' : 'fa fa-moon-o';
    }
    
    // 保存主题偏好
    localStorage.setItem('darkMode', isDarkMode);
    
    console.log(`[App] 主题已切换到: ${isDarkMode ? '暗黑' : '亮色'}模式`);
  }

  /**
   * 显示Toast消息
   */
  showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    
    if (!container) {
      console.warn('[App] Toast容器未找到');
      return;
    }
    
    // 创建Toast元素
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${this.getToastIcon(type)}</div>
      <div class="toast-message">${this.escapeHtml(message)}</div>
    `;
    
    container.appendChild(toast);
    
    // 添加动画类
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
    
    // 自动隐藏
    setTimeout(() => {
      toast.classList.remove('show');
      toast.classList.add('hide');
      
      setTimeout(() => {
        if (container.contains(toast)) {
          container.removeChild(toast);
        }
      }, 300);
    }, duration);
  }

  /**
   * 获取Toast图标
   */
  getToastIcon(type) {
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ',
      primary: '★',
      secondary: '○'
    };
    
    return icons[type] || icons.info;
  }

  /**
   * 转义HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 显示确认对话框
   */
  async showConfirm(message) {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirmModal');
      const titleElement = document.getElementById('modalTitle');
      const messageElement = document.getElementById('modalMessage');
      const confirmBtn = document.getElementById('modalConfirm');
      const cancelBtn = document.getElementById('modalCancel');
      
      if (!modal || !titleElement || !messageElement || !confirmBtn || !cancelBtn) {
        return false;
      }
      
      titleElement.textContent = '确认操作';
      messageElement.textContent = message;
      
      modal.style.display = 'flex';
      
      const handleConfirm = () => {
        modal.style.display = 'none';
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        resolve(true);
      };
      
      const handleCancel = () => {
        modal.style.display = 'none';
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        resolve(false);
      };
      
      confirmBtn.addEventListener('click', handleConfirm);
      cancelBtn.addEventListener('click', handleCancel);
    });
  }

  /**
   * 显示加载状态
   */
  showLoading(message = '加载中...') {
    const container = document.getElementById('toastContainer');
    
    if (!container) return;
    
    const loading = document.createElement('div');
    loading.className = 'toast loading-toast';
    loading.innerHTML = `
      <div class="spinner-border spinner-border-sm"></div>
      <div class="toast-message">${this.escapeHtml(message)}</div>
    `;
    
    container.appendChild(loading);
    
    // 添加动画
    requestAnimationFrame(() => {
      loading.classList.add('show');
    });
  }

  /**
   * 隐藏加载状态
   */
  hideLoading() {
    const container = container = document.getElementById('toastContainer');
    
    if (container) {
      const loading = container.querySelector('.loading-toast');
      if (loading) {
        loading.classList.remove('show');
        
        setTimeout(() => {
          if (container.contains(loading)) {
            container.removeChild(loading);
          }
        }, 300);
      }
    }
  }

  /**
   * 导出数据
   */
  async exportData() {
    try {
      userDataManager.exportUserData();
    } catch (error) {
      console.error('[App] 导出数据失败:', error);
      this.showToast('导出失败', 'error');
    }
  }

  /**
   * 导入数据
   */
  async importData(file) {
    try {
      userDataManager.importUserData(file);
    } catch (error) {
      console.error('[App] 导入数据失败:', error);
      this.showToast('导入失败', 'error');
    }
  }

  /**
   * 处理全局错误
   */
  handleGlobalError(event) {
    console.error('[App] 全局错误:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    });
    
    this.showToast('发生错误，请检查控制台', 'error');
  }

  /**
   * 调试信息
   */
  debug(info) {
    if (import.meta.env.DEV_MODE === 'true') {
      console.log(`[App Debug] ${info}`);
    }
  }

  /**
   * 清理资源
   */
  cleanup() {
    // 清理事件监听器
    // 由于使用了模块化架构，大部分清理工作会在各模块内部完成
    
    // 保存状态
    if (this.isOnline) {
      userDataManager.saveUserConfig();
    }
    
    this.isInitialized = false;
  }

  /**
   * 获取应用状态
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      online: this.isOnline,
      user: userDataManager.user,
      config: userDataManager.config,
      modules: {
        cardManager: cardManager.getStatus(),
        notificationManager: notificationManager.getStatus(),
        searchManager: searchManager.getStatus()
      }
    };
  }
}

// 创建应用实例
const app = new App();

// DOM加载完成后自动初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // 应用已经通过DOMContentLoaded事件监听器自动初始化
  });
} else {
  // 如果DOM已经加载完成，直接初始化
  app.init();
}

// 导出应用实例
export default app;
export { App };