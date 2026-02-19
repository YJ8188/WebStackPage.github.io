# Claude Code 配置指南

> 如何配置 Claude Code 以增强 ERP 项目开发体验

## 📋 目录

1. [Claude Code Skills 配置](#claude-code-skills-配置)
2. [MCP 服务器配置](#mcp-服务器配置)
3. [提示词优化技巧](#提示词优化技巧)
4. [工作流程优化](#工作流程优化)

---

## 🎯 Claude Code Skills 配置

### 什么是 Skills？

Skills 是 Claude Code 的扩展功能，可以让 Claude 执行特定的任务。类似于 VS Code 的插件系统。

### 当前可用的 Skills

根据你的系统提示，当前可用的 skills 包括：

1. **keybindings-help**: 自定义键盘快捷键
2. **claude-developer-platform**: Claude API 开发相关

### 如何配置自定义 Skills

#### 方法 1: 使用配置文件

Claude Code 的配置文件位置：
- **Windows**: `%USERPROFILE%\.claude\`
- **macOS/Linux**: `~/.claude/`

创建或编辑 `skills.json`:

```json
{
  "skills": [
    {
      "name": "erp-optimizer",
      "description": "ERP 项目优化助手",
      "trigger": "当用户提到 ERP 优化、性能提升、UI 改进时自动触发",
      "actions": [
        "分析当前代码结构",
        "提供优化建议",
        "生成改进方案"
      ]
    },
    {
      "name": "ui-designer",
      "description": "UI 设计建议助手",
      "trigger": "当用户提到界面设计、布局、样式时触发",
      "actions": [
        "分析当前 UI 设计",
        "提供设计改进建议",
        "生成 CSS 代码"
      ]
    },
    {
      "name": "code-reviewer",
      "description": "代码审查助手",
      "trigger": "当用户提交代码或请求审查时触发",
      "actions": [
        "检查代码质量",
        "发现潜在问题",
        "提供改进建议"
      ]
    }
  ]
}
```

#### 方法 2: 使用命令行

```bash
# 查看当前可用的 skills
claude skills list

# 安装新的 skill（如果有 skill marketplace）
claude skills install erp-optimizer

# 启用/禁用 skill
claude skills enable erp-optimizer
claude skills disable erp-optimizer
```

---

## 🔌 MCP 服务器配置

### 什么是 MCP？

MCP (Model Context Protocol) 是 Anthropic 开发的协议，允许 Claude 连接到外部数据源和工具。

### 推荐的 MCP 服务器

#### 1. 文件系统服务器
允许 Claude 访问本地文件系统。

**配置示例** (`~/.claude/mcp_config.json`):

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "D:\\phpstudy_pro\\WebStackPage.github.io-master"],
      "env": {}
    }
  }
}
```

#### 2. 数据库服务器（Supabase/PostgreSQL）
允许 Claude 直接查询数据库。

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://user:password@host:5432/database"],
      "env": {}
    }
  }
}
```

#### 3. Web 搜索服务器
允许 Claude 搜索网络信息。

```json
{
  "mcpServers": {
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

#### 4. GitHub 服务器
允许 Claude 访问 GitHub 仓库。

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "your-github-token"
      }
    }
  }
}
```

### 完整配置示例

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "D:\\phpstudy_pro\\WebStackPage.github.io-master"],
      "env": {}
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "your-supabase-connection-string"],
      "env": {}
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your-api-key"
      }
    }
  }
}
```

### 安装 MCP 服务器

```bash
# 安装 Node.js（如果还没有）
# 下载: https://nodejs.org/

# 测试 MCP 服务器是否可用
npx -y @modelcontextprotocol/server-filesystem --help

# 重启 Claude Code 以加载配置
```

---

## 💡 提示词优化技巧

### 1. 上下文管理

#### ❌ 不好的提示词
```
帮我优化代码
```

#### ✅ 好的提示词
```
我的 ERP 项目使用原生 JavaScript 和 Supabase。
当前问题：财务筛选器在移动端显示不对齐。
目标：优化响应式布局，确保在 768px 以下屏幕正常显示。
相关文件：erp-ant.html, assets/css/erp-ant.css
```

### 2. 分步骤请求

#### ❌ 不好的提示词
```
重构整个 ERP 系统
```

#### ✅ 好的提示词
```
第一步：分析当前 ERP 系统的代码结构
第二步：识别可以模块化的部分
第三步：提供重构方案，优先处理最重要的模块
第四步：生成重构后的代码示例
```

### 3. 明确约束条件

#### ❌ 不好的提示词
```
添加深色模式
```

