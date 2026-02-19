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

  async init() {
    if (!this.eventsBound) {
      this.bindEvents();
      this.eventsBound = true;
    }
    this.currentPage = 1;
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
          this.rawRecords = Array.isArray(fetched) ? fetched : [];
        }

        const filtered = this.currentType
          ? this.rawRecords.filter(record => this.normalizeRecordType(record) === this.currentType)
          : [...this.rawRecords];

        this.filteredRecords = filtered;
        const visibleCount = this.currentPage * this.pageSize;
        this.records = filtered.slice(0, visibleCount);
        this.hasMore = filtered.length > visibleCount;
        this.renderRecords();
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

  async loadMore() {
    if (!this.hasMore || this.currentType === 'warning') return;
    this.currentPage++;
    await this.loadRecords(false);
  },

  resolveQuantityChange(record) {
    const quantityValue = Number(record?.quantity_change ?? record?.quantity ?? 0);
    return Number.isFinite(quantityValue) ? quantityValue : 0;
  },

  normalizeRecordType(record) {
    const rawType = String(record?.type || '').trim().toLowerCase();
    const inTypes = new Set(['in', 'purchase', 'inbound', 'restock', 'order_release', 'sale_reversal', 'refund_in', 'manual_in', 'adjust_in']);
    const outTypes = new Set(['out', 'sale', 'order_lock', 'consumption', 'outbound', 'manual_out', 'adjust_out']);

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
    // TODO: 实现添加库存记录表单
    window.Toast.info('添加库存记录功能开发中');
  },

  async showRestockModal(product) {
    const confirmed = await window.Modal.confirm(
      `是否为"${product.name}"补货？`,
      '补货确认'
    );

    if (!confirmed) return;

    // TODO: 实现补货表单
    window.Toast.info('补货功能开发中');
  }
};
