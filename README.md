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

2. Configure environment files:

```bash
cp backend/.env.example backend/.env
cp admin-dashboard/.env.example admin-dashboard/.env.local
cp mobile-app/.env.example mobile-app/.env
```

3. Start PostgreSQL and create a database matching `backend/.env`.

4. Generate Prisma client, run the initial migration, and seed sample data:

```bash
npm run prisma:generate
cd backend
npx prisma migrate deploy
npm run prisma:seed
cd ..
```

5. Run each app in its own terminal:

```bash
npm run dev:backend
npm run dev:admin
npm run dev:mobile
```

## Main Application Install And Use

Use this flow for local setup, admin testing, and internal demos.

1. Install and configure the stack with the `Quick Start` steps above.
2. Open the admin dashboard at `http://localhost:3000`.
3. Sign in with the seeded admin account.
4. Import or create turf data.
5. Create or invite field users.
6. Assign a turf to a canvasser.
7. Open the mobile app through Expo or an internal device build and sign in with a canvasser account.
8. Start a turf session, log visits, then return to the admin dashboard to review progress and exports.

Recommended local terminal layout:

- Terminal 1: `npm run dev:backend`
- Terminal 2: `npm run dev:admin`
- Terminal 3: `npm run dev:mobile`

Recommended first smoke test:

1. Log in to the admin dashboard as `admin@proactive.local`.
2. Create a turf or import a sample CSV.
3. Assign that turf to `canvasser@proactive.local`.
4. Log in on mobile with the canvasser account.
5. Start the turf, submit one visit, and confirm it appears in the dashboard/export data.

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
2. Set `EXPO_PUBLIC_API_URL`, `EXPO_OWNER`, `EAS_PROJECT_ID`, `IOS_BUNDLE_IDENTIFIER`, and `ANDROID_APPLICATION_ID`.
3. Log in to Expo with `npx eas login`.
4. Build preview binaries:

```bash
cd mobile-app
npm run eas:build:ios:preview
npm run eas:build:android:preview
```

5. Distribute the resulting artifacts through the method that matches the platform:

- iOS: TestFlight is the normal internal distribution path. Direct sideloading is limited on iPhone/iPad and usually requires Apple ad hoc or enterprise distribution.
- Android: internal APK/AAB distribution is straightforward. You can use Play Internal Testing or direct APK install for internal testers.

See [mobile-app/README.md](/home/rich/dev/proactive/mobile-app/README.md) for the detailed mobile build and side-loading instructions.

## Notes

- The initial PostgreSQL migration is checked in at `backend/prisma/migrations/0001_init/migration.sql`.
- The mobile app is configured for canvasser accounts only.
- The admin dashboard is configured for admin accounts only.
- For Android emulators, set `EXPO_PUBLIC_API_URL=http://10.0.2.2:3001`.
- The mobile release pipeline is configured for Expo EAS in `mobile-app/eas.json`; see `mobile-app/README.md` for preview, production, and OTA release steps.
