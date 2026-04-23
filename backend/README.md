# PROACTIVE Backend

NestJS backend for the PROACTIVE Field Canvassing System.

## Setup

Recommended first-time setup is from the repository root:

```bash
npm run setup:local
```

That command installs workspace dependencies, creates missing environment files, generates Prisma, applies checked-in migrations, and seeds demo data.

Backend-only setup for experienced developers:

```bash
cp .env.example .env
npm install
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:seed
```

## Development

From the repository root:

```bash
npm run dev:backend
```

From `backend/`:

```bash
npm run start:dev
```

## Build

```bash
npm run build
```

## Database

The Prisma schema targets PostgreSQL. For normal local setup, use checked-in migrations:

```bash
npx prisma migrate deploy
npm run prisma:seed
```

Use `npx prisma migrate dev` only when intentionally creating a new migration during schema development.

## Notes

- JWT auth uses email/password with bcrypt hashes.
- CSV import accepts file upload plus optional header mapping.
- Geofence validation defaults to a 100 meter radius and flags, rather than hard-rejects, visits outside the radius.
- UTC remains the canonical storage/comparison/audit timezone.
- Reporting and export timezone behavior is centralized in `src/common/utils/timezone-policy.util.ts`.
- Optional environment variables:
  - `REPORT_BUCKET_TIME_ZONE` (default `UTC`) controls trend bucket timezone labels/calculations.
  - `EXPORT_TIME_ZONE` (default `UTC`) controls export timestamp rendering and `time_zone` column labeling.
