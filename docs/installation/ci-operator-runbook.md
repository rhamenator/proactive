# CI Operator Runbook (Release and Deploy Only)

This runbook is for CI/release operators.

It excludes local development setup and day-to-day engineering tasks.

Scope:

1. Trigger release artifact builds in GitHub Actions
2. Verify release assets and checksums
3. Deploy backend + admin + database on server
4. Apply database migrations
5. Run smoke tests
6. Roll back if needed

## 1) Preconditions

Have these ready before a release:

- GitHub access with permission to run workflows and create releases
- Server access with Docker + Docker Compose
- Production secrets:
  - `POSTGRES_PASSWORD`
  - `JWT_SECRET`
- Public URLs/domains for dashboard and API
- Change ticket or release ID

## 2) Trigger Release Build Workflow

Workflow file: `.github/workflows/release-builds.yml`

Option A: Manual workflow dispatch

1. Open GitHub Actions.
2. Select `Release Builds`.
3. Click `Run workflow`.
4. Set `artifact_label` (example: `2026-05-09-rc1`).
5. Keep `include_mobile_preflight` = true unless you intentionally skip mobile prep.
6. Run and wait for success.

Option B: Tagged release

1. Create/push release tag.
2. Publish GitHub Release.
3. Wait for `Release Builds` workflow to finish.

Expected artifacts:

- `proactive-backend-<version>.tar.gz`
- `proactive-admin-dashboard-<version>.tar.gz`
- `proactive-mobile-release-prep-<version>.tar.gz` (if included)
- `SHA256SUMS.txt`
- `BUILD-MANIFEST.txt`

PASS if all expected artifacts are present.

FAIL if any required artifact is missing.

## 3) Verify Release Assets

On your operator machine:

```bash
mkdir -p proactive-release && cd proactive-release
# Download all release artifacts into this folder first
sha256sum -c SHA256SUMS.txt
```

Expected:

- Every artifact returns `OK`.

PASS if checksum verification returns `OK` for all artifacts.

FAIL if any artifact fails checksum. Stop deployment immediately.

Open `BUILD-MANIFEST.txt` and confirm:

- expected commit
- expected ref/tag
- expected workflow run id

## 4) Prepare Server Runtime Config

On target server (repo checked out):

```bash
cp .env.docker.example .env
```

Edit `.env` and set at least:

- `POSTGRES_PASSWORD=<real value>`
- `JWT_SECRET=<long random value>`
- `NEXT_PUBLIC_API_URL=https://api.your-domain.com`

PASS if all three values are set and saved.

FAIL if any value is missing.

## 5) Deploy Server Services

From repo root on server:

```bash
docker compose pull || true
docker compose up --build -d
docker compose ps
```

Expected:

- `postgres`, `backend`, `admin-dashboard` are running.

PASS if all services are running.

FAIL if any service is stopped or restarting.

## 6) Apply Database Migration (Required)

Stop-and-ask checkpoint:

- If you are not 100% sure this is the correct environment/database, stop and ask before migration.
- Wrong-environment migrations can cause irreversible data impact.

From repo root on server:

```bash
cd backend
npx prisma migrate deploy
cd ..
```

Expected:

- Migration completes without errors.

PASS if Prisma reports success.

FAIL if Prisma reports errors. Do not continue release.

## 7) Smoke Test (Go/No-Go)

Perform in this order:

1. Open dashboard URL and confirm login page loads.
2. Sign in as admin and load dashboard data.
3. Confirm dashboard can call backend API.
4. Confirm one write action succeeds (example: create/import/update).
5. Confirm export/report endpoint still works.

Release gate:

- If any smoke test fails, execute rollback section.

PASS if all smoke tests succeed.

FAIL if any smoke test fails.

## 8) Rollback Procedure

Use last known good commit on the server checkout:

```bash
git fetch --all --tags
git checkout <LAST_KNOWN_GOOD_COMMIT_OR_TAG>
docker compose up --build -d
cd backend
npx prisma migrate deploy
cd ..
docker compose ps
```

Then re-run smoke tests.

PASS if rollback deployment and smoke tests both succeed.

FAIL if rollback cannot restore service health. Escalate immediately.

Notes:

- Do not rotate backward over destructive schema changes without a tested DB rollback strategy.
- If schema incompatibility exists, restore database from backup according to your DB recovery policy.

## 9) Mobile Release Operations (CI Operator View)

The GitHub workflow produces a mobile release-prep artifact only.

It does not produce signed store binaries.

Hand-off steps to mobile release owner:

1. Confirm release-prep artifact exists.
2. Provide release version + commit + artifact links.
3. Mobile owner runs EAS build and submit flow with platform credentials.

PASS if hand-off is acknowledged by mobile release owner.

FAIL if ownership or credentials are unclear. Stop and escalate.

## 10) Release Record Template

Capture this in your release ticket:

- Release version/tag
- GitHub workflow run URL
- Artifact checksum verification result
- Deployment start/end timestamps
- Migration result
- Smoke test result
- Rollback performed? (yes/no)
- Operator name
