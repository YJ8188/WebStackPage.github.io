/**
 * 提醒系统 - 独立模块
 * 功能：添加提醒、倒计时、弹出震动对话框
 * 作者：iFlow CLI
 * 日期：2026-01-10
 */

// ==================== 全局变量 ====================
let reminders = []; // 提醒列表
let reminderTimers = {}; // 定时器对象

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', function() {
    loadReminders(); // 加载保存的提醒
    updateReminderList(); // 更新提醒列表显示
    startReminderCheck(); // 开始检查提醒
});

// ==================== 切换通知中心面板 ====================
function toggleNotificationCenter() {
    const panel = document.getElementById('notificationPanel');
    if (panel.style.display === 'flex') {
        panel.style.display = 'none';
    } else {
        panel.style.display = 'flex';
    }
}

// ==================== 添加提醒 ====================
function addReminder() {
    const input = document.getElementById('reminderInput');
    const timeSelect = document.getElementById('reminderTime');

    const content = input.value.trim();
    const minutes = parseInt(timeSelect.value);

    // 验证输入
    if (!content) {
        showToast('请输入提醒内容！', 'error');
        return;
    }

    // 创建提醒对象
    const reminder = {
        id: Date.now(), // 唯一ID
        content: content, // 提醒内容
        minutes: minutes, // 倒计时分钟数
        createTime: new Date().getTime(), // 创建时间
        endTime: new Date().getTime() + minutes * 60 * 1000, // 结束时间
        active: true // 是否激活
    };

    // 添加到提醒列表
    reminders.push(reminder);

    // 保存到本地存储
    saveReminders();

    // 更新显示
    updateReminderList();

    // 清空输入框
    input.value = '';

    // 显示成功提示
    showToast(`已设置${minutes}分钟后提醒：${content}`, 'success');

    // 开始倒计时
    startCountdown(reminder);

    // 更新徽章
    updateBadge();
}

// ==================== 开始倒计时 ====================
function startCountdown(reminder) {
    const timerId = setInterval(() => {
        const now = new Date().getTime();

        // 检查是否到期
        if (now >= reminder.endTime) {
            // 清除定时器
            clearInterval(timerId);
            delete reminderTimers[reminder.id];

            // 标记为已完成
            reminder.active = false;

            // 保存状态
            saveReminders();

            // 弹出提醒对话框
            showReminderDialog(reminder);

            // 更新列表
            updateReminderList();

            // 播放提示音（可选）
            playNotificationSound();

            // 更新徽章
            updateBadge();
        }
    }, 1000); // 每秒检查一次

    // 保存定时器ID
    reminderTimers[reminder.id] = timerId;
}

// ==================== 显示提醒对话框（带震动效果） ====================
function showReminderDialog(reminder) {
    const overlay = document.getElementById('reminderOverlay');
    const dialog = document.getElementById('reminderDialog');
    const message = document.getElementById('reminderMessage');

    // 设置提醒内容
    message.textContent = reminder.content;

    // 显示对话框
    overlay.style.display = 'flex';

    // 添加震动动画
    dialog.classList.add('shake-animation');

    // 3秒后停止震动（避免用户头晕）
    setTimeout(() => {
        dialog.classList.remove('shake-animation');
    }, 3000);
}

// ==================== 关闭提醒对话框 ====================
function closeReminderDialog() {
    const overlay = document.getElementById('reminderOverlay');
    const dialog = document.getElementById('reminderDialog');

    // 移除震动动画
    dialog.classList.remove('shake-animation');

    // 隐藏对话框
    overlay.style.display = 'none';
}

// ==================== 删除提醒 ====================
function deleteReminder(id) {
    // 清除定时器
    if (reminderTimers[id]) {
        clearInterval(reminderTimers[id]);
        delete reminderTimers[id];
    }

    // 从列表中删除
    reminders = reminders.filter(r => r.id !== id);

    // 保存
    saveReminders();

    // 更新显示
    updateReminderList();

    // 更新徽章
    updateBadge();

    // 显示提示
    showToast('提醒已删除', 'info');
}

// ==================== 更新提醒列表显示 ====================
function updateReminderList() {
    const list = document.getElementById('reminderList');

    // 清空列表
    list.innerHTML = '';

    // 如果没有提醒
    if (reminders.length === 0) {
        list.innerHTML = '<div class="empty-reminders">暂无提醒</div>';
        return;
    }

    // 遍历提醒列表
    reminders.forEach(reminder => {
        const item = document.createElement('div');
        item.className = 'reminder-item';

        // 计算剩余时间
        const remaining = Math.max(0, Math.floor((reminder.endTime - new Date().getTime()) / 1000));
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;

        // 格式化时间显示
        let timeText = '';
        if (reminder.active) {
            timeText = `剩余 ${minutes}分${seconds}秒`;
        } else {
            timeText = '已完成';
        }

        // 创建HTML
        item.innerHTML = `
            <div class="reminder-item-content">
                <div>
                    <div class="reminder-text">${reminder.content}</div>
                    <div class="reminder-time">${timeText}</div>
                </div>
                <button class="delete-reminder" onclick="deleteReminder(${reminder.id})">✕</button>
            </div>
        `;

        // 添加到列表
        list.appendChild(item);
    });
}

// ==================== 定时更新提醒列表（每秒刷新倒计时） ====================
function startReminderCheck() {
    setInterval(() => {
        updateReminderList();
    }, 1000);
}

// ==================== 更新徽章 ====================
function updateBadge() {
    const badge = document.getElementById('notificationBadge');

    // 计算活跃提醒数量
    const activeCount = reminders.filter(r => r.active).length;

    if (activeCount > 0) {
        badge.textContent = activeCount;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

// ==================== 保存提醒到本地存储 ====================
function saveReminders() {
    localStorage.setItem('reminders', JSON.stringify(reminders));
}

// ==================== 从本地存储加载提醒 ====================
function loadReminders() {
    const saved = localStorage.getItem('reminders');
    if (saved) {
        reminders = JSON.parse(saved);

        // 恢复所有活跃提醒的倒计时
        reminders.forEach(reminder => {
            if (reminder.active) {
                startCountdown(reminder);
            }
        });

        // 更新徽章
        updateBadge();
    }
}

// ==================== 播放提示音（可选） ====================
function playNotificationSound() {
    // 创建音频上下文
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        // 连接节点
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // 设置音调
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        // 设置音量
        gainNode.gain.value = 0.3;

        // 播放
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
        console.log('无法播放提示音:', error);
    }
}

// ==================== Toast 提示函数（如果页面没有，提供备用） ====================
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) {
        console.log('Toast:', message);
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
        success: '✓',
        error: '✕',
        info: 'ℹ',
        warning: '⚠'
    };

    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    // 强制重绘
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // 自动隐藏
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 300);
    }, duration);
}