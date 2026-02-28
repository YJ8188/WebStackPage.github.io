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
  eventsBound: false,

  async init() {
    if (!this.eventsBound) {
      this.bindEvents();
      this.eventsBound = true;
    }
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
          <div class="empty-icon"><i class="fa fa-cubes"></i></div>
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
    const isLowStock = window.Utils.checkStockWarning(product);
    const productId = this.escapeHtml(product?.id || '');
    const productName = this.escapeHtml(product?.name || '未命名');
    const productSku = this.escapeHtml(product?.sku || '');
    const imageUrl = this.sanitizeImageUrl(product?.image_url);

    return `
      <div class="product-item" data-product-id="${productId}">
        <div class="product-image">
          ${imageUrl
            ? `<img src="${imageUrl}" alt="${productName}">`
            : `<div class="product-image-placeholder"><i class="fa fa-image"></i></div>`
          }
        </div>
        <div class="product-info">
          <div class="product-name">${productName}</div>
          ${productSku ? `<div class="product-sku">SKU: ${productSku}</div>` : ''}
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

  escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  sanitizeImageUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^(javascript|data|vbscript):/i.test(raw)) return '';
    try {
      const parsed = new URL(raw, window.location.origin);
      const protocol = parsed.protocol.toLowerCase();
      if (protocol === 'http:' || protocol === 'https:') {
        return parsed.href;
      }
    } catch (error) {
    }
    return '';
  },

  async showProductDetail(product) {
    try {
      const productId = String(product?.id || '').trim();
      if (!productId) {
        window.Toast.error('产品信息无效');
        return;
      }

      const latestProduct = await window.API.getProduct(productId);
      if (!latestProduct) {
        window.Toast.error('产品不存在或已删除');
        return;
      }

      const stock = Number(latestProduct?.stock_quantity || 0);
      const minStock = Number(latestProduct?.min_stock || 0);
      const isWarning = window.Utils.checkStockWarning(latestProduct);
      const warningText = isWarning ? '预警中' : '库存正常';

      let shouldEdit = false;
      await window.Modal.show({
        title: '产品详情',
        confirmText: '编辑',
        cancelText: '关闭',
        content: `
          <div style="text-align:left;">
            <div style="padding:10px;border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc;">
              <div style="font-size:14px;font-weight:600;color:#0f172a;line-height:1.5;margin-bottom:8px;">${this.escapeHtml(latestProduct?.name || '未命名')}</div>
              <div style="font-size:12px;color:#64748b;line-height:1.9;">
                <div>SKU：${this.escapeHtml(latestProduct?.sku || '-')}</div>
                <div>分类：${this.escapeHtml(latestProduct?.category || '-')}</div>
                <div>价格：<span style="color:#dc2626;font-weight:700;">${window.Utils.formatMoney(latestProduct?.price || 0)}</span></div>
                <div>当前库存：<strong>${stock}</strong></div>
                <div>最小库存：${minStock}</div>
                <div>库存状态：<span style="color:${isWarning ? '#dc2626' : '#16a34a'};font-weight:600;">${warningText}</span></div>
              </div>
            </div>
          </div>
        `,
        onConfirm: async () => {
          shouldEdit = true;
          return true;
        }
      });

      if (shouldEdit) {
        await this.showProductFormModal({ mode: 'edit', product: latestProduct });
      }
    } catch (error) {
      console.error('加载产品详情失败:', error);
      window.Toast.error(error?.message || '加载产品详情失败');
    }
  },

  async showAddProductModal() {
    await this.showProductFormModal({ mode: 'create' });
  },

  async showProductFormModal(options = {}) {
    const mode = options.mode === 'edit' ? 'edit' : 'create';
    const product = options.product || {};

    const title = mode === 'edit' ? '编辑产品' : '新增产品';
    const confirmText = mode === 'edit' ? '保存修改' : '创建产品';

    const defaultName = this.escapeHtml(product?.name || '');
    const defaultSku = this.escapeHtml(product?.sku || '');
    const defaultCategory = this.escapeHtml(product?.category || '');
    const defaultPrice = Number(product?.price || 0);
    const defaultStock = Number(product?.stock_quantity || 0);
    const defaultMinStock = Number(product?.min_stock || 0);
    const defaultImage = this.escapeHtml(product?.image_url || '');

    await window.Modal.show({
      title,
      confirmText,
      cancelText: '取消',
      content: `
        <div style="text-align:left;">
          <div style="margin-bottom:10px;">
            <div style="margin-bottom:6px;color:#475569;font-size:12px;">产品名称 <span style="color:#dc2626;">*</span></div>
            <input id="mobileProductNameInput" type="text" maxlength="120" value="${defaultName}" placeholder="请输入产品名称"
              style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;" />
          </div>
          <div style="display:flex;gap:8px;margin-bottom:10px;">
            <div style="flex:1;min-width:0;">
              <div style="margin-bottom:6px;color:#475569;font-size:12px;">SKU</div>
              <input id="mobileProductSkuInput" type="text" maxlength="60" value="${defaultSku}" placeholder="如：SKU-001"
                style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;" />
            </div>
            <div style="flex:1;min-width:0;">
              <div style="margin-bottom:6px;color:#475569;font-size:12px;">分类</div>
              <input id="mobileProductCategoryInput" type="text" maxlength="60" value="${defaultCategory}" placeholder="如：椅子"
                style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;" />
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-bottom:10px;">
            <div style="flex:1;min-width:0;">
              <div style="margin-bottom:6px;color:#475569;font-size:12px;">售价</div>
              <input id="mobileProductPriceInput" type="number" min="0" step="0.01" value="${Number.isFinite(defaultPrice) ? defaultPrice.toFixed(2) : '0.00'}"
                style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;" />
            </div>
            <div style="flex:1;min-width:0;">
              <div style="margin-bottom:6px;color:#475569;font-size:12px;">库存</div>
              <input id="mobileProductStockInput" type="number" min="0" step="1" value="${Number.isFinite(defaultStock) ? Math.max(0, Math.floor(defaultStock)) : 0}"
                style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;" />
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-bottom:10px;">
            <div style="flex:1;min-width:0;">
              <div style="margin-bottom:6px;color:#475569;font-size:12px;">预警值</div>
              <input id="mobileProductMinStockInput" type="number" min="0" step="1" value="${Number.isFinite(defaultMinStock) ? Math.max(0, Math.floor(defaultMinStock)) : 0}"
                style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;" />
            </div>
            <div style="flex:1;min-width:0;">
              <div style="margin-bottom:6px;color:#475569;font-size:12px;">图片URL</div>
              <input id="mobileProductImageInput" type="text" maxlength="255" value="${defaultImage}" placeholder="可选"
                style="width:100%;height:36px;border:1px solid #d9d9d9;border-radius:8px;padding:0 10px;" />
            </div>
          </div>
        </div>
      `,
      onConfirm: async () => {
        const name = String(document.getElementById('mobileProductNameInput')?.value || '').trim();
        const sku = String(document.getElementById('mobileProductSkuInput')?.value || '').trim();
        const category = String(document.getElementById('mobileProductCategoryInput')?.value || '').trim();
        const price = Number(document.getElementById('mobileProductPriceInput')?.value || 0);
        const stockQuantity = Number(document.getElementById('mobileProductStockInput')?.value || 0);
        const minStock = Number(document.getElementById('mobileProductMinStockInput')?.value || 0);
        const imageUrl = String(document.getElementById('mobileProductImageInput')?.value || '').trim();

        if (!name) {
          window.Toast.error('请输入产品名称');
          return false;
        }
        if (!Number.isFinite(price) || price < 0) {
          window.Toast.error('售价格式不正确');
          return false;
        }
        if (!Number.isFinite(stockQuantity) || stockQuantity < 0) {
          window.Toast.error('库存不能小于0');
          return false;
        }
        if (!Number.isFinite(minStock) || minStock < 0) {
          window.Toast.error('预警值不能小于0');
          return false;
        }

        const payload = {
          name,
          sku: sku || null,
          category: category || null,
          price: Number(price.toFixed(2)),
          stock_quantity: Math.max(0, Math.floor(stockQuantity)),
          min_stock: Math.max(0, Math.floor(minStock)),
          image_url: imageUrl || null
        };

        if (mode === 'edit') {
          const productId = String(product?.id || '').trim();
          if (!productId) {
            window.Toast.error('产品ID无效，无法保存');
            return false;
          }
          await window.API.updateProduct(productId, payload);
          window.Toast.success('产品已更新');
        } else {
          await window.API.createProduct(payload);
          window.Toast.success('产品已创建');
        }

        this.currentPage = 1;
        this.products = [];
        this.hasMore = true;
        await this.loadProducts();
        return true;
      }
    });
  }
};
