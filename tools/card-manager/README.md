# WebStack H5 一体化管理工具（Win EXE）

该工具用于可视化管理你的项目页面，核心目标：

- 一体管理首页导航 + 卡片
- 快速检查金价/数字货币/ERP模块是否存在
- 保存后可自动推送 GitHub `master`
- 手动推送时可切换仓库地址，防止串仓

## 功能概览

1. **卡片管理**
   - 分组树编辑
   - 卡片新增/删除/排序
   - 编辑标题、URL、描述、Logo

2. **导航管理**
   - 管理左侧菜单叶子项（含金价、数字货币、ERP入口）
   - 支持标题/链接/图标/标签编辑
   - 支持关键词筛选

3. **一体总览**
   - 检查 `数字货币`、`金价行情`、`ERP入口`
   - 检查 `erp-ant.html`、`erp.html`、`login.html`、`assets/js/metalsData.js`

4. **仓库安全推送**
   - 顶部显示当前 `origin` 地址
   - 可手动切换到任意 GitHub 仓库地址
   - 推送前自动校验并记录目标仓库

## 文件说明

- `card_manager.py`：主程序（Tkinter UI）
- `build_exe.bat`：打包便携 EXE
- `webstack_card_manager.iss`：Inno Setup 安装脚本
- `build_installer.bat`：一键构建安装包

## 运行方式

### 开发模式

```bash
python tools/card-manager/card_manager.py
```

### 便携 EXE

```bash
tools\card-manager\build_exe.bat
```

输出：`tools/card-manager/dist/WebStackCardManager.exe`

### 安装版 Setup

前提：安装 `Inno Setup 6`

```bash
tools\card-manager\build_installer.bat
```

输出：`tools/card-manager/dist-installer/WebStackCardManager-Setup.exe`

## Git 推送说明

- 内置命令：`git add -A` → `git commit` → `git push origin master`
- 支持切换 `origin` 仓库地址，适配不同用户使用同一工具
- 若无改动，commit 阶段会自动跳过并继续 push

