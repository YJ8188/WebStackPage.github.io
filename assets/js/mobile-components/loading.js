/**
 * 移动端ERP - Loading组件
 * 加载指示器
 */

class Loading {
  constructor() {
    this.overlay = null;
    this.count = 0;
    this.init();
  }

  init() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'loading-overlay';
    this.overlay.innerHTML = `
      <div class="loading-spinner"></div>
      <div class="loading-text">加载中...</div>
    `;
    document.body.appendChild(this.overlay);
  }

  show(text = '加载中...') {
    this.count++;
    const textEl = this.overlay.querySelector('.loading-text');
    if (textEl) {
      textEl.textContent = text;
    }
    this.overlay.classList.add('show');
  }

  hide() {
    this.count = Math.max(0, this.count - 1);
    if (this.count === 0) {
      this.overlay.classList.remove('show');
    }
  }

  hideAll() {
    this.count = 0;
    this.overlay.classList.remove('show');
  }
}

// Loading样式
const loadingStyle = document.createElement('style');
loadingStyle.textContent = `
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 9998;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
}

.loading-overlay.show {
  opacity: 1;
  pointer-events: auto;
}

.loading-overlay .loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-overlay .loading-text {
  margin-top: 16px;
  color: #fff;
  font-size: 14px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
`;
document.head.appendChild(loadingStyle);

window.Loading = new Loading();
