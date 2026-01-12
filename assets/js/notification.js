/**
 * 提醒系统 - 完整版
 * 功能：倒计时、定时提醒、定期提醒、事件倒计时
 * 作者：iFlow CLI
 * 日期：2026-01-10
 */

// ==================== 全局变量 ====================
let reminders = []; // 提醒列表
let reminderTimers = {}; // 定时器对象
let checkInterval = null; // 检查提醒的定时器
let deviceId = null; // 设备唯一标识符
let db = null; // IndexedDB 数据库实例

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', function() {
    initDeviceId(); // 初始化设备ID
    initIndexedDB().then(() => {
        loadReminders(); // 加载保存的提醒
        updateReminderList(); // 更新提醒列表显示
        startReminderCheck(); // 开始检查提醒
    });
    updateDateTime(); // 更新时间日期
    setInterval(updateDateTime, 1000); // 每秒更新时间
    initNotificationCenterEvents(); // 初始化通知中心事件监听
});

// ==================== 更新时间日期 ====================
function updateDateTime() {
    const now = new Date();
    const dateElement = document.getElementById('currentDate');
    const timeElement = document.getElementById('currentTime');

    if (dateElement && timeElement) {
        // 格式化日期：2026年1月10日 星期六
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const date = now.getDate();
        const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        const day = days[now.getDay()];

        dateElement.textContent = `${year}年${month}月${date}日 ${day}`;

        // 格式化时间：14:30:45
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');

        timeElement.textContent = `${hours}:${minutes}:${seconds}`;
    }
}

// ==================== 切换通知中心面板 ====================
function toggleNotificationCenter() {
    const panel = document.getElementById('notificationPanel');
    if (panel.style.display === 'flex') {
        closeNotificationCenter();
    } else {
        panel.style.display = 'flex';
    }
}

// ==================== 关闭通知中心面板 ====================
function closeNotificationCenter() {
    const panel = document.getElementById('notificationPanel');
    panel.style.display = 'none';
}

// ==================== 初始化通知中心事件监听 ====================
function initNotificationCenterEvents() {
    // 阻止点击通知中心面板时冒泡到文档
    const panel = document.getElementById('notificationPanel');
    if (panel) {
        panel.addEventListener('click', function(event) {
            event.stopPropagation();
        });
    }
}

// 在页面加载时初始化事件监听
document.addEventListener('DOMContentLoaded', function() {
    initNotificationCenterEvents();
});

// ==================== 切换状态分类的展开/收起 ====================
function toggleSection(section) {
    const list = document.getElementById(section + 'ReminderList');
    const arrow = document.getElementById(section + 'Arrow');

    if (list.classList.contains('collapsed')) {
        // 展开
        list.classList.remove('collapsed');
        arrow.classList.remove('collapsed');
    } else {
        // 收起
        list.classList.add('collapsed');
        arrow.classList.add('collapsed');
    }
}

// ==================== 切换提醒类型 ====================
function toggleReminderType() {
    const types = document.getElementsByName('reminderType');
    let selectedType = 'countdown';

    for (let type of types) {
        if (type.checked) {
            selectedType = type.value;
            break;
        }
    }

    // 隐藏所有设置
    document.getElementById('countdownSetting').style.display = 'none';
    document.getElementById('scheduleSetting').style.display = 'none';
    document.getElementById('repeatSetting').style.display = 'none';
    document.getElementById('eventSetting').style.display = 'none';

    // 显示选中的设置
    document.getElementById(selectedType + 'Setting').style.display = 'block';
}

