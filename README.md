# PROACTIVE Field Canvassing System

PROACTIVE helps outreach teams plan door-to-door work, send canvassers into the field with a mobile app, and see results come back into one shared system.

In plain terms:

- office staff use the admin dashboard to upload address lists, organize them into walkable areas, assign work, review progress, and export results
- canvassers use the mobile app to see their assignments, record visit outcomes, capture location checks, and keep working even when connectivity is weak
- the backend keeps the data in sync so supervisors can see what happened in the field without waiting for paper notes or spreadsheet merges

This repository contains the full system:

- `backend/`: NestJS API, Prisma, PostgreSQL, JWT auth, turf management, imports, exports, sync review, and policy settings
- `admin-dashboard/`: Next.js dashboard for admins and supervisors
- `mobile-app/`: Expo mobile app for canvassers with GPS capture and offline queueing

## Start Here

- [Really quick start (step-by-step)](docs/installation/really-quick-start.md): fastest path for local setup, container server deployment, and mobile binary builds.
- [Local installation](docs/installation/local-install.md): install and run the full stack on a development machine.
- [Mobile build workstation setup](docs/installation/mobile-install.md): prepare the Expo mobile workspace on a developer/build machine. This does not create signed mobile binaries by itself.
- [Configuration](docs/installation/configuration.md): environment variables, ports, and database settings.
- [Deployment](docs/installation/deployment.md): deploy the backend/admin services and understand how mobile release builds fit into production delivery.
- [User manual](docs/user-manual.md): role-based instructions for admins, supervisors, and canvassers.
- [Troubleshooting](docs/help/troubleshooting.md): common login, sync, GPS, CSV, and export issues.

## Installer Commands

From the repo root:

```bash
npm run setup:local
npm run setup:mobile
```

What these do:

- `npm run setup:local` prepares a local development environment for the full stack
- `npm run setup:mobile` prepares the Expo mobile workspace, environment files, and validation checks on your computer
- `npm run setup:mobile` does not produce an `.ipa`, `.apk`, or store-ready release by itself

The npm commands now select the correct installer for your platform:

- Linux: `scripts/install-local.sh` and `scripts/install-mobile.sh`
- macOS: `scripts/install-local-macos.sh` and `scripts/install-mobile-macos.sh`
- Windows PowerShell: `scripts/install-local.ps1` and `scripts/install-mobile.ps1`

Equivalent direct commands:

```bash
scripts/install-local.sh
scripts/install-mobile.sh
```

```bash
bash scripts/install-local-macos.sh
bash scripts/install-mobile-macos.sh
```

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-local.ps1
powershell -ExecutionPolicy Bypass -File scripts/install-mobile.ps1
```

Use `--help` on either installer to see available options.

These scripts run on a computer, not directly on phones or tablets. Phones receive either an Expo session for local testing or binaries built later through the EAS/release flow documented in [docs/installation/deployment.md](docs/installation/deployment.md).

For server-side consistency across environments, PROACTIVE also includes a Docker Compose path for backend, admin dashboard, and PostgreSQL. See [docs/installation/deployment.md](docs/installation/deployment.md) for container deployment steps.

## Daily Development

Run each app in its own terminal:

```bash
npm run dev:backend
npm run dev:admin
npm run dev:mobile
```

Default local URLs:

- Admin dashboard: `http://localhost:3000`
- Backend API: `http://localhost:3001`
- Expo dev server: shown by the Expo CLI

Seed accounts created by the local seed:

- Admin: `admin@proactive.local` / `Password123!`
- Canvasser: `canvasser@proactive.local` / `Password123!`

## Verification

```bash
npm run build
npm run test
npm run test:coverage
```

UI and mobile automation:

```bash
npm run test:ui:mocked
npm run test:ui:seeded
npm run test:mobile:e2e:ios
```

## Maintainer Docs

- [Documentation index](docs/README.md)
- [Internal wiki](docs/wiki/README.md)
- [Deployment guide](docs/installation/deployment.md)
- [Release builds](docs/wiki/release-builds.md)
- [Product baseline](docs/v1-final-spec.md)
- [Current implementation gaps](docs/gap-analysis.md)
