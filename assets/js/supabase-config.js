(() => {
    if (typeof window === 'undefined' || window.__ERP_CONSOLE_FILTER_INSTALLED) {
        return;
    }

    const trackedPrefixes = ['[Supabase]', '[UserData]', '[ERP]', '[ERP Debug]', '[ERP Ant]', '[ERP Ant HTML]'];
    const verboseEnabled = window.__ERP_VERBOSE_LOGS === true || window.localStorage?.getItem('erp_verbose_logs') === '1';

    if (!verboseEnabled) {
        const shouldFilter = (args) => {
            const first = args && args.length > 0 ? args[0] : '';
            if (typeof first !== 'string') {
                return false;
            }
            return trackedPrefixes.some(prefix => first.startsWith(prefix));
        };

        const patchMethod = (method) => {
            const original = console[method] && console[method].bind(console);
            if (!original) {
                return;
            }
            console[method] = (...args) => {
                if (shouldFilter(args)) {
                    return;
                }
                original(...args);
            };
        };

        patchMethod('log');
        patchMethod('info');
        patchMethod('debug');
        patchMethod('warn');
    }

    window.__ERP_CONSOLE_FILTER_INSTALLED = true;
})();

const supabaseUrl = 'https://yzyhtqiwcbpqsglfbvqa.supabase.co';
const supabaseKey = 'sb_publishable_hgJCIbPhEyiCOWHV1hJMeg_QArg-t_v';

const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'hg_webstack_auth'
    }
});

window.supabaseClient = supabaseClient;
