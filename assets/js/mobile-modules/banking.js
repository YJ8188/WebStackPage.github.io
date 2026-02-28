/**
 * 移动端ERP - 银行业务模块
 */

window.BankingModule = {
  name: 'banking',
  currentType: '',
  keyword: '',
  currentPage: 1,
  pageSize: 20,
  rows: [],
  hasMore: true,
  eventsBound: false,
  syncEventsBound: false,
  realtimeChannel: null,
  realtimeRefreshTimer: null,

  async init(params = {}) {
    this.currentType = String(params?.type || this.currentType || '').trim().toLowerCase();
    this.keyword = String(params?.keyword || this.keyword || '').trim();
    this.currentPage = 1;
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
    this.applyTypeTab();
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
        this.currentType = String(tab.dataset.type || '').trim().toLowerCase();
        this.currentPage = 1;
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

  applyTypeTab() {
    document.querySelectorAll('#bankingTabs .tab-item').forEach(tab => {
      const key = String(tab.dataset.type || '').trim().toLowerCase();
      tab.classList.toggle('active', key === this.currentType);
    });
    if (!document.querySelector('#bankingTabs .tab-item.active')) {
      const allTab = document.querySelector('#bankingTabs .tab-item[data-type=""]');
      if (allTab) allTab.classList.add('active');
      this.currentType = '';
    }
  },

  async loadRecords() {
    try {
      window.Loading.show('加载银行业务...');
      const offset = (this.currentPage - 1) * this.pageSize;
      const data = await window.API.getBankBusinessRecords({
        type: this.currentType,
        keyword: this.keyword,
        limit: this.pageSize,
        offset
      });
      if (data.length < this.pageSize) {
        this.hasMore = false;
      }
      this.rows = this.currentPage === 1 ? data : [...this.rows, ...data];
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
    const income = this.rows
      .filter(item => String(item?.type || '').toLowerCase() === 'income')
      .reduce((sum, item) => sum + Math.abs(Number(item?.amount || 0)), 0);
    const expense = this.rows
      .filter(item => String(item?.type || '').toLowerCase() === 'expense')
      .reduce((sum, item) => sum + Math.abs(Number(item?.amount || 0)), 0);
    return `
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 12px 6px;">
        <div style="padding:10px;border:1px solid #dcfce7;border-radius:10px;background:#f0fdf4;">
          <div style="font-size:12px;color:#166534;">收入</div>
          <div style="font-size:16px;font-weight:600;color:#15803d;">${window.Utils.formatMoney(income)}</div>
        </div>
        <div style="padding:10px;border:1px solid #fee2e2;border-radius:10px;background:#fef2f2;">
          <div style="font-size:12px;color:#991b1b;">支出</div>
          <div style="font-size:16px;font-weight:600;color:#dc2626;">${window.Utils.formatMoney(expense)}</div>
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
      const type = String(row?.type || '').toLowerCase();
      const isIncome = type === 'income';
      const amount = Math.abs(Number(row?.amount || 0));
      const bankName = this.getBankName(row);
      const dateText = window.Utils.formatDate(row?.transaction_date || row?.created_at, 'YYYY/MM/DD HH:mm:ss');
      const category = this.escapeHtml(row?.category || '未分类');
      const typeText = this.escapeHtml(this.getTypeText(type));
      const bankText = this.escapeHtml(bankName);
      const descText = this.escapeHtml(String(row?.description || '').trim() || '无描述');
      const amountText = `${isIncome ? '+' : '-'}${window.Utils.formatMoney(amount)}`;
      const amountColor = isIncome ? '#15803d' : '#dc2626';
      return `
        <div class="banking-record-card" data-id="${this.escapeHtml(row?.id)}"
          style="margin:8px 12px;padding:12px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
            <div style="font-size:14px;font-weight:600;color:#0f172a;">${category}</div>
            <div style="font-size:15px;font-weight:700;color:${amountColor};">${amountText}</div>
          </div>
          <div style="margin-top:6px;font-size:12px;color:#64748b;">${typeText} · ${bankText}</div>
          <div style="margin-top:4px;font-size:12px;color:#94a3b8;">${this.escapeHtml(dateText)}</div>
          <div style="margin-top:4px;font-size:12px;color:#475569;line-height:1.45;">${descText}</div>
        </div>
      `;
    }).join('');

    container.innerHTML = `${this.renderSummary()}${cards}`;
  },

  async showRecordDetail(row) {
    const type = this.getTypeText(row?.type);
    const amount = Math.abs(Number(row?.amount || 0));
    const bankName = this.getBankName(row);
    const dateText = window.Utils.formatDate(row?.transaction_date || row?.created_at, 'YYYY/MM/DD HH:mm:ss');
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
          <div><strong>描述：</strong>${this.escapeHtml(String(row?.description || '').trim() || '-')}</div>
        </div>
      `
    });
  }
};

