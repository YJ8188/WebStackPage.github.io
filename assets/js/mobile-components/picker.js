/**
 * 移动端ERP - Picker组件
 * 选择器组件（日期、时间、级联选择）
 */

class Picker {
  constructor() {
    this.overlay = null;
    this.isShowing = false;
  }

  // 显示日期选择器
  showDatePicker(options = {}) {
    const {
      title = '选择日期',
      value = new Date(),
      minDate = new Date(2000, 0, 1),
      maxDate = new Date(2099, 11, 31),
      onConfirm = null,
      onCancel = null
    } = options;

    return new Promise((resolve) => {
      const currentDate = new Date(value);
      let selectedYear = currentDate.getFullYear();
      let selectedMonth = currentDate.getMonth() + 1;
      let selectedDay = currentDate.getDate();

      const overlay = this.createOverlay(title);

      // 生成年月日列
      const years = this.generateYears(minDate.getFullYear(), maxDate.getFullYear());
      const months = this.generateMonths();
      const days = this.generateDays(selectedYear, selectedMonth);

      const pickerContent = `
        <div class="picker-columns">
          <div class="picker-column" data-type="year">
            ${years.map(y => `<div class="picker-item ${y === selectedYear ? 'active' : ''}" data-value="${y}">${y}年</div>`).join('')}
          </div>
          <div class="picker-column" data-type="month">
            ${months.map(m => `<div class="picker-item ${m === selectedMonth ? 'active' : ''}" data-value="${m}">${m}月</div>`).join('')}
          </div>
          <div class="picker-column" data-type="day">
            ${days.map(d => `<div class="picker-item ${d === selectedDay ? 'active' : ''}" data-value="${d}">${d}日</div>`).join('')}
          </div>
        </div>
      `;

      overlay.querySelector('.picker-body').innerHTML = pickerContent;
      document.body.appendChild(overlay);
      this.overlay = overlay;
      this.isShowing = true;

      // 滚动到选中项
      this.scrollToActive();

      // 触发动画
      setTimeout(() => overlay.classList.add('show'), 10);

      // 取消按钮
      overlay.querySelector('.picker-cancel').addEventListener('click', () => {
        this.hide(overlay);
        if (onCancel) onCancel();
        resolve(null);
      });

      // 确认按钮
      overlay.querySelector('.picker-confirm').addEventListener('click', () => {
        const year = parseInt(overlay.querySelector('[data-type="year"] .picker-item.active').dataset.value);
        const month = parseInt(overlay.querySelector('[data-type="month"] .picker-item.active').dataset.value);
        const day = parseInt(overlay.querySelector('[data-type="day"] .picker-item.active').dataset.value);

        const result = new Date(year, month - 1, day);
        this.hide(overlay);

        if (onConfirm) onConfirm(result);
        resolve(result);
      });

      // 列点击事件
      overlay.querySelectorAll('.picker-item').forEach(item => {
        item.addEventListener('click', () => {
          const column = item.parentElement;
          column.querySelectorAll('.picker-item').forEach(i => i.classList.remove('active'));
          item.classList.add('active');

          // 更新天数
          if (column.dataset.type === 'year' || column.dataset.type === 'month') {
            const year = parseInt(overlay.querySelector('[data-type="year"] .picker-item.active').dataset.value);
            const month = parseInt(overlay.querySelector('[data-type="month"] .picker-item.active').dataset.value);
            this.updateDays(overlay, year, month);
          }
        });
      });
    });
  }

  // 显示时间选择器
  showTimePicker(options = {}) {
    const {
      title = '选择时间',
      value = new Date(),
      onConfirm = null,
      onCancel = null
    } = options;

    return new Promise((resolve) => {
      const currentTime = new Date(value);
      let selectedHour = currentTime.getHours();
      let selectedMinute = currentTime.getMinutes();

      const overlay = this.createOverlay(title);

      const hours = Array.from({ length: 24 }, (_, i) => i);
      const minutes = Array.from({ length: 60 }, (_, i) => i);

      const pickerContent = `
        <div class="picker-columns">
          <div class="picker-column" data-type="hour">
            ${hours.map(h => `<div class="picker-item ${h === selectedHour ? 'active' : ''}" data-value="${h}">${String(h).padStart(2, '0')}</div>`).join('')}
          </div>
          <div class="picker-column" data-type="minute">
            ${minutes.map(m => `<div class="picker-item ${m === selectedMinute ? 'active' : ''}" data-value="${m}">${String(m).padStart(2, '0')}</div>`).join('')}
          </div>
        </div>
      `;

      overlay.querySelector('.picker-body').innerHTML = pickerContent;
      document.body.appendChild(overlay);
      this.overlay = overlay;
      this.isShowing = true;

      this.scrollToActive();
      setTimeout(() => overlay.classList.add('show'), 10);

      overlay.querySelector('.picker-cancel').addEventListener('click', () => {
        this.hide(overlay);
        if (onCancel) onCancel();
        resolve(null);
      });

      overlay.querySelector('.picker-confirm').addEventListener('click', () => {
        const hour = parseInt(overlay.querySelector('[data-type="hour"] .picker-item.active').dataset.value);
        const minute = parseInt(overlay.querySelector('[data-type="minute"] .picker-item.active').dataset.value);

        const result = { hour, minute };
        this.hide(overlay);

        if (onConfirm) onConfirm(result);
        resolve(result);
      });

      overlay.querySelectorAll('.picker-item').forEach(item => {
        item.addEventListener('click', () => {
          const column = item.parentElement;
          column.querySelectorAll('.picker-item').forEach(i => i.classList.remove('active'));
          item.classList.add('active');
        });
      });
    });
  }

