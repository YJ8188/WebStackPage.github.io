/**
 * 移动端ERP - 应用初始化
 * 负责: 设备检测、用户认证、全局配置、事件总线
 */

class EventBus {
  constructor() {
    this.events = {};
  }

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(cb => cb !== callback);
  }

  emit(event, data) {
    if (!this.events[event]) return;
    this.events[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`事件处理错误 [${event}]:`, error);
      }
    });
  }

  once(event, callback) {
    const wrapper = (data) => {
      callback(data);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }
}

class MobileERPApp {
  constructor() {
    this.config = {
      appName: '何哥ERP移动版',
      version: '1.0.0',
      debug: window.__DEBUG_MODE__ || false
    };

    this.state = {
      isAuthenticated: false,
      currentUser: null,
      currentPage: 'dashboard',
      isOnline: navigator.onLine,
      isReady: false
    };

    this.eventBus = new EventBus();
    this.init();
  }

  getAuthClient() {
    const client = window.supabaseClient || window.supabase;
    if (client && client.auth) {
      return client;
    }
    return null;
  }

  async init() {
    this.log('初始化移动端ERP应用...');

    this.detectDevice();
    await this.checkAuth();
    this.initAuthListener();
    this.initNetworkListener();
    this.initViewport();

    this.state.isReady = true;
    this.eventBus.emit('app:ready');
    this.log('应用初始化完成');
  }

  onReady(callback) {
    if (typeof callback !== 'function') {
      return () => {};
    }
    if (this.state.isReady) {
      Promise.resolve().then(() => callback());
      return () => {};
    }
    return this.eventBus.on('app:ready', callback);
  }

  detectDevice() {
    const ua = navigator.userAgent;
    const device = {
      isIOS: /iPhone|iPad|iPod/.test(ua),
      isAndroid: /Android/.test(ua),
      isWechat: /MicroMessenger/.test(ua),
      isMobile: /Mobile/.test(ua),
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      pixelRatio: window.devicePixelRatio || 1
    };

    this.device = device;
    this.log('设备信息:', device);

    if (device.isIOS) document.body.classList.add('ios');
    if (device.isAndroid) document.body.classList.add('android');
    if (device.isWechat) document.body.classList.add('wechat');
  }

  async checkAuth() {
    try {
      const authClient = this.getAuthClient();
      if (!authClient) {
        this.log('Supabase客户端未加载');
        return false;
      }

      const { data: { session }, error } = await authClient.auth.getSession();
      if (error) {
        throw error;
      }

      if (session) {
        this.state.isAuthenticated = true;
        this.state.currentUser = session.user;
        this.log('用户已登录:', session.user.email);
        return true;
      }

      this.log('用户未登录');
      return false;
    } catch (error) {
      this.log('认证检查失败:', error);
      return false;
    }
  }

  initNetworkListener() {
    window.addEventListener('online', () => {
      this.state.isOnline = true;
      this.eventBus.emit('network:online');
      this.log('网络已连接');
    });

    window.addEventListener('offline', () => {
      this.state.isOnline = false;
      this.eventBus.emit('network:offline');
      this.log('网络已断开');
    });
  }

  initAuthListener() {
    const authClient = this.getAuthClient();
    if (!authClient || !authClient.auth || typeof authClient.auth.onAuthStateChange !== 'function') {
      return;
    }

    authClient.auth.onAuthStateChange((_event, session) => {
      this.state.isAuthenticated = !!session;
      this.state.currentUser = session?.user || null;
      this.eventBus.emit('auth:changed', {
        isAuthenticated: this.state.isAuthenticated,
        currentUser: this.state.currentUser
      });
    });
  }

  initViewport() {
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    }, false);

    document.addEventListener('contextmenu', (e) => {
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
      }
    });

    window.addEventListener('orientationchange', () => {
      this.log('屏幕方向改变:', window.orientation);
      this.eventBus.emit('viewport:orientationchange');
    });
  }

  log(...args) {
    if (this.config.debug) {
      console.log('[MobileERP]', ...args);
    }
  }

  getCurrentUser() {
    return this.state.currentUser;
  }

  isAuthenticated() {
    return this.state.isAuthenticated;
  }

  isOnline() {
    return this.state.isOnline;
  }

  isReady() {
    return this.state.isReady;
  }

  setCurrentPage(page) {
    this.state.currentPage = page;
    this.eventBus.emit('page:change', page);
  }

  getCurrentPage() {
    return this.state.currentPage;
  }
}

window.MobileERP = new MobileERPApp();
window.EventBus = window.MobileERP.eventBus;
