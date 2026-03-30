# Architecture

## Monorepo Structure

Root paths:

- [backend](/home/rich/dev/proactive/backend)
- [admin-dashboard](/home/rich/dev/proactive/admin-dashboard)
- [mobile-app](/home/rich/dev/proactive/mobile-app)
- [docs](/home/rich/dev/proactive/docs)

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

- [login](/home/rich/dev/proactive/admin-dashboard/app/login/page.tsx)
- [account](/home/rich/dev/proactive/admin-dashboard/app/account/page.tsx)
- [dashboard](/home/rich/dev/proactive/admin-dashboard/app/dashboard/page.tsx)
- [canvassers](/home/rich/dev/proactive/admin-dashboard/app/canvassers/page.tsx)
- [turfs](/home/rich/dev/proactive/admin-dashboard/app/turfs/page.tsx)
- [gps-review](/home/rich/dev/proactive/admin-dashboard/app/gps-review/page.tsx)
- [sync-conflicts](/home/rich/dev/proactive/admin-dashboard/app/sync-conflicts/page.tsx)
- [outcomes](/home/rich/dev/proactive/admin-dashboard/app/outcomes/page.tsx)
- [exports](/home/rich/dev/proactive/admin-dashboard/app/exports/page.tsx)

## Mobile Stack

- Expo
- React Native
- Expo SQLite for offline persistence
- NetInfo for connectivity awareness
- Expo Location for GPS capture

Primary state layer:

- [AppContext.tsx](/home/rich/dev/proactive/mobile-app/src/context/AppContext.tsx)

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
- supervisor/admin operational access is organization-scoped
- deeper campaign/team/geography scoping is not yet implemented
- signed mobile binaries still depend on external Expo/App Store/Play credentials
