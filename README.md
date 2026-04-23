# PROACTIVE Field Canvassing System

PROACTIVE is a field canvassing monorepo with:

- `backend/`: NestJS API, Prisma, PostgreSQL, JWT auth, turf management, imports, exports, sync review, and policy settings
- `admin-dashboard/`: Next.js dashboard for admins and supervisors
- `mobile-app/`: Expo mobile app for canvassers with GPS capture and offline queueing

## Start Here

- [Local installation](docs/installation/local-install.md): install and run the full stack on a development machine.
- [Mobile installation](docs/installation/mobile-install.md): prepare the mobile app on a developer/build machine and install the app on devices through Expo, TestFlight, or Android APK.
- [Configuration](docs/installation/configuration.md): environment variables, ports, and database settings.
- [User manual](docs/user-manual.md): role-based instructions for admins, supervisors, and canvassers.
- [Troubleshooting](docs/help/troubleshooting.md): common login, sync, GPS, CSV, and export issues.

## Installer Commands

From the repo root:

```bash
npm run setup:local
npm run setup:mobile
```

Equivalent direct commands:

```bash
scripts/install-local.sh
scripts/install-mobile.sh
```

Use `--help` on either installer to see available options.

These scripts run on a computer, not directly on phones or tablets. Mobile devices install Expo sessions or built app artifacts.

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
- [Release builds](docs/wiki/release-builds.md)
- [Product baseline](docs/v1-final-spec.md)
- [Current implementation gaps](docs/gap-analysis.md)
