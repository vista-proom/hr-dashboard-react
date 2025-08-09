# HR Dashboard (React + Express + SQLite)

A minimal HR dashboard with authentication, roles, task management, time/location logging, and Tailwind UI.

## Features
- JWT auth (email + password) with roles: Employee, Viewer, Manager
- On login, captures user geolocation and timestamp
- Employee/Viewer/Manager Dashboards with role-based access
- Manager can assign/edit/delete tasks and set required hours per location
- SQLite persistence with seed data
- Tailwind CSS UI

## Quick Start (single command)
Run this from the repository root:

```bash
npm start
```

This will install all dependencies (root, server, client) and run both apps concurrently.

- Frontend: http://localhost:5173
- Backend: http://localhost:4000

## Default Seed Users
- Manager: manager@acme.com / Password123!
- Viewer: viewer@acme.com / Password123!
- Employee A: alice@acme.com / Password123!
- Employee B: bob@acme.com / Password123!

## Environment
Backend reads `JWT_SECRET` from `server/.env` if provided. Defaults to a development secret.

## Scripts
- `npm start`: Install deps and run both frontend and backend
- `npm run dev`: Run both apps (requires deps preinstalled)

## Tech
- Backend: Node.js, Express, better-sqlite3, JWT, bcrypt
- Frontend: React (Vite), React Router, Axios, Tailwind CSS

## Windows Installation
- Option 1 (recommended): PowerShell auto installer
  - Open PowerShell in the repo folder and run:
    ```powershell
    .\scripts\windows-install.ps1 -Run
    ```
    This will:
    - Install Node.js LTS via winget/choco if needed
    - Install all dependencies (root, server, client)
    - Start both dev servers

- Option 2: Batch wrapper
  - Double-click `scripts\windows-install.bat` or run in Command Prompt:
    ```bat
    scripts\windows-install.bat -Run
    ```

- Manual
  - Install Node.js LTS from `https://nodejs.org`
  - In repo root:
    ```bat
    npm install
    npm --prefix server install
    npm --prefix client install
    npm run dev
    ```

Notes:
- If `winget` is not available, the script falls back to Chocolatey if present.
- If neither is available, please install Node.js LTS manually then re-run the installer.
