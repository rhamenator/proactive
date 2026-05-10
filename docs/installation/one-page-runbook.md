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

```bash
npm run dev:backend
```

Expected:

- Backend running at `http://localhost:3001`.

```bash
npm run dev:admin
```

Expected:

- Dashboard running at `http://localhost:3000`.

```bash
npm run dev:mobile
```

Expected:

- Expo dev server starts and shows QR/simulator options.

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

Apply database migrations before live traffic:

```bash
cd backend
npx prisma migrate deploy
cd ..
```

Expected:

- Migration command reports success.

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

```bash
npm run eas:submit:ios
npm run eas:submit:android
```

## E) Post-Deploy Smoke Test

1. Open dashboard URL and log in.
2. Confirm dashboard can load and write data.
3. Confirm mobile login works.
4. Confirm one visit can be submitted.
5. Confirm visit appears in dashboard/report/export.

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
