/**
 * 移动端ERP - 产品模块
 */

window.ProductModule = {
  name: 'product',
  currentPage: 1,
  pageSize: 20,
  products: [],
  hasMore: true,
  searchKeyword: '',
  currentCategory: '',

  async init() {
    this.bindEvents();
    await this.loadProducts();
  },

  bindEvents() {
    // 搜索输入
    const searchInput = document.getElementById('productsSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', window.Utils.debounce((e) => {
        this.searchKeyword = e.target.value.trim();
        this.currentPage = 1;
        this.products = [];
        this.hasMore = true;
        this.loadProducts();
      }, 500));
    }

    // 添加产品按钮
    document.getElementById('productsAddBtn')?.addEventListener('click', () => {
      this.showAddProductModal();
    });

    // 滚动加载更多
    const content = document.getElementById('productsContent');
    if (content) {
      content.addEventListener('scroll', window.Utils.throttle(() => {
        if (content.scrollHeight - content.scrollTop - content.clientHeight < 100) {
          this.loadMore();
        }
      }, 300));
    }
  },

  async loadProducts() {
    try {
      if (this.currentPage === 1) {
        window.Loading.show('加载产品...');
      }

      const offset = (this.currentPage - 1) * this.pageSize;
      const newProducts = await window.API.getProducts({
        keyword: this.searchKeyword,
        category: this.currentCategory,
        limit: this.pageSize,
        offset
      });

      if (newProducts.length < this.pageSize) {
        this.hasMore = false;
      }

      this.products = this.currentPage === 1 ? newProducts : [...this.products, ...newProducts];
      this.renderProducts();

      window.Loading.hide();
    } catch (error) {
      window.Loading.hide();
      console.error('加载产品失败:', error);
      window.Toast.error('加载产品失败');
    }
  },

  async loadMore() {
    if (!this.hasMore) return;
    this.currentPage++;
    await this.loadProducts();
  },

  renderProducts() {
    const container = document.getElementById('productsContent');
    if (!container) return;

    if (this.products.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fa fa-shopping-bag"></i></div>
          <div class="empty-text">${this.searchKeyword ? '未找到相关产品' : '暂无产品'}</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="product-list">
        ${this.products.map(product => this.renderProductItem(product)).join('')}
      </div>
      ${this.hasMore ? '<div class="infinite-scroll-loading">加载更多...</div>' : '<div class="infinite-scroll-finished">没有更多了</div>'}
    `;

    // 绑定点击事件
    container.querySelectorAll('.product-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        this.showProductDetail(this.products[index]);
      });
    });
  },

  renderProductItem(product) {
    const stock = Number(product.stock_quantity) || 0;
    const minStock = Number(product.min_stock) || 0;
    const isLowStock = window.Utils.checkStockWarning(product);

    return `
      <div class="product-item" data-product-id="${product.id}">
        <div class="product-image">
          ${product.image_url
            ? `<img src="${product.image_url}" alt="${product.name}">`
            : `<div class="product-image-placeholder"><i class="fa fa-image"></i></div>`
          }
        </div>
        <div class="product-info">
          <div class="product-name">${product.name || '未命名'}</div>
          ${product.sku ? `<div class="product-sku">SKU: ${product.sku}</div>` : ''}
          <div class="product-price">${window.Utils.formatMoney(product.price)}</div>
          <div class="product-stock">
            <span class="product-stock-label">库存:</span>
            <span class="product-stock-value ${isLowStock ? 'product-stock-warning' : ''}">${stock}</span>
            ${isLowStock ? '<span class="product-stock-badge">预警</span>' : ''}
          </div>
        </div>
      </div>
    `;
  },

  async showProductDetail(product) {
    // TODO: 实现产品详情页面
    window.Toast.info('产品详情功能开发中');
  },

  async showAddProductModal() {
    // TODO: 实现添加产品表单
    window.Toast.info('添加产品功能开发中');
  }
};


