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
