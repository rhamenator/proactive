# Manual Test Plan

This is the full manual test pass for PROACTIVE: a feature-by-feature checklist, offline tests, automated suites, and known limitations.

Do the [Manual Testing Quickstart](manual-test-quickstart.md) first — it gets your local environment running and the two default seed accounts (`admin@proactive.local`, `canvasser@proactive.local`) created. Everything below assumes that environment is already up.

---

## 1. Richer Seed Data (Optional)

The default seed from the quickstart is enough for the core walkthrough, but not for testing export batches, GPS flags, sync conflicts, or address requests. For those, run the E2E seed instead:

```bash
npm run seed:e2e
```

This adds the following accounts (in addition to the two from the quickstart):

| Role | Email | Password | MFA secret (TOTP) |
| --- | --- | --- | --- |
| Admin | `admin.e2e@example.test` | `Password123!` | `JBSWY3DPEHPK3PXP` |
| Supervisor | `supervisor.e2e@example.test` | `Password123!` | `JBSWY3DPEHPK3PXP` |
| Canvasser | `canvasser.e2e@example.test` | `Password123!` | *(no MFA)* |

You can re-run `npm run seed:e2e` at any time to reload this dataset without resetting the whole database.

---

## 2. Area-By-Area Checklist

Use this for a broader test pass across individual features.

### Authentication

- [ ] Admin can log in with password + MFA code
- [ ] Admin can log in with a backup code instead of MFA
- [ ] Repeated wrong passwords trigger the lockout (5 attempts by default, configurable in `Policies`)
- [ ] Canvasser can log in on the mobile app
- [ ] Admin cannot log in to the mobile app (canvasser-only by design)

### Turfs

- [ ] Manual turf creation with name, description, team, and region
- [ ] Generate privacy-safe fixtures with `npm run mock:csv -- --rows 25 --output .local/mock-csv`
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

## 3. Offline / Low-Connectivity Tests

These require a physical device or an emulator with network throttling:

1. Disable network on the device (airplane mode or block the API port).
2. Log a visit on the mobile app.
3. Confirm the visit enters the local queue (visible as pending in the app).
4. Re-enable network.
5. Confirm the queue drains and the visit appears in the dashboard.

---

## 4. Resetting Between Test Runs

To start fresh without reinstalling:

```bash
cd backend
npx prisma migrate reset --force
cd ..
```

This drops and recreates the database, then reruns migrations and the default seed.

To reload only the E2E seed without resetting everything:

```bash
npm run seed:e2e
```

---

## 5. Automated Test Suites

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

## 6. Known Limitations

Keep these in mind during testing to avoid false failures:

- **Dashboard only** for admin and supervisor accounts. Attempting to sign in on the mobile app with those accounts is expected to fail.
- **No resolved-conflicts history screen** — resolved items disappear from the queue; that is current behavior, not a bug.
- **GPS accuracy varies by device** — low-accuracy submissions are flagged and routed to GPS Review, not rejected outright.
- **Signed mobile builds** require Expo/Apple/Google credentials and are not part of local testing. Use the Expo dev server (`npm run dev:mobile`) for local manual tests.
- **Android emulator API URL** — if the mobile app cannot reach the backend from an Android emulator, set `EXPO_PUBLIC_API_URL=http://10.0.2.2:3001` in `mobile-app/.env`.

---

## 7. Quick Reference

| What | Where |
| --- | --- |
| Admin dashboard | `http://localhost:3000` |
| Backend API | `http://localhost:3001` |
| Seed admin account | `admin@proactive.local` / `Password123!` |
| Seed canvasser account | `canvasser@proactive.local` / `Password123!` |
| Reinstall from scratch | `npm run setup:local` |
| Reset database | `cd backend && npx prisma migrate reset --force && cd ..` |
| E2E seed | `npm run seed:e2e` |
| Full test suite | `npm test` |
| Browser E2E (mocked) | `npm run test:ui:mocked` |
| Browser E2E (real backend) | `npm run test:ui:seeded` |

For more detail, see:

- [Manual Testing Quickstart](manual-test-quickstart.md)
- [Local Installation](installation/local-install.md)
- [User Manual](user-manual.md)
- [Admin Quick Start](help/admin-quick-start.md)
- [Canvasser Mobile Guide](help/canvasser-mobile-guide.md)
- [Troubleshooting](help/troubleshooting.md)
- [Operations Runbook](wiki/operations-runbook.md)
