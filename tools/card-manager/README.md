# WebStack Card Manager / ERP（Win EXE）

本目录保留两类桌面能力：

- `WebStackManager.exe`：导航卡片管理与 GitHub 推送
- `WebStackERP.exe`：ERP 桌面入口

## 当前目录说明

- `dist/`
  - `WebStackManager.exe`
  - `WebStackERP.exe`
- `build_exe.bat`：打包 `WebStackManager.exe`
- `build_erp_exe.bat`：打包 `WebStackERP.exe`
- `card_manager.py`：Manager 源码入口
- `webstack_erp_desktop.py`：ERP 桌面入口源码

## 使用方式

### 1) 直接运行现成 EXE
- `tools/card-manager/dist/WebStackManager.exe`
- `tools/card-manager/dist/WebStackERP.exe`

### 2) 从源码运行
```bash
python tools/card-manager/card_manager.py
```

### 3) 重新打包 EXE
```bat
tools\card-manager\build_exe.bat
tools\card-manager\build_erp_exe.bat
```

> `build_erp_exe.bat` 使用 Python 3.13 打包并校验 `pywebview + pythonnet` 依赖。

打包完成后会同时输出两类文件：
- `dist/WebStackManager.exe`、`dist/WebStackERP.exe`（固定路径，便于直接运行）
- `dist/WebStackManager_时间戳/...`、`dist/WebStackERP_时间戳/...`（构建归档）

## 维护约定
- 当前仅保留与 `WebStackManager.exe`、`WebStackERP.exe` 直接相关文件。
- 已移除安装包链路与历史遗留运行壳相关文件。
