const loginBtn = document.getElementById('loginBtn');
const loginText = document.getElementById('loginText');

async function updateLoginButton() {
    if (userData.isLoggedIn) {
        loginText.textContent = userData.user.email;
        loginBtn.onclick = async function(e) {
            e.preventDefault();
            await handleLogout();
        };
        loginBtn.title = '点击登出';
    } else {
        loginText.textContent = '登录';
        loginBtn.href = 'login.html';
        loginBtn.onclick = null;
        loginBtn.title = '登录/注册';
    }
}

async function handleLogout() {
    const confirmed = await showConfirmModal('确定要登出吗？');
    
    if (confirmed) {
        const { error } = await supabaseClient.auth.signOut();
        
        if (error) {
            showToast('登出失败：' + error.message, 'error');
        } else {
            showToast('已成功登出', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        }
    }
}

function showConfirmModal(message) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 10px; max-width: 400px; text-align: center;">
                <p style="margin-bottom: 20px; font-size: 16px;">${message}</p>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="confirmCancel" style="padding: 10px 20px; border: none; border-radius: 5px; background: #ccc; cursor: pointer;">取消</button>
                    <button id="confirmOk" style="padding: 10px 20px; border: none; border-radius: 5px; background: #667eea; color: white; cursor: pointer;">确定</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const cancelBtn = modal.querySelector('#confirmCancel');
        const okBtn = modal.querySelector('#confirmOk');
        
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
            resolve(false);
        });
        
        okBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
            resolve(true);
        });
    });
}

document.addEventListener('DOMContentLoaded', async function() {
    await userData.init();
    updateLoginButton();
    
    supabaseClient.auth.onAuthStateChange((event, session) => {
        updateLoginButton();
    });
});
