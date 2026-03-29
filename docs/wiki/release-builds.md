# Release Builds

This repository supports a GitHub-hosted release build path for the backend and admin dashboard, plus mobile release preflight packaging.

## Workflow

- Workflow file: `.github/workflows/release-builds.yml`
- Triggers:
  - `workflow_dispatch`
  - `release.published`

The workflow installs dependencies with `npm ci`, runs `npm run prisma:generate`, then runs `npm run verify` before packaging artifacts.

## Artifacts

### Backend artifact

Artifact name pattern:

- `proactive-backend-<version>.tar.gz`

Contents:

- compiled backend output from `backend/dist`
- Prisma schema and checked-in migrations
- `backend/package.json`
- root `package-lock.json`
- `backend/.env.example`
- `backend/README.md`
- `BUILD-INFO.txt`

Use:

- trusted compiled backend payload from GitHub Actions
- deployment input for downstream hosting or packaging

Important:

- this is not a self-contained container image
- you still need runtime environment variables and a PostgreSQL database
- you still need a production dependency install step before running the backend

### Admin dashboard artifact

Artifact name pattern:

- `proactive-admin-dashboard-<version>.tar.gz`

Contents:

- Next.js standalone output
- static assets from `.next/static`
- `public/` if present
- `admin-dashboard/.env.example`
- `admin-dashboard/package.json`
- `BUILD-INFO.txt`

Use:

- extract the archive
- provide the required runtime environment variables
- start with `node server.js`

### Mobile release-prep artifact

Artifact name pattern:

- `proactive-mobile-release-prep-<version>.tar.gz`

Contents:

- resolved Expo config snapshot from GitHub Actions
- `eas.json`
- `app.config.ts`
- environment templates
- mobile README
- `BUILD-INFO.txt`

Use:

- confirm the mobile configuration resolves on GitHub Actions
- hand off the exact build inputs to whoever owns Expo/EAS release credentials

Important:

- this artifact is not an installable IPA or APK
- the repository does not currently build signed mobile binaries on GitHub Actions

### Release metadata

The workflow also uploads:

- `BUILD-MANIFEST.txt`
- `SHA256SUMS.txt`

It generates GitHub artifact attestations for the packaged `.tar.gz` files.

## Manual run procedure

1. Open the repository on GitHub.
2. Go to `Actions`.
3. Select `Release Builds`.
4. Click `Run workflow`.
5. Choose the branch or tag to build.
6. Optionally set `artifact_label`.
7. Leave `include_mobile_preflight` enabled unless you explicitly do not want the mobile prep bundle.
8. Wait for the run to finish, then download artifacts from the workflow run page.

## Tagged release procedure

1. Push the release tag.
2. Create or publish the GitHub Release for that tag.
3. Wait for `Release Builds` to complete.
4. Download assets directly from the GitHub Release page.

## Mobile credential blockers

The following are still external prerequisites for real Expo/EAS mobile builds or store submission:

- `EXPO_TOKEN`
- `EXPO_OWNER`
- `EAS_PROJECT_ID`
- real `IOS_BUNDLE_IDENTIFIER`
- real `ANDROID_APPLICATION_ID`
- Apple Developer / App Store Connect credentials
- Google Play credentials if Play-managed delivery is used

Until those exist, the GitHub workflow intentionally stops at config validation and release-prep packaging for mobile.
