@echo off
rem Installs Operator Tool Kit on this computer: Start menu and desktop shortcuts that open it in its own window.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-windows.ps1"
echo.
pause
