// ==================== 贵金属行情模块 ====================
/**
 * 贵金属实时行情显示模块
 * 功能：获取并显示贵金属的实时价格、涨跌幅等信息
 */

var MetalsData = {
    // 贵金属价格数据
    prices: {
        bankGoldBars: [],      // 银行投资金条价格
        goldRecycle: [],       // 黄金回收价格
        preciousMetals: []     // 贵金属价格
    },

    // 自动刷新配置
    refreshInterval: 60000,    // 刷新间隔：60秒（减少API请求频率）
    refreshTimer: null,       // 定时器引用
    countdownTimer: null,     // 倒计时定时器
    nextRefreshTime: 0,       // 下次刷新时间
    isRefreshing: false,      // 是否正在刷新
    cachedData: null,         // 缓存的数据

    // 初始化数据
    init: function() {
        console.log('%c[金价行情] 初始化数据模块', 'color: #10b981; font-weight: bold;');
        this.fetchGoldPrice();
        this.startAutoRefresh();
        this.checkDarkMode();
        this.startCountdown();
    },

    // 启动自动刷新
    startAutoRefresh: function() {
        var self = this;
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }
        this.refreshTimer = setInterval(function() {
            self.fetchGoldPrice();
        }, this.refreshInterval);
        this.nextRefreshTime = Date.now() + this.refreshInterval;
        console.log('%c[金价行情] 自动刷新已启动，间隔: ' + (this.refreshInterval / 1000) + '秒', 'color: #10b981;');
    },

    // 启动倒计时显示
    startCountdown: function() {
        var self = this;
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
        }
        this.countdownTimer = setInterval(function() {
            self.updateCountdownDisplay();
        }, 1000);
    },

    // 更新倒计时显示
    updateCountdownDisplay: function() {
        var countdownEl = document.getElementById('metals-countdown');
        if (!countdownEl) return;

        var remaining = Math.max(0, this.nextRefreshTime - Date.now());
        var seconds = Math.ceil(remaining / 1000);

        if (seconds <= 0) {
            countdownEl.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 刷新中...';
        } else {
            countdownEl.innerHTML = '<i class="fa fa-clock-o"></i> ' + seconds + '秒后刷新';
        }
    },

    // 停止自动刷新
    stopAutoRefresh: function() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
            console.log('%c[金价行情] 自动刷新已停止', 'color: #f59e0b;');
        }
    },

    // 检查黑暗模式
    checkDarkMode: function() {
        var body = document.body;
        var isDark = body.classList.contains('dark-mode') ||
                     body.getAttribute('data-theme') === 'dark' ||
                     window.matchMedia('(prefers-color-scheme: dark)').matches;

        // 监听主题变化
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.attributeName === 'class' || mutation.attributeName === 'data-theme') {
                    MetalsData.applyDarkMode();
                }
            });
        });
        observer.observe(body, { attributes: true });

        // 监听系统主题变化
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
            MetalsData.applyDarkMode();
        });

        this.applyDarkMode();
    },

    // 应用黑暗模式样式
    applyDarkMode: function() {
        var body = document.body;
        var isDark = body.classList.contains('dark-mode') ||
                     body.getAttribute('data-theme') === 'dark' ||
                     window.matchMedia('(prefers-color-scheme: dark)').matches;

        var containers = document.querySelectorAll('.metals-table-container');
        containers.forEach(function(container) {
            if (isDark) {
                container.style.background = '#1e1e1e';
                container.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.5)';
            } else {
                container.style.background = '#fff';
                container.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.08)';
            }
        });

        var headers = document.querySelectorAll('.metals-table-container > div:first-child');
        headers.forEach(function(header) {
            if (isDark) {
                header.style.color = '#fff';
                header.style.borderBottom = '1px solid #333';
            } else {
                header.style.color = '#333';
                header.style.borderBottom = '1px solid #f0f0f0';
            }
        });

        var theads = document.querySelectorAll('.metals-table th');
        theads.forEach(function(th) {
            if (isDark) {
                th.style.background = '#2a2a2a';
                th.style.color = '#aaa';
                th.style.borderBottom = '1px solid #333';
            } else {
                th.style.background = '#fcfcfc';
                th.style.color = '#888';
                th.style.borderBottom = '1px solid #f0f0f0';
            }
        });

        var tds = document.querySelectorAll('.metals-table td');
        tds.forEach(function(td) {
            if (isDark) {
                td.style.color = '#e0e0e0';
                td.style.borderTop = '1px solid #333';
            } else {
                td.style.color = '#333';
                td.style.borderTop = '1px solid #f8f8f8';
            }
        });

        var names = document.querySelectorAll('.jinjia_name');
        names.forEach(function(name) {
            if (isDark) {
                name.style.color = '#e0e0e0';
            } else {
                name.style.color = '#333';
            }
        });

        var prices = document.querySelectorAll('.f_hongse');
        prices.forEach(function(price) {
            if (isDark) {
                price.style.color = '#ef4444';
            }
        });

        var dates = document.querySelectorAll('.metals-table td:nth-child(3)');
        dates.forEach(function(date) {
            if (isDark) {
                date.style.color = '#888';
            } else {
                date.style.color = '#999';
            }
        });
    },

    // 获取黄金价格数据
    fetchGoldPrice: function() {
        var self = this;

        if (this.isRefreshing) {
            console.log('%c[金价行情] 正在刷新中，跳过本次请求', 'color: #f59e0b;');
            return;
        }

        this.isRefreshing = true;
        console.log('%c[金价行情] 开始获取黄金价格数据...', 'color: #10b981;');

        // 更新刷新按钮状态
        var refreshBtn = document.getElementById('refresh-metals-btn');
        if (refreshBtn) {
            refreshBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';
            refreshBtn.disabled = true;
        }

        // 更新倒计时显示
        var countdownEl = document.getElementById('metals-countdown');
        if (countdownEl) {
            countdownEl.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 刷新中...';
        }

        // 更新API状态指示
        var statusDot = document.getElementById('metals-api-status-dot');
        if (statusDot) {
            statusDot.style.color = '#f59e0b';
        }

        fetch('https://api.lolimi.cn/API/huangj/api', {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        })
        .then(function(response) {
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }
            return response.json();
        })
        .then(function(data) {
            console.log('%c[金价行情] 数据获取成功:', 'color: #10b981;', data);

            if (data.code === 200) {
                // 直接使用API返回的最新数据
                var newData = data;

                // 更新数据 - 适配新的API结构
                self.prices.bankGoldBars = newData['国内十大金店'] || [];
                self.prices.goldRecycle = newData['国内黄金'] || [];
                self.prices.preciousMetals = newData['国际黄金'] || [];

                // 缓存数据
                self.cachedData = JSON.parse(JSON.stringify(newData));

                self.updateUI();

                // 更新下次刷新时间
                self.nextRefreshTime = Date.now() + self.refreshInterval;

                // 更新API状态指示为成功
                if (statusDot) {
                    statusDot.style.color = '#10b981';
                }
            } else {
                console.error('%c[金价行情] 数据格式错误:', 'color: #f59e0b;', data);

                // 更新API状态指示为错误
                if (statusDot) {
                    statusDot.style.color = '#ef4444';
                }
            }
        })
        .catch(function(error) {
            console.error('%c[金价行情] 数据获取失败:', 'color: #f59e0b;', error);

            // 如果有缓存数据,使用缓存
            if (self.cachedData) {
                console.log('%c[金价行情] 使用缓存数据', 'color: #10b981;');
                self.prices.bankGoldBars = self.cachedData['国内十大金店'] || [];
                self.prices.goldRecycle = self.cachedData['国内黄金'] || [];
                self.prices.preciousMetals = self.cachedData['国际黄金'] || [];
                self.updateUI();
            }

            // 更新API状态指示为错误
            if (statusDot) {
                statusDot.style.color = '#ef4444';
            }
        })
        .finally(function() {
            self.isRefreshing = false;

            // 恢复刷新按钮状态
            if (refreshBtn) {
                refreshBtn.innerHTML = '<i class="fa fa-refresh"></i>';
                refreshBtn.disabled = false;
            }

            // 更新倒计时显示
            self.updateCountdownDisplay();
        });
    },

    // 更新UI显示
    updateUI: function() {
        this.renderBankGoldBars();
        this.renderGoldRecycle();
        this.renderPreciousMetals();
    },

    // 数字跳动动画效果
    animateNumber: function(element, newValue) {
        var currentValue = parseFloat(element.innerText.replace(/[¥,]/g, '')) || 0;
        var targetValue = parseFloat(newValue);
        var duration = 500; // 动画持续时间(毫秒)
        var startTime = null;

        function update(currentTime) {
            if (!startTime) startTime = currentTime;
            var progress = Math.min((currentTime - startTime) / duration, 1);

            // 使用缓动函数
            var easeProgress = 1 - Math.pow(1 - progress, 3);
            var current = currentValue + (targetValue - currentValue) * easeProgress;

            element.innerText = '¥' + current.toFixed(2);

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                element.innerText = '¥' + targetValue.toFixed(2);
                // 添加闪烁效果
                element.style.transition = 'color 0.2s ease';
                element.style.color = '#ef4444';
                setTimeout(function() {
                    element.style.color = '';
                }, 200);
            }
        }

        requestAnimationFrame(update);
    },

    // 渲染国内十大金店价格
    renderBankGoldBars: function() {
        var tbody = document.getElementById('bank-gold-bars-body');
        if (!tbody) {
            console.warn('%c[金价行情] 找不到银行金条表格元素', 'color: #f59e0b;');
            return;
        }

        if (!this.prices.bankGoldBars || this.prices.bankGoldBars.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: #999;">暂无数据</td></tr>';
            return;
        }

        var self = this;
        var loadingEl = document.getElementById('bank-gold-loading');

        // 移除加载提示
        if (loadingEl) {
            tbody.innerHTML = '';
        }

        // 去重处理：每个品牌只保留一条记录
        var uniqueBankGoldBars = {};
        this.prices.bankGoldBars.forEach(function(item) {
            var key = item.品牌;
            if (!uniqueBankGoldBars[key]) {
                uniqueBankGoldBars[key] = item;
            }
        });
        var deduplicatedData = Object.values(uniqueBankGoldBars);

        deduplicatedData.forEach(function(item) {
            var existingRow = null;
            var priceSpans = [];

            // 查找是否已存在该品牌的行
            var rows = tbody.querySelectorAll('tr');
            for (var i = 0; i < rows.length; i++) {
                var nameCell = rows[i].querySelector('.jinjia_name');
                if (nameCell && nameCell.innerText === item.品牌) {
                    existingRow = rows[i];
                    priceSpans = existingRow.querySelectorAll('.f_hongse');
                    break;
                }
            }

            if (existingRow && priceSpans.length === 3) {
                // 更新黄金价
                var oldGoldPrice = parseFloat(priceSpans[0].innerText.replace(/[¥,]/g, '')) || 0;
                var newGoldPrice = parseFloat(item.黄金价格);
                if (oldGoldPrice !== newGoldPrice && newGoldPrice !== '-') {
                    self.animateNumber(priceSpans[0], newGoldPrice);
                }

                // 更新铂金价
                var oldPlatinumPrice = parseFloat(priceSpans[1].innerText.replace(/[¥,]/g, '')) || 0;
                var newPlatinumPrice = parseFloat(item.铂金价格);
                if (oldPlatinumPrice !== newPlatinumPrice && newPlatinumPrice !== '-') {
                    self.animateNumber(priceSpans[1], newPlatinumPrice);
                }

                // 更新金条价
                var oldBullionPrice = parseFloat(priceSpans[2].innerText.replace(/[¥,]/g, '')) || 0;
                var newBullionPrice = parseFloat(item.金条价格);
                if (oldBullionPrice !== newBullionPrice && newBullionPrice !== '-') {
                    self.animateNumber(priceSpans[2], newBullionPrice);
                }
            } else {
                // 新增行
                var goldDisplay = item.黄金价格 === '-' ? '-' : '¥' + item.黄金价格;
                var platinumDisplay = item.铂金价格 === '-' ? '-' : '¥' + item.铂金价格;
                var bullionDisplay = item.金条价格 === '-' ? '-' : '¥' + item.金条价格;
                
                var row = document.createElement('tr');
                row.innerHTML = '<td class="jinjia_name">' + item.品牌 + '</td>' +
                    '<td><span class="f_hongse">' + goldDisplay + '</span></td>' +
                    '<td><span class="f_hongse">' + platinumDisplay + '</span></td>' +
                    '<td><span class="f_hongse">' + bullionDisplay + '</span></td>';
                tbody.appendChild(row);
            }
        });

        console.log('%c[金价行情] 国内十大金店表格渲染成功', 'color: #10b981;');
    },

    // 渲染国内黄金价格
    renderGoldRecycle: function() {
        var tbody = document.getElementById('gold-recycle-body');
        if (!tbody) {
            console.warn('%c[金价行情] 找不到黄金回收表格元素', 'color: #f59e0b;');
            return;
        }

        if (!this.prices.goldRecycle || this.prices.goldRecycle.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: #999;">暂无数据</td></tr>';
            return;
        }

        var self = this;
        var loadingEl = document.getElementById('gold-recycle-loading');

        // 移除加载提示
        if (loadingEl) {
            tbody.innerHTML = '';
        }

        // 去重处理：每个品种只保留一条记录
        var uniqueGoldRecycle = {};
        this.prices.goldRecycle.forEach(function(item) {
            var key = item.品种;
            if (!uniqueGoldRecycle[key]) {
                uniqueGoldRecycle[key] = item;
            }
        });
        var deduplicatedData = Object.values(uniqueGoldRecycle);

        deduplicatedData.forEach(function(item) {
            var existingRow = null;

            var rows = tbody.querySelectorAll('tr');
            for (var i = 0; i < rows.length; i++) {
                var nameCell = rows[i].querySelector('.jinjia_name');
                if (nameCell && nameCell.innerText === item.品种) {
                    existingRow = rows[i];
                    break;
                }
            }

            if (existingRow) {
                // 更新价格
                var priceCell = existingRow.cells[1];
                if (priceCell) {
                    var oldPrice = parseFloat(priceCell.innerText.replace(/[¥,]/g, '')) || 0;
                    var newPrice = parseFloat(item.最新价);
                    if (oldPrice !== newPrice) {
                        var priceSpan = priceCell.querySelector('.f_hongse');
                        if (priceSpan) {
                            self.animateNumber(priceSpan, newPrice);
                        }
                    }
                }
                // 更新涨跌
                var changeCell = existingRow.cells[2];
                if (changeCell) {
                    var changeValue = item.涨跌;
                    var changeColor = changeValue >= 0 ? '#ef4444' : '#10b981';
                    changeCell.innerText = changeValue;
                    changeCell.style.color = changeColor;
                }
                // 更新幅度
                var rangeCell = existingRow.cells[3];
                if (rangeCell) {
                    var rangeValue = item.幅度;
                    var rangeColor = rangeValue >= 0 ? '#ef4444' : '#10b981';
                    rangeCell.innerText = rangeValue;
                    rangeCell.style.color = rangeColor;
                }
            } else {
                // 根据涨跌设置颜色
                var changeValue = item.涨跌;
                var changeColor = changeValue >= 0 ? '#ef4444' : '#10b981';
                var rangeValue = item.幅度;
                var rangeColor = rangeValue >= 0 ? '#ef4444' : '#10b981';
                
                var row = document.createElement('tr');
                row.innerHTML = '<td class="jinjia_name">' + item.品种 + '</td>' +
                    '<td><span class="f_hongse">¥' + item.最新价 + '</span></td>' +
                    '<td style="color: ' + changeColor + ';">' + changeValue + '</td>' +
                    '<td style="color: ' + rangeColor + ';">' + rangeValue + '</td>';
                tbody.appendChild(row);
            }
        });

        console.log('%c[金价行情] 国内黄金表格渲染成功', 'color: #10b981;');
    },

