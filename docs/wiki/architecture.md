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
- [dashboard](/home/rich/dev/proactive/admin-dashboard/app/dashboard/page.tsx)
- [canvassers](/home/rich/dev/proactive/admin-dashboard/app/canvassers/page.tsx)
- [turfs](/home/rich/dev/proactive/admin-dashboard/app/turfs/page.tsx)
- [exports](/home/rich/dev/proactive/admin-dashboard/app/exports/page.tsx)

## Mobile Stack

- Expo
- React Native
- AsyncStorage for offline persistence
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

- dashboard is admin-only
- mobile app is canvasser-only
- supervisor support is not complete end-to-end
