# PROACTIVE Field Canvassing System v1 Final Spec

## Document Status

- Status: v1 Final Spec
- Date: 2026-03-28
- Source basis:
  - Original developer handoff
  - Schema Design Principles
  - Security Requirements
  - CSV Requirements for VAN
  - Offline Behavior, Local Caching, and Sync Rules
  - Offline addendum
  - GPS Enforcement & Location Rules
  - PROACTIVE Rules for Turf Management

## Summary

This document is the decision-complete v1 implementation baseline for the PROACTIVE Field Canvassing System. It consolidates the original handoff with later client addenda and locks safe defaults where the source documents offered ranges or optional paths.

This v1 remains a CSV-based VAN workflow system. It is mobile-first for canvassers, web-based for admins, and built to support offline-first field use with post-sync reconciliation and auditability.

## Product Goals

The system must allow PROACTIVE to:

- assign and manage turfs
- let canvassers complete a full shift with weak or no connectivity
- capture household-level visit outcomes with GPS validation
- preserve a complete audit trail for operational and override actions
- import from VAN-oriented CSVs and export both internal and VAN-compatible CSVs
- support safe reassignment, reopening, and review workflows without deleting history

## v1 Scope

v1 includes:

- mobile canvasser app
- admin web dashboard
- backend API and PostgreSQL database
- CSV import mapping and export profiles
- offline-first local storage and sync queue
- GPS soft enforcement with review and override support
- turf assignment, session, completion, pause/resume, reopen, and reassignment rules
- auditable operational history

v1 does not include:

- live VAN API integration
- public-facing location sharing
- automatic system queue assignment
- map heatmaps
- suspicious activity scoring engine
- SMS MFA
- self-registration
- multi-organization UI
- campaign management UI

The schema and APIs should remain future-ready for those items, but v1 UI and workflow do not need to expose them.

## Safe Defaults Chosen For v1

Where the client documents provided ranges or optional patterns, use these defaults:

- Organization support: implement a single default organization in v1, but include `organization_id` on major records
- Campaign support: include nullable `campaign_id` in schema where relevant, but do not require campaign management UI in v1
- Roles in v1 UI: `admin`, `supervisor`, and `canvasser`
- `supervisor` role: enabled in v1 for operational review, turf reassignment/reopen, GPS review, and read-only outcome visibility
- Password minimum length: 10 characters
- Password rule: at least 1 letter and 1 number
- Activation flow: admin-created accounts only in v1; invited users activate via email link
- Activation link expiry: 48 hours
- Password reset expiry: 30 minutes
- Access token lifetime: 30 minutes
- Refresh token lifetime: 14 days
- Failed login lockout: 5 failed attempts, 15-minute lock
- MFA: required for admins, not required for canvassers in v1
- MFA method: authenticator app only in v1
- GPS validation radius: 75 feet default
- GPS low-accuracy threshold: accuracy greater than 30 meters
- Turf idle timeout: 30 minutes to auto-pause session
- Duplicate attempt cooldown: 5 minutes between submissions to the same household by the same canvasser unless admin override
- Maximum attempts per household per turf cycle: 3
- Export timestamp format: ISO 8601 with offset
- Time zone label: `America/Detroit`
- Data retention baseline:
  - canvassing data: 3 years
  - GPS/location data: 2 years
  - audit logs: 3 years

## Roles And Access

### Admin

Admins can:

- manage users
- invite and activate canvassers
- assign, reassign, reopen, and complete turfs
- import and export CSVs
- view progress, sessions, audit history, and GPS review data
- override GPS issues and conflict states

Admins must use MFA.

### Supervisor

Supervisors can:

- sign in to the web dashboard
- view dashboard progress and active canvasser activity
- view field users
- review turfs and reassign or reopen them
- review GPS exceptions and apply overrides
- view configured outcome definitions

Supervisors cannot:

- create or deactivate users
- create or import turfs
- edit outcome definitions
- export operational data

### Canvasser

Canvassers can:

