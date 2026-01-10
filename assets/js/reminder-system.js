/**
 * 提醒系统完整代码
 * 功能：每日提醒、月度提醒、日期范围提醒、事件倒计时
 * 数据存储：localStorage
 */

// ==================== 注入样式到页面 ====================
function injectReminderStyles() {
    const style = document.createElement('style');
    style.textContent = `
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
            from { transform: translateY(-30px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
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

        .reminder-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .reminder-modal-title {
            font-family: "HarmonyOS Sans", "PingFang SC", sans-serif;
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

        .reminder-modal-close:hover { color: #e0e0e0; }

        .reminder-modal-body {
            padding: 24px;
            overflow-y: auto;
            max-height: calc(85vh - 80px);
        }

        .reminder-form {
            margin-bottom: 24px;
            padding-bottom: 24px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .form-group { margin-bottom: 16px; }

        .form-group label {
            display: block;
            font-family: "HarmonyOS Sans", "PingFang SC", sans-serif;
            font-size: 14px;
            font-weight: 500;
            color: #cbd5e0;
            margin-bottom: 8px;
        }

        .form-group input, .form-group select {
            width: 100%;
            padding: 10px 14px;
            border: 1px solid rgba(0, 0, 0, 0.2);
            border-radius: 10px;
            font-family: "HarmonyOS Sans", "PingFang SC", sans-serif;
            font-size: 14px;
            color: #e0e0e0;
            background: rgba(255, 255, 255, 0.05);
            transition: all 0.2s;
        }

        .form-group input:focus, .form-group select:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .form-group select option {
            background: #2a2a2a;
            color: #e0e0e0;
        }

        .form-group input[type="checkbox"] {
            width: auto;
            margin-right: 8px;
        }

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

        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff;
            border: none;
            border-radius: 10px;
            padding: 12px 24px;
            font-family: "HarmonyOS Sans", "PingFang SC", sans-serif;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.35);
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(102, 126, 234, 0.45);
        }

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
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }

        .reminder-notification.show { display: block; }

        .reminder-notification-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }

        .reminder-notification-title {
            font-family: "HarmonyOS Sans", "PingFang SC", sans-serif;
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
        }

        .reminder-notification-body {
            font-family: "HarmonyOS Sans", "PingFang SC", sans-serif;
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
            font-family: "HarmonyOS Sans", "PingFang SC", sans-serif;
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

        .reminder-notification-btn-secondary {
            background: rgba(255, 255, 255, 0.05);
            color: #cbd5e0;
        }

        .reminder-list-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            font-family: "HarmonyOS Sans", "PingFang SC", sans-serif;
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
            align-items: flex-start;
            gap: 12px;
            padding: 16px;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.02);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
            transition: all 0.3s;
            border: 1px solid rgba(0, 0, 0, 0.08);
        }

        .reminder-item:hover {
            transform: translateY(-6px);
            box-shadow: 0 14px 32px rgba(0, 0, 0, 0.55);
        }

        .reminder-item.disabled { opacity: 0.5; }

        .reminder-item-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .reminder-item-title {
            font-family: "HarmonyOS Sans", "PingFang SC", sans-serif;
            font-size: 15px;
            font-weight: 600;
            color: #e0e0e0;
            margin-bottom: 4px;
        }

        .reminder-item-detail {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            font-size: 13px;
            color: #a0aec0;
            line-height: 1.4;
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
            flex-shrink: 0;
        }

        .reminder-toggle-btn, .reminder-delete-btn {
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            transition: all 0.2s;
        }

        .reminder-toggle-btn:hover {
            background: rgba(102, 126, 234, 0.1);
        }

        .reminder-delete-btn:hover {
            background: rgba(239, 68, 68, 0.1);
        }

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
            transition: all 0.3s;
            z-index: 9999;
            border: none;
            font-size: 20px;
        }

        #reminderBtn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(102, 126, 234, 0.5);
        }

        .reminder-countdown-card.countdown-main {
            position: fixed;
            bottom: 84px;
            left: 24px;
            padding: 16px 20px;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.02);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
            transition: all 0.3s;
            border: 1px solid rgba(0, 0, 0, 0.08);
            animation: countdownPulse 2s infinite;
            min-width: 180px;
            width: auto;
            z-index: 9998;
        }

        .reminder-countdown-card.countdown-side {
            position: fixed;
            bottom: 24px;
            padding: 12px 16px;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.02);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
            transition: all 0.3s;
            border: 1px solid rgba(0, 0, 0, 0.08);
            box-sizing: border-box;
            z-index: 9998;
        }

        .reminder-countdown-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45);
        }

        @keyframes countdownPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.02); }
        }

        .reminder-countdown-title {
            font-family: "HarmonyOS Sans", "PingFang SC", sans-serif;
            font-size: 11px;
            font-weight: 600;
            color: #a0aec0;
            margin-bottom: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .reminder-countdown-timer {
            font-family: "HarmonyOS Sans", "PingFang SC", sans-serif;
            font-size: 14px;
            font-weight: 700;
            color: #e0e0e0;
            word-break: break-all;
            line-height: 1.3;
        }

        /* 空状态样式 */
        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: #718096;
            font-family: "HarmonyOS Sans", "PingFang SC", sans-serif;
            font-size: 14px;
        }

        /* 滚动条样式 */
        .reminder-modal-body::-webkit-scrollbar {
            width: 6px;
        }

        .reminder-modal-body::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 3px;
        }

        .reminder-modal-body::-webkit-scrollbar-thumb {
            background: rgba(102, 126, 234, 0.5);
            border-radius: 3px;
        }

        .reminder-modal-body::-webkit-scrollbar-thumb:hover {
            background: rgba(102, 126, 234, 0.7);
        }

        /* 工具类 */
        .text-truncate {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .d-flex {
            display: flex;
        }

        .align-center {
            align-items: center;
        }

        .justify-between {
            justify-content: space-between;
        }

        /* 改进的动画效果 */
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }

        .reminder-item {
            animation: slideUp 0.3s ease-out;
        }

        /* 改进的表单焦点状态 */
        .form-group input:focus, .form-group select:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            transform: translateY(-1px);
        }

        /* 改进的按钮点击效果 */
        .btn-primary:active {
            transform: translateY(0);
            box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
        }

        /* 改进的卡片悬停效果 */
        .reminder-item:hover {
            transform: translateY(-6px);
            box-shadow: 0 14px 32px rgba(0, 0, 0, 0.55);
            border-color: rgba(102, 126, 234, 0.3);
        }

        /* 改进的倒计时卡片样式 */
        .reminder-countdown-card {
            backdrop-filter: blur(10px);
        }

        /* 改进的通知样式 */
        .reminder-notification {
            backdrop-filter: blur(10px);
        }

        @media (max-width: 768px) {
            #reminderBtn, .reminder-modal-overlay, .reminder-countdown-card {
                display: none !important;
            }
        }
    `;
    document.head.appendChild(style);
}

