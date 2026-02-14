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
    storageKeys: {
        guestFavorites: 'my_favorites_guest_v1',
        guestConfig: 'user_config_guest_v1',
        legacyGuestConfig: 'userConfig'
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

    getDefaultConfig() {
        return {
            darkMode: false,
            hiddenCards: [],
            cardOrder: [],
            notificationPanelOpen: false,
            reminders: [],
            favorites: []
        };
    },

    getLatestConfigRecord(records = []) {
        if (!Array.isArray(records) || records.length === 0) {
            return null;
        }

        const toTime = (value) => {
            const timestamp = new Date(value || 0).getTime();
            return Number.isFinite(timestamp) ? timestamp : 0;
        };

        const sorted = [...records].sort((left, right) => {
            const updatedDiff = toTime(right?.updated_at) - toTime(left?.updated_at);
            if (updatedDiff !== 0) {
                return updatedDiff;
            }

            const createdDiff = toTime(right?.created_at) - toTime(left?.created_at);
            if (createdDiff !== 0) {
                return createdDiff;
            }

            return String(right?.id || '').localeCompare(String(left?.id || ''));
        });

        return sorted[0] || null;
    },

    withTimeout(promise, timeout = 6000, message = '请求超时') {
        return Promise.race([
            promise,
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error(message)), timeout);
            })
        ]);
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
                                this.config = this.getDefaultConfig();
                                this.loadFromLocalStorage();
                                window.dispatchEvent(new CustomEvent('userDataLoaded', { detail: this.config }));
                            } else if (event === 'SIGNED_IN') {
                                this.isLoggedIn = true;
                                this.user = session.user;
                                console.log('[UserData] 用户已登录:', this.user.email);
                                await this.loadConfig(true).catch(error => {
                                    console.warn('[UserData] SIGNED_IN 后加载配置失败:', error?.message || error);
                                });
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
                    await this.loadConfig(true).catch(error => {
                        console.warn('[UserData] 初始化后加载配置失败:', error?.message || error);
                    });
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

        const client = this.getAuthClient();
        if (!client || !this.user?.id) {
            console.warn('[UserData] loadConfig 跳过：客户端或 user.id 不可用');
            this.loadFromLocalStorage();
            if (triggerEvent) {
                window.dispatchEvent(new CustomEvent('userDataLoaded', { detail: this.config }));
            }
            return;
        }
        
        try {
            console.log('[UserData] 开始查询数据库...');
            
            const { data, error, count, status, statusText } = await this.withTimeout(
                client
                    .from('user_config')
                    .select('*')
                    .eq('user_id', this.user.id),
                6000,
                '加载用户配置超时'
            );

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
                this.config = this.getDefaultConfig();
            } else if (data && data.length > 0) {
                const latestConfig = this.getLatestConfigRecord(data) || data[0];
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
                this.config = this.getDefaultConfig();
            }
            
            if (triggerEvent) {
                console.log('[UserData] 触发 userDataLoaded 事件');
                window.dispatchEvent(new CustomEvent('userDataLoaded', { detail: this.config }));
            }
        } catch (error) {
            console.error('[UserData] 加载配置异常:', error);
            this.loadFromLocalStorage();
            if (triggerEvent) {
                window.dispatchEvent(new CustomEvent('userDataLoaded', { detail: this.config }));
            }
        }
    },

    loadFromLocalStorage() {
        try {
            this.config = this.getDefaultConfig();

            const saved = localStorage.getItem(this.storageKeys.guestConfig);
            if (saved) {
                const parsed = JSON.parse(saved);
                this.config = {
                    ...this.getDefaultConfig(),
                    ...parsed,
                    favorites: []
                };
                console.log('[UserData] 已从 localStorage 加载配置:', this.config);
            } else {
                const legacySaved = localStorage.getItem(this.storageKeys.legacyGuestConfig);
                if (legacySaved) {
                    try {
                        const legacyParsed = JSON.parse(legacySaved);
                        this.config = {
                            ...this.getDefaultConfig(),
                            darkMode: !!legacyParsed?.darkMode,
                            hiddenCards: Array.isArray(legacyParsed?.hiddenCards) ? legacyParsed.hiddenCards : [],
                            cardOrder: Array.isArray(legacyParsed?.cardOrder) ? legacyParsed.cardOrder : [],
                            favorites: []
                        };
                        localStorage.setItem(this.storageKeys.guestConfig, JSON.stringify(this.config));
                        localStorage.removeItem(this.storageKeys.legacyGuestConfig);
                        console.log('[UserData] 已迁移旧版游客配置到独立存储键');
                    } catch (migrationError) {
                        console.error('[UserData] 迁移旧版游客配置失败:', migrationError);
                    }
                }
            }

            const localFavorites = JSON.parse(localStorage.getItem(this.storageKeys.guestFavorites) || '[]');
            if (Array.isArray(localFavorites) && localFavorites.length > 0) {
                this.config.favorites = localFavorites;
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
                const payload = {
                    user_id: this.user.id,
                    dark_mode: this.config.darkMode,
                    hidden_cards: this.config.hiddenCards,
                    card_order: this.config.cardOrder,
                    notification_panel_open: this.config.notificationPanelOpen,
                    reminders: this.config.reminders,
                    favorites: this.config.favorites,
                    updated_at: new Date().toISOString()
                };

                console.log('[UserData] 开始保存到数据库...');
                console.log('[UserData] user.id:', this.user.id);
                console.log('[UserData] 准备保存的数据:', {
                    ...payload
                });
                
                console.log('[UserData] 执行 upsert 操作...');
                let { data, error, status, statusText } = await supabaseClient
                    .from('user_config')
                    .upsert(payload, {
                        onConflict: 'user_id'
                    })
                    .select();

                if (error) {
                    console.warn('[UserData] upsert 失败，尝试 update + insert 兜底:', error?.message || error);

                    const updateResult = await supabaseClient
                        .from('user_config')
                        .update(payload)
                        .eq('user_id', this.user.id)
                        .select();

                    data = updateResult.data;
                    error = updateResult.error;
                    status = updateResult.status;
                    statusText = updateResult.statusText;

                    if (!error && Array.isArray(data) && data.length === 0) {
                        const insertResult = await supabaseClient
                            .from('user_config')
                            .insert(payload)
                            .select();

                        data = insertResult.data;
                        error = insertResult.error;
                        status = insertResult.status;
                        statusText = insertResult.statusText;
                    }
                }

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
                localStorage.setItem(this.storageKeys.guestConfig, JSON.stringify(this.config));
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
        return await this.saveConfig();
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
