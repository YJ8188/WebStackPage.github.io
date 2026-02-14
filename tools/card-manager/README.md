# WebStack H5 管理工具（Win EXE）

该工具用于可视化管理 `index.html`：

- 左侧导航（无子菜单的直连项）
- 卡片分组与卡片内容
- 保存后自动备份
- 手动或自动推送到 GitHub `master`

## 文件说明

- `card_manager.py`：主程序（Tkinter UI）
- `build_exe.bat`：打包便携 EXE
- `webstack_card_manager.iss`：Inno Setup 安装脚本
- `build_installer.bat`：一键构建安装包

## 直接运行（开发模式）

```bash
python tools/card-manager/card_manager.py
```

## 打包 Win EXE（便携版）

```bash
tools\card-manager\build_exe.bat
```

输出：`tools/card-manager/dist/WebStackCardManager.exe`

## 打包 Win 安装包（Setup）

前提：安装 `Inno Setup 6`

```bash
tools\card-manager\build_installer.bat
```

输出：`tools/card-manager/dist-installer/WebStackCardManager-Setup.exe`

## 核心功能

1. 选择项目 `index.html`
2. 在「导航管理」里编辑左侧菜单项
3. 在「卡片管理」里编辑卡片标题/URL/描述/Logo
4. 点击「保存」写回 `index.html`（自动生成 `index.html.bak`）
5. 可勾选“保存后自动推送 GitHub(master)”

## Git 推送说明

- 工具内置：`git add -A` → `git commit` → `git push origin master`
- 需要你本机已配置 Git 凭据并对仓库有权限
- 若无改动，commit 阶段会自动跳过并继续 push