function injectReminderHTML() {
    if (document.getElementById('reminderBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'reminderBtn';
    btn.onclick = openReminderModal;
    btn.title = '提醒管理';
    btn.textContent = '🔔';
    document.body.appendChild(btn);

    const modal = `
        <div class="reminder-modal-overlay" id="reminderModal">
            <div class="reminder-modal-dialog">
                <div class="reminder-modal-header">
                    <div class="reminder-modal-title">📅 提醒管理</div>
                    <button class="reminder-modal-close" onclick="closeReminderModal()">✕</button>
                </div>
                <div class="reminder-modal-body">
                    <div class="reminder-form">
                        <div class="form-group">
                            <label>提醒标题</label>
                            <input type="text" id="reminderTitle" placeholder="例如：缴纳电费、春节倒计时">
                        </div>
                        <div class="form-group">
                            <label>提醒类型</label>
                            <select id="reminderType" onchange="handleReminderTypeChange()">
                                <option value="daily">每日提醒</option>
                                <option value="monthly">月度提醒</option>
                                <option value="dateRange">日期范围提醒</option>
                                <option value="countdown">事件倒计时</option>
                            </select>
                        </div>
                        <div id="dailyOption">
                            <div class="form-group">
                                <label>提醒时间段</label>
                                <div class="time-range-group">
                                    <div class="form-group"><input type="time" id="dailyStartTime" value="09:00"></div>
                                    <span class="time-range-separator">至</span>
                                    <div class="form-group"><input type="time" id="dailyEndTime" value="18:00"></div>
                                </div>
                            </div>
                            <div class="form-group">
                                <label style="display: flex; align-items: center; gap: 8px;">
                                    <input type="checkbox" id="dailyRepeat" checked>启用重复提醒
                                </label>
                                <div class="repeat-settings">
                                    <label style="font-size: 13px; color: #718096;">重复间隔（分钟）</label>
                                    <div class="repeat-interval-group">
                                        <input type="number" id="dailyRepeatInterval" min="1" value="5">
                                        <span style="color: #718096;">分钟</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div id="monthlyOption" style="display: none;">
                            <div class="form-group">
                                <label>每月几号</label>
                                <input type="number" id="monthlyDate" min="1" max="31" value="1">
                            </div>
                            <div class="form-group">
                                <label>提醒时间段</label>
                                <div class="time-range-group">
                                    <div class="form-group"><input type="time" id="monthlyStartTime" value="09:00"></div>
                                    <span class="time-range-separator">至</span>
                                    <div class="form-group"><input type="time" id="monthlyEndTime" value="18:00"></div>
                                </div>
                            </div>
                            <div class="form-group">
                                <label style="display: flex; align-items: center; gap: 8px;">
                                    <input type="checkbox" id="monthlyRepeat" checked>启用重复提醒
                                </label>
                                <div class="repeat-settings">
                                    <label style="font-size: 13px; color: #718096;">重复间隔（分钟）</label>
                                    <div class="repeat-interval-group">
                                        <input type="number" id="monthlyRepeatInterval" min="1" value="5">
                                        <span style="color: #718096;">分钟</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div id="dateRangeOption" style="display: none;">
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
                                    <div class="form-group"><input type="time" id="rangeStartTime" value="09:00"></div>
                                    <span class="time-range-separator">至</span>
                                    <div class="form-group"><input type="time" id="rangeEndTime" value="18:00"></div>
                                </div>
                            </div>
                            <div class="form-group">
                                <label style="display: flex; align-items: center; gap: 8px;">
                                    <input type="checkbox" id="rangeRepeat" checked>启用重复提醒
                                </label>
                                <div class="repeat-settings">
                                    <label style="font-size: 13px; color: #718096;">重复间隔（分钟）</label>
                                    <div class="repeat-interval-group">
                                        <input type="number" id="rangeRepeatInterval" min="1" value="5">
                                        <span style="color: #718096;">分钟</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div id="countdownOption" style="display: none;">
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
                                    <input type="checkbox" id="showInCorner" checked>在左下角显示倒计时
                                </label>
                            </div>
                        </div>
                        <button class="btn btn-primary" onclick="addReminder()" style="width: 100%; margin-top: 10px;">
                            ➕ 添加提醒
                        </button>
                    </div>
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
        <div class="reminder-notification" id="reminderNotification">
            <div class="reminder-notification-header">
                <div class="reminder-notification-title">🔔 提醒</div>
                <button class="reminder-notification-close" onclick="closeReminderNotification()">✕</button>
            </div>
            <div class="reminder-notification-body" id="reminderNotificationBody">您有一个提醒需要处理</div>
            <div class="reminder-notification-actions">
                <button class="reminder-notification-btn reminder-notification-btn-secondary" onclick="snoozeReminder()">稍后提醒</button>
                <button class="reminder-notification-btn reminder-notification-btn-primary" onclick="acknowledgeReminder()">已知晓</button>
            </div>
        </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = modal;
    while (div.firstChild) document.body.appendChild(div.firstChild);
}

const REMINDER_STORAGE_KEY = 'webstack_reminders';
let reminders = [];
let countdownInterval = null;
let resizeListener = null;

function initReminderSystem() {
    injectReminderStyles();
    injectReminderHTML();
    loadReminders();
    renderReminderList();
    startReminderCheck();
    updateCountdownWidget();
}

function loadReminders() {
    try {
        const data = localStorage.getItem(REMINDER_STORAGE_KEY);
        if (data) reminders = JSON.parse(data);
    } catch (e) {
        reminders = [];
    }
}

function saveReminders() {
    try {
        localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(reminders));
    } catch (e) {
        console.error('保存失败');
    }
}

function openReminderModal() {
    document.getElementById('reminderModal').style.display = 'flex';
    renderReminderList();
}

function closeReminderModal() {
    document.getElementById('reminderModal').style.display = 'none';
}

function handleReminderTypeChange() {
    const type = document.getElementById('reminderType').value;
    document.getElementById('dailyOption').style.display = 'none';
    document.getElementById('monthlyOption').style.display = 'none';
    document.getElementById('dateRangeOption').style.display = 'none';
    document.getElementById('countdownOption').style.display = 'none';
    if (type === 'daily') document.getElementById('dailyOption').style.display = 'block';
    if (type === 'monthly') document.getElementById('monthlyOption').style.display = 'block';
    if (type === 'dateRange') document.getElementById('dateRangeOption').style.display = 'block';
    if (type === 'countdown') document.getElementById('countdownOption').style.display = 'block';
}

function addReminder() {
    const title = document.getElementById('reminderTitle').value.trim();
    const type = document.getElementById('reminderType').value;
    if (!title) { alert('请输入标题'); return; }
    
    const r = { id: Date.now(), title, type, enabled: true, createdAt: new Date().toISOString() };
    
    if (type === 'daily') {
        r.startTime = document.getElementById('dailyStartTime').value;
        r.endTime = document.getElementById('dailyEndTime').value;
        r.repeat = document.getElementById('dailyRepeat').checked;
        r.repeatInterval = r.repeat ? parseInt(document.getElementById('dailyRepeatInterval').value) : 0;
    } else if (type === 'monthly') {
        r.day = parseInt(document.getElementById('monthlyDate').value);
        r.startTime = document.getElementById('monthlyStartTime').value;
        r.endTime = document.getElementById('monthlyEndTime').value;
        r.repeat = document.getElementById('monthlyRepeat').checked;
        r.repeatInterval = r.repeat ? parseInt(document.getElementById('monthlyRepeatInterval').value) : 0;
    } else if (type === 'dateRange') {
        r.startDate = parseInt(document.getElementById('rangeStartDate').value);
        r.endDate = parseInt(document.getElementById('rangeEndDate').value);
        // 验证日期范围
        if (r.startDate < 1 || r.startDate > 31 || r.endDate < 1 || r.endDate > 31) {
            alert('日期必须在 1-31 之间');
            return;
        }
        r.startTime = document.getElementById('rangeStartTime').value;
        r.endTime = document.getElementById('rangeEndTime').value;
        r.repeat = document.getElementById('rangeRepeat').checked;
        r.repeatInterval = r.repeat ? parseInt(document.getElementById('rangeRepeatInterval').value) : 0;
    } else if (type === 'countdown') {
        r.targetDate = document.getElementById('countdownDate').value;
        r.targetTime = document.getElementById('countdownTime').value;
        r.showInCorner = document.getElementById('showInCorner').checked;
    }
    
    reminders.push(r);
    saveReminders();
    renderReminderList();
    updateCountdownWidget();
    document.getElementById('reminderTitle').value = '';
    alert('添加成功！');
}

function deleteReminder(id) {
    if (confirm('确定删除？')) {
        reminders = reminders.filter(r => r.id !== id);
        saveReminders();
        renderReminderList();
        updateCountdownWidget();
    }
}

function toggleReminder(id) {
    const r = reminders.find(r => r.id === id);
    if (r) {
        r.enabled = !r.enabled;
        saveReminders();
        renderReminderList();
        updateCountdownWidget();
    }
}

function renderReminderList() {
    const container = document.getElementById('reminderList');
    document.getElementById('reminderCount').textContent = reminders.length;
    
    if (reminders.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无提醒</div>';
        return;
    }
    
    const labels = { daily: '每日', monthly: '月度', dateRange: '范围', countdown: '倒计时' };
    
    container.innerHTML = reminders.map(r => {
        let detail = '';
        if (r.type === 'daily') detail = `每天 ${r.startTime}-${r.endTime}${r.repeat ? ` | 每${r.repeatInterval}分钟` : ''}`;
        if (r.type === 'monthly') detail = `每月${r.day}号 ${r.startTime}-${r.endTime}${r.repeat ? ` | 每${r.repeatInterval}分钟` : ''}`;
        if (r.type === 'dateRange') detail = `${r.startDate}-${r.endDate}号 ${r.startTime}-${r.endTime}${r.repeat ? ` | 每${r.repeatInterval}分钟` : ''}`;
        if (r.type === 'countdown') detail = `${r.targetDate} ${r.targetTime}`;
        
        return `
            <div class="reminder-item ${r.enabled ? '' : 'disabled'}">
                <div class="reminder-item-content">
                    <div class="reminder-item-title">${r.title}</div>
                    <div class="reminder-item-detail">
                        <span class="reminder-type-badge">${labels[r.type]}</span>
                        <span>${detail}</span>
                    </div>
                </div>
                <div class="reminder-item-actions">
                    <button class="reminder-toggle-btn" onclick="toggleReminder(${r.id})">${r.enabled ? '🔔' : '🔕'}</button>
                    <button class="reminder-delete-btn" onclick="deleteReminder(${r.id})">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

function startReminderCheck() {
    setInterval(checkReminders, 60000);
    checkReminders();
    
    // 定期清理过期的 localStorage 数据
    setInterval(cleanupOldStorageData, 24 * 60 * 60 * 1000); // 每天清理一次
    cleanupOldStorageData(); // 启动时立即清理一次
}

function cleanupOldStorageData() {
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();
    
    // 清理昨天的提醒记录
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        // 清理昨天的每日提醒记录
        if (key && key.includes('_' + yesterdayStr + '_')) {
            localStorage.removeItem(key);
            i--; // 调整索引，因为删除了元素
        }
        // 清理已删除提醒的相关数据
        if (key && key.startsWith('reminder_')) {
            const idMatch = key.match(/reminder_(\d+)_/);
            if (idMatch) {
                const id = parseInt(idMatch[1]);
                const reminderExists = reminders.some(r => r.id === id);
                if (!reminderExists) {
                    localStorage.removeItem(key);
                    i--;
                }
            }
        }
    }
}

function checkReminders() {
    const now = new Date();
    const currentDate = now.getDate();
    const currentTime = now.toTimeString().slice(0, 5);
    const todayKey = now.toDateString();
    
    reminders.forEach(r => {
        if (!r.enabled || r.type === 'countdown') return;
        
        let shouldCheck = false;
        if (r.type === 'daily') shouldCheck = true;
        if (r.type === 'monthly' && currentDate === r.day) shouldCheck = true;
        if (r.type === 'dateRange') {
            // 支持跨月范围：如果 startDate > endDate，说明是跨月的（例如：28号到5号）
            if (r.startDate <= r.endDate) {
                shouldCheck = currentDate >= r.startDate && currentDate <= r.endDate;
            } else {
                shouldCheck = currentDate >= r.startDate || currentDate <= r.endDate;
            }
        }
        
        if (!shouldCheck) return;
        if (currentTime < r.startTime || currentTime > r.endTime) return;
        
        const ackKey = `reminder_${r.id}_${todayKey}_acknowledged`;
        if (localStorage.getItem(ackKey)) return;
        
        const timeKey = `reminder_${r.id}_${todayKey}_${currentTime}`;
        if (!r.repeat && localStorage.getItem(`reminder_${r.id}_${todayKey}`)) return;
        if (r.repeat && localStorage.getItem(timeKey)) return;
        
        showReminderNotification(r);
        
        if (r.repeat) {
            localStorage.setItem(timeKey, 'true');
            setTimeout(() => localStorage.removeItem(timeKey), r.repeatInterval * 60000);
        } else {
            localStorage.setItem(`reminder_${r.id}_${todayKey}`, 'true');
        }
    });
}

function showReminderNotification(r) {
    const n = document.getElementById('reminderNotification');
    document.getElementById('reminderNotificationBody').textContent = r.title;
    n.classList.add('show');
    n.dataset.reminderId = r.id;
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('提醒', { body: r.title });
    }
}

function closeReminderNotification() {
    document.getElementById('reminderNotification').classList.remove('show');
}

function snoozeReminder() {
    const n = document.getElementById('reminderNotification');
    const id = parseInt(n.dataset.reminderId);
    closeReminderNotification();
    const r = reminders.find(r => r.id === id);
    if (r?.repeat) setTimeout(() => showReminderNotification(r), 300000);
}

function acknowledgeReminder() {
    const n = document.getElementById('reminderNotification');
    const id = parseInt(n.dataset.reminderId);
    closeReminderNotification();
    localStorage.setItem(`reminder_${id}_${new Date().toDateString()}_acknowledged`, 'true');
}

function updateCountdownWidget() {
    if (countdownInterval) clearInterval(countdownInterval);
    
    const mainCard = document.querySelector('.reminder-countdown-card.countdown-main');
    const sideCard = document.querySelector('.reminder-countdown-card.countdown-side');
    if (mainCard) mainCard.remove();
    if (sideCard) sideCard.remove();
    
    const now = new Date();
    const countdowns = reminders.filter(r => r.type === 'countdown' && r.enabled && r.showInCorner);
    const others = [];
    
    reminders.forEach(r => {
        if (!r.enabled || r.type === 'countdown') return;
        let target = null;
        if (r.type === 'daily') {
            const [h, m] = r.endTime.split(':');
            target = new Date();
            target.setHours(parseInt(h), parseInt(m), 0, 0);
            if (target <= now) target.setDate(target.getDate() + 1);
        }
        if (r.type === 'monthly') {
            const [h, m] = r.endTime.split(':');
            target = new Date();
            target.setHours(parseInt(h), parseInt(m), 0, 0);
            target.setDate(1); // 先设置为每月1号
            target.setMonth(target.getMonth() + (target.getDate() > r.day ? 1 : 0)); // 如果当前日期大于目标日期，加一个月
            const daysInMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate(); // 获取该月的天数
            target.setDate(Math.min(r.day, daysInMonth)); // 使用目标日期和该月天数的较小值
            if (target <= now) {
                target.setMonth(target.getMonth() + 1);
                const daysInNextMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
                target.setDate(Math.min(r.day, daysInNextMonth));
            }
        }
        if (r.type === 'dateRange') {
            const [h, m] = r.endTime.split(':');
            target = new Date();
            target.setHours(parseInt(h), parseInt(m), 0, 0);
            target.setDate(r.endDate);
            if (target <= now) target.setMonth(target.getMonth() + 1);
        }
        if (target) others.push({ ...r, targetDateTime: target });
    });
    
    others.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    if (countdowns.length > 0) {
        const r = countdowns[0];
        const card = document.createElement('div');
        card.className = 'reminder-countdown-card countdown-main';
        card.innerHTML = `
            <div class="reminder-countdown-title">${r.title}</div>
            <div class="reminder-countdown-timer" id="countdown-${r.id}"></div>
        `;
        document.body.appendChild(card);
    }
    
    if (others.length > 0) {
        const r = others[0];
        const card = document.createElement('div');
        card.className = 'reminder-countdown-card countdown-side';
        card.innerHTML = `
            <div class="reminder-countdown-title">${r.title}</div>
            <div class="reminder-countdown-timer" id="side-countdown-${r.id}" style="font-size: 14px; color: #667eea;"></div>
        `;
        document.body.appendChild(card);
    }
    
    if (countdowns.length === 0 && others.length === 0) return;
    
    const sync = () => {
        const main = document.querySelector('.reminder-countdown-card.countdown-main');
        const side = document.querySelector('.reminder-countdown-card.countdown-side');
        const btn = document.getElementById('reminderBtn');
        if (main && side && btn) {
            const w = main.offsetWidth;
            side.style.width = w + 'px';
            const btnRect = btn.getBoundingClientRect();
            const mainRect = main.getBoundingClientRect();
            side.style.left = (mainRect.right - btnRect.left + 24 + 12) + 'px';
        }
    };
    
    const update = () => {
        countdowns.forEach(r => {
            const el = document.getElementById(`countdown-${r.id}`);
            if (!el) return;
            const target = new Date(`${r.targetDate}T${r.targetTime}`);
            const diff = target - new Date();
            if (diff <= 0) { el.textContent = '已到达！'; return; }
            const d = Math.floor(diff / 86400000);
            const h = Math.floor((diff % 86400000) / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            el.textContent = `${d}天 ${h}小时 ${m}分 ${s}秒`;
            sync();
        });
        
        if (others.length > 0) {
            const r = others[0];
            const el = document.getElementById(`side-countdown-${r.id}`);
            if (el) {
                const diff = r.targetDateTime - new Date();
                if (diff <= 0) { el.textContent = '已到达！'; return; }
                const d = Math.floor(diff / 86400000);
                const h = Math.floor((diff % 86400000) / 3600000);
                const m = Math.floor((diff % 3600000) / 60000);
                const s = Math.floor((diff % 60000) / 1000);
                el.textContent = `${d}天 ${h}小时 ${m}分 ${s}秒`;
            }
        }
    };
    
    update();
    countdownInterval = setInterval(update, 1000);
    setTimeout(sync, 100);
    
    // 移除旧的 resize 监听器（防止内存泄漏）
    if (resizeListener) {
        window.removeEventListener('resize', resizeListener);
    }
    resizeListener = sync;
    window.addEventListener('resize', resizeListener);
}

document.addEventListener('DOMContentLoaded', () => {
    initReminderSystem();
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});
