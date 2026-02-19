(() => {
    if (typeof window === 'undefined' || window.__ERP_CONSOLE_FILTER_INSTALLED) {
        return;
    }

    const verboseEnabled = window.__ERP_VERBOSE_LOGS === true || window.localStorage?.getItem('erp_verbose_logs') === '1';

    if (!verboseEnabled) {
        const patchMethod = (method) => {
            const original = console[method] && console[method].bind(console);
            if (!original) {
                return;
            }
            console[method] = (...args) => {
                return;
            };
        };

        patchMethod('log');
        patchMethod('info');
        patchMethod('debug');
        patchMethod('warn');
        patchMethod('table');
        patchMethod('trace');

        window.__ERP_CONSOLE_MODE = 'error-only';
    }

    window.__ERP_CONSOLE_FILTER_INSTALLED = true;
})();

const supabaseUrl = 'https://yzyhtqiwcbpqsglfbvqa.supabase.co';
const supabaseKey = 'sb_publishable_hgJCIbPhEyiCOWHV1hJMeg_QArg-t_v';

if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('Supabase SDK 未加载，无法初始化客户端');
} else {
    const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storageKey: 'hg_webstack_auth'
        }
    });

    window.supabaseClient = supabaseClient;
}