// 渲染贵金属价格（国际黄金）
    renderPreciousMetals: function() {
        var tbody = document.getElementById('precious-metals-body');
        if (!tbody) {
            console.warn('%c[金价行情] 找不到贵金属表格元素', 'color: #f59e0b;');
            return;
        }

        if (!this.prices.preciousMetals || this.prices.preciousMetals.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: #999;">暂无数据</td></tr>';
            return;
        }

        var self = this;
        var loadingEl = document.getElementById('precious-metals-loading');

        // 移除加载提示
        if (loadingEl) {
            tbody.innerHTML = '';
        }

        // 去重处理：每个品种只保留一条记录
        var uniquePreciousMetals = {};
        this.prices.preciousMetals.forEach(function(item) {
            var key = item.品种;
            if (!uniquePreciousMetals[key]) {
                uniquePreciousMetals[key] = item;
            }
        });
        var deduplicatedData = Object.values(uniquePreciousMetals);

        deduplicatedData.forEach(function(item) {
            var existingRow = null;

            var rows = tbody.querySelectorAll('tr');
            for (var i = 0; i < rows.length; i++) {
                var nameCell = rows[i].querySelector('.jinjia_name');
                if (nameCell && nameCell.innerText === item.品种) {
                    existingRow = rows[i];
                    break;
                }
            }

            if (existingRow) {
                // 更新价格
                var priceCell = existingRow.cells[1];
                if (priceCell) {
                    var oldPrice = parseFloat(priceCell.innerText.replace(/[¥,]/g, '')) || 0;
                    var newPrice = parseFloat(item.最新价);
                    if (oldPrice !== newPrice) {
                        var priceSpan = priceCell.querySelector('.f_hongse');
                        if (priceSpan) {
                            self.animateNumber(priceSpan, newPrice);
                        }
                    }
                }
                // 更新涨跌
                var changeCell = existingRow.cells[2];
                if (changeCell) {
                    var changeValue = item.涨跌;
                    var changeColor = changeValue >= 0 ? '#ef4444' : '#10b981';
                    changeCell.innerText = changeValue;
                    changeCell.style.color = changeColor;
                }
                // 更新幅度
                var rangeCell = existingRow.cells[3];
                if (rangeCell) {
                    var rangeValue = item.幅度;
                    var rangeColor = rangeValue >= 0 ? '#ef4444' : '#10b981';
                    rangeCell.innerText = rangeValue;
                    rangeCell.style.color = rangeColor;
                }
            } else {
                // 根据涨跌设置颜色
                var changeValue = item.涨跌;
                var changeColor = changeValue >= 0 ? '#ef4444' : '#10b981';
                var rangeValue = item.幅度;
                var rangeColor = rangeValue >= 0 ? '#ef4444' : '#10b981';
                
                var row = document.createElement('tr');
                row.innerHTML = '<td class="jinjia_name">' + item.品种 + '</td>' +
                    '<td><span class="f_hongse">¥' + item.最新价 + '</span></td>' +
                    '<td style="color: ' + changeColor + ';">' + changeValue + '</td>' +
                    '<td style="color: ' + rangeColor + ';">' + rangeValue + '</td>';
                tbody.appendChild(row);
            }
        });

        console.log('%c[金价行情] 国际黄金表格渲染成功', 'color: #10b981;');
    }
};

