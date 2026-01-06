/**
 * 金银行情轮询模块
 * 用于在 GitHub Pages 等 HTTPS 环境下获取行情数据
 * 使用 HTTP 轮询替代 WebSocket，避免 Mixed Content 问题
 */

(function() {
    console.log('[金银行情轮询] 模块初始化');

    // 轮询配置
    var pollingConfig = {
        enabled: false,  // 默认禁用，由 shouldUsePolling() 决定是否启用
        interval: 3000,  // 轮询间隔（毫秒）
        timer: null,
        url: null,
        retryCount: 0,
        maxRetries: 3
    };

    // 检测是否应该使用轮询模式
    function shouldUsePolling() {
        // 检查是否在 HTTPS 环境下
        if (window.location.protocol !== 'https:') {
            console.log('[金银行情轮询] 非 HTTPS 环境，不需要轮询模式');
            return false;
        }

        return true;
    }

    // 获取 HTTP 轮询 URL（使用 Cloudflare Worker 代理）
    function getPollingUrl() {
        var uidStr = typeof Utilss !== 'undefined' ? Utilss.getUUID() : Date.now().toString();
        
        // 使用 Cloudflare Worker 代理
        var cfWorkerUrl = typeof CF_WORKER_URL !== 'undefined' ? CF_WORKER_URL : 'https://ws-relay-ysxnew.a34296407-5cc.workers.dev';
        var httpUrl = cfWorkerUrl + '/api/metals?uid=' + uidStr;

        console.log('[金银行情轮询] 轮询 URL: ' + httpUrl);
        return httpUrl;
    }

    // 获取行情数据
    function fetchMetalsData() {
        if (!pollingConfig.url) {
            console.error('[金银行情轮询] URL 未配置');
            return;
        }

        console.log('[金银行情轮询] 请求: ' + pollingConfig.url);

        // 使用 fetch API 直接请求 Cloudflare Worker 代理
        fetch(pollingConfig.url)
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status);
                }
                return response.json();
            })
            .then(function(data) {
                console.log('[金银行情轮询] 数据获取成功', data);
                pollingConfig.retryCount = 0;

                // 调用 parserData 处理数据
                if (typeof parserData === 'function') {
                    parserData(data);
                } else {
                    console.warn('[金银行情轮询] parserData 函数未定义');
                }
            })
            .catch(function(error) {
                console.error('[金银行情轮询] 数据获取失败:', error);
                pollingConfig.retryCount++;

                // 如果失败次数过多，尝试切换代理
                if (pollingConfig.retryCount >= pollingConfig.maxRetries) {
                    pollingConfig.retryCount = 0;
                    pollingConfig.currentProxyIndex++;

                    if (pollingConfig.currentProxyIndex >= pollingConfig.proxies.length) {
                        // 所有代理都尝试过了
                        console.error('[金银行情轮询] 所有代理都失败，停止轮询');
                        stopPolling();
                    } else {
                        console.warn('[金银行情轮询] 切换到下一个代理');
                    }
                }
            });
    }

    // 启动轮询
    function startPolling() {
        if (!shouldUsePolling()) {
            console.log('[金银行情轮询] 不需要启动轮询');
            return;
        }

        if (pollingConfig.timer) {
            console.log('[金银行情轮询] 轮询已在运行');
            return;
        }

        pollingConfig.url = getPollingUrl();
        if (!pollingConfig.url) {
            console.error('[金银行情轮询] 无法获取轮询 URL');
            return;
        }

        pollingConfig.enabled = true;
        console.log('[金银行情轮询] 启动轮询，间隔: ' + pollingConfig.interval + 'ms');

        // 立即执行一次
        fetchMetalsData();

        // 设置定时器
        pollingConfig.timer = setInterval(function() {
            fetchMetalsData();
        }, pollingConfig.interval);
    }

    // 停止轮询
    function stopPolling() {
        if (pollingConfig.timer) {
            clearInterval(pollingConfig.timer);
            pollingConfig.timer = null;
            console.log('[金银行情轮询] 轮询已停止');
        }
        pollingConfig.enabled = false;
    }

    // 页面可见性变化处理
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
            if (pollingConfig.enabled && !pollingConfig.timer) {
                console.log('[金银行情轮询] 页面可见，恢复轮询');
                startPolling();
            }
        } else if (document.visibilityState === 'hidden') {
            if (pollingConfig.timer) {
                console.log('[金银行情轮询] 页面隐藏，暂停轮询');
                stopPolling();
            }
        }
    });

    // 页面卸载时停止轮询
    window.addEventListener('beforeunload', function() {
        stopPolling();
    });

    // 暴露到全局
    window.MetalsPolling = {
        start: startPolling,
        stop: stopPolling,
        isEnabled: function() {
            return pollingConfig.enabled;
        }
    };

    // 页面加载完成后自动启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(startPolling, 1000);
        });
    } else {
        setTimeout(startPolling, 1000);
    }

    console.log('[金银行情轮询] 模块加载完成');
})();
