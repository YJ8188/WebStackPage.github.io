/**
 * 移动端ERP - Toast组件
 * 轻提示组件
 */

class Toast {
  constructor() {
    this.container = null;
    this.queue = [];
    this.isShowing = false;
    this.init();
  }

  init() {
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    document.body.appendChild(this.container);
  }

  show(message, type = 'info', duration = 2000) {
    this.queue.push({ message, type, duration });
    if (!this.isShowing) {
      this.showNext();
    }
  }

  async showNext() {
    if (this.queue.length === 0) {
      this.isShowing = false;
      return;
    }

    this.isShowing = true;
    const { message, type, duration } = this.queue.shift();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icon = this.getIcon(type);
    toast.innerHTML = `
      ${icon ? `<i class="fa fa-${icon}"></i>` : ''}
      <span>${message}</span>
    `;

    this.container.appendChild(toast);

    // 触发动画
    setTimeout(() => toast.classList.add('show'), 10);

    // 自动隐藏
    await Utils.sleep(duration);
    toast.classList.remove('show');

    await Utils.sleep(300);
    this.container.removeChild(toast);

    this.showNext();
  }

  getIcon(type) {
    const icons = {
      success: 'check-circle',
      error: 'times-circle',
      warning: 'exclamation-circle',
      info: 'info-circle'
    };
    return icons[type] || '';
  }

  success(message, duration) {
    this.show(message, 'success', duration);
  }

  error(message, duration) {
    this.show(message, 'error', duration);
  }

  warning(message, duration) {
    this.show(message, 'warning', duration);
  }

  info(message, duration) {
    this.show(message, 'info', duration);
  }
}

// Toast样式
const toastStyle = document.createElement('style');
toastStyle.textContent = `
.toast-container {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 9999;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background-color: rgba(0, 0, 0, 0.8);
  color: #fff;
  border-radius: 8px;
  font-size: 14px;
  opacity: 0;
  transform: scale(0.8);
  transition: all 0.3s;
  margin-bottom: 12px;
  max-width: 80vw;
  word-break: break-word;
}

.toast.show {
  opacity: 1;
  transform: scale(1);
}

.toast i {
  font-size: 18px;
}

.toast-success i {
  color: #52c41a;
}

.toast-error i {
  color: #f5222d;
}

.toast-warning i {
  color: #faad14;
}

.toast-info i {
  color: #1890ff;
}
`;
document.head.appendChild(toastStyle);

window.Toast = new Toast();
