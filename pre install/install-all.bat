@echo off
setlocal enableextensions enabledelayedexpansion

set SCRIPT_DIR=%~dp0
pushd "%SCRIPT_DIR%.." >nul
set REPO_ROOT=%CD%
popd >nul

where powershell >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo PowerShell is required. Please install PowerShell 5+.
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%install-all.ps1" %*
exit /b %ERRORLEVEL%