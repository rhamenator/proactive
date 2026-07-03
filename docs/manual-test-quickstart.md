# Manual Testing Quickstart

This guide gets a tester from an empty machine to a working local PROACTIVE system and one verified end-to-end flow. It assumes no prior setup and no prior familiarity with the stack.

For the full feature-by-feature checklist, offline tests, automated suites, and known limitations, see [Manual Test Plan](manual-test-plan.md) — do this quickstart first.

---

## Prerequisites

Install each of these before starting. If one is already installed, skip it.

| Tool | Get it from | Needed for |
| --- | --- | --- |
| Node.js 22 or newer | [nodejs.org](https://nodejs.org/) | Running the backend, admin dashboard, and mobile dev server |
| Git | [git-scm.com/downloads](https://git-scm.com/downloads) | Cloning the repo. **On Windows, this also installs Git Bash**, which some setup scripts in this project require. |
| PostgreSQL | [postgresql.org/download](https://www.postgresql.org/download/) | The application database. The Windows installer includes `psql` (command line) and pgAdmin (GUI). |
| An authenticator app | App Store / Google Play (e.g. Google Authenticator, Authy) | Admin and supervisor accounts require MFA |
| A mobile device or simulator | iOS Simulator (macOS + Xcode) or Android Emulator (Android Studio), or a physical phone with the Expo Go app | Testing the canvasser mobile app |

### Verify your tools

Open a terminal and run:

```bash
node --version
npm --version
git --version
psql --version
```

**PASS** if all four commands print a version, and Node's version starts with `v22` or higher.

**FAIL** if any command says "not found" or similar — reinstall that tool and confirm it was added to your PATH, then try again.

---

## Step 1 — Open a terminal in the project folder

- **Windows:** open **Git Bash** (search "Git Bash" in the Start menu). Commands in this guide are written for Git Bash. Do not use Command Prompt or plain PowerShell — some setup scripts require a POSIX shell.
- **macOS:** open **Terminal**.
- **Linux:** open your normal terminal.

If you don't already have the code:

```bash
git clone https://github.com/rhamenator/proactive.git
cd proactive
```

If you already have the code, `cd` into that folder instead.

All commands below assume you are in the repo root unless a step says otherwise.

---

## Step 2 — Create the database

Run:

```bash
psql -U postgres -c "CREATE DATABASE proactive;"
```

You'll be prompted for the `postgres` user's password (the one you set when installing PostgreSQL).

**PASS** if the command prints `CREATE DATABASE`.

**FAIL** if it says the database already exists — that's fine, continue. Any other error means PostgreSQL isn't running or the `postgres` password is wrong.

The installer in the next step expects this connection string by default:

```text
postgresql://postgres:postgres@localhost:5432/proactive?schema=public
```

If your PostgreSQL user, password, or port is different, edit `backend/.env` after Step 3 creates it, then re-run Step 3 with `--skip-install`.

---

## Step 3 — Install and set up the project

From the repo root:

```bash
npm run setup:local
```

This installs dependencies, creates `.env` files, generates the Prisma client, runs database migrations, and seeds test data.

**PASS** if the command finishes and returns you to the prompt with no error.

**FAIL** if it stops with an error — re-check Step 2 (is PostgreSQL running? does the database exist?), then re-run `npm run setup:local`.

---

## Step 4 — Start the system

Open **three separate terminals** (Git Bash on Windows), all in the repo root, and run one command in each:

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

**PASS** if all three keep running with no immediate error, and terminal 3 shows a QR code or simulator options.

Wait for all three to finish their startup output before continuing.

---

## Step 5 — Seed accounts

`npm run setup:local` already created these accounts. All share the same password.

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@proactive.local` | `Password123!` |
| Canvasser | `canvasser@proactive.local` | `Password123!` |

> **MFA note:** admin and supervisor accounts require MFA. On first login you'll be prompted to enroll an authenticator app — scan the QR code or enter the displayed secret, then save the backup codes shown after enrollment.

---

## Step 6 — Run the core end-to-end flow

This is the minimum walkthrough to confirm the system works.

1. **Sign in as admin.** Open `http://localhost:3000` and sign in as `admin@proactive.local` / `Password123!`. Complete MFA enrollment if prompted, and save the backup codes.
2. **Confirm the dashboard loads.** The `Dashboard` page shows summary cards with no error banners. Navigate to `Turfs`, `Canvassers`, `Outcomes`, and `Policies` to confirm each page loads.
3. **Assign a turf.** Open `Turfs`, select **Sample Turf 1** (created by the seed), and assign it to `canvasser@proactive.local`. Confirm the assignment saves.
4. **Sign in as canvasser on mobile.** Open the Expo QR code on a device, or choose a simulator option from terminal 3. Sign in as `canvasser@proactive.local` / `Password123!` and confirm the assigned turf appears.
5. **Log a visit.** Open **Sample Turf 1**, select **Start** (allow location access if prompted), open a household record, choose a visit outcome (e.g. `Knocked`, `Not Home`), optionally add a note, and submit.
6. **Verify the visit in the dashboard.** Back on `http://localhost:3000` as admin, open `Dashboard` and confirm the visit count incremented. Open `Exports`, run an export, and confirm the visit row appears in the downloaded CSV.

**PASS** if all six steps complete without error. Your local environment is confirmed working.

---

## What's next

- For the full area-by-area feature checklist, offline/low-connectivity tests, resetting between test runs, automated test suites, and known limitations, go to [Manual Test Plan](manual-test-plan.md).
- [Local Installation](installation/local-install.md) — more detail on the installer and manual install steps.
- [User Manual](user-manual.md)
- [Admin Quick Start](help/admin-quick-start.md)
- [Canvasser Mobile Guide](help/canvasser-mobile-guide.md)
- [Troubleshooting](help/troubleshooting.md)
