/**
 * 移动端ERP - 导航栏组件
 */

class Navbar {
  constructor() {
    this.currentTitle = '';
  }

  normalizeIcon(icon) {
    return String(icon || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  }

  // 设置标题
  setTitle(title) {
    this.currentTitle = title;
    const titleEl = document.querySelector('.navbar-title');
    if (titleEl) {
      titleEl.textContent = title;
    }
  }

  // 显示返回按钮
  showBackButton(show = true) {
    const backBtn = document.querySelector('.navbar-icon[id$="BackBtn"]');
    if (backBtn) {
      backBtn.style.display = show ? 'flex' : 'none';
    }
  }

  // 显示右侧按钮
  showRightButton(icon, onClick) {
    const rightContainer = document.querySelector('.navbar-right');
    if (!rightContainer) return;
    const safeIcon = this.normalizeIcon(icon);

    rightContainer.innerHTML = `
      <div class="navbar-icon" id="navbarRightBtn">
        <i class="fa fa-${safeIcon}"></i>
      </div>
    `;

    const btn = document.getElementById('navbarRightBtn');
    if (btn && onClick) {
      btn.addEventListener('click', onClick);
    }
  }

  // 隐藏右侧按钮
  hideRightButton() {
    const rightContainer = document.querySelector('.navbar-right');
    if (rightContainer) {
      rightContainer.innerHTML = '';
    }
  }

  // 显示加载状态
  showLoading() {
    const rightContainer = document.querySelector('.navbar-right');
    if (!rightContainer) return;

    rightContainer.innerHTML = `
      <div class="navbar-icon">
        <i class="fa fa-spinner fa-spin"></i>
      </div>
    `;
  }
}

window.Navbar = new Navbar();
