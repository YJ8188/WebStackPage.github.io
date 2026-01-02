// ws-client-enhanced.js - 增强版 WebSocket 客户端
// 用于连接行情服务并实时推送数据，包含完善的调试和错误处理

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
        maxReconnectAttempts: 10,
        heartbeatInterval: 3000, // 3秒心跳
        
        // 数据回调
        onDataCallback: null,
        
        // 调试模式
        debugMode: true,
        
        // 状态回调
        statusCallbacks: [],
        
        // 初始化
        init: function() {
            try {
                this.log('[WS-Client] 初始化增强版WebSocket客户端...');
                
                // 生成唯一ID
                this.uid = this.generateUUID();
                
                // 构建 WebSocket URL
                this.wsUrl = this.buildWsUrl();
                
                this.log('[WS-Client] UID:', this.uid);
                this.log('[WS-Client] URL:', this.wsUrl);
                
                // 检查CryptoJS
                if (typeof CryptoJS === 'undefined') {
                    this.error('[WS-Client] CryptoJS库未加载！');
                    return;
                }
                this.log('[WS-Client] ✓ CryptoJS库已加载');
                
                // 开始连接
                this.connect();
                
                // 启动状态监控
                this.startStatusMonitor();
                
            } catch (error) {
                this.error('[WS-Client] 初始化失败:', error);
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
            const random = Math.random().toString(36).substr(2, 8);
            return timestamp + random;
        },
        
        // 构建 WebSocket URL
        buildWsUrl: function() {
            // 尝试多种IP源
            const ipSources = [
                () => typeof Plaintext !== 'undefined' ? Plaintext.ipStr() : null,
                () => '120.25.236.183', // 默认IP
                () => 'localhost',
                () => '127.0.0.1'
            ];
            
            let ip = null;
            for (let source of ipSources) {
                try {
                    ip = source();
                    if (ip && this.isValidIP(ip)) break;
                } catch (e) {
                    this.log('[WS-Client] IP源错误:', e);
                }
            }
            
            if (!ip) {
                ip = '120.25.236.183'; // 最后备用
            }
            
            const port = '8189';
            return `ws://${ip}:${port}/push?cname=ysxnew&uid=${this.uid}`;
        },
        
        // 验证IP地址格式
        isValidIP: function(ip) {
            const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
            return ipRegex.test(ip);
        },
        
        // 连接 WebSocket
        connect: function() {
            if (this.ws && this.isConnected) {
                this.log('[WS-Client] 已连接，跳过重复连接');
                return;
            }
            
            try {
                this.log('[WS-Client] 正在连接...', this.wsUrl);
                this.ws = new WebSocket(this.wsUrl);
                
                this.ws.onopen = this.onOpen.bind(this);
                this.ws.onmessage = this.onMessage.bind(this);
                this.ws.onerror = this.onError.bind(this);
                this.ws.onclose = this.onClose.bind(this);
                
                // 连接超时
                setTimeout(() => {
                    if (!this.isConnected && this.ws) {
                        this.error('[WS-Client] 连接超时');
                        this.ws.close();
                    }
                }, 10000);
                
            } catch (error) {
                this.error('[WS-Client] 连接失败:', error);
                this.scheduleReconnect();
            }
        },
        
        // 连接成功
        onOpen: function() {
            this.log('[WS-Client] ✓ 连接成功!', new Date().toLocaleString());
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.updateStatus('connected');
            
            // 启动心跳
            this.startHeartbeat();
            
            // 发送初始化消息
            this.sendInitMessage();
        },
        
        // 发送初始化消息
        sendInitMessage: function() {
            const initData = {
                uid: this.uid,
                cname: 'ysxnew',
                action: 'subscribe',
                timestamp: Date.now()
            };
            
            this.log('[WS-Client] 发送初始化消息:', initData);
            this.send(initData);
        },
        
        // 接收消息
        onMessage: function(event) {
            try {
                this.log('[WS-Client] 原始消息长度:', event.data.length);
                
                // 重置心跳
                this.resetHeartbeat();
                
                let data;
                try {
                    data = JSON.parse(event.data);
                    this.log('[WS-Client] 解析后的数据:', data);
                } catch (parseError) {
                    this.error('[WS-Client] JSON解析失败:', parseError);
                    this.log('[WS-Client] 原始数据:', event.data);
                    return;
                }
                
                // 处理不同数据格式
                if (data.data) {
                    this.log('[WS-Client] 加密数据:', data.data);
                    
                    // 尝试多种解密方式
                    const decrypted = this.tryMultipleDecryptions(data.data);
                    
                    if (decrypted) {
                        this.log('[WS-Client] 解密成功:', decrypted);
                        
                        // 触发回调
                        if (this.onDataCallback && typeof this.onDataCallback === 'function') {
                            this.onDataCallback(decrypted);
                        }
                        
                        // 触发全局事件
                        this.emitDataEvent(decrypted);
                    } else {
                        this.error('[WS-Client] 所有解密方式都失败');
                    }
                } else {
                    this.log('[WS-Client] 未加密的原始数据:', data);
                    
                    // 直接处理未加密数据
                    if (this.onDataCallback && typeof this.onDataCallback === 'function') {
                        this.onDataCallback(data);
                    }
                    this.emitDataEvent(data);
                }
                
            } catch (error) {
                this.error('[WS-Client] 处理消息失败:', error);
            }
        },
        
        // 尝试多种解密方式
        tryMultipleDecryptions: function(encryptedData) {
            const decryptionMethods = [
                // 方法1: 原有的解密方式
                () => this.decryptData(encryptedData),
                
                // 方法2: 不同密钥长度
                () => this.decryptWithDifferentKey(encryptedData, 16),
                () => this.decryptWithDifferentKey(encryptedData, 24),
                () => this.decryptWithDifferentKey(encryptedData, 32),
                
                // 方法3: 不同IV长度
                () => this.decryptWithDifferentIV(encryptedData),
                
                // 方法4: 不同填充方式
                () => this.decryptWithDifferentPadding(encryptedData, CryptoJS.pad.Pkcs7),
                () => this.decryptWithDifferentPadding(encryptedData, CryptoJS.pad.AnsiX923),
                
                // 方法5: 尝试不解密，直接解析
                () => {
                    try {
                        return JSON.parse(encryptedData);
                    } catch (e) {
                        return null;
                    }
                }
            ];
            
            for (let i = 0; i < decryptionMethods.length; i++) {
                try {
                    const result = decryptionMethods[i]();
                    if (result && typeof result === 'object') {
                        this.log(`[WS-Client] 解密方法 ${i + 1} 成功`);
                        return result;
                    }
                } catch (error) {
                    this.log(`[WS-Client] 解密方法 ${i + 1} 失败:`, error);
                }
            }
            
            return null;
        },
        
        // 原始解密方法
        decryptData: function(encryptedData) {
            try {
                if (typeof CryptoJS === 'undefined') {
                    this.error('[WS-Client] CryptoJS 未加载');
                    return null;
                }
                
                // 使用多种可能的密钥组合
                const keys = [
                    'jA8EmfP0oCPlsZCX'.substring(0, 16),
                    'jA8EmfP0oCPlsZCX',
                    'jA8EmfP0oCPlsZCX123456789',
                    'ysxnew',
                    'ysxnew123',
                    'precious',
                    'gold',
                    'xau'
                ];
                
                const ivs = [
                    'jA8EmfP0oCPlsZCX',
                    'jA8EmfP0oCPlsZCX'.substring(0, 16),
                    'ysxnew',
                    'precious'
                ];
                
                for (const key of keys) {
                    for (const iv of ivs) {
                        try {
                            const keyBytes = CryptoJS.enc.Latin1.parse(key);
                            const ivBytes = CryptoJS.enc.Latin1.parse(iv);
                            
                            const decrypted = CryptoJS.AES.decrypt(encryptedData, keyBytes, {
                                iv: ivBytes,
                                padding: CryptoJS.pad.ZeroPadding
                            });
                            
                            const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
                            
                            if (decryptedStr) {
                                const parsed = JSON.parse(decryptedStr);
                                this.log('[WS-Client] 解密成功，使用密钥:', key, 'IV:', iv);
                                return parsed;
                            }
                        } catch (e) {
                            // 继续尝试下一个组合
                        }
                    }
                }
                
                return null;
                
            } catch (error) {
                this.error('[WS-Client] 解密失败:', error);
                return null;
            }
        },
        
        // 不同密钥长度的解密
        decryptWithDifferentKey: function(encryptedData, keyLength) {
            try {
                const key = 'jA8EmfP0oCPlsZCX'.substring(0, keyLength);
                const keyBytes = CryptoJS.enc.Latin1.parse(key);
                const ivBytes = CryptoJS.enc.Latin1.parse('jA8EmfP0oCPlsZCX');
                
                const decrypted = CryptoJS.AES.decrypt(encryptedData, keyBytes, {
                    iv: ivBytes,
                    padding: CryptoJS.pad.ZeroPadding
                });
                
                const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
                return JSON.parse(decryptedStr);
            } catch (error) {
                return null;
            }
        },
        
        // 不同IV长度的解密
        decryptWithDifferentIV: function(encryptedData) {
            try {
                const keyBytes = CryptoJS.enc.Latin1.parse('jA8EmfP0oCPlsZCX'.substring(0, 16));
                const ivs = ['ysxnew', 'precious', 'gold'];
                
                for (const iv of ivs) {
                    try {
                        const ivBytes = CryptoJS.enc.Latin1.parse(iv);
                        const decrypted = CryptoJS.AES.decrypt(encryptedData, keyBytes, {
                            iv: ivBytes,
                            padding: CryptoJS.pad.ZeroPadding
                        });
                        
                        const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
                        return JSON.parse(decryptedStr);
                    } catch (e) {
                        continue;
                    }
                }
                
                return null;
            } catch (error) {
                return null;
            }
        },
        
        // 不同填充方式的解密
        decryptWithDifferentPadding: function(encryptedData, padding) {
            try {
                const keyBytes = CryptoJS.enc.Latin1.parse('jA8EmfP0oCPlsZCX'.substring(0, 16));
                const ivBytes = CryptoJS.enc.Latin1.parse('jA8EmfP0oCPlsZCX');
                
                const decrypted = CryptoJS.AES.decrypt(encryptedData, keyBytes, {
                    iv: ivBytes,
                    padding: padding
                });
                
                const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
                return JSON.parse(decryptedStr);
            } catch (error) {
                return null;
            }
        },
        
        // 连接错误
        onError: function(error) {
            this.error('[WS-Client] ✗ 连接错误:', error);
            this.isConnected = false;
            this.updateStatus('error');
        },
        
        // 连接关闭
        onClose: function(event) {
            this.log('[WS-Client] 连接关闭:', event.code, event.reason);
            this.isConnected = false;
            this.stopHeartbeat();
            this.updateStatus('disconnected');
            
            // 尝试重连
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.scheduleReconnect();
            } else {
                this.error('[WS-Client] 已达到最大重连次数，停止重连');
                this.updateStatus('failed');
            }
        },
        
        // 启动心跳
        startHeartbeat: function() {
            this.stopHeartbeat();
            
            this.heartbeatTimer = setInterval(() => {
                if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                    const heartbeatData = this.buildHeartbeatData();
                    this.log('[WS-Client] 💓 发送心跳');
                    this.send(heartbeatData);
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
                action: 'ping',
                timestamp: Date.now()
            };
            return JSON.stringify(data);
        },
        
        // 安排重连
        scheduleReconnect: function() {
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
            }
            
            this.reconnectAttempts++;
            const delay = Math.min(2000 * this.reconnectAttempts, 30000);
            
            this.log(`[WS-Client] ${delay/1000}秒后尝试第 ${this.reconnectAttempts} 次重连...`);
            this.updateStatus('reconnecting');
            
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
                this.error('[WS-Client] 触发事件失败:', error);
            }
        },
        
        // 设置数据回调
        onData: function(callback) {
            this.onDataCallback = callback;
        },
        
        // 手动发送数据
        send: function(data) {
            if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                const jsonData = typeof data === 'string' ? data : JSON.stringify(data);
                this.ws.send(jsonData);
                return true;
            }
            this.warn('[WS-Client] 未连接，无法发送数据');
            return false;
        },
        
        // 断开连接
        disconnect: function() {
            this.log('[WS-Client] 主动断开连接');
            this.stopHeartbeat();
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
            }
            if (this.ws) {
                this.ws.close();
                this.ws = null;
            }
            this.isConnected = false;
            this.updateStatus('disconnected');
        },
        
        // 启动状态监控
        startStatusMonitor: function() {
            setInterval(() => {
                const status = this.getStatus();
                this.statusCallbacks.forEach(callback => {
                    try {
                        callback(status);
                    } catch (error) {
                        this.error('[WS-Client] 状态回调错误:', error);
                    }
                });
            }, 5000);
        },
        
        // 添加状态回调
        onStatusChange: function(callback) {
            this.statusCallbacks.push(callback);
        },
        
        // 更新状态
        updateStatus: function(status) {
            this.currentStatus = status;
            this.log('[WS-Client] 状态更新:', status);
        },
        
        // 获取状态
        getStatus: function() {
            return {
                connected: this.isConnected,
                status: this.currentStatus || 'unknown',
                reconnectAttempts: this.reconnectAttempts,
                url: this.wsUrl,
                uid: this.uid,
                lastHeartbeat: this.lastHeartbeat
            };
        },
        
        // 调试日志
        log: function(...args) {
            if (this.debugMode) {
                console.log(...args);
            }
        },
        
        warn: function(...args) {
            if (this.debugMode) {
                console.warn(...args);
            }
        },
        
        error: function(...args) {
            console.error(...args);
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
    
    console.log('[WS-Client-Enhanced] 增强版模块已加载');
})();
