# 何哥的网站导航系统（WebStack 增强版）

一个基于静态页面（HTML/CSS/JS）的个人导航站，包含账号体系与轻量 ERP。

## 核心功能
- 导航主页：卡片分组、常用网址管理、收藏与个性化设置
- 账号系统：Supabase Auth 登录/注册/会话
- 轻量 ERP：客户、产品、订单、库存、财务
- 数据同步：同一账号下，网页端与 ERP 数据使用同一 Supabase 库
- PWA 离线能力：支持安装到桌面、页面资源缓存、离线兜底页
- 自动校验：GitHub Actions 在 `master` Push/PR 自动执行语法检查
- ERP 审计日志：关键操作自动记录（客户/产品/订单/库存/财务）

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
├── manifest.webmanifest
├── sw.js
├── offline.html
├── .github/workflows/ci.yml
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

## PWA（离线与安装）
- 已启用文件：`manifest.webmanifest`、`sw.js`、`assets/js/pwa-register.js`
- 离线时自动展示：`offline.html`
- 首页/登录/ERP 等关键页面已注入 PWA 注册脚本
- 首次更新缓存后建议 `Ctrl + F5` 强刷一次

## CI 自动检查（GitHub Actions）
- 工作流文件：`.github/workflows/ci.yml`
- 触发条件：`master` 分支 Push、PR
- 检查内容：
  - `assets/js/**/*.js` 语法检查（`node --check`）
  - `tools/**/*.py` 语法检查（`python -m py_compile`）
  - 关键页面与 PWA 文件存在性校验

## ERP 审计日志说明
- 关键操作已接入审计写入：客户/产品/订单/库存/财务
- 审计写入为“非阻塞”模式：即使审计失败，也不会阻断业务操作
- 若数据库暂无 `erp_audit_logs` 表，系统会自动降级关闭审计写入并继续运行
- 建议在 Supabase 创建 `erp_audit_logs` 表以启用完整追踪

## ERP（中小企业增强）
- 订单履约预警筛选：`超48小时未发货`、`超7天未签收`
- 财务目标管理：按月份设置净利润目标并展示达成率
- 客户授信与账期：支持客户等级、信用额度、账期天数字段（前端已兼容无结构模式）
- 订单授信风控：保存订单前自动校验客户授信占用，超限二次确认

### 可选数据库升级脚本
- 文件：`docs/sql/erp_sme_upgrade.sql`
- 用途：给 `customers` 增加结构化字段（客户等级/信用额度/账期）并创建企业经营设置表

### Supabase 安全告警修复（Security Advisor）
- 文件：`docs/sql/erp_security_hardening.sql`
- 对应修复项：
  - `RLS Disabled in Public`（`public.erp_business_settings`）
  - `Security Definer View`（`public.erp_product_stock`、`public.erp_order_stats`）
- 执行方式：
  1. 打开 Supabase -> SQL Editor
  2. 粘贴并执行 `docs/sql/erp_security_hardening.sql`
  3. 回到 Security Advisor 点 `Refresh`
- 说明：脚本是幂等的，可重复执行。

## 物流轨迹（17TRACK）
- ERP 订单弹窗已支持“查询轨迹”，展示最新状态与时间线
- 前端通过 Supabase Edge Function 代理 17TRACK，避免在网页暴露 API Key

### 1）部署 Edge Function
```bash
supabase functions deploy logistics-track
```

> 说明：本函数配置 `verify_jwt = false`，用于兼容当前前端登录态（否则会出现 `Invalid JWT` 导致 non-2xx）。

### 2）配置 17TRACK Key（服务端）
```bash
supabase secrets set TRACK17_API_KEY=你的17TRACK_API_KEY
```

### 3）本地联调（可选）
```bash
supabase functions serve logistics-track --env-file .env.local
```

`.env.local` 示例：
```env
TRACK17_API_KEY=你的17TRACK_API_KEY
```

### 4）使用方式
- ERP → 订单管理 → 详情（编辑订单）  
- 填写快递公司与单号，点击“查询轨迹”  
- 若提示需要校验参数（如部分顺丰单号），填写“手机号后4位”再查询  
- 系统会显示最新物流状态与轨迹时间线

## 首页看板说明（你截图那两块）
- `订单交付时效`：统计从“下单时间”到“签收/完成”的耗时分布（1天内、2-3天、4-7天、7天以上）。
- `毛利异常检测`：按订单维度检查三类异常：负毛利、低毛利（<10%）、成本缺失。
- 如果你看到“0单/0%”：
  - 可能是订单未写入完整状态流转日志；
  - 或订单还未进入可统计状态（未签收/未完成）；
  - 可先在订单详情里执行一次物流查询并保存，系统会重新计算看板。

## Supabase 配置
编辑：`assets/js/supabase-config.js`
```js
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
```

## 维护说明
- 当前文档仅覆盖已保留工具链（Manager + ERP EXE）。
- 已移除历史遗留的 Desktop/Installer 相关链路说明。
