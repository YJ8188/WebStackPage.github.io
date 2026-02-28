/**
 * 移动端ERP - 银行业务模块
 */

window.BankingModule = {
  name: 'banking',
  currentFlow: 'repayment',
  keyword: '',
  currentPage: 1,
  pageSize: 20,
  rawRows: [],
  allFlowRows: [],
  rows: [],
  hasMore: true,
  eventsBound: false,
  syncEventsBound: false,
  realtimeChannel: null,
  realtimeRefreshTimer: null,
  creditCardBanks: [
    '中国工商银行', '中国农业银行', '中国银行', '中国建设银行', '交通银行', '中国邮政储蓄银行',
    '招商银行', '浦发银行', '中信银行', '中国民生银行', '兴业银行', '平安银行', '华夏银行',
    '广发银行', '光大银行', '浙商银行', '渤海银行', '恒丰银行', '北京银行', '上海银行', '江苏银行',
    '南京银行', '宁波银行', '杭州银行', '徽商银行', '广州银行', '东莞银行', '天津银行',
    '重庆银行', '成都银行', '长沙银行', '青岛银行', '郑州银行', '兰州银行', '西安银行',
    '厦门银行', '苏州银行', '齐鲁银行', '江西银行', '哈尔滨银行', '盛京银行', '吉林银行',
    '汉口银行', '中原银行', '桂林银行', '农商银行信用卡', '其他银行'
  ],

  async init(params = {}) {
    this.currentFlow = this.normalizeFlow(params?.type || this.currentFlow || 'repayment');
    this.keyword = String(params?.keyword || this.keyword || '').trim();
    this.currentPage = 1;
    this.rawRows = [];
    this.allFlowRows = [];
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
        this.currentFlow = this.normalizeFlow(tab.dataset.type);
        this.currentPage = 1;
        if (!Array.isArray(this.rawRows) || this.rawRows.length === 0) {
          await this.loadRecords();
          return;
        }
        this.applyCurrentFlowRows();
        this.render();
      });
    });

    document.getElementById('bankingAddBtn')?.addEventListener('click', async () => {
      await this.showCreateActionSheet();
    });

    const searchInput = document.getElementById('bankingSearchInput');
    if (searchInput) {
      const onSearch = window.Utils?.debounce(async () => {
        this.keyword = String(searchInput.value || '').trim();
        this.currentPage = 1;
        this.rawRows = [];
        this.allFlowRows = [];
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
      this.allFlowRows = [];
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

  normalizeFlow(value) {
    const flow = String(value || '').trim().toLowerCase();
    return flow === 'swipe' ? 'swipe' : 'repayment';
  },

  applyFlowTab() {
    this.currentFlow = this.normalizeFlow(this.currentFlow);
    document.querySelectorAll('#bankingTabs .tab-item').forEach(tab => {
      const key = String(tab.dataset.type || '').trim().toLowerCase();
      tab.classList.toggle('active', key === this.currentFlow);
    });
    if (!document.querySelector('#bankingTabs .tab-item.active')) {
      const repaymentTab = document.querySelector('#bankingTabs .tab-item[data-type="repayment"]');
      if (repaymentTab) repaymentTab.classList.add('active');
      this.currentFlow = 'repayment';
    }
  },

  async fetchAllBankBusinessRecords() {
    const pageLimit = 200;
    const maxBatches = 60;
    let offset = 0;
    const rows = [];
    const seen = new Set();

    for (let i = 0; i < maxBatches; i += 1) {
      const chunk = await window.API.getBankBusinessRecords({
        type: '',
        keyword: this.keyword,
        limit: pageLimit,
        offset
      });
      if (!Array.isArray(chunk) || chunk.length === 0) {
        break;
      }

      chunk.forEach((row) => {
        const idKey = String(row?.id || '').trim();
        const fallbackKey = [
          row?.transaction_date || '',
          row?.created_at || '',
          row?.business_type || '',
          row?.category || '',
          row?.amount || '',
          row?.description || ''
        ].join('|');
        const rowKey = idKey || fallbackKey;
        if (seen.has(rowKey)) return;
        seen.add(rowKey);
        rows.push(row);
      });

      if (chunk.length < pageLimit) {
        break;
      }
      offset += pageLimit;
    }

    return rows;
  },

  applyCurrentFlowRows() {
    const preparedRows = this.prepareRowsForDisplay(this.rawRows);
    const flowRows = this.filterRowsByFlow(preparedRows);
    const safePage = Math.max(1, Number(this.currentPage) || 1);
    const end = safePage * this.pageSize;
    this.allFlowRows = flowRows;
    this.rows = flowRows.slice(0, end);
    this.hasMore = end < flowRows.length;
  },

  async loadRecords() {
    try {
      window.Loading.show('加载银行业务...');
      this.rawRows = await this.fetchAllBankBusinessRecords();
      this.applyCurrentFlowRows();
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
    this.applyCurrentFlowRows();
    this.render();
  },

  async showCreateActionSheet() {
    const openRepayment = async () => this.showAddRepaymentModal();
    const openSwipe = async () => this.showAddSwipeModal();
    const preferSwipe = this.currentFlow === 'swipe';
    const actions = preferSwipe
      ? [
          { text: '新增刷卡业务', icon: 'exchange', handler: openSwipe },
          { text: '新增还款业务', icon: 'credit-card', handler: openRepayment }
        ]
      : [
          { text: '新增还款业务', icon: 'credit-card', handler: openRepayment },
          { text: '新增刷卡业务', icon: 'exchange', handler: openSwipe }
        ];
    if (window.ActionSheet?.show) {
      await window.ActionSheet.show({
        title: '选择新增类型',
        actions
      });
      return;
    }
    if (preferSwipe) {
      await openSwipe();
      return;
    }
    await openRepayment();
  },

  getBankOptionsHtml(selected = '') {
    const selectedBank = String(selected || '').trim();
    return this.creditCardBanks.map(name => {
      const safeName = this.escapeHtml(name);
      const isSelected = selectedBank && selectedBank === name ? ' selected' : '';
      return `<option value="${safeName}"${isSelected}>${safeName}</option>`;
    }).join('');
  },

  parseTail4(value) {
    return String(value || '').replace(/\D/g, '').slice(-4);
  },

  formatMoneyText(amount) {
    const value = this.toAbsAmount(amount, 0);
    return window.Utils.formatMoney(value);
  },

  toShanghaiOffsetDateTime(value) {
    const partMap = window.Utils?.getDateParts?.(value || new Date());
    if (!partMap?.year || !partMap?.month || !partMap?.day) {
      const nowParts = window.Utils?.getDateParts?.(new Date());
      if (!nowParts?.year) return new Date().toISOString();
      return `${nowParts.year}-${nowParts.month}-${nowParts.day}T${nowParts.hour || '00'}:${nowParts.minute || '00'}:${nowParts.second || '00'}+08:00`;
    }
    return `${partMap.year}-${partMap.month}-${partMap.day}T${partMap.hour || '00'}:${partMap.minute || '00'}:${partMap.second || '00'}+08:00`;
  },

  toShanghaiDateTimeText(value) {
    return window.Utils.formatDate(value, 'YYYY/MM/DD HH:mm');
  },

  parseShanghaiDate(value) {
    const parsed = window.Utils?.parseDate?.(value);
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
  },

  parseOptionalDay(value) {
    const text = String(value ?? '').trim();
    if (!text) return 0;
    const day = Number(text);
    if (!Number.isInteger(day) || day < 1 || day > 31) return NaN;
    return day;
  },

  parseReminderDays(value, fallback = 3) {
    const num = Math.floor(Number(value));
    if (!Number.isFinite(num)) return fallback;
    return Math.min(30, Math.max(0, num));
  },

  getMonthlyDateByDay(baseDate, day, monthOffset = 0) {
    const safeDay = this.parseOptionalDay(day);
    if (!safeDay || Number.isNaN(safeDay)) return null;
    const target = new Date(baseDate.getFullYear(), baseDate.getMonth() + monthOffset, 1, 9, 0, 0, 0);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(Math.max(1, safeDay), lastDay));
    return target;
  },

  getUpcomingMonthlyDate(baseDate, day) {
    const thisMonth = this.getMonthlyDateByDay(baseDate, day, 0);
    if (!thisMonth) return null;
    const baseDayStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0, 0, 0);
    const thisMonthDayStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), thisMonth.getDate(), 0, 0, 0, 0);
    if (baseDayStart.getTime() <= thisMonthDayStart.getTime()) {
      return thisMonth;
    }
    return this.getMonthlyDateByDay(baseDate, day, 1);
  },

  addDaysToDate(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + Number(days || 0));
    return next;
  },

  formatRuleDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '-';
    return window.Utils.formatDate(date, 'YYYY-MM-DD');
  },

  buildBankCycleRecommendation(baseDateRaw, billDayRaw, repaymentDayRaw) {
    const billDay = this.parseOptionalDay(billDayRaw);
    const repaymentDay = this.parseOptionalDay(repaymentDayRaw);
    if (!billDay || !repaymentDay || Number.isNaN(billDay) || Number.isNaN(repaymentDay)) {
      return null;
    }
    const baseDate = this.parseShanghaiDate(baseDateRaw) || new Date();
    const nextBillDate = this.getUpcomingMonthlyDate(baseDate, billDay);
    if (!nextBillDate) return null;
    const recommendSwipeStart = this.addDaysToDate(nextBillDate, 1);
    const recommendSwipeEnd = this.addDaysToDate(nextBillDate, 5);
    const dueDate = repaymentDay > billDay
      ? this.getMonthlyDateByDay(nextBillDate, repaymentDay, 0)
      : this.getMonthlyDateByDay(nextBillDate, repaymentDay, 1);
    if (!dueDate) return null;
    const recommendRepayDate = this.addDaysToDate(dueDate, -2);
    const remindSuggestDate = this.addDaysToDate(dueDate, -3);
    return {
      nextBillDate,
      recommendSwipeStart,
      recommendSwipeEnd,
      dueDate,
      recommendRepayDate,
      remindSuggestDate
    };
  },

  getCreditReminderDate(transactionDateText, repaymentDay, reminderDaysBefore = 0) {
    const baseDate = this.parseShanghaiDate(transactionDateText) || new Date();
    const dueThisMonth = this.getMonthlyDateByDay(baseDate, repaymentDay, 0);
    if (!dueThisMonth) return null;
    let dueDate = dueThisMonth;
    if (dueDate.getTime() < baseDate.getTime()) {
      const next = this.getMonthlyDateByDay(baseDate, repaymentDay, 1);
      if (next) dueDate = next;
    }
    const reminderDate = new Date(dueDate);
    reminderDate.setDate(dueDate.getDate() - this.parseReminderDays(reminderDaysBefore, 0));
    return Number.isNaN(reminderDate.getTime()) ? null : reminderDate;
  },

  bindDateTimePickerButton({
    buttonId,
    textId,
    isoInputId,
    dateTitle = '选择日期',
    timeTitle = '选择时间',
    onChange = null
  }) {
    setTimeout(() => {
      const pickerBtn = document.getElementById(buttonId);
      const pickerText = document.getElementById(textId);
      const isoInput = document.getElementById(isoInputId);
      if (!pickerBtn || !pickerText || !isoInput || !window.Picker) return;

      pickerBtn.addEventListener('click', async () => {
        try {
          const baseDate = this.parseShanghaiDate(String(isoInput.value || ''));
          const currentDate = baseDate || new Date();

          const pickedDate = await window.Picker.showDatePicker({
            title: dateTitle,
            value: currentDate
          });
          if (!pickedDate) return;

          const pickedTime = await window.Picker.showTimePicker({
            title: timeTitle,
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

          isoInput.value = this.toShanghaiOffsetDateTime(mergedDate);
          pickerText.textContent = this.toShanghaiDateTimeText(mergedDate);
          if (typeof onChange === 'function') onChange(mergedDate);
        } catch (error) {
          console.error('选择交易时间失败:', error);
          window.Toast.error('选择交易时间失败');
        }
      });
    }, 0);
  },

  async refreshAfterCreate(nextFlow = '') {
    if (nextFlow) {
      this.currentFlow = this.normalizeFlow(nextFlow);
      this.applyFlowTab();
    }
    this.currentPage = 1;
    this.rawRows = [];
    this.allFlowRows = [];
    this.rows = [];
    this.hasMore = true;
    await this.loadRecords();
  },

  updateRepaymentRuleHint() {
    const hintEl = document.getElementById('mobileBankRepaymentRuleHint');
    if (!hintEl) return;
    const billDay = this.parseOptionalDay(document.getElementById('mobileBankRepaymentBillDayInput')?.value || '');
    const repaymentDay = this.parseOptionalDay(document.getElementById('mobileBankRepaymentDayInput')?.value || '');
    const reminderDaysBefore = this.parseReminderDays(document.getElementById('mobileBankRepaymentReminderDaysInput')?.value || 3, 3);
    const repaymentAmount = Math.max(0, Number(document.getElementById('mobileBankRepaymentAmountInput')?.value || 0));
    const transactionDate = String(document.getElementById('mobileBankRepaymentDateIsoInput')?.value || '').trim() || this.toShanghaiOffsetDateTime(new Date());
    const recommendation = this.buildBankCycleRecommendation(transactionDate, billDay, repaymentDay);

    if (!recommendation) {
      hintEl.textContent = '规则建议：请先填写账单日与还款日，系统将自动推荐最佳刷卡时间与还款时间。';
      return;
    }

    hintEl.innerHTML = [
      '规则建议：账单日后刷卡更容易拿到更长免息期。',
      repaymentAmount > 0 ? `本期应还金额：${this.escapeHtml(this.formatMoneyText(repaymentAmount))}。` : '本期应还金额：未填写。',
      `推荐刷卡窗口：${this.escapeHtml(this.formatRuleDate(recommendation.recommendSwipeStart))} 至 ${this.escapeHtml(this.formatRuleDate(recommendation.recommendSwipeEnd))}。`,
      `下次账单日：${this.escapeHtml(this.formatRuleDate(recommendation.nextBillDate))}；下次还款日：${this.escapeHtml(this.formatRuleDate(recommendation.dueDate))}。`,
      `推荐还款时间：${this.escapeHtml(this.formatRuleDate(recommendation.recommendRepayDate))}（建议至少提前 2 天），提醒可设在 ${this.escapeHtml(this.formatRuleDate(recommendation.remindSuggestDate))}。`,
      `<strong>提醒提前天数：</strong>${this.escapeHtml(String(reminderDaysBefore))} 天`
    ].join('<br>');
  },

  updateSwipeFeePreview() {
    const swipeInput = document.getElementById('mobileBankSwipeAmountInput');
    const actualInput = document.getElementById('mobileBankSwipeActualInput');
    const feeInput = document.getElementById('mobileBankSwipeFeeInput');
    const feeRateInput = document.getElementById('mobileBankSwipeFeeRateInput');
    if (!swipeInput || !actualInput || !feeInput || !feeRateInput) return;
    const swipe = Math.max(0, Number(swipeInput.value || 0));
    const actual = Math.max(0, Number(actualInput.value || 0));
    const fee = Math.max(0, swipe - actual);
    const rate = swipe > 0 ? (fee / swipe) * 100 : 0;
    feeInput.value = fee.toFixed(2);
    feeRateInput.value = `${rate.toFixed(2)}%`;
  },

  setupRepaymentModalBehavior() {
    this.bindDateTimePickerButton({
      buttonId: 'mobileBankRepaymentDatePickerBtn',
      textId: 'mobileBankRepaymentDatePickerText',
      isoInputId: 'mobileBankRepaymentDateIsoInput',
      dateTitle: '选择还款日期',
      timeTitle: '选择还款时间',
      onChange: () => this.updateRepaymentRuleHint()
    });

    const billInput = document.getElementById('mobileBankRepaymentBillDayInput');
    const repaymentInput = document.getElementById('mobileBankRepaymentDayInput');
    const amountInput = document.getElementById('mobileBankRepaymentAmountInput');
    const reminderInput = document.getElementById('mobileBankRepaymentReminderDaysInput');
    [billInput, repaymentInput, amountInput, reminderInput].forEach(el => {
      if (!el) return;
      el.addEventListener('input', () => this.updateRepaymentRuleHint());
    });
    this.updateRepaymentRuleHint();
  },

  setupSwipeModalBehavior() {
    this.bindDateTimePickerButton({
      buttonId: 'mobileBankSwipeDatePickerBtn',
      textId: 'mobileBankSwipeDatePickerText',
      isoInputId: 'mobileBankSwipeDateIsoInput',
      dateTitle: '选择刷卡日期',
      timeTitle: '选择刷卡时间'
    });

    const swipeInput = document.getElementById('mobileBankSwipeAmountInput');
    const actualInput = document.getElementById('mobileBankSwipeActualInput');
    [swipeInput, actualInput].forEach(el => {
      if (!el) return;
      el.addEventListener('input', () => this.updateSwipeFeePreview());
    });
    this.updateSwipeFeePreview();
  },

  async showAddRepaymentModal() {
    const now = new Date();
    const defaultDateIso = this.toShanghaiOffsetDateTime(now);
    const defaultDateText = this.toShanghaiDateTimeText(now);
    const bankOptionsHtml = this.getBankOptionsHtml();

    const modalPromise = window.Modal.show({
      title: '新增还款业务',
      confirmText: '保存',
      cancelText: '取消',
      showClose: true,
      maxWidth: '560px',
      containerClass: 'mobile-banking-modal',
      bodyClass: 'mobile-banking-modal-body',
      content: `
        <div class="mobile-banking-form">
          <div class="mobile-banking-panel">
            <div class="mobile-banking-panel-title">还款业务板块</div>
            <div class="mobile-banking-row">
              <label class="mobile-banking-label">交易时间</label>
              <input id="mobileBankRepaymentDateIsoInput" type="hidden" value="${defaultDateIso}" />
              <button id="mobileBankRepaymentDatePickerBtn" type="button" class="mobile-banking-date-btn">
                <span id="mobileBankRepaymentDatePickerText">${defaultDateText}</span>
                <i class="fa fa-calendar-o"></i>
              </button>
            </div>
            <div class="mobile-banking-row">
              <label class="mobile-banking-label">还款信用卡银行 <span class="required">*</span></label>
              <select id="mobileBankRepaymentBankInput" class="mobile-banking-select">
                <option value="">请选择银行</option>
                ${bankOptionsHtml}
              </select>
            </div>
            <div class="mobile-banking-row">
              <label class="mobile-banking-label">信用卡尾号4位（可选）</label>
              <input id="mobileBankRepaymentCardTailInput" class="mobile-banking-input" type="text" maxlength="4" placeholder="例如 1234" />
            </div>
            <div class="mobile-banking-row two-col">
              <div>
                <label class="mobile-banking-label">账单日（每月）<span class="required">*</span></label>
                <input id="mobileBankRepaymentBillDayInput" class="mobile-banking-input" type="number" min="1" max="31" step="1" placeholder="1-31" />
              </div>
              <div>
                <label class="mobile-banking-label">还款日（每月）<span class="required">*</span></label>
                <input id="mobileBankRepaymentDayInput" class="mobile-banking-input" type="number" min="1" max="31" step="1" placeholder="1-31" />
              </div>
            </div>
            <div class="mobile-banking-row two-col">
              <div>
                <label class="mobile-banking-label">提醒设置</label>
                <select id="mobileBankRepaymentReminderEnabledInput" class="mobile-banking-select">
                  <option value="1">开启提醒</option>
                  <option value="0">关闭提醒</option>
                </select>
              </div>
              <div>
                <label class="mobile-banking-label">提前天数</label>
                <input id="mobileBankRepaymentReminderDaysInput" class="mobile-banking-input" type="number" min="0" max="30" step="1" value="3" />
              </div>
            </div>
            <div class="mobile-banking-row">
              <label class="mobile-banking-label">应还金额 <span class="required">*</span></label>
              <input id="mobileBankRepaymentAmountInput" class="mobile-banking-input" type="number" min="0.01" step="0.01" placeholder="本期需还金额" />
            </div>
            <div class="mobile-banking-row">
              <div id="mobileBankRepaymentRuleHint" class="mobile-banking-hint">规则建议：请先填写账单日与还款日，系统将自动推荐最佳刷卡时间与还款时间。</div>
            </div>
            <div class="mobile-banking-row">
              <label class="mobile-banking-label">备注</label>
              <input id="mobileBankRepaymentDescInput" class="mobile-banking-input" type="text" maxlength="120" placeholder="可选：还款备注" />
            </div>
          </div>
        </div>
      `,
      onConfirm: async () => {
        const bank = String(document.getElementById('mobileBankRepaymentBankInput')?.value || '').trim();
        const cardTail = this.parseTail4(document.getElementById('mobileBankRepaymentCardTailInput')?.value || '');
        const amount = Number(document.getElementById('mobileBankRepaymentAmountInput')?.value || 0);
        const billDay = this.parseOptionalDay(document.getElementById('mobileBankRepaymentBillDayInput')?.value || '');
        const repaymentDay = this.parseOptionalDay(document.getElementById('mobileBankRepaymentDayInput')?.value || '');
        const reminderEnabled = String(document.getElementById('mobileBankRepaymentReminderEnabledInput')?.value || '1') === '1';
        const reminderDaysBefore = this.parseReminderDays(document.getElementById('mobileBankRepaymentReminderDaysInput')?.value || 3, 3);
        const transactionDateIso = String(document.getElementById('mobileBankRepaymentDateIsoInput')?.value || '').trim();
        const customDesc = String(document.getElementById('mobileBankRepaymentDescInput')?.value || '').trim();

        if (!bank) {
          window.Toast.error('请选择还款信用卡银行');
          return false;
        }
        if (!Number.isFinite(amount) || amount <= 0) {
          window.Toast.error('应还金额必须大于0');
          return false;
        }
        if (!billDay || !repaymentDay || Number.isNaN(billDay) || Number.isNaN(repaymentDay)) {
          window.Toast.error('账单日与还款日需在1-31之间');
          return false;
        }

        const parsedDate = this.parseShanghaiDate(transactionDateIso);
        if (!(parsedDate instanceof Date) || Number.isNaN(parsedDate.getTime())) {
          window.Toast.error('交易时间格式不正确');
          return false;
        }
        const normalizedDate = this.toShanghaiOffsetDateTime(parsedDate);
        const reminderDateObj = reminderEnabled
          ? this.getCreditReminderDate(normalizedDate, repaymentDay, reminderDaysBefore)
          : null;
        const recommendation = this.buildBankCycleRecommendation(normalizedDate, billDay, repaymentDay);
        const reminderText = reminderEnabled
          ? `提醒：提前${reminderDaysBefore}天（${reminderDateObj ? this.formatRuleDate(reminderDateObj) : '待计算'}）`
          : '提醒：关闭';
        const recommendationText = recommendation
          ? `建议：账单后刷卡 ${this.formatRuleDate(recommendation.recommendSwipeStart)}~${this.formatRuleDate(recommendation.recommendSwipeEnd)}，还款建议 ${this.formatRuleDate(recommendation.recommendRepayDate)}`
          : '';

        const description = [
          customDesc,
          `银行：${bank}${cardTail ? `（尾号${cardTail}）` : ''}`,
          `应还：${this.formatMoneyText(amount)}`,
          `账单日：每月${billDay}日`,
          `还款日：每月${repaymentDay}日`,
          reminderText,
          recommendationText
        ].filter(Boolean).join('；');

        await window.API.createFinanceRecord({
          business_type: 'credit_card_repayment',
          type: 'expense',
          category: '信用卡还款',
          amount,
          description,
          transaction_date: normalizedDate,
          card_bank: bank,
          card_bill_day: billDay,
          card_repayment_day: repaymentDay,
          card_repayment_amount: amount,
          card_tail: cardTail || null,
          reminder_enabled: reminderEnabled,
          reminder_days_before: reminderDaysBefore,
          reminder_date: reminderDateObj ? this.toShanghaiOffsetDateTime(reminderDateObj) : null
        });

        window.Toast.success('还款业务已保存');
        await this.refreshAfterCreate('repayment');
        return true;
      }
    });

    this.setupRepaymentModalBehavior();

    await modalPromise;
  },

  async showAddSwipeModal() {
    const now = new Date();
    const defaultDateIso = this.toShanghaiOffsetDateTime(now);
    const defaultDateText = this.toShanghaiDateTimeText(now);
    const bankOptionsHtml = this.getBankOptionsHtml();

    const modalPromise = window.Modal.show({
      title: '新增刷卡业务',
      confirmText: '保存',
      cancelText: '取消',
      showClose: true,
      maxWidth: '560px',
      containerClass: 'mobile-banking-modal',
      bodyClass: 'mobile-banking-modal-body',
      content: `
        <div class="mobile-banking-form">
          <div class="mobile-banking-panel">
            <div class="mobile-banking-panel-title">刷卡业务板块</div>
            <div class="mobile-banking-row">
              <label class="mobile-banking-label">交易时间</label>
              <input id="mobileBankSwipeDateIsoInput" type="hidden" value="${defaultDateIso}" />
              <button id="mobileBankSwipeDatePickerBtn" type="button" class="mobile-banking-date-btn">
                <span id="mobileBankSwipeDatePickerText">${defaultDateText}</span>
                <i class="fa fa-calendar-o"></i>
              </button>
            </div>
            <div class="mobile-banking-row two-col">
              <div>
                <label class="mobile-banking-label">刷卡信用卡银行 <span class="required">*</span></label>
                <select id="mobileBankSwipeBankInput" class="mobile-banking-select">
                  <option value="">请选择银行</option>
                  ${bankOptionsHtml}
                </select>
              </div>
              <div>
                <label class="mobile-banking-label">到账储蓄卡银行 <span class="required">*</span></label>
                <select id="mobileBankSettlementBankInput" class="mobile-banking-select">
                  <option value="">请选择银行</option>
                  ${bankOptionsHtml}
                </select>
              </div>
            </div>
            <div class="mobile-banking-row two-col">
              <div>
                <label class="mobile-banking-label">刷卡信用卡尾号（可选）</label>
                <input id="mobileBankSwipeCardTailInput" class="mobile-banking-input" type="text" maxlength="4" placeholder="例如 1234" />
              </div>
              <div>
                <label class="mobile-banking-label">到账储蓄卡尾号（可选）</label>
                <input id="mobileBankSettlementCardTailInput" class="mobile-banking-input" type="text" maxlength="4" placeholder="例如 6688" />
              </div>
            </div>
            <div class="mobile-banking-row two-col">
              <div>
                <label class="mobile-banking-label">刷卡金额（本次） <span class="required">*</span></label>
                <input id="mobileBankSwipeAmountInput" class="mobile-banking-input" type="number" min="0.01" step="0.01" placeholder="例如 1000" />
              </div>
              <div>
                <label class="mobile-banking-label">实际到账金额（储蓄卡） <span class="required">*</span></label>
                <input id="mobileBankSwipeActualInput" class="mobile-banking-input" type="number" min="0.01" step="0.01" placeholder="例如 994" />
              </div>
            </div>
            <div class="mobile-banking-row">
              <label class="mobile-banking-label">扣除费用（自动计算）</label>
              <input id="mobileBankSwipeFeeInput" class="mobile-banking-readonly" type="text" readonly value="0.00" />
            </div>
            <div class="mobile-banking-row">
              <label class="mobile-banking-label">扣费费率（自动计算）</label>
              <input id="mobileBankSwipeFeeRateInput" class="mobile-banking-readonly" type="text" readonly value="0.00%" />
            </div>
            <div class="mobile-banking-row">
              <label class="mobile-banking-label">备注</label>
              <input id="mobileBankSwipeDescInput" class="mobile-banking-input" type="text" maxlength="120" placeholder="可选：刷卡备注、渠道" />
            </div>
          </div>
        </div>
      `,
      onConfirm: async () => {
        const swipeBank = String(document.getElementById('mobileBankSwipeBankInput')?.value || '').trim();
        const settlementBank = String(document.getElementById('mobileBankSettlementBankInput')?.value || '').trim();
        const swipeCardTail = this.parseTail4(document.getElementById('mobileBankSwipeCardTailInput')?.value || '');
        const settlementCardTail = this.parseTail4(document.getElementById('mobileBankSettlementCardTailInput')?.value || '');
        const swipeAmount = Number(document.getElementById('mobileBankSwipeAmountInput')?.value || 0);
        const actualAmount = Number(document.getElementById('mobileBankSwipeActualInput')?.value || 0);
        const transactionDateIso = String(document.getElementById('mobileBankSwipeDateIsoInput')?.value || '').trim();
        const customDesc = String(document.getElementById('mobileBankSwipeDescInput')?.value || '').trim();

        if (!swipeBank) {
          window.Toast.error('请选择刷卡信用卡银行');
          return false;
        }
        if (!settlementBank) {
          window.Toast.error('请选择到账储蓄卡银行');
          return false;
        }
        if (!Number.isFinite(swipeAmount) || swipeAmount <= 0) {
          window.Toast.error('刷卡金额必须大于0');
          return false;
        }
        if (!Number.isFinite(actualAmount) || actualAmount <= 0) {
          window.Toast.error('到账金额必须大于0');
          return false;
        }
        if (actualAmount > swipeAmount) {
          window.Toast.error('到账金额不能大于刷卡金额');
          return false;
        }

        const parsedDate = this.parseShanghaiDate(transactionDateIso);
        if (!(parsedDate instanceof Date) || Number.isNaN(parsedDate.getTime())) {
          window.Toast.error('交易时间格式不正确');
          return false;
        }
        const normalizedDate = this.toShanghaiOffsetDateTime(parsedDate);

        const feeAmount = Math.max(0, swipeAmount - actualAmount);
        const feeRate = swipeAmount > 0 ? (feeAmount / swipeAmount) * 100 : 0;
        const settlementCardText = `${settlementBank}${settlementCardTail ? `（尾号${settlementCardTail}）` : ''}`;
        const description = [
          customDesc,
          `银行：${swipeBank}${swipeCardTail ? `（尾号${swipeCardTail}）` : ''}`,
          `刷卡卡：${swipeBank}${swipeCardTail ? `（尾号${swipeCardTail}）` : ''}`,
          `到账卡：${settlementCardText}`,
          `刷卡：${this.formatMoneyText(swipeAmount)}`,
          `到账：${this.formatMoneyText(actualAmount)}`,
          `手续费：${this.formatMoneyText(feeAmount)}`,
          `费率：${feeRate.toFixed(2)}%`
        ].filter(Boolean).join('；');

        await window.API.createFinanceRecord({
          business_type: 'credit_card_swipe',
          type: 'income',
          category: '信用卡刷卡',
          amount: actualAmount,
          description,
          transaction_date: normalizedDate,
          card_bank: swipeBank,
          card_swipe_amount: swipeAmount,
          card_actual_amount: actualAmount,
          card_fee_amount: feeAmount,
          card_fee_rate: Number(feeRate.toFixed(4)),
          card_tail: swipeCardTail || null,
          swipe_card_bank: swipeBank,
          settlement_bank: settlementBank,
          settlement_card_tail: settlementCardTail || null
        });

        window.Toast.success('刷卡业务已保存');
        await this.refreshAfterCreate('swipe');
        return true;
      }
    });

    this.setupSwipeModalBehavior();

    await modalPromise;
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

  isFeeOnlyRow(row = {}) {
    const businessType = String(row?.business_type || '').trim().toLowerCase();
    const category = String(row?.category || '').trim();
    return businessType === 'credit_card_fee'
      || category.includes('银行手续费');
  },

  isSwipeRow(row = {}) {
    if (this.isFeeOnlyRow(row)) return true;
    if (this.isRepaymentRow(row)) return false;
    const businessType = String(row?.business_type || '').trim().toLowerCase();
    const category = String(row?.category || '').trim();
    const description = String(row?.description || '').trim();
    return businessType === 'credit_card_swipe'
      || category.includes('信用卡刷卡')
      || /刷卡卡|到账卡|刷卡[:：]|到账[:：]|手续费|费率/.test(description);
  },

  getCycleMonthKey(row = {}) {
    const partMap = window.Utils?.getDateParts?.(
      row?.transaction_date || row?.created_at || null
    );
    if (!partMap?.year || !partMap?.month) return '';
    return `${partMap.year}-${partMap.month}`;
  },

  normalizeKeyText(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[（(]/g, '')
      .replace(/[）)]/g, '');
  },

  normalizeBankName(value) {
    return String(value || '')
      .trim()
      .replace(/（?\s*尾号\s*\d{3,4}\s*）?/g, '')
      .replace(/\(.*?\)/g, '')
      .replace(/（.*?）/g, '')
      .replace(/\s+/g, '')
      .toLowerCase();
  },

  getTransactionMinuteKey(row = {}) {
    const partMap = window.Utils?.getDateParts?.(
      row?.transaction_date || row?.created_at || null
    );
    if (!partMap?.year || !partMap?.month || !partMap?.day) return '';
    return `${partMap.year}-${partMap.month}-${partMap.day} ${partMap.hour || '00'}:${partMap.minute || '00'}`;
  },

  buildDisplayDedupKey(row = {}) {
    if (!this.isRepaymentPlanRow(row)) return '';
    const bank = this.normalizeBankName(this.getBankName(row) || '') || 'unknown_bank';
    const tail = this.parseTail4(this.getRepaymentCardTail(row) || '') || 'no_tail';
    const billDay = Number(this.getRepaymentBillDay(row) || 0);
    const repaymentDay = Number(this.getRepaymentDay(row) || 0);
    const cycleMonth = this.getCycleMonthKey(row) || 'unknown_month';
    return `repayment|${bank}|${tail}|${billDay}|${repaymentDay}|${cycleMonth}`;
  },

  getFieldTimestamp(row = {}, fieldName = '') {
    const parsed = this.parseShanghaiDate(row?.[fieldName] ?? null);
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : 0;
  },

  getTransactionTimestamp(row = {}) {
    const parsed = this.parseShanghaiDate(row?.transaction_date || row?.created_at || null);
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : 0;
  },

  shouldReplaceDisplayRow(candidate = {}, current = {}) {
    const candidateUpdated = this.getFieldTimestamp(candidate, 'updated_at');
    const currentUpdated = this.getFieldTimestamp(current, 'updated_at');
    if (candidateUpdated !== currentUpdated) return candidateUpdated > currentUpdated;

    const candidateTx = this.getTransactionTimestamp(candidate);
    const currentTx = this.getTransactionTimestamp(current);
    if (candidateTx !== currentTx) return candidateTx > currentTx;

    const candidateCreated = this.getFieldTimestamp(candidate, 'created_at');
    const currentCreated = this.getFieldTimestamp(current, 'created_at');
    if (candidateCreated !== currentCreated) return candidateCreated > currentCreated;

    return String(candidate?.id || '') > String(current?.id || '');
  },

  buildFlowFingerprint(row = {}) {
    const txMinute = this.getTransactionMinuteKey(row) || 'unknown_minute';
    if (this.isRepaymentPlanRow(row)) {
      const bank = this.normalizeBankName(this.getBankName(row) || '') || 'unknown_bank';
      const tail = this.parseTail4(this.getRepaymentCardTail(row) || '') || 'no_tail';
      const billDay = Number(this.getRepaymentBillDay(row) || 0) || 0;
      const repaymentDay = Number(this.getRepaymentDay(row) || 0) || 0;
      const dueAmount = Number(this.getRepaymentDueAmount(row) || 0).toFixed(2);
      return `repayment|${bank}|${tail}|${billDay}|${repaymentDay}|${dueAmount}|${txMinute}`;
    }
    if (this.isSwipeRow(row)) {
      const swipeBank = this.normalizeBankName(row?.swipe_card_bank || row?.card_bank || this.getBankName(row) || '') || 'unknown_bank';
      const swipeTail = this.parseTail4(this.getSwipeCardTail(row) || this.getRepaymentCardTail(row) || '') || 'no_tail';
      const settlementBank = this.normalizeBankName(row?.settlement_bank || '') || 'unknown_settlement';
      const settlementTail = this.parseTail4(this.getSettlementCardTail(row) || '') || 'no_tail';
      const gross = Number(this.getSwipeGrossAmount(row) || 0).toFixed(2);
      const actual = Number(this.getSwipeActualAmount(row) || 0).toFixed(2);
      const fee = Number(this.getSwipeFeeAmount(row) || 0).toFixed(2);
      const feeOnly = this.isFeeOnlyRow(row) ? '1' : '0';
      return `swipe|${feeOnly}|${swipeBank}|${swipeTail}|${settlementBank}|${settlementTail}|${gross}|${actual}|${fee}|${txMinute}`;
    }
    return '';
  },

  buildRepaymentSemanticKey(row = {}) {
    if (!this.isRepaymentPlanRow(row)) return '';
    const bank = this.normalizeBankName(this.getBankName(row) || '') || 'unknown_bank';
    const billDay = Number(this.getRepaymentBillDay(row) || 0) || 0;
    const repaymentDay = Number(this.getRepaymentDay(row) || 0) || 0;
    const dueAmount = Number(this.getRepaymentDueAmount(row) || 0).toFixed(2);
    const cycleMonth = this.getCycleMonthKey(row) || 'unknown_month';
    const reminderDate = String(row?.reminder_date || '').trim();
    const reminderKey = row?.reminder_enabled === false
      ? 'off'
      : (reminderDate ? `on:${window.Utils.formatDate(reminderDate, 'YYYY-MM-DD')}` : 'on:pending');
    return `repay-sem|${bank}|${billDay}|${repaymentDay}|${dueAmount}|${cycleMonth}|${reminderKey}`;
  },

  dedupeRepaymentSemanticRows(rows = []) {
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return [];

    const keepMap = new Map();
    const passthrough = [];
    list.forEach((row) => {
      const key = this.buildRepaymentSemanticKey(row);
      if (!key) {
        passthrough.push(row);
        return;
      }
      const current = keepMap.get(key);
      if (!current || this.shouldReplaceDisplayRow(row, current)) {
        keepMap.set(key, row);
      }
    });
    return [...passthrough, ...Array.from(keepMap.values())];
  },

  dedupeRowsByFingerprint(rows = []) {
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return [];

    const keepMap = new Map();
    const passthrough = [];
    list.forEach((row) => {
      const key = this.buildFlowFingerprint(row);
      if (!key) {
        passthrough.push(row);
        return;
      }
      const current = keepMap.get(key);
      if (!current || this.shouldReplaceDisplayRow(row, current)) {
        keepMap.set(key, row);
      }
    });
    return [...passthrough, ...Array.from(keepMap.values())];
  },

  dedupeRowsForDisplay(rows = []) {
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return [];

    const keepMap = new Map();
    const passthrough = [];
    list.forEach((row) => {
      const key = this.buildDisplayDedupKey(row);
      if (!key) {
        passthrough.push(row);
        return;
      }
      const current = keepMap.get(key);
      if (!current || this.shouldReplaceDisplayRow(row, current)) {
        keepMap.set(key, row);
      }
    });
    return [...passthrough, ...Array.from(keepMap.values())];
  },

  getRepaymentDueDateForSort(row = {}) {
    if (!this.isRepaymentPlanRow(row)) return Number.POSITIVE_INFINITY;
    const baseDate = this.parseShanghaiDate(row?.transaction_date || row?.created_at || null) || new Date();
    const billDay = this.getRepaymentBillDay(row);
    const repaymentDay = this.getRepaymentDay(row);
    if (!repaymentDay) return Number.POSITIVE_INFINITY;

    let dueDate = null;
    if (billDay) {
      dueDate = this.buildBankCycleRecommendation(baseDate, billDay, repaymentDay)?.dueDate || null;
    }
    if (!(dueDate instanceof Date) || Number.isNaN(dueDate.getTime())) {
      dueDate = this.getMonthlyDateByDay(baseDate, repaymentDay, 0);
      if (dueDate && dueDate.getTime() < baseDate.getTime()) {
        dueDate = this.getMonthlyDateByDay(baseDate, repaymentDay, 1);
      }
    }
    if (!(dueDate instanceof Date) || Number.isNaN(dueDate.getTime())) {
      return Number.POSITIVE_INFINITY;
    }
    return dueDate.getTime();
  },

  sortRowsForDisplay(rows = []) {
    const list = Array.isArray(rows) ? rows : [];
    const uniqueById = new Map();
    list.forEach((row) => {
      const id = String(row?.id || '').trim();
      const key = id || `fallback|${this.buildFlowFingerprint(row) || this.buildRepaymentSemanticKey(row) || Math.random()}`;
      const current = uniqueById.get(key);
      if (!current || this.shouldReplaceDisplayRow(row, current)) {
        uniqueById.set(key, row);
      }
    });
    const safeList = Array.from(uniqueById.values());

    const repaymentRows = safeList
      .filter(row => this.isRepaymentPlanRow(row))
      .sort((left, right) => {
        const leftDue = this.getRepaymentDueDateForSort(left);
        const rightDue = this.getRepaymentDueDateForSort(right);
        if (leftDue !== rightDue) return leftDue - rightDue;

        const leftBank = String(this.getBankName(left) || '').trim();
        const rightBank = String(this.getBankName(right) || '').trim();
        const bankCompare = leftBank.localeCompare(rightBank, 'zh-CN');
        if (bankCompare !== 0) return bankCompare;

        const leftTs = this.getTransactionTimestamp(left);
        const rightTs = this.getTransactionTimestamp(right);
        if (leftTs !== rightTs) return rightTs - leftTs;
        return String(right?.id || '').localeCompare(String(left?.id || ''), 'zh-CN');
      });

    const swipeRows = safeList
      .filter(row => this.isSwipeRow(row))
      .sort((left, right) => {
        const leftTs = this.getTransactionTimestamp(left);
        const rightTs = this.getTransactionTimestamp(right);
        if (leftTs !== rightTs) return rightTs - leftTs;
        return String(right?.id || '').localeCompare(String(left?.id || ''), 'zh-CN');
      });

    return [...repaymentRows, ...swipeRows];
  },

  prepareRowsForDisplay(rows = []) {
    const source = Array.isArray(rows) ? rows : [];
    const filtered = source.filter(row => !this.isRepaymentPaymentRow(row));
    const dedupedByCycle = this.dedupeRowsForDisplay(filtered);
    const dedupedByFingerprint = this.dedupeRowsByFingerprint(dedupedByCycle);
    const dedupedByRepaymentSemantic = this.dedupeRepaymentSemanticRows(dedupedByFingerprint);
    return this.sortRowsForDisplay(dedupedByRepaymentSemantic);
  },

  filterRowsByFlow(rows = []) {
    const list = Array.isArray(rows) ? rows : [];
    if (this.currentFlow === 'swipe') {
      return list.filter(row => this.isSwipeRow(row));
    }
    return list.filter(row => this.isRepaymentPlanRow(row));
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
    if (this.isFeeOnlyRow(row)) return 0;
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
    if (this.isFeeOnlyRow(row)) return 0;
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
    if (this.isFeeOnlyRow(row)) {
      return this.toAbsAmount(row?.card_fee_amount || row?.amount || 0, 0);
    }
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
    const source = Array.isArray(rows) ? rows : [];
    const displayRows = this.prepareRowsForDisplay(source);
    const repaymentPlanRows = displayRows.filter(row => this.isRepaymentPlanRow(row));
    const repaymentPaymentRows = source.filter(row => this.isRepaymentPaymentRow(row));
    const swipeRows = displayRows.filter(row => this.isSwipeRow(row));

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
    if (this.isFeeOnlyRow(row)) return '银行手续费';
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

  getPrimaryAmountMeta(row = {}) {
    if (this.isRepaymentPlanRow(row)) {
      return {
        text: window.Utils.formatMoney(this.getRepaymentDueAmount(row)),
        color: '#dc2626'
      };
    }
    if (this.isSwipeRow(row)) {
      if (this.isFeeOnlyRow(row)) {
        return {
          text: window.Utils.formatMoney(this.getSwipeFeeAmount(row)),
          color: '#dc2626'
        };
      }
      return {
        text: window.Utils.formatMoney(this.getSwipeGrossAmount(row)),
        color: '#1d4ed8'
      };
    }
    return {
      text: this.formatAmountText(row),
      color: this.getAmountColor(row)
    };
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
    const match = description.match(/(?:银行|还款卡|还款入账卡|刷卡卡|到账卡)[:：]\s*([^；\n]+)/);
    return match?.[1] ? String(match[1]).trim() : '未标注银行';
  },

  extractTailFromText(description, preferredPattern = null) {
    const text = String(description || '');
    if (preferredPattern) {
      const preferredMatch = text.match(preferredPattern);
      if (preferredMatch?.[1]) return this.parseTail4(preferredMatch[1]);
    }
    const commonMatch = text.match(/尾号\s*(\d{3,4})/);
    return commonMatch?.[1] ? this.parseTail4(commonMatch[1]) : '';
  },

  getRepaymentCardTail(row = {}) {
    const direct = this.parseTail4(row?.card_tail || '');
    if (direct) return direct;
    const fromBankLine = this.extractTailFromText(row?.description, /(?:银行|还款卡|还款入账卡|刷卡卡|到账卡)[:：][^；\n]*尾号\s*(\d{3,4})/);
    if (fromBankLine) return fromBankLine;
    const cardNoMatch = String(row?.description || '').match(/Card\s*No\.?\s*(\d{4})/i);
    return cardNoMatch?.[1] ? this.parseTail4(cardNoMatch[1]) : '';
  },

  getSwipeCardTail(row = {}) {
    const direct = this.parseTail4(row?.card_tail || '');
    if (direct) return direct;
    return this.extractTailFromText(row?.description, /刷卡卡[:：][^；\n]*尾号\s*(\d{3,4})/);
  },

  getSettlementCardTail(row = {}) {
    const direct = this.parseTail4(row?.settlement_card_tail || '');
    if (direct) return direct;
    return this.extractTailFromText(row?.description, /到账卡[:：][^；\n]*尾号\s*(\d{3,4})/);
  },

  formatBankCard(bank = '', tail = '') {
    const safeBank = String(bank || '').trim() || '未标注银行';
    const safeTail = this.parseTail4(tail || '');
    return safeTail ? `${safeBank}（尾号${safeTail}）` : safeBank;
  },

  getRepaymentBillDay(row = {}) {
    const direct = Number(row?.card_bill_day || 0);
    if (Number.isInteger(direct) && direct >= 1 && direct <= 31) return direct;
    const text = String(row?.description || '');
    const match = text.match(/账单日[:：]\s*(?:每月)?\s*(\d{1,2})\s*日?/);
    const parsed = Number(match?.[1] || 0);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 31 ? parsed : 0;
  },

  getRepaymentDay(row = {}) {
    const direct = Number(row?.card_repayment_day || 0);
    if (Number.isInteger(direct) && direct >= 1 && direct <= 31) return direct;
    const text = String(row?.description || '');
    const match = text.match(/还款日[:：]\s*(?:每月)?\s*(\d{1,2})\s*日?/);
    const parsed = Number(match?.[1] || 0);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 31 ? parsed : 0;
  },

  getReminderStatusText(row = {}) {
    const enabled = row?.reminder_enabled;
    if (enabled === false) return '提醒关闭';
    const reminderDate = String(row?.reminder_date || '').trim();
    if (reminderDate) {
      return `提醒日：${window.Utils.formatDate(reminderDate, 'YYYY-MM-DD')}`;
    }
    return '提醒待计算';
  },

  buildDescriptionSummary(row = {}) {
    const raw = String(row?.description || '').replace(/\r/g, '\n').trim();
    if (!raw) return '-';

    const parts = raw
      .split(/[；;\n]+/)
      .map(item => String(item || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .filter(item => !/^(Statement|Payment|Daily|Personal|Last|New\s+Charge|Cash\s+Advance|Transaction|Posting|Card\s*No\.?|Amount|Original|Total|账户信息|本期账务明细|交易日期|摘要|Description|卡号|货币)/i.test(item));

    const selected = (parts.length ? parts : [raw]).slice(0, 2).join('；');
    const compact = selected.replace(/\s+/g, ' ').trim();
    if (compact.length <= 70) return compact;
    return `${compact.slice(0, 70)}...`;
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
    const isSwipeFlow = this.currentFlow === 'swipe';
    const summaryCards = isSwipeFlow
      ? [
          { label: '总刷卡金额', value: summary.totalSwipe, color: '#1d4ed8', border: '#dbeafe', bg: '#eff6ff' },
          { label: '总到账金额', value: summary.totalArrival, color: '#b45309', border: '#fde68a', bg: '#fffbeb' },
          { label: '总手续费', value: summary.totalFee, color: '#0f172a', border: '#e5e7eb', bg: '#f8fafc' }
        ]
      : [
          { label: '总应还金额', value: summary.totalRepaymentDue, color: '#15803d', border: '#d1fae5', bg: '#f0fdf4' },
          { label: '已还金额', value: summary.totalPaid, color: '#dc2626', border: '#fee2e2', bg: '#fff1f2' },
          { label: '剩余应还', value: summary.outstanding, color: '#15803d', border: '#dcfce7', bg: '#f0fdf4' }
        ];

    return `
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 12px 6px;">
        ${summaryCards.map(card => `
          <div style="padding:10px;border:1px solid ${card.border};border-radius:10px;background:${card.bg};">
            <div style="font-size:12px;color:#475569;">${this.escapeHtml(card.label)}</div>
            <div style="font-size:16px;font-weight:700;color:${card.color};">${window.Utils.formatMoney(card.value)}</div>
          </div>
        `).join('')}
      </div>
    `;
  },

  render() {
    const container = document.getElementById('bankingContent');
    if (!container) return;

    if (!Array.isArray(this.rows) || this.rows.length === 0) {
      const emptyText = this.currentFlow === 'swipe' ? '暂无刷卡流水' : '暂无信用卡还款流水';
      container.innerHTML = `
        ${this.renderSummary()}
        <div class="empty-state">
          <div class="empty-icon"><i class="fa fa-university"></i></div>
          <div class="empty-text">${emptyText}</div>
        </div>
      `;
      return;
    }

    const cards = this.rows.map(row => {
      const dateText = window.Utils.formatDate(row?.transaction_date || row?.created_at, 'YYYY/MM/DD HH:mm:ss');
      const title = this.escapeHtml(this.getRecordTitle(row));
      const amountMeta = this.getPrimaryAmountMeta(row);
      const detailLines = [];

      if (this.isRepaymentPlanRow(row)) {
        const bankName = this.getBankName(row);
        const cardTail = this.getRepaymentCardTail(row);
        const billDay = this.getRepaymentBillDay(row);
        const repayDay = this.getRepaymentDay(row);
        detailLines.push(`还款入账卡：${this.formatBankCard(bankName, cardTail)}`);
        if (billDay > 0 || repayDay > 0) {
          detailLines.push(`账单/还款日：${billDay > 0 ? `${billDay}日` : '-'} / ${repayDay > 0 ? `${repayDay}日` : '-'}`);
        }
        detailLines.push(`应还金额：${window.Utils.formatMoney(this.getRepaymentDueAmount(row))}`);
        detailLines.push(this.getReminderStatusText(row));
      } else if (this.isSwipeRow(row)) {
        if (this.isFeeOnlyRow(row)) {
          const feeBank = this.getBankName(row);
          const feeTail = this.getSwipeCardTail(row) || this.getRepaymentCardTail(row);
          detailLines.push(`银行卡：${this.formatBankCard(feeBank, feeTail)}`);
          detailLines.push(`手续费：${window.Utils.formatMoney(this.getSwipeFeeAmount(row))}`);
        } else {
          const swipeBank = String(row?.swipe_card_bank || row?.card_bank || this.getBankName(row)).trim();
          const settlementBank = String(row?.settlement_bank || '').trim() || '未标注到账银行';
          const swipeTail = this.getSwipeCardTail(row);
          const settlementTail = this.getSettlementCardTail(row);
          detailLines.push(`刷卡卡：${this.formatBankCard(swipeBank, swipeTail)}`);
          detailLines.push(`到账卡：${this.formatBankCard(settlementBank, settlementTail)}`);
          detailLines.push(`刷卡：${window.Utils.formatMoney(this.getSwipeGrossAmount(row))} · 到账：${window.Utils.formatMoney(this.getSwipeActualAmount(row))} · 手续费：${window.Utils.formatMoney(this.getSwipeFeeAmount(row))}`);
        }
      } else {
        detailLines.push(`银行：${this.formatBankCard(this.getBankName(row), '')}`);
      }

      return `
        <div class="banking-record-card" data-id="${this.escapeHtml(row?.id)}"
          style="margin:8px 12px;padding:12px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
            <div style="font-size:14px;font-weight:600;color:#0f172a;">${title}</div>
            <div style="font-size:15px;font-weight:700;color:${amountMeta.color};">${amountMeta.text}</div>
          </div>
          <div style="margin-top:4px;font-size:12px;color:#94a3b8;">${this.escapeHtml(dateText)}</div>
          ${detailLines.map(line => `<div style="margin-top:4px;font-size:12px;color:#475569;line-height:1.45;">${this.escapeHtml(line)}</div>`).join('')}
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
    const summary = this.buildDescriptionSummary(row);
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
          <div><strong>备注摘要：</strong>${this.escapeHtml(summary)}</div>
        </div>
      `
    });
  }
};
