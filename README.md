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
