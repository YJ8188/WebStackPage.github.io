/**
 * 美观的搜索区域组件
 */

// 创建搜索区域的HTML
const createSearchSection = () => {
    return `
        <section class="search-section">
            <div class="search-container">
                <h2 class="search-title">
                    <i class="fas fa-search"></i>
                    发现优秀网站
                </h2>
                <p class="search-subtitle">搜索你感兴趣的设计资源和开发工具</p>
                
                <div class="search-box">
                    <div class="search-input-wrapper">
                        <i class="fas fa-search search-icon"></i>
                        <input 
                            type="search" 
                            class="search-input modern-search" 
                            placeholder="搜索网站、资源或工具..."
                            autocomplete="off"
                        >
                        <button class="search-clear-btn" id="searchClearBtn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="search-suggestions" id="searchSuggestions">
                        <!-- 搜索建议将动态插入这里 -->
                    </div>
                </div>
                
                <div class="quick-search-tags">
                    <span class="tag-label">热门搜索：</span>
                    <div class="tags">
                        <span class="search-tag" data-query="UI设计">UI设计</span>
                        <span class="search-tag" data-query="图标素材">图标素材</span>
                        <span class="search-tag" data-query="开发工具">开发工具</span>
                        <span class="search-tag" data-query="React组件">React组件</span>
                        <span class="search-tag" data-query="设计灵感">设计灵感</span>
                    </div>
                </div>
            </div>
        </section>
    `;
};

// 初始化搜索区域
const initSearchSection = () => {
    // 查找插入位置（在侧边栏之后）
    const sidebar = document.querySelector('.sidebar-menu');
    const mainContent = document.querySelector('.main-content');
    
    if (mainContent && !document.querySelector('.search-section')) {
        // 在主内容区域顶部插入搜索区域
        mainContent.insertAdjacentHTML('afterbegin', createSearchSection());
        
        // 绑定事件
        bindSearchEvents();
        
        // 添加动画效果
        setTimeout(() => {
            const searchSection = document.querySelector('.search-section');
            if (searchSection) {
                searchSection.classList.add('animate-slide-up');
            }
        }, 100);
    }
};

// 绑定搜索事件
const bindSearchEvents = () => {
    const searchInput = document.querySelector('.modern-search');
    const clearBtn = document.getElementById('searchClearBtn');
    const searchTags = document.querySelectorAll('.search-tag');
    
    if (searchInput) {
        // 搜索输入事件
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            
            // 显示/隐藏清除按钮
            if (clearBtn) {
                clearBtn.style.display = query ? 'flex' : 'none';
            }
            
            // 处理搜索（使用现有的搜索管理器）
            if (window.modernNav && window.modernNav.searchManager) {
                window.modernNav.searchManager.handleSearchInput(e.target);
            }
        });
        
        // 搜索键盘事件
        searchInput.addEventListener('keydown', (e) => {
            if (window.modernNav && window.modernNav.searchManager) {
                window.modernNav.searchManager.handleSearchKeyNavigation(e);
            }
        });
    }
    
    // 清除按钮事件
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                searchInput.focus();
                
                // 隐藏建议
                const suggestions = document.getElementById('searchSuggestions');
                if (suggestions) {
                    suggestions.style.display = 'none';
                }
            }
        });
    }
    
    // 标签点击事件
    searchTags.forEach(tag => {
        tag.addEventListener('click', () => {
            const query = tag.dataset.query;
            if (searchInput) {
                searchInput.value = query;
                searchInput.focus();
                
                // 触发搜索
                const event = new Event('input', { bubbles: true });
                searchInput.dispatchEvent(event);
            }
        });
    });
};

// 导出函数
window.initModernSearch = initSearchSection;