- authenticate to the mobile app
- load only their assigned turf data
- start, pause, resume, and end their own turf session
- log household outcomes and notes
- work offline using cached turf data
- sync their queued records

Canvassers cannot:

- view other users’ turfs
- export data
- override GPS validation
- reopen or reassign turfs

## Authentication And Security

### Account lifecycle

- Accounts are created by admins
- New accounts are inactive until activation is completed
- Activation uses an expiring, single-use email token
- Password resets use an expiring, single-use email token
- Admins can reset passwords but can never view passwords

### Tokens and sessions

- Use short-lived access tokens plus refresh tokens
- Refresh token invalidation is required on logout
- Refresh failure forces re-authentication before sync resumes
- Track device or browser metadata where feasible
- Track last login time and IP when available

### Security controls

- HTTPS required in all non-local environments
- Passwords hashed with bcrypt or Argon2
- Login and password reset routes rate-limited
- Admin-sensitive actions require admin role and fresh valid session
- Audit logs are append-only and not editable by normal application flows

### GPS privacy

- GPS data is for internal validation, quality control, and internal reporting only
- Detailed GPS access is limited to admins
- External VAN-compatible exports exclude GPS unless explicitly required by a defined workflow

## Core Functional Rules

### Turf assignment and status

Turf statuses in v1:

- `unassigned`
- `assigned`
- `in_progress`
- `paused`
- `completed`
- `reopened`
- `archived`

Rules:

- A turf must be assigned before work begins
- A turf has one primary assignee at a time unless explicitly marked `is_shared = true`
- A canvasser may have only one active turf session at a time
- A turf may have only one active session at a time unless `is_shared = true`
- Starting work moves turf to `in_progress`
- Auto-pause may occur after 30 minutes of inactivity, but auto-complete is never allowed

### Pause, resume, and completion

- Resume is allowed only for `assigned`, `in_progress`, or `paused` turfs
- Completed and archived turfs are read-only to canvassers
- Completion is explicit only
- If unattempted households remain, completion must show a warning and require confirmation
- Completion records totals for attempted and unattempted households

### Reopen and reassignment

- Reopen is admin-only
- Reopen requires a structured reason plus optional notes
- Reassignment after work starts is admin-only
- Existing work remains attributed to the original canvasser
- Remaining work transfers to the new assignee
- If an active session exists, reassignment requires force-close, end-session, or auto-pause first

## Offline-First Behavior

### Local-first rule

Every household interaction saves locally first, then syncs later.

This is not a draft-only model. It is an offline-first operational model.

### Local cache contents

The mobile app must cache:

- assigned turf metadata
- household records for the turf
- coordinates and VAN-linked IDs
- allowed outcome definitions
- active session context
- pending sync queue
- provisional progress data

Cached data should be minimized to field-use essentials only.

### Local persistence

- Pending records must survive app close, restart, and device restart
- Each local submission must have:
  - local UUID
  - session ID
  - canvasser ID
  - household ID
  - client-created timestamp
  - idempotency key

### Sync states

Each syncable record has one of:

- `pending`
- `syncing`
- `synced`
- `failed`
- `conflict`

### Sync behavior

- Auto-sync on connectivity return
- Visible manual `Sync Now` option
- Chronological sync order unless batched by implementation
- Partial success is allowed
- Failed records remain local until resolved

### Conflict handling

The server becomes source of truth after sync, but conflict records are preserved rather than silently overwritten.

Conflict defaults:

- Same household, same disposition, near same time: flag as probable duplicate
- Same household, different disposition: preserve both, flag for review
- Turf reassigned while offline: preserve older offline work and mark as post-reassignment submission
- Same local record sent twice: deduplicate by idempotency key or local UUID

No conflict path may delete history automatically.

## GPS Enforcement Rules

### Validation model

GPS is soft-enforced in v1.

- Within 75 feet: `verified`
- Outside 75 feet: `flagged`
- No GPS captured: `missing`
- GPS accuracy greater than 30 meters: `low_accuracy`

