const userData = {
    isLoggedIn: false,
    user: null,
    initialized: false,
    config: {
        darkMode: false,
        hiddenCards: [],
        cardOrder: [],
        notificationPanelOpen: false,
        reminders: [],
        favorites: []
    },

    async init() {
        if (this.initialized) {
            console.log('[UserData] 已经初始化，跳过重复初始化');
            return;
        }
        
        this.initialized = true;
        
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (session) {
            this.isLoggedIn = true;
            this.user = session.user;
            console.log('[UserData] 用户已登录:', this.user.email);
            
            await this.loadConfig();
            
            supabaseClient.auth.onAuthStateChange(async (event, session) => {
                if (event === 'SIGNED_OUT') {
                    this.isLoggedIn = false;
                    this.user = null;
                    console.log('[UserData] 用户已登出');
                } else if (event === 'SIGNED_IN') {
                    this.isLoggedIn = true;
                    this.user = session.user;
                    console.log('[UserData] 用户已登录:', this.user.email);
                    await this.loadConfig();
                }
            });
        } else {
            console.log('[UserData] 用户未登录，使用 localStorage');
            this.loadFromLocalStorage();
        }
    },

    async loadConfig() {
        console.log('[UserData] loadConfig 被调用');
        console.log('[UserData] user.id:', this.user?.id);
        
        try {
            console.log('[UserData] 开始查询数据库...');
            
            const { data, error, count, status, statusText } = await supabaseClient
                .from('user_config')
                .select('*')
                .eq('user_id', this.user.id);

            console.log('[UserData] 查询结果:');
            console.log('[UserData] data:', data);
            console.log('[UserData] data.length:', data?.length);
            console.log('[UserData] error:', error);
            console.log('[UserData] status:', status);
            console.log('[UserData] statusText:', statusText);
            console.log('[UserData] count:', count);

            if (error) {
                console.error('[UserData] 错误详情:', {
                    message: error.message,
                    code: error.code,
                    details: error.details,
                    hint: error.hint,
                    status: status,
                    statusText: statusText
                });
                
                console.log('[UserData] 使用默认配置');
                this.config = {
                    darkMode: false,
                    hiddenCards: [],
                    cardOrder: [],
                    notificationPanelOpen: false,
                    reminders: [],
                    favorites: []
                };
            } else if (data && data.length > 0) {
                const latestConfig = data[0];
                this.config = {
                    darkMode: latestConfig.dark_mode || false,
                    hiddenCards: latestConfig.hidden_cards || [],
                    cardOrder: latestConfig.card_order || [],
                    notificationPanelOpen: latestConfig.notification_panel_open || false,
                    reminders: latestConfig.reminders || [],
                    favorites: latestConfig.favorites || []
                };
                console.log('[UserData] 已从数据库加载配置:', this.config);
            } else {
                console.log('[UserData] 用户配置不存在，使用默认配置');
                this.config = {
                    darkMode: false,
                    hiddenCards: [],
                    cardOrder: [],
                    notificationPanelOpen: false,
                    reminders: [],
                    favorites: []
                };
            }
        } catch (error) {
            console.error('[UserData] 加载配置异常:', error);
        }
    },

    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('userConfig');
            if (saved) {
                this.config = JSON.parse(saved);
                console.log('[UserData] 已从 localStorage 加载配置:', this.config);
            }
        } catch (error) {
            console.error('[UserData] 从 localStorage 加载配置失败:', error);
        }
    },

    async saveConfig() {
        console.log('[UserData] saveConfig 被调用');
        console.log('[UserData] isLoggedIn:', this.isLoggedIn);
        console.log('[UserData] user:', this.user);
        console.log('[UserData] config:', this.config);
        
        if (this.isLoggedIn) {
            try {
                console.log('[UserData] 开始保存到数据库...');
                console.log('[UserData] user.id:', this.user.id);
                console.log('[UserData] 准备保存的数据:', {
                    user_id: this.user.id,
                    dark_mode: this.config.darkMode,
                    hidden_cards: this.config.hiddenCards,
                    card_order: this.config.cardOrder,
                    notification_panel_open: this.config.notificationPanelOpen,
                    reminders: this.config.reminders,
                    favorites: this.config.favorites,
                    updated_at: new Date()
                });
                
                console.log('[UserData] 执行 upsert 操作...');
                const { data, error, status, statusText } = await supabaseClient
                    .from('user_config')
                    .upsert({
                        user_id: this.user.id,
                        dark_mode: this.config.darkMode,
                        hidden_cards: this.config.hiddenCards,
                        card_order: this.config.cardOrder,
                        notification_panel_open: this.config.notificationPanelOpen,
                        reminders: this.config.reminders,
                        favorites: this.config.favorites,
                        updated_at: new Date()
                    })
                    .select();

                console.log('[UserData] upsert 操作完成');
                console.log('[UserData] Supabase 返回 data:', data);
                console.log('[UserData] Supabase 返回 error:', error);
                console.log('[UserData] Supabase 返回 status:', status);
                console.log('[UserData] Supabase 返回 statusText:', statusText);

                if (error) {
                    console.error('[UserData] 保存配置失败:', error);
                    console.error('[UserData] 错误详情:', {
                        message: error.message,
                        code: error.code,
                        details: error.details,
                        hint: error.hint
                    });
                    return false;
                }

                console.log('[UserData] ✅ 配置已保存到数据库');
                return true;
            } catch (error) {
                console.error('[UserData] 保存配置异常:', error);
                console.error('[UserData] 异常详情:', {
                    message: error.message,
                    stack: error.stack
                });
                return false;
            }
        } else {
            console.log('[UserData] ⚠️ 未登录，保存到 localStorage');
            try {
                localStorage.setItem('userConfig', JSON.stringify(this.config));
                console.log('[UserData] 配置已保存到 localStorage');
                return true;
            } catch (error) {
                console.error('[UserData] 保存到 localStorage 失败:', error);
                return false;
            }
        }
    },

    async saveReminders(reminders) {
        this.config.reminders = reminders;
        return await this.saveConfig();
    },

    async loadReminders() {
        if (this.isLoggedIn) {
            await this.loadConfig();
            return this.config.reminders || [];
        } else {
            this.loadFromLocalStorage();
            return this.config.reminders || [];
        }
    },

    async saveDarkMode(isDark) {
        this.config.darkMode = isDark;
        return await this.saveConfig();
    },

    async saveHiddenCards(hiddenCards) {
        this.config.hiddenCards = hiddenCards;
        return await this.saveConfig();
    },

    async loadHiddenCards() {
        if (this.isLoggedIn) {
            await this.loadConfig();
            return this.config.hiddenCards || [];
        } else {
            this.loadFromLocalStorage();
            return this.config.hiddenCards || [];
        }
    },

    async saveCardOrder(cardOrder) {
        this.config.cardOrder = cardOrder;
        return await this.saveConfig();
    },

    async loadCardOrder() {
        if (this.isLoggedIn) {
            await this.loadConfig();
            return this.config.cardOrder || [];
        } else {
            this.loadFromLocalStorage();
            return this.config.cardOrder || [];
        }
    },

    async saveNotificationPanelOpen(isOpen) {
        this.config.notificationPanelOpen = isOpen;
        return await this.saveConfig();
    },

    async loadNotificationPanelOpen() {
        if (this.isLoggedIn) {
            await this.loadConfig();
            return this.config.notificationPanelOpen || false;
        } else {
            this.loadFromLocalStorage();
            return this.config.notificationPanelOpen || false;
        }
    },

    async saveFavorites(favorites) {
        this.config.favorites = favorites;
        return await this.saveConfig();
    },

    async loadFavorites() {
        if (this.isLoggedIn) {
            await this.loadConfig();
            return this.config.favorites || [];
        } else {
            this.loadFromLocalStorage();
            return this.config.favorites || [];
        }
    }
};

document.addEventListener('DOMContentLoaded', function() {
    userData.init();
});
