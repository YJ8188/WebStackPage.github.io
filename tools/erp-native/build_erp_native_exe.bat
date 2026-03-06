@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

echo Check Python...
python --version
if errorlevel 1 (
  echo Python not found.
  pause
  exit /b 1
)

echo Install build dependencies...
python -m pip install --upgrade pyinstaller
if errorlevel 1 (
  echo Failed to install pyinstaller.
  pause
  exit /b 1
)

echo Build WebStackERPNative.exe...
set BUILD_TAG=%DATE:~0,4%%DATE:~5,2%%DATE:~8,2%_%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%
set BUILD_TAG=%BUILD_TAG: =0%
set OUT_DIR=dist\WebStackERPNative_%BUILD_TAG%
set "REPO_ROOT=%~dp0..\..\"

pyinstaller --noconfirm --clean --onefile --windowed --name WebStackERPNative --distpath "%OUT_DIR%" --add-data "%REPO_ROOT%assets\js\supabase-config.js;assets\js" app.py
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)

echo Copy required web config into dist folder (for support/debug)...
if exist "%REPO_ROOT%assets\js\supabase-config.js" (
  if not exist "%OUT_DIR%\assets\js" mkdir "%OUT_DIR%\assets\js" >nul 2>nul
  copy /y "%REPO_ROOT%assets\js\supabase-config.js" "%OUT_DIR%\assets\js\supabase-config.js" >nul
)

echo.
echo Build complete:
echo - %~dp0%OUT_DIR%\WebStackERPNative.exe
pause