// ==================== 添加提醒 ====================
function addReminder() {
    const input = document.getElementById('reminderInput');
    const content = input.value.trim();

    // 验证输入
    if (!content) {
        showToast('请输入提醒内容！', 'error');
        return;
    }

    // 获取选中的提醒类型
    const types = document.getElementsByName('reminderType');
    let selectedType = 'countdown';

    for (let type of types) {
        if (type.checked) {
            selectedType = type.value;
            break;
        }
    }

    let reminder = {
        id: Date.now(),
        content: content,
        type: selectedType,
        createTime: new Date().getTime(),
        active: true
    };

    // 根据类型设置不同的参数
    switch (selectedType) {
        case 'countdown':
            const minutes = parseInt(document.getElementById('reminderTime').value);
            reminder.minutes = minutes;
            reminder.endTime = new Date().getTime() + minutes * 60 * 1000;
            reminder.displayText = `${minutes}分钟后`;
            break;

        case 'schedule':
            const scheduleTime = document.getElementById('scheduleTime').value;
            const scheduleRepeat = document.getElementById('scheduleRepeat').value;
            reminder.time = scheduleTime;
            reminder.repeat = scheduleRepeat;
            reminder.nextTrigger = calculateNextScheduleTrigger(scheduleTime, scheduleRepeat);
            reminder.displayText = `${scheduleTime} (${getRepeatText(scheduleRepeat)})`;
            break;

        case 'repeat':
            const startDay = parseInt(document.getElementById('repeatStartDay').value);
            const endDay = parseInt(document.getElementById('repeatEndDay').value);
            reminder.startDay = startDay;
            reminder.endDay = endDay;
            reminder.nextTrigger = calculateNextRepeatTrigger(startDay, endDay);
            reminder.displayText = `每月${startDay}-${endDay}号`;
            break;

        case 'event':
            const eventDate = document.getElementById('eventDate').value;
            const eventTime = document.getElementById('eventTime').value;
            if (!eventDate) {
                showToast('请选择事件日期！', 'error');
                return;
            }
            reminder.eventDate = eventDate;
            reminder.eventTime = eventTime;
            reminder.endTime = new Date(`${eventDate}T${eventTime}`).getTime();
            reminder.displayText = `${eventDate} ${eventTime}`;
            break;
    }

    // 添加到提醒列表
    reminders.push(reminder);

    // 保存到本地存储
    saveReminders();

    // 更新显示
    updateReminderList();

    // 清空输入框
    input.value = '';

    // 显示成功提示
    showToast(`已添加提醒：${content}`, 'success');

    // 开始检查
    if (!checkInterval) {
        startReminderCheck();
    }

    // 更新徽章
    updateBadge();
}

// ==================== 计算下次定时提醒触发时间 ====================
function calculateNextScheduleTrigger(time, repeat) {
    const now = new Date();
    const [hours, minutes] = time.split(':').map(Number);

    let nextDate = new Date();
    nextDate.setHours(hours, minutes, 0, 0);

    // 如果今天的时间已经过了，需要调整
    if (nextDate <= now) {
        switch (repeat) {
            case 'once':
                return null; // 仅一次，时间已过
            case 'daily':
                nextDate.setDate(nextDate.getDate() + 1);
                break;
            case 'weekly':
                nextDate.setDate(nextDate.getDate() + 7);
                break;
            case 'monthly':
                nextDate.setMonth(nextDate.getMonth() + 1);
                break;
        }
    }

    return nextDate.getTime();
}

// ==================== 计算下次定期提醒触发时间 ====================
function calculateNextRepeatTrigger(startDay, endDay) {
    const now = new Date();
    const today = now.getDate();

    // 如果今天在范围内
    if (today >= startDay && today <= endDay) {
        // 如果还没到提醒时间（假设每天9点提醒）
        const reminderHour = 9;
        if (now.getHours() < reminderHour) {
            const nextDate = new Date();
            nextDate.setHours(reminderHour, 0, 0, 0);
            return nextDate.getTime();
        }
    }

    // 计算下个月的触发时间
    let nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(startDay);
    nextMonth.setHours(9, 0, 0, 0);

    return nextMonth.getTime();
}

// ==================== 获取重复类型文本 ====================
function getRepeatText(repeat) {
    const texts = {
        'once': '仅一次',
        'daily': '每天',
        'weekly': '每周',
        'monthly': '每月'
    };
    return texts[repeat] || repeat;
}

// ==================== 开始检查提醒 ====================
function startReminderCheck() {
    if (checkInterval) {
        clearInterval(checkInterval);
    }

    // 每秒检查一次
    checkInterval = setInterval(() => {
        const now = new Date().getTime();
        let dataChanged = false;

        reminders.forEach(reminder => {
            if (!reminder.active) return;

            let shouldTrigger = false;

            switch (reminder.type) {
                case 'countdown':
                case 'event':
                    if (now >= reminder.endTime) {
                        shouldTrigger = true;
                    }
                    break;

                case 'schedule':
                    if (reminder.nextTrigger && now >= reminder.nextTrigger) {
                        shouldTrigger = true;
                        // 计算下一次触发时间
                        reminder.nextTrigger = calculateNextScheduleTrigger(reminder.time, reminder.repeat);
                        if (!reminder.nextTrigger && reminder.repeat === 'once') {
                            reminder.active = false;
                        }
                        dataChanged = true;
                    }
                    break;

                case 'repeat':
                    if (reminder.nextTrigger && now >= reminder.nextTrigger) {
                        shouldTrigger = true;
                        // 计算下一次触发时间
                        reminder.nextTrigger = calculateNextRepeatTrigger(reminder.startDay, reminder.endDay);
                        dataChanged = true;
                    }
                    break;
            }

            if (shouldTrigger) {
                triggerReminder(reminder);
                dataChanged = true;
            }
        });

        // 只在数据改变时保存
        if (dataChanged) {
            saveReminders();
        }

        // 每秒更新列表显示（为了倒计时）
        updateReminderList();
        updateBadge();

    }, 1000);
}

