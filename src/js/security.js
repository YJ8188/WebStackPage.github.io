/**
 * 安全管理模块
 * 负责用户认证、会话管理、安全策略等功能
 * 包含30天免登录功能
 */
export class SecurityManager {
  constructor(userDataManager, notificationManager) {
    this.userDataManager = userDataManager;
    this.notificationManager = notificationManager;
    this.sessionTimeout = 30 * 60 * 1000; // 30分钟会话超时
    this.rememberMeDays = 30; // 记住我天数
    this.maxLoginAttempts = 5; // 最大登录尝试次数
    this.lockoutDuration = 15 * 60 * 1000; // 锁定15分钟
    this.sessionTimer = null;
    this.currentUser = null;
    this.loginAttempts = new Map();
    this.lockedUsers = new Map();
    
    this.init();
  }

  /**
   * 初始化安全管理器
   */
  async init() {
    try {
      this.setupEventListeners();
      this.initializeSession();
      await this.checkAutoLogin();
      this.startSessionTimer();
      console.log('安全管理器初始化完成');
    } catch (error) {
      console.error('安全管理器初始化失败:', error);
      if (this.notificationManager) {
        this.notificationManager.error('安全系统初始化失败');
      }
    }
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 登录表单提交
    document.addEventListener('submit', (e) => {
      if (e.target.classList.contains('login-form') || 
          e.target.id === 'login-form') {
        e.preventDefault();
        this.handleLogin(e.target);
      }
    });

    // 登出按钮点击
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('logout-btn') || 
          e.target.closest('.logout-btn')) {
        e.preventDefault();
        this.logout();
      }
    });

    // 记住我复选框变化
    document.addEventListener('change', (e) => {
      if (e.target.type === 'checkbox' && e.target.name === 'remember-me') {
        this.handleRememberMeChange(e.target);
      }
    });

    // 密码强度检查
    document.addEventListener('input', (e) => {
      if (e.target.type === 'password' && e.target.id === 'password') {
        this.checkPasswordStrength(e.target);
      }
    });

    // 页面可见性变化
    document.addEventListener('visibilitychange', () => {
      this.handleVisibilityChange();
    });

    // 鼠标移动和键盘活动
    document.addEventListener('mousemove', () => {
      this.resetSessionTimer();
    });

    document.addEventListener('keydown', () => {
      this.resetSessionTimer();
    });

    // 监听存储变化（多标签页同步）
    window.addEventListener('storage', (e) => {
      this.handleStorageChange(e);
    });
  }

  /**
   * 初始化会话
   */
  initializeSession() {
    const sessionId = this.getSessionId();
    const sessionData = this.getSessionData();
    
    if (sessionId && sessionData) {
      this.currentUser = sessionData.user;
      this.startSessionTimer();
    }
  }

  /**
   * 检查自动登录
   */
  async checkAutoLogin() {
    const rememberToken = this.getRememberToken();
    
    if (rememberToken && !this.currentUser) {
      try {
        const user = await this.validateRememberToken(rememberToken);
        if (user) {
          await this.createSession(user, true);
          this.notificationManager.success('已自动登录');
          
          // 重定向到主页
          if (window.location.pathname.includes('/login')) {
            window.location.href = '/';
          }
        } else {
          // Token无效，清除
          this.clearRememberToken();
        }
      } catch (error) {
        console.error('自动登录失败:', error);
        this.clearRememberToken();
      }
    }
  }

  /**
   * 处理登录
   */
  async handleLogin(form) {
    const formData = new FormData(form);
    const email = formData.get('email') || formData.get('username');
    const password = formData.get('password');
    const rememberMe = formData.get('remember-me') === 'on';
    
    // 基本验证
    if (!email || !password) {
      this.notificationManager.error('请输入邮箱和密码');
      return;
    }

    // 检查是否被锁定
    if (this.isUserLocked(email)) {
      const lockTime = this.lockedUsers.get(email);
      const remainingTime = Math.ceil((lockTime - Date.now()) / 60000);
      this.notificationManager.error(`账户已被锁定，请${remainingTime}分钟后重试`);
      return;
    }

    try {
      // 显示加载状态
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = '登录中...';

      // 验证用户凭据
      const user = await this.authenticateUser(email, password);
      
      if (user) {
        // 登录成功
        await this.createSession(user, rememberMe);
        
        // 清除登录尝试记录
        this.loginAttempts.delete(email);
        
        // 创建记住我Token
        if (rememberMe) {
          const token = this.generateRememberToken(user);
          this.saveRememberToken(token);
        }
        
        this.notificationManager.success('登录成功');
        
        // 重定向到主页
        window.location.href = '/';
        
      } else {
        // 登录失败
        this.handleLoginFailure(email);
      }
      
    } catch (error) {
      console.error('登录过程出错:', error);
      this.notificationManager.error('登录失败，请重试');
    } finally {
      // 恢复按钮状态
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  /**
   * 验证用户凭据
   */
  async authenticateUser(email, password) {
    try {
      // 这里实现实际的用户验证逻辑
      // 可以是从API、数据库或其他认证服务获取
      
      // 示例：从用户数据管理器验证
      const userData = await this.userDataManager.getUserData();
      const users = userData.users || [];
      
      const user = users.find(u => u.email === email || u.username === email);
      
      if (!user) {
        return null;
      }
      
      // 验证密码（实际应用中应该使用加密比较）
      const isValidPassword = await this.verifyPassword(password, user.password);
      
      if (!isValidPassword) {
        return null;
      }
      
      // 检查用户状态
      if (user.status !== 'active') {
        throw new Error('用户账户已被禁用');
      }
      
      // 更新最后登录时间
      user.lastLogin = new Date().toISOString();
      await this.userDataManager.updateUserData({ users });
      
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        avatar: user.avatar,
        role: user.role || 'user'
      };
      
    } catch (error) {
      console.error('用户验证失败:', error);
      return null;
    }
  }

  /**
   * 验证密码
   */
  async verifyPassword(inputPassword, storedPassword) {
    // 实际应用中应该使用加密算法如bcrypt
    // 这里简化为直接比较（不安全，仅用于演示）
    
    try {
      // 如果存储的是哈希值
      if (storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2a$')) {
        // 使用bcrypt验证
        // const bcrypt = await import('bcryptjs');
        // return await bcrypt.compare(inputPassword, storedPassword);
        
        // 临时方案：简单的哈希比较
        const hashedInput = await this.hashPassword(inputPassword);
        return hashedInput === storedPassword;
      } else {
        // 明文存储（仅用于演示，不推荐）
        return inputPassword === storedPassword;
      }
    } catch (error) {
      console.error('密码验证失败:', error);
      return false;
    }
  }

  /**
   * 哈希密码
   */
  async hashPassword(password) {
    // 实际应用中应该使用安全的哈希算法
    // 这里使用简单的哈希（仅用于演示）
    
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'salt'); // 添加盐值
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
  }

  /**
   * 处理登录失败
   */
  handleLoginFailure(email) {
    const attempts = (this.loginAttempts.get(email) || 0) + 1;
    this.loginAttempts.set(email, attempts);
    
    const remainingAttempts = this.maxLoginAttempts - attempts;
    
    if (remainingAttempts > 0) {
      this.notificationManager.error(
        `用户名或密码错误，还有${remainingAttempts}次尝试机会`
      );
    } else {
      // 锁定用户
      this.lockUser(email);
      this.notificationManager.error('登录失败次数过多，账户已被锁定15分钟');
    }
  }

  /**
   * 锁定用户
   */
  lockUser(email) {
    const lockUntil = Date.now() + this.lockoutDuration;
    this.lockedUsers.set(email, lockUntil);
    
    // 设置定时器解除锁定
    setTimeout(() => {
      this.lockedUsers.delete(email);
    }, this.lockoutDuration);
  }

  /**
   * 检查用户是否被锁定
   */
  isUserLocked(email) {
    const lockTime = this.lockedUsers.get(email);
    if (!lockTime) return false;
    
    if (Date.now() > lockTime) {
      // 锁定已过期
      this.lockedUsers.delete(email);
      return false;
    }
    
    return true;
  }

  /**
   * 创建会话
   */
  async createSession(user, rememberMe = false) {
    const sessionId = this.generateSessionId();
    const sessionData = {
      id: sessionId,
      user: user,
      createdAt: new Date().toISOString(),
      rememberMe: rememberMe,
      expiresAt: new Date(Date.now() + (rememberMe ? 
        this.rememberMeDays * 24 * 60 * 60 * 1000 : 
        this.sessionTimeout)).toISOString()
    };
    
    // 保存会话数据
    this.saveSessionData(sessionData);
    this.saveSessionId(sessionId);
    
    this.currentUser = user;
    
    // 更新UI
    this.updateUserInterface(user);
    
    // 启动会话计时器
    this.startSessionTimer();
    
    // 触发登录事件
    window.dispatchEvent(new CustomEvent('user:login', {
      detail: { user, rememberMe }
    }));
  }

  /**
   * 生成会话ID
   */
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 16);
  }

  /**
   * 生成记住我Token
   */
  generateRememberToken(user) {
    const tokenData = {
      userId: user.id,
      email: user.email,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.rememberMeDays * 24 * 60 * 60 * 1000).toISOString()
    };
    
    // 生成加密token
    const tokenString = btoa(JSON.stringify(tokenData));
    const signature = this.generateSignature(tokenString);
    
    return `${tokenString}.${signature}`;
  }

  /**
   * 验证记住我Token
   */
  async validateRememberToken(token) {
    try {
      const [tokenString, signature] = token.split('.');
      
      // 验证签名
      const expectedSignature = this.generateSignature(tokenString);
      if (signature !== expectedSignature) {
        return null;
      }
      
      const tokenData = JSON.parse(atob(tokenString));
      
      // 检查过期时间
      if (new Date(tokenData.expiresAt) < new Date()) {
        return null;
      }
      
      // 获取用户信息
      const userData = await this.userDataManager.getUserData();
      const users = userData.users || [];
      const user = users.find(u => u.id === tokenData.userId && u.email === tokenData.email);
      
      if (!user || user.status !== 'active') {
        return null;
      }
      
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        avatar: user.avatar,
        role: user.role || 'user'
      };
      
    } catch (error) {
      console.error('Token验证失败:', error);
      return null;
    }
  }

  /**
   * 生成签名
   */
  generateSignature(data) {
    // 简单的签名实现（实际应用中应使用更安全的签名算法）
    const encoder = new TextEncoder();
    const keyData = encoder.encode('signature-key'); // 应该使用安全的密钥
    const dataToSign = encoder.encode(data);
    
    // 这里使用简单的哈希作为签名（仅用于演示）
    return btoa(data + 'signature');
  }

  /**
   * 保存记住我Token
   */
  saveRememberToken(token) {
    localStorage.setItem('rememberToken', token);
    
    // 同时设置cookie作为备份
    const expires = new Date(Date.now() + this.rememberMeDays * 24 * 60 * 60 * 1000);
    document.cookie = `rememberToken=${token}; expires=${expires.toUTCString()}; path=/; secure; samesite=strict`;
  }

  /**
   * 获取记住我Token
   */
  getRememberToken() {
    return localStorage.getItem('rememberToken') || this.getCookie('rememberToken');
  }

  /**
   * 清除记住我Token
   */
  clearRememberToken() {
    localStorage.removeItem('rememberToken');
    document.cookie = 'rememberToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  }

  /**
   * 保存会话数据
   */
  saveSessionData(sessionData) {
    sessionStorage.setItem('sessionData', JSON.stringify(sessionData));
    
    // 如果启用记住我，也保存到localStorage
    if (sessionData.rememberMe) {
      localStorage.setItem('persistentSession', JSON.stringify(sessionData));
    }
  }

  /**
   * 获取会话数据
   */
  getSessionData() {
    let sessionData = sessionStorage.getItem('sessionData');
    
    if (!sessionData) {
      sessionData = localStorage.getItem('persistentSession');
    }
    
    if (sessionData) {
      try {
        const data = JSON.parse(sessionData);
        // 检查是否过期
        if (new Date(data.expiresAt) > new Date()) {
          return data;
        } else {
          // 会话过期，清理
          this.clearSession();
        }
      } catch (error) {
        console.error('解析会话数据失败:', error);
        this.clearSession();
      }
    }
    
    return null;
  }

  /**
   * 保存会话ID
   */
  saveSessionId(sessionId) {
    sessionStorage.setItem('sessionId', sessionId);
  }

  /**
   * 获取会话ID
   */
  getSessionId() {
    return sessionStorage.getItem('sessionId');
  }

  /**
   * 启动会话计时器
   */
  startSessionTimer() {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
    }
    
    this.sessionTimer = setTimeout(() => {
      this.handleSessionTimeout();
    }, this.sessionTimeout);
  }

  /**
   * 重置会话计时器
   */
  resetSessionTimer() {
    if (this.currentUser) {
      this.startSessionTimer();
    }
  }

  /**
   * 处理会话超时
   */
  async handleSessionTimeout() {
    if (this.currentUser) {
      this.notificationManager.warning('会话已超时，请重新登录');
      await this.logout();
    }
  }

  /**
   * 处理页面可见性变化
   */
  handleVisibilityChange() {
    if (document.hidden) {
      // 页面隐藏时暂停计时器
      if (this.sessionTimer) {
        clearTimeout(this.sessionTimer);
      }
    } else {
      // 页面显示时检查会话状态
      if (this.currentUser) {
        const sessionData = this.getSessionData();
        if (!sessionData) {
          this.notificationManager.warning('会话已过期，请重新登录');
          this.logout();
        } else {
          this.startSessionTimer();
        }
      }
    }
  }

  /**
   * 处理存储变化
   */
  handleStorageChange(e) {
    if (e.key === 'sessionData' && e.newValue === null) {
      // 其他标签页清除了会话
      this.currentUser = null;
      this.updateUserInterface(null);
    }
  }

  /**
   * 登出
   */
  async logout() {
    try {
      // 清理会话数据
      this.clearSession();
      
      // 如果不是记住我登录，清除记住我token
      const sessionData = this.getSessionData();
      if (!sessionData?.rememberMe) {
        this.clearRememberToken();
      }
      
      this.currentUser = null;
      
      // 停止会话计时器
      if (this.sessionTimer) {
        clearTimeout(this.sessionTimer);
        this.sessionTimer = null;
      }
      
      // 更新UI
      this.updateUserInterface(null);
      
      // 触发登出事件
      window.dispatchEvent(new CustomEvent('user:logout'));
      
      // 如果不在登录页，重定向到登录页
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login.html';
      }
      
      if (this.notificationManager) {
        this.notificationManager.success('已安全登出');
      }
      
    } catch (error) {
      console.error('登出失败:', error);
      if (this.notificationManager) {
        this.notificationManager.error('登出失败');
      }
    }
  }

  /**
   * 清理会话
   */
  clearSession() {
    sessionStorage.removeItem('sessionData');
    sessionStorage.removeItem('sessionId');
    localStorage.removeItem('persistentSession');
  }

  /**
   * 更新用户界面
   */
  updateUserInterface(user) {
    // 更新用户信息显示
    const userElements = document.querySelectorAll('.user-info, .user-name, .user-email');
    userElements.forEach(element => {
      if (user) {
        element.textContent = user.name || user.email || '用户';
      } else {
        element.textContent = '';
      }
    });

    // 更新用户头像
    const avatarElements = document.querySelectorAll('.user-avatar');
    avatarElements.forEach(element => {
      if (user && user.avatar) {
        element.src = user.avatar;
      } else {
        element.src = '/assets/images/default-avatar.png';
      }
    });

    // 显示/隐藏登录相关元素
    const loginElements = document.querySelectorAll('.login-required');
    const logoutElements = document.querySelectorAll('.logout-required');
    
    loginElements.forEach(element => {
      element.style.display = user ? 'none' : '';
    });
    
    logoutElements.forEach(element => {
      element.style.display = user ? '' : 'none';
    });
  }

  /**
   * 处理记住我变化
   */
  handleRememberMeChange(checkbox) {
    // 可以在这里添加用户提示
    if (checkbox.checked) {
      this.notificationManager.info('将在30天内保持登录状态');
    }
  }

  /**
   * 检查密码强度
   */
  checkPasswordStrength(passwordInput) {
    const password = passwordInput.value;
    const strengthBar = document.querySelector('.password-strength-bar');
    const strengthText = document.querySelector('.password-strength-text');
    
    if (!strengthBar || !strengthText) return;
    
    const strength = this.calculatePasswordStrength(password);
    
    // 更新强度条
    strengthBar.style.width = (strength.score * 20) + '%';
    strengthBar.className = 'password-strength-bar ' + strength.level;
    
    // 更新强度文本
    strengthText.textContent = strength.text;
    strengthText.className = 'password-strength-text ' + strength.level;
  }

  /**
   * 计算密码强度
   */
  calculatePasswordStrength(password) {
    let score = 0;
    let feedback = [];
    
    // 长度检查
    if (password.length >= 8) score += 1;
    else feedback.push('至少8个字符');
    
    if (password.length >= 12) score += 1;
    
    // 复杂性检查
    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('包含小写字母');
    
    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('包含大写字母');
    
    if (/[0-9]/.test(password)) score += 1;
    else feedback.push('包含数字');
    
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;
    else feedback.push('包含特殊字符');
    
    // 避免常见密码
    const commonPasswords = ['password', '123456', 'qwerty', 'admin'];
    if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
      score = Math.max(0, score - 2);
      feedback.push('避免使用常见密码');
    }
    
    const levels = ['very-weak', 'weak', 'fair', 'good', 'strong', 'very-strong'];
    const texts = ['非常弱', '弱', '一般', '良好', '强', '非常强'];
    
    return {
      score: Math.min(5, score),
      level: levels[Math.min(5, score)],
      text: texts[Math.min(5, score)],
      feedback: feedback
    };
  }

  /**
   * 获取当前用户
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * 检查是否已登录
   */
  isLoggedIn() {
    return this.currentUser !== null;
  }

  /**
   * 检查用户权限
   */
  hasPermission(permission) {
    if (!this.currentUser) return false;
    
    const userPermissions = {
      'admin': ['read', 'write', 'delete', 'manage'],
      'editor': ['read', 'write'],
      'user': ['read']
    };
    
    const userRole = this.currentUser.role || 'user';
    return userPermissions[userRole]?.includes(permission) || false;
  }

  /**
   * 获取Cookie
   */
  getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  /**
   * 生成CSRF Token
   */
  generateCSRFToken() {
    return Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
  }

  /**
   * 验证请求来源
   */
  validateOrigin(origin) {
    const allowedOrigins = [
      window.location.origin,
      'https://yourdomain.com',
      'https://www.yourdomain.com'
    ];
    
    return allowedOrigins.includes(origin);
  }
}

// 导出单例实例
export const securityManager = new SecurityManager();

// 导出到全局作用域（向后兼容）
window.securityManager = securityManager;