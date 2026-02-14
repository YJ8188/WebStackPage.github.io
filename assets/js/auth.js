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
        throw new Error('登录服务初始化失败，请刷新页面后重试');
    }
    return client;
}

function isAbortLikeError(message) {
    const text = (message || '').toLowerCase();
    return text.includes('aborted') || text.includes('aborterror') || text.includes('signal is aborted');
}

function normalizeAuthError(error) {
    const rawMessage = error?.message || String(error || '');
    if (isAbortLikeError(rawMessage)) {
        return '登录请求被中断，请检查网络后重试';
    }
    if (!rawMessage) {
        return '登录失败，请稍后重试';
    }
    return rawMessage;
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
    const fallback = 'index.html';

    if (!raw) {
        return fallback;
    }

    try {
        const value = decodeURIComponent(raw).trim();
        if (!value) {
            return fallback;
        }
        if (/^(https?:|\/\/|javascript:)/i.test(value)) {
            return fallback;
        }
        if (value.includes('..')) {
            return fallback;
        }
        return value;
    } catch (error) {
        return fallback;
    }
}

const redirectTarget = getRedirectTarget();

// 初始化：检查是否之前选择了记住我
document.addEventListener('DOMContentLoaded', function() {
    const rememberPreference = localStorage.getItem('rememberMePreference');
    if (rememberPreference === 'true') {
        rememberMeCheckbox.checked = true;
    }
});

toggleMode();

toggleLink.addEventListener('click', function(e) {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    toggleMode();
});

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

authForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showAlert('请填写邮箱和密码', 'error');
        return;
    }

    if (password.length < 6) {
        showAlert('密码至少需要6个字符', 'error');
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
        showAlert(error.message, 'error');
        setLoading(false);
    }
});

async function signIn(email, password) {
    const client = assertSupabaseReady();
    const rememberMe = rememberMeCheckbox.checked;

    console.log('[Auth] 登录请求 - 邮箱:', email);
    console.log('[Auth] 记住我:', rememberMe);

    // 保存记住我的偏好
    localStorage.setItem('rememberMePreference', rememberMe.toString());

    // 使用持久化会话登录
    let authResult = await client.auth.signInWithPassword({
        email: email,
        password: password,
        options: {
            // 启用持久化会话
            // 注意：Supabase 默认会话有效期为1小时，刷新令牌有效期需在项目设置中配置
            // 这里我们使用 localStorage 来持久化会话
        }
    });

    if (authResult?.error && isAbortLikeError(authResult.error.message)) {
        await new Promise(resolve => setTimeout(resolve, 250));
        authResult = await client.auth.signInWithPassword({
            email: email,
            password: password
        });
    }

    const { data, error } = authResult;

    setLoading(false);

    if (error) {
        console.error('[Auth] 登录失败:', error);
        throw new Error(normalizeAuthError(error));
    }

    const { session, error: sessionError } = await getSessionWithRetry(client);
    if (sessionError || !session) {
        throw new Error(normalizeAuthError(sessionError) || '登录会话未建立，请稍后重试');
    }

    console.log('[Auth] 登录成功:', data);

    // 设置会话持久化
    if (rememberMe) {
        console.log('[Auth] 启用30天免登录');
        // Supabase 会自动处理会话刷新，我们只需要确保会话被持久化
        // 会话信息默认存储在 localStorage 中
    }

    showAlert('登录成功，正在进入首页...', 'success');
    window.location.replace(redirectTarget);
}

async function signUp(email, password) {
    const client = assertSupabaseReady();
    const { data, error } = await client.auth.signUp({
        email: email,
        password: password
    });

    setLoading(false);

    if (error) {
        throw new Error(error.message);
    }

    if (data.user && !data.session) {
        showAlert('注册成功！请检查邮箱验证账号', 'success');
    } else {
        showAlert('注册成功！正在跳转...', 'success');

        const { session, error: sessionError } = await getSessionWithRetry(client);
        if (sessionError || !session) {
            setLoading(false);
            showAlert('注册成功，但会话未建立，请手动登录', 'error');
            return;
        }
        
        window.location.replace(redirectTarget);
    }
}

function showAlert(message, type) {
    alertBox.textContent = message;
    alertBox.className = 'alert alert-' + type + ' show';

    setTimeout(() => {
        alertBox.classList.remove('show');
    }, 5000);
}

function setLoading(loading) {
    if (loading) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loading-spinner"></span>处理中...';
    } else {
        submitBtn.disabled = false;
        submitBtn.textContent = isLoginMode ? '登录' : '注册';
    }
}

// ==================== 会话自动恢复功能 ====================

/**
 * 检查当前会话状态
 * 如果会话有效且用户选择了记住我，则自动跳转到首页
 */
async function checkSessionAndRedirect() {
    console.log('[Auth] 检查会话状态...');

    try {
        const client = getSupabaseClient();
        if (!client) {
            console.warn('[Auth] Supabase 客户端未就绪，跳过自动跳转检查');
            return;
        }

        const { session, error } = await getSessionWithRetry(client);

        if (error) {
            console.error('[Auth] 获取会话失败:', error);
            return;
        }

        if (session) {
            console.log('[Auth] 会话有效，用户已登录:', session.user.email);

            // 检查是否选择了记住我
            const rememberPreference = localStorage.getItem('rememberMePreference');
            console.log('[Auth] 记住我偏好:', rememberPreference);

            // 如果会话有效且用户选择了记住我，自动跳转到目标页
            if (rememberPreference === 'true') {
                console.log('[Auth] 自动跳转到目标页:', redirectTarget);
                showAlert('检测到您已登录，正在跳转...', 'success');
                window.location.replace(redirectTarget);
            }
        } else {
            console.log('[Auth] 会话无效或已过期');
        }
    } catch (error) {
        console.error('[Auth] 检查会话异常:', error);
    }
}

// 监听认证状态变化
function bindAuthStateChangeListener() {
    const client = getSupabaseClient();
    if (!client) {
        console.warn('[Auth] 无法绑定认证监听：Supabase 客户端未就绪');
        return;
    }

    client.auth.onAuthStateChange((event, session) => {
        console.log('[Auth] 认证状态变化:', event);

        if (event === 'SIGNED_IN') {
            console.log('[Auth] 用户已登录');
        } else if (event === 'SIGNED_OUT') {
            console.log('[Auth] 用户已登出');
            localStorage.removeItem('rememberMePreference');
        } else if (event === 'TOKEN_REFRESHED') {
            console.log('[Auth] 令牌已刷新');
        }
    });
}

// 页面加载时检查会话
document.addEventListener('DOMContentLoaded', function() {
    bindAuthStateChangeListener();

    // 延迟检查，确保 Supabase 客户端已初始化
    setTimeout(() => {
        checkSessionAndRedirect();
    }, 100);
});
