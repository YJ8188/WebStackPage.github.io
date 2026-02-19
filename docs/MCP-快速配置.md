# MCP 服务器快速配置脚本

## Windows 配置脚本

创建文件: `setup-mcp.bat`

```batch
@echo off
echo ========================================
echo MCP 服务器配置脚本
echo ========================================
echo.

REM 检查 Node.js 是否安装
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

echo [1/4] 检测到 Node.js 版本:
node --version
echo.

REM 创建配置目录
echo [2/4] 创建配置目录...
if not exist "%USERPROFILE%\.claude" mkdir "%USERPROFILE%\.claude"
echo 配置目录: %USERPROFILE%\.claude
echo.

REM 创建 MCP 配置文件
echo [3/4] 创建 MCP 配置文件...
(
echo {
echo   "mcpServers": {
echo     "filesystem": {
echo       "command": "npx",
echo       "args": [
echo         "-y",
echo         "@modelcontextprotocol/server-filesystem",
echo         "D:\\phpstudy_pro\\WebStackPage.github.io-master"
echo       ],
echo       "env": {}
echo     }
echo   }
echo }
) > "%USERPROFILE%\.claude\mcp_config.json"

echo MCP 配置文件已创建: %USERPROFILE%\.claude\mcp_config.json
echo.

REM 测试 MCP 服务器
echo [4/4] 测试 MCP 服务器...
npx -y @modelcontextprotocol/server-filesystem --help >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [成功] MCP 文件系统服务器可用
) else (
    echo [警告] MCP 服务器测试失败，请检查网络连接
)
echo.

echo ========================================
echo 配置完成！
echo ========================================
echo.
echo 下一步：
echo 1. 重启 Claude Code CLI
echo 2. 使用命令测试: claude --version
echo 3. 开始使用 MCP 功能
echo.
pause
```

## 使用方法

1. 将上述内容保存为 `setup-mcp.bat`
2. 右键点击，选择"以管理员身份运行"
3. 按照提示完成配置
4. 重启 Claude Code

## 验证配置

```bash
# 检查配置文件
type %USERPROFILE%\.claude\mcp_config.json

# 测试 MCP 服务器
npx -y @modelcontextprotocol/server-filesystem --help
```

## 高级配置

如果需要添加更多 MCP 服务器，编辑配置文件：

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "D:\\phpstudy_pro\\WebStackPage.github.io-master"],
      "env": {}
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your-api-key-here"
      }
    },
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

## 常见问题

### Q: 配置后没有生效？
A: 请重启 Claude Code CLI

### Q: 找不到配置文件？
A: 配置文件位置: `%USERPROFILE%\.claude\mcp_config.json`

### Q: MCP 服务器无法连接？
A: 检查网络连接，确保可以访问 npm registry

### Q: 如何禁用某个 MCP 服务器？
A: 从配置文件中删除对应的服务器配置，然后重启 Claude Code

## 参考资源

- [MCP 官方文档](https://modelcontextprotocol.io/)
- [MCP 服务器列表](https://github.com/modelcontextprotocol/servers)
- [Claude Code 文档](https://docs.anthropic.com/claude/docs/claude-code)