// ==================== 触发提醒 ====================
function triggerReminder(reminder) {
    // 弹出提醒对话框
    showReminderDialog(reminder);

    // 播放提示音
    playNotificationSound();

    // 如果是一次性提醒，标记为已完成
    if (reminder.type === 'countdown' || (reminder.type === 'schedule' && reminder.repeat === 'once')) {
        reminder.active = false;
    }
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

    // 3秒后停止震动
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
    const activeList = document.getElementById('activeReminderList');
    const completedList = document.getElementById('completedReminderList');
    const activeCount = document.getElementById('activeCount');
    const completedCount = document.getElementById('completedCount');

    // 分组提醒
    const activeReminders = reminders.filter(r => r.active);
    const completedReminders = reminders.filter(r => !r.active);

    // 更新计数
    activeCount.textContent = activeReminders.length;
    completedCount.textContent = completedReminders.length;

    // 检查是否需要完全重新渲染
    const activeItems = activeList.querySelectorAll('.reminder-item');
    const completedItems = completedList.querySelectorAll('.reminder-item');

    // 更新正在处理的提醒
    if (activeReminders.length === 0) {
        if (activeItems.length > 0 || !activeList.querySelector('.empty-reminders')) {
            activeList.innerHTML = '<div class="empty-reminders">暂无正在处理的事件</div>';
        }
    } else {
        // 智能更新：只更新倒计时文字
        updateReminderItems(activeList, activeReminders, activeItems);
    }

    // 更新已完成的提醒
    if (completedReminders.length === 0) {
        if (completedItems.length > 0 || !completedList.querySelector('.empty-reminders')) {
            completedList.innerHTML = '<div class="empty-reminders">暂无已办事件</div>';
        }
    } else {
        // 智能更新：只更新倒计时文字
        updateReminderItems(completedList, completedReminders, completedItems);
    }
}

// ==================== 智能更新提醒项 ====================
function updateReminderItems(container, reminders, existingItems) {
    const existingIds = Array.from(existingItems).map(item => parseInt(item.dataset.reminderId));
    const currentIds = reminders.map(r => r.id);

    // 检查是否需要完全重新渲染
    const needsFullRender = existingIds.length !== currentIds.length ||
        !existingIds.every(id => currentIds.includes(id));

    if (needsFullRender) {
        // 完全重新渲染
        container.innerHTML = '';
        reminders.forEach(reminder => {
            const item = createReminderItem(reminder);
            if (!reminder.active) {
                item.style.opacity = '0.6';
            }
            container.appendChild(item);
        });
    } else {
        // 只更新倒计时文字
        existingItems.forEach(item => {
            const reminderId = parseInt(item.dataset.reminderId);
            const reminder = reminders.find(r => r.id === reminderId);
            if (reminder) {
                const timeElement = item.querySelector('.reminder-time');
                if (timeElement) {
                    const timeText = calculateTimeText(reminder);
                    timeElement.textContent = `${reminder.displayText} - ${timeText}`;
                }
            }
        });
    }
}

// ==================== 计算时间文本 ====================
function calculateTimeText(reminder) {
    if (!reminder.active) {
        return '已完成';
    }

    switch (reminder.type) {
        case 'countdown':
            const remaining = Math.max(0, Math.floor((reminder.endTime - new Date().getTime()) / 1000));
            const minutes = Math.floor(remaining / 60);
            const seconds = remaining % 60;
            return `剩余 ${minutes}分${seconds}秒`;

        case 'schedule':
        case 'repeat':
            if (reminder.nextTrigger) {
                const remaining = Math.max(0, Math.floor((reminder.nextTrigger - new Date().getTime()) / 1000));
                const days = Math.floor(remaining / (24 * 60 * 60));
                const hours = Math.floor((remaining % (24 * 60 * 60)) / (60 * 60));
                const minutes = Math.floor((remaining % (60 * 60)) / 60);
                if (days > 0) {
                    return `还有 ${days}天${hours}小时`;
                } else if (hours > 0) {
                    return `还有 ${hours}小时${minutes}分钟`;
                } else {
                    return `还有 ${minutes}分钟`;
                }
            } else {
                return '等待中';
            }

        case 'event':
            const eventRemaining = Math.max(0, Math.floor((reminder.endTime - new Date().getTime()) / 1000));
            const eventDays = Math.floor(eventRemaining / (24 * 60 * 60));
            const eventHours = Math.floor((eventRemaining % (24 * 60 * 60)) / (60 * 60));
            if (eventDays > 0) {
                return `还有 ${eventDays}天${eventHours}小时`;
            } else if (eventHours > 0) {
                return `还有 ${eventHours}小时`;
            } else {
                return '即将到来';
            }
    }
}

