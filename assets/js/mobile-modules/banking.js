/**
 * 移动端ERP - 银行业务模块
 */

window.BankingModule = {
  name: 'banking',
  currentFlow: '',
  keyword: '',
  currentPage: 1,
  pageSize: 20,
  rawRows: [],
  rows: [],
  hasMore: true,
  eventsBound: false,
  syncEventsBound: false,
  realtimeChannel: null,
  realtimeRefreshTimer: null,

  async init(params = {}) {
    this.currentFlow = String(params?.type || this.currentFlow || '').trim().toLowerCase();
    this.keyword = String(params?.keyword || this.keyword || '').trim();
    this.currentPage = 1;
    this.rawRows = [];
    this.rows = [];
    this.hasMore = true;

    if (!this.eventsBound) {
      this.bindEvents();
      this.eventsBound = true;
    }
    if (!this.syncEventsBound) {
      this.bindSyncEvents();
      this.syncEventsBound = true;
    }

    this.startRealtimeSync();
    this.applyFlowTab();
    const input = document.getElementById('bankingSearchInput');
    if (input) {
      input.value = this.keyword;
    }
    await this.loadRecords();
  },

  bindEvents() {
    document.querySelectorAll('#bankingTabs .tab-item').forEach(tab => {
      tab.addEventListener('click', async () => {
        document.querySelectorAll('#bankingTabs .tab-item').forEach(item => item.classList.remove('active'));
        tab.classList.add('active');
        this.currentFlow = String(tab.dataset.type || '').trim().toLowerCase();
        this.currentPage = 1;
        this.rawRows = [];
        this.rows = [];
        this.hasMore = true;
        await this.loadRecords();
      });
    });

    const searchInput = document.getElementById('bankingSearchInput');
    if (searchInput) {
      const onSearch = window.Utils?.debounce(async () => {
        this.keyword = String(searchInput.value || '').trim();
        this.currentPage = 1;
        this.rawRows = [];
        this.rows = [];
        this.hasMore = true;
        await this.loadRecords();
      }, 260);
      searchInput.addEventListener('input', onSearch);
    }

    const content = document.getElementById('bankingContent');
    if (content) {
      content.addEventListener('scroll', window.Utils.throttle(() => {
        if (content.scrollHeight - content.scrollTop - content.clientHeight < 100) {
          this.loadMore();
        }
      }, 260));

      content.addEventListener('click', (event) => {
        const rowEl = event.target.closest('.banking-record-card');
        if (!rowEl || !content.contains(rowEl)) return;
        const rowId = String(rowEl.dataset.id || '').trim();
        const row = this.rows.find(item => String(item?.id || '') === rowId);
        if (!row) return;
        this.showRecordDetail(row);
      });
    }
  },

  bindSyncEvents() {
    window.addEventListener('focus', () => this.scheduleRealtimeRefresh('focus'));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.scheduleRealtimeRefresh('visibility');
      }
    });
    if (window.EventBus?.on) {
      window.EventBus.on('network:online', () => this.scheduleRealtimeRefresh('network-online'));
    }
  },

  isPageActive() {
    const page = document.getElementById('bankingPage');
    return !!page && !page.classList.contains('hidden');
  },

  scheduleRealtimeRefresh() {
    if (this.realtimeRefreshTimer) {
      clearTimeout(this.realtimeRefreshTimer);
      this.realtimeRefreshTimer = null;
    }
    this.realtimeRefreshTimer = setTimeout(async () => {
      if (!this.isPageActive()) return;
      this.currentPage = 1;
      this.rawRows = [];
      this.rows = [];
      this.hasMore = true;
      await this.loadRecords();
    }, 260);
  },

  startRealtimeSync() {
    if (this.realtimeChannel) return;
    const client = window.supabaseClient || window.supabase;
    if (!client || typeof client.channel !== 'function') return;

    const userId = window.MobileERP?.getCurrentUser?.()?.id || '';
    const channelName = `mobile-erp-banking-${userId || 'guest'}`;
    const refreshIfNeeded = payload => {
      const row = payload?.new || payload?.old || {};
      const rowUserId = String(row?.user_id || '').trim();
      if (userId && rowUserId && rowUserId !== String(userId)) {
        return;
      }
      this.scheduleRealtimeRefresh('realtime');
    };

    this.realtimeChannel = client
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'erp_finances' }, refreshIfNeeded)
      .subscribe();
  },

  applyFlowTab() {
    document.querySelectorAll('#bankingTabs .tab-item').forEach(tab => {
      const key = String(tab.dataset.type || '').trim().toLowerCase();
      tab.classList.toggle('active', key === this.currentFlow);
    });
    if (!document.querySelector('#bankingTabs .tab-item.active')) {
      const allTab = document.querySelector('#bankingTabs .tab-item[data-type=""]');
      if (allTab) allTab.classList.add('active');
      this.currentFlow = '';
    }
  },

  async loadRecords() {
    try {
      window.Loading.show('加载银行业务...');
      const offset = (this.currentPage - 1) * this.pageSize;
      const data = await window.API.getBankBusinessRecords({
        type: '',
        keyword: this.keyword,
        limit: this.pageSize,
        offset
      });
      if (data.length < this.pageSize) {
        this.hasMore = false;
      }
      this.rawRows = this.currentPage === 1 ? data : [...this.rawRows, ...data];
      this.rows = this.filterRowsByFlow(this.rawRows);
      this.render();
      window.Loading.hide();
    } catch (error) {
      window.Loading.hide();
      console.error('加载银行业务失败:', error);
      window.Toast.error(error?.message || '加载银行业务失败');
    }
  },

  async loadMore() {
    if (!this.hasMore) return;
    this.currentPage += 1;
    await this.loadRecords();
  },

  getTypeText(type) {
    const key = String(type || '').trim().toLowerCase();
    if (key === 'income') return '收入';
    if (key === 'expense') return '支出';
    return '系统';
  },

  getRecordTypeLabel(row = {}) {
    if (this.isRepaymentPaymentRow(row)) return '还款入账';
    if (this.isRepaymentPlanRow(row)) return '还款计划';
    if (this.isSwipeRow(row)) return '刷卡流水';
    return this.getTypeText(row?.type);
  },

  toAbsAmount(value, fallback = 0) {
    const num = Number(value);
    if (!Number.isFinite(num)) return Number(fallback || 0);
    return Math.abs(num);
  },

  parseAmountFromDescription(description, patterns = []) {
    const text = String(description || '');
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const parsed = Number(String(match[1]).replace(/,/g, ''));
        if (Number.isFinite(parsed)) {
          return Math.abs(parsed);
        }
      }
    }
    return 0;
  },

  isRepaymentPaymentRow(row = {}) {
    const businessType = String(row?.business_type || '').trim().toLowerCase();
    const category = String(row?.category || '').trim();
    const description = String(row?.description || '').trim();
    return businessType === 'credit_card_repayment_payment'
      || category.includes('还款记录')
      || description.includes('来源：手动登记还款');
  },

  isRepaymentPlanRow(row = {}) {
    const businessType = String(row?.business_type || '').trim().toLowerCase();
    const category = String(row?.category || '').trim();
    const description = String(row?.description || '').trim();
    if (this.isRepaymentPaymentRow(row)) return false;
    return businessType === 'credit_card_repayment'
      || category.includes('信用卡还款')
      || /应还|账单/.test(description);
  },

  isRepaymentRow(row = {}) {
    return this.isRepaymentPaymentRow(row) || this.isRepaymentPlanRow(row);
  },

  isSwipeRow(row = {}) {
    const businessType = String(row?.business_type || '').trim().toLowerCase();
    const category = String(row?.category || '').trim();
    const description = String(row?.description || '').trim();
    return businessType === 'credit_card_swipe'
      || category.includes('信用卡刷卡')
      || /刷卡|到账/.test(description);
  },

  filterRowsByFlow(rows = []) {
    const list = Array.isArray(rows) ? rows : [];
    if (this.currentFlow === 'repayment') {
      return list.filter(row => this.isRepaymentRow(row));
    }
    if (this.currentFlow === 'swipe') {
      return list.filter(row => this.isSwipeRow(row));
    }
    return list;
  },

  getRepaymentDueAmount(row = {}) {
    const direct = this.toAbsAmount(row?.card_repayment_amount, NaN);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const parsed = this.parseAmountFromDescription(row?.description, [
      /应还(?:金额)?[:：]\s*[¥￥]?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/,
      /本期账单(?:金额)?[:：]\s*[¥￥]?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/,
      /账单金额[:：]\s*[¥￥]?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/,
      /本次还款[:：]\s*[¥￥]?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/
    ]);
    if (parsed > 0) return parsed;
    return this.toAbsAmount(row?.amount || 0, 0);
  },

  getPaidAmount(row = {}) {
    const parsed = this.parseAmountFromDescription(row?.description, [
      /本次还款[:：]\s*[¥￥]?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/,
      /还款[:：]\s*[¥￥]?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/
    ]);
    if (parsed > 0) return parsed;
    return this.toAbsAmount(row?.amount || 0, 0);
  },

  getSwipeGrossAmount(row = {}) {
    const direct = this.toAbsAmount(row?.card_swipe_amount, NaN);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const parsed = this.parseAmountFromDescription(row?.description, [
      /(?:刷卡|消费)[:：]\s*[¥￥]?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/,
      /原应还[:：]\s*[¥￥]?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/
    ]);
    if (parsed > 0) return parsed;
    return this.toAbsAmount(row?.amount || 0, 0);
  },

  getSwipeActualAmount(row = {}) {
    const direct = this.toAbsAmount(row?.card_actual_amount, NaN);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const parsed = this.parseAmountFromDescription(row?.description, [
      /(?:到账|实到)[:：]\s*[¥￥]?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/,
      /到账[:：]\s*[¥￥]?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/
    ]);
    if (parsed > 0) return parsed;
    return this.getSwipeGrossAmount(row);
  },

  getSwipeFeeAmount(row = {}) {
    const direct = this.toAbsAmount(row?.card_fee_amount, NaN);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const parsed = this.parseAmountFromDescription(row?.description, [
      /手续费[:：]\s*[¥￥]?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/,
      /费率[:：]\s*[0-9.]+%\s*.*?手续费[:：]\s*[¥￥]?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/
    ]);
    if (parsed > 0) return parsed;
    const gross = this.getSwipeGrossAmount(row);
    const actual = this.getSwipeActualAmount(row);
    return Math.max(0, gross - actual);
  },

  buildSummary(rows = []) {
    const list = Array.isArray(rows) ? rows : [];
    const repaymentPlanRows = list.filter(row => this.isRepaymentPlanRow(row));
    const repaymentPaymentRows = list.filter(row => this.isRepaymentPaymentRow(row));
    const swipeRows = list.filter(row => this.isSwipeRow(row));

    const totalRepaymentDue = repaymentPlanRows.reduce((sum, row) => sum + this.getRepaymentDueAmount(row), 0);
    const totalPaid = repaymentPaymentRows.reduce((sum, row) => sum + this.getPaidAmount(row), 0);
    const outstanding = Math.max(0, totalRepaymentDue - totalPaid);
    const totalSwipe = swipeRows.reduce((sum, row) => sum + this.getSwipeGrossAmount(row), 0);
    const totalArrival = swipeRows.reduce((sum, row) => sum + this.getSwipeActualAmount(row), 0);
    const totalFee = swipeRows.reduce((sum, row) => sum + this.getSwipeFeeAmount(row), 0);

    return {
      totalRepaymentDue,
      totalPaid,
      outstanding,
      totalSwipe,
      totalArrival,
      totalFee
    };
  },

  getRecordTitle(row = {}) {
    if (this.isRepaymentPaymentRow(row)) return '还款记录';
    if (this.isRepaymentPlanRow(row)) return '信用卡还款';
    if (this.isSwipeRow(row)) return '信用卡刷卡';
    return String(row?.category || '银行流水').trim() || '银行流水';
  },

  getAmountColor(row = {}) {
    const type = String(row?.type || '').toLowerCase();
    return type === 'income' ? '#15803d' : (type === 'expense' ? '#dc2626' : '#334155');
  },

  formatAmountText(row = {}) {
    const type = String(row?.type || '').toLowerCase();
    const sign = type === 'income' ? '+' : (type === 'expense' ? '-' : '');
    const amount = this.toAbsAmount(row?.amount || 0, 0);
    return `${sign}${window.Utils.formatMoney(amount)}`;
  },

  getBankName(row) {
    const candidates = [
      row?.card_bank,
      row?.swipe_card_bank,
      row?.settlement_bank
    ];
    for (const candidate of candidates) {
      const text = String(candidate || '').trim();
      if (text) return text;
    }
    const description = String(row?.description || '');
    const match = description.match(/银行[:：]\s*([^；\n]+)/);
    return match?.[1] ? String(match[1]).trim() : '未标注银行';
  },

  escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  renderSummary() {
    const summary = this.buildSummary(this.rawRows);
    return `
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 12px 6px;">
        <div style="padding:10px;border:1px solid #d1fae5;border-radius:10px;background:#f0fdf4;">
          <div style="font-size:12px;color:#166534;">总应还金额</div>
          <div style="font-size:16px;font-weight:700;color:#15803d;">${window.Utils.formatMoney(summary.totalRepaymentDue)}</div>
        </div>
        <div style="padding:10px;border:1px solid #fee2e2;border-radius:10px;background:#fff1f2;">
          <div style="font-size:12px;color:#991b1b;">已还金额</div>
          <div style="font-size:16px;font-weight:700;color:#dc2626;">${window.Utils.formatMoney(summary.totalPaid)}</div>
        </div>
        <div style="padding:10px;border:1px solid #dcfce7;border-radius:10px;background:#f0fdf4;">
          <div style="font-size:12px;color:#166534;">剩余应还</div>
          <div style="font-size:16px;font-weight:700;color:#15803d;">${window.Utils.formatMoney(summary.outstanding)}</div>
        </div>
        <div style="padding:10px;border:1px solid #dbeafe;border-radius:10px;background:#eff6ff;">
          <div style="font-size:12px;color:#1e3a8a;">总刷卡金额</div>
          <div style="font-size:16px;font-weight:700;color:#1d4ed8;">${window.Utils.formatMoney(summary.totalSwipe)}</div>
        </div>
        <div style="padding:10px;border:1px solid #fde68a;border-radius:10px;background:#fffbeb;">
          <div style="font-size:12px;color:#92400e;">总到账金额</div>
          <div style="font-size:16px;font-weight:700;color:#b45309;">${window.Utils.formatMoney(summary.totalArrival)}</div>
        </div>
        <div style="padding:10px;border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc;">
          <div style="font-size:12px;color:#475569;">总手续费</div>
          <div style="font-size:16px;font-weight:700;color:#0f172a;">${window.Utils.formatMoney(summary.totalFee)}</div>
        </div>
      </div>
    `;
  },

  render() {
    const container = document.getElementById('bankingContent');
    if (!container) return;

    if (!Array.isArray(this.rows) || this.rows.length === 0) {
      container.innerHTML = `
        ${this.renderSummary()}
        <div class="empty-state">
          <div class="empty-icon"><i class="fa fa-university"></i></div>
          <div class="empty-text">暂无银行业务记录</div>
        </div>
      `;
      return;
    }

    const cards = this.rows.map(row => {
      const bankName = this.getBankName(row);
      const dateText = window.Utils.formatDate(row?.transaction_date || row?.created_at, 'YYYY/MM/DD HH:mm:ss');
      const title = this.escapeHtml(this.getRecordTitle(row));
      const typeText = this.escapeHtml(this.getRecordTypeLabel(row));
      const bankText = this.escapeHtml(bankName);
      const descText = this.escapeHtml(String(row?.description || '').trim() || '无描述');
      const amountText = this.formatAmountText(row);
      const amountColor = this.getAmountColor(row);
      let extraLine = '';
      if (this.isRepaymentPlanRow(row)) {
        const due = this.getRepaymentDueAmount(row);
        extraLine = `应还：${window.Utils.formatMoney(due)}`;
      } else if (this.isRepaymentPaymentRow(row)) {
        const paid = this.getPaidAmount(row);
        extraLine = `已还：${window.Utils.formatMoney(paid)}`;
      } else if (this.isSwipeRow(row)) {
        const gross = this.getSwipeGrossAmount(row);
        const actual = this.getSwipeActualAmount(row);
        const fee = this.getSwipeFeeAmount(row);
        extraLine = `刷卡：${window.Utils.formatMoney(gross)} · 到账：${window.Utils.formatMoney(actual)} · 手续费：${window.Utils.formatMoney(fee)}`;
      }
      return `
        <div class="banking-record-card" data-id="${this.escapeHtml(row?.id)}"
          style="margin:8px 12px;padding:12px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
            <div style="font-size:14px;font-weight:600;color:#0f172a;">${title}</div>
            <div style="font-size:15px;font-weight:700;color:${amountColor};">${amountText}</div>
          </div>
          <div style="margin-top:6px;font-size:12px;color:#64748b;">${typeText} · ${bankText}</div>
          <div style="margin-top:4px;font-size:12px;color:#94a3b8;">${this.escapeHtml(dateText)}</div>
          ${extraLine ? `<div style="margin-top:4px;font-size:12px;color:#0f766e;">${this.escapeHtml(extraLine)}</div>` : ''}
          <div style="margin-top:4px;font-size:12px;color:#475569;line-height:1.45;">${descText}</div>
        </div>
      `;
    }).join('');

    container.innerHTML = `${this.renderSummary()}${cards}`;
  },

  async showRecordDetail(row) {
    const type = this.getRecordTypeLabel(row);
    const amount = this.toAbsAmount(row?.amount || 0);
    const bankName = this.getBankName(row);
    const dateText = window.Utils.formatDate(row?.transaction_date || row?.created_at, 'YYYY/MM/DD HH:mm:ss');
    const due = this.getRepaymentDueAmount(row);
    const paid = this.getPaidAmount(row);
    const gross = this.getSwipeGrossAmount(row);
    const actual = this.getSwipeActualAmount(row);
    const fee = this.getSwipeFeeAmount(row);
    await window.Modal.show({
      title: '银行业务详情',
      confirmText: '关闭',
      showCancel: false,
      content: `
        <div style="text-align:left;line-height:1.8;">
          <div><strong>类型：</strong>${this.escapeHtml(type)}</div>
          <div><strong>分类：</strong>${this.escapeHtml(row?.category || '-')}</div>
          <div><strong>金额：</strong>${this.escapeHtml(window.Utils.formatMoney(amount))}</div>
          <div><strong>银行：</strong>${this.escapeHtml(bankName)}</div>
          <div><strong>时间：</strong>${this.escapeHtml(dateText)}</div>
          <div><strong>应还金额：</strong>${this.escapeHtml(window.Utils.formatMoney(due))}</div>
          <div><strong>已还金额：</strong>${this.escapeHtml(window.Utils.formatMoney(paid))}</div>
          <div><strong>刷卡金额：</strong>${this.escapeHtml(window.Utils.formatMoney(gross))}</div>
          <div><strong>到账金额：</strong>${this.escapeHtml(window.Utils.formatMoney(actual))}</div>
          <div><strong>手续费：</strong>${this.escapeHtml(window.Utils.formatMoney(fee))}</div>
          <div><strong>描述：</strong>${this.escapeHtml(String(row?.description || '').trim() || '-')}</div>
        </div>
      `
    });
  }
};
