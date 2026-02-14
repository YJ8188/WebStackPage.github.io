# WebStack Desktop Suite（Win EXE）

该套件包含两个 EXE（默认推荐一体式）：

- `WebStackManager.exe`：**一体式主程序**（运行+管理都在里面）
- `WebStackDesktop.exe`：纯运行版（只运行页面）

## 你要的效果

- 打开 EXE 后可直接进入 H5 页面（不是只看状态，也无需先手动选文件）
- 数字货币、金价行情实时刷新逻辑沿用原网页脚本
- ERP 页面、登录、按钮交互与网页一致（同一套页面）
- 不再降级为系统浏览器，统一走 EXE 内窗口
- 运行模式支持：`在线运行（默认）` + `本地预览（可选）`
- 支持绑定本地仓库目录，防止“推送了但线上看不到变化”

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

1. 默认使用在线模式，直接打开 CNAME 域名（如 `https://hq168.dpdns.org`）
2. 需要调试本地代码时，手动切到本地预览模式（127.0.0.1 随机端口）
3. 所有功能使用你现有 H5 逻辑，不另造 ERP
4. 打包时内置 `workspace_bundle`，首次运行自动解包到用户目录
5. 可绑定真实仓库目录，编辑与推送都作用于同一目标

## 仓库防串码

- 管理器可显示并切换 `origin` 仓库地址
- 推送前可确认目标仓库，再推送 `master`
