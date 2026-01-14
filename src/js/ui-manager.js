/**
 * UI管理模块
 * 负责界面交互、主题切换、响应式布局等UI相关功能
 */
export class UIManager {
  constructor(notificationManager) {
    this.notificationManager = notificationManager;
    this.currentTheme = 'light';
    this.isDarkMode = false;
    this.isMobile = false;
    this.isTablet = false;
    this.sidebarOpen = false;
    this.modals = new Map();
    this.components = new Map();
    this.resizeTimer = null;
    
    this.init();
  }

  /**
   * 初始化UI管理器
   */
  init() {
    this.detectDevice();
    this.loadTheme();
    this.setupEventListeners();
    this.initComponents();
    this.setupResponsiveHandlers();
    console.log('UI管理器初始化完成');
  }

  /**
   * 检测设备类型
   */
  detectDevice() {
    const width = window.innerWidth;
    
    // 移动端检测
    this.isMobile = width <= 768;
    this.isTablet = width > 768 && width <= 1024;
    
    // 添加设备类名到body
    document.body.classList.toggle('mobile', this.isMobile);
    document.body.classList.toggle('tablet', this.isTablet);
    document.body.classList.toggle('desktop', !this.isMobile && !this.isTablet);
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 窗口大小变化
    window.addEventListener('resize', () => {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => {
        this.handleResize();
      }, 250);
    });

