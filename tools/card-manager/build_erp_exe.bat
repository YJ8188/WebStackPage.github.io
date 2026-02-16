@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

echo [1/4] Check Python 3.13...
py -3.13 --version
if errorlevel 1 (
  echo Python 3.13 not found.
  echo Please install Python 3.13, then run this script again.
  pause
  exit /b 1
)

echo [2/4] Install build dependencies (Python 3.13)...
py -3.13 -m pip install --upgrade pip
py -3.13 -m pip install --upgrade pyinstaller
if errorlevel 1 (
  echo Failed to install pyinstaller.
  pause
  exit /b 1
)

echo [3/4] Install runtime dependencies (Python 3.13)...
py -3.13 -m pip install --upgrade pywebview==4.4.1 pythonnet bottle proxy-tools typing_extensions
if errorlevel 1 (
  echo Failed to install pywebview/pythonnet dependencies.
  pause
  exit /b 1
)

echo Verify pythonnet + pywebview...
py -3.13 -c "import webview; import clr" >nul
if errorlevel 1 (
  echo Dependency verification failed. pythonnet/pywebview not working.
  pause
  exit /b 1
)

echo [4/4] Prepare embedded workspace...
set "REPO_ROOT=%~dp0..\..\"
set "BUNDLE_DIR=%~dp0workspace_bundle"

if exist "%BUNDLE_DIR%" rmdir /s /q "%BUNDLE_DIR%"
mkdir "%BUNDLE_DIR%"

for %%F in (index.html login.html erp.html erp-ant.html about.html 404.html) do (
  if exist "%REPO_ROOT%%%F" copy /y "%REPO_ROOT%%%F" "%BUNDLE_DIR%\%%F" >nul
)

if exist "%REPO_ROOT%CNAME" copy /y "%REPO_ROOT%CNAME" "%BUNDLE_DIR%\CNAME" >nul

if exist "%REPO_ROOT%assets" (
  robocopy "%REPO_ROOT%assets" "%BUNDLE_DIR%\assets" /E >nul
)

if not exist "%BUNDLE_DIR%\index.html" (
  echo workspace_bundle prepare failed: index.html not found.
  pause
  exit /b 1
)

echo Build WebStackERP.exe...
set BUILD_TAG=%DATE:~0,4%%DATE:~5,2%%DATE:~8,2%_%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%
set BUILD_TAG=%BUILD_TAG: =0%
set ERP_OUT=dist\WebStackERP_%BUILD_TAG%
if not exist "dist" mkdir "dist"

py -3.13 -m PyInstaller --noconfirm --clean --onefile --windowed --name WebStackERP --distpath "%ERP_OUT%" --add-data "workspace_bundle;workspace_bundle" webstack_erp_desktop.py
if errorlevel 1 (
  echo ERP build failed.
  pause
  exit /b 1
)

echo Sync latest ERP binary to dist root...
copy /y "%ERP_OUT%\WebStackERP.exe" "dist\WebStackERP.exe" >nul

echo.
echo Build complete:
echo - %~dp0%ERP_OUT%\WebStackERP.exe
echo - %~dp0dist\WebStackERP.exe
pause
