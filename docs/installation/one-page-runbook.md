# One-Page Runbook (Printable)

Use this as a copy/paste command checklist.

## A) Local Full-Stack Bring-Up (Dev Machine)

```bash
npm run setup:local
```

Expected:

- Installer completes without errors.
- Env files exist.
- Database migration and seed complete.

PASS if all three expected items are true.

FAIL if setup exits with errors. Stop and ask for help.

```bash
npm run dev:backend
```

Expected:

- Backend running at `http://localhost:3001`.

PASS if terminal stays running and no immediate error appears.

FAIL if process exits or shows red error text.

```bash
npm run dev:admin
```

Expected:

- Dashboard running at `http://localhost:3000`.

PASS if page opens and loads in browser.

FAIL if page does not load.

```bash
npm run dev:mobile
```

Expected:

- Expo dev server starts and shows QR/simulator options.

PASS if QR/simulator options appear.

FAIL if Expo exits or cannot start.

Login check:

- Admin user: `admin@proactive.local`
- Password: `Password123!`

## B) Pre-Deploy Validation

```bash
npm run build
npm run test
```

Expected:

- Build succeeds.
- Tests pass.

PASS if both commands complete with no failures.

FAIL if either command fails. Stop before deployment.

## C) Server Deployment (Docker Compose)

```bash
cp .env.docker.example .env
```

Edit `.env` and set required values:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`

Set API URL in `.env` for real users (example):

```text
NEXT_PUBLIC_API_URL=https://api.your-domain.com
```

Start services:

```bash
docker compose up --build -d
docker compose ps
```

Expected:

- `postgres`, `backend`, `admin-dashboard` show as running.

PASS if all three services are running.

FAIL if any service is not running.

Apply database migrations before live traffic:

Stop-and-ask checkpoint:

- If you are unsure this is the correct production database, stop and ask before running migration.
- Running migration against the wrong DB can cause data loss.

```bash
cd backend
npx prisma migrate deploy
cd ..
```

Expected:

- Migration command reports success.

PASS if Prisma reports migration success.

FAIL if Prisma reports an error. Do not continue.

## D) Mobile Binary Builds (EAS)

Prepare mobile workspace:

```bash
npm run setup:mobile
```

Optional (set production API URL during setup):

```bash
npm run setup:mobile -- --api-url https://api.your-domain.com
```

Login and initialize EAS project:

```bash
cd mobile-app
npx eas login
npx eas project:init
```

Preview/internal builds:

```bash
npm run eas:build:ios:preview
npm run eas:build:android:preview
```

Production builds:

```bash
npm run eas:build:ios:production
npm run eas:build:android:production
```

Store submission:

Stop-and-ask checkpoint:

- Do not run store submission unless release approval is granted.
- If store credentials are missing, stop and ask release owner.

```bash
npm run eas:submit:ios
npm run eas:submit:android
```

PASS if submission commands complete and return submission IDs.

FAIL if credentials/signing errors appear.

## E) Post-Deploy Smoke Test

1. Open dashboard URL and log in.
2. Confirm dashboard can load and write data.
3. Confirm mobile login works.
4. Confirm one visit can be submitted.
5. Confirm visit appears in dashboard/report/export.

PASS if all five checks succeed.

FAIL if any check fails. Roll back or stop and escalate.

## F) Fast Fixes

Database install error:

```bash
npm run setup:local
```

If it fails again, check `backend/.env` `DATABASE_URL` and PostgreSQL status.

Android emulator API fix (`mobile-app/.env`):

```text
EXPO_PUBLIC_API_URL=http://10.0.2.2:3001
```

Physical device API fix (`mobile-app/.env`):

```text
EXPO_PUBLIC_API_URL=http://<YOUR_COMPUTER_LAN_IP>:3001
```
