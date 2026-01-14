/**
 * 用户数据管理模块
 * 提供配置同步、收藏管理、提醒管理等功能
 */

import { supabaseClient, TABLES, safeQuery, safeInsert, safeUpdate, safeDelete } from './supabase-config.js';

/**
 * 用户数据管理类
 */
class UserDataManager {
  constructor() {
    this.isInitialized = false;
    this.isLoggedIn = false;
    this.user = null;
    this.isOnline = navigator.onLine;
    
    // 默认配置
    this.defaultConfig = {
      darkMode: false,
      hiddenCards: [],
      cardOrder: [],
      notificationPanelOpen: false,
      reminders: [],
      favorites: [],
      notifications: []
    };
    
    // 当前配置
    this.config = { ...this.defaultConfig };
    
    // 初始化
    this.init();
  }

  /**
   * 初始化用户数据管理器
   */
  async init() {
    if (this.isInitialized) {
      console.log('[UserData] 已初始化，跳过重复初始化');
      return;
    }

    this.isInitialized = true;
    
    // 监听网络状态
    this.setupNetworkListeners();
    
    // 检查用户登录状态
    await this.checkAuthStatus();
    
    // 加载用户配置
    await this.loadUserConfig();
    
    // 设置自动同步
    this.setupAutoSync();
    
    console.log('[UserData] 初始化完成');
  }

  /**
   * 设置网络状态监听
   */
  setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('[UserData] 网络已连接');
      this.showToast('网络已连接', 'success');
      