#### ✅ 好的提示词
```
为 ERP 系统添加深色模式功能：
- 保持与现有 Ant Design 风格一致
- 使用 CSS 变量实现主题切换
- 支持系统主题自动切换
- 保存用户偏好到 localStorage
- 不影响现有功能
```

### 4. 提供示例

#### ❌ 不好的提示词
```
优化表格性能
```

#### ✅ 好的提示词
```
优化财务管理表格的性能：
当前问题：加载 1000+ 条数据时页面卡顿
期望效果：类似 Ant Design Table 的虚拟滚动效果
参考实现：https://ant.design/components/table-cn/#components-table-demo-virtual-list
技术栈：原生 JavaScript（不使用框架）
```

### 5. 迭代优化

#### 第一次对话
```
分析我的 ERP 项目结构，找出可以优化的地方
```

#### 第二次对话（基于第一次的结果）
```
根据刚才的分析，优先优化移动端响应式布局。
重点关注：
1. 财务筛选器
2. 数据表格
3. 侧边栏菜单
```

#### 第三次对话（持续迭代）
```
刚才的移动端优化很好，现在继续优化：
1. 添加触摸手势支持
2. 优化表格横向滚动
3. 改进菜单折叠动画
```

---

## 🔄 工作流程优化

### 1. 项目初始化时

```
我有一个 ERP 项目，使用以下技术栈：
- 前端：原生 HTML/CSS/JavaScript
- UI：Ant Design 风格（自定义 CSS）
- 数据库：Supabase (PostgreSQL)
- 图表：Apache ECharts
- PWA：Service Worker

项目结构：
- erp-ant.html: 主页面
- assets/css/erp-ant.css: 样式文件
- assets/js/erp.js: 核心逻辑
- assets/js/erp-ant-functions.js: 辅助函数

请记住这些信息，后续对话中我会基于这个项目提问。
```

### 2. 每次开发会话开始时

```
继续开发 ERP 项目。
今天的目标：
1. 优化财务管理模块的筛选功能
2. 改进移动端响应式布局
3. 添加数据导出功能

请先分析相关文件，然后提供实现方案。
```

### 3. 代码审查时

```
请审查以下代码的质量：
- 文件：erp-ant.html 的财务筛选部分
- 关注点：
  1. 代码可读性
  2. 性能问题
  3. 安全隐患
  4. 最佳实践

提供具体的改进建议和代码示例。
```

### 4. 问题排查时

```
遇到问题：
- 现象：财务筛选器在 Chrome 正常，但在 Safari 显示错位
- 相关代码：assets/css/erp-ant.css 第 1998-2100 行
- 浏览器版本：Safari 17.2

请帮我：
1. 分析可能的原因
2. 提供兼容性解决方案
3. 给出测试建议
```

### 5. 功能开发时

```
需要开发新功能：数据批量导出

需求：
- 支持导出 Excel 和 CSV 格式
- 可以选择导出字段
- 支持导出当前筛选结果
- 显示导出进度

技术约束：
- 纯前端实现（不依赖后端）
- 使用 SheetJS 或类似库
- 保持与现有 UI 风格一致

请提供：
1. 技术方案
2. 代码实现
3. 使用示例
```

---

## 📝 提示词模板

### 模板 1: 功能开发

```
【功能开发】{功能名称}

背景：
{项目背景和当前状态}

需求：
1. {需求1}
2. {需求2}
3. {需求3}

技术约束：
- {约束1}
- {约束2}

期望输出：
1. 技术方案
2. 代码实现
3. 测试建议
```

### 模板 2: 问题排查

```
【问题排查】{问题描述}

现象：
{详细描述问题现象}

环境：
- 浏览器：{浏览器版本}
- 操作系统：{系统版本}
- 相关文件：{文件路径}

已尝试的方案：
1. {方案1} - {结果}
2. {方案2} - {结果}

需要帮助：
{具体需要什么帮助}
```

### 模板 3: 代码审查

```
【代码审查】{模块名称}

审查范围：
- 文件：{文件路径}
- 行数：{起始行}-{结束行}

关注点：
1. 代码质量
2. 性能优化
3. 安全问题
4. 最佳实践

请提供：
1. 问题清单
2. 改进建议
3. 优化后的代码
```

### 模板 4: 性能优化

```
【性能优化】{模块名称}

当前性能：
- 加载时间：{时间}
- 内存占用：{大小}
- 用户体验：{描述}

优化目标：
- 加载时间：< {目标时间}
- 内存占用：< {目标大小}
- 用户体验：{期望效果}

技术栈：
{当前使用的技术}

请提供：
1. 性能分析
2. 优化方案
3. 实施步骤
```

