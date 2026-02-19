/**
 * 移动端ERP - 库存模块
 */

window.InventoryModule = {
  name: 'inventory',
  currentType: '',
  currentPage: 1,
  pageSize: 20,
  rawRecords: [],
  filteredRecords: [],
  records: [],
  hasMore: true,
  eventsBound: false,
  syncEventsBound: false,
  realtimeChannel: null,
  realtimeRefreshTimer: null,
  hiddenSystemTypes: new Set(['order_lock', 'order_release', 'sale_reversal', 'order_unlock', 'sale', 'consumption']),
  snapshotProducts: [],

  async init(routeParams = {}) {
    if (!this.eventsBound) {
      this.bindEvents();
      this.eventsBound = true;
    }
    if (!this.syncEventsBound) {
      this.bindSyncEvents();
      this.syncEventsBound = true;
    }
    this.startRealtimeSync();

    if (routeParams && Object.prototype.hasOwnProperty.call(routeParams, 'type')) {
      this.currentType = String(routeParams.type || '').trim();
      document.querySelectorAll('#inventoryTabs .tab-item').forEach(tab => {
        const matched = String(tab.dataset.type || '') === this.currentType;
        tab.classList.toggle('active', matched);
      });
      if (!document.querySelector('#inventoryTabs .tab-item.active')) {
        const defaultTab = document.querySelector('#inventoryTabs .tab-item[data-type=""]');
        if (defaultTab) defaultTab.classList.add('active');
      }
    } else {
      this.currentType = '';
      document.querySelectorAll('#inventoryTabs .tab-item').forEach(tab => {
        tab.classList.toggle('active', String(tab.dataset.type || '') === '');
      });
    }

    this.currentPage = 1;
    this.filteredRecords = [];
    this.records = [];
    this.hasMore = true;
    await this.loadRecords(true);
  },

  bindEvents() {
    // 类型标签切换
    document.querySelectorAll('#inventoryTabs .tab-item').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#inventoryTabs .tab-item').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentType = tab.dataset.type;
        this.currentPage = 1;
        this.filteredRecords = [];
        this.records = [];
        this.hasMore = true;
        this.loadRecords();
      });
    });

    // 添加库存记录按钮
    document.getElementById('inventoryAddBtn')?.addEventListener('click', () => {
      this.showAddRecordModal();
    });

    // 滚动加载更多
    const content = document.getElementById('inventoryContent');
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
    const page = document.getElementById('inventoryPage');
    return !!page && !page.classList.contains('hidden');
  },

  scheduleRealtimeRefresh(reason = '') {
    if (this.realtimeRefreshTimer) {
      clearTimeout(this.realtimeRefreshTimer);
      this.realtimeRefreshTimer = null;
    }

    this.realtimeRefreshTimer = setTimeout(async () => {
      if (!this.isPageActive()) return;
      this.currentPage = 1;
      this.filteredRecords = [];
      this.records = [];
      this.hasMore = true;
      await this.loadRecords(true);
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
    const channelName = `mobile-erp-inventory-${userId || 'guest'}`;

    const canHandlePayload = payload => {
      const row = payload?.new || payload?.old || {};
      const rowUserId = String(row?.user_id || '').trim();
      if (!userId) return true;
      return rowUserId === '' || rowUserId === String(userId);
    };

    const refreshIfNeeded = payload => {
      if (!canHandlePayload(payload)) return;
      this.scheduleRealtimeRefresh('realtime-change');
    };

    this.realtimeChannel = client
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'erp_inventory_logs' }, refreshIfNeeded)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'erp_products' }, refreshIfNeeded)
      .subscribe();
  },

  async loadRecords(forceRefresh = false) {
    try {
      window.Loading.show('加载库存记录...');

      if (this.currentType === 'warning') {
        await this.loadWarningProducts();
        this.hasMore = false;
      } else {
        if (forceRefresh || !Array.isArray(this.rawRecords) || this.rawRecords.length === 0) {
          const fetched = await window.API.getInventoryRecords({
            limit: 1000,
            offset: 0
          });
          this.rawRecords = Array.isArray(fetched)
            ? fetched.filter(item => this.shouldDisplayInventoryRecord(item))
            : [];
        } else {
          this.rawRecords = this.rawRecords.filter(item => this.shouldDisplayInventoryRecord(item));
        }

        const filtered = this.currentType
          ? this.rawRecords.filter(record => this.normalizeRecordType(record) === this.currentType)
          : [...this.rawRecords];

        if (this.currentType === '' && filtered.length === 0) {
          await this.loadProductSnapshot();
        } else {
          this.filteredRecords = filtered;
          const visibleCount = this.currentPage * this.pageSize;
          this.records = filtered.slice(0, visibleCount);
          this.hasMore = filtered.length > visibleCount;
          this.renderRecords();
        }
      }

      window.Loading.hide();
    } catch (error) {
      window.Loading.hide();
      console.error('加载库存记录失败:', error);
      window.Toast.error('加载库存记录失败');
    }
  },

  async loadWarningProducts() {
    try {
      const products = await window.API.getProducts({ limit: 1000 });
      const warningProducts = products.filter(p => window.Utils.checkStockWarning(p));
      this.renderWarningProducts(warningProducts);
    } catch (error) {
      console.error('加载预警产品失败:', error);
      window.Toast.error('加载预警产品失败');
    }
  },

  async loadProductSnapshot() {
    const products = await window.API.getProducts({ limit: 1000, offset: 0 });
    const productRows = Array.isArray(products) ? products : [];
    this.snapshotProducts = productRows;
    this.filteredRecords = [];
    this.records = [];
    this.hasMore = false;
    this.renderProductSnapshot(productRows);
  },

  async loadMore() {
    if (!this.hasMore || this.currentType === 'warning') return;
    this.currentPage++;
    await this.loadRecords(false);
  },

  resolveQuantityChange(record) {
    const quantityValue = Number(record?.quantity_change ?? record?.quantity ?? 0);
    return Number.isFinite(quantityValue) ? quantityValue : 0;
  },

  shouldDisplayInventoryRecord(record) {
    const rawType = String(record?.type || '').trim().toLowerCase();
    if (!rawType) return true;
    return !this.hiddenSystemTypes.has(rawType);
  },

  normalizeRecordType(record) {
    const rawType = String(record?.type || '').trim().toLowerCase();
    const inTypes = new Set(['in', 'purchase', 'inbound', 'restock', 'refund_in', 'manual_in', 'adjust_in']);
    const outTypes = new Set(['out', 'outbound', 'manual_out', 'adjust_out']);

    if (inTypes.has(rawType)) return 'in';
    if (outTypes.has(rawType)) return 'out';

    const quantityChange = this.resolveQuantityChange(record);
    if (quantityChange < 0) return 'out';
    return 'in';
  },

  renderRecords() {
    const container = document.getElementById('inventoryContent');
    if (!container) return;

    if (this.records.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fa fa-cube"></i></div>
          <div class="empty-text">暂无库存记录</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="inventory-list">
        ${this.records.map(record => this.renderRecordCard(record)).join('')}
      </div>
      ${this.hasMore ? '<div class="infinite-scroll-loading">加载更多...</div>' : '<div class="infinite-scroll-finished">没有更多了</div>'}
    `;
  },

  renderRecordCard(record) {
    const type = this.normalizeRecordType(record);
    const quantityChange = this.resolveQuantityChange(record);
    const typeText = type === 'in' ? '入库' : '出库';
    const typeIcon = type === 'in' ? 'fa-arrow-down' : 'fa-arrow-up';
    const productName = record.product?.name || '未知产品';
    const productSku = record.product?.sku || '';
    const quantity = Math.abs(quantityChange);
    const time = window.Utils.formatRelativeTime(record.created_at);

    return `
      <div class="inventory-card">
        <div class="inventory-card-header">
          <div class="inventory-type">
            <div class="inventory-type-icon ${type}">
              <i class="fa ${typeIcon}"></i>
            </div>
            <span>${typeText}</span>
          </div>
          <div class="inventory-time">${time}</div>
        </div>
        <div class="inventory-card-body">
          <div class="inventory-product">
            <div class="inventory-product-image">
              ${record.product?.image_url
                ? `<img src="${record.product.image_url}" alt="${productName}">`
                : `<div class="inventory-product-placeholder"><i class="fa fa-image"></i></div>`
              }
            </div>
            <div class="inventory-product-info">
              <div class="inventory-product-name">${productName}</div>
              ${productSku ? `<div class="inventory-product-sku">SKU: ${productSku}</div>` : ''}
            </div>
          </div>
          <div class="inventory-quantity">
            <div class="inventory-quantity-label">${typeText}数量</div>
            <div class="inventory-quantity-value ${type}">${type === 'in' ? '+' : '-'}${quantity}</div>
          </div>
          ${record.notes ? `<div class="inventory-notes">${record.notes}</div>` : ''}
        </div>
      </div>
    `;
  },

  renderProductSnapshot(products = []) {
    const container = document.getElementById('inventoryContent');
    if (!container) return;

    const rows = Array.isArray(products) ? products : [];
    if (rows.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fa fa-cube"></i></div>
          <div class="empty-text">暂无库存数据</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="inventory-list">
        ${rows.map(product => {
          const stock = Number(product?.stock_quantity || 0);
          const minStock = Number(product?.min_stock || 0);
          const isWarning = window.Utils.checkStockWarning(product);
          const productName = product?.name || '未命名产品';
          const sku = product?.sku || '-';
          const statusText = isWarning ? '预警' : '正常';
          return `
            <div class="inventory-card is-clickable inventory-product-card" data-product-id="${product?.id}">
              <div class="inventory-card-header">
                <div class="inventory-type">
                  <div class="inventory-type-icon ${isWarning ? 'out' : 'in'}">
                    <i class="fa ${isWarning ? 'fa-exclamation' : 'fa-check'}"></i>
                  </div>
                  <span>${statusText}</span>
                </div>
                <div class="inventory-time">最小库存 ${minStock}</div>
              </div>
              <div class="inventory-card-body">
                <div class="inventory-product">
                  <div class="inventory-product-image">
                    ${product?.image_url
                      ? `<img src="${product.image_url}" alt="${productName}">`
                      : `<div class="inventory-product-placeholder"><i class="fa fa-image"></i></div>`
                    }
                  </div>
                  <div class="inventory-product-info">
                    <div class="inventory-product-name">${productName}</div>
                    <div class="inventory-product-sku">SKU: ${sku}</div>
                  </div>
                </div>
                <div class="inventory-quantity">
                  <div class="inventory-quantity-label">当前库存</div>
                  <div class="inventory-quantity-value ${isWarning ? 'out' : 'in'}">${stock}</div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    container.querySelectorAll('.inventory-product-card').forEach((card) => {
      card.addEventListener('click', () => {
        const productId = String(card.dataset.productId || '').trim();
        const product = rows.find(item => String(item?.id) === productId);
        if (product) {
          this.showProductActions(product);
        }
      });
    });
  },

  renderWarningProducts(products) {
    const container = document.getElementById('inventoryContent');
    if (!container) return;

    if (products.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fa fa-check-circle"></i></div>
          <div class="empty-text">暂无库存预警</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="inventory-warning-list">
        ${products.map(product => this.renderWarningCard(product)).join('')}
      </div>
    `;

    // 绑定补货按钮
    container.querySelectorAll('.btn-restock').forEach((btn, index) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showRestockModal(products[index]);
      });
    });
  },

  renderWarningCard(product) {
    const stock = Number(product.stock_quantity) || 0;
    const minStock = Number(product.min_stock) || 0;

    return `
      <div class="inventory-warning-card">
        <div class="inventory-warning-header">
          <div class="inventory-warning-icon">
            <i class="fa fa-exclamation-triangle"></i>
          </div>
          <div class="inventory-warning-title">${product.name || '未命名'}</div>
        </div>
        <div class="inventory-warning-product">
          <div class="inventory-warning-product-name">SKU: ${product.sku || '-'}</div>
          <div class="inventory-warning-stock">
            <span class="inventory-warning-stock-current">${stock}</span>
            <span class="inventory-warning-stock-min">/ ${minStock}</span>
          </div>
        </div>
        <div class="inventory-warning-action">
          <button class="btn btn-primary btn-sm btn-block btn-restock" data-product-id="${product.id}">
            <i class="fa fa-plus"></i> 立即补货
          </button>
        </div>
      </div>
    `;
  },

  async showAddRecordModal() {
    const products = await window.API.getProducts({ limit: 1000, offset: 0 });
    const productRows = Array.isArray(products) ? products : [];
    if (productRows.length === 0) {
      window.Toast.info('暂无产品，请先新增产品');
      return;
    }
    await window.ActionSheet.show({
      title: '库存调整',
      actions: [
        {
          text: '入库调整',
          icon: 'arrow-down',
          handler: () => this.showInventoryAdjustModal({
            title: '入库调整',
            products: productRows,
            defaultType: 'in',
            lockType: true
          })
        },
        {
          text: '出库调整',
          icon: 'arrow-up',
          handler: () => this.showInventoryAdjustModal({
            title: '出库调整',
            products: productRows,
            defaultType: 'out',
            lockType: true
          })
        }
      ]
    });
  },

  async showRestockModal(product) {
    await this.showInventoryAdjustModal({
      title: `补货入库 - ${product?.name || ''}`,
      products: [product],
      defaultProductId: product?.id,
      defaultType: 'in',
      lockType: true
    });
  },

  escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  async showProductActions(product) {
    await window.ActionSheet.show({
      title: product?.name || '库存操作',
      actions: [
        {
          text: '入库调整',
          icon: 'plus',
          handler: () => this.showInventoryAdjustModal({
            title: '入库调整',
            products: [product],
            defaultProductId: product?.id,
            defaultType: 'in',
            lockType: true
          })
        },
        {
          text: '出库调整',
          icon: 'minus',
          handler: () => this.showInventoryAdjustModal({
            title: '出库调整',
            products: [product],
            defaultProductId: product?.id,
            defaultType: 'out',
            lockType: true
          })
        }
      ]
    });
  },

  async showInventoryAdjustModal(options = {}) {
    const products = Array.isArray(options.products) ? options.products.filter(Boolean) : [];
    if (products.length === 0) {
      window.Toast.error('未找到可调整的产品');
      return;
    }

    const defaultType = String(options.defaultType || 'in').trim() === 'out' ? 'out' : 'in';
    const lockType = options.lockType !== false;
    const defaultProductId = String(options.defaultProductId || products[0]?.id || '').trim();
    const defaultTypeTitle = defaultType === 'out' ? '出库调整' : '入库调整';
    const optionHtml = products.map(item => {
      const idText = this.escapeHtml(item?.id);
      const nameText = this.escapeHtml(item?.name || `产品#${item?.id}`);
      const stockText = Number(item?.stock_quantity || 0);
      return `<option value="${idText}">${nameText}（当前库存:${stockText}）</option>`;
    }).join('');

    await window.Modal.show({
      title: options.title || (lockType ? defaultTypeTitle : '库存调整'),
      confirmText: '保存',
      cancelText: '取消',
      content: `
        <div style="text-align:left;">
          <div style="margin-bottom:10px;">
            <div style="margin-bottom:6px;color:#475569;font-size:12px;">产品</div>
            <select id="inventoryAdjustProduct" style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;">${optionHtml}</select>
          </div>
          ${lockType
            ? `<div style="margin-bottom:10px;">
                 <div style="display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:999px;border:1px solid ${defaultType === 'out' ? '#fecaca' : '#bbf7d0'};background:${defaultType === 'out' ? '#fff1f2' : '#ecfdf3'};color:${defaultType === 'out' ? '#b91c1c' : '#166534'};font-size:12px;">
                   <i class="fa ${defaultType === 'out' ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
                   <span>${defaultType === 'out' ? '出库模式' : '入库模式'}</span>
                 </div>
               </div>`
            : `<div style="display:flex;gap:8px;margin-bottom:10px;">
                 <button id="inventoryTypeIn" type="button" style="flex:1;height:34px;border-radius:8px;border:1px solid #16a34a;background:${defaultType === 'in' ? '#ecfdf3' : '#fff'};color:#166534;">入库</button>
                 <button id="inventoryTypeOut" type="button" style="flex:1;height:34px;border-radius:8px;border:1px solid #ef4444;background:${defaultType === 'out' ? '#fff1f2' : '#fff'};color:#b91c1c;">出库</button>
               </div>`
          }
          <input id="inventoryAdjustType" type="hidden" value="${defaultType}" />
          <div id="inventoryAdjustReceiverWrap" style="margin-bottom:10px;${defaultType === 'out' ? '' : 'display:none;'}">
            <div style="margin-bottom:6px;color:#475569;font-size:12px;">出库对象</div>
            <input id="inventoryAdjustReceiver" type="text" maxlength="50" placeholder="例如：张三 / 门店A / 1688客户"
              style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;" />
          </div>
          <div style="margin-bottom:10px;">
            <div style="margin-bottom:6px;color:#475569;font-size:12px;">数量</div>
            <input id="inventoryAdjustQuantity" type="number" min="1" step="1" placeholder="请输入数量" style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;" />
          </div>
          <div>
            <div style="margin-bottom:6px;color:#475569;font-size:12px;">备注</div>
            <textarea id="inventoryAdjustNotes" rows="2" placeholder="选填" style="width:100%;border:1px solid #d9d9d9;border-radius:8px;padding:8px 10px;resize:none;"></textarea>
          </div>
        </div>
      `,
      onConfirm: async () => {
        const productId = String(document.getElementById('inventoryAdjustProduct')?.value || '').trim();
        const type = String(document.getElementById('inventoryAdjustType')?.value || 'in').trim() === 'out' ? 'out' : 'in';
        const quantity = parseInt(document.getElementById('inventoryAdjustQuantity')?.value, 10);
        const notes = String(document.getElementById('inventoryAdjustNotes')?.value || '').trim();
        const receiver = String(document.getElementById('inventoryAdjustReceiver')?.value || '').trim();

        if (!productId) {
          window.Toast.error('请选择产品');
          return false;
        }
        if (!Number.isFinite(quantity) || quantity <= 0) {
          window.Toast.error('数量必须大于0');
          return false;
        }
        if (type === 'out' && !receiver) {
          window.Toast.error('请填写出库对象');
          return false;
        }

        const finalNotes = type === 'out'
          ? ['出库对象:' + receiver, notes].filter(Boolean).join('；')
          : notes;

        await this.applyInventoryAdjust(productId, type, quantity, finalNotes, receiver);
        return true;
      }
    });

    setTimeout(() => {
      const typeInput = document.getElementById('inventoryAdjustType');
      const inBtn = document.getElementById('inventoryTypeIn');
      const outBtn = document.getElementById('inventoryTypeOut');
      const receiverWrap = document.getElementById('inventoryAdjustReceiverWrap');
      const applyStyle = (nextType) => {
        if (!typeInput) return;
        typeInput.value = nextType;
        if (inBtn) {
          inBtn.style.background = nextType === 'in' ? '#ecfdf3' : '#fff';
        }
        if (outBtn) {
          outBtn.style.background = nextType === 'out' ? '#fff1f2' : '#fff';
        }
        if (receiverWrap) {
          receiverWrap.style.display = nextType === 'out' ? '' : 'none';
        }
      };
      if (!lockType) {
        inBtn?.addEventListener('click', () => applyStyle('in'));
        outBtn?.addEventListener('click', () => applyStyle('out'));
      }
      const selected = String(typeInput?.value || defaultType) === 'out' ? 'out' : 'in';
      applyStyle(selected);

      const select = document.getElementById('inventoryAdjustProduct');
      if (select && defaultProductId) {
        select.value = defaultProductId;
      }
    }, 0);
  },

  async applyInventoryAdjust(productId, type, quantity, notes = '', receiver = '') {
    try {
      const latest = await window.API.getProduct(productId);
      if (!latest) {
        throw new Error('产品不存在或已删除');
      }

      const currentStock = Number(latest?.stock_quantity || 0);
      const safeQty = Math.max(1, Math.floor(Number(quantity || 0)));
      const delta = type === 'out' ? -safeQty : safeQty;
      const nextStock = currentStock + delta;

      if (nextStock < 0) {
        throw new Error(`库存不足，当前库存 ${currentStock}`);
      }

      await window.API.updateProduct(productId, {
        stock_quantity: nextStock
      });

      await window.API.createInventoryRecord({
        product_id: latest.id,
        quantity_change: delta,
        type: type === 'out' ? 'manual_out' : 'manual_in',
        current_quantity: nextStock,
        notes: notes || (type === 'out'
          ? `移动端出库调整${receiver ? `（对象:${receiver}）` : ''}`
          : '移动端入库调整')
      });

      window.Toast.success(type === 'out' ? '出库调整成功' : '入库调整成功');
      this.currentPage = 1;
      this.filteredRecords = [];
      this.records = [];
      this.hasMore = true;
      await this.loadRecords(true);
    } catch (error) {
      console.error('库存调整失败:', error);
      window.Toast.error(error?.message || '库存调整失败');
      throw error;
    }
  }
};
