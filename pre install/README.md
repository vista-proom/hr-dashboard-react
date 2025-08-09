# Windows Pre-Install

This folder contains scripts to install all requirements and set up the project on Windows.

## What it does
- Ensures Node.js LTS (>= 18) is installed via winget/chocolatey
- Installs npm dependencies for root, server, and client
- Optionally starts both dev servers

## Quick start (PowerShell)
Run from the repository root or from this folder:

```powershell
./pre install/install-all.ps1 -Run
```

If your Execution Policy blocks scripts, use:
```powershell
PowerShell -NoProfile -ExecutionPolicy Bypass -File "./pre install/install-all.ps1" -Run
```

## Quick start (Command Prompt)
```bat
pre install\install-all.bat -Run
```

## Individual steps
- Install Node only:
  ```powershell
  ./pre install/install-node.ps1
  ```
- Install dependencies only:
  ```powershell
  ./pre install/install-deps.ps1
  ```