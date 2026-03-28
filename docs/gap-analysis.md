# PROACTIVE v1 Gap Analysis

Date: 2026-03-28

Reference spec: [v1-final-spec.md](/home/rich/dev/proactive/docs/v1-final-spec.md)

## Summary

The current codebase is a usable prototype, but it is not yet aligned with the v1 Final Spec. The largest gaps are in backend data modeling, auth/session security, auditability, offline sync metadata, GPS review/override workflows, and turf lifecycle enforcement.

The current implementation is strongest in:

- basic login and role protection
- turf import, assignment, session start/end, and visit logging
- a functional admin dashboard shell
- a functional mobile offline queue and retry loop

The current implementation is weakest in:

- schema completeness and future-ready structure
- append-only audit/event history
- refresh tokens, activation, reset, MFA, and brute-force controls
- true offline-first sync metadata and deduplication
- detailed geofence result storage and review/override workflows
- turf pause/reopen/reassign lifecycle rules
- internal master export and batch tracking

## Highest-Priority Gaps

### 1. Backend data model is far short of the spec

Current state:

- schema only contains `users`, `turfs`, `addresses`, `turf_assignments`, `turf_sessions`, `visit_logs`
- no organization scoping
- no campaign-ready fields
- no outcome definitions table
- no sync events
- no audit logs
- no geofence child records
- no import/export batch records
- no override records

Required to reach spec:

- add sync metadata and idempotency fields for visits
- add detailed per-visit geofence storage
- add append-only audit logging
- add outcome definitions and stop relying on hard-coded outcomes long-term
- add import/export batch tracking
- add settings tables for future policy storage

### 2. Security/auth flows are prototype-grade, not v1-grade

Current state:

- password login only
- single JWT access token
- no refresh token lifecycle
- no activation flow
- no password reset flow
- no MFA
- no brute-force throttling/lockout
- no device/session tracking

Required to reach spec:

- activation token flow for invited users
- password reset tokens and endpoints
- refresh-token based session model
- admin MFA enforcement
- failed-login throttling and lockout
- session invalidation on logout
- audit entries for security actions

### 3. Offline support works functionally, but not to the required audit/sync standard

Current state:

- mobile app queues unsent visits locally
- retries on reconnect
- pending state exists locally
- no stable local submission UUID or idempotency key
- no server-side sync event tracking
- no conflict state surfaced from backend
- no explicit sync states in persisted server records

Required to reach spec:

- local UUID and idempotency key on every mobile-created visit
- backend dedupe by idempotency/local UUID
- visit-level sync metadata persisted server-side
- sync events/history for uploads
- explicit conflict handling and review queue
- stronger restore/resume metadata around sessions and pending work

### 4. Turf workflow rules are simplified relative to the client addenda

Current state:

- assignment exists
- start/end session exists
- no explicit `paused`, `reopened`, `archived` turf statuses
- no force-close or reassignment workflow
- no reopen flow
- no incomplete-completion warning logic
- no remaining-work handoff on reassignment

Required to reach spec:

- richer turf and session statuses
- pause/resume semantics
- reopen and reassignment reasons
- active-session enforcement rules
- completion metadata and unattempted-address warnings
- attribution preservation for pre-reassignment work

## Backend Gaps By Area

### Data model

- `Address` should evolve toward a household-centered model
- visits need richer fields: source, client timestamps, sync status, idempotency, override flags
- geofence details should be stored separately, not only as a boolean and distance
- imports/exports need their own tracked records
- settings and audit entities are missing

### Auth and security

- no invite activation
- no reset flow
- no MFA
- no refresh tokens
- no login throttling
- no lockout handling

### Visits and GPS

- current GPS logic only stores boolean validation + distance in meters
- spec requires `verified`, `flagged`, `missing`, `low_accuracy`
- no accuracy capture
- no override flow or review APIs
- no per-visit target/captured coordinate snapshot record

### Imports/exports

- import supports header mapping, but not explicit import modes
- duplicate matching is simplistic
- no import batch record or raw-source traceability
- export is still essentially one profile and not batch-tracked
- internal master export columns from the spec are not implemented

### Auditing

- no append-only audit table
- no audit service
- no audit entries for login, turf lifecycle, import/export, or visit creation

## Admin Dashboard Gaps

- no GPS review screen or override actions
- no conflict review queue
- no audit visibility
- no import mode selection or duplicate review
- no batch-aware export history
- no turf reopen/reassign UI with required reason capture
- no user invite/activation/reset/MFA administration

## Mobile App Gaps

- queue exists, but submissions do not yet carry stable idempotency metadata
- no explicit `failed` or `conflict` record UX beyond generic pending queue
- no low-accuracy / flagged / missing GPS statuses surfaced back to user
- no provisional sync-state model beyond local pending flag
- no pause/resume workflow distinct from start/end
- no last-viewed-household resume behavior
- no re-auth-aware sync blocking strategy

## Recommended Implementation Order

### Phase 1: Backend visit/sync/GPS foundation

- add visit sync metadata, idempotency, and richer GPS status storage
- add geofence result records
- add initial audit service and write audit records for visit creation and turf actions
- update mobile payloads to send stable local IDs and accuracy

### Phase 2: Turf lifecycle and admin review flows

- add turf/session status richness
- implement pause/resume/reopen/reassign backend rules
- add GPS review/override and conflict-review endpoints
- add admin UI for those workflows

### Phase 3: Security hardening

- activation, reset, refresh tokens, MFA, throttling, logout invalidation
- device/session tracking
- security audit coverage

### Phase 4: CSV/VAN productionization

- import modes
- duplicate review and batch tracking
- internal master export profile
- VAN-compatible export profile management

### Phase 5: Schema broadening

- organization and campaign-ready expansion
- outcome definitions and settings tables
- retention metadata and archive/purge support

## Work Started In This Iteration

This iteration should start with Phase 1:

- backend visit sync metadata
- backend geofence result storage
- backend idempotent visit ingestion
- mobile local submission IDs and richer GPS payloads

## Validation Targets

At minimum, after each implementation slice:

- backend Prisma client generation succeeds
- backend TypeScript build succeeds
- admin dashboard build succeeds if shared types/contracts changed
- mobile app typecheck succeeds if payload contracts changed

