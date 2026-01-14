/**
 * 卡片管理模块
 * 提供卡片的显示、隐藏、拖拽排序功能
 */

import { userDataManager } from './user-data.js';

/**
 * 卡片管理类
 */
class CardManager {
  constructor() {
    this.cards = new Map();
    this.hiddenCards = new Set();
    this.draggedCard = null;
    this.dragContainer = null;
    this.dragImages = new Map();
    
    // 绑定上下文
    this.bindMethods();
    
    // 初始化
    this.init();
  }

  /**
   * 绑定方法
   */
  bindMethods() {
    // 保存原始方法的引用
    this.hideCard = this.hideCard.bind(this);
    this.showCard = this.showCard.bind(this);
    this.dragStart = this.dragStart.bind(this);
    this.dragEnd = this.dragEnd.bind(this);
    this.dragOver = this.dragOver.bind(this);
    this.drop = this.drop.bind(this);
    this.applyOrder = this.applyOrder.bind(this);
    this.toggleHiddenPanel = this.toggleHiddenPanel.bind(this);
    this.restoreAllCards = this.restoreAllCards.bind(this);
  }

  /**
   * 初始化卡片管理
   */
  async init() {
    console.log('[CardManager] 初始化卡片管理');
    
    // 等待DOM加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        await this.initializeCards();
        this.setupEventListeners();
        this.loadHiddenCards();
      });
    } else {
      await this.initializeCards();
      this.setupEventListeners();
      this.loadHiddenCards();
    }
  }

  /**
   * 初始化卡片
   */
  async initializeCards() {
    // 查找所有卡片容器
    const cardContainers = document.querySelectorAll('.col-sm-3');
    
    cardContainers.forEach((container, index) => {
      if (container.querySelector('.xe-widget')) {
        // 生成唯一ID
        if (!container.id) {
          container.id = `card-${Date.now()}-${index}`;
        }
        
        // 添加拖拽属性
        if (!container.hasAttribute('draggable')) {
          container.setAttribute('draggable', 'true');
        }
        
        // 添加CSS类
        container.classList.add('card-draggable');
        
        // 存储卡片信息
        this.cards.set(container.id, {
          element: container,
          index: index,
          category: this.getCardCategory(container),
          title: this.getCardTitle(container),
          hidden: this.hiddenCards.has(container.id)
        });
        
        // 添加隐藏按钮
        this.addHideButton(container);
        
        // 添加拖拽事件
        this.addDragEvents(container);
      }
    });
    
    console.log(`[CardManager] 已初始化 ${this.cards.size} 个卡片`);
  }

  /**
   * 获取卡片分类
   */
  getCardCategory(container) {
    // 向上查找标题元素
    const heading = container.closest('.card-section')?.querySelector('h4');
    return heading?.textContent?.trim() || '未分类';
  }

  /**
   * 获取卡片标题
   */
  getCardTitle(container) {
    const titleElement = container.querySelector('.xe-user-name strong');
    return titleElement?.textContent?.trim() || '未命名卡片';
  }

  /**
   * 添加隐藏按钮
   */
  addHideButton(container) {
    const widget = container.querySelector('.xe-widget');
    if (!widget) return;
    
    // 检查是否已有隐藏按钮
    if (widget.querySelector('.card-hide-btn')) return;
    
    const hideBtn = document.createElement('button');
    hideBtn.className = 'card-hide-btn';
    hideBtn.innerHTML = '×';
    hideBtn.title = '隐藏此卡片';
    hideBtn.setAttribute('aria-label', '隐藏卡片');
    hideBtn.setAttribute('data-card-id', container.id);
    
    // 添加点击事件
    hideBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.hideCard(container);
    });
    
    // 添加到卡片中
    widget.appendChild(hideBtn);
  }

  /**
   * 添加拖拽事件
   */
  addDragEvents(container) {
    container.addEventListener('dragstart', this.dragStart);
    container.addEventListener('dragend', this.dragEnd);
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 监听拖拽相关事件
    document.addEventListener('dragover', this.dragOver);
    document.addEventListener('drop', this.drop);
    
    // 监听按钮事件
    document.getElementById('showHiddenCards')?.addEventListener('click', this.toggleHiddenPanel);
    document.getElementById('resetOrder')?.addEventListener('click', this.restoreAllCards);
    
    // 监听窗口大小变化
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.handleResize();
      }, 250);
    });
    
    // 监听键盘导航
    document.addEventListener('keydown', this.handleKeyDown);
  }

  /**
   * 拖拽开始
   */
  dragStart(e) {
    const cardId = e.target.id || e.target.closest('.col-sm-3')?.id;
    const card = this.cards.get(cardId);
    
    if (!card || card.hidden) return;
    
    this.draggedCard = card;
    this.dragContainer = card.element;
    
    // 设置拖拽数据
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', cardId);
    
    // 创建拖拽图像
    const dragImage = this.createDragImage(card.element);
    if (dragImage) {
      e.dataTransfer.setDragImage(dragImage, e.offsetX, e.offsetY);
      this.dragImages.set(cardId, dragImage);
    }
    
    // 添加拖拽样式
    card.element.classList.add('dragging');
    
    console.log(`[CardManager] 开始拖拽卡片: ${cardId}`);
  }

  /**
   * 拖拽结束
   */
  dragEnd(e) {
    const cardId = this.draggedCard?.id;
    const card = this.cards.get(cardId);
    
    if (!card) return;
    
    // 清理拖拽样式
    card.element.classList.remove('dragging');
    
    // 清理所有拖拽状态
    document.querySelectorAll('.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });
    
    document.querySelectorAll('.drag-insert-before').forEach(el => {
      el.classList.remove('drag-insert-before');
    });
    
    document.querySelectorAll('.drag-insert-after').forEach(el => {
      el.classList.remove('drag-insert-after');
    });
    
    // 清理拖拽图像
    if (this.dragImages.has(cardId)) {
      const dragImage = this.dragImages.get(cardId);
      if (dragImage && dragImage.parentNode) {
        dragImage.parentNode.removeChild(dragImage);
      }
      this.dragImages.delete(cardId);
    }
    
    // 清理状态
    this.draggedCard = null;
    this.dragContainer = null;
    
    // 保存新排序
    this.saveCardOrder();
    
    console.log(`[CardManager] 结束拖拽: ${cardId}`);
  }

  /**
   * 创建拖拽图像
   */
  createDragImage(element) {
    try {
      const dragImage = element.cloneNode(true);
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-1000px';
      dragImage.style.left = '-1000px';
      dragImage.style.width = element.offsetWidth + 'px';
      dragImage.style.height = element.offsetHeight + 'px';
      dragImage.style.opacity = '0.8';
      dragImage.style.transform = 'rotate(5deg)';
      dragImage.style.background = '#fff';
      dragImage.style.border = '2px solid #ccc';
      dragImage.style.borderRadius = '8px';
      dragImage.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
      dragImage.style.zIndex = '9999';
      
      document.body.appendChild(dragImage);
      
      // 清理函数
      dragImage._cleanup = () => {
        setTimeout(() => {
          if (dragImage.parentNode) {
            dragImage.parentNode.removeChild(dragImage);
          }
        }, 0);
      };
      
      return dragImage;
    } catch (error) {
      console.error('[CardManager] 创建拖拽图像失败:', error);
      return null;
    }
  }

  /**
   * 拖拽悬停
   */
  dragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const target = e.target.closest('.col-sm-3');
    if (!target) return;
    
    const targetCard = this.cards.get(target.id);
    if (!targetCard || targetCard.hidden) return;
    
    // 清理之前的拖拽状态
    document.querySelectorAll('.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });
    document.querySelectorAll('.drag-insert-before').forEach(el => {
      el.classList.remove('drag-insert-before');
    });
    document.querySelectorAll('.drag-insert-after').forEach(el => {
      el.classList.remove('drag-insert-after');
    });
    
    // 添加拖拽悬停效果
    target.classList.add('drag-over');
    
    // 计算插入位置
    if (this.draggedCard && this.draggedCard.id !== target.id) {
      const rect = target.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      
      // 根据鼠标位置判断插入位置
      if (e.clientY < midY) {
        target.classList.add('drag-insert-before');
      } else {
        target.classList.add('drag-insert-after');
      }
    }
  }

  /**
   * 拖拽放置
   */
  drop(e) {
    e.preventDefault();
    
    const target = e.target.closest('.col-sm-3');
    if (!target) return;
    
    const targetCard = this.cards.get(target.id);
    if (!targetCard || targetCard.hidden) return;
    
    const draggedCardId = e.dataTransfer.getData('text/plain');
    const draggedCard = this.cards.get(draggedCardId);
    
    if (!draggedCard || draggedCard.hidden) return;
    
    // 清理所有拖拽状态
    document.querySelectorAll('.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });
    document.querySelectorAll('.drag-insert-before').forEach(el => {
      el.classList.remove('drag-insert-before');
    });
    document.querySelectorAll('.drag-insert-after').forEach(el => {
      el.classList.remove('drag-insert-after');
    });
    
    // 如果不是同一个卡片，则移动
    if (draggedCardId !== target.id) {
      const targetParent = target.parentNode;
      const targetRect = target.getBoundingClientRect();
      const targetMidY = targetRect.top + targetRect.height / 2;
      
      // 确定插入位置
      if (e.clientY < targetMidY) {
        // 插入到目标前面
        targetParent.insertBefore(draggedCard.element, target);
      } else {
        // 插入到目标后面
        targetParent.insertBefore(draggedCard.element, target.nextSibling);
      }
      
      console.log(`[CardManager] 卡片移动: ${draggedCard.id} -> ${target.id}`);
    }
    
    // 保存排序
    this.saveCardOrder();
  }

  /**
   * 隐藏卡片
   */
  async hideCard(container) {
    const cardId = container.id;
    const card = this.cards.get(cardId);
    
    if (!card) {
      console.error(`[CardManager] 未找到卡片: ${cardId}`);
      return;
    }
    
    // 标记为隐藏
    card.hidden = true;
    this.hiddenCards.add(cardId);
    container.classList.add('card-hidden');
    
    // 保存隐藏状态
    await userDataManager.setHiddenCards([...this.hiddenCards]);
    
    // 更新隐藏面板
    this.updateHiddenPanel();
    
    // 显示通知
    userDataManager.showToast('卡片已隐藏', 'info');
    
    console.log(`[CardManager] 隐藏卡片: ${cardId}`);
  }

  /**
   * 显示卡片
   */
  async showCard(cardId) {
    const container = document.getElementById(cardId);
    const card = this.cards.get(cardId);
    
    if (!card) {
      console.error(`[CardManager] 未找到卡片: ${cardId}`);
      return;
    }
    
    // 标记为显示
    card.hidden = false;
    this.hiddenCards.delete(cardId);
    container.classList.remove('card-hidden');
    
    // 保存隐藏状态
    await userDataManager.setHiddenCards([...this.hiddenCards]);
    
    // 更新隐藏面板
    this.updateHiddenPanel();
    
    // 显示通知
    userDataManager.showToast('卡片已显示', 'success');
    
    console.log(`[CardManager] 显示卡片: ${cardId}`);
  }

  /**
   * 切换卡片隐藏状态
   */
  toggleCardVisibility(cardId) {
    const card = this.cards.get(cardId);
    if (card) {
      if (card.hidden) {
        this.showCard(cardId);
      } else {
        this.hideCard(card.element);
      }
    }
  }

  /**
   * 应用排序
   */
  applyOrder(container, order) {
    order.forEach(cardId => {
      const card = this.cards.get(cardId);
      if (card && !card.hidden && container.contains(card.element)) {
        container.appendChild(card.element);
      }
    });
  }

  /**
   * 保存卡片排序
   */
  async saveCardOrder() {
    try {
      // 获取所有可见卡片的排序
      const visibleCards = Array.from(this.cards.values())
        .filter(card => !card.hidden)
        .sort((a, b) => {
          const aIndex = Array.from(a.element.parentNode.children).indexOf(a.element);
          const bIndex = Array.from(b.element.parentNode.children).indexOf(b.element);
          return aIndex - bIndex;
        });
      
      const cardOrder = visibleCards.map(card => card.id);
      
      // 保存到用户数据管理器
      await userDataManager.setCardOrder(cardOrder);
      
      console.log(`[CardManager] 已保存卡片排序: ${cardOrder.length} 个卡片`);
    } catch (error) {
      console.error('[CardManager] 保存卡片排序失败:', error);
    }
  }

  /**
   * 加载隐藏卡片
   */
  async loadHiddenCards() {
    try {
      const hiddenCards = userDataManager.getHiddenCards();
      
      if (Array.isArray(hiddenCards)) {
        this.hiddenCards = new Set(hiddenCards);
        
        hiddenCards.forEach(cardId => {
          const container = document.getElementById(cardId);
          if (container) {
            const card = this.cards.get(cardId);
            if (card) {
              card.hidden = true;
              container.classList.add('card-hidden');
            }
          }
        });
        
        console.log(`[CardManager] 已加载 ${hiddenCards.length} 个隐藏卡片`);
        this.updateHiddenPanel();
      }
    } catch (error) {
      console.error('[CardManager] 加载隐藏卡片失败:', error);
    }
  }

  /**
   * 更新隐藏面板
   */
  updateHiddenPanel() {
    const listContainer = document.getElementById('hiddenCardsList');
    const emptyMessage = document.getElementById('emptyHiddenMessage');
    
    if (!listContainer) return;
    
    // 清空列表
    listContainer.innerHTML = '';
    
    if (this.hiddenCards.size === 0) {
      // 显示空状态
      if (emptyMessage) {
        emptyMessage.style.display = 'block';
      }
      return;
    }
    
    // 隐藏空状态消息
    if (emptyMessage) {
      emptyMessage.style.display = 'none';
    }
    
    // 添加隐藏的卡片
    this.hiddenCards.forEach(cardId => {
      const card = this.cards.get(cardId);
      if (!card) return;
      
      const item = document.createElement('div');
      item.className = 'hidden-card-item';
      item.setAttribute('data-card-id', cardId);
      
      // 标题
      const title = document.createElement('div');
      title.className = 'card-title';
      title.textContent = card.title;
      
      // 恢复按钮
      const restoreBtn = document.createElement('button');
      restoreBtn.className = 'restore-btn';
      restoreBtn.textContent = '恢复显示';
      restoreBtn.onclick = () => this.showCard(cardId);
      
      item.appendChild(title);
      item.appendChild(restoreBtn);
      listContainer.appendChild(item);
    });
  }

  /**
   * 切换隐藏面板
   */
  toggleHiddenPanel() {
    const panel = document.getElementById('hiddenCardsPanel');
    const overlay = document.getElementById('panelOverlay');
    
    if (panel && overlay) {
      const isVisible = panel.classList.contains('active');
      
      if (isVisible) {
        // 关闭面板
        panel.classList.remove('active');
        overlay.classList.remove('active');
      } else {
        // 显示面板
        panel.classList.add('active');
        overlay.classList.add('active');
        this.updateHiddenPanel();
      }
    }
  }

  /**
   * 恢复所有卡片
   */
  async restoreAllCards() {
    if (this.hiddenCards.size === 0) {
      userDataManager.showToast('没有隐藏的卡片', 'info');
      return;
    }
    
    try {
      const confirmed = await this.showConfirm('确定要恢复所有隐藏的卡片吗？');
      if (!confirmed) return;
      
      // 显示所有卡片
      const restorePromises = Array.from(this.hiddenCards).map(cardId => 
        this.showCard(cardId)
      );
      
      await Promise.all(restorePromises);
      
      userDataManager.showToast(`已恢复 ${this.hiddenCards.size} 个卡片`, 'success');
      
      console.log(`[CardManager] 已恢复所有卡片`);
    } catch (error) {
      console.error('[CardManager] 恢复所有卡片失败:', error);
    }
  }

  /**
   * 搜索过滤卡片
   */
  filterCards(keyword) {
    if (!keyword || keyword.trim() === '') {
      // 显示所有可见卡片
      this.cards.forEach(card => {
        if (!card.hidden) {
          card.element.style.display = '';
        }
      });
      return;
    }
    
    const searchTerm = keyword.toLowerCase().trim();
    
    this.cards.forEach(card => {
      if (card.hidden) return;
      
      const title = card.title.toLowerCase();
      const category = card.category.toLowerCase();
      
      const isMatch = title.includes(searchTerm) || category.includes(searchTerm);
      
      if (isMatch) {
        card.element.style.display = '';
      } else {
        card.element.style.display = 'none';
      }
    });
  }

  /**
   * 处理窗口大小变化
   */
  handleResize() {
    // 根据窗口大小调整布局
    const isMobile = window.innerWidth < 768;
    const cards = document.querySelectorAll('.col-sm-3');
    
    cards.forEach(card => {
      if (isMobile) {
        card.classList.add('mobile-layout');
      } else {
        card.classList.remove('mobile-layout');
      }
    });
    
    console.log(`[CardManager] 响应式布局: ${isMobile ? '移动端' : '桌面端'}`);
  }

  /**
   * 处理键盘导航
   */
  handleKeyDown(e) {
    // ESC键关闭面板
    if (e.key === 'Escape') {
      const panel = document.getElementById('hiddenCardsPanel');
      const overlay = document.getElementById('panelOverlay');
      
      if (panel && panel.classList.contains('active')) {
        panel.classList.remove('active');
        overlay.classList.remove('active');
      }
    }
    
    // Ctrl+H 显示帮助
    if (e.ctrlKey && e.key === 'h') {
      e.preventDefault();
      this.showKeyboardHelp();
    }
  }

  /**
   * 显示键盘帮助
   */
  showKeyboardHelp() {
    userDataManager.showToast('键盘快捷键: ESC - 关闭面板, Ctrl+H - 显示帮助', 'info');
  }

  /**
   * 显示确认对话框
   */
  async showConfirm(message) {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirmModal');
      const titleElement = document.getElementById('modalTitle');
      const messageElement = document.getElementById('modalMessage');
      const confirmBtn = document.getElementById('modalConfirm');
      const cancelBtn = document.getElementById('modalCancel');
      
      if (!modal || !titleElement || !messageElement || !confirmBtn || !cancelBtn) {
        resolve(false);
        return;
      }
      
      titleElement.textContent = '确认操作';
      messageElement.textContent = message;
      
      modal.style.display = 'flex';
      
      const handleConfirm = () => {
        modal.style.display = 'none';
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        resolve(true);
      };
      
      const handleCancel = () => {
        modal.style.display = 'none';
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        resolve(false);
      };
      
      confirmBtn.addEventListener('click', handleConfirm);
      cancelBtn.addEventListener('click', handleCancel);
    });
  }

  /**
   * 获取卡片统计信息
   */
  getStats() {
    return {
      total: this.cards.size,
      visible: Array.from(this.cards.values()).filter(card => !card.hidden).length,
      hidden: this.hiddenCards.size,
      categories: this.getCategories()
    };
  }

  /**
   * 获取分类统计
   */
  getCategories() {
    const categories = new Map();
    
    this.cards.forEach(card => {
      if (!card.hidden) {
        const category = card.category;
        categories.set(category, (categories.get(category) || 0) + 1);
      }
    });
    
    return Object.from(categories.entries()).map(([name, count]) => ({
      name,
      count
    }));
  }

  /**
   * 批量操作
   */
  batchHide(cardIds) {
    const hidePromises = cardIds.map(id => this.hideCard(document.getElementById(id)));
    return Promise.all(hidePromises);
  }

  /**
   * 批量显示
   */
  batchShow(cardIds) {
    const showPromises = cardIds.map(id => this.showCard(id));
    return Promise.all(showPromises);
  }
}

// 创建单例实例
const cardManager = new CardManager();

// 导出实例和类
export default cardManager;
export { CardManager };