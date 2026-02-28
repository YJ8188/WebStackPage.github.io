/**
 * 移动端ERP - Modal组件
 * 弹窗组件
 */

class Modal {
  constructor() {
    this.modals = [];
  }

  show(options = {}) {
    const {
      title = '',
      content = '',
      showCancel = true,
      cancelText = '取消',
      confirmText = '确定',
      showClose = false,
      maxWidth = '',
      containerClass = '',
      bodyClass = '',
      footerClass = '',
      onCancel = null,
      onConfirm = null
    } = options;

    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      const safeContainerClass = String(containerClass || '').trim();
      const safeBodyClass = String(bodyClass || '').trim();
      const safeFooterClass = String(footerClass || '').trim();
      const safeMaxWidth = String(maxWidth || '').trim();
      const containerStyle = safeMaxWidth ? ` style="max-width:${safeMaxWidth};"` : '';

      modal.innerHTML = `
        <div class="modal-container ${safeContainerClass}"${containerStyle}>
          ${title ? `<div class="modal-header">${title}${showClose ? '<button class="modal-close-btn" type="button" aria-label="关闭"><i class="fa fa-times"></i></button>' : ''}</div>` : ''}
          <div class="modal-body ${safeBodyClass}">${content}</div>
          <div class="modal-footer ${safeFooterClass}">
            ${showCancel ? `<button class="modal-btn modal-btn-cancel">${cancelText}</button>` : ''}
            <button class="modal-btn modal-btn-confirm">${confirmText}</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      this.modals.push(modal);

      // 触发动画
      setTimeout(() => modal.classList.add('show'), 10);

      // 取消按钮
      const cancelBtn = modal.querySelector('.modal-btn-cancel');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', async () => {
          if (onCancel) {
            const result = await onCancel();
            if (result === false) return;
          }
          this.hide(modal);
          resolve(false);
        });
      }

      // 关闭按钮
      const closeBtn = modal.querySelector('.modal-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', async () => {
          if (onCancel) {
            const result = await onCancel();
            if (result === false) return;
          }
          this.hide(modal);
          resolve(false);
        });
      }

      // 确认按钮
      const confirmBtn = modal.querySelector('.modal-btn-confirm');
      confirmBtn.addEventListener('click', async () => {
        if (onConfirm) {
          const result = await onConfirm();
          if (result === false) return;
        }
        this.hide(modal);
        resolve(true);
      });
    });
  }

  async hide(modal) {
    modal.classList.remove('show');
    await Utils.sleep(300);
    document.body.removeChild(modal);
    this.modals = this.modals.filter(m => m !== modal);
  }

  confirm(content, title = '确认') {
    return this.show({
      title,
      content,
      showCancel: true
    });
  }

  alert(content, title = '提示') {
    return this.show({
      title,
      content,
      showCancel: false
    });
  }
}

// Modal样式
const modalStyle = document.createElement('style');
modalStyle.textContent = `
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9997;
  opacity: 0;
  transition: opacity 0.3s;
  padding: 20px;
}

.modal-overlay.show {
  opacity: 1;
}

.modal-container {
  background-color: #fff;
  border-radius: 12px;
  width: 100%;
  max-width: 320px;
  overflow: hidden;
  transform: scale(0.9);
  transition: transform 0.3s;
}

.modal-overlay.show .modal-container {
  transform: scale(1);
}

.modal-header {
  padding: 16px 20px;
  font-size: 16px;
  font-weight: 600;
  color: #262626;
  border-bottom: 1px solid #f0f0f0;
  text-align: center;
  position: relative;
}

.modal-close-btn {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
}

.modal-close-btn:active {
  background: #f1f5f9;
}

.modal-body {
  padding: 20px;
  font-size: 14px;
  color: #595959;
  line-height: 1.6;
  text-align: center;
}

.modal-footer {
  display: flex;
  border-top: 1px solid #f0f0f0;
}

.modal-btn {
  flex: 1;
  height: 48px;
  font-size: 16px;
  background: none;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
}

.modal-btn:active {
  background-color: #f5f5f5;
}

.modal-btn-cancel {
  color: #595959;
  border-right: 1px solid #f0f0f0;
}

.modal-btn-confirm {
  color: #1890ff;
  font-weight: 600;
}
`;
document.head.appendChild(modalStyle);

window.Modal = new Modal();
