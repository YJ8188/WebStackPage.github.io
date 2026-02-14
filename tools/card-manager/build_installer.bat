@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

echo [1/2] Build EXE first...
call build_exe.bat
if errorlevel 1 (
  echo EXE build failed.
  exit /b 1
)

echo Copy latest EXEs to dist root for installer...
for /f "delims=" %%d in ('dir /b /ad "dist\WebStackManager_*" ^| sort') do set LATEST_MANAGER=%%d

if defined LATEST_MANAGER (
  copy /y "dist\%LATEST_MANAGER%\WebStackManager.exe" "dist\WebStackManager.exe" >nul
)

echo [2/2] Build installer (Inno Setup)...
set ISCC_PATH="C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if not exist %ISCC_PATH% set ISCC_PATH="C:\Program Files\Inno Setup 6\ISCC.exe"

if not exist %ISCC_PATH% (
  echo Inno Setup 6 not found.
  echo Please install Inno Setup 6 from: https://jrsoftware.org/isdl.php
  echo After install, run this script again.
  pause
  exit /b 1
)

%ISCC_PATH% webstack_card_manager.iss
if errorlevel 1 (
  echo Installer build failed.
  pause
  exit /b 1
)

echo.
echo Installer ready in: %~dp0dist-installer\WebStackManager-Setup.exe
pause
