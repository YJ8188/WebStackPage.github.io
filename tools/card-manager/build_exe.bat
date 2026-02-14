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

echo [2/3] Install/upgrade PyInstaller...
python -m pip install --upgrade pyinstaller
if errorlevel 1 (
  echo Failed to install PyInstaller.
  pause
  exit /b 1
)

echo [3/3] Build EXE...
pyinstaller --noconfirm --clean --onefile --windowed --name WebStackCardManager card_manager.py
if errorlevel 1 (
  echo Build failed. Check logs above.
  pause
  exit /b 1
)

echo.
echo Build complete: %~dp0dist\WebStackCardManager.exe
pause

