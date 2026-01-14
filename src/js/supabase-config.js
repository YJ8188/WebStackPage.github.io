/**
 * Supabase配置模块
 * 提供数据库连接和认证功能
 */

// Supabase配置
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://yzyhtqiwcbpqsglfbvqa.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_hgJCIbPhEyiCOWHV1hJMeg_QArg-t_v';

// 创建Supabase客户端
export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * 安全的创建客户端函数
 * @param {string} url - Supabase URL
 * @param {string} key - Supabase密钥
 * @returns {Object} Supabase客户端实例
 */
function createClient(url, key) {
  try {
    return window.supabase.createClient(url, key);
  } catch (error) {
    console.error('[Supabase] 创建客户端失败:', error);
    throw new Error('数据库连接失败，请检查网络连接');
  }
}

/**
 * 数据库表名常量
 */
export const TABLES = {
  USER_CONFIG: 'user_config',
  USER_FAVORITES: 'user_favorites',
  USER_REMINDERS: 'user_reminders',
  USER_NOTIFICATIONS: 'user_notifications'
};

/**
 * 安全的数据库查询函数
 * @param {string} tableName - 表名
 * @param {Object} options - 查询选项
 * @returns {Promise} 查询结果
 */
export async function safeQuery(tableName, options = {}) {
  try {
    const { data, error } = await supabaseClient
      .from(tableName)
      .select(options.select || '*')
      .eq(options.column, options.value)
      .order(options.order)
      .limit(options.limit)
      .single(options.single || false);
    
    if (error) {
      console.error(`[Supabase] 查询失败: ${tableName}`, error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error(`[Supabase] 查询异常: ${tableName}`, error);
    throw error;
  }
}

/**
 * 安全的数据库插入函数
 * @param {string} tableName - 表名
 * @param {Object} record - 要插入的数据
 * @returns {Promise} 插入结果
 */
export async function safeInsert(tableName, record) {
  try {
    const { data, error } = await supabaseClient
      .from(tableName)
      .insert(record)
      .select();
    
    if (error) {
      console.error(`[Supabase] 插入失败: ${tableName}`, error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error(`[Supabase] 插入异常: ${tableName}`, error);
    throw error;
  }
}

/**
 * 安全的数据库更新函数
 * @param {string} tableName - 表名
 * @param {Object} record - 要更新的数据
 * @param {string} column - 条件列名
 * @param {*} value - 条件值
 * @returns {Promise} 更新结果
 */
export async function safeUpdate(tableName, record, column, value) {
  try {
    const { data, error } = await supabaseClient
      .from(tableName)
      .update(record)
      .eq(column, value)
      .select();
    
    if (error) {
      console.error(`[Supabase] 更新失败: ${tableName}`, error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error(`[Supabase] 更新异常: ${tableName}`, error);
    throw error;
  }
}

/**
 * 安全的数据库删除函数
 * @param {string} tableName - 表名
 * @param {string} column - 条件列名
 * @param {*} value - 条件值
 * @returns {Promise} 删除结果
 */
export async function safeDelete(tableName, column, value) {
  try {
    const { data, error } = await supabaseClient
      .from(tableName)
      .delete()
      .eq(column, value)
      .select();
    
    if (error) {
      console.error(`[Supabase] 删除失败: ${tableName}`, error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error(`[Supabase] 删除异常: ${tableName}`, error);
    throw error;
  }
}

/**
 * 数据库健康检查
 * @returns {Promise<boolean>} 连接状态
 */
export async function checkConnection() {
  try {
    const { data, error } = await supabaseClient
      .from(TABLES.USER_CONFIG)
      .select('count')
      .limit(1);
    
    return !error && data !== null;
  } catch (error) {
    console.error('[Supabase] 连接检查失败:', error);
    return false;
  }
}

/**
 * 获取当前用户信息
 * @returns {Object|null} 用户信息或null
 */
export async function getCurrentUser() {
  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (error) {
      console.error('[Supabase] 获取用户会话失败:', error);
      return null;
    }
    
    return session?.user || null;
  } catch (error) {
    console.error('[Supabase] 获取用户信息异常:', error);
    return null;
  }
}

/**
 * 监听认证状态变化
 * @param {Function} callback - 回调函数
 */
export function onAuthStateChange(callback) {
  supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log(`[Supabase] 认证状态变化: ${event}`);
    
    if (event === 'SIGNED_IN' && session?.user) {
      callback({
        event: 'LOGIN',
        user: session.user,
        session: session
      });
    } else if (event === 'SIGNED_OUT') {
      callback({
        event: 'LOGOUT',
        user: null,
        session: null
      });
    } else if (event === 'TOKEN_REFRESHED') {
      callback({
        event: 'TOKEN_REFRESH',
        session: session
      });
    }
  });
}

/**
 * 登录函数
 * @param {string} email - 邮箱
 * @param {string} password - 密码
 * @returns {Promise<Object>} 登录结果
 */
export async function signIn(email, password) {
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      console.error('[Supabase] 登录失败:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, data, user: data.user, session: data.session };
  } catch (error) {
    console.error('[Supabase] 登录异常:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 注册函数
 * @param {string} email - 邮箱
 * @param {string} password - 密码
 * @returns {Promise<Object>} 注册结果
 */
export async function signUp(email, password) {
  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login.html`
      }
    });
    
    if (error) {
      console.error('[Supabase] 注册失败:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, data, user: data.user };
  } catch (error) {
    console.error('[Supabase] 注册异常:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 登出函数
 * @returns {Promise<Object>} 登出结果
 */
export async function signOut() {
  try {
    const { error } = await supabaseClient.auth.signOut();
    
    if (error) {
      console.error('[Supabase] 登出失败:', error);
      return { success: false, error: error.message };
    }
    
    // 清除本地存储的用户数据
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userToken');
    
    return { success: true };
  } catch (error) {
    console.error('[Supabase] 登出异常:', error);
    return { success: false, error: error.message };
  }
}

// 导出默认配置
export default {
  client: supabaseClient,
  tables: TABLES,
  createClient,
  safeQuery,
  safeInsert,
  safeUpdate,
  safeDelete,
  checkConnection,
  getCurrentUser,
  onAuthStateChange,
  signIn,
  signUp,
  signOut
};