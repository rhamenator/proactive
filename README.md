# PROACTIVE Field Canvassing System

Monorepo implementation of the first-release PROACTIVE Field Canvassing System described in the developer handoff.

## Applications

- `backend/`: NestJS API with Prisma/PostgreSQL, JWT auth, turf management, CSV import/export, dashboard stats, and geofence-aware visit logging
- `admin-dashboard/`: Next.js admin dashboard for imports, assignments, canvasser management, and exports
- `mobile-app/`: Expo mobile app for canvassers with GPS capture and offline visit queueing

## Tech Stack

- Backend: NestJS, Prisma, PostgreSQL
- Admin dashboard: Next.js App Router
- Mobile app: Expo / React Native

## Quick Start

1. Install dependencies from the repo root:

```bash
npm install
```

1. Configure environment files:

```bash
cp backend/.env.example backend/.env
cp admin-dashboard/.env.example admin-dashboard/.env.local
cp mobile-app/.env.example mobile-app/.env
```

1. Start PostgreSQL and create a database matching `backend/.env`.

1. Generate Prisma client, run the initial migration, and seed sample data:

```bash
npm run prisma:generate
cd backend
npx prisma migrate deploy
npm run prisma:seed
cd ..
```

1. Run each app in its own terminal:

```bash
npm run dev:backend
npm run dev:admin
npm run dev:mobile
```

## Main Application Install And Use

Use this flow for local setup, admin testing, and internal demos.

1. Install and configure the stack with the `Quick Start` steps above.
1. Open the admin dashboard at `http://localhost:3000`.
1. Sign in with the seeded admin account.
1. Import or create turf data.
1. Create or invite field users.
1. Assign a turf to a canvasser.
1. Open the mobile app through Expo or an internal device build and sign in with a canvasser account.
1. Start a turf session, log visits, then return to the admin dashboard to review progress and exports.

Recommended local terminal layout:

- Terminal 1: `npm run dev:backend`
- Terminal 2: `npm run dev:admin`
- Terminal 3: `npm run dev:mobile`

Recommended first smoke test:

1. Log in to the admin dashboard as `admin@proactive.local`.
1. Create a turf or import a sample CSV.
1. Assign that turf to `canvasser@proactive.local`.
1. Log in on mobile with the canvasser account.
1. Start the turf, submit one visit, and confirm it appears in the dashboard/export data.

## Default Ports

- Backend API: `http://localhost:3001`
- Admin dashboard: `http://localhost:3000`
- Expo dev server: interactive Expo CLI output

## Seed Accounts

- Admin: `admin@proactive.local` / `Password123!`
- Canvasser: `canvasser@proactive.local` / `Password123!`

## Verification

Run the main checks from the repo root:

```bash
npm run build
npm run test
npm run test:coverage
```

## Automated UI Testing

Layered UI automation now exists for conservative production-sane coverage:

- fast mocked browser/UI flows (deterministic)
- seeded browser integration flows against a real backend/test database
- mobile offline-state automation now, with Detox scaffold for simulator/device e2e expansion

Run from the repo root:

```bash
npm run test:ui:mocked
npm run test:ui:seeded
npm run test:mobile:e2e:ios
```

Notes:

- `test:ui:seeded` runs deterministic seeding first via `npm run seed:e2e` and expects backend API availability.
- Mocked and seeded browser tests are configured in `admin-dashboard/playwright.config.ts`.
- Shared fake data lives in `testing/fake-data/` and shared mock scenarios in `testing/mocks/admin-dashboard/`.

## Trusted Release Builds

GitHub Actions now provides a release-oriented build path in `.github/workflows/release-builds.yml`.

What it produces:

- `proactive-backend-<version>.tar.gz`
  - compiled NestJS output from `backend/dist`
  - Prisma schema and migrations
  - backend package metadata and `.env.example`
- `proactive-admin-dashboard-<version>.tar.gz`
  - Next.js standalone server output
  - static assets needed to run `node server.js`
