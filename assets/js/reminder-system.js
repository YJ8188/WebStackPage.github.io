/**
 * 提醒系统
 * 功能：每日提醒、月度提醒、日期范围提醒、事件倒计时
 * 数据存储：localStorage
 */

// ==================== 注入样式到页面 ====================
function injectReminderStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* ==================== 提醒管理弹窗样式 ==================== */
        .reminder-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 100002;
            display: none;
            justify-content: center;
            align-items: center;
            backdrop-filter: blur(5px);
        }

        body.dark-mode .reminder-modal-dialog {
            background: rgba(42, 42, 42, 0.98);
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }

        @keyframes reminderSlideIn {
            from {
                transform: translateY(-30px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }

        .reminder-modal-dialog {
            width: 500px;
            max-width: 90%;
            max-height: 85vh;
            border-radius: 16px;
            background: rgba(255, 255, 255, 0.98);
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            animation: reminderSlideIn 0.3s ease-out;
        }

        .reminder-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px;
            border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }

        body.dark-mode .reminder-modal-header {
            border-bottom-color: rgba(255, 255, 255, 0.1);
        }

        .reminder-modal-title {
            font-family: "HarmonyOS Sans", "PingFang SC", "Microsoft YaHei", sans-serif;
            font-size: 20px;
            font-weight: 600;
            color: #2d3748;
        }

        body.dark-mode .reminder-modal-title {
            color: #e0e0e0;
        }

        .reminder-modal-close {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #718096;
            transition: color 0.2s;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .reminder-modal-close:hover {
            color: #2d3748;
        }

        body.dark-mode .reminder-modal-close:hover {
            color: #e0e0e0;
        }

        .reminder-modal-body {
            padding: 24px;
            overflow-y: auto;
            max-height: calc(85vh - 80px);
        }

        /* 提醒表单样式 */
        .reminder-form {
            margin-bottom: 24px;
            padding-bottom: 24px;
            border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }

        body.dark-mode .reminder-form {
            border-bottom-color: rgba(255, 255, 255, 0.1);
        }

        .form-group {
            margin-bottom: 16px;
        }

        .form-group label {
            display: block;
            font-family: "HarmonyOS Sans", "PingFang SC", "Microsoft YaHei", sans-serif;
            font-size: 14px;
            font-weight: 500;
            color: #4a5568;
            margin-bottom: 8px;
        }

        body.dark-mode .form-group label {
            color: #cbd5e0;
        }

        .form-group input,
        .form-group select {
            width: 100%;
            padding: 10px 14px;
            border: 1px solid rgba(0, 0, 0, 0.2);
            border-radius: 8px;
            font-family: "HarmonyOS Sans", "PingFang SC", "Microsoft YaHei", sans-serif;
            font-size: 14px;
            color: #2d3748;
            background: #fff;
            transition: all 0.2s;
        }

        body.dark-mode .form-group input,
        body.dark-mode .form-group select {
            border-color: rgba(255, 255, 255, 0.2);
            color: #e0e0e0;
            background: rgba(255, 255, 255, 0.05);
        }

        .form-group input:focus,
        .form-group select:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .form-group input[type="checkbox"] {
            width: auto;
            margin-right: 8px;
        }

        /* 提醒列表样式 */
        .reminder-list-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            font-family: "HarmonyOS Sans", "PingFang SC", "Microsoft YaHei", sans-serif;
            font-size: 16px;
            font-weight: 600;
            color: #2d3748;
        }

        body.dark-mode .reminder-list-header {
            color: #e0e0e0;
        }

        .reminder-items {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .reminder-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px;
            border-radius: 12px;
            background: rgba(0, 0, 0, 0.03);
            border: 1px solid rgba(0, 0, 0, 0.08);
            transition: all 0.2s;
        }

        body.dark-mode .reminder-item {
            background: rgba(255, 255, 255, 0.05);
            border-color: rgba(255, 255, 255, 0.1);
        }

        .reminder-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .reminder-item.disabled {
            opacity: 0.5;
        }

        .reminder-item-content {
            flex: 1;
        }

        .reminder-item-title {
            font-family: "HarmonyOS Sans", "PingFang SC", "Microsoft YaHei", sans-serif;
            font-size: 15px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 4px;
        }

        body.dark-mode .reminder-item-title {
            color: #e0e0e0;
        }

        .reminder-item-detail {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #718096;
        }

        body.dark-mode .reminder-item-detail {
            color: #a0aec0;
        }

        .reminder-type-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff;
            font-size: 11px;
            font-weight: 500;
        }

        .reminder-item-actions {
            display: flex;
            gap: 8px;
        }

        .reminder-toggle-btn,
        .reminder-delete-btn {
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            padding: 6px;
            border-radius: 6px;
            transition: all 0.2s;
        }

        .reminder-toggle-btn:hover {
            background: rgba(102, 126, 234, 0.1);
        }

        .reminder-delete-btn:hover {
            background: rgba(239, 68, 68, 0.1);
        }

        /* 左下角倒计时组件样式 */
        .countdown-widget {
            position: fixed;
            bottom: 80px;
            left: 24px;
            padding: 16px 20px;
            border-radius: 12px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
            z-index: 9998;
            animation: countdownPulse 2s infinite;
        }

        @keyframes countdownPulse {
            0%, 100% {
                transform: scale(1);
            }
            50% {
                transform: scale(1.02);
            }
        }

        .countdown-title {
            font-family: "HarmonyOS Sans", "PingFang SC", "Microsoft YaHei", sans-serif;
            font-size: 13px;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.9);
            margin-bottom: 6px;
        }

        .countdown-timer {
            font-family: "HarmonyOS Sans", "PingFang SC", "Microsoft YaHei", sans-serif;
            font-size: 18px;
            font-weight: 700;
            color: #fff;
            white-space: nowrap;
        }

        /* 移动端适配 */
        @media (max-width: 768px) {
            .reminder-modal-dialog {
                width: 95%;
                max-height: 90vh;
            }

            .countdown-widget {
                bottom: 80px;
                left: 16px;
                padding: 12px 16px;
            }

            .countdown-title {
                font-size: 12px;
            }

            .countdown-timer {
                font-size: 15px;
            }
        }
    `;
    document.head.appendChild(style);
}

// ==================== 注入HTML到页面 ====================
function injectReminderHTML() {
    // 检查是否已经注入过
    if (document.getElementById('reminderBtn')) {
        return;
    }

    // 提醒管理按钮
    const reminderBtn = document.createElement('button');
    reminderBtn.id = 'reminderBtn';
    reminderBtn.onclick = openReminderModal;
    reminderBtn.title = '提醒管理';
    reminderBtn.style.cssText = 'position: fixed; bottom: 24px; left: 24px; width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4); transition: all .3s ease; z-index: 9999; border: none; font-size: 20px;';
    reminderBtn.textContent = '🔔';
    document.body.appendChild(reminderBtn);

    // 提醒管理弹窗
    const modalHTML = `
        <div class="reminder-modal-overlay" id="reminderModal" style="display: none;">
            <div class="reminder-modal-dialog">
                <div class="reminder-modal-header">
                    <div class="reminder-modal-title">📅 提醒管理</div>
                    <button class="reminder-modal-close" onclick="closeReminderModal()">✕</button>
                </div>

                <div class="reminder-modal-body">
                    <!-- 添加新提醒表单 -->
                    <div class="reminder-form">
                        <div class="form-group">
                            <label>提醒标题</label>
                            <input type="text" id="reminderTitle" placeholder="例如：缴纳电费、春节倒计时">
                        </div>

                        <div class="form-group">
                            <label>提醒类型</label>
                            <select id="reminderType" onchange="handleReminderTypeChange()">
                                <option value="daily">每日提醒</option>
                                <option value="monthly">月度提醒（每月固定日期）</option>
                                <option value="dateRange">日期范围提醒（如6-8号）</option>
                                <option value="countdown">事件倒计时</option>
                            </select>
                        </div>

                        <!-- 每日提醒选项 -->
                        <div class="reminder-type-option" id="dailyOption">
                            <div class="form-group">
                                <label>提醒时间</label>
                                <input type="time" id="dailyTime" value="09:00">
                            </div>
                        </div>

                        <!-- 月度提醒选项 -->
                        <div class="reminder-type-option" id="monthlyOption" style="display: none;">
                            <div class="form-group">
                                <label>每月几号</label>
                                <input type="number" id="monthlyDate" min="1" max="31" value="1">
                            </div>
                            <div class="form-group">
                                <label>提醒时间</label>
                                <input type="time" id="monthlyTime" value="09:00">
                            </div>
                        </div>

                        <!-- 日期范围提醒选项 -->
                        <div class="reminder-type-option" id="dateRangeOption" style="display: none;">
                            <div class="form-group">
                                <label>起始日期</label>
                                <input type="number" id="rangeStartDate" min="1" max="31" value="6">
                            </div>
                            <div class="form-group">
                                <label>结束日期</label>
                                <input type="number" id="rangeEndDate" min="1" max="31" value="8">
                            </div>
                            <div class="form-group">
                                <label>提醒时间</label>
                                <input type="time" id="rangeTime" value="09:00">
                            </div>
                        </div>

                        <!-- 倒计时选项 -->
                        <div class="reminder-type-option" id="countdownOption" style="display: none;">
                            <div class="form-group">
                                <label>目标日期</label>
                                <input type="date" id="countdownDate">
                            </div>
                            <div class="form-group">
                                <label>目标时间</label>
                                <input type="time" id="countdownTime" value="00:00">
                            </div>
                            <div class="form-group">
                                <label style="display: flex; align-items: center; gap: 8px;">
                                    <input type="checkbox" id="showInCorner" checked>
                                    在左下角显示倒计时
                                </label>
                            </div>
                        </div>

                        <button class="btn btn-primary" onclick="addReminder()" style="width: 100%; margin-top: 10px;">
                            ➕ 添加提醒
                        </button>
                    </div>

                    <!-- 提醒列表 -->
                    <div class="reminder-list">
                        <div class="reminder-list-header">
                            <span>我的提醒</span>
                            <span id="reminderCount">0</span>
                        </div>
                        <div id="reminderList" class="reminder-items">
                            <div class="empty-state">暂无提醒</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 左下角倒计时显示 -->
        <div class="countdown-widget" id="countdownWidget" style="display: none;">
            <div class="countdown-title" id="countdownWidgetTitle">春节倒计时</div>
            <div class="countdown-timer" id="countdownWidgetTimer">00天 00小时 00分 00秒</div>
        </div>
    `;

    // 创建临时容器并插入HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalHTML;
    document.body.appendChild(tempDiv);

    // 将子元素移到body
    while (tempDiv.firstChild) {
        document.body.appendChild(tempDiv.firstChild);
    }

    // 移除临时容器
    document.body.removeChild(tempDiv);
}

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
    injectReminderStyles();
    injectReminderHTML();
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
