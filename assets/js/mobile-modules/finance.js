/**
 * 移动端ERP - 财务模块
 */

window.FinanceModule = {
  name: 'finance',
  currentType: '',
  filters: {
    keyword: '',
    category: '',
    dateFrom: '',
    dateTo: ''
  },
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

    document.getElementById('financeFilterBtn')?.addEventListener('click', () => {
      this.showFilterModal();
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
        keyword: this.filters.keyword,
        category: this.filters.category,
        dateFrom: this.filters.dateFrom,
        dateTo: this.filters.dateTo,
        limit: this.pageSize,
        offset
      });

      if (rows.length < this.pageSize) {
        this.hasMore = false;
      }

      this.records = this.currentPage === 1 ? rows : [...this.records, ...rows];
      this.renderRecords();
      if (this.currentPage === 1 && this.records.length === 0 && this.hasActiveFilters()) {
        window.Toast.info('当前筛选条件下暂无财务记录');
      }
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

  hasActiveFilters() {
    return !!(
      String(this.filters.keyword || '').trim()
      || String(this.filters.category || '').trim()
      || String(this.filters.dateFrom || '').trim()
      || String(this.filters.dateTo || '').trim()
    );
  },

  escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  getFilterSummaryHtml() {
    const chips = [];
    if (this.filters.keyword) chips.push(`关键词：${this.escapeHtml(this.filters.keyword)}`);
    if (this.filters.category) chips.push(`分类：${this.escapeHtml(this.filters.category)}`);
    if (this.filters.dateFrom) chips.push(`开始：${this.escapeHtml(this.filters.dateFrom)}`);
    if (this.filters.dateTo) chips.push(`结束：${this.escapeHtml(this.filters.dateTo)}`);
    if (chips.length === 0) return '';

    return `
      <div class="finance-filter-summary">
        <div class="finance-filter-chips">${chips.map(chip => `<span class="finance-filter-chip">${chip}</span>`).join('')}</div>
        <button id="financeClearFilterBtn" type="button" class="finance-filter-clear-btn">重置</button>
      </div>
    `;
  },

  getQuickRangeDates(type) {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (type === 'today') {
      return { dateFrom: today, dateTo: today };
    }
    if (type === '7d' || type === '30d') {
      const days = type === '7d' ? 7 : 30;
      const start = new Date(now);
      start.setDate(start.getDate() - (days - 1));
      const dateFrom = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
      return { dateFrom, dateTo: today };
    }
    return { dateFrom: '', dateTo: '' };
  },

  async showFilterModal() {
    const keyword = String(this.filters.keyword || '').trim();
    const category = String(this.filters.category || '').trim();
    const dateFrom = String(this.filters.dateFrom || '').trim();
    const dateTo = String(this.filters.dateTo || '').trim();

    const modalPromise = window.Modal.show({
      title: '筛选财务记录',
      confirmText: '应用筛选',
      cancelText: '取消',
      content: `
        <div style="text-align:left;">
          <div style="margin-bottom:10px;">
            <div style="margin-bottom:6px;color:#475569;font-size:12px;">关键词</div>
            <input id="financeFilterKeywordInput" type="text" maxlength="50" placeholder="分类或描述关键词"
              value="${this.escapeHtml(keyword)}"
              style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;" />
          </div>
          <div style="margin-bottom:10px;">
            <div style="margin-bottom:6px;color:#475569;font-size:12px;">分类</div>
            <input id="financeFilterCategoryInput" type="text" maxlength="50" placeholder="如：销售订单、销售成本、利润"
              value="${this.escapeHtml(category)}"
              style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;" />
          </div>
          <div style="margin-bottom:10px;">
            <div style="margin-bottom:6px;color:#475569;font-size:12px;">快捷日期</div>
            <select id="financeFilterQuickRange" style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;">
              <option value="">自定义</option>
              <option value="today">今天</option>
              <option value="7d">近7天</option>
              <option value="30d">近30天</option>
            </select>
          </div>
          <div style="display:flex;gap:8px;">
            <div style="flex:1;">
              <div style="margin-bottom:6px;color:#475569;font-size:12px;">开始日期</div>
              <input id="financeFilterDateFrom" type="date" value="${this.escapeHtml(dateFrom)}"
                style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;" />
            </div>
            <div style="flex:1;">
              <div style="margin-bottom:6px;color:#475569;font-size:12px;">结束日期</div>
              <input id="financeFilterDateTo" type="date" value="${this.escapeHtml(dateTo)}"
                style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;" />
            </div>
          </div>
          <button id="financeFilterResetBtn" type="button"
            style="margin-top:10px;width:100%;height:34px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#475569;">清空筛选</button>
        </div>
      `,
      onConfirm: async () => {
        const nextKeyword = String(document.getElementById('financeFilterKeywordInput')?.value || '').trim();
        const nextCategory = String(document.getElementById('financeFilterCategoryInput')?.value || '').trim();
        const nextDateFrom = String(document.getElementById('financeFilterDateFrom')?.value || '').trim();
        const nextDateTo = String(document.getElementById('financeFilterDateTo')?.value || '').trim();

        if (nextDateFrom && nextDateTo && nextDateFrom > nextDateTo) {
          window.Toast.error('开始日期不能晚于结束日期');
          return false;
        }

        this.filters = {
          keyword: nextKeyword,
          category: nextCategory,
          dateFrom: nextDateFrom,
          dateTo: nextDateTo
        };
        this.currentPage = 1;
        this.records = [];
        this.hasMore = true;
        await this.loadRecords();
        return true;
      }
    });

    setTimeout(() => {
      const quickRange = document.getElementById('financeFilterQuickRange');
      const dateFromInput = document.getElementById('financeFilterDateFrom');
      const dateToInput = document.getElementById('financeFilterDateTo');
      const resetBtn = document.getElementById('financeFilterResetBtn');
      quickRange?.addEventListener('change', () => {
        const nextType = String(quickRange.value || '').trim();
        const range = this.getQuickRangeDates(nextType);
        if (dateFromInput) dateFromInput.value = range.dateFrom;
        if (dateToInput) dateToInput.value = range.dateTo;
      });
      resetBtn?.addEventListener('click', () => {
        const keywordInput = document.getElementById('financeFilterKeywordInput');
        const categoryInput = document.getElementById('financeFilterCategoryInput');
        if (keywordInput) keywordInput.value = '';
        if (categoryInput) categoryInput.value = '';
        if (dateFromInput) dateFromInput.value = '';
        if (dateToInput) dateToInput.value = '';
        if (quickRange) quickRange.value = '';
      });
    }, 0);

    await modalPromise;
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
        ${this.getFilterSummaryHtml()}
        <div class="empty-state">
          <div class="empty-icon"><i class="fa fa-line-chart"></i></div>
          <div class="empty-text">暂无财务记录</div>
        </div>
      `;
      const clearBtn = container.querySelector('#financeClearFilterBtn');
      if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
          this.filters = { keyword: '', category: '', dateFrom: '', dateTo: '' };
          this.currentPage = 1;
          this.records = [];
          this.hasMore = true;
          await this.loadRecords();
        });
      }
      return;
    }

    container.innerHTML = `
      ${this.renderSummary()}
      ${this.getFilterSummaryHtml()}
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

    const clearBtn = container.querySelector('#financeClearFilterBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        this.filters = { keyword: '', category: '', dateFrom: '', dateTo: '' };
        this.currentPage = 1;
        this.records = [];
        this.hasMore = true;
        await this.loadRecords();
      });
    }
  }
};