  createOverlay(title) {
    const overlay = document.createElement('div');
    overlay.className = 'picker-overlay';
    overlay.innerHTML = `
      <div class="picker-container">
        <div class="picker-header">
          <button class="picker-cancel">取消</button>
          <div class="picker-title">${title}</div>
          <button class="picker-confirm">确定</button>
        </div>
        <div class="picker-body"></div>
      </div>
    `;
    return overlay;
  }

  generateYears(min, max) {
    const years = [];
    for (let i = min; i <= max; i++) {
      years.push(i);
    }
    return years;
  }

  generateMonths() {
    return Array.from({ length: 12 }, (_, i) => i + 1);
  }

  generateDays(year, month) {
    const daysInMonth = new Date(year, month, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  }

  updateDays(overlay, year, month) {
    const dayColumn = overlay.querySelector('[data-type="day"]');
    const currentDay = parseInt(dayColumn.querySelector('.picker-item.active')?.dataset.value || 1);
    const days = this.generateDays(year, month);

    dayColumn.innerHTML = days.map(d =>
      `<div class="picker-item ${d === currentDay && d <= days.length ? 'active' : ''}" data-value="${d}">${d}日</div>`
    ).join('');

    // 重新绑定事件
    dayColumn.querySelectorAll('.picker-item').forEach(item => {
      item.addEventListener('click', () => {
        dayColumn.querySelectorAll('.picker-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
      });
    });
  }

  scrollToActive() {
    if (!this.overlay) return;

    this.overlay.querySelectorAll('.picker-column').forEach(column => {
      const activeItem = column.querySelector('.picker-item.active');
      if (activeItem) {
        column.scrollTop = activeItem.offsetTop - column.offsetHeight / 2 + activeItem.offsetHeight / 2;
      }
    });
  }

  async hide(targetOverlay = null) {
    const overlay = targetOverlay || this.overlay;
    if (!overlay) return;

    overlay.classList.remove('show');
    await Utils.sleep(300);

    if (overlay && overlay.parentNode) {
      document.body.removeChild(overlay);
    }

    if (this.overlay === overlay) {
      this.overlay = null;
      this.isShowing = false;
    }
  }
}

// Picker样式
const pickerStyle = document.createElement('style');
pickerStyle.textContent = `
.picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 10020;
  opacity: 0;
  transition: opacity 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.picker-overlay.show {
  opacity: 1;
}

.picker-container {
  position: relative;
  width: 100%;
  max-width: 360px;
  background-color: #fff;
  border-radius: 12px;
  transform: scale(0.96);
  transition: transform 0.2s;
  padding-bottom: calc(env(safe-area-inset-bottom) * 0.5);
}

.picker-overlay.show .picker-container {
  transform: scale(1);
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 16px;
  border-bottom: 1px solid #f0f0f0;
}

.picker-cancel,
.picker-confirm {
  font-size: 16px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
}

.picker-cancel {
  color: #8c8c8c;
}

.picker-confirm {
  color: #1890ff;
  font-weight: 600;
}

.picker-title {
  font-size: 16px;
  font-weight: 600;
  color: #262626;
}

.picker-body {
  height: 240px;
  overflow: hidden;
}

.picker-columns {
  display: flex;
  height: 100%;
}

.picker-column {
  flex: 1;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  -webkit-overflow-scrolling: touch;
}

.picker-column::-webkit-scrollbar {
  display: none;
}

.picker-item {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #8c8c8c;
  cursor: pointer;
  scroll-snap-align: center;
  transition: all 0.2s;
}

.picker-item.active {
  color: #262626;
  font-weight: 600;
  font-size: 18px;
}

@media (min-width: 768px) {
  .picker-container {
    max-width: 420px;
  }
}
`;
document.head.appendChild(pickerStyle);

window.Picker = new Picker();
