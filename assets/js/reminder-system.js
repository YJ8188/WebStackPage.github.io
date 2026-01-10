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
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.02);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            animation: reminderSlideIn 0.3s ease-out;
        }

        body.dark-mode .reminder-modal-dialog {
            background: rgba(255, 255, 255, 0.02);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
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
            color: #cbd5e0;
            margin-bottom: 8px;
        }

        .form-group input,
        .form-group select {
            width: 100%;
            padding: 10px 14px;
            border: 1px solid rgba(0, 0, 0, 0.2);
            border-radius: 10px;
            font-family: "HarmonyOS Sans", "PingFang SC", "Microsoft YaHei", sans-serif;
            font-size: 14px;
            color: #e0e0e0;
            background: rgba(255, 255, 255, 0.05);
            transition: all 0.2s;
        }

        .form-group input:focus,
        .form-group select:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        /* 修复select下拉选项的暗黑模式背景 */
        .form-group select option {
            background: #2a2a2a;
            color: #e0e0e0;
        }

        .form-group input[type="checkbox"] {
            width: auto;
            margin-right: 8px;
        }

        /* 时间段选择样式 */
        .time-range-group {
            display: flex;
            gap: 10px;
            align-items: center;
        }

        .time-range-group .form-group {
            flex: 1;
            margin-bottom: 0;
        }

        .time-range-separator {
            color: #a0aec0;
            font-weight: 600;
        }

        /* 重复提醒设置样式 */
        .repeat-settings {
            background: rgba(255, 255, 255, 0.05);
            padding: 12px;
            border-radius: 10px;
            margin-top: 12px;
        }

        .repeat-interval-group {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 8px;
        }

        .repeat-interval-group input[type="number"] {
            width: 80px !important;
        }

        /* 添加提醒按钮样式 - 与主页按钮一致 */
        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff;
            border: none;
            border-radius: 10px;
            padding: 12px 24px;
            font-family: "HarmonyOS Sans", "PingFang SC", "Microsoft YaHei", sans-serif;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.35);
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(102, 126, 234, 0.45);
        }

        /* 提醒通知弹窗样式 */
        .reminder-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            max-width: 400px;
            padding: 16px 20px;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.02);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
            z-index: 100003;
            animation: notificationSlideIn 0.3s ease-out;
            display: none;
        }

        @keyframes notificationSlideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        .reminder-notification.show {
            display: block;
        }

        .reminder-notification-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }

        .reminder-notification-title {
            font-family: "HarmonyOS Sans", "PingFang SC", "Microsoft YaHei", sans-serif;
            font-size: 16px;
            font-weight: 600;
            color: #e0e0e0;
        }

        .reminder-notification-close {
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #a0aec0;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .reminder-notification-body {
            font-family: "HarmonyOS Sans", "PingFang SC", "Microsoft YaHei", sans-serif;
            font-size: 14px;
            color: #cbd5e0;
            margin-bottom: 16px;
        }

        .reminder-notification-actions {
            display: flex;
            gap: 8px;
        }

        .reminder-notification-btn {
            flex: 1;
            padding: 10px 16px;
            border-radius: 10px;
            font-family: "HarmonyOS Sans", "PingFang SC", "Microsoft YaHei", sans-serif;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            border: none;
        }

        .reminder-notification-btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff;
        }

        .reminder-notification-btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.35);
        }

        .reminder-notification-btn-secondary {
            background: rgba(255, 255, 255, 0.05);
            color: #cbd5e0;
        }

        .reminder-notification-btn-secondary:hover {
            background: rgba(255, 255, 255, 0.1);
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
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.02);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            border: 1px solid rgba(0, 0, 0, 0.08);
        }

        .reminder-item:hover {
            transform: translateY(-6px) scale(1.01);
            box-shadow: 0 14px 32px rgba(0, 0, 0, 0.55);
            z-index: 100;
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
            color: #e0e0e0;
            margin-bottom: 4px;
        }

        .reminder-item-detail {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
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
            align-items: center;
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

        /* 提醒按钮样式 */
        #reminderBtn {
            position: fixed;
            bottom: 24px;
            left: 24px;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
            transition: all 0.3s ease;
            z-index: 9999;
            border: none;
            font-size: 20px;
        }

        #reminderBtn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(102, 126, 234, 0.5);
        }

        /* 按钮右侧倒计时小卡片容器 */
        .reminder-countdowns-container {
            position: fixed;
            bottom: 24px;
            left: 84px;
            display: flex;
            gap: 12px;
            z-index: 9999;
        }

        /* 按钮上方的倒计时卡片（事件倒计时） */
        .reminder-countdown-card.countdown-main {
            position: fixed;
            bottom: 84px;
            left: 24px;
            padding: 16px 20px;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.02);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            border: 1px solid rgba(0, 0, 0, 0.08);
            animation: countdownPulse 2s infinite;
            min-width: 180px;
            width: auto;
        }

        /* 按钮右侧的提醒卡片（当前时间段提醒） */
        .reminder-countdown-card.countdown-side {
            padding: 8px 12px;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.02);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            border: 1px solid rgba(0, 0, 0, 0.08);
            min-width: 180px;
            max-width: 180px;
        }

        .reminder-countdown-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45);
        }

        @keyframes countdownPulse {
            0%, 100% {
                transform: scale(1);
            }
            50% {
                transform: scale(1.02);
            }
        }

        .reminder-countdown-title {
            font-family: "HarmonyOS Sans", "PingFang SC", "Microsoft YaHei", sans-serif;
            font-size: 11px;
            font-weight: 600;
            color: #a0aec0;
            margin-bottom: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .reminder-countdown-timer {
            font-family: "HarmonyOS Sans", "PingFang SC", "Microsoft YaHei", sans-serif;
            font-size: 16px;
            font-weight: 700;
            color: #e0e0e0;
            white-space: nowrap;
        }

        .reminder-countdown-detail {
            font-family: "HarmonyOS Sans", "PingFang SC", "Microsoft YaHei", sans-serif;
            font-size: 12px;
            font-weight: 600;
            color: #e0e0e0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        /* 移动端隐藏提醒系统 */
        @media (max-width: 768px) {
            #reminderBtn,
            .reminder-modal-overlay,
            .reminder-countdowns-container {
                display: none !important;
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
    reminderBtn.textContent = '🔔';
    document.body.appendChild(reminderBtn);

    // 倒计时小卡片容器
    const countdownsContainer = document.createElement('div');
    countdownsContainer.id = 'reminderCountdownsContainer';
    countdownsContainer.className = 'reminder-countdowns-container';
    document.body.appendChild(countdownsContainer);

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
                                <label>提醒时间段</label>
                                <div class="time-range-group">
                                    <div class="form-group">
                                        <input type="time" id="dailyStartTime" value="09:00">
                                    </div>
                                    <span class="time-range-separator">至</span>
                                    <div class="form-group">
                                        <input type="time" id="dailyEndTime" value="24:00">
                                    </div>
                                </div>
                            </div>
                            <div class="form-group">
                                <label style="display: flex; align-items: center; gap: 8px;">
                                    <input type="checkbox" id="dailyRepeat" checked>
                                    启用重复提醒
                                </label>
                                <div class="repeat-settings" id="dailyRepeatSettings">
                                    <label style="font-size: 13px; color: #718096; margin-bottom: 8px;">重复提醒间隔（分钟）</label>
                                    <div class="repeat-interval-group">
                                        <input type="number" id="dailyRepeatInterval" min="1" max="60" value="5">
                                        <span style="color: #718096;">分钟</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 月度提醒选项 -->
                        <div class="reminder-type-option" id="monthlyOption" style="display: none;">
                            <div class="form-group">
                                <label>每月几号</label>
                                <input type="number" id="monthlyDate" min="1" max="31" value="1">
                            </div>
                            <div class="form-group">
                                <label>提醒时间段</label>
                                <div class="time-range-group">
                                    <div class="form-group">
                                        <input type="time" id="monthlyStartTime" value="09:00">
                                    </div>
                                    <span class="time-range-separator">至</span>
                                    <div class="form-group">
                                        <input type="time" id="monthlyEndTime" value="24:00">
                                    </div>
                                </div>
                            </div>
                            <div class="form-group">
                                <label style="display: flex; align-items: center; gap: 8px;">
                                    <input type="checkbox" id="monthlyRepeat" checked>
                                    启用重复提醒
                                </label>
                                <div class="repeat-settings" id="monthlyRepeatSettings">
                                    <label style="font-size: 13px; color: #718096; margin-bottom: 8px;">重复提醒间隔（分钟）</label>
                                    <div class="repeat-interval-group">
                                        <input type="number" id="monthlyRepeatInterval" min="1" max="60" value="5">
                                        <span style="color: #718096;">分钟</span>
                                    </div>
                                </div>
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
                                <label>提醒时间段</label>
                                <div class="time-range-group">
                                    <div class="form-group">
                                        <input type="time" id="rangeStartTime" value="09:00">
                                    </div>
                                    <span class="time-range-separator">至</span>
                                    <div class="form-group">
                                        <input type="time" id="rangeEndTime" value="24:00">
                                    </div>
                                </div>
                            </div>
                            <div class="form-group">
                                <label style="display: flex; align-items: center; gap: 8px;">
                                    <input type="checkbox" id="rangeRepeat" checked>
                                    启用重复提醒
                                </label>
                                <div class="repeat-settings" id="rangeRepeatSettings">
                                    <label style="font-size: 13px; color: #718096; margin-bottom: 8px;">重复提醒间隔（分钟）</label>
                                    <div class="repeat-interval-group">
                                        <input type="number" id="rangeRepeatInterval" min="1" max="60" value="5">
                                        <span style="color: #718096;">分钟</span>
                                    </div>
                                </div>
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

        <!-- 提醒通知弹窗 -->
        <div class="reminder-notification" id="reminderNotification">
            <div class="reminder-notification-header">
                <div class="reminder-notification-title">🔔 提醒</div>
                <button class="reminder-notification-close" onclick="closeReminderNotification()">✕</button>
            </div>
            <div class="reminder-notification-body" id="reminderNotificationBody">
                您有一个提醒需要处理
            </div>
            <div class="reminder-notification-actions">
                <button class="reminder-notification-btn reminder-notification-btn-secondary" onclick="snoozeReminder()">稍后提醒</button>
                <button class="reminder-notification-btn reminder-notification-btn-primary" onclick="acknowledgeReminder()">已知晓</button>
            </div>
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
            reminder.startTime = document.getElementById('dailyStartTime').value;
            reminder.endTime = document.getElementById('dailyEndTime').value;
            reminder.repeat = document.getElementById('dailyRepeat').checked;
            reminder.repeatInterval = reminder.repeat ? parseInt(document.getElementById('dailyRepeatInterval').value) : 0;
            break;
        case 'monthly':
            reminder.day = parseInt(document.getElementById('monthlyDate').value);
            reminder.startTime = document.getElementById('monthlyStartTime').value;
            reminder.endTime = document.getElementById('monthlyEndTime').value;
            reminder.repeat = document.getElementById('monthlyRepeat').checked;
            reminder.repeatInterval = reminder.repeat ? parseInt(document.getElementById('monthlyRepeatInterval').value) : 0;
            break;
        case 'dateRange':
            reminder.startDate = parseInt(document.getElementById('rangeStartDate').value);
            reminder.endDate = parseInt(document.getElementById('rangeEndDate').value);
            reminder.startTime = document.getElementById('rangeStartTime').value;
            reminder.endTime = document.getElementById('rangeEndTime').value;
            reminder.repeat = document.getElementById('rangeRepeat').checked;
            reminder.repeatInterval = reminder.repeat ? parseInt(document.getElementById('rangeRepeatInterval').value) : 0;
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
                detail = `每天 ${reminder.startTime}-${reminder.endTime}`;
                if (reminder.repeat) {
                    detail += ` | 每${reminder.repeatInterval}分钟重复`;
                }
                break;
            case 'monthly':
                detail = `每月${reminder.day}号 ${reminder.startTime}-${reminder.endTime}`;
                if (reminder.repeat) {
                    detail += ` | 每${reminder.repeatInterval}分钟重复`;
                }
                break;
            case 'dateRange':
                detail = `${reminder.startDate}-${reminder.endDate}号 ${reminder.startTime}-${reminder.endTime}`;
                if (reminder.repeat) {
                    detail += ` | 每${reminder.repeatInterval}分钟重复`;
                }
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

        // 倒计时类型不使用定时提醒
        if (reminder.type === 'countdown') return;

        // 检查是否在时间段内
        let inTimeRange = false;
        let shouldCheck = false;

        switch(reminder.type) {
            case 'daily':
                shouldCheck = true;
                break;
            case 'monthly':
                if (currentDate === reminder.day) {
                    shouldCheck = true;
                }
                break;
            case 'dateRange':
                if (currentDate >= reminder.startDate && currentDate <= reminder.endDate) {
                    shouldCheck = true;
                }
                break;
        }

        if (!shouldCheck) return;

        // 检查是否在时间段内
        if (currentTime >= reminder.startTime && currentTime <= reminder.endTime) {
            inTimeRange = true;
        }

        if (!inTimeRange) return;

        // 检查用户是否已经点击"已知晓"
        const acknowledgedKey = `reminder_${reminder.id}_${todayKey}_acknowledged`;
        if (localStorage.getItem(acknowledgedKey)) return;

        // 检查是否需要提醒
        const reminderKey = `reminder_${reminder.id}_${todayKey}_${currentTime}`;

        // 如果不启用重复提醒，检查今天是否已经提醒过
        if (!reminder.repeat) {
            const todayReminded = localStorage.getItem(`reminder_${reminder.id}_${todayKey}`);
            if (todayReminded) return;
        } else {
            // 如果启用重复提醒，检查当前分钟是否已经提醒过
            if (localStorage.getItem(reminderKey)) return;
        }

        // 显示提醒通知
        showReminderNotification(reminder);

        // 记录提醒状态
        if (reminder.repeat) {
            // 重复提醒：记录当前分钟
            localStorage.setItem(reminderKey, 'true');
            // 5分钟后清除记录（允许下次提醒）
            setTimeout(() => {
                localStorage.removeItem(reminderKey);
            }, reminder.repeatInterval * 60 * 1000);
        } else {
            // 不重复：记录今天已提醒
            localStorage.setItem(`reminder_${reminder.id}_${todayKey}`, 'true');
        }
    });
}

/**
 * 显示提醒通知
 */
function showReminderNotification(reminder) {
    const notification = document.getElementById('reminderNotification');
    const notificationBody = document.getElementById('reminderNotificationBody');

    notificationBody.textContent = reminder.title;
    notification.classList.add('show');

    // 保存当前提醒ID
    notification.dataset.reminderId = reminder.id;

    // 使用浏览器通知（如果允许）
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('提醒', {
            body: reminder.title,
            icon: '../assets/images/favicon.png'
        });
    }
}

