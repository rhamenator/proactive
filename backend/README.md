# PROACTIVE Backend

NestJS backend for the PROACTIVE Field Canvassing System.

## Setup

```bash
cd backend
npm install
npm run prisma:generate
cp .env.example .env
```

## Development

```bash
npm run start:dev
```

## Build

```bash
npm run build
```

## Database

The Prisma schema targets PostgreSQL. After wiring a database, run:

```bash
npx prisma migrate dev
npm run prisma:seed
```

## Notes

- JWT auth uses email/password with bcrypt hashes.
- CSV import accepts file upload plus optional header mapping.
- Geofence validation defaults to a 100 meter radius and flags, rather than hard-rejects, visits outside the radius.
- UTC remains the canonical storage/comparison/audit timezone.
- Reporting and export timezone behavior is centralized in `src/common/utils/timezone-policy.util.ts`.
- Optional environment variables:
  - `REPORT_BUCKET_TIME_ZONE` (default `UTC`) controls trend bucket timezone labels/calculations.
  - `EXPORT_TIME_ZONE` (default `UTC`) controls export timestamp rendering and `time_zone` column labeling.