/**
 * 动态生成金价行情板块UI
 */
function initMetalsUI() {
    console.log('%c[金价行情] initMetalsUI 开始执行', 'color: #10b981; font-weight: bold;');
    const placeholder = document.getElementById('metals-section-placeholder');
    console.log('%c[金价行情] placeholder 元素: ' + !!placeholder, 'color: #10b981;');
    if (!placeholder) {
        console.error('%c[金价行情] 找不到 metals-section-placeholder 元素', 'color: #f59e0b; font-weight: bold;');
        return;
    }

    const metalsHTML = `
        <h4 class="text-gray">
            <i class="linecons-diamond" style="margin-right: 7px;" id="金价行情"></i>金价行情
            <span style="float: right; display: flex; align-items: center; font-size: 12px; gap: 8px;">
                <button id="refresh-metals-btn" class="btn btn-xs btn-white" onclick="MetalsData.init()"
                    style="margin-right: 0; padding: 4px 8px;" title="刷新数据">
                    <i class="fa fa-refresh"></i>
                </button>
                <span id="metals-countdown" style="color: #10b981; font-weight: 500;">
                    <i class="fa fa-clock-o"></i> 3秒后刷新
                </span>
            </span>
        </h4>

        <div class="row">
            <div class="col-sm-12">
                <p class="states metals-notice" style="font-size: 12px; color: #666; padding: 10px; text-align: center; margin-bottom: 15px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">声明：以下行情仅供参考，如有咨询请联系相关人员。</p>

                <!-- 国内十大金店 -->
                <div class="metals-table-container" style="margin-bottom: 20px;">
                    <div style="padding: 12px 15px; font-size: 15px; font-weight: 600; color: #333; border-bottom: 1px solid #f0f0f0; font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;">国内十大金店</div>
                    <table class="table metals-table">
                        <thead>
                            <tr>
                                <th style="width: 30%;">品牌</th>
                                <th style="width: 25%;">黄金价(元/克)</th>
                                <th style="width: 25%;">铂金价(元/克)</th>
                                <th style="width: 20%;">金条价(元/克)</th>
                            </tr>
                        </thead>
                        <tbody id="bank-gold-bars-body">
                            <tr>
                                <td colspan="2" style="text-align:center; padding: 20px;">
                                    <div id="bank-gold-loading">
                                        <i class="fa fa-spinner fa-spin"></i> 正在加载行情数据...
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- 国内黄金 -->
                <div class="metals-table-container" style="margin-bottom: 20px;">
                    <div style="padding: 12px 15px; font-size: 15px; font-weight: 600; color: #333; border-bottom: 1px solid #f0f0f0; font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;">国内黄金</div>
                    <table class="table metals-table">
                        <thead>
                            <tr>
                                <th style="width: 25%;">品种</th>
                                <th style="width: 25%;">最新价(元/克)</th>
                                <th style="width: 25%;">涨跌</th>
                                <th style="width: 25%;">幅度</th>
                            </tr>
                        </thead>
                        <tbody id="gold-recycle-body">
                            <tr>
                                <td colspan="3" style="text-align:center; padding: 20px;">
                                    <div id="gold-recycle-loading">
                                        <i class="fa fa-spinner fa-spin"></i> 正在加载行情数据...
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- 国际黄金 -->
                <div class="metals-table-container">
                    <div style="padding: 12px 15px; font-size: 15px; font-weight: 600; color: #333; border-bottom: 1px solid #f0f0f0; font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;">国际黄金</div>
                    <table class="table metals-table">
                        <thead>
                            <tr>
                                <th style="width: 25%;">品种</th>
                                <th style="width: 25%;">最新价</th>
                                <th style="width: 25%;">涨跌</th>
                                <th style="width: 25%;">幅度</th>
                            </tr>
                        </thead>
                        <tbody id="precious-metals-body">
                            <tr>
                                <td colspan="4" style="text-align:center; padding: 20px;">
                                    <div id="precious-metals-loading">
                                        <i class="fa fa-spinner fa-spin"></i> 正在加载行情数据...
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div style="font-size: 12px; color: #888; text-align: right; margin-top: 5px;">
                    Data provided by <span id="metals-api-provider">Lolimi</span>
                    <span id="metals-api-status-dot" style="color: #10b981;">●</span>
                </div>
            </div>
        </div>

        <style>
            .metals-table-container {
                background: #fff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
                transition: all 0.3s ease;
            }

            .metals-table {
                margin-bottom: 0;
                width: 100%;
                font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
            }

            .metals-table th {
                background: #fcfcfc;
                font-weight: 500;
                color: #888;
                border-bottom: 1px solid #f0f0f0;
                padding: 12px 15px !important;
                font-size: 13px;
                transition: all 0.3s ease;
            }

            .metals-table td {
                vertical-align: middle !important;
                padding: 12px 15px !important;
                border-top: 1px solid #f8f8f8;
                color: #333;
                transition: all 0.3s ease;
            }

            .metals-table tr:nth-child(even) {
                background-color: #fafafa;
            }

            .metals-table tr:hover {
                background-color: #f5f5f5;
            }

            .f_hongse {
                font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
                color: #ef4444;
                font-weight: 600;
            }

            .jinjia_name {
                font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
                font-weight: 500;
                color: #333;
            }

            /* 声明文字样式 */
            .metals-notice {
                background-color: #fff;
            }

            /* 黑暗模式样式 */
            body.dark-mode .metals-table-container,
            body[data-theme="dark"] .metals-table-container {
                background: #1e1e1e;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            }

            body.dark-mode .metals-table-container > div:first-child,
            body[data-theme="dark"] .metals-table-container > div:first-child {
                color: #fff;
                border-bottom: 1px solid #333;
            }

            body.dark-mode .metals-table th,
            body[data-theme="dark"] .metals-table th {
                background: #2a2a2a;
                color: #aaa;
                border-bottom: 1px solid #333;
            }

            body.dark-mode .metals-table td,
            body[data-theme="dark"] .metals-table td {
                color: #e0e0e0;
                border-top: 1px solid #333;
            }

            body.dark-mode .metals-table tr:nth-child(even),
            body[data-theme="dark"] .metals-table tr:nth-child(even) {
                background-color: #252525;
            }

            body.dark-mode .metals-table tr:hover,
            body[data-theme="dark"] .metals-table tr:hover {
                background-color: #2a2a2a;
            }

            body.dark-mode .jinjia_name,
            body[data-theme="dark"] .jinjia_name {
                color: #e0e0e0;
            }

            body.dark-mode .metals-table td:nth-child(3),
            body[data-theme="dark"] .metals-table td:nth-child(3) {
                color: #888;
            }

            /* 声明文字暗黑模式 */
            body.dark-mode .metals-notice,
            body[data-theme="dark"] .metals-notice {
                background-color: #2a2a2a !important;
                color: #aaa !important;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
            }

            /* 刷新按钮样式 */
            #refresh-metals-btn {
                transition: all 0.3s ease;
            }

            #refresh-metals-btn:hover {
                background-color: #e0e0e0;
            }

            #refresh-metals-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }

            /* 状态指示点动画 */
            #metals-api-status-dot {
                transition: color 0.3s ease;
            }

            /* 响应式优化 */
            @media (max-width: 768px) {
                .metals-table th,
                .metals-table td {
                    padding: 10px 12px !important;
                    font-size: 12px;
                }

                .metals-table-container > div:first-child {
                    font-size: 14px;
                }
            }
        </style>
    `;

    placeholder.innerHTML = metalsHTML;
    console.log('%c[金价行情] UI 生成成功', 'color: #10b981; font-weight: bold;');

    // 初始化数据
    MetalsData.init();

    // 悬停时隐藏浮动按钮的优化（与数字货币模块保持一致）
    const metalsContainer = document.querySelector('.metals-table-container');
    if (metalsContainer) {
        const metalsSection = metalsContainer.closest('.row');
        const floatBtns = ['#showHiddenCards', '#resetOrder', '.xp-panel'];

        const hideFloats = () => {
            floatBtns.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => el.classList.add('fade-out'));
            });
        };
        const showFloats = () => {
            floatBtns.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => el.classList.remove('fade-out'));
            });
        };

        if (metalsSection) {
            metalsSection.addEventListener('mouseenter', hideFloats);
            metalsSection.addEventListener('mouseleave', showFloats);
            metalsSection.addEventListener('touchstart', hideFloats, { passive: true });
            console.log('%c[金价行情] 浮动按钮隐藏功能已启用', 'color: #10b981;');
        } else {
            console.warn('%c[金价行情] 未找到 metalsSection', 'color: #f59e0b;');
        }
    } else {
        console.warn('%c[金价行情] 未找到 metals-table-container', 'color: #f59e0b;');
    }
}

