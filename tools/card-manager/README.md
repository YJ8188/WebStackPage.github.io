# WebStack Manager（Win EXE）

本目录提供一个 Windows 桌面管理器：`WebStackManager.exe`。

它用于可视化管理你的 `index.html` 卡片/导航，并支持一键推送到 GitHub `master` 分支。

## 功能

- 卡片管理：新增/编辑/删除/拖拽排序/上移下移/恢复默认排序
- 导航管理：编辑左侧导航数据（按项目现有结构）
- 运行模式：支持“在线运行（默认）/本地预览（可选）”
- 推送：一键提交并推送到目标仓库的 `master`
- 防串码：可读取/应用 `origin` 地址，避免推错仓库

## 打包 EXE

运行：

```bat
tools\card-manager\build_exe.bat
```

输出（带时间戳目录，避免文件占用导致失败）：

- `tools/card-manager/dist/WebStackManager_YYYYMMDD_HHMMSS/WebStackManager.exe`

## 打包安装包

需要先安装 Inno Setup 6。

```bat
tools\card-manager\build_installer.bat
```

输出：

- `tools/card-manager/dist-installer/WebStackManager-Setup.exe`

## 使用建议（新手友好）

1. 推荐在管理器里点“绑定本地仓库目录”，选择你真实的仓库目录（包含 `.git` 的那个）。
2. 修改/排序后点“保存”，再点“手动推送 master”。
3. 如果你发现“推送成功但线上没变化”，通常是推到了别的目录/别的仓库；绑定本地仓库可避免这个问题。

