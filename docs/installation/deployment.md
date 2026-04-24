# Deployment Guide

Use this guide when you are moving beyond local setup and want to run PROACTIVE for a real team, pilot, or production environment.

If your priority is environment consistency, use the Docker deployment path in this document. Containers reduce machine drift by running backend, admin dashboard, and PostgreSQL with pinned runtime images and shared compose configuration.

## What "Deployment" Means Here

PROACTIVE has three parts that move on different timelines:

- Backend API: the service that stores data, authenticates users, and powers sync/import/export behavior
- Admin dashboard: the browser application used by staff and supervisors
- Mobile app: the Expo-based app used by canvassers in the field

The backend and admin dashboard can be packaged from this repository and deployed to hosting you control. The mobile app has a separate release path because signed iOS and Android binaries require Expo/EAS plus Apple and Google credentials.

## Before You Deploy

Confirm these prerequisites first:

- Node.js 22 or newer in your build environment
- A PostgreSQL database for the target environment
- A long random `JWT_SECRET`
- A public HTTPS URL for the backend API
- A public HTTPS URL for the admin dashboard
- Expo/EAS project ownership and store credentials if you need mobile preview or production binaries

Read these supporting docs before doing first-time deployment:

- [configuration.md](configuration.md)
- [mobile-install.md](mobile-install.md)
- [../wiki/release-builds.md](../wiki/release-builds.md)
- [../wiki/operations-runbook.md](../wiki/operations-runbook.md)

## Deployment Paths At A Glance

### 1. Backend and admin dashboard

Use this path when you want a hosted API and hosted dashboard for real users.

High-level flow:

1. Build or download the trusted backend and admin artifacts.
2. Set production environment variables.
3. Provision and verify PostgreSQL.
4. Run Prisma migrations against the target database.
5. Start the backend.
6. Start the admin dashboard and point it at the production API.
7. Run smoke tests with real HTTPS URLs.

### 1b. Backend, admin dashboard, and PostgreSQL with Docker Compose

Use this when you want a repeatable, containerized server environment.

High-level flow:

1. Copy `.env.docker.example` to `.env` and set real secrets.
2. Build and start services with Docker Compose.
3. Verify backend and dashboard health.
4. Run database migration from a controlled step before serving production traffic.

Quick-start commands:

```bash
cp .env.docker.example .env
docker compose up --build -d
docker compose ps
```

Default ports:

- dashboard: `http://localhost:3000`
- backend API: `http://localhost:3001`
- PostgreSQL: `localhost:5432`

Current compose services:

- `postgres` from `postgres:17-alpine`
- `backend` from `backend/Dockerfile`
- `admin-dashboard` from `admin-dashboard/Dockerfile`

Important operational note:

- The current backend runtime image does not include the Prisma CLI. Migration should be run as an explicit pre-deploy step from a controlled environment before or during rollout.
- For now, use your normal migration path (for example from a build runner with repository dependencies available) before routing production traffic.

### 2. Mobile internal preview

Use this when testers need installable app builds before store release.

High-level flow:

1. Run `npm run setup:mobile` to prepare the mobile workspace.
2. Create preview environment values locally and in EAS.
3. Run the preview EAS build commands.
4. Distribute through TestFlight, Expo preview flow, or Android internal distribution.

### 3. Mobile production release

Use this when you are shipping to the App Store or Google Play.

High-level flow:

1. Confirm production API and identifiers.
2. Configure production EAS environment values.
3. Run the production EAS build commands.
4. Submit or upload to the app stores.

## Backend Deployment

Minimum runtime requirements:

- PostgreSQL reachable from the backend runtime
- `DATABASE_URL` set for the target database
- `JWT_SECRET` replaced with a real secret
- Prisma migrations applied before serving traffic

Typical backend deployment sequence:

```bash
npm ci
npm run prisma:generate
npm run build --workspace @proactive/backend
cd backend
npx prisma migrate deploy
node dist/main.js
```

If you are deploying from the GitHub release artifacts instead of building locally, use the packaged backend bundle described in [../wiki/release-builds.md](../wiki/release-builds.md) and still run your production dependency install plus migration step before serving traffic.

## Admin Dashboard Deployment

Minimum runtime requirement:

- `NEXT_PUBLIC_API_URL` must point to the public backend URL reachable by admin users in their browsers

Typical dashboard deployment sequence:

```bash
npm ci
npm run build --workspace @proactive/admin-dashboard
npm run start --workspace @proactive/admin-dashboard
```

If you are deploying the standalone bundle from GitHub release artifacts, start it with `node server.js` as described in [../wiki/release-builds.md](../wiki/release-builds.md).

## Mobile Release Reality Check

`npm run setup:mobile` is a setup step, not a build-and-sign step.

It does this:

- creates or updates local Expo environment files
- installs repo dependencies unless skipped
- validates the mobile TypeScript workspace

It does not do this:

- produce an `.ipa`
- produce an `.apk` or `.aab`
- sign a release for Apple or Google distribution

Those outcomes come later from EAS build and submission commands.

## Mobile Preview Build Sequence

Prepare preview values:

```bash
npm run setup:mobile -- --preview-env
cd mobile-app
npx eas login
npx eas project:init
```

Set preview environment values in EAS, then build:

```bash
npm run eas:build:ios:preview
npm run eas:build:android:preview
```

Use these when distributing to internal testers.

## Mobile Production Build Sequence

Prepare production values:

```bash
npm run setup:mobile -- --production-env
cd mobile-app
```

Set production environment values in EAS, then build and submit:

```bash
npm run eas:build:ios:production
npm run eas:build:android:production
npm run eas:submit:ios
npm run eas:submit:android
```

## Release Artifacts From GitHub

This repository already documents a GitHub-hosted release build flow in [../wiki/release-builds.md](../wiki/release-builds.md).

Use that when you want:

- reproducible backend/admin build artifacts produced by GitHub Actions
- checksums and attestation for packaged release assets
- a mobile release-prep bundle that captures Expo config without producing signed mobile binaries

Important: the current GitHub workflow does not output final signed mobile binaries. It only produces mobile release-prep material until the required external mobile credentials are available.

## Docker Deployment Notes

Docker deployment support is available in this repository:

- `docker-compose.yml` provides a multi-service topology for backend, dashboard, and PostgreSQL.
- `.env.docker.example` documents required environment variables.
- `backend/Dockerfile` and `admin-dashboard/Dockerfile` define production-oriented runtime images.

Why this is useful:

- keeps runtime versions consistent between hosts
- improves reproducibility in staging and self-hosted production
- gives operators a single place to declare shared service configuration

Containerization scope today:

- server-side components are containerized
- mobile build/signing remains an Expo/EAS pipeline concern outside Docker Compose

## Production Smoke Test Checklist

After deployment, verify at least this much:

1. Admin users can open the dashboard and sign in.
2. The dashboard can read and write data through the production API.
3. Database migrations are fully applied.
4. A test canvasser can authenticate from the mobile app.
5. Assigned turf appears on the mobile device.
6. One visit can be created and later seen in the dashboard.
7. Export still works from the admin dashboard.

## Related Docs

- [local-install.md](local-install.md)
- [mobile-install.md](mobile-install.md)
- [configuration.md](configuration.md)
- [../wiki/release-builds.md](../wiki/release-builds.md)
- [../wiki/operations-runbook.md](../wiki/operations-runbook.md)