    // 主题切换
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('theme-toggle') || 
          e.target.closest('.theme-toggle')) {
        e.preventDefault();
        this.toggleTheme();
      }
    });

    // 侧边栏切换
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('sidebar-toggle') || 
          e.target.closest('.sidebar-toggle')) {
        e.preventDefault();
        this.toggleSidebar();
      }
    });

    // 模态框关闭
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-backdrop')) {
        this.closeAllModals();
      }
      
      if (e.target.classList.contains('modal-close') || 
          e.target.closest('.modal-close')) {
        e.preventDefault();
        const modal = e.target.closest('.modal');
        if (modal) {
          this.closeModal(modal.id);
        }
      }
    });

    // 键盘事件
    document.addEventListener('keydown', (e) => {
      this.handleKeyboard(e);
    });

    // 滚动事件
    window.addEventListener('scroll', () => {
      this.handleScroll();
    });

    // 在线/离线状态
    window.addEventListener('online', () => {
      this.showOnlineStatus();
    });

    window.addEventListener('offline', () => {
      this.showOfflineStatus();
    });

    // 点击外部关闭下拉菜单
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.dropdown')) {
        this.closeAllDropdowns();
      }
    });
  }

  /**
   * 初始化组件
   */
  initComponents() {
    // 初始化工具提示
    this.initTooltips();
    
    // 初始化下拉菜单
    this.initDropdowns();
    
    // 初始化折叠组件
    this.initCollapses();
    
    // 初始化返回顶部按钮
    this.initBackToTop();
    
    // 初始化加载指示器
    this.initLoadingIndicators();
    
    // 初始化进度条
    this.initProgressBars();
  }

  /**
   * 设置响应式处理器
   */
  setupResponsiveHandlers() {
    // 处理移动端导航
    this.setupMobileNavigation();
    
    // 处理触摸事件
    this.setupTouchEvents();
    
    // 处理图片懒加载
    this.setupLazyLoading();
  }

  /**
   * 加载主题设置
   */
  loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    this.currentTheme = savedTheme;
    this.isDarkMode = savedTheme === 'dark';
    
    this.applyTheme(this.currentTheme);
  }

  /**
   * 切换主题
   */
  toggleTheme() {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.isDarkMode = !this.isDarkMode;
    
    this.applyTheme(this.currentTheme);
    this.saveTheme();
    
    if (this.notificationManager) {
      this.notificationManager.info(
        `已切换到${this.currentTheme === 'dark' ? '深色' : '浅色'}主题`
      );
    }
  }

  /**
   * 应用主题
   */
  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.classList.toggle('dark-theme', theme === 'dark');
    
    // 更新主题切换按钮状态
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
      const icon = themeToggle.querySelector('i') || themeToggle;
      if (theme === 'dark') {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
        themeToggle.title = '切换到浅色主题';
      } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
        themeToggle.title = '切换到深色主题';
      }
    }
  }

  /**
   * 保存主题设置
   */
  saveTheme() {
    localStorage.setItem('theme', this.currentTheme);
  }

  /**
   * 处理窗口大小变化
   */
  handleResize() {
    const oldIsMobile = this.isMobile;
    const oldIsTablet = this.isTablet;
    
    this.detectDevice();
    
    // 如果设备类型发生变化
    if (oldIsMobile !== this.isMobile || oldIsTablet !== this.isTablet) {
      this.handleDeviceChange();
    }
    
    // 触发自定义事件
    window.dispatchEvent(new CustomEvent('ui:resize', {
      detail: {
        isMobile: this.isMobile,
        isTablet: this.isTablet,
        width: window.innerWidth,
        height: window.innerHeight
      }
    }));
  }

  /**
   * 处理设备类型变化
   */
  handleDeviceChange() {
    // 移动端自动关闭侧边栏
    if (this.isMobile && this.sidebarOpen) {
      this.closeSidebar();
    }
    
    // 调整布局
    this.adjustLayout();
    
    if (this.notificationManager) {
      this.notificationManager.info('布局已适应新设备');
    }
  }

  /**
   * 调整布局
   */
  adjustLayout() {
    // 调整侧边栏
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      if (this.isMobile) {
        sidebar.classList.add('mobile');
      } else {
        sidebar.classList.remove('mobile');
      }
    }
    
    // 调整导航栏
    const navbar = document.querySelector('.navbar');
    if (navbar) {
      if (this.isMobile) {
        navbar.classList.add('mobile');
      } else {
        navbar.classList.remove('mobile');
      }
    }
    
    // 调整卡片布局
    const cardGrid = document.querySelector('.card-grid');
    if (cardGrid) {
      this.adjustCardLayout(cardGrid);
    }
  }

  /**
   * 调整卡片布局
   */
  adjustCardLayout(grid) {
    let columns = 4; // 默认4列
    
    if (this.isMobile) {
      columns = 1;
    } else if (this.isTablet) {
      columns = 2;
    } else if (window.innerWidth <= 1200) {
      columns = 3;
    }
    
    grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
  }

  /**
   * 切换侧边栏
   */
  toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    
    this.sidebarOpen = !this.sidebarOpen;
    
    if (this.sidebarOpen) {
      this.openSidebar();
    } else {
      this.closeSidebar();
    }
  }

  /**
   * 打开侧边栏
   */
  openSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.querySelector('.sidebar-backdrop');
    
    if (sidebar) {
      sidebar.classList.add('open');
      
      if (this.isMobile) {
        // 移动端显示背景遮罩
        if (!backdrop) {
          const newBackdrop = document.createElement('div');
          newBackdrop.className = 'sidebar-backdrop';
          newBackdrop.addEventListener('click', () => this.closeSidebar());
          document.body.appendChild(newBackdrop);
        }
        backdrop?.classList.add('show');
      }
    }
    
    this.sidebarOpen = true;
  }

  /**
   * 关闭侧边栏
   */
  closeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.querySelector('.sidebar-backdrop');
    
    if (sidebar) {
      sidebar.classList.remove('open');
    }
    
    if (backdrop) {
      backdrop.classList.remove('show');
    }
    
    this.sidebarOpen = false;
  }

  /**
   * 设置移动端导航
   */
  setupMobileNavigation() {
    // 创建移动端菜单按钮
    if (!document.querySelector('.mobile-menu-toggle')) {
      const menuBtn = document.createElement('button');
      menuBtn.className = 'mobile-menu-toggle';
      menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
      menuBtn.setAttribute('aria-label', '菜单');
      
      const navbar = document.querySelector('.navbar');
      if (navbar) {
        navbar.appendChild(menuBtn);
      }
    }
  }

  /**
   * 设置触摸事件
   */
  setupTouchEvents() {
    let touchStartY = 0;
    let touchEndY = 0;
    
    document.addEventListener('touchstart', (e) => {
      touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });
    
    document.addEventListener('touchend', (e) => {
      touchEndY = e.changedTouches[0].screenY;
      this.handleSwipe(touchStartY, touchEndY);
    }, { passive: true });
  }

  /**
   * 处理滑动手势
   */
  handleSwipe(startY, endY) {
    const swipeDistance = startY - endY;
    const threshold = 50;
    
    // 下滑
    if (swipeDistance > threshold) {
      // 可以实现下拉刷新等功能
    }
    
    // 上滑
    if (swipeDistance < -threshold) {
      // 可以实现上滑隐藏导航栏等功能
    }
  }

  /**
   * 设置懒加载
   */
  setupLazyLoading() {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.classList.remove('lazy');
              imageObserver.unobserve(img);
            }
          }
        });
      });
      
      // 观察所有懒加载图片
      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });
    }
  }

  /**
   * 处理键盘事件
   */
  handleKeyboard(e) {
    // ESC键关闭模态框和侧边栏
    if (e.key === 'Escape') {
      this.closeAllModals();
      if (this.sidebarOpen) {
        this.closeSidebar();
      }
    }
    
    // Tab键焦点管理
    if (e.key === 'Tab') {
      this.handleFocusManagement(e);
    }
  }

  /**
   * 焦点管理
   */
  handleFocusManagement(e) {
    // 在模态框中循环焦点
    const activeModal = document.querySelector('.modal.show');
    if (activeModal) {
      this.trapFocus(activeModal, e);
    }
  }

  /**
   * 焦点陷阱
   */
  trapFocus(container, e) {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }

  /**
   * 处理滚动事件
   */
  handleScroll() {
    const scrollY = window.scrollY;
    
    // 显示/隐藏返回顶部按钮
    const backToTop = document.querySelector('.back-to-top');
    if (backToTop) {
      if (scrollY > 300) {
        backToTop.classList.add('show');
      } else {
        backToTop.classList.remove('show');
      }
    }
    
    // 滚动时的导航栏效果
    const navbar = document.querySelector('.navbar');
    if (navbar && scrollY > 50) {
      navbar.classList.add('scrolled');
    } else if (navbar) {
      navbar.classList.remove('scrolled');
    }
  }

  /**
   * 显示在线状态
   */
  showOnlineStatus() {
    if (this.notificationManager) {
      this.notificationManager.success('网络连接已恢复');
    }
    
    document.body.classList.remove('offline');
  }

  /**
   * 显示离线状态
   */
  showOfflineStatus() {
    if (this.notificationManager) {
      this.notificationManager.warning('网络连接已断开');
    }
    
    document.body.classList.add('offline');
  }

  /**
   * 初始化工具提示
   */
  initTooltips() {
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(element => {
      new bootstrap.Tooltip(element);
    });
    
    // 自定义工具提示
    document.querySelectorAll('[title]:not([data-bs-toggle="tooltip"])').forEach(element => {
      if (!element.title.trim()) return;
      
      element.addEventListener('mouseenter', (e) => {
        this.showCustomTooltip(e.target, e.target.title);
      });
      
      element.addEventListener('mouseleave', () => {
        this.hideCustomTooltip();
      });
    });
  }

  /**
   * 显示自定义工具提示
   */
  showCustomTooltip(element, text) {
    // 移除现有工具提示
    this.hideCustomTooltip();
    
    const tooltip = document.createElement('div');
    tooltip.className = 'custom-tooltip';
    tooltip.textContent = text;
    
    document.body.appendChild(tooltip);
    
    // 定位工具提示
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
    tooltip.style.top = rect.top - tooltip.offsetHeight - 5 + 'px';
    
    // 显示动画
    requestAnimationFrame(() => {
      tooltip.classList.add('show');
    });
  }

  /**
   * 隐藏自定义工具提示
   */
  hideCustomTooltip() {
    const tooltip = document.querySelector('.custom-tooltip');
    if (tooltip) {
      tooltip.remove();
    }
  }

  /**
   * 初始化下拉菜单
   */
  initDropdowns() {
    document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
      const dropdown = toggle.nextElementSibling;
      
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // 关闭其他下拉菜单
        this.closeAllDropdowns();
        
        // 切换当前下拉菜单
        if (dropdown) {
          dropdown.classList.toggle('show');
          toggle.classList.toggle('active');
        }
      });
    });
  }

  /**
   * 关闭所有下拉菜单
   */
  closeAllDropdowns() {
    document.querySelectorAll('.dropdown.show').forEach(dropdown => {
      dropdown.classList.remove('show');
    });
    
    document.querySelectorAll('.dropdown-toggle.active').forEach(toggle => {
      toggle.classList.remove('active');
    });
  }

  /**
   * 初始化折叠组件
   */
  initCollapses() {
    document.querySelectorAll('[data-bs-toggle="collapse"]').forEach(toggle => {
      const target = document.querySelector(toggle.dataset.bsTarget || toggle.getAttribute('href'));
      
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        
        if (target) {
          target.classList.toggle('show');
          toggle.classList.toggle('collapsed');
        }
      });
    });
  }

  /**
   * 初始化返回顶部按钮
   */
  initBackToTop() {
    if (!document.querySelector('.back-to-top')) {
      const backToTop = document.createElement('button');
      backToTop.className = 'back-to-top';
      backToTop.innerHTML = '<i class="fas fa-arrow-up"></i>';
      backToTop.setAttribute('aria-label', '返回顶部');
      
      backToTop.addEventListener('click', () => {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      });
      
      document.body.appendChild(backToTop);
    }
  }

  /**
   * 初始化加载指示器
   */
  initLoadingIndicators() {
    document.querySelectorAll('.loading-indicator').forEach(indicator => {
      const type = indicator.dataset.type || 'spinner';
      const size = indicator.dataset.size || 'medium';
      
      if (!indicator.innerHTML.trim()) {
        indicator.innerHTML = this.createLoadingHTML(type, size);
      }
    });
  }

  /**
   * 创建加载HTML
   */
  createLoadingHTML(type, size) {
    const sizes = {
      small: 'loading-sm',
      medium: 'loading-md',
      large: 'loading-lg'
    };
    
    switch (type) {
      case 'spinner':
        return `<div class="spinner ${sizes[size]}"></div>`;
      case 'dots':
        return `<div class="loading-dots ${sizes[size]}"><span></span><span></span><span></span></div>`;
      case 'pulse':
        return `<div class="loading-pulse ${sizes[size]}"></div>`;
      default:
        return `<div class="spinner ${sizes[size]}"></div>`;
    }
  }

  /**
   * 初始化进度条
   */
  initProgressBars() {
    document.querySelectorAll('.progress-bar').forEach(bar => {
      const value = bar.dataset.value || 0;
      const animated = bar.dataset.animated !== 'false';
      
      if (animated) {
        setTimeout(() => {
          bar.style.width = value + '%';
        }, 100);
      } else {
        bar.style.width = value + '%';
      }
    });
  }

  /**
   * 显示模态框
   */
  showModal(id, options = {}) {
    const modal = document.getElementById(id);
    if (!modal) return;
    
    const defaultOptions = {
      backdrop: true,
      keyboard: true,
      focus: true
    };
    
    const config = { ...defaultOptions, ...options };
    
    this.modals.set(id, config);
    
    modal.classList.add('show');
    modal.style.display = 'block';
    
    if (config.backdrop) {
      this.createBackdrop();
    }
    
    if (config.focus) {
      setTimeout(() => {
        this.trapFocus(modal);
      }, 100);
    }
    
    // 阻止body滚动
    document.body.style.overflow = 'hidden';
  }

  /**
   * 关闭模态框
   */
  closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    
    modal.classList.remove('show');
    modal.style.display = 'none';
    
    this.modals.delete(id);
    this.removeBackdrop();
    
    // 恢复body滚动
    if (this.modals.size === 0) {
      document.body.style.overflow = '';
    }
  }

  /**
   * 关闭所有模态框
   */
  closeAllModals() {
    this.modals.forEach((config, id) => {
      this.closeModal(id);
    });
  }

  /**
   * 创建背景遮罩
   */
  createBackdrop() {
    if (!document.querySelector('.modal-backdrop')) {
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      document.body.appendChild(backdrop);
    }
  }

  /**
   * 移除背景遮罩
   */
  removeBackdrop() {
    const backdrop = document.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.remove();
    }
  }

  /**
   * 显示加载状态
   */
  showLoading(element, message = '加载中...') {
    const loadingId = 'loading_' + Date.now();
    const loading = document.createElement('div');
    loading.className = 'loading-overlay';
    loading.dataset.loadingId = loadingId;
    loading.innerHTML = `
      <div class="loading-content">
        <div class="spinner"></div>
        <div class="loading-message">${message}</div>
      </div>
    `;
    
    element.style.position = 'relative';
    element.appendChild(loading);
    
    return loadingId;
  }

  /**
   * 隐藏加载状态
   */
  hideLoading(loadingId) {
    const loading = document.querySelector(`[data-loading-id="${loadingId}"]`);
    if (loading) {
      loading.remove();
    }
  }

  /**
   * 显示Toast消息
   */
  showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-message">${message}</div>
      <button class="toast-close">&times;</button>
    `;
    
    const container = document.querySelector('.toast-container') || this.createToastContainer();
    container.appendChild(toast);
    
    // 显示动画
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
    
    // 自动关闭
    if (duration > 0) {
      setTimeout(() => {
        this.hideToast(toast);
      }, duration);
    }
    
    // 手动关闭
    toast.querySelector('.toast-close').addEventListener('click', () => {
      this.hideToast(toast);
    });
  }

  /**
   * 隐藏Toast消息
   */
  hideToast(toast) {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  /**
   * 创建Toast容器
   */
  createToastContainer() {
    const container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
  }

  /**
   * 获取当前设备信息
   */
  getDeviceInfo() {
    return {
      isMobile: this.isMobile,
      isTablet: this.isTablet,
      isDesktop: !this.isMobile && !this.isTablet,
      width: window.innerWidth,
      height: window.innerHeight,
      orientation: window.orientation || (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'),
      theme: this.currentTheme,
      darkMode: this.isDarkMode
    };
  }

  /**
   * 设置页面标题
   */
  setPageTitle(title) {
    document.title = title;
    
    // 更新浏览器标签页标题（如果支持）
    if ('setAppBadge' in navigator) {
      // 可以设置应用徽章
    }
  }

  /**
   * 设置页面图标
   */
  setFavicon(url) {
    const link = document.querySelector('link[rel="icon"]') || 
                document.createElement('link');
    link.rel = 'icon';
    link.href = url;
    
    if (!document.querySelector('link[rel="icon"]')) {
      document.head.appendChild(link);
    }
  }

  /**
   * 添加页面动画
   */
  addPageAnimation(type = 'fade') {
    document.body.classList.add(`page-${type}-in`);
    
    setTimeout(() => {
      document.body.classList.remove(`page-${type}-in`);
    }, 500);
  }
}

// 导出单例实例
export const uiManager = new UIManager();

// 导出到全局作用域（向后兼容）
window.uiManager = uiManager;