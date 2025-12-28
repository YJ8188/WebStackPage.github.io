# WebStack 二次开发版导航站

这是一个基于开源项目 **WebStackPage** 的二次开发静态网址导航站，  
在原有模板基础上，对 **视觉风格、品牌标识、交互功能** 进行了定制和扩展。

适合用于：  
- 开发者 / 设计师工具导航  
- 个人效率工具集合  
- 内部资源导航页  

---

## ✨ 特性 Features

- 🔧 基于 WebStackPage 二次开发
- 🎨 自定义 Logo 与整体视觉风格
- 🔍 支持站内搜索（前端即时过滤）
- ⬆️ 支持返回顶部按钮（PC / 移动端）
- 📱 响应式布局，适配移动端
- ⚡ 纯静态页面，支持 GitHub Pages 部署

---

## 📂 项目结构 Project Structure

```text
.
├── index.html              # 主页面
├── assets/
│   ├── css/
│   │   ├── xenon-core.css  # 原模板样式（不建议直接改）
│   │   └── custom.css      # 自定义样式（推荐二开都写这里）
│   ├── js/
│   │   ├── xenon-core.js   # 原模板脚本
│   │   └── custom.js       # 自定义功能（搜索、返回顶部等）
│   └── images/
│       └── logo.png        # 自定义 Logo
├── README.md               # 项目说明
└── LICENSE                 # 原项目许可证

