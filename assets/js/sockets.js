var lockReconnect = false;  //避免ws重复连接
var isConn = false;
var ws = null;          // 判断当前浏览器是否支持WebSocket
var uidStr = Utilss.getUUID()

// Cloudflare Workers 代理配置（免费 HTTPS → HTTP 桥接）
var CF_WORKER_URL = 'https://ws-relay-ysxnew.a34296407-5cc.workers.dev';
var USE_PROXY = false;  // 直接连接（HTTP 页面可用）

// 强制使用 WS（不使用 WSS，因为服务器只支持 WS）
var WS_URL = 'ws://120.25.236.183:8189/push?cname=ysxnew&uid=';

// 使用代理 URL
var wsUrl = USE_PROXY 
    ? CF_WORKER_URL + '/push?cname=ysxnew&uid=' + uidStr
    : WS_URL;

var connCount = 0;

// 智能降级配置
var useSecureProtocol = true;  // 默认使用安全协议（WSS/HTTPS）
var retryCount = 0;
var maxRetries = 2;  // 每种协议最多重试2次

// CORS 代理配置（用于 GitHub Pages 等 HTTPS 环境）
var proxyConfig = {
    enabled: false,  // 默认禁用代理
    // 公共 CORS 代理服务列表（按优先级排序）
    proxies: [
        'https://corsproxy.io/?',
        'https://api.allorigins.win/raw?url=',
        'https://cors-anywhere.herokuapp.com/'
    ],
    currentProxyIndex: 0
};

// 检测是否需要使用代理（GitHub Pages 或其他 HTTPS 托管平台）
function shouldUseProxy() {
    // 检查是否在 HTTPS 环境下
    if (window.location.protocol !== 'https:') {
        return false;
    }
    
    // 检查是否是 GitHub Pages
    if (window.location.hostname.includes('github.io')) {
        console.log('[WebSocket] 检测到 GitHub Pages 环境，将启用代理模式');
        return true;
    }
    
    // 检查是否包含不支持 HTTPS 的服务器地址
    if (wsUrl && wsUrl.indexOf('120.25.236.183') !== -1) {
        console.log('[WebSocket] 检测到不支持 HTTPS 的服务器，将启用代理模式');
        return true;
    }
    
    return false;
}

// WebSocket 连接诊断
function diagnoseWebSocket(url, errorMsg) {
    console.group('[WebSocket] 连接诊断');
    console.log('时间: ' + new Date().toLocaleString());
    console.log('页面协议: ' + window.location.protocol);
    console.log('目标URL: ' + url);
    console.log('错误信息: ' + errorMsg);
    
    // 检查是否是混合内容
    var isSecurePage = window.location.protocol === 'https:';
    var isSecureTarget = url.indexOf('wss://') === 0;
    var isInsecureTarget = url.indexOf('ws://') === 0;
    
    if (isSecurePage && isInsecureTarget) {
        console.warn('⚠️ 混合内容问题: HTTPS 页面无法直接连接 WS 端点');
        console.warn('建议: 1) 使用支持 WSS 的服务器  2) 通过代理转发  3) 使用 HTTP 轮询');
    }
    
    console.groupEnd();
}

// 获取代理 URL
function getProxiedUrl(originalUrl) {
    if (!proxyConfig.enabled || !shouldUseProxy()) {
        return originalUrl;
    }
    
    var proxy = proxyConfig.proxies[proxyConfig.currentProxyIndex];
    var proxiedUrl = proxy + encodeURIComponent(originalUrl);
    
    console.log('[WebSocket] 使用代理: ' + proxy);
    console.log('[WebSocket] 原始 URL: ' + originalUrl);
    console.log('[WebSocket] 代理 URL: ' + proxiedUrl);
    
    return proxiedUrl;
}

// 切换到下一个代理
function switchProxy() {
    proxyConfig.currentProxyIndex = (proxyConfig.currentProxyIndex + 1) % proxyConfig.proxies.length;
    console.log('[WebSocket] 切换到代理: ' + proxyConfig.proxies[proxyConfig.currentProxyIndex]);
}

// 降级到轮询模式
function fallbackToPolling() {
    console.warn('[WebSocket] 所有 WebSocket 连接方式都失败，尝试启用 HTTP 轮询...');
    
    // 通知 metals-polling.js 启用轮询
    if (typeof MetalsPolling !== 'undefined') {
        MetalsPolling.start();
        console.log('[WebSocket] HTTP 轮询已启动');
    } else {
        console.error('[WebSocket] MetalsPolling 模块未加载，无法启动轮询');
    }
}

// 根据 HTTP/HTTPS 协议自动选择 WebSocket 协议
if (window.location.protocol === 'https:') {
    // HTTPS 页面，检测服务器是否支持 HTTPS
    var serverHost = wsUrl.match(/:\/\/([^\/:]+)/);
    if (serverHost) {
        var host = serverHost[1];
        console.log('[WebSocket] 服务器地址: ' + host);
    }
    
    // 尝试 WSS
    wsUrl = wsUrl.replace('ws://', 'wss://');
    console.log('[WebSocket] 检测到 HTTPS，优先使用 WSS 协议');
} else {
    // HTTP 页面，使用 WS
    console.log('[WebSocket] 检测到 HTTP，使用 WS 协议');
}

