@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

if exist "%~dp0runtime\node.exe" (
  set "NODE_EXE=%~dp0runtime\node.exe"
) else (
  set "NODE_EXE=node"
)

title three2litematic
echo three2litematic - Windows portable build
echo Web workbench: http://127.0.0.1:28741/
echo Keep this window open. Close it or press Ctrl+C to stop the server.
echo.

if not defined T2L_NO_BROWSER (
  start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0scripts\open-when-ready.ps1"
)

"%NODE_EXE%" "%~dp0src\cli\index.js" serve %*
set "EXIT_CODE=%ERRORLEVEL%"

echo.
echo Server stopped with exit code %EXIT_CODE%.
pause
exit /b %EXIT_CODE%
