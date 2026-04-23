# Manual Testing Quickstart

This guide is for testers who are verifying PROACTIVE manually — walking the system end-to-end with real browsers, a real backend, and a real or simulated device.

## Prerequisites

- Node.js 22 or newer
- npm
- PostgreSQL running locally
- A physical or virtual mobile device (or an iOS/Android simulator)
- An authenticator app (e.g. Google Authenticator, Authy) for admin MFA

---

## 1. Set Up The Local Environment

Run the installer from the repo root. It creates env files, installs dependencies, runs migrations, and seeds test data.

```bash
npm run setup:local
```

If PostgreSQL is not yet running or the database does not exist, create it first:

```sql
CREATE DATABASE proactive;
```

The default connection string is:

```text
postgresql://postgres:postgres@localhost:5432/proactive?schema=public
```

Edit `backend/.env` to change it before running the installer.

---

## 2. Start The System

Open three separate terminals and run one command in each:

```bash
npm run dev:backend    # API on http://localhost:3001
npm run dev:admin      # Admin dashboard on http://localhost:3000
npm run dev:mobile     # Expo dev server (shows QR code / simulator options)
```

Wait for all three to finish their startup output before beginning tests.

---

## 3. Seed Accounts

The local seed creates these accounts. All share the same password.

| Role        | Email                         | Password       |
|-------------|-------------------------------|----------------|
| Admin       | `admin@proactive.local`       | `Password123!` |
| Canvasser   | `canvasser@proactive.local`   | `Password123!` |

> **MFA note:** Admin and supervisor accounts require MFA. On first login you will be prompted to enroll an authenticator app. Use the displayed secret or scan the QR code. Save the backup codes shown after enrollment.

If you need a richer pre-populated dataset (export batches, GPS flags, sync conflicts, address requests, and more), run the E2E seed instead:

```bash
E2E_ALLOW_DATABASE_SEED=true npm run seed:e2e
```

That seeds additional accounts:

| Role        | Email                          | Password       | MFA secret (TOTP)       |
|-------------|--------------------------------|----------------|-------------------------|
| Admin       | `admin.e2e@example.test`       | `Password123!` | `JBSWY3DPEHPK3PXP`      |
| Supervisor  | `supervisor.e2e@example.test`  | `Password123!` | `JBSWY3DPEHPK3PXP`      |
| Canvasser   | `canvasser.e2e@example.test`   | `Password123!` | *(no MFA)*              |

---

## 4. Core End-To-End Flow

This is the minimum walkthrough to confirm the system is working.

### Step 1 — Sign in as admin

1. Open `http://localhost:3000`.
2. Sign in as `admin@proactive.local` / `Password123!`.
3. Complete MFA enrollment when prompted (first login only). Save the backup codes.

### Step 2 — Confirm the dashboard loads

- The `Dashboard` page should show summary cards and no error banners.
- Navigate to `Turfs`, `Canvassers`, `Outcomes`, and `Policies` to confirm each page loads.

### Step 3 — Assign a turf to the canvasser

1. Open `Turfs`.
2. Select **Sample Turf 1** (created by the seed).
3. Assign it to `canvasser@proactive.local`.
4. Confirm the assignment saves.

### Step 4 — Sign in as canvasser on the mobile app

1. Open the Expo QR code on a device, or choose a simulator option.
2. Sign in as `canvasser@proactive.local` / `Password123!`.
3. Confirm the assigned turf appears.

### Step 5 — Start the turf and log a visit

1. Open **Sample Turf 1** on the mobile app.
2. Select **Start** and allow location access if prompted.
3. Open a household record.
4. Choose a visit outcome (e.g. `Knocked`, `Not Home`).
5. Add a note if desired.
6. Submit the visit.

### Step 6 — Verify the visit in the dashboard

1. Return to `http://localhost:3000` as admin.
2. Open `Dashboard` — the visit count should have incremented.
3. Open `Exports`, run an export, and confirm the visit row appears in the downloaded CSV.

---

## 5. Area-By-Area Checklist

Use this for a broader test pass across individual features.

### Authentication

- [ ] Admin can log in with password + MFA code
- [ ] Admin can log in with a backup code instead of MFA
- [ ] Repeated wrong passwords trigger the lockout (5 attempts by default, configurable in `Policies`)
- [ ] Canvasser can log in on the mobile app
- [ ] Admin cannot log in to the mobile app (canvasser-only by design)

### Turfs

- [ ] Manual turf creation with name, description, team, and region
- [ ] CSV import using a valid file and the default import profile
- [ ] Import preview shows correct header mappings before committing
- [ ] Import with a bad file shows a validation error, not a crash
- [ ] Turf appears in the canvasser's mobile app after assignment
- [ ] Removing an assignment removes it from the mobile app

### Import Reviews

- [ ] Duplicate rows detected during import appear in `Import Reviews`
- [ ] Reviewer can approve or reject individual items
- [ ] Resolved items do not reappear after page reload

### CSV Profiles

- [ ] Import and export profiles are listed under `CSV Profiles`
- [ ] A profile can be edited and saved
- [ ] Template download produces a file with the expected headers

### Field Preview

- [ ] `Field Preview` shows the canvasser view for the selected turf
- [ ] Outcome list matches what is configured in `Outcomes`

