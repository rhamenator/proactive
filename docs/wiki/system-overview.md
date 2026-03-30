# System Overview

## Purpose

PROACTIVE Field Canvassing System is a monorepo application for:

- admin-managed turf creation, assignment, import, and export
- mobile canvasser turf execution with GPS capture
- offline-first visit logging with later sync
- audited operational workflows

## Applications

### Backend

Path: [backend](/home/rich/dev/proactive/backend)

Responsibilities:

- authentication and JWT issuance
- password reset and activation flows
- turf lifecycle and assignment logic
- visit ingestion and GPS classification
- CSV import and export
- audit logging
- PostgreSQL persistence through Prisma

### Admin Dashboard

Path: [admin-dashboard](/home/rich/dev/proactive/admin-dashboard)

Responsibilities:

- admin and supervisor login
- dashboard summary
- canvasser and field-user management
- turf creation/import/reassignment/reopen flows
- GPS review, sync-conflict review, and reporting
- policy, CSV-profile, team, and retention management
- export initiation and history review

### Mobile App

Path: [mobile-app](/home/rich/dev/proactive/mobile-app)

Responsibilities:

- canvasser login
- assigned turf view
- session start/pause/resume/complete
- visit submission
- offline SQLite-backed queue persistence and retry

## Current Role Model

Operationally exposed:

- `admin` and `supervisor` on the dashboard
- `canvasser` on mobile

## Main User Flows

### Dashboard flow

1. Log in to the admin dashboard as an admin or supervisor.
2. Review dashboard status, assigned teams/regions, and policy defaults.
3. Create or import turf data, or review/import duplicate batches as allowed by role.
4. Assign or reassign turf work within allowed scope.
5. Monitor progress, GPS exceptions, sync conflicts, and exports.

### Canvasser flow

1. Log in to the mobile app.
2. Open assigned turf.
3. Start a session.
4. Visit households and submit outcomes.
5. Work offline if needed.
6. Sync when connectivity returns.

## Source Of Truth

- product and implementation baseline: [v1 Final Spec](/home/rich/dev/proactive/docs/v1-final-spec.md)
- implementation gaps: [Gap Analysis](/home/rich/dev/proactive/docs/gap-analysis.md)
