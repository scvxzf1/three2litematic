@echo off
setlocal
chcp 65001 >nul

if exist "%~dp0runtime\node.exe" (
  "%~dp0runtime\node.exe" "%~dp0src\cli\index.js" %*
) else (
  node "%~dp0src\cli\index.js" %*
)

exit /b %ERRORLEVEL%