Submissions are never blocked solely due to out-of-range, missing, or low-accuracy GPS.

### GPS capture and storage

Each visit submission stores:

- captured latitude
- captured longitude
- accuracy in meters
- distance from target in feet
- GPS status
- capture timestamp
- target household coordinates snapshot
- validation radius used

Historical GPS records are append-only.

### Overrides

Admins may override flagged or missing GPS outcomes.

Override requirements:

- reason code
- optional notes
- admin user ID
- timestamp

All overrides must be auditable.

### User messaging

The mobile app should show soft messaging only:

- verified visits save normally
- flagged or missing visits save with a warning
- user sees a prompt if location could not be verified

## Visit And Outcome Rules

### Outcome definitions

Outcomes are configurable in the database, not permanently hard-coded.

Each outcome definition includes:

- code
- label
- is_active
- is_contact
- is_final_disposition
- counts_as_attempt
- requires_note
- allows_revisit
- display_order

### Visit logging

Visit logs are append-only event records.

Each visit log stores:

- linked outcome definition ID
- outcome code snapshot
- outcome label snapshot
- canvasser and assignment references
- timestamps for local create and server receive
- source system
- sync status
- conflict flags
- override flags
- reopen flags

### Attempt rules

- Max 3 attempts per household per turf cycle
- Max 1 final disposition considered current at a time
- Minimum 5 minutes between submissions to the same household by the same canvasser unless overridden
- Repeated attempts may be legitimate and must not be treated as duplicates unless dedupe rules match the same local submission or near-identical event signature

### Current status

History is preserved, but reporting uses one current status per household per turf cycle.

This may be implemented with either:

- `is_current_status` on visit logs, or
- a derived reporting view

v1 should prefer a derived reporting view or deterministic latest-valid-log logic to reduce mutation complexity.

## Data Model

### v1 schema design principles

- UUID primary keys
- PostgreSQL
- soft deletes for major operational records
- append-only audit/event tables
- indexed normalized address keys
- indexed VAN IDs
- indexed sync and idempotency fields

### Required operational entities

- organizations
- users
- roles
- turfs
- turf_assignments
- households
- household_geocodes
- turf_households
- sessions
- outcome_definitions
- visit_logs
- imports
- exports

### Required support and audit entities

- sync_events or sync_queue
- audit_logs
- admin_overrides
- visit_geofence_results
- organization_settings
- campaign_settings (nullable future-ready support)

### Future-ready but not fully surfaced in v1 UI

- campaigns
- supervisor role
- multi-org UI switching
- team/shared turf management workflows beyond a simple `is_shared` flag

### Key schema rules

- Include `organization_id` on major records
- Include nullable `campaign_id` where future reuse matters
- Use normalized address keys for dedupe
- Store household geocodes separately from household core identity
- Store export and import batch metadata
- Use soft delete fields and retention fields on major records

## CSV Import And Export

### Core design

The system uses:

- one stable internal master schema
- one import mapping layer for VAN CSVs
- one or more export profiles

The internal schema must not change based on VAN column names.

### Import requirements

Import supports these modes:

- create new only
- upsert
- replace turf membership only

v1 default import mode:

- replace turf membership only

Supported duplicate matching priority:

1. `van_person_id`
2. `van_household_id`
3. normalized address signature

If duplicate matching is ambiguous, do not auto-merge. Flag for admin review.

### Normalization requirements

- Trim whitespace
- Convert blank placeholders to empty values
- Store state as two-letter uppercase
- Preserve ZIP as text
- Keep unit/apartment as a separate field when possible
- Preserve raw imported values where practical for audit

### Export profiles

v1 includes two export profiles:

1. Internal Master Export
2. VAN-Compatible Export

Internal Master Export:

- fixed column order
- fixed names
- includes GPS, sync, and override metadata

VAN-Compatible Export:

- limited to columns required by the specific upload workflow
- generated through a profile mapping
- excludes GPS unless that upload profile explicitly needs it

### Export defaults

