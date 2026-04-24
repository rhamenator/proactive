# Operations Runbook

## Local Startup

From repo root:

```bash
npm run setup:local
```

Manual equivalent:

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

- [Repo README](../../README.md)
- [Deployment guide](../installation/deployment.md)
- [Mobile README](../../mobile-app/README.md)
- [Canvasser Mobile Help](../help/canvasser-mobile-guide.md)

## Safe Operational Checks

Before field testing:

1. Confirm the backend is reachable from the device.
2. Confirm test users exist and are active.
3. Confirm at least one turf is assigned.
4. Confirm organization or campaign policy defaults are set as expected in `Policies`.
5. Confirm system-wide auth throttling and retention automation values are correct in the `System-Wide` settings card.
6. Confirm export works from the dashboard.
7. Confirm one offline visit can queue and later sync.

## Policy Reset Behavior

- scoped policy records can inherit from a broader scope instead of storing a full override forever
- campaign policy reset falls back to organization policy
- organization policy reset falls back to deployment defaults
- system-wide settings reset falls back to environment defaults
- sensitive policy or system-setting changes require a fresh MFA confirmation and are audit logged

## When Something Breaks

Check in this order:

1. Environment files and API URL values
2. PostgreSQL availability
3. Prisma migration status
4. backend logs
5. mobile queue state and connectivity
6. dashboard login token/session state