---

## 🎯 实战示例

### 示例 1: 优化财务筛选器

```
【优化请求】财务筛选器对齐问题

项目：何哥ERP - 进销存管理系统
文件：erp-ant.html, assets/css/erp-ant.css

问题：
财务筛选器的标签宽度不一致，导致字段不对齐。
- 有的标签是 64px
- 有的标签是 76px
- 金额输入框宽度不合适

目标：
1. 统一所有标签宽度为 80px
2. 使用 CSS Grid Areas 固定两行布局
3. 优化金额输入框最小宽度为 120px
4. 改进响应式布局

请：
1. 分析当前 CSS 代码
2. 提供优化方案
3. 生成修改后的 CSS 代码
4. 确保不影响其他模块
```

**结果**: ✅ 已完成（参考之前的对话）

### 示例 2: 移除冗余文件

```
【项目清理】移除冗余的 ERP 文件

背景：
项目中有两个 ERP 文件：
- erp.html (162KB, 2958行)
- erp-ant.html (170KB, 3227行)

当前使用：
- index.html 链接到 erp-ant.html
- 访问地址：https://hq168.dpdns.org/erp-ant.html

请帮我：
1. 检查 index.html 是否引用 erp.html
2. 检查其他文件中的引用
3. 如果 erp.html 没有被使用，安全移除它
4. 更新相关配置文件（sw.js, README.md）
5. 提交到 Git
```

**结果**: ✅ 已完成（参考之前的对话）

---

## 🚀 高级技巧

### 1. 使用代码块引用

```
请优化以下代码：

\`\`\`javascript
// 当前代码
function searchFinances() {
    // 实现...
}
\`\`\`

优化方向：
1. 添加防抖
2. 优化性能
3. 改进错误处理
```

### 2. 提供上下文链接

```
参考以下资源进行优化：
- Ant Design Table: https://ant.design/components/table-cn/
- ECharts 文档: https://echarts.apache.org/zh/index.html
- Supabase 文档: https://supabase.com/docs

请基于这些最佳实践优化我的代码。
```

### 3. 分阶段实施

```
【分阶段优化】ERP 系统性能提升

第一阶段（本周）：
1. 优化财务筛选器 ✅
2. 移除冗余文件 ✅
3. 添加加载动画 ⏳

第二阶段（下周）：
1. 优化移动端布局
2. 实现数据分页
3. 添加数据导出

第三阶段（下下周）：
1. 代码模块化重构
2. 添加单元测试
3. 性能监控

请先帮我完成第一阶段的第3项。
```

### 4. 持续迭代

```
基于上次的优化结果，继续改进：

上次完成：
- 财务筛选器对齐 ✅
- 移除 erp.html ✅

本次目标：
- 在此基础上添加加载动画
- 优化筛选器的响应速度
- 改进用户体验

请提供具体实现方案。
```

---

## 📚 参考资源

### 官方文档
- [Claude Code 文档](https://docs.anthropic.com/claude/docs/claude-code)
- [MCP 协议文档](https://modelcontextprotocol.io/)
- [Claude API 文档](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)

### 社区资源
- [Claude Code GitHub](https://github.com/anthropics/claude-code)
- [MCP Servers 列表](https://github.com/modelcontextprotocol/servers)
- [Awesome MCP](https://github.com/punkpeye/awesome-mcp)

### 学习资源
- [提示词工程指南](https://www.promptingguide.ai/)
- [Claude 最佳实践](https://docs.anthropic.com/claude/docs/prompt-engineering)

---

## 💬 常见问题

### Q1: 如何让 Claude 记住项目信息？
**A**: Claude 无法跨会话记忆，但你可以：
1. 在每次对话开始时提供项目概述
2. 创建项目文档（如本文档）供参考
3. 使用 MCP 文件系统服务器让 Claude 访问项目文件

### Q2: 如何配置 MCP 服务器？
**A**:
1. 安装 Node.js
2. 创建配置文件 `~/.claude/mcp_config.json`
3. 添加服务器配置
4. 重启 Claude Code

### Q3: Skills 和 MCP 有什么区别？
**A**:
- **Skills**: 预定义的任务模板，类似于快捷命令
- **MCP**: 连接外部数据源和工具的协议

### Q4: 如何优化提示词？
**A**:
1. 提供清晰的上下文
2. 明确目标和约束
3. 分步骤请求
4. 提供示例和参考
5. 持续迭代改进

---

**最后更新**: 2026-02-19
**维护者**: Claude Opus 4.6
