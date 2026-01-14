/**
 * 收藏管理模块
 * 负责管理用户收藏的网站和导航项
 */
export class FavoriteManager {
  constructor(userDataManager, notificationManager) {
    this.userDataManager = userDataManager;
    this.notificationManager = notificationManager;
    this.favorites = new Map();
    this.categories = new Map();
    this.isInitialized = false;
    
    this.init();
  }

  /**
   * 初始化收藏管理器
   */
  async init() {
    try {
      await this.loadFavorites();
      this.setupEventListeners();
      this.isInitialized = true;
      console.log('收藏管理器初始化完成');
    } catch (error) {
      console.error('收藏管理器初始化失败:', error);
      if (this.notificationManager) {
        this.notificationManager.error('收藏功能初始化失败');
      }
    }
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 监听收藏按钮点击
    document.addEventListener('click', async (e) => {
      if (e.target.classList.contains('favorite-btn') || 
          e.target.closest('.favorite-btn')) {
        e.preventDefault();
        const btn = e.target.classList.contains('favorite-btn') ? 
                   e.target : e.target.closest('.favorite-btn');
        await this.toggleFavorite(btn);
      }

      // 监听收藏管理面板
      if (e.target.classList.contains('favorites-manage-btn')) {
        this.showManagePanel();
      }

      // 监听分类管理
      if (e.target.classList.contains('category-add-btn')) {
        this.showCategoryDialog();
      }

      // 监听批量操作
      if (e.target.classList.contains('favorite-batch-delete')) {
        this.batchDeleteFavorites();
      }
    });

    // 监听键盘快捷键
    document.addEventListener('keydown', (e) => {
      // Ctrl+D 添加到收藏
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        this.addToFavoritesFromCurrentPage();
      }
    });
  }

  /**
   * 加载收藏数据
   */
  async loadFavorites() {
    try {
      const userData = await this.userDataManager.getUserData();
      const favoritesData = userData.favorites || {};
      
      this.favorites.clear();
      this.categories.clear();

      // 加载收藏项
      if (favoritesData.items) {
        favoritesData.items.forEach(item => {
          this.favorites.set(item.id, item);
        });
      }

      // 加载分类
      if (favoritesData.categories) {
        favoritesData.categories.forEach(category => {
          this.categories.set(category.id, category);
        });
      }

      // 创建默认分类
      if (this.categories.size === 0) {
        this.createDefaultCategories();
      }

      this.renderFavorites();
    } catch (error) {
      console.error('加载收藏数据失败:', error);
      throw error;
    }
  }

  /**
   * 创建默认分类
   */
  createDefaultCategories() {
    const defaultCategories = [
      { id: 'default', name: '默认分类', icon: 'folder', color: '#007bff' },
      { id: 'work', name: '工作相关', icon: 'briefcase', color: '#28a745' },
      { id: 'life', name: '生活娱乐', icon: 'heart', color: '#dc3545' },
      { id: 'study', name: '学习资源', icon: 'book', color: '#ffc107' },
      { id: 'tools', name: '实用工具', icon: 'wrench', color: '#6f42c1' }
    ];

    defaultCategories.forEach(category => {
      this.categories.set(category.id, category);
    });
  }

  /**
   * 切换收藏状态
   */
  async toggleFavorite(button) {
    if (!this.isInitialized) {
      this.notificationManager.warning('收藏功能正在初始化中...');
      return;
    }

    const itemData = this.extractItemData(button);
    if (!itemData) {
      this.notificationManager.error('无法获取网站信息');
      return;
    }

    const isFavorited = this.favorites.has(itemData.id);
    
    try {
      if (isFavorited) {
        await this.removeFromFavorites(itemData.id);
        this.updateButtonState(button, false);
        this.notificationManager.success('已取消收藏');
      } else {
        await this.addToFavorites(itemData);
        this.updateButtonState(button, true);
        this.notificationManager.success('已添加到收藏');
      }
    } catch (error) {
      console.error('收藏操作失败:', error);
      this.notificationManager.error('收藏操作失败，请重试');
    }
  }

  /**
   * 从按钮元素提取项目数据
   */
  extractItemData(button) {
    const card = button.closest('.website-card, .search-result-item, .card');
    if (!card) return null;

    const id = card.dataset.id || card.dataset.siteId || 
               `site_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const title = card.querySelector('.card-title, .site-title, h3, .title')?.textContent?.trim() || 
                  card.getAttribute('title') || 
                  document.title;
    
    const url = card.querySelector('a')?.href || 
                card.dataset.url || 
                window.location.href;
    
    const description = card.querySelector('.card-text, .site-description, .description')?.textContent?.trim() || '';
    
    const imageUrl = card.querySelector('img')?.src || 
                     card.dataset.image || '';
    
    const category = card.dataset.category || 'default';

    return {
      id,
      title,
      url,
      description,
      imageUrl,
      category,
      addedAt: new Date().toISOString()
    };
  }

  /**
   * 添加到收藏
   */
  async addToFavorites(itemData) {
    // 生成唯一ID
    if (!itemData.id) {
      itemData.id = `fav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // 检查是否已存在
    if (this.favorites.has(itemData.id)) {
      throw new Error('该项目已在收藏中');
    }

    // 添加到本地
    this.favorites.set(itemData.id, {
      ...itemData,
      addedAt: new Date().toISOString()
    });

    // 保存到后端
    await this.saveFavorites();

    // 更新UI
    this.renderFavorites();
  }

  /**
   * 从收藏中移除
   */
  async removeFromFavorites(itemId) {
    if (!this.favorites.has(itemId)) {
      throw new Error('收藏项不存在');
    }

    // 从本地移除
    this.favorites.delete(itemId);

    // 保存到后端
    await this.saveFavorites();

    // 更新UI
    this.renderFavorites();
  }

  /**
   * 保存收藏数据
   */
  async saveFavorites() {
    const favoritesData = {
      items: Array.from(this.favorites.values()),
      categories: Array.from(this.categories.values()),
      updatedAt: new Date().toISOString()
    };

    await this.userDataManager.updateUserData({ favorites: favoritesData });
  }

  /**
   * 渲染收藏列表
   */
  renderFavorites() {
    const container = document.getElementById('favorites-container');
    if (!container) return;

    const favorites = Array.from(this.favorites.values());
    
    if (favorites.length === 0) {
      container.innerHTML = `
        <div class="empty-favorites">
          <div class="empty-icon">📚</div>
          <h3>还没有收藏</h3>
          <p>点击网站卡片上的收藏按钮开始收藏你喜欢的网站</p>
        </div>
      `;
      return;
    }

    // 按分类分组
    const groupedFavorites = this.groupByCategory(favorites);
    
    let html = '';
    this.categories.forEach((category, categoryId) => {
      const categoryFavorites = groupedFavorites[categoryId] || [];
      if (categoryFavorites.length === 0) return;

      html += `
        <div class="favorites-category" data-category="${categoryId}">
          <div class="category-header">
            <div class="category-info">
              <i class="category-icon">${this.getCategoryIcon(category.icon)}</i>
              <h4>${category.name}</h4>
              <span class="category-count">${categoryFavorites.length} 项</span>
            </div>
            <div class="category-actions">
              <button class="btn btn-sm btn-outline-secondary category-edit-btn" data-id="${categoryId}">
                <i class="fas fa-edit"></i>
              </button>
              ${categoryId !== 'default' ? `
                <button class="btn btn-sm btn-outline-danger category-delete-btn" data-id="${categoryId}">
                  <i class="fas fa-trash"></i>
                </button>
              ` : ''}
            </div>
          </div>
          <div class="favorites-grid">
            ${categoryFavorites.map(item => this.renderFavoriteItem(item)).join('')}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // 添加事件监听器
    this.attachFavoriteItemListeners();
  }

  /**
   * 按分类分组
   */
  groupByCategory(favorites) {
    return favorites.reduce((groups, item) => {
      const categoryId = item.category || 'default';
      if (!groups[categoryId]) {
        groups[categoryId] = [];
      }
      groups[categoryId].push(item);
      return groups;
    }, {});
  }

  /**
   * 获取分类图标
   */
  getCategoryIcon(iconName) {
    const icons = {
      folder: '📁',
      briefcase: '💼',
      heart: '❤️',
      book: '📚',
      wrench: '🔧',
      star: '⭐',
      game: '🎮',
      music: '🎵',
      video: '🎬',
      news: '📰'
    };
    return icons[iconName] || '📁';
  }

  /**
   * 渲染收藏项
   */
  renderFavoriteItem(item) {
    return `
      <div class="favorite-item" data-id="${item.id}">
        <div class="favorite-content">
          <div class="favorite-image">
            ${item.imageUrl ? 
              `<img src="${item.imageUrl}" alt="${item.title}" onerror="this.style.display='none'">` :
              `<div class="favorite-favicon">${this.getFaviconLetter(item.title)}</div>`
            }
          </div>
          <div class="favorite-info">
            <h5 class="favorite-title">${item.title}</h5>
            <p class="favorite-description">${item.description || '暂无描述'}</p>
            <div class="favorite-meta">
              <span class="favorite-url">${this.extractDomain(item.url)}</span>
              <span class="favorite-date">${this.formatDate(item.addedAt)}</span>
            </div>
          </div>
        </div>
        <div class="favorite-actions">
          <a href="${item.url}" target="_blank" class="btn btn-sm btn-outline-primary visit-btn">
            <i class="fas fa-external-link-alt"></i>
          </a>
          <button class="btn btn-sm btn-outline-warning edit-btn" data-id="${item.id}">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger remove-btn" data-id="${item.id}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * 获取网站首字母作为图标
   */
  getFaviconLetter(title) {
    return title.charAt(0).toUpperCase();
  }

  /**
   * 提取域名
   */
  extractDomain(url) {
    try {
      const domain = new URL(url).hostname;
      return domain.replace('www.', '');
    } catch {
      return url;
    }
  }

  /**
   * 格式化日期
   */
  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) return '昨天';
      if (diffDays < 7) return `${diffDays}天前`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)}个月前`;
      return `${Math.floor(diffDays / 365)}年前`;
    } catch {
      return '未知时间';
    }
  }

  /**
   * 更新按钮状态
   */
  updateButtonState(button, isFavorited) {
    const icon = button.querySelector('i') || button;
    
    if (isFavorited) {
      button.classList.add('active');
      button.title = '取消收藏';
      if (icon.classList.contains('far')) {
        icon.classList.remove('far');
        icon.classList.add('fas');
      }
    } else {
      button.classList.remove('active');
      button.title = '添加到收藏';
      if (icon.classList.contains('fas')) {
        icon.classList.remove('fas');
        icon.classList.add('far');
      }
    }
  }

  /**
   * 为收藏项添加事件监听器
   */
  attachFavoriteItemListeners() {
    // 移除按钮
    document.querySelectorAll('.favorite-item .remove-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const itemId = btn.dataset.id;
        if (confirm('确定要移除这个收藏吗？')) {
          try {
            await this.removeFromFavorites(itemId);
            this.notificationManager.success('已移除收藏');
          } catch (error) {
            this.notificationManager.error('移除收藏失败');
          }
        }
      });
    });

    // 编辑按钮
    document.querySelectorAll('.favorite-item .edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const itemId = btn.dataset.id;
        this.showEditDialog(itemId);
      });
    });

    // 分类操作按钮
    document.querySelectorAll('.category-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const categoryId = btn.dataset.id;
        this.deleteCategory(categoryId);
      });
    });
  }

  /**
   * 显示编辑对话框
   */
  showEditDialog(itemId) {
    const item = this.favorites.get(itemId);
    if (!item) return;

    // 创建模态对话框
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">编辑收藏</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <form id="edit-favorite-form">
              <div class="mb-3">
                <label for="edit-title" class="form-label">标题</label>
                <input type="text" class="form-control" id="edit-title" value="${item.title}" required>
              </div>
              <div class="mb-3">
                <label for="edit-url" class="form-label">网址</label>
                <input type="url" class="form-control" id="edit-url" value="${item.url}" required>
              </div>
              <div class="mb-3">
                <label for="edit-description" class="form-label">描述</label>
                <textarea class="form-control" id="edit-description" rows="3">${item.description || ''}</textarea>
              </div>
              <div class="mb-3">
                <label for="edit-category" class="form-label">分类</label>
                <select class="form-control" id="edit-category">
                  ${Array.from(this.categories.values()).map(cat => 
                    `<option value="${cat.id}" ${cat.id === item.category ? 'selected' : ''}>${cat.name}</option>`
                  ).join('')}
                </select>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
            <button type="button" class="btn btn-primary" id="save-favorite-btn">保存</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // 显示模态框
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    // 保存按钮事件
    document.getElementById('save-favorite-btn').addEventListener('click', async () => {
      const formData = {
        title: document.getElementById('edit-title').value,
        url: document.getElementById('edit-url').value,
        description: document.getElementById('edit-description').value,
        category: document.getElementById('edit-category').value
      };

      try {
        await this.updateFavorite(itemId, formData);
        bsModal.hide();
        this.notificationManager.success('收藏已更新');
      } catch (error) {
        this.notificationManager.error('更新失败');
      }
    });

    // 模态框关闭时清理
    modal.addEventListener('hidden.bs.modal', () => {
      document.body.removeChild(modal);
    });
  }

  /**
   * 更新收藏项
   */
  async updateFavorite(itemId, updates) {
    const item = this.favorites.get(itemId);
    if (!item) {
      throw new Error('收藏项不存在');
    }

    const updatedItem = {
      ...item,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.favorites.set(itemId, updatedItem);
    await this.saveFavorites();
    this.renderFavorites();
  }

  /**
   * 删除分类
   */
  async deleteCategory(categoryId) {
    if (categoryId === 'default') {
      this.notificationManager.error('默认分类不能删除');
      return;
    }

    if (!confirm('删除分类后，该分类下的所有收藏将移至默认分类，确定要删除吗？')) {
      return;
    }

    // 将该分类下的收藏移至默认分类
    this.favorites.forEach((item, itemId) => {
      if (item.category === categoryId) {
        item.category = 'default';
      }
    });

    // 删除分类
    this.categories.delete(categoryId);

    await this.saveFavorites();
    this.renderFavorites();
    this.notificationManager.success('分类已删除');
  }

  /**
   * 显示管理面板
   */
  showManagePanel() {
    // 这里可以实现收藏管理界面
    this.notificationManager.info('收藏管理功能开发中...');
  }

  /**
   * 从当前页面添加到收藏
   */
  addToFavoritesFromCurrentPage() {
    const itemData = {
      id: `page_${Date.now()}`,
      title: document.title,
      url: window.location.href,
      description: document.querySelector('meta[name="description"]')?.content || '',
      category: 'default'
    };

    this.addToFavorites(itemData)
      .then(() => {
        this.notificationManager.success(`已收藏页面: ${document.title}`);
      })
      .catch(error => {
        if (error.message === '该项目已在收藏中') {
          this.notificationManager.info('当前页面已在收藏中');
        } else {
          this.notificationManager.error('收藏失败');
        }
      });
  }

  /**
   * 批量删除收藏
   */
  async batchDeleteFavorites() {
    const selectedIds = Array.from(document.querySelectorAll('.favorite-item.selected'))
      .map(item => item.dataset.id);

    if (selectedIds.length === 0) {
      this.notificationManager.warning('请先选择要删除的收藏项');
      return;
    }

    if (confirm(`确定要删除选中的 ${selectedIds.length} 个收藏项吗？`)) {
      try {
        selectedIds.forEach(id => this.favorites.delete(id));
        await this.saveFavorites();
        this.renderFavorites();
        this.notificationManager.success(`已删除 ${selectedIds.length} 个收藏项`);
      } catch (error) {
        this.notificationManager.error('批量删除失败');
      }
    }
  }

  /**
   * 搜索收藏
   */
  searchFavorites(query) {
    const favorites = Array.from(this.favorites.values());
    const lowerQuery = query.toLowerCase();
    
    return favorites.filter(item => 
      item.title.toLowerCase().includes(lowerQuery) ||
      item.description.toLowerCase().includes(lowerQuery) ||
      item.url.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * 获取收藏统计
   */
  getStats() {
    const favorites = Array.from(this.favorites.values());
    const categoryStats = {};
    
    this.categories.forEach((category, categoryId) => {
      categoryStats[categoryId] = {
        name: category.name,
        count: favorites.filter(item => item.category === categoryId).length
      };
    });

    return {
      total: favorites.length,
      categories: categoryStats,
      recent: favorites
        .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
        .slice(0, 5)
    };
  }
}

// 导出单例实例
export const favoriteManager = new FavoriteManager();

// 导出到全局作用域（向后兼容）
window.favoriteManager = favoriteManager;