createWebSocket(wsUrl);   //连接ws
function createWebSocket(url) {
    console.log('[WebSocket] 正在连接: ' + url);
    console.log('[WebSocket] 当前页面协议: ' + window.location.protocol);
    
    try {
        if ('WebSocket' in window) {
            ws = new WebSocket(url);
        }
        initEventHandle();
    } catch (e) {
        reconnect(url);
        console.log(e);
    }
}

function reconnect(url) {
    if (lockReconnect) return;
    lockReconnect = true;
    
    // 计算总重试次数（每种协议重试 maxRetries 次）
    var totalAttempts = (retryCount + 1);
    
    // 检查是否所有协议都尝试过了
    if (totalAttempts >= maxRetries * 2) {
        console.error('[WebSocket] WSS 和 WS 协议都尝试失败，放弃 WebSocket 连接');
        console.log('[WebSocket] 将尝试使用 HTTP 轮询作为替代方案');
        
        // 停止重试，启用轮询
        lockReconnect = false;
        fallbackToPolling();
        return;
    }
    
    // 检查是否需要降级协议
    if (retryCount >= maxRetries) {
        // 重试次数过多，尝试降级到不安全协议
        useSecureProtocol = false;
        retryCount = 0;
        
        // 将 WSS 降级为 WS
        if (url.includes('wss://')) {
            url = url.replace('wss://', 'ws://');
            console.warn('[WebSocket] WSS 连接失败，降级使用 WS 协议');
        }
    } else {
        retryCount++;
    }
    
    getFormula();
    setTimeout(function () {
        createWebSocket(url);
        lockReconnect = false;
    }, 2000);
}

function initEventHandle() {
    ws.onclose = function () {
        isConn = false;
        connCount = connCount+1;
        
        // 提供诊断信息
        diagnoseWebSocket(wsUrl, '连接关闭');
        
        // 如果是 HTTPS 页面尝试连接 WS，显示特殊提示
        if (window.location.protocol === 'https:' && wsUrl.indexOf('ws://') === 0) {
            console.warn('⚠️ HTTPS 页面无法使用 WS 协议连接，浏览器会阻止混合内容请求');
            console.warn('解决方案: 1) 确保服务器支持 WSS 并配置有效证书  2) 使用 HTTP 轮询替代');
        }
        
        reconnect(wsUrl);
        console.log("llws连接关闭!" + new Date().toLocaleString());
    };
    ws.onerror = function (event) {
        isConn = false;
        var errorMsg = event.message || '未知错误';
        console.error("llws连接错误! 当前URL: " + wsUrl);
        console.error("错误详情: " + errorMsg);
        
        // 调用诊断函数
        diagnoseWebSocket(wsUrl, errorMsg);
        
        reconnect(wsUrl);
    };
    ws.onopen = function () {
        isConn = true;
        
        // 连接成功，重置重试计数
        retryCount = 0;
        console.log('[WebSocket] 连接成功! 使用协议: ' + (wsUrl.includes('wss://') ? 'WSS' : 'WS'));
        
        heartCheck.reset().start();      //心跳检测重置
        console.log("llws连接成功!" + new Date().toLocaleString());
    };
    ws.onmessage = function (event) {    //如果获取到消息，心跳检测重置
        heartCheck.reset().start();      //拿到任何消息都说明当前连接是正常的

        var data = JSON.parse(event.data);
        parserData(data);

    };
}


// 监听窗口关闭事件，当窗口关闭时，主动去关闭websocket连接，防止连接还没断开就关闭窗口，server端会抛异常。
window.onbeforeunload = function () {
    console.log("窗口关闭断开"+ new Date().toLocaleString());
    ws.close();
}


//心跳检测
var heartCheck = {
    timeout: 3000,        //1分钟发一次心跳
    timeoutObj: null,
    serverTimeoutObj: null,
    reset: function () {
        clearTimeout(this.timeoutObj);
        clearTimeout(this.serverTimeoutObj);
        return this;
    },
    start: function () {
        var self = this;
        this.timeoutObj = setTimeout(function () {
            //这里发送一个心跳，后端收到后，返回一个心跳消息，
            //onmessage拿到返回的心跳就说明连接正常
            ws.send(Utilss.getSendData(uidStr));
            // console.log("ping!")
            self.serverTimeoutObj = setTimeout(function () {//如果超过一定时间还没重置，说明后端主动断开了
                console.log("服务器主动断开"+ new Date().toLocaleString());
                ws.close();     //如果onclose会执行reconnect，我们执行ws.close()就行了.如果直接执行reconnect 会触发onclose导致重连两次

            }, self.timeout)
        }, this.timeout)
    }
}

$(document).on('visibilitychange', function (e) {
    if (e.target.visibilityState === "visible") {
        if (isConn == false) {
            createWebSocket(wsUrl);
        }

        getFormula();
    } else if (e.target.visibilityState === "hidden") {
        //ws.close();
        console.log('Tab is now hidden!');
    }
});