- `proactive-mobile-release-prep-<version>.tar.gz`
  - resolved Expo config snapshot
  - EAS config and environment templates
  - this is a release-prep artifact, not a signed mobile binary
- `BUILD-MANIFEST.txt` and `SHA256SUMS.txt`

The workflow also emits GitHub artifact attestations for the packaged artifacts so maintainers have provenance from GitHub Actions for release use.

### How maintainers trigger it

Manual artifact build:

1. Open `Actions` in GitHub.
1. Select `Release Builds`.
1. Choose `Run workflow`.
1. Pick the ref to build and optionally change `artifact_label`.
1. Download the uploaded artifacts from that workflow run.

Tagged release assets:

1. Create and push a release tag such as `v1.0.0`.
1. Publish a GitHub Release for that tag.
1. The same workflow runs on `release.published` and attaches the artifacts to the GitHub Release.

### External blockers that still apply

- Backend deployment still needs real production environment variables and a reachable PostgreSQL database.
- Admin deployment still needs real runtime environment variables for API access and auth.
- Mobile signed binaries are not produced by default in GitHub Actions today.
  - Still required for real mobile builds or store delivery:
    - `EXPO_TOKEN`
    - `EXPO_OWNER`
    - `EAS_PROJECT_ID`
    - real `IOS_BUNDLE_IDENTIFIER`
    - real `ANDROID_APPLICATION_ID`
    - Apple signing / App Store Connect credentials
    - Google Play signing / service-account credentials if Play delivery is used

See [docs/wiki/release-builds.md](/home/rich/dev/proactive/docs/wiki/release-builds.md) for the full maintainer runbook.

## Documentation

- Internal wiki: [docs/wiki/README.md](/home/rich/dev/proactive/docs/wiki/README.md)
- End-user help: [docs/help/README.md](/home/rich/dev/proactive/docs/help/README.md)
- Product baseline: [docs/v1-final-spec.md](/home/rich/dev/proactive/docs/v1-final-spec.md)
- Current implementation gaps: [docs/gap-analysis.md](/home/rich/dev/proactive/docs/gap-analysis.md)

## Internal Mobile Testing

For in-organization testing, the mobile app can be used in three practical ways:

- Expo development session: fastest for engineering and QA on simulators or devices with Expo Go / dev client workflows
- EAS internal preview build: best default for staff testing on real devices
- Store-managed internal tracks: TestFlight for iOS and Play Internal Testing for Android when you want controlled tester groups

High-level internal build flow:

1. Configure [mobile-app/.env.preview.example](/home/rich/dev/proactive/mobile-app/.env.preview.example) into a real `.env.preview`.
1. Set `EXPO_PUBLIC_API_URL`, `EXPO_OWNER`, `EAS_PROJECT_ID`, `IOS_BUNDLE_IDENTIFIER`, and `ANDROID_APPLICATION_ID`.
1. Log in to Expo with `npx eas login`.
1. Build preview binaries:

```bash
cd mobile-app
npm run eas:build:ios:preview
npm run eas:build:android:preview
```

1. Distribute the resulting artifacts through the method that matches the platform:

- iOS: TestFlight is the normal internal distribution path. Direct sideloading is limited on iPhone/iPad and usually requires Apple ad hoc or enterprise distribution.
- Android: internal APK/AAB distribution is straightforward. You can use Play Internal Testing or direct APK install for internal testers.

See [mobile-app/README.md](/home/rich/dev/proactive/mobile-app/README.md) for the detailed mobile build and side-loading instructions.

## Notes

- The initial PostgreSQL migration is checked in at `backend/prisma/migrations/0001_init/migration.sql`.
- The mobile app is configured for canvasser accounts only.
- The admin dashboard supports admin and supervisor accounts.
- For Android emulators, set `EXPO_PUBLIC_API_URL=http://10.0.2.2:3001`.
- The mobile release pipeline is configured for Expo EAS in `mobile-app/eas.json`; see `mobile-app/README.md` for preview, production, and OTA release steps.
