const authForm = document.getElementById('authForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const submitBtn = document.getElementById('submitBtn');
const alertBox = document.getElementById('alertBox');
const formTitle = document.getElementById('formTitle');
const formSubtitle = document.getElementById('formSubtitle');
const toggleText = document.getElementById('toggleText');
const toggleLink = document.getElementById('toggleLink');

let isLoginMode = true;

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
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        throw new Error(error.message);
    }

    showAlert('登录成功！正在跳转...', 'success');

    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}

async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password
    });

    if (error) {
        throw new Error(error.message);
    }

    if (data.user && !data.session) {
        showAlert('注册成功！请检查邮箱验证账号', 'success');
    } else {
        showAlert('注册成功！正在跳转...', 'success');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
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