### GPS Review

- [ ] Low-accuracy or out-of-geofence visits appear in `GPS Review`
- [ ] Reviewer can apply an override with a reason
- [ ] Override is reflected in subsequent exports

### Sync Conflicts

- [ ] Conflicting submissions appear in `Sync Conflicts`
- [ ] Conflict reason is shown before resolution
- [ ] Resolving a conflict requires a reason entry
- [ ] Resolved items do not reappear

### Address Requests

- [ ] A request submitted from the mobile app appears in `Address Requests`
- [ ] Admin can approve or reject the request
- [ ] Approved addresses are added to the turf

### Visit Corrections

- [ ] A correction request appears in `Visit Corrections`
- [ ] Reviewer sees the original visit alongside the requested change
- [ ] Approving or rejecting the correction requires a reason

### Exports

- [ ] Export runs without error for `Internal Master` and `VAN Results` profiles
- [ ] Applying a turf filter narrows the exported rows
- [ ] Exported CSV contains the visits logged during the test session
- [ ] Recent export batch is listed after the download

### Reports

- [ ] Overview, productivity, GPS exceptions, audit, and trends tabs load
- [ ] Filters narrow the displayed data

### Outcomes

- [ ] Outcome list reflects what the mobile app shows during a visit
- [ ] Adding a new outcome makes it available on the mobile app (re-check after adding)
- [ ] Marking an outcome inactive removes it from new visits without deleting history

### Policies

- [ ] Organization and campaign policy overrides can be saved
- [ ] Saving a sensitive change (MFA timing, lockout) requires a fresh MFA confirmation
- [ ] Resetting a policy reverts to the broader scope default

### Retention

- [ ] Retention settings page loads
- [ ] Archive or deletion actions require confirmation before executing

### User Management (Canvassers)

- [ ] New canvasser account can be created and activated
- [ ] Account scope (campaign, team, region) can be set
- [ ] Inactive accounts cannot log in

### Teams

- [ ] Teams can be created with campaign and region metadata
- [ ] Inactive teams are not available for new assignments

### Account

- [ ] MFA can be reset: disable with current credentials, re-enroll
- [ ] Backup code count is shown correctly after enrollment

---

## 6. Offline / Low-Connectivity Tests

These require a physical device or an emulator with network throttling:

1. Disable network on the device (airplane mode or block the API port).
2. Log a visit on the mobile app.
3. Confirm the visit enters the local queue (visible as pending in the app).
4. Re-enable network.
5. Confirm the queue drains and the visit appears in the dashboard.

---

## 7. Resetting Between Test Runs

To start fresh without reinstalling:

```bash
# Drop and recreate the database, rerun migrations and seed
cd backend
npx prisma migrate reset --force
cd ..
```

To reload only the E2E seed without resetting everything:

```bash
E2E_ALLOW_DATABASE_SEED=true npm run seed:e2e
```

---

## 8. Automated Test Suites

These are available if you want to run a structured regression pass alongside manual checks.

```bash
# Full unit and integration suite
npm test

# Browser E2E — mocked backend (fast, no local services needed)
npm run test:ui:mocked

# Browser E2E — seeded real backend (requires all three services running)
npm run test:ui:seeded
```

---

## 9. Known Limitations

Keep these in mind during testing to avoid false failures:

- **Dashboard only** for admin and supervisor accounts. Attempting to sign in on the mobile app with those accounts is expected to fail.
- **No resolved-conflicts history screen** — resolved items disappear from the queue; that is current behavior, not a bug.
- **GPS accuracy varies by device** — low-accuracy submissions are flagged and routed to GPS Review, not rejected outright.
- **Signed mobile builds** require Expo/Apple/Google credentials and are not part of local testing. Use the Expo dev server (`npm run dev:mobile`) for local manual tests.
- **Android emulator API URL** — if the mobile app cannot reach the backend from an Android emulator, set `EXPO_PUBLIC_API_URL=http://10.0.2.2:3001` in `mobile-app/.env`.

---

## 10. Quick Reference

| What                       | Where                                              |
|----------------------------|----------------------------------------------------|
| Admin dashboard            | `http://localhost:3000`                            |
| Backend API                | `http://localhost:3001`                            |
| Seed admin account         | `admin@proactive.local` / `Password123!`           |
| Seed canvasser account     | `canvasser@proactive.local` / `Password123!`       |
| Reinstall from scratch     | `npm run setup:local`                              |
| Reset database             | `cd backend && npx prisma migrate reset --force`   |
| E2E seed                   | `E2E_ALLOW_DATABASE_SEED=true npm run seed:e2e`    |
| Full test suite            | `npm test`                                         |
| Browser E2E (mocked)       | `npm run test:ui:mocked`                           |
| Browser E2E (real backend) | `npm run test:ui:seeded`                           |

For more detail, see:

- [Local Installation](installation/local-install.md)
- [User Manual](user-manual.md)
- [Admin Quick Start](help/admin-quick-start.md)
- [Canvasser Mobile Guide](help/canvasser-mobile-guide.md)
- [Troubleshooting](help/troubleshooting.md)
- [Operations Runbook](wiki/operations-runbook.md)
