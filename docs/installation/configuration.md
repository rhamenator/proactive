# Configuration Reference

## Environment Files

Local installer-created files:

- `backend/.env`
- `admin-dashboard/.env.local`
- `mobile-app/.env`

Optional mobile build files:

- `mobile-app/.env.preview`
- `mobile-app/.env.production`

Existing environment files are not overwritten by the installers.

## Backend

Template: `backend/.env.example`

Important values:

```text
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/proactive?schema=public
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=30m
GEOFENCE_RADIUS_METERS=100
GEOFENCE_RADIUS_FEET=75
GPS_LOW_ACCURACY_METERS=30
MAX_ATTEMPTS_PER_HOUSEHOLD=3
MIN_MINUTES_BETWEEN_ATTEMPTS=5
```

Production deployments must replace `JWT_SECRET` and point `DATABASE_URL` at a real managed database.

## Admin Dashboard

Template: `admin-dashboard/.env.example`

```text
NEXT_PUBLIC_API_URL=http://localhost:3001
```

The dashboard runs in the browser, so this URL must be reachable by the user browser.

## Mobile App

Template: `mobile-app/.env.example`

```text
APP_ENV=development
EXPO_PUBLIC_API_URL=http://localhost:3001
EXPO_PUBLIC_APP_NAME=PROACTIVE FCS
EXPO_PUBLIC_GEOFENCE_RADIUS_METERS=100
EXPO_OWNER=
EAS_PROJECT_ID=
IOS_BUNDLE_IDENTIFIER=com.proactive.fcs
ANDROID_APPLICATION_ID=com.proactive.fcs
```

API URL selection:

- iOS simulator: `http://localhost:3001`
- Android emulator: `http://10.0.2.2:3001`
- Physical device: `http://<computer-LAN-IP>:3001`
- Preview/production builds: public HTTPS API URL

## Default Ports

- Backend API: `3001`
- Admin dashboard: `3000`
- Expo dev server: assigned and displayed by Expo CLI

## Database Setup

The local install expects PostgreSQL to exist before migrations run.

Typical local setup:

```bash
createdb proactive
scripts/install-local.sh
```

If your PostgreSQL user, password, host, or port differs, update `backend/.env` before rerunning database steps:

```bash
cd backend
npx prisma migrate deploy
npm run prisma:seed
```

## Secrets Guidance

- Do not commit `.env`, `.env.local`, `.env.preview`, or `.env.production`.
- Use a long random `JWT_SECRET` outside local demo installs.
- Keep Expo, Apple, and Google signing credentials outside the repo.
- Use a non-production backend for internal preview mobile builds.

For production deployment sequencing and release flow, see [deployment.md](deployment.md).