// 页面加载完成后初始化
console.log('%c[金价行情] 模块加载完成，当前状态: ' + document.readyState, 'color: #10b981; font-weight: bold;');

// 立即检查元素是否存在
var placeholder = document.getElementById('metals-section-placeholder');
console.log('%c[金价行情] 元素检查 - placeholder: ' + !!placeholder, 'color: #10b981;');

// 使用 window.onload 确保页面完全加载
window.addEventListener('load', function() {
    console.log('%c[金价行情] window.load 事件触发', 'color: #10b981;');

    // 再次检查元素
    placeholder = document.getElementById('metals-section-placeholder');
    console.log('%c[金价行情] load 事件后元素检查 - placeholder: ' + !!placeholder, 'color: #10b981;');

    // 检查是动态模式还是静态模式
    if (placeholder) {
        console.log('%c[金价行情] 检测到动态模式（index.html）', 'color: #10b981;');
        // 延迟执行，确保所有资源都已加载完成
        setTimeout(function() {
            console.log('%c[金价行情] 开始执行初始化', 'color: #10b981;');
            initMetalsUI();
        }, 200);
    } else {
        console.error('%c[金价行情] 未找到金价行情容器元素', 'color: #f59e0b; font-weight: bold;');
    }
});

// 备用：如果 window.onload 不触发，使用 DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        console.log('%c[金价行情] DOMContentLoaded 事件触发', 'color: #10b981;');
    });
}

// 页面可见性变化处理 - 隐藏时停止刷新，显示时恢复
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
        console.log('%c[金价行情] 页面可见，恢复自动刷新', 'color: #10b981;');
        MetalsData.startAutoRefresh();
        MetalsData.fetchGoldPrice();
    } else if (document.visibilityState === 'hidden') {
        console.log('%c[金价行情] 页面隐藏，暂停自动刷新', 'color: #f59e0b;');
        MetalsData.stopAutoRefresh();
    }
});

// 页面卸载时停止刷新
window.addEventListener('beforeunload', function() {
    MetalsData.stopAutoRefresh();
});
