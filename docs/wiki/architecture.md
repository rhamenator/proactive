# Architecture

## Monorepo Structure

Root paths:

- [backend](../../backend)
- [admin-dashboard](../../admin-dashboard)
- [mobile-app](../../mobile-app)
- [docs](..)

## Backend Stack

- NestJS application
- Prisma ORM
- PostgreSQL
- JWT-based auth

Primary domains:

- auth
- admin
- turfs
- visits
- exports
- audit

## Admin Dashboard Stack

- Next.js App Router
- React 19
- server-hosted web UI for admins

Primary app routes:

- [login](../../admin-dashboard/app/login/page.tsx)
- [account](../../admin-dashboard/app/account/page.tsx)
- [address-requests](../../admin-dashboard/app/address-requests/page.tsx)
- [dashboard](../../admin-dashboard/app/dashboard/page.tsx)
- [canvassers](../../admin-dashboard/app/canvassers/page.tsx)
- [csv-profiles](../../admin-dashboard/app/csv-profiles/page.tsx)
- [turfs](../../admin-dashboard/app/turfs/page.tsx)
- [field-preview](../../admin-dashboard/app/field-preview/page.tsx)
- [gps-review](../../admin-dashboard/app/gps-review/page.tsx)
- [import-reviews](../../admin-dashboard/app/import-reviews/page.tsx)
- [sync-conflicts](../../admin-dashboard/app/sync-conflicts/page.tsx)
- [outcomes](../../admin-dashboard/app/outcomes/page.tsx)
- [exports](../../admin-dashboard/app/exports/page.tsx)
- [policies](../../admin-dashboard/app/policies/page.tsx)
- [reports](../../admin-dashboard/app/reports/page.tsx)
- [retention](../../admin-dashboard/app/retention/page.tsx)
- [teams](../../admin-dashboard/app/teams/page.tsx)
- [visit-corrections](../../admin-dashboard/app/visit-corrections/page.tsx)

## Mobile Stack

- Expo
- React Native
- Expo SQLite for offline persistence
- NetInfo for connectivity awareness
- Expo Location for GPS capture

Primary state layer:

- [AppContext.tsx](../../mobile-app/src/context/AppContext.tsx)

Primary mobile screens:

- [LoginScreen](../../mobile-app/src/screens/LoginScreen.tsx)
- [DashboardScreen](../../mobile-app/src/screens/DashboardScreen.tsx)
- [AddressListScreen](../../mobile-app/src/screens/AddressListScreen.tsx)
- [AddressDetailScreen](../../mobile-app/src/screens/AddressDetailScreen.tsx)
- [AddressRequestScreen](../../mobile-app/src/screens/AddressRequestScreen.tsx)
- [QueueScreen](../../mobile-app/src/screens/QueueScreen.tsx)
- [PerformanceScreen](../../mobile-app/src/screens/PerformanceScreen.tsx)
- [SessionNotesScreen](../../mobile-app/src/screens/SessionNotesScreen.tsx)

## Data And Sync Model

### Backend truth

- PostgreSQL remains system of record after successful sync.
- Visits are append-only operational records.
- Audit logs are append-only.

### Mobile truth before sync

- local queue is authoritative for unsynced mobile submissions
- local address state overlays synced turf data until refresh/sync resolution

### Idempotency

Visit submissions use:

- local record UUID
- idempotency key
- client-created timestamp

## GPS Model

Visit ingestion classifies GPS as:

- `verified`
- `flagged`
- `missing`
- `low_accuracy`

Geofence detail is stored separately for audit/review workflows.

## Current Constraints

- dashboard supports `admin` and `supervisor`
- mobile app is canvasser-only
- admin MFA is enforced during login, with account-level setup and disable flows
- sensitive admin/supervisor actions require a fresh MFA confirmation
- supervisor/admin operational access is policy-driven across organization, campaign, team, and region scopes
- more specialized geography hierarchy beyond the current campaign/team/region model is not yet implemented
- signed mobile binaries still depend on external Expo/App Store/Play credentials
