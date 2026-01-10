/**
 * 提醒系统
 * 功能：每日提醒、月度提醒、日期范围提醒、事件倒计时
 * 数据存储：localStorage
 */

// ==================== 提醒系统核心功能 ====================

// 提醒数据存储键名
const REMINDER_STORAGE_KEY = 'webstack_reminders';

// 提醒数据
let reminders = [];

// 倒计时定时器
let countdownInterval = null;

/**
 * 初始化提醒系统
 */
function initReminderSystem() {
    loadReminders();
    renderReminderList();
    startReminderCheck();
    updateCountdownWidget();
}

/**
 * 从localStorage加载提醒数据
 */
function loadReminders() {
    try {
        const data = localStorage.getItem(REMINDER_STORAGE_KEY);
        if (data) {
            reminders = JSON.parse(data);
        }
    } catch (e) {
        console.error('加载提醒数据失败:', e);
        reminders = [];
    }
}

/**
 * 保存提醒数据到localStorage
 */
function saveReminders() {
    try {
        localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(reminders));
    } catch (e) {
        console.error('保存提醒数据失败:', e);
    }
}

/**
 * 打开提醒管理弹窗
 */
function openReminderModal() {
    const modal = document.getElementById('reminderModal');
    modal.style.display = 'flex';
    renderReminderList();
}

/**
 * 关闭提醒管理弹窗
 */
function closeReminderModal() {
    const modal = document.getElementById('reminderModal');
    modal.style.display = 'none';
}

/**
 * 处理提醒类型变化
 */
function handleReminderTypeChange() {
    const type = document.getElementById('reminderType').value;

    // 隐藏所有选项
    document.getElementById('dailyOption').style.display = 'none';
    document.getElementById('monthlyOption').style.display = 'none';
    document.getElementById('dateRangeOption').style.display = 'none';
    document.getElementById('countdownOption').style.display = 'none';

    // 显示对应选项
    switch(type) {
        case 'daily':
            document.getElementById('dailyOption').style.display = 'block';
            break;
        case 'monthly':
            document.getElementById('monthlyOption').style.display = 'block';
            break;
        case 'dateRange':
            document.getElementById('dateRangeOption').style.display = 'block';
            break;
        case 'countdown':
            document.getElementById('countdownOption').style.display = 'block';
            break;
    }
}

/**
 * 添加提醒
 */
function addReminder() {
    const title = document.getElementById('reminderTitle').value.trim();
    const type = document.getElementById('reminderType').value;

    if (!title) {
        showToast('请输入提醒标题', 'warning');
        return;
    }

    const reminder = {
        id: Date.now(),
        title: title,
        type: type,
        enabled: true,
        createdAt: new Date().toISOString()
    };

    // 根据类型设置具体参数
    switch(type) {
        case 'daily':
            reminder.time = document.getElementById('dailyTime').value;
            break;
        case 'monthly':
            reminder.day = parseInt(document.getElementById('monthlyDate').value);
            reminder.time = document.getElementById('monthlyTime').value;
            break;
        case 'dateRange':
            reminder.startDate = parseInt(document.getElementById('rangeStartDate').value);
            reminder.endDate = parseInt(document.getElementById('rangeEndDate').value);
            reminder.time = document.getElementById('rangeTime').value;
            break;
        case 'countdown':
            reminder.targetDate = document.getElementById('countdownDate').value;
            reminder.targetTime = document.getElementById('countdownTime').value;
            reminder.showInCorner = document.getElementById('showInCorner').checked;
            break;
    }

    reminders.push(reminder);
    saveReminders();
    renderReminderList();
    updateCountdownWidget();

    // 清空表单
    document.getElementById('reminderTitle').value = '';
    showToast('提醒添加成功！', 'success');
}

/**
 * 删除提醒
 */
function deleteReminder(id) {
    if (confirm('确定要删除这个提醒吗？')) {
        reminders = reminders.filter(r => r.id !== id);
        saveReminders();
        renderReminderList();
        updateCountdownWidget();
        showToast('提醒已删除', 'info');
    }
}

/**
 * 切换提醒启用状态
 */
function toggleReminder(id) {
    const reminder = reminders.find(r => r.id === id);
    if (reminder) {
        reminder.enabled = !reminder.enabled;
        saveReminders();
        renderReminderList();
        updateCountdownWidget();
    }
}

/**
 * 渲染提醒列表
 */
