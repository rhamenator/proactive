# Local Installation

Use this guide to run the full PROACTIVE system on a local development machine.

## What This Installs

- Root npm workspace dependencies
- Backend Prisma client
- Backend `.env`
- Admin dashboard `.env.local`
- Mobile app `.env`
- Database migrations and seed data, unless skipped

## Prerequisites

- Node.js `22` or newer
- npm
- PostgreSQL
- A database matching `backend/.env` `DATABASE_URL`

Default database URL:

```text
postgresql://postgres:postgres@localhost:5432/proactive?schema=public
```

Create that database before running migrations, or edit `backend/.env` after the installer creates it.

## Install With The Script

From the repo root:

```bash
npm run setup:local
```

Direct platform-specific commands:

```bash
scripts/install-local.sh
```

```bash
bash scripts/install-local-macos.sh
```

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-local.ps1
```

The installer keeps existing environment files and only creates missing ones.

## Installer Options

```bash
npm run setup:local -- --help
npm run setup:local -- --skip-db
npm run setup:local -- --skip-install
```

- `--skip-db`: install dependencies and generate Prisma without applying migrations or seed data.
- `--skip-install`: keep existing `node_modules` and continue with Prisma/database setup.

On Windows PowerShell, use parameter names instead:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-local.ps1 -Help
powershell -ExecutionPolicy Bypass -File scripts/install-local.ps1 -SkipDb
powershell -ExecutionPolicy Bypass -File scripts/install-local.ps1 -SkipInstall
```

## Manual Install

Use this only when you need to see or customize every step.

```bash
npm install
cp backend/.env.example backend/.env
cp admin-dashboard/.env.example admin-dashboard/.env.local
cp mobile-app/.env.example mobile-app/.env
npm run prisma:generate
cd backend
npx prisma migrate deploy
npm run prisma:seed
cd ..
```

## Start The System

Run each command in a separate terminal:

```bash
npm run dev:backend
npm run dev:admin
npm run dev:mobile
```

Open:

- Admin dashboard: `http://localhost:3000`
- Backend API: `http://localhost:3001`
- Expo: use the QR code or simulator options shown by Expo

## Seed Accounts

- Admin: `admin@proactive.local` / `Password123!`
- Canvasser: `canvasser@proactive.local` / `Password123!`

## First Smoke Test

1. Open `http://localhost:3000`.
2. Sign in as `admin@proactive.local`.
3. Create or import a turf.
4. Assign the turf to `canvasser@proactive.local`.
5. Open the mobile app through Expo.
6. Sign in as `canvasser@proactive.local`.
7. Start the turf and submit one test visit.
8. Confirm the visit appears in the admin dashboard or export data.

## Verify The Build

```bash
npm run build
npm run test
```

Use coverage when you need the longer check:

```bash
npm run test:coverage
```

## Common Install Problems

- If migrations fail, PostgreSQL is not running, the database does not exist, or `DATABASE_URL` is wrong.
- If mobile cannot reach the API from Android emulator, set `EXPO_PUBLIC_API_URL=http://10.0.2.2:3001`.
- If a physical device cannot reach the API, use the computer LAN IP instead of `localhost`.
