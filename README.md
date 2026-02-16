# 何哥的网站导航系统（WebStack 增强版）

一个基于静态页面（HTML/CSS/JS）的个人导航站，包含账号体系与轻量 ERP。

## 核心功能
- 导航主页：卡片分组、常用网址管理、收藏与个性化设置
- 账号系统：Supabase Auth 登录/注册/会话
- 轻量 ERP：客户、产品、订单、库存、财务
- 数据同步：同一账号下，网页端与 ERP 数据使用同一 Supabase 库

## 技术栈
- HTML5 / CSS3 / JavaScript (ES6+)
- jQuery / Bootstrap / Font Awesome
- Supabase（Auth + PostgreSQL）

## 项目结构
```text
.
├── index.html
├── login.html
├── erp.html
├── erp-ant.html
├── about.html
├── 404.html
├── assets/
│   ├── css/
│   ├── js/
│   └── images/
└── tools/
    ├── card-manager/
    │   ├── dist/
    │   │   ├── WebStackERP.exe
    │   │   └── WebStackManager.exe
    │   ├── build_exe.bat
    │   ├── build_erp_exe.bat
    │   ├── card_manager.py
    │   └── webstack_erp_desktop.py
    └── erp-native/
        ├── app.py
        ├── supabase_native.py
        └── build_erp_native_exe.bat
```

## 桌面工具（当前保留）

### `WebStackManager.exe`
- 用途：可视化管理 `index.html` 的卡片/导航并推送到 GitHub `master`
- 位置：`tools/card-manager/dist/WebStackManager.exe`

### `WebStackERP.exe`
- 用途：ERP 桌面端入口（封装现有 ERP 页面与登录流程）
- 位置：`tools/card-manager/dist/WebStackERP.exe`

### `WebStackERPNative.exe`（原生体验版）
- 用途：原生 UI（Tkinter）ERP 客户端，直接读写 Supabase 数据
- 源码目录：`tools/erp-native/`

## 开发与打包

### 运行管理器源码
```bash
python tools/card-manager/card_manager.py
```

### 重打包 Manager
```bat
tools\card-manager\build_exe.bat
```
输出：
- `tools/card-manager/dist/WebStackManager.exe`
- `tools/card-manager/dist/WebStackManager_YYYYMMDD_HHMMSS/WebStackManager.exe`

### 重打包 ERP
```bat
tools\card-manager\build_erp_exe.bat
```
输出：
- `tools/card-manager/dist/WebStackERP.exe`
- `tools/card-manager/dist/WebStackERP_YYYYMMDD_HHMMSS/WebStackERP.exe`

> 说明：`build_erp_exe.bat` 依赖 Python 3.13（脚本中已做检查）。

## 本地运行网页
```bash
python -m http.server 8000
```
打开：`http://localhost:8000`

## Supabase 配置
编辑：`assets/js/supabase-config.js`
```js
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
```

## 维护说明
- 当前文档仅覆盖已保留工具链（Manager + ERP EXE）。
- 已移除历史遗留的 Desktop/Installer 相关链路说明。
