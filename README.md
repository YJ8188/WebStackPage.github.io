# 何哥的网站导航系统（WebStack 增强版）

一个基于静态页面（HTML/CSS/JS）的个人导航站，集成了：
- 账号登录（Supabase Auth）
- 收藏与个性化配置同步
- 提醒中心
- 轻量 ERP（客户/产品/订单/库存/财务）

---

## 最近更新（2026-02-12）

本次已完成的重点优化：

1. **登录页重做（更人性化）**
   - 登录页视觉改为简洁、商务化风格
   - 保留原登录/注册逻辑与字段 ID，不影响现有认证逻辑

2. **ERP 页面“去 AI 感”优化**
   - 视觉层次更稳重，减少炫技效果
   - 顶栏与快捷入口改为面向业务动作（新建订单/新增客户等）

3. **全站资源路径修复**
   - 统一改为同级路径：`assets/...`
   - 修复了本地打开时常见的样式/脚本/图片加载失败问题

4. **ERP 脚本稳定性修复**
   - 修复 `assets/js/erp.js` 中重复方法覆盖问题，降低模块加载异常概率

5. **顶栏交互功能可用化（ERP）**
   - 搜索、通知、用户菜单补齐交互逻辑
   - 通知中心支持点击空白处/按 ESC 关闭

6. **登录态与跳转修复**
   - 修复“已登录却仍提示去登录”的状态不同步问题
   - 登录后支持按 `returnTo` 返回目标页面（如 ERP）

7. **退出登录可靠性增强**
   - 首页右上角账号按钮支持稳定退出（含超时兜底）
   - ERP 账户菜单“退出登录”支持状态清理并回到登录页

8. **登录自检面板**
   - `login.html` 增加“登录自检”浮动按钮
   - 可一键查看配置/会话/连通性并复制诊断报告

---

## 技术栈

- HTML5 / CSS3 / JavaScript (ES6+)
- jQuery / Bootstrap / Font Awesome
- Supabase（Auth + PostgreSQL）

---

## 项目结构

```text
.
├── index.html                 # 导航主页
├── login.html                 # 登录/注册页
├── about.html                 # 关于页
├── erp.html                   # ERP 管理页
├── erp-ant.html               # ERP 备用页（当前与 erp.html 内容一致）
├── 404.html
├── README.md
├── tools/
│   └── card-manager/          # 卡片可视化管理工具（可打包 Win EXE）
└── assets/
    ├── css/
    ├── js/
    └── images/
```

---

## H5 管理工具（Win EXE + 安装包）

你可以用桌面工具直接管理首页 H5 内容：

- 左侧导航（含菜单叶子项，可定位金价/数字货币/ERP入口）
- 各分组卡片（名称、URL、描述、Logo）
- 一体总览（检查金价/数字货币/ERP与关键文件）
- 内置应用窗口（直接打开并使用 首页/数字货币/金价/ERP）
- 保存后自动备份
- 手动或自动推送到 GitHub `master`
- 手动推送支持切换仓库地址（默认读取 `origin`，避免串仓）

### 开发模式运行

```bash
python tools/card-manager/card_manager.py
```

### 打包便携 EXE

```bash
tools\card-manager\build_exe.bat
```

输出：`tools/card-manager/dist/WebStackCardManager.exe`

### 打包安装版 Setup

```bash
tools\card-manager\build_installer.bat
```

输出：`tools/card-manager/dist-installer/WebStackCardManager-Setup.exe`

> 安装版依赖 Inno Setup 6，未安装时脚本会提示下载地址。

---

## 本地运行（新手推荐）

> 不建议直接双击 HTML 文件，建议使用本地服务器启动。

### 方式一：Python

```bash
python -m http.server 8000
```

打开：`http://localhost:8000`

### 方式二：PHP

```bash
php -S localhost:8000
```

打开：`http://localhost:8000`

---

## Supabase 配置

编辑文件：`assets/js/supabase-config.js`

```js
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
```

> 建议：生产环境中减少敏感调试日志输出，不要在控制台打印 key 内容。

---

## 新手上传到 GitHub（一步一步）

你当前目录最初不是 Git 仓库，所以按下面流程做。

### 1）初始化本地仓库

```bash
git init
git add .
git commit -m "feat: UI and ERP usability improvements"
```

### 2）在 GitHub 网页创建仓库

1. 打开 https://github.com/new
2. 仓库名建议：`WebStackPage.github.io`（或你喜欢的名字）
3. 选择 Public
4. **不要**勾选 Initialize this repository with a README（因为本地已有）

### 3）绑定远程并推送

把下面的 `你的用户名` 和 `你的仓库名` 替换后执行（按你现在要求固定推到 `master`）：

```bash
git branch -M master
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin master
```

如果远程已存在 `origin`，先更新地址再推送：

```bash
git remote set-url origin https://github.com/你的用户名/你的仓库名.git
git push -u origin master
```

---

## 常见问题

### Q1：为什么我登录了但 ERP 还提示未登录？
- 你可能一个是“本地服务器访问”，另一个是“文件直接打开”，两者 session 不互通。
- 统一使用 `http://localhost:8000` 访问。

### Q2：页面样式丢失/图片不显示？
- 确认你在项目根目录启动服务器。
- 已统一为 `assets/...` 相对路径。

### Q3：推送 GitHub 时报权限错误？
- 你需要使用 GitHub 登录凭据（浏览器弹窗或个人访问令牌 PAT）。

---

## 下一步建议

- 修复收藏模块输入的 XSS 风险（建议优先）
- 清理登录与 Supabase 的调试日志
- 将 `erp-ant.html` 与 `erp.html` 去重（减少维护成本）

---

如需我继续，我可以下一步直接把 **XSS 与日志安全问题** 也一起修完。
