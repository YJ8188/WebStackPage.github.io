# WebStackPage 项目深度审查报告（2026-02-27）

## 审查范围
- 前端主站与 ERP 页面：`index.html`、`login.html`、`erp-ant.html`、`assets/js/**`
- 邮件同步链路：`.github/qq-mail-sync/qq_mail_sync.mjs`、`.github/workflows/qq-mail-sync.yml`
- Supabase Edge Functions：`supabase/functions/qq-mail-auth/index.ts`、`supabase/functions/logistics-track/index.ts`
- CI 与数据库迁移：`.github/workflows/ci.yml`、`supabase/sql/*.sql`
- 本地工具：`tools/**/*.py`

## 执行检查
- JS/MJS 语法检查：通过（42 文件）
- Python 语法检查：通过（4 文件）
- Deno 类型检查：未执行（本地无 `deno`）

---

## 发现的问题（按严重度排序）

### CRITICAL-01：`qq-mail-auth` 存在未鉴权越权写入（可改任意用户邮箱授权）
- 证据：
  - `supabase/functions/qq-mail-auth/config.toml:1` 设置 `verify_jwt = false`
  - `supabase/functions/qq-mail-auth/index.ts:115` 到 `supabase/functions/qq-mail-auth/index.ts:124`，鉴权失败时回退使用 `body.user_id`
  - `supabase/functions/qq-mail-auth/index.ts:135` 到 `supabase/functions/qq-mail-auth/index.ts:140` 使用 `service_role` 客户端
  - `supabase/functions/qq-mail-auth/index.ts:250` 到 `supabase/functions/qq-mail-auth/index.ts:279`（`save`）与 `supabase/functions/qq-mail-auth/index.ts:237` 到 `supabase/functions/qq-mail-auth/index.ts:247`（`disable`）直接写库
- 影响：
  - 未登录请求可伪造 `user_id` 调用 `save/disable/status`，通过服务端高权限客户端读写授权信息。
  - 一旦被利用，可篡改邮箱同步配置、破坏同步可用性，属于账户级数据完整性风险。
- 修复建议：
  - 强制开启 `verify_jwt = true`。
  - 删除 `resolveRequestUserId` 中 `body.user_id` 回退逻辑，仅信任 JWT 用户。
  - 对 `save/disable/status` 再次校验 `user_id === auth.uid()`（双重防线）。

### HIGH-02：`logistics-track` 对外匿名开放，可能被滥用消耗 17TRACK 私钥额度
- 证据：
  - `supabase/functions/logistics-track/config.toml:1` 为 `verify_jwt = false`
  - `supabase/functions/logistics-track/index.ts:255` 到 `supabase/functions/logistics-track/index.ts:359` 直接使用服务端 `TRACK17_API_KEY` 请求三方，无调用方身份校验或限流
- 影响：
  - 任意来源可调用该函数，消耗你的三方 API 配额，触发限流或成本问题，影响真实业务查询可用性。
- 修复建议：
  - 开启 `verify_jwt = true`，并要求登录用户调用。
  - 增加每用户/IP 的速率限制与配额控制。

### MEDIUM-03：`login.html` 自检面板存在反射型 DOM XSS 面
- 证据：
  - `login.html:539` 读取 `returnTo` 原值（URL 参数）
  - `login.html:556` 到 `login.html:560` 直接写入 `innerHTML`，未转义 `value`
- 影响：
  - 构造恶意 `returnTo` 参数可注入 HTML/脚本片段（需用户打开自检面板触发）。
- 修复建议：
  - 自检渲染统一改为 `textContent` 或先转义再拼接 HTML。

### MEDIUM-04：笔记 HTML 清洗规则不完整（危险 URL 协议未拦截）
- 证据：
  - `assets/js/erp-ant-functions.js:7414` 到 `assets/js/erp-ant-functions.js:7425` 仅移除 `script/style/iframe/object/embed` 与 `on*` 属性
  - `assets/js/erp-ant-functions.js:7562` 把内容直接回填到 `editorEl.innerHTML`
- 影响：
  - `href="javascript:..."`、`data:` 等危险协议未过滤，存在存储型脚本/钓鱼链接风险（点击触发）。
- 修复建议：
  - 引入白名单 Sanitizer（如 DOMPurify 严格配置）；
  - 强制 URL 协议仅允许 `http/https/mailto/tel`。

### MEDIUM-05：前端硬编码 Bearer Token（可被公开复用）
- 证据：
  - `assets/js/crypto.js:954` 定义并解码 token
  - `assets/js/crypto.js:963`、`assets/js/crypto.js:1233` 直接在浏览器请求头带 `Authorization: Bearer ...`
- 影响：
  - 任何人都可从前端源码提取 token，导致第三方 API 被盗刷、配额耗尽。
- 修复建议：
  - 将密钥放到服务端代理函数，前端只调用你自己的无密钥接口。

### LOW-06：CI 覆盖面不足，关键同步/函数代码未纳入检查
- 证据：
  - `.github/workflows/ci.yml:22` 到 `.github/workflows/ci.yml:29` 仅检查 `assets/js/*.js`
  - 未检查 `.github/qq-mail-sync/qq_mail_sync.mjs` 与 `supabase/functions/*.ts`
- 影响：
  - 邮件同步与 Edge Function 改动可能绕过 CI，增加线上回归概率。
- 修复建议：
  - CI 新增 `node --check .github/qq-mail-sync/qq_mail_sync.mjs`
  - 增加 Edge Functions 类型检查（`deno check`）与基础单测。

### LOW-07：GitHub Actions 日志暴露完整邮箱（隐私泄露面）
- 证据：
  - `.github/qq-mail-sync/qq_mail_sync.mjs:1423` 打印 `邮箱=${email}`
- 影响：
  - 若仓库/日志可被他人访问，会暴露个人邮箱信息。
- 修复建议：
  - 日志只显示掩码邮箱（如 `ab***@qq.com`）。

---

## 回归风险与测试覆盖评估
- 当前项目缺少系统化自动化测试（尤其账单解析和去重逻辑），回归风险偏高。
- 邮件账单解析策略高度依赖模板文本，建议建设“样例账单回放测试集”（至少覆盖光大/中信/浦发等常见模板）。

## 建议修复优先级
1. 先修复 `CRITICAL-01`（鉴权与越权）与 `HIGH-02`（匿名滥用）。
2. 再处理 XSS 与密钥暴露（`MEDIUM-03/04/05`）。
3. 最后补 CI 覆盖与日志脱敏（`LOW-06/07`）。

