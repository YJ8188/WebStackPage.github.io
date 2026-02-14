# WebStack Desktop Suite（Win EXE）

该套件包含两个 EXE（默认推荐一体式）：

- `WebStackManager.exe`：**一体式主程序**（运行+管理都在里面）
- `WebStackDesktop.exe`：纯运行版（只运行页面）

## 你要的效果

- 打开 EXE 后可直接进入 H5 页面（不是只看状态，也无需先手动选文件）
- 数字货币、金价行情实时刷新逻辑沿用原网页脚本
- ERP 页面、登录、按钮交互与网页一致（同一套页面）
- 不再降级为系统浏览器，统一走 EXE 内窗口

## 结构说明

- `webstack_runtime.py`：运行版入口（本地服务 + WebView 桌面壳）
- `card_manager.py`：管理器入口
- `build_exe.bat`：同时打包两个 EXE
- `build_installer.bat`：打包安装包（Setup）
- `webstack_card_manager.iss`：Inno Setup 脚本

## 打包

```bash
tools\card-manager\build_exe.bat
```

输出：

- `tools/card-manager/dist/WebStackDesktop.exe`
- `tools/card-manager/dist/WebStackManager.exe`

## 安装包

```bash
tools\card-manager\build_installer.bat
```

输出：

- `tools/card-manager/dist-installer/WebStackDesktopSuite-Setup.exe`

## 运行机制

1. 程序会自动启动本地 HTTP 服务（127.0.0.1 随机端口）
2. WebView 加载桌面壳页面
3. 壳内 iframe 加载 `index.html` / `erp-ant.html` / `login.html`
4. 所有功能使用你现有 H5 逻辑，不另造 ERP
5. 打包时内置 `workspace_bundle`，首次运行自动解包到用户目录

## 仓库防串码

- 管理器可显示并切换 `origin` 仓库地址
- 推送前可确认目标仓库，再推送 `master`
