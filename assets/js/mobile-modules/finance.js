/**
 * 移动端ERP - 财务模块
 */

window.FinanceModule = {
  name: 'finance',
  currentType: '',
  currentPage: 1,
  pageSize: 20,
  records: [],
  hasMore: true,
  eventsBound: false,

  async init() {
    if (!this.eventsBound) {
      this.bindEvents();
      this.eventsBound = true;
    }
    this.currentPage = 1;
    this.records = [];
    this.hasMore = true;
    await this.loadRecords();
  },

  bindEvents() {
    document.querySelectorAll('#financeTabs .tab-item').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#financeTabs .tab-item').forEach(item => item.classList.remove('active'));
        tab.classList.add('active');
        this.currentType = String(tab.dataset.type || '').trim();
        this.currentPage = 1;
        this.records = [];
        this.hasMore = true;
        this.loadRecords();
      });
    });

    const content = document.getElementById('financeContent');
    if (content) {
      content.addEventListener('scroll', window.Utils.throttle(() => {
        if (content.scrollHeight - content.scrollTop - content.clientHeight < 100) {
          this.loadMore();
        }
      }, 300));
    }
  },

  async loadRecords() {
    try {
      window.Loading.show('加载财务记录...');
      const offset = (this.currentPage - 1) * this.pageSize;
      const rows = await window.API.getFinanceRecords({
        type: this.currentType,
        limit: this.pageSize,
        offset
      });

      if (rows.length < this.pageSize) {
        this.hasMore = false;
      }

      this.records = this.currentPage === 1 ? rows : [...this.records, ...rows];
      this.renderRecords();
      window.Loading.hide();
    } catch (error) {
      window.Loading.hide();
      console.error('加载财务记录失败:', error);
      window.Toast.error('加载财务记录失败');
    }
  },

  async loadMore() {
    if (!this.hasMore) return;
    this.currentPage += 1;
    await this.loadRecords();
  },

  getTypeText(type) {
    const key = String(type || '').toLowerCase();
    if (key === 'income') return '收入';
    if (key === 'expense') return '支出';
    return '系统';
  },

  getTypeTag(type) {
    const key = String(type || '').toLowerCase();
    if (key === 'income') return 'success';
    if (key === 'expense') return 'error';
    return 'default';
  },

  renderSummary() {
    const income = this.records
      .filter(item => String(item?.type || '').toLowerCase() === 'income')
      .reduce((sum, item) => sum + Math.abs(Number(item?.amount || 0)), 0);

    const expense = this.records
      .filter(item => String(item?.type || '').toLowerCase() === 'expense')
      .reduce((sum, item) => sum + Math.abs(Number(item?.amount || 0)), 0);

    const net = income - expense;

    return `
      <div class="finance-summary-grid">
        <div class="finance-summary-card is-income">
          <div class="finance-summary-label">收入（当前列表）</div>
          <div class="finance-summary-value">${window.Utils.formatMoney(income)}</div>
        </div>
        <div class="finance-summary-card is-expense">
          <div class="finance-summary-label">支出（当前列表）</div>
          <div class="finance-summary-value">${window.Utils.formatMoney(expense)}</div>
        </div>
        <div class="finance-summary-card is-net">
          <div class="finance-summary-label">净额（当前列表）</div>
          <div class="finance-summary-value">${window.Utils.formatMoney(net)}</div>
        </div>
      </div>
    `;
  },

  renderRecords() {
    const container = document.getElementById('financeContent');
    if (!container) return;

    if (this.records.length === 0) {
      container.innerHTML = `
        ${this.renderSummary()}
        <div class="empty-state">
          <div class="empty-icon"><i class="fa fa-line-chart"></i></div>
          <div class="empty-text">暂无财务记录</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      ${this.renderSummary()}
      <div class="finance-list">
        ${this.records.map(item => {
          const lowerType = String(item?.type || '').toLowerCase();
          const typeText = this.getTypeText(item?.type);
          const typeTag = this.getTypeTag(item?.type);
          const amount = Number(item?.amount || 0);
          const amountText = window.Utils.formatMoney(Math.abs(amount));
          const dateText = window.Utils.formatDate(item?.transaction_date || item?.created_at || new Date(), 'YYYY-MM-DD');
          const amountClass = lowerType === 'income' ? 'is-income' : (lowerType === 'expense' ? 'is-expense' : '');
          const amountPrefix = lowerType === 'expense' ? '-' : (lowerType === 'income' ? '+' : '');
          return `
            <div class="finance-item">
              <div class="finance-item-header">
                <div class="finance-item-title">${item?.category || '未分类'}</div>
                <div class="tag tag-${typeTag}">${typeText}</div>
              </div>
              <div class="finance-item-desc">${item?.description || '—'}</div>
              <div class="finance-item-footer">
                <div class="finance-item-time">${dateText}</div>
                <div class="finance-item-amount ${amountClass}">
                  ${amountPrefix}${amountText}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      ${this.hasMore ? '<div class="infinite-scroll-loading">加载更多...</div>' : '<div class="infinite-scroll-finished">没有更多了</div>'}
    `;
  }
};
