# Operations Runbook

## Local Startup

From repo root:

```bash
npm install
cp backend/.env.example backend/.env
cp admin-dashboard/.env.example admin-dashboard/.env.local
cp mobile-app/.env.example mobile-app/.env
```

Then:

```bash
npm run prisma:generate
cd backend
npx prisma migrate deploy
npm run prisma:seed
cd ..
```

Run services:

```bash
npm run dev:backend
npm run dev:admin
npm run dev:mobile
```

## Local Endpoints

- backend: `http://localhost:3001`
- admin dashboard: `http://localhost:3000`

## Default Seed Accounts

- admin: `admin@proactive.local` / `Password123!`
- canvasser: `canvasser@proactive.local` / `Password123!`

## Main Verification Commands

From repo root:

```bash
npm test
npm run test:coverage
npm run build
```

## Mobile Internal Testing

Detailed mobile release and internal install instructions are in:

- [Repo README](/home/rich/dev/proactive/README.md)
- [Mobile README](/home/rich/dev/proactive/mobile-app/README.md)
- [Canvasser Mobile Help](/home/rich/dev/proactive/docs/help/canvasser-mobile-guide.md)

## Safe Operational Checks

Before field testing:

1. Confirm the backend is reachable from the device.
2. Confirm test users exist and are active.
3. Confirm at least one turf is assigned.
4. Confirm export works from the dashboard.
5. Confirm one offline visit can queue and later sync.

## When Something Breaks

Check in this order:

1. Environment files and API URL values
2. PostgreSQL availability
3. Prisma migration status
4. backend logs
5. mobile queue state and connectivity
6. dashboard login token/session state
