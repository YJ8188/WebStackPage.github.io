@echo off
setlocal

set REPO_PATH=%~1
if "%REPO_PATH%"=="" set REPO_PATH=.

set REMOTE=%~2
if "%REMOTE%"=="" set REMOTE=origin

set BRANCH=%~3
if "%BRANCH%"=="" set BRANCH=master

set MAX_ATTEMPTS=%~4
if "%MAX_ATTEMPTS%"=="" set MAX_ATTEMPTS=8

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0git-safe-push.ps1" -RepoPath "%REPO_PATH%" -Remote "%REMOTE%" -Branch "%BRANCH%" -MaxAttempts %MAX_ATTEMPTS%
exit /b %ERRORLEVEL%

