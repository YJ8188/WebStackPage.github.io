/**
 * 通知管理模块
 * 负责管理应用中的各种通知（成功、错误、警告、信息等）
 */
export class NotificationManager {
  constructor() {
    this.container = null;
    this.notifications = new Map();
    this.defaultOptions = {
      duration: 5000,
      position: 'top-right',
      allowClose: true,
      showProgress: true,
      animateIn: true,
      animateOut: true
    };
    
    this.init();
  }

  /**
   * 初始化通知系统
   */
  init() {
    this.createContainer();
    this.injectStyles();
  }

  /**
   * 创建通知容器
   */
  createContainer() {
    // 检查是否已存在通知容器
    this.container = document.getElementById('notification-container');
    
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'notification-container';
      this.container.className = 'notification-container';
      document.body.appendChild(this.container);
    }
  }

  /**
   * 注入通知样式
   */
  injectStyles() {
    const styleId = 'notification-styles';
    
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .notification-container {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 9999;
          max-width: 400px;
          pointer-events: none;
        }
        
        .notification {
          background: white;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          display: flex;
          align-items: flex-start;
          gap: 12px;
          pointer-events: auto;
          animation: notificationSlideIn 0.3s ease-out;
          position: relative;
          overflow: hidden;
        }
        
        .notification.removing {
          animation: notificationSlideOut 0.3s ease-in forwards;
        }
        
        .notification-icon {
          flex-shrink: 0;
          width: 20px;
          height: 20px;
          margin-top: 2px;
        }
        
        .notification-content {
          flex: 1;
          min-width: 0;
        }
        
        .notification-title {
          font-weight: 600;
          margin-bottom: 4px;
          color: #2c3e50;
        }
        
        .notification-message {
          color: #666;
          font-size: 14px;
          line-height: 1.4;
        }
        
        .notification-close {
          flex-shrink: 0;
          background: none;
          border: none;
          color: #999;
          cursor: pointer;
          padding: 0;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s;
        }
        
        .notification-close:hover {
          background: rgba(0, 0, 0, 0.1);
          color: #666;
        }
        
        .notification-progress {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 3px;
          background: currentColor;
          opacity: 0.3;
          animation: progress linear forwards;
        }
        
        /* 通知类型样式 */
        .notification.success {
          border-left: 4px solid #28a745;
          color: #28a745;
        }
        
        .notification.error {
          border-left: 4px solid #dc3545;
          color: #dc3545;
        }
        
        .notification.warning {
          border-left: 4px solid #ffc107;
          color: #ffc107;
        }
        
        .notification.info {
          border-left: 4px solid #17a2b8;
          color: #17a2b8;
        }
        
        /* 动画 */
        @keyframes notificationSlideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes notificationSlideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
        
        @keyframes progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        
        /* 响应式设计 */
        @media (max-width: 768px) {
          .notification-container {
            left: 10px;
            right: 10px;
            max-width: none;
            top: 10px;
          }
          
          .notification {
            margin-bottom: 8px;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * 显示通知
   * @param {string} type - 通知类型 (success, error, warning, info)
   * @param {string} message - 通知消息
   * @param {string} title - 通知标题（可选）
   * @param {Object} options - 配置选项
   */
  show(type, message, title = '', options = {}) {
    const config = { ...this.defaultOptions, ...options };
    const id = this.generateId();
    
    const notification = this.createNotification(id, type, title, message, config);
    
    // 添加到容器
    this.container.appendChild(notification);
    
    // 保存到管理器
    this.notifications.set(id, {
      element: notification,
      type,
      message,
      title,
      config,
      createdAt: Date.now()
    });
    
    // 设置自动关闭
    if (config.duration > 0) {
      this.setAutoclose(id, config.duration);
    }
    
    // 添加进入动画
    if (config.animateIn) {
      requestAnimationFrame(() => {
        notification.classList.add('show');
      });
    }
    
    return id;
  }

  /**
   * 创建通知元素
   */
  createNotification(id, type, title, message, config) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.dataset.id = id;
    
    // 图标
    const icon = this.getIcon(type);
    const iconElement = document.createElement('div');
    iconElement.className = 'notification-icon';
    iconElement.innerHTML = icon;
    
    // 内容区域
    const contentElement = document.createElement('div');
    contentElement.className = 'notification-content';
    
    if (title) {
      const titleElement = document.createElement('div');
      titleElement.className = 'notification-title';
      titleElement.textContent = title;
      contentElement.appendChild(titleElement);
    }
    
    const messageElement = document.createElement('div');
    messageElement.className = 'notification-message';
    messageElement.textContent = message;
    contentElement.appendChild(messageElement);
    
    // 关闭按钮
    const closeButton = null;
    if (config.allowClose) {
      const closeElement = document.createElement('button');
      closeElement.className = 'notification-close';
      closeElement.innerHTML = '×';
      closeElement.onclick = () => this.close(id);
      notification.appendChild(closeElement);
    }
    
    // 进度条
    if (config.showProgress && config.duration > 0) {
      const progressElement = document.createElement('div');
      progressElement.className = 'notification-progress';
      progressElement.style.animationDuration = `${config.duration}ms`;
      notification.appendChild(progressElement);
    }
    
    // 组装元素
    notification.appendChild(iconElement);
    notification.appendChild(contentElement);
    
    return notification;
  }

  /**
   * 获取通知图标
   */
  getIcon(type) {
    const icons = {
      success: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>',
      error: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>',
      warning: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>',
      info: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>'
    };
    
    return icons[type] || icons.info;
  }

  /**
   * 设置自动关闭
   */
  setAutoclose(id, duration) {
    setTimeout(() => {
      this.close(id);
    }, duration);
  }

  /**
   * 关闭通知
   * @param {string} id - 通知ID
   */
  close(id) {
    const notificationData = this.notifications.get(id);
    
    if (!notificationData) return;
    
    const { element, config } = notificationData;
    
    // 添加移除动画
    if (config.animateOut) {
      element.classList.add('removing');
      
      // 等待动画完成后移除元素
      setTimeout(() => {
        this.removeNotification(id);
      }, 300);
    } else {
      this.removeNotification(id);
    }
  }

  /**
   * 移除通知
   * @param {string} id - 通知ID
   */
  removeNotification(id) {
    const notificationData = this.notifications.get(id);
    
    if (!notificationData) return;
    
    const { element } = notificationData;
    
    // 从DOM中移除
    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }
    
    // 从管理器中移除
    this.notifications.delete(id);
  }

  /**
   * 清除所有通知
   */
  clearAll() {
    const ids = Array.from(this.notifications.keys());
    ids.forEach(id => this.close(id));
  }

  /**
   * 生成唯一ID
   */
  generateId() {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 便捷方法：成功通知
   */
  success(message, title = '成功', options = {}) {
    return this.show('success', message, title, options);
  }

  /**
   * 便捷方法：错误通知
   */
  error(message, title = '错误', options = {}) {
    return this.show('error', message, title, {
      duration: 8000, // 错误通知显示更长时间
      ...options
    });
  }

  /**
   * 便捷方法：警告通知
   */
  warning(message, title = '警告', options = {}) {
    return this.show('warning', message, title, options);
  }

  /**
   * 便捷方法：信息通知
   */
  info(message, title = '提示', options = {}) {
    return this.show('info', message, title, options);
  }

  /**
   * 获取当前活动通知数量
   */
  getActiveCount() {
    return this.notifications.size;
  }

  /**
   * 检查是否有指定类型的通知
   */
  hasType(type) {
    return Array.from(this.notifications.values()).some(n => n.type === type);
  }

  /**
   * 销毁通知系统
   */
  destroy() {
    this.clearAll();
    
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    const styles = document.getElementById('notification-styles');
    if (styles) {
      styles.parentNode.removeChild(styles);
    }
    
    this.notifications.clear();
  }
}

// 导出单例实例
export const notificationManager = new NotificationManager();

// 导出到全局作用域（向后兼容）
window.notificationManager = notificationManager;