// ==================== 创建提醒项HTML ====================
function createReminderItem(reminder) {
    const item = document.createElement('div');
    item.className = 'reminder-item';
    item.dataset.reminderId = reminder.id; // 添加ID用于智能更新

    // 计算显示文本
    const timeText = calculateTimeText(reminder);
    const statusClass = !reminder.active ? 'completed' : '';

    // 创建HTML
    item.innerHTML = `
        <div class="reminder-item-content">
            <div>
                <div class="reminder-text">${reminder.content}</div>
                <div class="reminder-time ${statusClass}">${reminder.displayText} - ${timeText}</div>
            </div>
            <button class="delete-reminder" onclick="deleteReminder(${reminder.id})">✕</button>
        </div>
    `;

    return item;
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

// ==================== 播放提示音 ====================
function playNotificationSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.value = 0.3;

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
        console.log('无法播放提示音:', error);
    }
}

// ==================== Toast 提示函数 ====================
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

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

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

// ==================== 初始化设备ID ====================
function initDeviceId() {
    // 尝试从 localStorage 获取设备ID
    deviceId = localStorage.getItem('reminder_device_id');

    if (!deviceId) {
        // 生成新的设备ID
        deviceId = generateDeviceId();
        localStorage.setItem('reminder_device_id', deviceId);
    }

    console.log('设备ID:', deviceId);
}

// ==================== 生成设备ID ====================
function generateDeviceId() {
    // 生成基于浏览器指纹的唯一ID
    const fingerprint = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        new Date().getTimezoneOffset(),
        !!window.sessionStorage,
        !!window.localStorage
    ].join('|');

    // 使用简单的哈希算法生成ID
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
        const char = fingerprint.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 转换为32位整数
    }

    // 添加随机数确保唯一性
    const randomPart = Math.random().toString(36).substring(2, 15);
    const timestamp = Date.now().toString(36);

    return `device_${Math.abs(hash).toString(36)}_${randomPart}_${timestamp}`;
}

// ==================== 初始化 IndexedDB ====================
function initIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ReminderDB', 1);

        request.onerror = (event) => {
            console.error('IndexedDB 打开失败:', event);
            reject(event);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('IndexedDB 初始化成功');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            db = event.target.result;

            // 创建提醒存储对象
            if (!db.objectStoreNames.contains('reminders')) {
                const objectStore = db.createObjectStore('reminders', { keyPath: 'id' });
                objectStore.createIndex('deviceId', 'deviceId', { unique: false });
                objectStore.createIndex('active', 'active', { unique: false });
                console.log('IndexedDB 对象存储创建成功');
            }
        };
    });
}

// ==================== 保存提醒到 IndexedDB ====================
function saveReminders() {
    if (!db) {
        console.warn('IndexedDB 未初始化，无法保存提醒');
        return;
    }

    const transaction = db.transaction(['reminders'], 'readwrite');
    const objectStore = transaction.objectStore('reminders');

    // 清除当前设备的旧提醒
    const clearRequest = objectStore.index('deviceId').openCursor(IDBKeyRange.only(deviceId));
    clearRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            cursor.delete();
            cursor.continue();
        }
    };

    // 添加新提醒
    reminders.forEach(reminder => {
        reminder.deviceId = deviceId; // 关联设备ID
        objectStore.put(reminder);
    });

    transaction.oncomplete = () => {
        console.log('提醒已保存到 IndexedDB');
    };

    transaction.onerror = (event) => {
        console.error('保存提醒失败:', event);
    };
}

// ==================== 从 IndexedDB 加载提醒 ====================
function loadReminders() {
    if (!db) {
        console.warn('IndexedDB 未初始化，无法加载提醒');
        return;
    }

    const transaction = db.transaction(['reminders'], 'readonly');
    const objectStore = transaction.objectStore('reminders');
    const index = objectStore.index('deviceId');
    const request = index.getAll(deviceId);

    request.onsuccess = (event) => {
        reminders = event.target.result || [];
        console.log(`已加载 ${reminders.length} 条提醒`);
        updateBadge();
    };

    request.onerror = (event) => {
        console.error('加载提醒失败:', event);
    };
}
