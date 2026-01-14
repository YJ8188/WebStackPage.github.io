/**
 * 搜索管理模块
 * 负责网站搜索、建议、历史记录等功能
 */
export class SearchManager {
  constructor(userDataManager, notificationManager) {
    this.userDataManager = userDataManager;
    this.notificationManager = notificationManager;
    this.searchHistory = [];
    this.searchSuggestions = [];
    this.searchIndex = new Map();
    this.isInitialized = false;
    this.debounceTimer = null;
    
    this.init();
  }

  /**
   * 初始化搜索管理器
   */
  async init() {
    try {
      await this.loadSearchData();
      this.buildSearchIndex();
      this.setupEventListeners();
      this.isInitialized = true;
      console.log('搜索管理器初始化完成');
    } catch (error) {
      console.error('搜索管理器初始化失败:', error);
      if (this.notificationManager) {
        this.notificationManager.error('搜索功能初始化失败');
      }
    }
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 搜索输入事件
    document.addEventListener('input', (e) => {
      if (e.target.classList.contains('search-input') || 
          e.target.id === 'search-input') {
        this.handleSearchInput(e.target);
      }
    });

    // 搜索提交事件
    document.addEventListener('submit', (e) => {
      if (e.target.classList.contains('search-form') || 
          e.target.id === 'search-form') {
        e.preventDefault();
        this.handleSearchSubmit(e.target);
      }
    });

    // 搜索框焦点事件
    document.addEventListener('focus', (e) => {
      if (e.target.classList.contains('search-input') || 
          e.target.id === 'search-input') {
        this.showSearchSuggestions(e.target);
      }
    }, true);

    // 搜索框失焦事件
    document.addEventListener('blur', (e) => {
      if (e.target.classList.contains('search-input') || 
          e.target.id === 'search-input') {
        setTimeout(() => this.hideSearchSuggestions(), 200);
      }
    }, true);

    // 键盘导航
    document.addEventListener('keydown', (e) => {
      this.handleSearchKeyNavigation(e);
    });

    // 搜索建议点击
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('search-suggestion-item')) {
        e.preventDefault();
        this.selectSuggestion(e.target);
      }
    });

    // 清除搜索历史
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('clear-search-history')) {
        this.clearSearchHistory();
      }
    });

    // 全局搜索快捷键 (Ctrl+K 或 Cmd+K)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this.focusSearchInput();
      }
    });
  }

  /**
   * 加载搜索数据
   */
  async loadSearchData() {
    try {
      const userData = await this.userDataManager.getUserData();
      const searchData = userData.search || {};
      
      this.searchHistory = searchData.history || [];
      this.searchSuggestions = searchData.suggestions || this.generateDefaultSuggestions();
      
      // 加载网站数据
      await this.loadWebsiteData();
    } catch (error) {
      console.error('加载搜索数据失败:', error);
      this.searchHistory = [];
      this.searchSuggestions = this.generateDefaultSuggestions();
    }
  }

  /**
   * 生成默认搜索建议
   */
  generateDefaultSuggestions() {
    return [
      { text: 'Google', type: 'search-engine', url: 'https://www.google.com' },
      { text: '百度', type: 'search-engine', url: 'https://www.baidu.com' },
      { text: 'Bing', type: 'search-engine', url: 'https://www.bing.com' },
      { text: 'GitHub', type: 'development', url: 'https://github.com' },
      { text: 'Stack Overflow', type: 'development', url: 'https://stackoverflow.com' },
      { text: 'MDN', type: 'development', url: 'https://developer.mozilla.org' }
    ];
  }

  /**
   * 加载网站数据
   */
  async loadWebsiteData() {
    try {
      // 从DOM中加载网站数据
      const websiteCards = document.querySelectorAll('.website-card, .card[data-site-url]');
      this.searchIndex.clear();

      websiteCards.forEach(card => {
        const websiteData = this.extractWebsiteData(card);
        if (websiteData) {
          this.searchIndex.set(websiteData.id, websiteData);
        }
      });

      // 如果有API接口，也可以从后端加载
      // await this.loadWebsiteDataFromAPI();
    } catch (error) {
      console.error('加载网站数据失败:', error);
    }
  }

  /**
   * 从卡片提取网站数据
   */
  extractWebsiteData(card) {
    const title = card.querySelector('.card-title, .site-title, h3, .title')?.textContent?.trim();
    const url = card.querySelector('a')?.href || card.dataset.siteUrl;
    const description = card.querySelector('.card-text, .site-description, .description')?.textContent?.trim();
    const category = card.dataset.category || '';
    const tags = card.dataset.tags?.split(',').map(tag => tag.trim()) || [];

    if (!title && !url) return null;

    return {
      id: card.dataset.id || card.dataset.siteId || `site_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: title || url,
      url: url || '#',
      description: description || '',
      category: category,
      tags: tags,
      element: card
    };
  }

  /**
   * 构建搜索索引
   */
  buildSearchIndex() {
    // 为每个网站构建搜索关键词
    this.searchIndex.forEach((website, id) => {
      const keywords = [
        website.title,
        website.description,
        website.category,
        ...(website.tags || [])
      ].filter(Boolean).join(' ').toLowerCase();

      website.searchKeywords = keywords;
    });
  }

  /**
   * 处理搜索输入
   */
  handleSearchInput(input) {
    const query = input.value.trim();
    
    // 清除之前的定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // 设置新的定时器
    this.debounceTimer = setTimeout(() => {
      if (query.length > 0) {
        this.showSearchSuggestions(input, query);
      } else {
        this.hideSearchSuggestions();
      }
    }, 300);
  }

  /**
   * 处理搜索提交
   */
  async handleSearchSubmit(form) {
    const input = form.querySelector('.search-input, #search-input');
    const query = input.value.trim();

    if (!query) return;

    try {
      // 添加到搜索历史
      await this.addToSearchHistory(query);
      
      // 执行搜索
      const results = await this.performSearch(query);
      
      // 显示搜索结果
      this.displaySearchResults(query, results);
      
      // 隐藏建议
      this.hideSearchSuggestions();
      
    } catch (error) {
      console.error('搜索失败:', error);
      this.notificationManager.error('搜索失败，请重试');
    }
  }

  /**
   * 执行搜索
   */
  async performSearch(query) {
    const lowerQuery = query.toLowerCase();
    const results = {
      websites: [],
      suggestions: [],
      history: []
    };

    // 搜索网站
    this.searchIndex.forEach(website => {
      const score = this.calculateRelevanceScore(lowerQuery, website);
      if (score > 0) {
        results.websites.push({
          ...website,
          score: score
        });
      }
    });

    // 按相关性排序
    results.websites.sort((a, b) => b.score - a.score);

    // 搜索建议
    results.suggestions = this.searchSuggestions
      .filter(suggestion => 
        suggestion.text.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 5);

    // 相关历史记录
    results.history = this.searchHistory
      .filter(item => item.toLowerCase().includes(lowerQuery))
      .slice(0, 3);

    return results;
  }

  /**
   * 计算相关性得分
   */
  calculateRelevanceScore(query, website) {
    let score = 0;
    const keywords = website.searchKeywords || '';

    // 标题完全匹配
    if (website.title.toLowerCase() === query) {
      score += 100;
    }
    // 标题开头匹配
    else if (website.title.toLowerCase().startsWith(query)) {
      score += 80;
    }
    // 标题包含
    else if (website.title.toLowerCase().includes(query)) {
      score += 60;
    }

    // 描述匹配
    if (website.description && website.description.toLowerCase().includes(query)) {
      score += 30;
    }

    // 分类匹配
    if (website.category && website.category.toLowerCase().includes(query)) {
      score += 20;
    }

    // 标签匹配
    if (website.tags) {
      website.tags.forEach(tag => {
        if (tag.toLowerCase().includes(query)) {
          score += 15;
        }
      });
    }

    // 关键词匹配
    const keywordMatches = (keywords.match(new RegExp(query, 'gi')) || []).length;
    score += keywordMatches * 10;

    return score;
  }

  /**
   * 显示搜索结果
   */
  displaySearchResults(query, results) {
    const resultsContainer = document.getElementById('search-results') || 
                           document.querySelector('.search-results');
    
    if (!resultsContainer) return;

    let html = `
      <div class="search-results-header">
        <h3>搜索结果: "${query}"</h3>
        <div class="search-results-stats">
          找到 ${results.websites.length} 个网站
        </div>
      </div>
    `;

    // 显示网站结果
    if (results.websites.length > 0) {
      html += '<div class="search-results-websites">';
      results.websites.forEach(website => {
        html += this.renderWebsiteResult(website);
      });
      html += '</div>';
    }

    // 显示搜索建议
    if (results.suggestions.length > 0) {
      html += '<div class="search-suggestions-section">';
      html += '<h4>搜索建议</h4>';
      results.suggestions.forEach(suggestion => {
        html += `
          <div class="search-suggestion-result" data-url="${suggestion.url}">
            <i class="fas fa-search"></i>
            <span>${suggestion.text}</span>
          </div>
        `;
      });
      html += '</div>';
    }

    // 显示搜索历史
    if (results.history.length > 0) {
      html += '<div class="search-history-section">';
      html += '<h4>搜索历史</h4>';
      results.history.forEach(item => {
        html += `
          <div class="search-history-item">
            <i class="fas fa-history"></i>
            <span>${item}</span>
          </div>
        `;
      });
      html += '</div>';
    }

    if (results.websites.length === 0 && results.suggestions.length === 0) {
      html += `
        <div class="no-results">
          <div class="no-results-icon">🔍</div>
          <h4>未找到相关结果</h4>
          <p>尝试使用不同的关键词或检查拼写</p>
        </div>
      `;
    }

    resultsContainer.innerHTML = html;

    // 添加点击事件
    this.attachSearchResultsListeners();
  }

  /**
   * 渲染网站搜索结果
   */
  renderWebsiteResult(website) {
    const description = website.description || '暂无描述';
    const category = website.category || '其他';
    const tags = website.tags ? website.tags.slice(0, 3).join(', ') : '';

    return `
      <div class="search-result-item" data-id="${website.id}">
        <div class="search-result-content">
          <div class="search-result-header">
            <h4 class="search-result-title">${website.title}</h4>
            <div class="search-result-meta">
              <span class="search-result-category">${category}</span>
              ${website.score ? `<span class="search-result-score">${website.score}</span>` : ''}
            </div>
          </div>
          <p class="search-result-description">${description}</p>
          ${tags ? `<div class="search-result-tags">${tags}</div>` : ''}
          <div class="search-result-actions">
            <a href="${website.url}" target="_blank" class="btn btn-sm btn-primary">
              <i class="fas fa-external-link-alt"></i> 访问
            </a>
            <button class="btn btn-sm btn-outline-secondary add-to-favorites" data-id="${website.id}">
              <i class="far fa-star"></i> 收藏
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 显示搜索建议
   */
  showSearchSuggestions(input, query = '') {
    let suggestions = [];

    if (query) {
      // 搜索匹配的建议
      suggestions = this.searchSuggestions
        .filter(suggestion => 
          suggestion.text.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 8);

      // 添加匹配的搜索历史
      const historyMatches = this.searchHistory
        .filter(item => 
          item.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 3);

      historyMatches.forEach(item => {
        suggestions.push({
          text: item,
          type: 'history',
          url: null
        });
      });
    } else {
      // 显示最近的搜索历史
      suggestions = this.searchHistory
        .slice(0, 8)
        .map(item => ({
          text: item,
          type: 'history',
          url: null
        }));

      // 如果没有历史记录，显示默认建议
      if (suggestions.length === 0) {
        suggestions = this.searchSuggestions.slice(0, 8);
      }
    }

    this.renderSearchSuggestions(input, suggestions);
  }

  /**
   * 渲染搜索建议
   */
  renderSearchSuggestions(input, suggestions) {
    // 移除旧的建议容器
    this.hideSearchSuggestions();

    if (suggestions.length === 0) return;

    const suggestionsContainer = document.createElement('div');
    suggestionsContainer.className = 'search-suggestions';
    suggestionsContainer.innerHTML = '';

    suggestions.forEach((suggestion, index) => {
      const item = document.createElement('div');
      item.className = 'search-suggestion-item';
      item.dataset.index = index;
      
      let icon = '';
      switch (suggestion.type) {
        case 'history':
          icon = '<i class="fas fa-history"></i>';
          break;
        case 'search-engine':
          icon = '<i class="fas fa-search"></i>';
          break;
        case 'development':
          icon = '<i class="fas fa-code"></i>';
          break;
        default:
          icon = '<i class="fas fa-globe"></i>';
      }

      item.innerHTML = `
        <div class="suggestion-icon">${icon}</div>
        <div class="suggestion-text">${suggestion.text}</div>
        ${suggestion.type === 'history' ? 
          `<div class="suggestion-remove" data-text="${suggestion.text}">
            <i class="fas fa-times"></i>
          </div>` : ''
        }
      `;

      // 鼠标悬停高亮
      item.addEventListener('mouseenter', () => {
        this.highlightSuggestion(index);
      });

      suggestionsContainer.appendChild(item);
    });

    // 插入到搜索框后面
    input.parentNode.style.position = 'relative';
    input.parentNode.appendChild(suggestionsContainer);

    // 显示建议
    requestAnimationFrame(() => {
      suggestionsContainer.classList.add('show');
    });
  }

  /**
   * 隐藏搜索建议
   */
  hideSearchSuggestions() {
    const container = document.querySelector('.search-suggestions');
    if (container) {
      container.remove();
    }
  }

  /**
   * 选择建议
   */
  selectSuggestion(element) {
    const input = document.querySelector('.search-input, #search-input');
    const text = element.querySelector('.suggestion-text').textContent;
    
    if (input) {
      input.value = text;
      input.focus();
    }

    this.hideSearchSuggestions();

    // 如果建议包含URL，直接跳转
    const url = element.dataset.url;
    if (url) {
      window.open(url, '_blank');
    } else {
      // 否则执行搜索
      const form = input.closest('.search-form, #search-form');
      if (form) {
        this.handleSearchSubmit(form);
      }
    }
  }

  /**
   * 键盘导航
   */
  handleSearchKeyNavigation(e) {
    const input = e.target;
    if (!input.classList.contains('search-input') && 
        input.id !== 'search-input') return;

    const container = document.querySelector('.search-suggestions');
    if (!container) return;

    const items = container.querySelectorAll('.search-suggestion-item');
    let currentIndex = -1;

    // 找到当前高亮的项
    items.forEach((item, index) => {
      if (item.classList.contains('highlighted')) {
        currentIndex = index;
      }
    });

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        currentIndex = Math.min(currentIndex + 1, items.length - 1);
        this.highlightSuggestion(currentIndex);
        break;

      case 'ArrowUp':
        e.preventDefault();
        currentIndex = Math.max(currentIndex - 1, 0);
        this.highlightSuggestion(currentIndex);
        break;

      case 'Enter':
        e.preventDefault();
        if (currentIndex >= 0) {
          this.selectSuggestion(items[currentIndex]);
        }
        break;

      case 'Escape':
        this.hideSearchSuggestions();
        break;
    }
  }

  /**
   * 高亮建议项
   */
  highlightSuggestion(index) {
    const container = document.querySelector('.search-suggestions');
    if (!container) return;

    const items = container.querySelectorAll('.search-suggestion-item');
    items.forEach((item, i) => {
      if (i === index) {
        item.classList.add('highlighted');
        // 确保高亮项在视图中
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('highlighted');
      }
    });
  }

  /**
   * 聚焦搜索输入框
   */
  focusSearchInput() {
    const input = document.querySelector('.search-input, #search-input');
    if (input) {
      input.focus();
      input.select();
    }
  }

  /**
   * 添加到搜索历史
   */
  async addToSearchHistory(query) {
    // 移除重复项
    this.searchHistory = this.searchHistory.filter(item => item !== query);
    
    // 添加到开头
    this.searchHistory.unshift(query);
    
    // 限制历史记录数量
    if (this.searchHistory.length > 50) {
      this.searchHistory = this.searchHistory.slice(0, 50);
    }

    // 保存到后端
    await this.saveSearchData();
  }

  /**
   * 清除搜索历史
   */
  async clearSearchHistory() {
    if (confirm('确定要清除所有搜索历史吗？')) {
      this.searchHistory = [];
      await this.saveSearchData();
      this.notificationManager.success('搜索历史已清除');
    }
  }

  /**
   * 保存搜索数据
   */
  async saveSearchData() {
    const searchData = {
      history: this.searchHistory,
      suggestions: this.searchSuggestions,
      updatedAt: new Date().toISOString()
    };

    await this.userDataManager.updateUserData({ search: searchData });
  }

  /**
   * 为搜索结果添加事件监听器
   */
  attachSearchResultsListeners() {
    // 收藏按钮
    document.querySelectorAll('.add-to-favorites').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const websiteId = btn.dataset.id;
        // 调用收藏管理器
        if (window.favoriteManager) {
          const website = this.searchIndex.get(websiteId);
          if (website) {
            window.favoriteManager.addToFavorites(website)
              .then(() => {
                btn.innerHTML = '<i class="fas fa-star"></i> 已收藏';
                btn.disabled = true;
              })
              .catch(error => {
                console.error('收藏失败:', error);
              });
          }
        }
      });
    });

    // 搜索建议结果
    document.querySelectorAll('.search-suggestion-result').forEach(item => {
      item.addEventListener('click', () => {
        const url = item.dataset.url;
        if (url) {
          window.open(url, '_blank');
        }
      });
    });

    // 历史记录项
    document.querySelectorAll('.search-history-item').forEach(item => {
      item.addEventListener('click', () => {
        const text = item.querySelector('span').textContent;
        const input = document.querySelector('.search-input, #search-input');
        if (input) {
          input.value = text;
          input.focus();
        }
      });
    });
  }

  /**
   * 获取搜索统计
   */
  getSearchStats() {
    return {
      totalSearches: this.searchHistory.length,
      totalWebsites: this.searchIndex.size,
      categories: this.getCategoryStats(),
      popularSearches: this.searchHistory.slice(0, 10)
    };
  }

  /**
   * 获取分类统计
   */
  getCategoryStats() {
    const categories = {};
    this.searchIndex.forEach(website => {
      const category = website.category || '其他';
      categories[category] = (categories[category] || 0) + 1;
    });
    return categories;
  }

  /**
   * 更新搜索索引
   */
  updateSearchIndex() {
    this.loadWebsiteData();
    this.buildSearchIndex();
  }
}

// 导出单例实例
export const searchManager = new SearchManager();

// 导出到全局作用域（向后兼容）
window.searchManager = searchManager;