- UTF-8 with BOM
- comma-delimited
- header row required
- one row per exported event record
- ISO 8601 timestamps with offset
- `America/Detroit` exported as time zone value
- standard CSV escaping via library, never manual concatenation

### Export tracking

Every export batch stores:

- batch ID
- profile used
- initiated by user
- initiated at timestamp
- filter scope

Re-export is allowed, but every export action must be traceable.

## Audit And Retention

### Audit requirements

Audit log all major actions, including:

- login success and failure
- logout
- password reset
- account activation
- turf assignment, reassignment, start, pause, resume, complete, reopen, and force-close
- visit create, edit, delete, and reopen actions
- GPS override
- import and export actions
- sync conflict detection and resolution
- admin user changes

Each audit entry stores:

- actor user ID
- action type
- entity type and ID
- timestamp
- old values
- new values
- reason code and notes if relevant
- device/IP metadata when available

### Retention defaults

- canvassing data retained 3 years
- GPS data retained 2 years
- audit logs retained 3 years

Hard deletes are restricted to:

- true duplicate cleanup approved by policy
- test data cleanup
- retention purge jobs

## API Requirements

### General

Use authenticated REST endpoints with role-based authorization.

All mutation routes must create audit records.

### Required endpoint groups

- auth
- users/admin management
- turfs and assignments
- sessions
- households
- outcomes/reference data
- visits
- GPS review and override
- sync
- imports
- exports
- audit logs

### Required response behavior

- consistent JSON error shape
- explicit sync status values
- explicit GPS status values
- enough metadata for the mobile app to resume work offline

### Recommended standard error shape

```json
{
  "message": "Human-readable error",
  "code": "MACHINE_CODE",
  "details": {}
}
```

## User Experience Requirements

### Mobile

- large touch targets
- low-typing interaction model
- clear offline indicator
- visible pending sync count
- household-level sync state
- clear save confirmation even while offline
- resumed turfs show remaining work first
- completed records read-only for canvassers unless reopened

### Admin dashboard

- dashboard summary
- active canvassers
- turf assignment and reassignment
- import mapping UI
- export profile selection
- GPS review filters
- conflict review queue
- audit visibility

v1 may defer advanced map visualization, but must support list and filter workflows for GPS review.

## Explicit v1 Exclusions And Deferments

These are intentionally deferred even though the source documents mention them:

- suspicious activity scoring engine
- heatmaps and advanced route maps
- self-registration
- SMS MFA
- public or external GPS visibility
- rich campaign management UI
- multi-organization admin switching UI
- automatic turf queue assignment

## Acceptance Criteria

v1 is acceptable when all of the following are true:

- admin can create or invite canvassers and assign a turf
- canvasser can download assigned turf data and complete a full shift offline
- each visit saves locally first and syncs later
- duplicate resend of the same local visit does not create duplicate server records
- GPS statuses are recorded as verified, flagged, missing, or low_accuracy
- admins can review flagged or missing GPS records and override with a reason
- turf pause, resume, completion, reopen, and reassignment rules behave as specified
- CSV import supports field mapping and duplicate detection
- internal and VAN-compatible exports can be generated with batch tracking
- audit logs are created for major security and operational actions

## Implementation Guidance

### Backend

- NestJS
- Prisma
- PostgreSQL
- JWT access tokens and refresh tokens
- structured audit logging
- import/export profile layer
- sync and idempotency support

### Admin dashboard

- Next.js
- role-protected admin UI
- audit, GPS review, and import/export workflows

### Mobile app

- Expo / React Native
- local persistent storage for offline-first work
- queue-based sync
- GPS capture on visit submission

## Open Items To Confirm Later

These do not block v1 implementation because safe defaults are chosen above, but they should be revisited with the client:

- whether multi-campaign support should move from schema-only to user-facing v1 functionality
- the first exact VAN upload profile to support
- final legal/privacy wording for GPS notice and user consent
- whether encrypted local storage is sufficient or a stronger device-bound secure storage model is required for all cached data