function renderReminderList() {
    const container = document.getElementById('reminderList');
    const countEl = document.getElementById('reminderCount');

    countEl.textContent = reminders.length;

    if (reminders.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无提醒</div>';
        return;
    }

    container.innerHTML = reminders.map(reminder => {
        const typeLabels = {
            daily: '每日提醒',
            monthly: '月度提醒',
            dateRange: '日期范围',
            countdown: '倒计时'
        };

        let detail = '';
        switch(reminder.type) {
            case 'daily':
                detail = `每天 ${reminder.time}`;
                break;
            case 'monthly':
                detail = `每月${reminder.day}号 ${reminder.time}`;
                break;
            case 'dateRange':
                detail = `${reminder.startDate}-${reminder.endDate}号 ${reminder.time}`;
                break;
            case 'countdown':
                detail = `${reminder.targetDate} ${reminder.targetTime}`;
                break;
        }

        return `
            <div class="reminder-item ${reminder.enabled ? '' : 'disabled'}">
                <div class="reminder-item-content">
                    <div class="reminder-item-title">${reminder.title}</div>
                    <div class="reminder-item-detail">
                        <span class="reminder-type-badge">${typeLabels[reminder.type]}</span>
                        <span>${detail}</span>
                    </div>
                </div>
                <div class="reminder-item-actions">
                    <button class="reminder-toggle-btn" onclick="toggleReminder(${reminder.id})"
                        title="${reminder.enabled ? '禁用' : '启用'}">
                        ${reminder.enabled ? '🔔' : '🔕'}
                    </button>
                    <button class="reminder-delete-btn" onclick="deleteReminder(${reminder.id})" title="删除">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * 开始检查提醒
 */
function startReminderCheck() {
    // 每分钟检查一次
    setInterval(checkReminders, 60000);
    // 立即检查一次
    checkReminders();
}

/**
 * 检查提醒
 */
function checkReminders() {
    const now = new Date();
    const currentDate = now.getDate();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM
    const todayKey = now.toDateString();

    reminders.forEach(reminder => {
        if (!reminder.enabled) return;

        let shouldRemind = false;
        let reminderKey = `reminder_${reminder.id}_${todayKey}`;

        // 检查今天是否已经提醒过
        if (localStorage.getItem(reminderKey)) return;

        switch(reminder.type) {
            case 'daily':
                if (currentTime === reminder.time) {
                    shouldRemind = true;
                }
                break;
            case 'monthly':
                if (currentDate === reminder.day && currentTime === reminder.time) {
                    shouldRemind = true;
                }
                break;
            case 'dateRange':
                if (currentDate >= reminder.startDate && currentDate <= reminder.endDate && currentTime === reminder.time) {
                    shouldRemind = true;
                }
                break;
            case 'countdown':
                // 倒计时类型不使用定时提醒，而是实时显示
                break;
        }

        if (shouldRemind) {
            showReminderNotification(reminder);
            localStorage.setItem(reminderKey, 'true');
        }
    });
}

/**
 * 显示提醒通知
 */
function showReminderNotification(reminder) {
    // 使用自定义Toast显示
    showToast(`🔔 ${reminder.title}`, 'info', 5000);

    // 使用浏览器通知（如果允许）
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('提醒', {
            body: reminder.title,
            icon: '../assets/images/favicon.png'
        });
    }
}

/**
 * 更新倒计时组件
 */
function updateCountdownWidget() {
    const widget = document.getElementById('countdownWidget');
    const titleEl = document.getElementById('countdownWidgetTitle');
    const timerEl = document.getElementById('countdownWidgetTimer');

    // 查找要显示的倒计时
    const countdownReminder = reminders.find(r =>
        r.type === 'countdown' && r.enabled && r.showInCorner
    );

    if (!countdownReminder) {
        widget.style.display = 'none';
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        return;
    }

    widget.style.display = 'block';
    titleEl.textContent = countdownReminder.title;

    // 清除旧的定时器
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }

    // 更新倒计时
    const updateTimer = () => {
        const target = new Date(`${countdownReminder.targetDate}T${countdownReminder.targetTime}`);
        const now = new Date();
        const diff = target - now;

        if (diff <= 0) {
            timerEl.textContent = '已到达！';
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        timerEl.textContent = `${days}天 ${hours}小时 ${minutes}分 ${seconds}秒`;
    };

    updateTimer();
    countdownInterval = setInterval(updateTimer, 1000);
}

/**
 * 请求通知权限
 */
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

// ==================== 页面加载时初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
    initReminderSystem();
    requestNotificationPermission();
});