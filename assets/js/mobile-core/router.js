/**
 * 移动端ERP - 路由管理
 * 负责: Hash路由、页面切换、历史记录
 */

class Router {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.history = [];
    this.beforeHooks = [];
    this.afterHooks = [];

    this.init();
  }

  init() {
    // 监听hash变化
    window.addEventListener('hashchange', () => {
      this.handleRouteChange();
    });

    // 监听浏览器后退
    window.addEventListener('popstate', () => {
      this.handleRouteChange();
    });

    // 初始路由
    this.handleRouteChange();
  }

  // 注册路由
  register(path, handler) {
    this.routes.set(path, handler);
    return this;
  }

  // 批量注册路由
  registerRoutes(routes) {
    Object.entries(routes).forEach(([path, handler]) => {
      this.register(path, handler);
    });
    if (!this.currentRoute) {
      this.handleRouteChange();
    }
    return this;
  }

  // 导航到指定路由
  push(path, params = {}) {
    const url = this.buildUrl(path, params);
    window.location.hash = url;
  }

  // 替换当前路由
  replace(path, params = {}) {
    const url = this.buildUrl(path, params);
    window.location.replace(`#${url}`);
  }

  // 返回上一页
  back() {
    if (this.history.length > 1) {
      window.history.back();
    } else {
      this.push('/dashboard');
    }
  }

  // 构建URL
  buildUrl(path, params = {}) {
    const query = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    return query ? `${path}?${query}` : path;
  }

  // 解析当前路由
  parseRoute() {
    const hash = window.location.hash.slice(1) || '/dashboard';
    const [path, queryString] = hash.split('?');
    const params = {};

    if (queryString) {
      queryString.split('&').forEach(pair => {
        const [key, value] = pair.split('=');
        params[key] = decodeURIComponent(value);
      });
    }

    return { path, params };
  }

  // 处理路由变化
  async handleRouteChange() {
    const route = this.parseRoute();
    const handler = this.routes.get(route.path);

    if (!handler) {
      if (this.routes.size === 0) {
        return;
      }
      console.warn(`路由未找到: ${route.path}`);
      this.push('/dashboard');
      return;
    }

    // 执行前置钩子
    for (const hook of this.beforeHooks) {
      const result = await hook(route, this.currentRoute);
      if (result === false) {
        return; // 阻止导航
      }
    }

    // 隐藏所有页面
    document.querySelectorAll('.mobile-page').forEach(page => {
      page.classList.add('hidden');
    });

    // 执行路由处理器
    try {
      await handler(route.params);

      // 更新当前路由
      this.currentRoute = route;
      this.history.push(route);

      // 执行后置钩子
      this.afterHooks.forEach(hook => hook(route));

      // 滚动到顶部
      window.scrollTo(0, 0);

    } catch (error) {
      console.error('路由处理失败:', error);
      window.Toast?.show('页面加载失败', 'error');
    }
  }

  // 注册前置钩子
  beforeEach(hook) {
    this.beforeHooks.push(hook);
    return this;
  }

  // 注册后置钩子
  afterEach(hook) {
    this.afterHooks.push(hook);
    return this;
  }

  // 获取当前路由
  getCurrentRoute() {
    return this.currentRoute;
  }
}

// 导出全局实例
window.Router = new Router();