/**
 * 关闭提醒通知
 */
function closeReminderNotification() {
    const notification = document.getElementById('reminderNotification');
    notification.classList.remove('show');
}

/**
 * 稍后提醒（推迟5分钟）
 */
function snoozeReminder() {
    const notification = document.getElementById('reminderNotification');
    const reminderId = parseInt(notification.dataset.reminderId);
    
    closeReminderNotification();
    
    // 5分钟后再次提醒
    const reminder = reminders.find(r => r.id === reminderId);
    if (reminder && reminder.repeat) {
        setTimeout(() => {
            showReminderNotification(reminder);
        }, 5 * 60 * 1000);
    }
}

/**
 * 已知晓（停止重复提醒）
 */
function acknowledgeReminder() {
    const notification = document.getElementById('reminderNotification');
    const reminderId = parseInt(notification.dataset.reminderId);
    const todayKey = new Date().toDateString();
    
    closeReminderNotification();
    
    // 记录今天已知晓，不再重复提醒
    localStorage.setItem(`reminder_${reminderId}_${todayKey}_acknowledged`, 'true');
}

/**
 * 更新倒计时组件
 */
function updateCountdownWidget() {
    const container = document.getElementById('reminderCountdownsContainer');

    // 清除旧的定时器
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }

    // 清空容器
    container.innerHTML = '';

    // 获取当前时间
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM
    const currentDate = now.getDate();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // 1. 查找所有事件倒计时（countdown类型，启用且显示在左下角）
    const countdownReminders = reminders.filter(r =>
        r.type === 'countdown' && r.enabled && r.showInCorner
    );

    // 2. 查找其他类型的提醒（每日、月度、日期范围）
    const otherReminders = [];

    reminders.forEach(reminder => {
        if (!reminder.enabled) return;
        if (reminder.type === 'countdown') return; // 跳过事件倒计时

        let targetDateTime = null;

        switch(reminder.type) {
            case 'daily':
                // 每日提醒：计算今天的结束时间
                const [dailyEndHours, dailyEndMinutes] = reminder.endTime.split(':');
                targetDateTime = new Date();
                targetDateTime.setHours(parseInt(dailyEndHours), parseInt(dailyEndMinutes), 0, 0);
                
                // 如果今天的时间已经过了，计算明天的结束时间
                if (targetDateTime <= now) {
                    targetDateTime.setDate(targetDateTime.getDate() + 1);
                }
                break;
                
            case 'monthly':
                // 月度提醒：计算本月或下月的结束时间
                const [monthlyEndHours, monthlyEndMinutes] = reminder.endTime.split(':');
                targetDateTime = new Date();
                targetDateTime.setHours(parseInt(monthlyEndHours), parseInt(monthlyEndMinutes), 0, 0);
                targetDateTime.setDate(reminder.day);
                
                // 如果本月的日期已经过了，计算下月
                if (targetDateTime <= now) {
                    targetDateTime.setMonth(targetDateTime.getMonth() + 1);
                }
                break;
                
            case 'dateRange':
                // 日期范围提醒：计算范围内最后一天的结束时间
                const [rangeEndHours, rangeEndMinutes] = reminder.endTime.split(':');
                targetDateTime = new Date();
                targetDateTime.setHours(parseInt(rangeEndHours), parseInt(rangeEndMinutes), 0, 0);
                targetDateTime.setDate(reminder.endDate);
                
                // 如果本月最后一天已经过了，计算下月
                if (targetDateTime <= now) {
                    targetDateTime.setMonth(targetDateTime.getMonth() + 1);
                }
                break;
        }

        if (targetDateTime) {
            otherReminders.push({
                ...reminder,
                targetDateTime
            });
        }
    });

    // 按创建时间排序，优先显示最早创建的
    otherReminders.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    // 3. 创建事件倒计时卡片（在按钮上方）
    if (countdownReminders.length > 0) {
        // 只显示第一个事件倒计时
        const reminder = countdownReminders[0];
        const card = document.createElement('div');
        card.className = 'reminder-countdown-card countdown-main';
        card.id = 'countdownWidget';

        const title = document.createElement('div');
        title.className = 'reminder-countdown-title';
        title.textContent = reminder.title;

        const timer = document.createElement('div');
        timer.className = 'reminder-countdown-timer';
        timer.id = `countdown-${reminder.id}`;

        card.appendChild(title);
        card.appendChild(timer);
        container.appendChild(card);
    }

    // 4. 创建其他提醒卡片（在按钮右侧）
    if (otherReminders.length > 0) {
        // 只显示第一个其他提醒
        const reminder = otherReminders[0];
        const card = document.createElement('div');
        card.className = 'reminder-countdown-card countdown-side';

        const title = document.createElement('div');
        title.className = 'reminder-countdown-title';
        title.textContent = reminder.title;

        const timer = document.createElement('div');
        timer.className = 'reminder-countdown-timer';
        timer.id = `side-countdown-${reminder.id}`;
        timer.style.fontSize = '14px'; // 稍微小一点的字体
        timer.style.color = '#667eea';
        timer.style.whiteSpace = 'nowrap'; // 不换行

        card.appendChild(title);
        card.appendChild(timer);
        container.appendChild(card);
    }

    // 如果没有任何内容显示，直接返回
    if (countdownReminders.length === 0 && otherReminders.length === 0) {
        return;
    }

    // 同步宽度：让按钮右侧的卡片宽度完全跟随按钮上方的卡片宽度
    const syncWidth = () => {
        const mainCard = document.querySelector('.reminder-countdown-card.countdown-main');
        const sideCard = document.querySelector('.reminder-countdown-card.countdown-side');
        
        if (mainCard && sideCard) {
            const mainWidth = mainCard.offsetWidth;
            sideCard.style.width = mainWidth + 'px';
            sideCard.style.minWidth = mainWidth + 'px';
            sideCard.style.maxWidth = mainWidth + 'px';
        }
    };

    // 更新倒计时
    const updateTimers = () => {
        // 更新事件倒计时
        countdownReminders.forEach(reminder => {
            const timerEl = document.getElementById(`countdown-${reminder.id}`);
            if (!timerEl) return;

            const target = new Date(`${reminder.targetDate}T${reminder.targetTime}`);
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
            
            // 每次更新时同步宽度
            syncWidth();
        });

        // 更新其他提醒的倒计时
        if (otherReminders.length > 0) {
            const reminder = otherReminders[0];
            const timerEl = document.getElementById(`side-countdown-${reminder.id}`);
            if (timerEl) {
                const now = new Date();
                const diff = reminder.targetDateTime - now;

                if (diff <= 0) {
                    timerEl.textContent = '已到达！';
                    return;
                }

                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);

                timerEl.textContent = `${days}天 ${hours}小时 ${minutes}分 ${seconds}秒`;
            }
        }
    };

    updateTimers();
    countdownInterval = setInterval(updateTimers, 1000);
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
