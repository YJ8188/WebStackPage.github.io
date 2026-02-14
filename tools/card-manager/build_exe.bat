@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

echo [1/3] Check Python...
python --version
if errorlevel 1 (
  echo Python not found. Please install Python 3.10+ first.
  pause
  exit /b 1
)

echo [2/3] Install dependencies...
python -m pip install --upgrade pyinstaller
python -m pip install --no-deps pywebview==4.4.1
python -m pip install bottle proxy-tools typing_extensions
if errorlevel 1 (
  echo Failed to install dependencies.
  pause
  exit /b 1
)

echo [2/3] Prepare embedded workspace...
set REPO_ROOT=%~dp0..\..\
set BUNDLE_DIR=%~dp0workspace_bundle

if exist "%BUNDLE_DIR%" rmdir /s /q "%BUNDLE_DIR%"
mkdir "%BUNDLE_DIR%"

for %%F in (index.html login.html erp.html erp-ant.html about.html 404.html) do (
  if exist "%REPO_ROOT%%%F" copy /y "%REPO_ROOT%%%F" "%BUNDLE_DIR%\%%F" >nul
)

if exist "%REPO_ROOT%assets" (
  robocopy "%REPO_ROOT%assets" "%BUNDLE_DIR%\assets" /E >nul
)

if not exist "%BUNDLE_DIR%\index.html" (
  echo Failed to prepare workspace bundle.
  pause
  exit /b 1
)

echo [3/3] Build desktop/runtime EXE...
set BUILD_TAG=%DATE:~0,4%%DATE:~5,2%%DATE:~8,2%_%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%
set BUILD_TAG=%BUILD_TAG: =0%

set DESKTOP_OUT=dist\WebStackDesktop_%BUILD_TAG%
set MANAGER_OUT=dist\WebStackManager_%BUILD_TAG%

pyinstaller --noconfirm --clean --onefile --windowed --name WebStackDesktop --distpath "%DESKTOP_OUT%" --add-data "workspace_bundle;workspace_bundle" webstack_runtime.py
if errorlevel 1 (
  echo Desktop build failed. Check logs above.
  pause
  exit /b 1
)

echo [3/3] Build manager EXE...
pyinstaller --noconfirm --clean --onefile --windowed --name WebStackManager --distpath "%MANAGER_OUT%" --add-data "workspace_bundle;workspace_bundle" card_manager.py
if errorlevel 1 (
  echo Manager build failed. Check logs above.
  pause
  exit /b 1
)

echo.
echo Build complete:
echo - %~dp0%DESKTOP_OUT%\WebStackDesktop.exe
echo - %~dp0%MANAGER_OUT%\WebStackManager.exe
pause
