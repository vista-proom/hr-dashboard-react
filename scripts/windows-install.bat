@echo off
setlocal enableextensions enabledelayedexpansion

REM Determine repo root relative to this script
set SCRIPT_DIR=%~dp0
pushd %SCRIPT_DIR%.. >nul
set REPO_ROOT=%CD%
popd >nul

REM Ensure PowerShell 5+ is available
where powershell >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo PowerShell is required. Please install PowerShell 5+.
  exit /b 1
)

REM Run the PowerShell installer
powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\scripts\windows-install.ps1" %*
exit /b %ERRORLEVEL%