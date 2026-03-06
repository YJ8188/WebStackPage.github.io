/**
 * 移动端ERP - 工具函数
 * 包含: 格式化、验证、防抖节流等
 */

const Utils = {
  // ==================== 格式化 ====================

  timezone: 'Asia/Shanghai',

  // 格式化金额
  formatMoney(amount, currency = '¥') {
    if (amount === null || amount === undefined) return '-';
    const num = Number(amount);
    if (isNaN(num)) return '-';
    return `${currency}${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  },

  // 格式化日期
  formatDate(date, format = 'YYYY-MM-DD') {
    if (!date) return '-';
    const d = this.parseDate(date);
    if (isNaN(d.getTime())) return '-';
    const parts = this.getDateParts(d);
    if (!parts) return '-';
    const year = parts.year;
    const month = parts.month;
    const day = parts.day;
    const hour = parts.hour;
    const minute = parts.minute;
    const second = parts.second;

    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hour)
      .replace('mm', minute)
      .replace('ss', second);
  },

  // 格式化相对时间
  formatRelativeTime(date) {
    if (!date) return '-';
    const d = this.parseDate(date);
    if (isNaN(d.getTime())) return '-';

    const now = Date.now();
    const diff = now - d.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return this.formatDate(date);
  },

  // 格式化数字
  formatNumber(num, decimals = 0) {
    if (num === null || num === undefined) return '-';
    const n = Number(num);
    if (isNaN(n)) return '-';
    return n.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  // 格式化百分比
  formatPercent(value, decimals = 2) {
    if (value === null || value === undefined) return '-';
    const n = Number(value);
    if (isNaN(n)) return '-';
    return `${(n * 100).toFixed(decimals)}%`;
  },

  // 格式化手机号
  formatPhone(phone) {
    if (!phone) return '-';
    const str = String(phone).replace(/\D/g, '');
    if (str.length === 11) {
      return str.replace(/(\d{3})(\d{4})(\d{4})/, '$1 $2 $3');
    }
    return phone;
  },

  // ==================== 验证 ====================

  // 验证手机号
  validatePhone(phone) {
    return /^1[3-9]\d{9}$/.test(phone);
  },

  // 验证邮箱
  validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  // 验证身份证
  validateIdCard(idCard) {
    return /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/.test(idCard);
  },

  // 验证数字
  validateNumber(value) {
    return !isNaN(Number(value));
  },

  // 验证正整数
  validatePositiveInteger(value) {
    return /^\d+$/.test(value) && Number(value) > 0;
  },

  // ==================== 防抖节流 ====================

  // 防抖
  debounce(fn, delay = 300) {
    let timer = null;
    return function (...args) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        fn.apply(this, args);
      }, delay);
    };
  },

  // 节流
  throttle(fn, delay = 300) {
    let lastTime = 0;
    return function (...args) {
      const now = Date.now();
      if (now - lastTime >= delay) {
        fn.apply(this, args);
        lastTime = now;
      }
    };
  },

  // ==================== DOM操作 ====================

  // 查询元素
  $(selector, context = document) {
    return context.querySelector(selector);
  },

  // 查询所有元素
  $$(selector, context = document) {
    return Array.from(context.querySelectorAll(selector));
  },

  // 创建元素
  createElement(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);

    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'className') {
        el.className = value;
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(el.style, value);
      } else if (key.startsWith('on')) {
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else {
        el.setAttribute(key, value);
      }
    });

    children.forEach(child => {
      if (typeof child === 'string') {
        el.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        el.appendChild(child);
      }
    });

    return el;
  },

  // ==================== 数据处理 ====================

  // 深拷贝
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (obj instanceof Array) return obj.map(item => this.deepClone(item));
    if (obj instanceof Object) {
      const clone = {};
      Object.keys(obj).forEach(key => {
        clone[key] = this.deepClone(obj[key]);
      });
      return clone;
    }
  },

  // 对象合并
  merge(target, ...sources) {
    sources.forEach(source => {
      Object.keys(source).forEach(key => {
        if (source[key] instanceof Object && !Array.isArray(source[key])) {
          target[key] = this.merge(target[key] || {}, source[key]);
        } else {
          target[key] = source[key];
        }
      });
    });
    return target;
  },

  // 数组去重
  unique(arr, key = null) {
    if (!key) {
      return [...new Set(arr)];
    }
    const seen = new Set();
    return arr.filter(item => {
      const value = item[key];
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
  },

  // 数组分组
  groupBy(arr, key) {
    return arr.reduce((groups, item) => {
      const value = typeof key === 'function' ? key(item) : item[key];
      (groups[value] = groups[value] || []).push(item);
      return groups;
    }, {});
  },

  // ==================== URL处理 ====================

  // 解析查询参数
  parseQuery(url = window.location.href) {
    const query = {};
    const queryString = url.split('?')[1];
    if (queryString) {
      queryString.split('&').forEach(pair => {
        const [key, value] = pair.split('=');
        query[decodeURIComponent(key)] = decodeURIComponent(value);
      });
    }
    return query;
  },

  // 构建查询参数
  buildQuery(params) {
    return Object.entries(params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  },

  // ==================== 存储处理 ====================

  // 获取文件大小
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  },

  // ==================== 其他 ====================

  // 生成UUID
  uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  // 延迟执行
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // 复制到剪贴板
  async copyToClipboard(text) {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success;
      }
    } catch (error) {
      console.error('复制失败:', error);
      return false;
    }
  },

  // 获取订单状态文本
  getOrderStatusText(status) {
    const statusMap = {
      'pending': '待处理',
      'approved': '已确认',
      'confirmed': '已确认',
      'processing': '处理中',
      'shipped': '已发货',
      'delivered': '已送达',
      'signed': '已签收',
      'completed': '已完成',
      'cancelled': '已取消'
    };
    return statusMap[status] || status;
  },

  // 获取订单状态颜色
  getOrderStatusColor(status) {
    const colorMap = {
      'pending': 'warning',
      'approved': 'info',
      'confirmed': 'info',
      'processing': 'primary',
      'shipped': 'primary',
      'delivered': 'success',
      'signed': 'success',
      'completed': 'success',
      'cancelled': 'error'
    };
    return colorMap[status] || 'default';
  },

  // 计算订单总额
  calculateOrderTotal(items) {
    if (!Array.isArray(items)) return 0;
    return items.reduce((total, item) => {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 0;
      return total + (price * quantity);
    }, 0);
  },

  // 检查库存是否充足
  checkStockSufficient(product, quantity) {
    const stock = Number(product.stock_quantity) || 0;
    const required = Number(quantity) || 0;
    return stock >= required;
  },

  // 检查库存预警
  checkStockWarning(product) {
    const stock = Number(product.stock_quantity) || 0;
    const minStock = Number(product.min_stock) || 0;
    return minStock > 0 ? stock <= minStock : stock <= 3;
  },

  parseDate(value) {
    if (value instanceof Date) {
      return new Date(value.getTime());
    }
    const raw = String(value ?? '').trim();
    if (!raw) return new Date(NaN);
    const hasExplicitTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
    if (!hasExplicitTimezone) {
      const plainMatch = raw.match(
        /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
      );
      if (plainMatch) {
        const year = Number(plainMatch[1]);
        const month = Number(plainMatch[2]);
        const day = Number(plainMatch[3]);
        const hour = Number(plainMatch[4] || 0);
        const minute = Number(plainMatch[5] || 0);
        const second = Number(plainMatch[6] || 0);
        return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second));
      }
    }
    const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
    return new Date(normalized);
  },

  getDateParts(dateInput) {
    const date = this.parseDate(dateInput);
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return null;
    }
    const formatter = new Intl.DateTimeFormat('zh-CN', {
      timeZone: this.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const partMap = {};
    formatter.formatToParts(date).forEach((part) => {
      if (part?.type && part.type !== 'literal') {
        partMap[part.type] = String(part.value || '').padStart(part.type === 'year' ? 4 : 2, '0');
      }
    });
    if (!partMap.year || !partMap.month || !partMap.day) {
      return null;
    }
    return partMap;
  }
};

// 导出全局实例
window.Utils = Utils;
