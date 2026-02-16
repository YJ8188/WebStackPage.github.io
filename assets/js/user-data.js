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
        legacyGuestConfig: 'userConfig',
        userConfigCachePrefix: 'user_config_cache_',
        userConfigSnapshotPrefix: 'user_config_snapshot_',
        rememberMePreference: 'rememberMePreference',
        rememberMeExpiresAt: 'rememberMeExpiresAt'
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

    clearRememberMeState() {
        localStorage.removeItem(this.storageKeys.rememberMePreference);
        localStorage.removeItem(this.storageKeys.rememberMeExpiresAt);
    },

    getRememberMeMeta() {
        const enabled = localStorage.getItem(this.storageKeys.rememberMePreference) === 'true';
        const rawExpiresAt = localStorage.getItem(this.storageKeys.rememberMeExpiresAt);
        const expiresAt = Number(rawExpiresAt);
        const hasValidExpiry = Number.isFinite(expiresAt) && expiresAt > 0;

        if (enabled && !hasValidExpiry) {
            return {
                enabled: true,
                expiresAt: null,
                expired: true
            };
        }

        return {
            enabled,
            expiresAt: hasValidExpiry ? expiresAt : null,
            expired: enabled && hasValidExpiry ? Date.now() >= expiresAt : false
        };
    },

    async enforceRememberMeExpiry(client = this.getAuthClient(), session = null) {
        if (!client || !session) {
            return false;
        }

        const rememberMeta = this.getRememberMeMeta();
        if (!rememberMeta.enabled || !rememberMeta.expired) {
            return false;
        }

        try {
            await Promise.race([
                client.auth.signOut({ scope: 'local' }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('remember-me-expired-timeout')), 5000))
            ]);
        } catch (error) {
            console.error('[UserData] 30天自动登录过期后登出失败:', error);
        }

        this.clearRememberMeState();
        this.isLoggedIn = false;
        this.user = null;
        this.config = this.getDefaultConfig();
        this.loadFromLocalStorage();
        window.dispatchEvent(new CustomEvent('userDataLoaded', { detail: this.config }));
        return true;
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

    normalizeConfig(rawConfig = {}) {
        return {
            darkMode: !!rawConfig?.darkMode,
            hiddenCards: Array.isArray(rawConfig?.hiddenCards) ? rawConfig.hiddenCards : [],
            cardOrder: Array.isArray(rawConfig?.cardOrder) ? rawConfig.cardOrder : [],
            notificationPanelOpen: !!rawConfig?.notificationPanelOpen,
            reminders: Array.isArray(rawConfig?.reminders) ? rawConfig.reminders : [],
            favorites: Array.isArray(rawConfig?.favorites) ? rawConfig.favorites : []
        };
    },

    getUserConfigCacheKey(userId = this.user?.id) {
        if (!userId) {
            return null;
        }
        return `${this.storageKeys.userConfigCachePrefix}${userId}`;
    },

    getUserConfigSnapshotPrefix(userId = this.user?.id) {
        if (!userId) {
            return null;
        }
        return `${this.storageKeys.userConfigSnapshotPrefix}${userId}_`;
    },

    getConfigSnapshots(userId = this.user?.id) {
        try {
            const prefix = this.getUserConfigSnapshotPrefix(userId);
            if (!prefix) {
                return [];
            }

            const keys = Object.keys(localStorage)
                .filter(key => key.startsWith(prefix))
                .sort((left, right) => right.localeCompare(left));

            const snapshots = [];
            keys.forEach((key) => {
                try {
                    const raw = JSON.parse(localStorage.getItem(key) || '{}');
                    const normalized = this.normalizeConfig(raw);
                    const snapAt = Number(raw?._snapshotAt || key.slice(prefix.length));
                    snapshots.push({
                        ...normalized,
                        _snapshotAt: Number.isFinite(snapAt) ? snapAt : 0,
                        _key: key
                    });
                } catch (error) {
                    console.error('[UserData] 读取配置快照失败:', error);
                }
            });

            return snapshots.sort((left, right) => (right._snapshotAt || 0) - (left._snapshotAt || 0));
        } catch (error) {
            console.error('[UserData] 获取配置快照列表失败:', error);
            return [];
        }
    },

    saveConfigSnapshot(config = this.config, userId = this.user?.id) {
        try {
            const prefix = this.getUserConfigSnapshotPrefix(userId);
            if (!prefix) {
                return;
            }

            const normalized = this.normalizeConfig(config);
            const timestamp = Date.now();
            const snapshotKey = `${prefix}${timestamp}`;
            localStorage.setItem(snapshotKey, JSON.stringify({
                ...normalized,
                _snapshotAt: timestamp
            }));

            const keys = Object.keys(localStorage)
                .filter(key => key.startsWith(prefix))
                .sort((left, right) => right.localeCompare(left));

            const maxSnapshots = 20;
            if (keys.length > maxSnapshots) {
                keys.slice(maxSnapshots).forEach(key => localStorage.removeItem(key));
            }
        } catch (error) {
            console.error('[UserData] 保存配置快照失败:', error);
        }
    },

    recoverArrayFromSnapshots(fieldName, userId = this.user?.id) {
        if (!fieldName) {
            return [];
        }

        const snapshots = this.getConfigSnapshots(userId);
        const found = snapshots.find(item => Array.isArray(item?.[fieldName]) && item[fieldName].length > 0);
        if (!found) {
            return [];
        }

        return [...found[fieldName]];
    },

    loadCachedAccountConfig(userId = this.user?.id) {
        try {
            const cacheKey = this.getUserConfigCacheKey(userId);
            if (!cacheKey) {
                return null;
            }

            const saved = localStorage.getItem(cacheKey);
            if (!saved) {
                return null;
            }

            const parsed = JSON.parse(saved);
            return this.normalizeConfig(parsed);
        } catch (error) {
            console.error('[UserData] 读取账号配置缓存失败:', error);
            return null;
        }
    },

    saveCachedAccountConfig(config = this.config, userId = this.user?.id) {
        try {
            const cacheKey = this.getUserConfigCacheKey(userId);
            if (!cacheKey) {
                return;
            }

            const normalized = this.normalizeConfig(config);
            localStorage.setItem(cacheKey, JSON.stringify({
                ...normalized,
                _cachedAt: Date.now()
            }));
        } catch (error) {
            console.error('[UserData] 保存账号配置缓存失败:', error);
        }
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

    getSortedConfigRecords(records = []) {
        if (!Array.isArray(records) || records.length === 0) {
            return [];
        }

        const toTime = (value) => {
            const timestamp = new Date(value || 0).getTime();
            return Number.isFinite(timestamp) ? timestamp : 0;
        };

        return [...records].sort((left, right) => {
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
    },

    parseConfigRecord(record = {}) {
        return this.normalizeConfig({
            darkMode: record.dark_mode || false,
            hiddenCards: record.hidden_cards || [],
            cardOrder: record.card_order || [],
            notificationPanelOpen: record.notification_panel_open || false,
            reminders: record.reminders || [],
            favorites: record.favorites || []
        });
    },

    mergeConfigFromHistory(records = []) {
        const sorted = this.getSortedConfigRecords(records);
        if (sorted.length === 0) {
            return this.getDefaultConfig();
        }

        const latest = this.parseConfigRecord(sorted[0]);
        const merged = { ...latest };

        const arrayFieldMap = [
            ['hiddenCards', 'hidden_cards'],
            ['cardOrder', 'card_order'],
            ['reminders', 'reminders'],
            ['favorites', 'favorites']
        ];

        arrayFieldMap.forEach(([targetField, sourceField]) => {
            if (Array.isArray(merged[targetField]) && merged[targetField].length > 0) {
                return;
            }

            const fallbackRecord = sorted.find(item => Array.isArray(item?.[sourceField]) && item[sourceField].length > 0);
            if (!fallbackRecord) {
                return;
            }

            merged[targetField] = [...fallbackRecord[sourceField]];
        });

        return this.normalizeConfig(merged);
    },

    withTimeout(promise, timeout = 12000, message = '请求超时') {
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

                const authClient = this.getAuthClient();

                if (!this.authListenerRegistered) {
                    const client = authClient;
                    if (client) {
                        this.authListenerRegistered = true;
                        client.auth.onAuthStateChange(async (event, session) => {
                            if (event === 'SIGNED_OUT') {
                                this.clearRememberMeState();
                                this.isLoggedIn = false;
                                this.user = null;
                                console.log('[UserData] 用户已登出');
                                this.config = this.getDefaultConfig();
                                this.loadFromLocalStorage();
                                window.dispatchEvent(new CustomEvent('userDataLoaded', { detail: this.config }));
                            } else if (event === 'SIGNED_IN') {
                                const rememberExpired = await this.enforceRememberMeExpiry(client, session);
                                if (rememberExpired) {
                                    return;
                                }

                                this.isLoggedIn = true;
                                this.user = session.user;
                                console.log('[UserData] 用户已登录:', this.user.email);
                                const cachedConfig = this.loadCachedAccountConfig(this.user?.id);
                                if (cachedConfig) {
                                    this.config = cachedConfig;
                                }
                                window.dispatchEvent(new CustomEvent('userDataLoaded', { detail: this.config }));

                                this.loadConfig(true).catch(error => {
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
                    const rememberExpired = await this.enforceRememberMeExpiry(authClient, session);
                    if (rememberExpired) {
                        this.initialized = true;
                        return;
                    }

                    this.isLoggedIn = true;
                    this.user = session.user;
                    console.log('[UserData] 用户已登录:', this.user.email);
                    const cachedConfig = this.loadCachedAccountConfig(this.user?.id);
                    if (cachedConfig) {
                        this.config = cachedConfig;
                    }
                    window.dispatchEvent(new CustomEvent('userDataLoaded', { detail: this.config }));

                    this.loadConfig(true).catch(error => {
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

        const cachedAccountConfig = this.loadCachedAccountConfig();

        const client = this.getAuthClient();
        if (!client || !this.user?.id) {
            console.warn('[UserData] loadConfig 跳过：客户端或 user.id 不可用');
            if (cachedAccountConfig) {
                this.config = cachedAccountConfig;
            } else {
                this.loadFromLocalStorage();
            }
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
                12000,
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

                if (cachedAccountConfig) {
                    console.warn('[UserData] 数据库返回错误，已回退到账号本地缓存配置');
                    this.config = cachedAccountConfig;
                } else {
                    console.log('[UserData] 使用默认配置');
                    this.config = this.getDefaultConfig();
                }
            } else if (data && data.length > 0) {
                this.config = this.mergeConfigFromHistory(data);

                if ((!Array.isArray(this.config.reminders) || this.config.reminders.length === 0)) {
                    const recoveredReminders = this.recoverArrayFromSnapshots('reminders');
                    if (recoveredReminders.length > 0) {
                        this.config.reminders = recoveredReminders;
                    }
                }

                if ((!Array.isArray(this.config.favorites) || this.config.favorites.length === 0)) {
                    const recoveredFavorites = this.recoverArrayFromSnapshots('favorites');
                    if (recoveredFavorites.length > 0) {
                        this.config.favorites = recoveredFavorites;
                    }
                }

                this.config = this.normalizeConfig(this.config);
                this.saveCachedAccountConfig(this.config);
                this.saveConfigSnapshot(this.config);
                console.log('[UserData] 已从数据库加载配置:', this.config);
            } else {
                if (cachedAccountConfig) {
                    console.warn('[UserData] 数据库暂无配置，已使用账号本地缓存配置');
                    this.config = cachedAccountConfig;
                } else {
                    console.log('[UserData] 用户配置不存在，使用默认配置');
                    this.config = this.getDefaultConfig();
                }
            }
            
            if (triggerEvent) {
                console.log('[UserData] 触发 userDataLoaded 事件');
                window.dispatchEvent(new CustomEvent('userDataLoaded', { detail: this.config }));
            }
        } catch (error) {
            console.error('[UserData] 加载配置异常:', error);
            if (cachedAccountConfig) {
                console.warn('[UserData] 数据库加载异常，已回退到账号本地缓存配置');
                this.config = cachedAccountConfig;
            } else {
                this.loadFromLocalStorage();
            }
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
                this.config = this.normalizeConfig(this.config);
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
                        this.config = this.normalizeConfig(this.config);
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

    async saveConfigFields(fields = {}) {
        this.config = this.normalizeConfig(this.config);

        if (this.isLoggedIn) {
            const client = this.getAuthClient();
            if (!client || !this.user?.id) {
                console.error('[UserData] saveConfigFields 失败：登录态缺少客户端或 user.id');
                return false;
            }

            try {
                this.saveCachedAccountConfig(this.config);
                this.saveConfigSnapshot(this.config);

                const payload = {
                    ...fields,
                    updated_at: new Date().toISOString()
                };

                let { data, error } = await client
                    .from('user_config')
                    .update(payload)
                    .eq('user_id', this.user.id)
                    .select();

                if (error) {
                    console.error('[UserData] update 配置失败:', error);
                    return false;
                }

                if (Array.isArray(data) && data.length === 0) {
                    const insertPayload = {
                        user_id: this.user.id,
                        dark_mode: this.config.darkMode,
                        hidden_cards: this.config.hiddenCards,
                        card_order: this.config.cardOrder,
                        notification_panel_open: this.config.notificationPanelOpen,
                        reminders: this.config.reminders,
                        favorites: this.config.favorites,
                        ...payload
                    };

                    const insertResult = await client
                        .from('user_config')
                        .insert(insertPayload)
                        .select();

                    if (insertResult.error) {
                        console.error('[UserData] insert 配置失败:', insertResult.error);
                        return false;
                    }
                }

                this.saveCachedAccountConfig(this.config);
                this.saveConfigSnapshot(this.config);
                return true;
            } catch (error) {
                console.error('[UserData] saveConfigFields 异常:', error);
                return false;
            }
        }

        try {
            localStorage.setItem(this.storageKeys.guestConfig, JSON.stringify(this.config));
            return true;
        } catch (error) {
            console.error('[UserData] 保存游客配置失败:', error);
            return false;
        }
    },

    async saveConfig() {
        console.log('[UserData] saveConfig 被调用');
        console.log('[UserData] isLoggedIn:', this.isLoggedIn);
        console.log('[UserData] user:', this.user);
        console.log('[UserData] config:', this.config);

        return await this.saveConfigFields({
            dark_mode: this.config.darkMode,
            hidden_cards: this.config.hiddenCards,
            card_order: this.config.cardOrder,
            notification_panel_open: this.config.notificationPanelOpen,
            reminders: this.config.reminders,
            favorites: this.config.favorites
        });
    },

    async saveReminders(reminders) {
        this.config.reminders = reminders;
        return await this.saveConfigFields({ reminders: reminders });
    },

    async loadReminders() {
        if (this.isLoggedIn) {
            if (Array.isArray(this.config.reminders) && this.config.reminders.length > 0) {
                return this.config.reminders;
            }

            const client = this.getAuthClient();
            if (client && this.user?.id) {
                try {
                    const { data, error } = await this.withTimeout(
                        client
                            .from('user_config')
                            .select('id, reminders, updated_at, created_at')
                            .eq('user_id', this.user.id)
                            .order('updated_at', { ascending: false })
                            .limit(20),
                        15000,
                        '加载提醒超时'
                    );

                    if (!error && Array.isArray(data) && data.length > 0) {
                        const sortedRows = this.getSortedConfigRecords(data);
                        const reminderRow = sortedRows.find(item => Array.isArray(item?.reminders) && item.reminders.length > 0)
                            || sortedRows.find(item => Array.isArray(item?.reminders))
                            || null;

                        if (reminderRow && Array.isArray(reminderRow.reminders)) {
                            this.config.reminders = reminderRow.reminders;
                            this.saveCachedAccountConfig(this.config);
                            this.saveConfigSnapshot(this.config);
                            return this.config.reminders;
                        }
                    }
                } catch (error) {
                    console.error('[UserData] 远程加载提醒失败:', error);
                }
            }

            try {
                const snapshotReminders = this.recoverArrayFromSnapshots('reminders');
                if (snapshotReminders.length > 0) {
                    this.config.reminders = snapshotReminders;
                    this.saveCachedAccountConfig(this.config);
                    return this.config.reminders;
                }

                const localKey = `reminders_user_${this.user.id}`;
                const localReminders = JSON.parse(localStorage.getItem(localKey) || '[]');
                if (Array.isArray(localReminders) && localReminders.length > 0) {
                    this.config.reminders = localReminders;
                    this.saveCachedAccountConfig(this.config);
                    this.saveConfigSnapshot(this.config);
                    return this.config.reminders;
                }
            } catch (error) {
                console.error('[UserData] 读取本地提醒缓存失败:', error);
            }

            return this.config.reminders || [];
        } else {
            this.loadFromLocalStorage();
            return this.config.reminders || [];
        }
    },

    async saveDarkMode(isDark) {
        this.config.darkMode = isDark;
        return await this.saveConfigFields({ dark_mode: this.config.darkMode });
    },

    async loadDarkMode() {
        if (this.isLoggedIn) {
            const client = this.getAuthClient();
            if (client && this.user?.id) {
                try {
                    const { data, error } = await this.withTimeout(
                        client
                            .from('user_config')
                            .select('dark_mode, updated_at')
                            .eq('user_id', this.user.id)
                            .order('updated_at', { ascending: false })
                            .limit(1),
                        15000,
                        '加载主题配置超时'
                    );

                    if (!error && Array.isArray(data) && data.length > 0) {
                        const darkMode = !!data[0].dark_mode;
                        this.config.darkMode = darkMode;
                        this.saveCachedAccountConfig(this.config);
                        return darkMode;
                    }
                } catch (error) {
                    console.error('[UserData] 远程加载主题配置失败:', error);
                }
            }

            return !!this.config.darkMode;
        }

        this.loadFromLocalStorage();
        return !!this.config.darkMode;
    },

    async saveHiddenCards(hiddenCards) {
        this.config.hiddenCards = hiddenCards;
        return await this.saveConfigFields({ hidden_cards: this.config.hiddenCards });
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
        return await this.saveConfigFields({ card_order: this.config.cardOrder });
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
        return await this.saveConfigFields({ notification_panel_open: this.config.notificationPanelOpen });
    },

    async loadNotificationPanelOpen() {
        if (this.isLoggedIn) {
            if (this.config.notificationPanelOpen === true) {
                return true;
            }

            const client = this.getAuthClient();
            if (client && this.user?.id) {
                try {
                    const { data, error } = await this.withTimeout(
                        client
                            .from('user_config')
                            .select('notification_panel_open, updated_at')
                            .eq('user_id', this.user.id)
                            .order('updated_at', { ascending: false })
                            .limit(1),
                        15000,
                        '加载通知面板状态超时'
                    );

                    if (!error && Array.isArray(data) && data.length > 0) {
                        const isOpen = !!data[0].notification_panel_open;
                        this.config.notificationPanelOpen = isOpen;
                        this.saveCachedAccountConfig(this.config);
                        return isOpen;
                    }
                } catch (error) {
                    console.error('[UserData] 远程加载通知面板状态失败:', error);
                }
            }

            return this.config.notificationPanelOpen || false;
        } else {
            this.loadFromLocalStorage();
            return this.config.notificationPanelOpen || false;
        }
    },

    async saveFavorites(favorites) {
        this.config.favorites = favorites;
        return await this.saveConfigFields({ favorites: this.config.favorites });
    },

    async loadFavorites() {
        if (this.isLoggedIn) {
            if (Array.isArray(this.config.favorites) && this.config.favorites.length > 0) {
                return this.config.favorites;
            }

            const client = this.getAuthClient();
            if (client && this.user?.id) {
                try {
                    const { data, error } = await this.withTimeout(
                        client
                            .from('user_config')
                            .select('id, favorites, updated_at, created_at')
                            .eq('user_id', this.user.id)
                            .order('updated_at', { ascending: false })
                            .limit(20),
                        15000,
                        '加载收藏超时'
                    );

                    if (!error && Array.isArray(data) && data.length > 0) {
                        const sortedRows = this.getSortedConfigRecords(data);
                        const favoriteRow = sortedRows.find(item => Array.isArray(item?.favorites) && item.favorites.length > 0)
                            || sortedRows.find(item => Array.isArray(item?.favorites))
                            || null;

                        if (favoriteRow && Array.isArray(favoriteRow.favorites)) {
                            this.config.favorites = favoriteRow.favorites;
                            this.saveCachedAccountConfig(this.config);
                            this.saveConfigSnapshot(this.config);
                            return this.config.favorites;
                        }
                    }
                } catch (error) {
                    console.error('[UserData] 远程加载收藏失败:', error);
                }
            }

            const snapshotFavorites = this.recoverArrayFromSnapshots('favorites');
            if (snapshotFavorites.length > 0) {
                this.config.favorites = snapshotFavorites;
                this.saveCachedAccountConfig(this.config);
                return this.config.favorites;
            }

            const cachedConfig = this.loadCachedAccountConfig();
            if (cachedConfig && Array.isArray(cachedConfig.favorites) && cachedConfig.favorites.length > 0) {
                this.config.favorites = cachedConfig.favorites;
                return this.config.favorites;
            }

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
