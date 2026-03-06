const authForm = document.getElementById('authForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const rememberMeCheckbox = document.getElementById('rememberMe');
const submitBtn = document.getElementById('submitBtn');
const alertBox = document.getElementById('alertBox');
const formTitle = document.getElementById('formTitle');
const formSubtitle = document.getElementById('formSubtitle');
const toggleText = document.getElementById('toggleText');
const toggleLink = document.getElementById('toggleLink');

let isLoginMode = true;

const REMEMBER_ME_KEY = 'rememberMePreference';
const REMEMBER_ME_EXPIRES_KEY = 'rememberMeExpiresAt';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function getSupabaseClient() {
    if (window.supabaseClient && window.supabaseClient.auth) {
        return window.supabaseClient;
    }
    if (typeof supabaseClient !== 'undefined' && supabaseClient?.auth) {
        return supabaseClient;
    }
    return null;
}

function assertSupabaseReady() {
    const client = getSupabaseClient();
    if (!client) {
        throw new Error('登录服务初始化失败，请刷新后重试');
    }
    return client;
}

function isAbortLikeError(message) {
    const text = String(message || '').toLowerCase();
    return text.includes('aborted') || text.includes('aborterror') || text.includes('signal is aborted');
}

function normalizeAuthError(error) {
    const rawMessage = error?.message || String(error || '');
    if (isAbortLikeError(rawMessage)) {
        return '登录请求被中断，请检查网络后重试';
    }
    return rawMessage || '登录失败，请稍后重试';
}

function clearRememberMeState() {
    localStorage.removeItem(REMEMBER_ME_KEY);
    localStorage.removeItem(REMEMBER_ME_EXPIRES_KEY);
}

function setRememberMeState(enabled) {
    const rememberEnabled = enabled === true;
    localStorage.setItem(REMEMBER_ME_KEY, rememberEnabled.toString());

    if (rememberEnabled) {
        const expiresAt = Date.now() + THIRTY_DAYS_MS;
        localStorage.setItem(REMEMBER_ME_EXPIRES_KEY, String(expiresAt));
    } else {
        localStorage.removeItem(REMEMBER_ME_EXPIRES_KEY);
    }
}

function getRememberMeMeta() {
    const enabled = localStorage.getItem(REMEMBER_ME_KEY) === 'true';
    const rawExpires = localStorage.getItem(REMEMBER_ME_EXPIRES_KEY);
    const expiresAt = Number(rawExpires);
    const validExpiry = Number.isFinite(expiresAt) && expiresAt > 0;

    if (enabled && !validExpiry) {
        return {
            enabled: true,
            expiresAt: null,
            expired: true
        };
    }

    return {
        enabled,
        expiresAt: validExpiry ? expiresAt : null,
        expired: enabled && validExpiry ? Date.now() >= expiresAt : false
    };
}

async function safeLocalSignOut(client) {
    try {
        await Promise.race([
            client.auth.signOut({ scope: 'local' }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('signout-timeout')), 5000))
        ]);
    } catch (error) {
        return false;
    }
    return true;
}

async function getSessionWithRetry(client, maxAttempts = 3) {
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const { data: { session }, error } = await client.auth.getSession();
            if (!error) {
                return { session, error: null };
            }

            lastError = error;
            if (!isAbortLikeError(error.message) || attempt === maxAttempts) {
                break;
            }
        } catch (error) {
            lastError = error;
            if (!isAbortLikeError(error.message) || attempt === maxAttempts) {
                break;
            }
        }

        await new Promise(resolve => setTimeout(resolve, 200 * attempt));
    }

    return { session: null, error: lastError };
}

function getRedirectTarget() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('returnTo');
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '') || window.innerWidth <= 900;
    const fallback = isMobileDevice ? 'mobile-erp.html' : 'index.html';

    if (!raw) {
        return fallback;
    }

    try {
        const value = decodeURIComponent(raw).trim();
        if (!value || /^(https?:|\/\/|javascript:)/i.test(value) || value.includes('..')) {
            return fallback;
        }
        if (isMobileDevice && /(^|\/)(erp-ant\.html|erp\.html)$/i.test(value)) {
            return 'mobile-erp.html';
        }
        return value;
    } catch (error) {
        return fallback;
    }
}

const redirectTarget = getRedirectTarget();

