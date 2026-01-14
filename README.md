# 网站导航系统

一个功能完善的个人网址导航站，支持用户登录、数据同步、个性化定制等功能。

## ✨ 功能特性

### 🔐 用户系统
- 用户注册与登录（基于 Supabase）
- 自动登录状态保持
- 安全的身份验证

### 💾 数据同步
- 本地存储（localStorage）快速响应
- 云端数据库（Supabase）自动同步
- 多设备数据一致性
- 登录后自动加载用户设置

### 📋 收藏管理
- 添加自定义收藏链接
- 删除收藏
- 导出收藏数据（JSON 备份）
- 导入收藏数据
- 收藏图标自动获取

### 🎨 个性化设置
- 黑暗模式切换与记忆
- 卡片显示/隐藏
- 卡片拖拽排序（支持跨栏）
- 通知中心状态记忆

### 🔔 通知中心
- 自定义提醒事项
- 提醒时间管理
- 提醒数据持久化
- 提醒状态实时更新

### 🎯 性能优化
- 本地操作毫秒级响应
- 数据库后台异步同步
- 无阻塞用户体验
- 智能数据加载策略

## 🧱 技术栈

### 前端
- HTML5
- CSS3
- JavaScript (ES6+)
- jQuery 3.6.0
- Bootstrap 3
- Font Awesome

### 后端
- Supabase（PostgreSQL 数据库）
- Row Level Security (RLS)
- RESTful API

### 其他
- Xenon UI（WebStack 原模板）
- Clipboard API
- Drag & Drop API
- LocalStorage API

## 📁 项目结构

```
.
├── index.html              # 首页（导航主页面）
├── login.html             # 登录/注册页面
├── about.html             # 关于页面
├── rls-debug.html         # 数据库调试工具
├── assets/
│   ├── css/              # 样式文件
│   │   ├── bootstrap.css
│   │   ├── nav.css
│   │   └── ...
│   ├── js/               # JavaScript 脚本
│   │   ├── auth.js              # 用户认证
│   │   ├── user-data.js         # 用户数据管理
│   │   ├── notification.js      # 通知中心
│   │   ├── supabase-config.js  # Supabase 配置
│   │   ├── crypto.js           # 加密货币数据
│   │   ├── metalsData.js       # 贵金属数据
│   │   └── ...
│   ├── images/           # 图片资源
│   │   ├── logos/
│   │   └── ...
│   └── fonts/           # 字体与图标
└── README.md            # 项目说明文档
```

## 🚀 快速开始

### 环境要求
- 现代浏览器（Chrome、Firefox、Edge、Safari）
- 稳定的网络连接（用于数据库同步）

### 本地运行
1. 克隆项目
```bash
git clone <repository-url>
cd WebStackPage.github.io-master
```

2. 直接打开 `index.html` 文件，或使用本地服务器
```bash
# 使用 Python
python -m http.server 8000

# 使用 Node.js
npx serve

# 使用 PHP
php -S localhost:8000
```

3. 访问 `http://localhost:8000`

### 配置 Supabase

1. 在 [Supabase](https://supabase.com) 创建项目
2. 创建数据库表 `user_config`：
```sql
CREATE TABLE user_config (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    dark_mode BOOLEAN DEFAULT false,
    hidden_cards TEXT[] DEFAULT '{}',
    card_order TEXT[] DEFAULT '{}',
    notification_panel_open BOOLEAN DEFAULT false,
    reminders JSONB DEFAULT '[]',
    favorites JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加唯一约束
ALTER TABLE user_config 
ADD CONSTRAINT user_config_user_id_key UNIQUE (user_id);

-- 禁用 RLS（可选，根据需求调整）
ALTER TABLE user_config DISABLE ROW LEVEL SECURITY;
```

3. 在 `assets/js/supabase-config.js` 中配置 API 密钥：
```javascript
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
```

## 📖 使用说明

### 用户注册与登录
1. 点击页面右上角的登录按钮
2. 输入邮箱和密码
3. 点击注册或登录
4. 登录成功后，您的设置会自动同步到云端

### 添加收藏
1. 点击"我的收藏"区域的"添加收藏"按钮
2. 填写网站标题和链接
3. 可选：填写描述和自定义图标
4. 点击"保存链接"
5. 收藏会立即显示并自动同步到云端

### 管理卡片
- **隐藏卡片**：点击卡片右上角的"×"按钮
- **显示卡片**：在隐藏卡片管理面板中点击"恢复显示"
- **排序卡片**：拖拽卡片到目标位置（支持跨栏）

### 通知中心
1. 点击页面右上角的铃铛图标
2. 点击"添加提醒"
3. 填写提醒内容和时间
4. 点击"保存"
5. 提醒会在指定时间通知您

### 数据备份与恢复
- **导出**：点击"备份收藏数据"按钮，下载 JSON 文件
- **导入**：点击"恢复收藏数据"按钮，选择 JSON 文件导入

## 🔧 开发说明

### 代码规范
- 使用 ES6+ 语法
- 遵循函数式编程原则
- 异步操作使用 async/await 或 Promise
- 添加详细的控制台日志用于调试

### 性能优化策略
1. **本地优先**：所有操作先更新 localStorage，立即响应
2. **后台同步**：数据库操作异步执行，不阻塞 UI
3. **智能加载**：根据场景选择从 localStorage 或数据库加载
4. **事件驱动**：使用自定义事件协调模块间通信

### 数据流
```
用户操作 → localStorage → UI 更新（立即）
         ↓
    数据库同步（后台异步）
```

### 调试工具
- 打开浏览器开发者工具（F12）
- 查看控制台日志
- 使用 `rls-debug.html` 测试数据库连接

## 📦 部署

### 静态托管平台
- **GitHub Pages**
- **Vercel**
- **Netlify**
- **Cloudflare Pages**

### 服务器部署
1. 将项目文件上传到服务器
2. 配置 Nginx 或 Apache
3. 启用 HTTPS（推荐）

### 环境变量
如果使用 CI/CD，配置以下环境变量：
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 开发流程
1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📝 更新日志

### v2.0.0 (2026-01-14)
- ✨ 新增用户登录系统
- ✨ 新增数据云端同步功能
- ✨ 新增收藏管理功能
- ✨ 新增通知中心
- ✨ 新增卡片隐藏/排序功能
- ⚡ 性能优化：本地操作立即响应
- 🔧 修复数据持久化问题
- 📚 完善文档

### v1.0.0
- 🎉 初始版本发布
- 📱 响应式设计
- 🔍 站内搜索功能
- 🎨 自定义主题

## 📄 开源协议

本项目基于 MIT 协议开源。

## 🙏 致谢

- [WebStackPage](https://github.com/WebStackPage/WebStackPage.github.io) - 原始项目
- [Supabase](https://supabase.com) - 后端服务
- [Bootstrap](https://getbootstrap.com) - UI 框架
- [Font Awesome](https://fontawesome.com) - 图标库

## 📬 联系方式

- 邮箱：34296407@qq.com
- 网站：https://hq168.dpdns.org

---

> 本项目持续更新中，如有问题或建议，欢迎联系交流。
