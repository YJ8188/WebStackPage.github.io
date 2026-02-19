/**
 * 移动端ERP - ActionSheet组件
 * 底部操作菜单
 */

class ActionSheet {
  constructor() {
    this.overlay = null;
    this.isShowing = false;
  }

  show(options = {}) {
    const {
      title = '',
      actions = [],
      cancelText = '取消',
      onCancel = null
    } = options;

    if (this.isShowing) return;
    this.isShowing = true;

    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'actionsheet-overlay';

      const actionsHtml = actions.map((action, index) => `
        <div class="actionsheet-item ${action.danger ? 'danger' : ''}" data-index="${index}">
          ${action.icon ? `<i class="fa fa-${action.icon}"></i>` : ''}
          <span>${action.text}</span>
        </div>
      `).join('');

      overlay.innerHTML = `
        <div class="actionsheet-container">
          ${title ? `<div class="actionsheet-title">${title}</div>` : ''}
          <div class="actionsheet-actions">
            ${actionsHtml}
          </div>
          <div class="actionsheet-cancel">${cancelText}</div>
        </div>
      `;

      document.body.appendChild(overlay);
      this.overlay = overlay;

      // 触发动画
      setTimeout(() => overlay.classList.add('show'), 10);

      // 点击遮罩关闭
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.hide();
          if (onCancel) onCancel();
          resolve(null);
        }
      });

      // 取消按钮
      const cancelBtn = overlay.querySelector('.actionsheet-cancel');
      cancelBtn.addEventListener('click', () => {
        this.hide();
        if (onCancel) onCancel();
        resolve(null);
      });

      // 操作按钮
      overlay.querySelectorAll('.actionsheet-item').forEach((item, index) => {
        item.addEventListener('click', async () => {
          const action = actions[index];
          this.hide();

          if (action.handler) {
            await action.handler();
          }

          resolve(index);
        });
      });
    });
  }

  async hide() {
    if (!this.overlay) return;

    this.overlay.classList.remove('show');
    await Utils.sleep(300);

    if (this.overlay && this.overlay.parentNode) {
      document.body.removeChild(this.overlay);
    }

    this.overlay = null;
    this.isShowing = false;
  }
}

// ActionSheet样式
const actionsheetStyle = document.createElement('style');
actionsheetStyle.textContent = `
.actionsheet-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 9996;
  opacity: 0;
  transition: opacity 0.3s;
}

.actionsheet-overlay.show {
  opacity: 1;
}

.actionsheet-container {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: #fff;
  border-radius: 12px 12px 0 0;
  transform: translateY(100%);
  transition: transform 0.3s;
  padding-bottom: env(safe-area-inset-bottom);
}

.actionsheet-overlay.show .actionsheet-container {
  transform: translateY(0);
}

.actionsheet-title {
  padding: 16px 20px;
  font-size: 14px;
  color: #8c8c8c;
  text-align: center;
  border-bottom: 1px solid #f0f0f0;
}

.actionsheet-actions {
  background-color: #fff;
}

.actionsheet-item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 56px;
  font-size: 16px;
  color: #262626;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background-color 0.2s;
}

.actionsheet-item:last-child {
  border-bottom: none;
}

.actionsheet-item:active {
  background-color: #f5f5f5;
}

.actionsheet-item.danger {
  color: #f5222d;
}

.actionsheet-cancel {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #262626;
  background-color: #fff;
  margin-top: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.actionsheet-cancel:active {
  background-color: #f5f5f5;
}

@media (min-width: 768px) {
  .actionsheet-container {
    max-width: 768px;
    left: 50%;
    transform: translateX(-50%) translateY(100%);
  }

  .actionsheet-overlay.show .actionsheet-container {
    transform: translateX(-50%) translateY(0);
  }
}
`;
document.head.appendChild(actionsheetStyle);

window.ActionSheet = new ActionSheet();
