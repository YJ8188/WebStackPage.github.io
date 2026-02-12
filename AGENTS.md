# AGENTS.md（项目级协作指令）

适用范围：仓库根目录及全部子目录。

## 目标

本项目的技能（skills）触发策略采用“全场景自动路由”，不局限于 Vue/OA 关键词。

## 自动触发总规则

1. 先按“任务意图”判定，再看关键词，不要只做关键词匹配。
2. 能覆盖任务时，优先触发最小必要技能集合（1 个主技能 + 0~2 个辅助技能）。
3. 多技能冲突时，按“与当前任务最直接相关”优先；无法判定时先执行主线任务并说明原因。
4. 每次开始执行前，用一句话说明：本次使用了哪些技能、为什么。
5. 如果技能文件缺失/不可读，需明确说明并降级为常规实现，不中断交付。

## 技能自动路由（增强版）

- `vue-best-practices`
  - 触发：任何 Vue 相关任务（`.vue`、Vue Router、Pinia、Vite+Vue、组合式 API、页面重构）。
  - 备注：Vue 任务默认必须触发。

- `java-spring-boot`
  - 触发：后端接口、认证授权、数据库持久化、Spring Boot 配置/部署/性能问题。

- `oa-review-guardian`
  - 触发：OA 模块审查、修复、文档、预览异常、文件生成问题（含 `index.vue` 场景）。

- `security-best-practices`
  - 触发：用户明确要求安全审查/安全加固/安全最佳实践（JS/TS/Python/Go）。

- `security-threat-model`
  - 触发：用户要求威胁建模、攻击路径分析、边界与资产梳理。

- `security-ownership-map`
  - 触发：用户要求安全 ownership、bus factor、敏感代码维护者分析。

- `openai-docs`
  - 触发：OpenAI 产品/API/模型能力/限制/SDK 用法；优先官方文档来源。

- `skill-installer`
  - 触发：用户要安装技能、列出可安装技能、从仓库安装技能。

- `skill-creator`
  - 触发：用户要新建技能或改造现有技能。

## 组合触发建议

1. 前端改造 + 安全诉求：`vue-best-practices` + `security-best-practices`
2. OpenAI API 落地 + 安全基线：`openai-docs` + `security-best-practices`
3. OA 页面问题 + 文档整理：`oa-review-guardian` + `skill-creator`（仅在需要沉淀技能时）

## 输出要求

1. 先给结果，再给关键修改点，避免空泛解释。
2. 涉及文件修改时，给可点击路径。
3. 默认提供“下一步可选项”（如：是否继续自检、是否直接推送 master）。

