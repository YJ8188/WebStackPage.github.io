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
  rawRecords: [],
  allViewRecords: [],
  records: [],
  hasMore: true,
  eventsBound: false,
  syncEventsBound: false,
  realtimeChannel: null,
  realtimeRefreshTimer: null,

  async init() {
    if (!this.eventsBound) {
      this.bindEvents();
      this.eventsBound = true;
    }
    if (!this.syncEventsBound) {
      this.bindSyncEvents();
      this.syncEventsBound = true;
    }
    this.startRealtimeSync();
    this.currentPage = 1;
    this.rawRecords = [];
    this.allViewRecords = [];
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
        this.rawRecords = [];
        this.allViewRecords = [];
        this.records = [];
        this.hasMore = true;
        this.loadRecords();
      });
    });

    document.getElementById('financeFilterBtn')?.addEventListener('click', () => {
      this.showFilterModal();
    });

    document.getElementById('financeAddBtn')?.addEventListener('click', () => {
      this.showAddFinanceModal();
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

  bindSyncEvents() {
    window.addEventListener('focus', () => {
      this.scheduleRealtimeRefresh('focus');
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.scheduleRealtimeRefresh('visibility');
      }
    });

    if (window.EventBus?.on) {
      window.EventBus.on('network:online', () => {
        this.scheduleRealtimeRefresh('network-online');
      });
    }
  },

  isPageActive() {
    const page = document.getElementById('financePage');
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
      this.rawRecords = [];
      this.allViewRecords = [];
      this.records = [];
      this.hasMore = true;
      await this.loadRecords();
    }, 260);
  },

  startRealtimeSync() {
    if (this.realtimeChannel) {
      return;
    }

    const client = window.supabaseClient || window.supabase;
    if (!client || typeof client.channel !== 'function') {
      return;
    }

    const userId = window.MobileERP?.getCurrentUser?.()?.id || '';
    const channelName = `mobile-erp-finance-${userId || 'guest'}`;

    const refreshIfNeeded = payload => {
      const row = payload?.new || payload?.old || {};
      const rowUserId = String(row?.user_id || '').trim();
      if (userId && rowUserId && rowUserId !== String(userId)) {
        return;
      }
      this.scheduleRealtimeRefresh('realtime-change');
    };

    this.realtimeChannel = client
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'erp_finances' }, refreshIfNeeded)
      .subscribe();
  },

  setActiveTypeTab(type = '') {
    this.currentType = String(type || '').trim();
    document.querySelectorAll('#financeTabs .tab-item').forEach(tab => {
      const matched = String(tab.dataset.type || '') === this.currentType;
      tab.classList.toggle('active', matched);
    });
    if (!document.querySelector('#financeTabs .tab-item.active')) {
      const defaultTab = document.querySelector('#financeTabs .tab-item[data-type=""]');
      if (defaultTab) defaultTab.classList.add('active');
      this.currentType = '';
    }
  },

  isBankBusinessFinanceRecord(row = {}) {
    const businessType = String(row?.business_type || '').trim().toLowerCase();
    const category = String(row?.category || '').trim();
    const description = String(row?.description || '').trim();

    if (['credit_card', 'credit_card_repayment', 'credit_card_swipe', 'credit_card_repayment_payment'].includes(businessType)) {
      return true;
    }

    if (category.includes('信用卡业务')
      || category.includes('信用卡还款')
      || category.includes('信用卡刷卡')
      || category.includes('银行手续费')) {
      return true;
    }

    return /银行[:：]/.test(description) && /刷卡[:：]/.test(description);
  },

  parseBankFeeAmountFromFinance(record = {}) {
    const businessType = String(record?.business_type || '').trim().toLowerCase();
    const category = String(record?.category || '').trim();
    const description = String(record?.description || '');
    const isSwipeRecord = businessType === 'credit_card_swipe'
      || category.includes('信用卡刷卡')
      || /刷卡[:：]/.test(description);
    if (!isSwipeRecord) {
      return 0;
    }

    const directFee = Number(record?.card_fee_amount);
    if (Number.isFinite(directFee) && directFee > 0) {
      return directFee;
    }

    const match = description.match(/手续费[:：]\s*[¥￥]?\s*([0-9]+(?:\.[0-9]+)?)/);
    if (!match || !match[1]) {
      return 0;
    }

    const parsed = Number(match[1]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  },

  buildShanghaiDateTimeText(value) {
    const parts = window.Utils?.getDateParts?.(value || null);
    if (!parts?.year || !parts?.month || !parts?.day) {
      return String(value || new Date().toISOString());
    }
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour || '00'}:${parts.minute || '00'}:${parts.second || '00'}`;
  },

  createBankFeeMirrorRows(rows = []) {
    const list = Array.isArray(rows) ? rows : [];
    const bankRows = list.filter(row => this.isBankBusinessFinanceRecord(row));
    if (!bankRows.length) return [];

    return bankRows
      .map((record, index) => {
        const feeAmount = this.parseBankFeeAmountFromFinance(record);
        if (!(feeAmount > 0)) return null;

        const sourceId = String(record?.id ?? `${index}`);
        const description = String(record?.description || '');
        const bankMatch = description.match(/(?:银行|还款卡|刷卡卡)[:：]\s*([^；\n]+)/);
        const bankName = bankMatch?.[1] ? String(bankMatch[1]).trim() : '信用卡业务';
        const sourceDate = this.buildShanghaiDateTimeText(record?.transaction_date || record?.created_at || null);

        return {
          id: `bank-fee::${sourceId}`,
          type: 'expense',
          category: '银行手续费',
          amount: feeAmount,
          description: `银行手续费（来源：${bankName}）`,
          transaction_date: sourceDate,
          reference_id: null,
          order_id: null,
          __virtual_bank_fee: true,
          __source_finance_id: record?.id ?? null
        };
      })
      .filter(Boolean);
  },

  getGeneralFinanceRows(rows = []) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const existingVirtualFeeRows = sourceRows.filter(item => item?.__virtual_bank_fee === true);
    const materialRows = sourceRows.filter(item => item?.__virtual_bank_fee !== true);
    const generalRows = materialRows.filter(item => !this.isBankBusinessFinanceRecord(item));
    const derivedFeeRows = this.createBankFeeMirrorRows(materialRows);

    if (derivedFeeRows.length > 0) {
      return [...generalRows, ...derivedFeeRows];
    }
    if (existingVirtualFeeRows.length > 0) {
      return [...generalRows, ...existingVirtualFeeRows];
    }
    return generalRows;
  },

  sortRowsByDateDesc(rows = []) {
    const list = Array.isArray(rows) ? rows : [];
    return [...list].sort((left, right) => {
      const leftTs = window.Utils?.parseDate?.(left?.transaction_date || left?.created_at || null)?.getTime?.() || 0;
      const rightTs = window.Utils?.parseDate?.(right?.transaction_date || right?.created_at || null)?.getTime?.() || 0;
      if (leftTs !== rightTs) return rightTs - leftTs;
      return String(right?.id || '').localeCompare(String(left?.id || ''), 'zh-CN');
    });
  },

  filterRowsForDisplay(rows = []) {
    const list = Array.isArray(rows) ? rows : [];
    const keyword = String(this.filters.keyword || '').trim().toLowerCase();
    const category = String(this.filters.category || '').trim().toLowerCase();
    const dateFrom = String(this.filters.dateFrom || '').trim();
    const dateTo = String(this.filters.dateTo || '').trim();
    const startDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const endDate = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;
    const currentType = String(this.currentType || '').trim().toLowerCase();

    return list.filter((row) => {
      const rowType = String(row?.type || '').trim().toLowerCase();
      if (currentType && rowType !== currentType) return false;

      if (keyword) {
        const keywordText = `${row?.category || ''} ${row?.description || ''}`.toLowerCase();
        if (!keywordText.includes(keyword)) return false;
      }

      if (category) {
        const categoryText = String(row?.category || '').toLowerCase();
        if (!categoryText.includes(category)) return false;
      }

      const date = window.Utils?.parseDate?.(row?.transaction_date || row?.created_at || null);
      if (startDate && (!(date instanceof Date) || Number.isNaN(date.getTime()) || date < startDate)) return false;
      if (endDate && (!(date instanceof Date) || Number.isNaN(date.getTime()) || date > endDate)) return false;
      return true;
    });
  },

  async fetchAllFinanceRows() {
    const pageLimit = 200;
    const maxBatches = 80;
    let offset = 0;
    const rows = [];

    for (let i = 0; i < maxBatches; i += 1) {
      const batch = await window.API.getFinanceRecords({
        type: '',
        keyword: '',
        category: '',
        dateFrom: this.filters.dateFrom,
        dateTo: this.filters.dateTo,
        limit: pageLimit,
        offset
      });
      if (!Array.isArray(batch) || batch.length === 0) break;
      rows.push(...batch);
      if (batch.length < pageLimit) break;
      offset += pageLimit;
    }

    return rows;
  },

  applyPagedViewRows() {
    const baseRows = this.getGeneralFinanceRows(this.rawRecords);
    const filteredRows = this.filterRowsForDisplay(baseRows);
    this.allViewRecords = this.sortRowsByDateDesc(filteredRows);

    const safePage = Math.max(1, Number(this.currentPage) || 1);
    const end = safePage * this.pageSize;
    this.records = this.allViewRecords.slice(0, end);
    this.hasMore = end < this.allViewRecords.length;
  },

  async loadRecords() {
    try {
      window.Loading.show('加载财务记录...');
      this.rawRecords = await this.fetchAllFinanceRows();
      this.applyPagedViewRows();
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
    this.applyPagedViewRows();
    this.renderRecords();
  },

  async showAddFinanceModal() {
    const today = new Date();
    const defaultDateTimeIso = today.toISOString();
    const defaultDateTimeText = window.Utils.formatDate(today, 'YYYY-MM-DD HH:mm');

    const modalPromise = window.Modal.show({
      title: '财务记一笔',
      confirmText: '保存',
      cancelText: '取消',
      content: `
        <div style="text-align:left;">
          <div style="margin-bottom:10px;">
            <div style="margin-bottom:6px;color:#475569;font-size:12px;">类型</div>
            <select id="mobileFinanceTypeInput" style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;">
              <option value="income">收入</option>
              <option value="expense">支出</option>
            </select>
          </div>
          <div style="margin-bottom:10px;">
            <div style="margin-bottom:6px;color:#475569;font-size:12px;">分类 <span style="color:#dc2626;">*</span></div>
            <input id="mobileFinanceCategoryInput" type="text" maxlength="60" placeholder="例如：销售订单、办公支出"
              style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;" />
          </div>
          <div style="margin-bottom:10px;">
            <div style="margin-bottom:6px;color:#475569;font-size:12px;">金额 <span style="color:#dc2626;">*</span></div>
            <input id="mobileFinanceAmountInput" type="number" min="0.01" step="0.01" placeholder="0.00"
              style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;box-sizing:border-box;" />
          </div>
          <div style="margin-bottom:10px;">
            <div style="margin-bottom:6px;color:#475569;font-size:12px;">交易时间</div>
            <input id="mobileFinanceDateIsoInput" type="hidden" value="${defaultDateTimeIso}" />
            <button id="mobileFinanceDatePickerBtn" type="button"
              style="width:100%;max-width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;box-sizing:border-box;background:#fff;color:#334155;text-align:left;display:flex;align-items:center;justify-content:space-between;">
              <span id="mobileFinanceDatePickerText">${defaultDateTimeText}</span>
              <i class="fa fa-calendar" style="color:#94a3b8;"></i>
            </button>
          </div>
          <div>
            <div style="margin-bottom:6px;color:#475569;font-size:12px;">描述</div>
            <textarea id="mobileFinanceDescInput" rows="2" placeholder="选填：本次收支说明"
              style="width:100%;border:1px solid #d9d9d9;border-radius:8px;padding:8px 10px;resize:none;"></textarea>
          </div>
        </div>
      `,
      onConfirm: async () => {
        const type = String(document.getElementById('mobileFinanceTypeInput')?.value || '').trim();
        const category = String(document.getElementById('mobileFinanceCategoryInput')?.value || '').trim();
        const amount = Number(document.getElementById('mobileFinanceAmountInput')?.value || 0);
        const transactionDateIso = String(document.getElementById('mobileFinanceDateIsoInput')?.value || '').trim();
        const description = String(document.getElementById('mobileFinanceDescInput')?.value || '').trim();

        if (!['income', 'expense'].includes(type)) {
          window.Toast.error('请选择正确的收支类型');
          return false;
        }
        if (!category) {
          window.Toast.error('请输入分类');
          return false;
        }
        if (!Number.isFinite(amount) || amount <= 0) {
          window.Toast.error('金额必须大于0');
          return false;
        }

        let transactionDateValue = new Date().toISOString();
        if (transactionDateIso) {
          const parsedDate = new Date(transactionDateIso);
          if (Number.isNaN(parsedDate.getTime())) {
            window.Toast.error('交易时间格式不正确');
            return false;
          }
          transactionDateValue = parsedDate.toISOString();
        }

        await window.API.createFinanceRecord({
          type,
          category,
          amount,
          description,
          transaction_date: transactionDateValue
        });

        window.Toast.success('财务记录已保存');
        this.setActiveTypeTab('');
        this.currentPage = 1;
        this.records = [];
        this.hasMore = true;
        await this.loadRecords();
        return true;
      }
    });

    setTimeout(() => {
      const datePickerBtn = document.getElementById('mobileFinanceDatePickerBtn');
      const datePickerText = document.getElementById('mobileFinanceDatePickerText');
      const dateIsoInput = document.getElementById('mobileFinanceDateIsoInput');
      if (!datePickerBtn || !datePickerText || !dateIsoInput || !window.Picker) return;

      datePickerBtn.addEventListener('click', async () => {
        try {
          const baseDate = new Date(String(dateIsoInput.value || ''));
          const currentDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;

          const pickedDate = await window.Picker.showDatePicker({
            title: '选择日期',
            value: currentDate
          });
          if (!pickedDate) return;

          const pickedTime = await window.Picker.showTimePicker({
            title: '选择时间',
            value: currentDate
          });
          if (!pickedTime || !Number.isFinite(pickedTime.hour) || !Number.isFinite(pickedTime.minute)) return;

          const mergedDate = new Date(
            pickedDate.getFullYear(),
            pickedDate.getMonth(),
            pickedDate.getDate(),
            Number(pickedTime.hour),
            Number(pickedTime.minute),
            0
          );
          if (Number.isNaN(mergedDate.getTime())) {
            window.Toast.error('交易时间格式不正确');
            return;
          }

          dateIsoInput.value = mergedDate.toISOString();
          datePickerText.textContent = window.Utils.formatDate(mergedDate, 'YYYY-MM-DD HH:mm');
        } catch (error) {
          console.error('交易时间选择失败:', error);
          window.Toast.error('交易时间选择失败');
        }
      });
    }, 0);

    await modalPromise;
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
            <div style="flex:1;min-width:0;">
              <div style="margin-bottom:6px;color:#475569;font-size:12px;">开始日期</div>
              <input id="financeFilterDateFrom" type="date" value="${this.escapeHtml(dateFrom)}"
                style="width:100%;min-width:0;box-sizing:border-box;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;" />
            </div>
            <div style="flex:1;min-width:0;">
              <div style="margin-bottom:6px;color:#475569;font-size:12px;">结束日期</div>
              <input id="financeFilterDateTo" type="date" value="${this.escapeHtml(dateTo)}"
                style="width:100%;min-width:0;box-sizing:border-box;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;" />
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
        this.rawRecords = [];
        this.allViewRecords = [];
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
          this.rawRecords = [];
          this.allViewRecords = [];
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
          const dateText = window.Utils.formatDate(item?.transaction_date || item?.created_at || new Date(), 'YYYY-MM-DD HH:mm:ss');
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
        this.rawRecords = [];
        this.allViewRecords = [];
        this.records = [];
        this.hasMore = true;
        await this.loadRecords();
      });
    }
  }
};
