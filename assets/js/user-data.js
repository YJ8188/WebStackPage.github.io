const userData = {
    isLoggedIn: false,
    user: null,
    initialized: false,
    initializing: false,
    initPromise: null,
    authListenerRegistered: false,
    isOnline: navigator.onLine,
    config: {
        darkMode: false,
        hiddenCards: [],
        cardOrder: [],
        notificationPanelOpen: false,
        reminders: [],
        favorites: []
    },

    getAuthClient() {
        if (window.supabaseClient && window.supabaseClient.auth) {
            return window.supabaseClient;
        }
        if (typeof supabaseClient !== 'undefined' && supabaseClient?.auth) {
            return supabaseClient;
        }
        return null;
    },

    isAbortLikeError(error) {
        const message = String(error?.message || error || '').toLowerCase();
        return message.includes('aborted') || message.includes('aborterror') || message.includes('signal is aborted');
    },

    async getSessionWithRetry(maxAttempts = 3) {
        const client = this.getAuthClient();
        if (!client) {
            return { session: null, error: new Error('supabaseClient not ready') };
        }

        let lastError = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const { data: { session }, error } = await client.auth.getSession();
                if (!error) {
                    return { session, error: null };
                }

                lastError = error;
                if (!this.isAbortLikeError(error) || attempt === maxAttempts) {
                    break;
                }
            } catch (error) {
                lastError = error;
                if (!this.isAbortLikeError(error) || attempt === maxAttempts) {
                    break;
                }
            }

            await new Promise(resolve => setTimeout(resolve, 200 * attempt));
        }

        return { session: null, error: lastError };
    },

    async init() {
        if (this.initialized) {
            console.log('[UserData] 已经初始化，跳过重复初始化');
            return;
        }

        if (this.initializing) {
            console.log('[UserData] 正在初始化中，等待当前初始化完成');
            if (this.initPromise) {
                await this.initPromise;
            }
            return;
        }

        this.initializing = true;

        this.initPromise = (async () => {
            try {
                window.addEventListener('online', () => {
                    this.isOnline = true;
                    console.log('[UserData] 网络已连接');
                    if (typeof showToast === 'function') {
                        showToast('网络已连接', 'success');
                    }

                    if (this.isLoggedIn) {
                        this.syncData();
                    }
                });

                window.addEventListener('offline', () => {
                    this.isOnline = false;
                    console.log('[UserData] 网络已断开');
                    if (typeof showToast === 'function') {
                        showToast('网络已断开，使用离线模式', 'warning');
                    }
                });

                if (!this.authListenerRegistered) {
                    const client = this.getAuthClient();
                    if (client) {
                        this.authListenerRegistered = true;
                        client.auth.onAuthStateChange(async (event, session) => {
                            if (event === 'SIGNED_OUT') {
                                this.isLoggedIn = false;
                                this.user = null;
                                console.log('[UserData] 用户已登出');
                                this.loadFromLocalStorage();
                                window.dispatchEvent(new CustomEvent('userDataLoaded', { detail: this.config }));
                            } else if (event === 'SIGNED_IN') {
                                this.isLoggedIn = true;
                                this.user = session.user;
                                console.log('[UserData] 用户已登录:', this.user.email);
                                await this.loadConfig();
                            } else if (event === 'TOKEN_REFRESHED') {
                                if (session?.user) {
                                    this.isLoggedIn = true;
                                    this.user = session.user;
                                }
                                console.log('[UserData] Token 已刷新');
                            }
                        });
                    }
                }

                const { session, error } = await this.getSessionWithRetry();
                if (error) {
                    console.warn('[UserData] 获取会话失败（已重试）:', error?.message || error);
                }

                if (session) {
                    this.isLoggedIn = true;
                    this.user = session.user;
                    console.log('[UserData] 用户已登录:', this.user.email);

                    await this.loadConfig();
                } else {
                    console.log('[UserData] 用户未登录，使用 localStorage');
                    this.loadFromLocalStorage();
                    window.dispatchEvent(new CustomEvent('userDataLoaded', { detail: this.config }));
                }

                this.initialized = true;
            } catch (error) {
                console.error('[UserData] 初始化失败:', error);
                this.isLoggedIn = false;
                this.user = null;
                this.loadFromLocalStorage();
                window.dispatchEvent(new CustomEvent('userDataLoaded', { detail: this.config }));
                this.initialized = false;
            } finally {
                this.initializing = false;
            }
        })();

        await this.initPromise;
    },

    async syncData() {
        console.log('[UserData] 开始同步数据');
        if (!this.isOnline) {
            console.log('[UserData] 离线模式，跳过同步');
            return;
        }
        
        try {
            await this.loadConfig();
            console.log('[UserData] 数据同步完成');
        } catch (error) {
            console.error('[UserData] 数据同步失败:', error);
        }
    },

    async loadConfig(triggerEvent = true) {
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
            
            if (triggerEvent) {
                console.log('[UserData] 触发 userDataLoaded 事件');
                window.dispatchEvent(new CustomEvent('userDataLoaded', { detail: this.config }));
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
                    }, {
                        onConflict: 'user_id'
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
        await this.saveConfig();
    },

    async loadReminders() {
        if (this.isLoggedIn) {
            return this.config.reminders || [];
        } else {
            this.loadFromLocalStorage();
            return this.config.reminders || [];
        }
    },

    async saveDarkMode(isDark) {
        this.config.darkMode = isDark;
        await this.saveConfig();
    },

    async saveHiddenCards(hiddenCards) {
        this.config.hiddenCards = hiddenCards;
        await this.saveConfig();
    },

    async loadHiddenCards() {
        if (this.isLoggedIn) {
            return this.config.hiddenCards || [];
        } else {
            this.loadFromLocalStorage();
            return this.config.hiddenCards || [];
        }
    },

    async saveCardOrder(cardOrder) {
        this.config.cardOrder = cardOrder;
        await this.saveConfig();
    },

    async loadCardOrder() {
        if (this.isLoggedIn) {
            return this.config.cardOrder || [];
        } else {
            this.loadFromLocalStorage();
            return this.config.cardOrder || [];
        }
    },

    async saveNotificationPanelOpen(isOpen) {
        this.config.notificationPanelOpen = isOpen;
        await this.saveConfig();
    },

    async loadNotificationPanelOpen() {
        if (this.isLoggedIn) {
            return this.config.notificationPanelOpen || false;
        } else {
            this.loadFromLocalStorage();
            return this.config.notificationPanelOpen || false;
        }
    },

    async saveFavorites(favorites) {
        this.config.favorites = favorites;
        await this.saveConfig();
    },

    async loadFavorites() {
        if (this.isLoggedIn) {
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
