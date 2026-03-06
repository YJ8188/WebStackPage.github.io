/**
 * 移动端ERP - 下拉刷新组件
 */

class PullRefresh {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      threshold: 60,
      onRefresh: null,
      ...options
    };

    this.startY = 0;
    this.currentY = 0;
    this.distance = 0;
    this.isRefreshing = false;
    this.isPulling = false;

    this.init();
  }

  init() {
    // 创建指示器
    this.indicator = document.createElement('div');
    this.indicator.className = 'pull-refresh-indicator';
    this.indicator.innerHTML = `
      <div class="pull-refresh-icon">
        <i class="fa fa-arrow-down"></i>
      </div>
      <div class="pull-refresh-text">下拉刷新</div>
    `;
    this.container.insertBefore(this.indicator, this.container.firstChild);

    this.bindEvents();
  }

  bindEvents() {
    let startY = 0;

    this.container.addEventListener('touchstart', (e) => {
      if (this.isRefreshing || this.container.scrollTop > 0) return;
      startY = e.touches[0].clientY;
      this.isPulling = true;
    });

    this.container.addEventListener('touchmove', (e) => {
      if (!this.isPulling || this.isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const distance = currentY - startY;

      if (distance > 0 && this.container.scrollTop === 0) {
        e.preventDefault();
        this.distance = Math.min(distance * 0.5, this.options.threshold * 1.5);
        this.updateIndicator();
      }
    });

    this.container.addEventListener('touchend', () => {
      if (!this.isPulling || this.isRefreshing) return;

      this.isPulling = false;

      if (this.distance >= this.options.threshold) {
        this.refresh();
      } else {
        this.reset();
      }
    });
  }

  updateIndicator() {
    const icon = this.indicator.querySelector('.pull-refresh-icon');
    const text = this.indicator.querySelector('.pull-refresh-text');

    this.indicator.style.height = `${this.distance}px`;
    this.indicator.style.opacity = Math.min(this.distance / this.options.threshold, 1);

    if (this.distance >= this.options.threshold) {
      icon.style.transform = 'rotate(180deg)';
      text.textContent = '释放刷新';
    } else {
      icon.style.transform = 'rotate(0deg)';
      text.textContent = '下拉刷新';
    }
  }

  async refresh() {
    this.isRefreshing = true;

    const icon = this.indicator.querySelector('.pull-refresh-icon');
    const text = this.indicator.querySelector('.pull-refresh-text');

    this.indicator.style.height = `${this.options.threshold}px`;
    icon.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';
    text.textContent = '刷新中...';

    if (this.options.onRefresh) {
      await this.options.onRefresh();
    }

    this.reset();
  }

  reset() {
    this.indicator.style.height = '0';
    this.indicator.style.opacity = '0';
    this.distance = 0;
    this.isRefreshing = false;

    setTimeout(() => {
      const icon = this.indicator.querySelector('.pull-refresh-icon');
      const text = this.indicator.querySelector('.pull-refresh-text');
      icon.innerHTML = '<i class="fa fa-arrow-down"></i>';
      text.textContent = '下拉刷新';
    }, 300);
  }
}

// PullRefresh样式
const pullRefreshStyle = document.createElement('style');
pullRefreshStyle.textContent = `
.pull-refresh-indicator {
  height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: height 0.3s, opacity 0.3s;
}

.pull-refresh-icon {
  font-size: 20px;
  color: #1890ff;
  margin-bottom: 4px;
  transition: transform 0.3s;
}

.pull-refresh-text {
  font-size: 12px;
  color: #8c8c8c;
}
`;
document.head.appendChild(pullRefreshStyle);

window.PullRefresh = PullRefresh;
