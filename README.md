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
```

## Notes

- The initial PostgreSQL migration is checked in at `backend/prisma/migrations/0001_init/migration.sql`.
- The mobile app is configured for canvasser accounts only.
- The admin dashboard is configured for admin accounts only.
- For Android emulators, set `EXPO_PUBLIC_API_URL=http://10.0.2.2:3001`.
