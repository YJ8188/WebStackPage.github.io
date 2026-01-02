// ws-client.js - 纯前端 WebSocket 客户端
// 用于连接行情服务并实时推送数据

(function() {
    'use strict';

    // WebSocket 管理器
    const WSClient = {
        ws: null,
        isConnected: false,
        reconnectTimer: null,
        heartbeatTimer: null,
        uid: null,
        wsUrl: null,
        reconnectAttempts: 0,
        maxReconnectAttempts: 5,
        heartbeatInterval: 3000, // 3秒心跳
        
        // 数据回调
        onDataCallback: null,
        
        // 初始化
        init: function() {
            try {
                // 生成唯一ID
                this.uid = this.generateUUID();
                
                // 构建 WebSocket URL
                this.wsUrl = this.buildWsUrl();
                
                console.log('[WS-Client] 初始化完成');
                console.log('[WS-Client] UID:', this.uid);
                console.log('[WS-Client] URL:', this.wsUrl);
                
                // 开始连接
                this.connect();
            } catch (error) {
                console.error('[WS-Client] 初始化失败:', error);
            }
        },
        
        // 生成UUID
        generateUUID: function() {
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            const h = String(now.getHours()).padStart(2, '0');
            const min = String(now.getMinutes()).padStart(2, '0');
            const s = String(now.getSeconds()).padStart(2, '0');
            const timestamp = '' + y + m + d + h + min + s;
            const random = Math.random().toString(36).substr(2);
            return timestamp + random;
        },
        
        // 构建 WebSocket URL
        buildWsUrl: function() {
            // 使用 Plaintext.js 中的 IP
            const ip = typeof Plaintext !== 'undefined' ? Plaintext.ipStr() : '120.25.236.183';
            const port = '8189';
            return `ws://${ip}:${port}/push?cname=ysxnew&uid=${this.uid}`;
        },
        
        // 连接 WebSocket
        connect: function() {
            if (this.ws && this.isConnected) {
                console.log('[WS-Client] 已连接，跳过重复连接');
                return;
            }
            
            try {
                console.log('[WS-Client] 正在连接...');
                this.ws = new WebSocket(this.wsUrl);
                
                this.ws.onopen = this.onOpen.bind(this);
                this.ws.onmessage = this.onMessage.bind(this);
                this.ws.onerror = this.onError.bind(this);
                this.ws.onclose = this.onClose.bind(this);
                
            } catch (error) {
                console.error('[WS-Client] 连接失败:', error);
                this.scheduleReconnect();
            }
        },
        
        // 连接成功
        onOpen: function() {
            console.log('[WS-Client] ✓ 连接成功!', new Date().toLocaleString());
            this.isConnected = true;
            this.reconnectAttempts = 0;
            
            // 启动心跳
            this.startHeartbeat();
        },
        
        // 接收消息
        onMessage: function(event) {
            try {
                // 重置心跳
                this.resetHeartbeat();
                
                const data = JSON.parse(event.data);
                console.log('[WS-Client] 收到消息:', data);
                
                // 解密数据
                if (data.data) {
                    const decrypted = this.decryptData(data.data);
                    console.log('[WS-Client] 解密后数据:', decrypted);
                    
                    // 触发回调
                    if (this.onDataCallback && typeof this.onDataCallback === 'function') {
                        this.onDataCallback(decrypted);
                    }
                    
                    // 触发全局事件
                    this.emitDataEvent(decrypted);
                }
                
            } catch (error) {
                console.error('[WS-Client] 处理消息失败:', error);
            }
        },
        
        // 连接错误
        onError: function(error) {
            console.error('[WS-Client] ✗ 连接错误:', error);
            this.isConnected = false;
        },
        
        // 连接关闭
        onClose: function() {
            console.log('[WS-Client] 连接关闭', new Date().toLocaleString());
            this.isConnected = false;
            this.stopHeartbeat();
            
            // 尝试重连
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.scheduleReconnect();
            } else {
                console.error('[WS-Client] 已达到最大重连次数，停止重连');
            }
        },
        
        // 启动心跳
        startHeartbeat: function() {
            this.stopHeartbeat();
            
            this.heartbeatTimer = setInterval(() => {
                if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                    const heartbeatData = this.buildHeartbeatData();
                    console.log('[WS-Client] 💓 发送心跳:', heartbeatData);
                    this.ws.send(heartbeatData);
                }
            }, this.heartbeatInterval);
        },
        
        // 停止心跳
        stopHeartbeat: function() {
            if (this.heartbeatTimer) {
                clearInterval(this.heartbeatTimer);
                this.heartbeatTimer = null;
            }
        },
        
        // 重置心跳
        resetHeartbeat: function() {
            this.stopHeartbeat();
            this.startHeartbeat();
        },
        
        // 构建心跳数据
        buildHeartbeatData: function() {
            const data = {
                uid: this.uid,
                cname: 'ysxnew',
                timestamp: Date.now()
            };
            return JSON.stringify(data);
        },
        
        // 解密数据
        decryptData: function(encryptedData) {
            try {
                // 检查是否有 CryptoJS
                if (typeof CryptoJS === 'undefined') {
                    console.warn('[WS-Client] CryptoJS 未加载，返回原始数据');
                    return encryptedData;
                }
                
                // 使用密钥解密 (从 Utilss.js 推断)
                const key = CryptoJS.enc.Latin1.parse('jA8EmfP0oCPlsZCX'.substring(0, 16));
                const iv = CryptoJS.enc.Latin1.parse('jA8EmfP0oCPlsZCX');
                
                const decrypted = CryptoJS.AES.decrypt(encryptedData, key, {
                    iv: iv,
                    padding: CryptoJS.pad.ZeroPadding
                });
                
                const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
                return JSON.parse(decryptedStr);
                
            } catch (error) {
                console.error('[WS-Client] 解密失败:', error);
                return null;
            }
        },
        
        // 安排重连
        scheduleReconnect: function() {
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
            }
            
            this.reconnectAttempts++;
            const delay = Math.min(2000 * this.reconnectAttempts, 10000);
            
            console.log(`[WS-Client] ${delay/1000}秒后尝试第 ${this.reconnectAttempts} 次重连...`);
            
            this.reconnectTimer = setTimeout(() => {
                this.connect();
            }, delay);
        },
        
        // 触发数据事件
        emitDataEvent: function(data) {
            try {
                const event = new CustomEvent('ws-data-received', {
                    detail: data
                });
                window.dispatchEvent(event);
            } catch (error) {
                console.error('[WS-Client] 触发事件失败:', error);
            }
        },
        
        // 设置数据回调
        onData: function(callback) {
            this.onDataCallback = callback;
        },
        
        // 手动发送数据
        send: function(data) {
            if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(typeof data === 'string' ? data : JSON.stringify(data));
                return true;
            }
            console.warn('[WS-Client] 未连接，无法发送数据');
            return false;
        },
        
        // 断开连接
        disconnect: function() {
            console.log('[WS-Client] 主动断开连接');
            this.stopHeartbeat();
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
            }
            if (this.ws) {
                this.ws.close();
                this.ws = null;
            }
            this.isConnected = false;
        }
    };
    
    // 暴露到全局
    window.WSClient = WSClient;
    
    // 页面加载后自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            WSClient.init();
        });
    } else {
        WSClient.init();
    }
    
    // 页面关闭时断开连接
    window.addEventListener('beforeunload', function() {
        WSClient.disconnect();
    });
    
    console.log('[WS-Client] 模块已加载');
})();