      // 网络恢复时同步数据
      if (this.isLoggedIn) {
        this.syncAllData();
      }
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('[UserData] 网络已断开');
      this.showToast('网络已断开，使用离线模式', 'warning');
    });
  }

  /**
   * 检查用户认证状态
   */
  async checkAuthStatus() {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      
      if (session?.user) {
        this.isLoggedIn = true;
        this.user = session.user;
        console.log('[UserData] 用户已登录:', this.user.email);
      } else {
        this.isLoggedIn = false;
        this.user = null;
        console.log('[UserData] 用户未登录');
      }
    } catch (error) {
      console.error('[UserData] 检查认证状态失败:', error);
      this.isLoggedIn = false;
      this.user = null;
    }
  }

  /**
   * 加载用户配置
   */
  async loadUserConfig() {
    try {
      if (!this.isLoggedIn) {
        // 未登录时从本地存储加载
        this.loadFromLocalStorage();
        return;
      }

      // 已登录时从数据库加载
      await this.loadFromDatabase();
    } catch (error) {
      console.error('[UserData] 加载用户配置失败:', error);
      this.loadFromLocalStorage(); // 降级到本地存储
    }
  }

  /**
   * 从本地存储加载配置
   */
  loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem('userConfig');
      if (saved) {
        const parsedConfig = this.sanitizeData(JSON.parse(saved));
        this.config = { ...this.defaultConfig, ...parsedConfig };
        console.log('[UserData] 已从本地存储加载配置:', this.config);
      }
    } catch (error) {
      console.error('[UserData] 从本地存储加载失败:', error);
    }
  }

  /**
   * 从数据库加载配置
   */
  async loadFromDatabase() {
    try {
      const data = await safeQuery(TABLES.USER_CONFIG, {
        column: 'user_id',
        value: this.user.id
      });
      
      if (data && data.length > 0) {
        const dbConfig = this.sanitizeData(data[0]);
        this.config = { ...this.defaultConfig, ...dbConfig };
        console.log('[UserData] 已从数据库加载配置:', this.config);
        
        // 同步到本地存储
        this.saveToLocalStorage();
      } else {
        console.log('[UserData] 数据库中无用户配置，使用默认配置');
        // 如果本地有数据则同步到数据库
        const localData = localStorage.getItem('userConfig');
        if (localData) {
          await this.saveToDatabase(this.sanitizeData(JSON.parse(localData)));
        }
      }
    } catch (error) {
      console.error('[UserData] 从数据库加载配置失败:', error);
    }
  }

  /**
   * 保存用户配置
   */
  async saveUserConfig() {
    try {
      this.config = this.sanitizeData(this.config);
      
      // 总是保存到本地存储
      this.saveToLocalStorage();
      
      // 如果已登录且在线，则同步到数据库
      if (this.isLoggedIn && this.isOnline) {
        await this.saveToDatabase();
      }
      
      console.log('[UserData] 用户配置已保存');
    } catch (error) {
      console.error('[UserData] 保存用户配置失败:', error);
    }
  }

  /**
   * 保存到本地存储
   */
  saveToLocalStorage() {
    try {
      localStorage.setItem('userConfig', JSON.stringify(this.config));
    } catch (error) {
      console.error('[UserData] 保存到本地存储失败:', error);
    }
  }

  /**
   * 保存到数据库
   */
  async saveToDatabase() {
    if (!this.user?.id) {
      console.warn('[UserData] 用户ID为空，跳过数据库保存');
      return;
    }

    try {
      const { error } = await supabaseClient
        .from(TABLES.USER_CONFIG)
        .upsert({
          user_id: this.user.id,
          dark_mode: this.config.darkMode,
          hidden_cards: this.config.hiddenCards,
          card_order: this.config.cardOrder,
          notification_panel_open: this.config.notificationPanelOpen,
          reminders: this.config.reminders,
          favorites: this.config.favorites,
          notifications: this.config.notifications,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });
      
      if (error) {
        console.error('[UserData] 保存到数据库失败:', error);
        return false;
      }
      
      console.log('[UserData] 配置已同步到数据库');
      return true;
    } catch (error) {
      console.error('[UserData] 保存到数据库异常:', error);
      return false;
    }
  }

  /**
   * 数据清理函数
   */
  sanitizeData(data) {
    if (!data || typeof data !== 'object') {
      return {};
    }
    
    const sanitized = {};
    
    // 清理字符串字段
    const stringFields = ['dark_mode', 'hidden_cards', 'card_order', 'notification_panel_open', 'reminders', 'favorites', 'notifications'];
    
    stringFields.forEach(field => {
      if (Array.isArray(data[field])) {
        sanitized[field] = data[field].filter(item => item !== null && item !== undefined);
      } else if (typeof data[field] === 'string') {
        sanitized[field] = data[field].trim();
      } else {
        sanitized[field] = data[field];
      }
    });
    
    // 清理数字字段
    const numberFields = ['updated_at'];
    numberFields.forEach(field => {
      if (typeof data[field] === 'number') {
        sanitized[field] = data[field];
      }
    });
    
    return { ...this.defaultConfig, ...sanitized };
  }

  /**
   * 设置自动同步
   */
  setupAutoSync() {
    // 网络状态变化时同步
    window.addEventListener('online', () => {
      if (this.isLoggedIn) {
        this.syncAllData();
      }
    });
    
    // 页面隐藏前保存数据
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && this.isLoggedIn) {
        this.saveUserConfig();
      }
    });
    
    // 页面卸载前保存数据
    window.addEventListener('beforeunload', () => {
      this.saveUserConfig();
    });
  }

  /**
   * 同步所有数据
   */
  async syncAllData() {
    if (!this.isOnline || !this.isLoggedIn) {
      console.log('[UserData] 离线或未登录，跳过同步');
      return;
    }

    try {
      console.log('[UserData] 开始同步所有数据');
      
      // 从本地加载最新配置
      this.loadFromLocalStorage();
      
      // 同步到数据库
      const success = await this.saveToDatabase();
      
      if (success) {
        console.log('[UserData] 数据同步完成');
        this.showToast('数据已同步到云端', 'success');
      } else {
        console.log('[UserData] 数据同步失败，保留本地数据');
        this.showToast('数据同步失败，已保存到本地', 'warning');
      }
    } catch (error) {
      console.error('[UserData] 同步数据异常:', error);
    }
  }

  /**
   * 设置暗黑模式
   */
  async setDarkMode(enabled) {
    this.config.darkMode = enabled;
    document.body.setAttribute('data-theme', enabled ? 'dark' : 'light');
    await this.saveUserConfig();
  }

  /**
   * 切换暗黑模式
   */
  toggleDarkMode() {
    const newMode = !this.config.darkMode;
    this.setDarkMode(newMode);
  }

  /**
   * 保存隐藏卡片
   */
  async setHiddenCards(cards) {
    this.config.hiddenCards = Array.isArray(cards) ? cards : [];
    await this.saveUserConfig();
  }

  /**
   * 添加隐藏卡片
   */
  async addHiddenCard(cardId) {
    if (!this.config.hiddenCards.includes(cardId)) {
      this.config.hiddenCards.push(cardId);
      await this.saveUserConfig();
    }
  }

  /**
   * 移除隐藏卡片
   */
  async removeHiddenCard(cardId) {
    this.config.hiddenCards = this.config.hiddenCards.filter(id => id !== cardId);
    await this.saveUserConfig();
  }

  /**
   * 获取隐藏卡片列表
   */
  getHiddenCards() {
    return this.config.hiddenCards;
  }

  /**
   * 保存卡片排序
   */
  async setCardOrder(order) {
    this.config.cardOrder = Array.isArray(order) ? order : [];
    await this.saveUserConfig();
  }

  /**
   * 保存收藏列表
   */
  async setFavorites(favorites) {
    this.config.favorites = Array.isArray(favorites) ? favorites : [];
    await this.saveUserConfig();
  }

  /**
   * 添加收藏
   */
  async addFavorite(favorite) {
    if (favorite && typeof favorite === 'object') {
      this.config.favorites.push(favorite);
      await this.saveUserConfig();
    }
  }

  /**
   * 删除收藏
   */
  async removeFavorite(favoriteId) {
    this.config.favorites = this.config.favorites.filter(fav => fav.id !== favoriteId);
    await this.saveUserConfig();
  }

  /**
   * 获取收藏列表
   */
  getFavorites() {
    return this.config.favorites;
  }

  /**
   * 保存提醒列表
   */
  async setReminders(reminders) {
    this.config.reminders = Array.isArray(reminders) ? reminders : [];
    await this.saveUserConfig();
  }

  /**
   * 添加提醒
   */
  async addReminder(reminder) {
    if (reminder && typeof reminder === 'object') {
      this.config.reminders.push(reminder);
      await this.saveUserConfig();
    }
  }

  /**
   * 更新提醒
   */
  async updateReminder(reminderId, updates) {
    const index = this.config.reminders.findIndex(rem => rem.id === reminderId);
    if (index !== -1) {
      this.config.reminders[index] = { ...this.config.reminders[index], ...updates };
      await this.saveUserConfig();
    }
  }

  /**
   * 删除提醒
   */
  async removeReminder(reminderId) {
    this.config.reminders = this.config.reminders.filter(rem => rem.id !== reminderId);
    await this.saveUserConfig();
  }

  /**
   * 获取提醒列表
   */
  getReminders() {
    return this.config.reminders;
  }

  /**
   * 保存通知面板状态
   */
  async setNotificationPanelOpen(isOpen) {
    this.config.notificationPanelOpen = isOpen;
    await this.saveUserConfig();
  }

  /**
   * 获取通知面板状态
   */
  getNotificationPanelOpen() {
    return this.config.notificationPanelOpen;
  }

  /**
   * 显示Toast消息
   */
  showToast(message, type = 'info', duration = 3000) {
    // 这个函数由主模块实现
    if (typeof window.showToast === 'function') {
      window.showToast(message, type, duration);
    }
  }

  /**
   * 获取当前用户ID
   */
  getUserId() {
    return this.user?.id || null;
  }

  /**
   * 获取用户邮箱
   */
  getUserEmail() {
    return this.user?.email || null;
  }

  /**
   * 检查是否为VIP用户
   */
  isVIPUser() {
    // 可以根据需要添加VIP用户判断逻辑
    return false;
  }

  /**
   * 获取用户统计信息
   */
  getUserStats() {
    return {
      favoritesCount: this.config.favorites.length,
      remindersCount: this.config.reminders.length,
      hiddenCardsCount: this.config.hiddenCards.length,
      lastLoginTime: localStorage.getItem('lastLoginTime'),
      isOnline: this.isOnline,
      isVIP: this.isVIPUser()
    };
  }

  /**
   * 导出用户数据
   */
  exportUserData() {
    const exportData = {
      user: {
        id: this.user?.id,
        email: this.user?.email,
        created_at: this.user?.created_at
      },
      config: this.config,
      exportTime: new Date().toISOString(),
      version: '2.0.0'
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `user_data_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.showToast('用户数据已导出', 'success');
  }

  /**
   * 导入用户数据
   */
  async importUserData(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (data.config) {
        this.config = this.sanitizeData(data.config);
        await this.saveUserConfig();
        this.showToast('用户数据已导入', 'success');
        
        // 刷新页面以应用新配置
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        this.showToast('无效的数据文件格式', 'error');
      }
    } catch (error) {
      console.error('[UserData] 导入数据失败:', error);
      this.showToast('导入数据失败', 'error');
    }
  }

  /**
   * 清除用户数据
   */
  async clearUserData() {
    this.config = { ...this.defaultConfig };
    await this.saveUserConfig();
    this.showToast('用户数据已清除', 'info');
  }
}

// 创建单例实例
const userDataManager = new UserDataManager();

// 导出实例和类
export default userDataManager;
export { UserDataManager };