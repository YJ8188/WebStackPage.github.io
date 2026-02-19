/**
 * 移动端ERP - 本地存储
 * 负责: LocalStorage、SessionStorage、IndexedDB封装
 */

class Storage {
  constructor() {
    this.prefix = 'mobile_erp_';
    this.db = null;
    this.initIndexedDB();
  }

  // 初始化IndexedDB
  async initIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('MobileERP', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 创建对象存储
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('offline_queue')) {
          const store = db.createObjectStore('offline_queue', { keyPath: 'id', autoIncrement: true });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  // ==================== LocalStorage ====================

  // 设置数据
  set(key, value, ttl = null) {
    try {
      const data = {
        value,
        timestamp: Date.now(),
        ttl
      };
      localStorage.setItem(this.prefix + key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Storage.set 失败:', error);
      return false;
    }
  }

  // 获取数据
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(this.prefix + key);
      if (!item) return defaultValue;

      const data = JSON.parse(item);

      // 检查是否过期
      if (data.ttl && Date.now() - data.timestamp > data.ttl) {
        this.remove(key);
        return defaultValue;
      }

      return data.value;
    } catch (error) {
      console.error('Storage.get 失败:', error);
      return defaultValue;
    }
  }

  // 删除数据
  remove(key) {
    try {
      localStorage.removeItem(this.prefix + key);
      return true;
    } catch (error) {
      console.error('Storage.remove 失败:', error);
      return false;
    }
  }

  // 清空所有数据
  clear() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      });
      return true;
    } catch (error) {
      console.error('Storage.clear 失败:', error);
      return false;
    }
  }

  // ==================== SessionStorage ====================

  setSession(key, value) {
    try {
      sessionStorage.setItem(this.prefix + key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Storage.setSession 失败:', error);
      return false;
    }
  }

  getSession(key, defaultValue = null) {
    try {
      const item = sessionStorage.getItem(this.prefix + key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Storage.getSession 失败:', error);
      return defaultValue;
    }
  }

  removeSession(key) {
    try {
      sessionStorage.removeItem(this.prefix + key);
      return true;
    } catch (error) {
      console.error('Storage.removeSession 失败:', error);
      return false;
    }
  }

  // ==================== IndexedDB 缓存 ====================

  async setCache(key, value, ttl = 3600000) {
    if (!this.db) await this.initIndexedDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');

      const data = {
        key,
        value,
        timestamp: Date.now(),
        ttl
      };

      const request = store.put(data);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async getCache(key) {
    if (!this.db) await this.initIndexedDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const request = store.get(key);

      request.onsuccess = () => {
        const data = request.result;

        if (!data) {
          resolve(null);
          return;
        }

        // 检查是否过期
        if (data.ttl && Date.now() - data.timestamp > data.ttl) {
          this.removeCache(key);
          resolve(null);
          return;
        }

        resolve(data.value);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async removeCache(key) {
    if (!this.db) await this.initIndexedDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.delete(key);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async clearCache() {
    if (!this.db) await this.initIndexedDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== 离线队列 ====================

  async addToOfflineQueue(action) {
    if (!this.db) await this.initIndexedDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['offline_queue'], 'readwrite');
      const store = transaction.objectStore('offline_queue');

      const data = {
        ...action,
        timestamp: Date.now()
      };

      const request = store.add(data);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getOfflineQueue() {
    if (!this.db) await this.initIndexedDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['offline_queue'], 'readonly');
      const store = transaction.objectStore('offline_queue');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async removeFromOfflineQueue(id) {
    if (!this.db) await this.initIndexedDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['offline_queue'], 'readwrite');
      const store = transaction.objectStore('offline_queue');
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async clearOfflineQueue() {
    if (!this.db) await this.initIndexedDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['offline_queue'], 'readwrite');
      const store = transaction.objectStore('offline_queue');
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }
}

// 导出全局实例
window.Storage = new Storage();
