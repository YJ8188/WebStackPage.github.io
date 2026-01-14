const userData = {
    isLoggedIn: false,
    user: null,

    async init() {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            this.isLoggedIn = true;
            this.user = session.user;
            console.log('[UserData] 用户已登录:', this.user.email);
            
            supabase.auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_OUT') {
                    this.isLoggedIn = false;
                    this.user = null;
                    console.log('[UserData] 用户已登出');
                } else if (event === 'SIGNED_IN') {
                    this.isLoggedIn = true;
                    this.user = session.user;
                    console.log('[UserData] 用户已登录:', this.user.email);
                }
            });
        } else {
            console.log('[UserData] 用户未登录，使用 localStorage');
        }
    },

    async saveReminders(reminders) {
        if (!this.isLoggedIn) {
            console.log('[UserData] 用户未登录，保存到 localStorage');
            return false;
        }

        try {
            const { data, error } = await supabase
                .from('user_config')
                .upsert({
                    user_id: this.user.id,
                    reminders: reminders,
                    updated_at: new Date()
                })
                .select();

            if (error) {
                console.error('[UserData] 保存提醒失败:', error);
                return false;
            }

            console.log('[UserData] 提醒已保存到数据库');
            return true;
        } catch (error) {
            console.error('[UserData] 保存提醒异常:', error);
            return false;
        }
    },

    async loadReminders() {
        if (!this.isLoggedIn) {
            console.log('[UserData] 用户未登录，从 localStorage 加载');
            return null;
        }

        try {
            const { data, error } = await supabase
                .from('user_config')
                .select('reminders')
                .eq('user_id', this.user.id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    console.log('[UserData] 用户配置不存在，返回空数组');
                    return [];
                }
                console.error('[UserData] 加载提醒失败:', error);
                return null;
            }

            console.log('[UserData] 已从数据库加载提醒:', data.reminders);
            return data.reminders || [];
        } catch (error) {
            console.error('[UserData] 加载提醒异常:', error);
            return null;
        }
    },

    async saveHiddenCards(hiddenCards) {
        if (!this.isLoggedIn) {
            console.log('[UserData] 用户未登录，保存到 localStorage');
            return false;
        }

        try {
            const { data, error } = await supabase
                .from('user_config')
                .upsert({
                    user_id: this.user.id,
                    hidden_cards: hiddenCards,
                    updated_at: new Date()
                })
                .select();

            if (error) {
                console.error('[UserData] 保存隐藏卡片失败:', error);
                return false;
            }

            console.log('[UserData] 隐藏卡片已保存到数据库');
            return true;
        } catch (error) {
            console.error('[UserData] 保存隐藏卡片异常:', error);
            return false;
        }
    },

    async loadHiddenCards() {
        if (!this.isLoggedIn) {
            console.log('[UserData] 用户未登录，从 localStorage 加载');
            return null;
        }

        try {
            const { data, error } = await supabase
                .from('user_config')
                .select('hidden_cards')
                .eq('user_id', this.user.id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    console.log('[UserData] 用户配置不存在，返回空数组');
                    return [];
                }
                console.error('[UserData] 加载隐藏卡片失败:', error);
                return null;
            }

            console.log('[UserData] 已从数据库加载隐藏卡片:', data.hidden_cards);
            return data.hidden_cards || [];
        } catch (error) {
            console.error('[UserData] 加载隐藏卡片异常:', error);
            return null;
        }
    }
};

document.addEventListener('DOMContentLoaded', function() {
    userData.init();
});
