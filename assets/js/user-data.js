const userData = {
    isLoggedIn: false,
    user: null,
    config: {
        darkMode: false,
        hiddenCards: [],
        cardOrder: [],
        notificationPanelOpen: false,
        reminders: [],
        favorites: []
    },

    async init() {
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
        try {
            const { data, error } = await supabaseClient
                .from('user_config')
                .select('*')
                .eq('user_id', this.user.id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    console.log('[UserData] 用户配置不存在，使用默认配置');
                    this.config = {
                        darkMode: false,
                        hiddenCards: [],
                        cardOrder: [],
                        notificationPanelOpen: false,
                        reminders: [],
                        favorites: []
                    };
                } else {
                    console.error('[UserData] 加载配置失败:', error);
                }
            } else {
                this.config = {
                    darkMode: data.dark_mode || false,
                    hiddenCards: data.hidden_cards || [],
                    cardOrder: data.card_order || [],
                    notificationPanelOpen: data.notification_panel_open || false,
                    reminders: data.reminders || [],
                    favorites: data.favorites || []
                };
                console.log('[UserData] 已从数据库加载配置:', this.config);
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
        if (this.isLoggedIn) {
            try {
                const { data, error } = await supabaseClient
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

                if (error) {
                    console.error('[UserData] 保存配置失败:', error);
                    return false;
                }

                console.log('[UserData] 配置已保存到数据库');
                return true;
            } catch (error) {
                console.error('[UserData] 保存配置异常:', error);
                return false;
            }
        } else {
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
