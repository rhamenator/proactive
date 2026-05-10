# Really Quick Start (Step-by-Step)

This guide is the fastest, safest path to build and deploy all parts of PROACTIVE using Node, npm, and containers.

It covers:

1. Running the full system on a dev machine
2. Deploying backend + admin dashboard + database to a server with Docker Compose
3. Building mobile binaries (iOS and Android) with Expo EAS

If you follow this guide in order, you should not need to guess.

## 0. Zero-Assumption Setup (Do This First)

If you are not familiar with this stack, start here and do not skip.

### 0.1 Install required apps from official pages

1. Install Node.js 22 LTS: [nodejs.org](https://nodejs.org/)
2. Install Git: [git-scm.com/downloads](https://git-scm.com/downloads)
3. Install Docker Desktop (includes Docker Compose): [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)

### 0.2 Open a terminal window

Use one of these options:

- Windows: open `PowerShell`
- macOS: open `Terminal`
- Linux: open your normal terminal app

### 0.3 Clone the project and enter the project folder

If you do not already have the code:

```bash
git clone https://github.com/rhamenator/proactive.git
cd proactive
```

If you already have the code:

```bash
cd /path/to/your/proactive
```

### 0.4 Verify tools and location

Run this exactly:

```bash
node --version
npm --version
docker --version
docker compose version
git --version
pwd
```

PASS if all of these are true:

- every command prints a version
- Node starts with `v22` or higher
- `pwd` ends with `/proactive`

FAIL if any command says `not found`, errors, or `pwd` does not end with `/proactive`.

If FAIL, stop here and ask for help before continuing.

## 1. What You Need Before Starting

Do this once.

1. Install Node.js 22+.
2. Install npm (usually included with Node.js).
3. Install Docker and Docker Compose plugin.
4. Install Git.
5. Clone this repository and open it in a terminal.

Verify tools:

```bash
node --version
npm --version
docker --version
docker compose version
git --version
```

Expected result:

- Every command prints a version.
- Node major version is `22` or newer.

PASS if both expected results are true.

FAIL if either expected result is false. Stop and ask for help.

## 2. Dev Machine Setup (Full System)

Use this when you want backend + admin + mobile dev flow on one machine.

### 2.1 Run the installer

From repository root:

```bash
npm run setup:local
```

What this does:

- installs dependencies
- creates missing env files
- generates Prisma client
- runs DB migrations and seed (unless skipped)

PASS if command finishes and returns to your terminal prompt with no error.

FAIL if command stops with an error. Check Section 7 and retry once.

### 2.2 Start each app

Open 3 terminals in repo root.

Terminal 1:

```bash
npm run dev:backend
```

Terminal 2:

```bash
npm run dev:admin
```

Terminal 3:

```bash
npm run dev:mobile
```

PASS if all 3 terminals keep running without immediate error messages.

FAIL if any terminal exits or shows red error text. Stop and ask for help.

### 2.3 Confirm it works

1. Open `http://localhost:3000`.
2. Sign in:
   - Admin: `admin@proactive.local`
   - Password: `Password123!`
3. Backend should be available on `http://localhost:3001`.

PASS if you can sign in and see the dashboard.

FAIL if sign-in fails or the page does not load.

If mobile cannot connect:

- iOS simulator API URL: `http://localhost:3001`
- Android emulator API URL: `http://10.0.2.2:3001`
- Physical device API URL: `http://<YOUR_COMPUTER_LAN_IP>:3001`

## 3. Build Validation (Before Deployment)

From repo root:

```bash
npm run build
npm run test
```

Optional deeper check:

```bash
npm run test:coverage
```

Expected result:

- Build completes without errors.
- Tests pass.

PASS if both commands complete with no failures.

FAIL if either command fails. Stop and ask for help before deploying.

## 4. Server Deployment With Containers (Recommended)

Use this for a stable server deployment of:

- PostgreSQL
- Backend API
- Admin Dashboard

### 4.1 Prepare environment file

From repo root:

```bash
cp .env.docker.example .env
```

Edit `.env` and set real values at minimum:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`

Keep or adjust:

- `POSTGRES_USER`
- `POSTGRES_DB`
- `BACKEND_PORT`
- `DASHBOARD_PORT`
- `NEXT_PUBLIC_API_URL`

For server deployment, set `NEXT_PUBLIC_API_URL` to your backend public URL, for example:

```text
NEXT_PUBLIC_API_URL=https://api.your-domain.com
```

### 4.2 Build and start containers

From repo root:

```bash
docker compose up --build -d
docker compose ps
```

Expected result:

- `postgres`, `backend`, and `admin-dashboard` are running.

PASS if all three services show as running in `docker compose ps`.

FAIL if any service is not running.

### 4.3 Smoke test the deployment

1. Open dashboard URL (`http://<server-ip>:3000` or your mapped domain).
2. Sign in and load dashboard data.
3. Confirm backend health by loading `http://<server-ip>:3001` (or API endpoint you expose).

### 4.4 Important migration note

Stop-and-ask checkpoint:

- If you are unsure what a database migration is, stop and ask for help before running this step.
- Running migrations on the wrong database can cause data loss.

Run Prisma migrations as a controlled deploy step before sending real traffic.

Typical command from a CI/build environment with repo dependencies installed:

```bash
cd backend
npx prisma migrate deploy
```

PASS if Prisma reports migration success.

FAIL if Prisma reports errors. Do not continue to production traffic.

## 5. Mobile Binary Builds (Preview and Production)

Use this to produce installable iOS/Android builds.

### 5.1 Prepare mobile workspace

From repo root:

```bash
npm run setup:mobile
```

If needed, set API URL while preparing:

```bash
npm run setup:mobile -- --api-url https://api.your-domain.com
```

### 5.2 Log in to Expo/EAS

```bash
cd mobile-app
npx eas login
npx eas project:init
```

### 5.3 Create preview builds (internal testers)

```bash
npm run eas:build:ios:preview
npm run eas:build:android:preview
```

Distribution guidance:

- iOS: TestFlight
- Android: internal APK or Google Play Internal Testing

### 5.4 Create production builds

```bash
npm run eas:build:ios:production
npm run eas:build:android:production
```

### 5.5 Submit production builds to stores

Stop-and-ask checkpoint:

- Do not continue unless you have Apple/Google store credentials and approval to submit production apps.
- If unsure, stop and ask your release owner.

```bash
npm run eas:submit:ios
npm run eas:submit:android
```

PASS if submission commands complete and return submission IDs.

FAIL if credentials, signing, or permission errors appear.

## 6. Repeatable Release Checklist

Use this every release.

1. Pull latest code.
2. Run `npm ci`.
3. Run `npm run build` and `npm run test`.
4. Deploy server containers (`docker compose up --build -d`).
5. Run DB migration (`npx prisma migrate deploy`).
6. Smoke test admin + backend.
7. Build mobile preview or production binaries with EAS.
8. Distribute/submit mobile builds.

## 7. Quick Troubleshooting

### Problem: `npm run setup:local` fails at database step

Fix:

1. Confirm PostgreSQL is running.
2. Check `backend/.env` `DATABASE_URL`.
3. Re-run:

```bash
npm run setup:local
```

### Problem: Android emulator cannot reach backend

Fix `mobile-app/.env`:

```text
EXPO_PUBLIC_API_URL=http://10.0.2.2:3001
```

Restart Expo.

### Problem: Physical phone cannot reach local backend

Fix:

1. Use `http://<YOUR_COMPUTER_LAN_IP>:3001`, not `localhost`.
2. Ensure phone and computer are on same network.

## 8. Where To Go Next

- Printable command checklist: `docs/installation/one-page-runbook.md`
- CI operator release/deploy runbook: `docs/installation/ci-operator-runbook.md`
- Detailed local setup: `docs/installation/local-install.md`
- Mobile workstation details: `docs/installation/mobile-install.md`
- Full deployment details: `docs/installation/deployment.md`
- Configuration reference: `docs/installation/configuration.md`