function toggleMode() {
    if (isLoginMode) {
        formTitle.textContent = '登录';
        formSubtitle.textContent = '欢迎回到何哥的网站导航系统';
        submitBtn.textContent = '登录';
        toggleText.textContent = '还没有账号？';
        toggleLink.textContent = '立即注册';
    } else {
        formTitle.textContent = '注册';
        formSubtitle.textContent = '创建新账号，开始使用';
        submitBtn.textContent = '注册';
        toggleText.textContent = '已有账号？';
        toggleLink.textContent = '立即登录';
    }
}

function showAlert(message, type) {
    if (!alertBox) {
        return;
    }
    alertBox.textContent = message;
    alertBox.className = `alert alert-${type} show`;

    setTimeout(() => {
        alertBox.classList.remove('show');
    }, 5000);
}

function setLoading(loading) {
    if (!submitBtn) {
        return;
    }

    if (loading) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loading-spinner"></span>处理中...';
    } else {
        submitBtn.disabled = false;
        submitBtn.textContent = isLoginMode ? '登录' : '注册';
    }
}

async function signIn(email, password) {
    const client = assertSupabaseReady();
    const rememberMe = rememberMeCheckbox?.checked === true;

    setRememberMeState(rememberMe);

    let authResult = await client.auth.signInWithPassword({
        email,
        password
    });

    if (authResult?.error && isAbortLikeError(authResult.error.message)) {
        await new Promise(resolve => setTimeout(resolve, 250));
        authResult = await client.auth.signInWithPassword({ email, password });
    }

    const { error } = authResult;
    if (error) {
        throw new Error(normalizeAuthError(error));
    }

    const { session, error: sessionError } = await getSessionWithRetry(client);
    if (sessionError || !session) {
        throw new Error(normalizeAuthError(sessionError) || '登录会话未建立，请稍后重试');
    }

    if (rememberMe) {
        setRememberMeState(true);
    }

    showAlert('登录成功，正在进入首页...', 'success');
    window.location.replace(redirectTarget);
}

async function signUp(email, password) {
    const client = assertSupabaseReady();
    const { data, error } = await client.auth.signUp({ email, password });

    if (error) {
        throw new Error(error.message || '注册失败，请稍后重试');
    }

    if (data.user && !data.session) {
        showAlert('注册成功，请检查邮箱并完成验证', 'success');
        return;
    }

    showAlert('注册成功，正在跳转...', 'success');
    window.location.replace(redirectTarget);
}

async function checkSessionAndRedirect() {
    try {
        const client = getSupabaseClient();
        if (!client) {
            return;
        }

        const { session, error } = await getSessionWithRetry(client);
        if (error || !session) {
            return;
        }

        const rememberMeta = getRememberMeMeta();
        if (rememberMeta.enabled && rememberMeta.expired) {
            await safeLocalSignOut(client);
            clearRememberMeState();
            showAlert('30天自动登录已过期，请重新登录', 'info');
            return;
        }

        if (rememberMeta.enabled) {
            showAlert('检测到您已登录，正在跳转...', 'success');
            window.location.replace(redirectTarget);
        }
    } catch (error) {
        console.error('[Auth] 检查会话异常:', error);
    }
}

function bindAuthStateChangeListener() {
    const client = getSupabaseClient();
    if (!client) {
        return;
    }

    client.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
            clearRememberMeState();
        }
    });
}

toggleLink?.addEventListener('click', function (event) {
    event.preventDefault();
    isLoginMode = !isLoginMode;
    toggleMode();
});

authForm?.addEventListener('submit', async function (event) {
    event.preventDefault();

    const email = emailInput?.value?.trim() || '';
    const password = passwordInput?.value || '';

    if (!email || !password) {
        showAlert('请填写邮箱和密码', 'error');
        return;
    }

    setLoading(true);
    try {
        if (isLoginMode) {
            await signIn(email, password);
        } else {
            await signUp(email, password);
        }
    } catch (error) {
        showAlert(error.message || '操作失败，请重试', 'error');
    } finally {
        setLoading(false);
    }
});

document.addEventListener('DOMContentLoaded', function () {
    const rememberMeta = getRememberMeMeta();
    if (rememberMeta.enabled && rememberMeta.expired) {
        clearRememberMeState();
        rememberMeCheckbox.checked = false;
    } else {
        rememberMeCheckbox.checked = rememberMeta.enabled;
    }

    toggleMode();
    bindAuthStateChangeListener();

    setTimeout(() => {
        checkSessionAndRedirect();
    }, 100);
});
