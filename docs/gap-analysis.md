# PROACTIVE Current Gap Analysis

Date: 2026-03-28

Reference spec: [v1-final-spec.md](/home/rich/dev/proactive/docs/v1-final-spec.md)

## Summary

The software is now materially beyond prototype status. Core auth, turf lifecycle, offline visit sync foundations, GPS classification, audit logging, exports, and role-aware user management all exist and build together.

The remaining gaps are no longer “does the system exist”; they are concentrated in:

- incomplete supervisor workflow support
- missing configurable outcome model
- missing review/override/admin operations UI
- missing organization/campaign/scoping model
- security controls that are represented in schema but not enforced end-to-end
- specification inconsistencies introduced by later role-model decisions

## What Is Already In Place

- backend JWT auth with refresh tokens, activation, password reset, lockout, and audit logging
- turf assignment, pause/resume/complete/reopen/reassign rules
- visit ingestion with idempotency keys, local UUIDs, sync metadata, GPS status classification, and geofence result storage
- admin dashboard for turf import, assignment, exports, and field-user management
- mobile canvasser workflow with offline queueing and sync retry
- regression tests for core backend role, turf, visit, and guard logic

## Highest-Impact Software Gaps

### 1. Supervisor support is only partially implemented

Current state:

- backend now recognizes `supervisor` and allows supervisor access to some summary and turf routes in [admin.controller.ts](/home/rich/dev/proactive/backend/src/admin/admin.controller.ts) and [turfs.controller.ts](/home/rich/dev/proactive/backend/src/turfs/turfs.controller.ts)
- the admin dashboard still rejects non-admin login in [auth-context.tsx](/home/rich/dev/proactive/admin-dashboard/src/lib/auth-context.tsx)
- the mobile app still rejects non-canvasser login in [AppContext.tsx](/home/rich/dev/proactive/mobile-app/src/context/AppContext.tsx)
- there is no scoped supervisor UI or team/turf scope model anywhere in the schema or backend

Why it matters:

- the role exists, but there is no complete user experience for it
- current supervisor permissions are effectively global on the routes that were opened

Needed next:

- decide whether supervisor is truly in v1 or still future-ready
- if yes, add a real supervisor web experience and scope enforcement
- if no, remove or feature-flag supervisor authorization routes

### 2. Outcome definitions are still hard-coded instead of configurable

Current state:

- visit outcomes still come from the `VisitResult` enum in [schema.prisma](/home/rich/dev/proactive/backend/prisma/schema.prisma)
- backend DTOs and services still accept the enum directly in [create-visit.dto.ts](/home/rich/dev/proactive/backend/src/visits/dto/create-visit.dto.ts) and [visits.service.ts](/home/rich/dev/proactive/backend/src/visits/visits.service.ts)
- the mobile UI also hard-codes the list in [AddressDetailScreen.tsx](/home/rich/dev/proactive/mobile-app/src/screens/AddressDetailScreen.tsx)

Why it matters:

- the spec calls for database-driven outcome definitions with flags like `requires_note`, `is_final_disposition`, and `display_order`
- current reporting and validation logic cannot evolve without code changes

Needed next:

- add outcome-definition tables and seed data
- replace enum-driven visit submission with outcome IDs plus snapshot fields
- load active outcomes into the mobile cache

### 3. GPS review, override, and conflict-resolution workflows are not implemented

Current state:

- the schema supports geofence override metadata and sync conflict flags in [schema.prisma](/home/rich/dev/proactive/backend/prisma/schema.prisma)
- visit ingestion records GPS status and geofence details in [visits.service.ts](/home/rich/dev/proactive/backend/src/visits/visits.service.ts)
- there are no backend endpoints for admin GPS override or conflict resolution
- there is no admin dashboard screen for flagged GPS records, conflicts, or review queues

Why it matters:

- the data exists, but the required operational workflow does not
- flagged GPS and conflict cases can accumulate with no first-class resolution path

Needed next:

- add backend review/override endpoints
- add admin review UI for flagged GPS and sync conflicts
- audit override reasons and resolution actions explicitly

### 4. Organization, campaign, and scoped-authorization support are absent

Current state:

- the spec requires `organization_id` and future-ready `campaign_id` on major records
- there is no organization or campaign model in [schema.prisma](/home/rich/dev/proactive/backend/prisma/schema.prisma)
- supervisor and admin scope is not constrained by org, campaign, or team

Why it matters:

- current permissions are flat
- future multi-team or multi-campaign separation would require schema and API changes, not just UI changes

Needed next:

- add at least a default-organization model and foreign keys on major operational records
- define whether campaign support is schema-only or user-visible in v1
- encode supervisor scope boundaries in the data model

### 5. Security is improved, but still below the written spec

Current state:

- refresh tokens, activation, reset, and lockout exist in [auth.service.ts](/home/rich/dev/proactive/backend/src/auth/auth.service.ts)
- `mfaEnabled` exists on users, but there is no MFA challenge, enrollment flow, or enforcement path
- the JWT default in [backend/.env.example](/home/rich/dev/proactive/backend/.env.example) and [security.module.ts](/home/rich/dev/proactive/backend/src/security/security.module.ts) is still `12h`, not the spec’s `30 minutes`
- there is no rate limiter on login/reset endpoints
- no fresh-session enforcement exists for sensitive admin actions

Why it matters:

- the security story is materially better than before, but not yet aligned with the locked v1 defaults

Needed next:

- implement admin MFA or relax the spec
- reduce access-token lifetime to the intended default
- add request throttling for auth-sensitive routes
- define and enforce re-auth/fresh-session requirements for critical admin actions

### 6. Import/export workflows are operational but not production-complete

Current state:

- CSV import and VAN CSV export work
- export is a single VAN-oriented path in [exports.service.ts](/home/rich/dev/proactive/backend/src/exports/exports.service.ts)
- there are no import batch records, export batch records, duplicate-review queues, or profile-managed exports
- the admin export screen in [page.tsx](/home/rich/dev/proactive/admin-dashboard/app/exports/page.tsx) only supports one export action and no export history

Why it matters:

- the system can move data, but it does not yet provide the auditability and repeatability the spec expects for batch processing

Needed next:

- add tracked import/export batch entities
- add internal master export alongside VAN export
- add import modes and duplicate review
- attach export profile identity and batch history to every export

### 7. Visit correction/edit/delete policy is mostly unimplemented

Current state:

- visit logs are append-only, which is correct for history
- there are no explicit APIs or UI flows for:
  - admin correction with reason
  - supervisor limited correction
  - canvasser self-correction within a time window
  - soft-delete review

Why it matters:

- the spec and role docs assume controlled correction workflows
- the current software only supports create, not operational correction

Needed next:

- define the v1 correction window and allowed edits
- implement append-only corrective actions or an override layer
- expose audited correction workflows in admin/supervisor UI

## Significant Specification Gaps Or Inconsistencies

### 1. The role model is internally inconsistent

Current state:

- [v1-final-spec.md](/home/rich/dev/proactive/docs/v1-final-spec.md) still says:
  - `Roles in v1 UI: admin and canvasser only`
  - `supervisor role: future-ready only, not enabled in v1 authorization flows`
- the later client permissions document and the current codebase both treat `supervisor` as a real role foundation

Why it matters:

- this creates uncertainty about whether the current code is ahead of the spec or violating it

Decision needed:

- either update the v1 Final Spec to make supervisor an active v1 role
- or explicitly downgrade the code to future-ready only and feature-flag/remove current supervisor authorization

### 2. Supervisor scope is still not decision-complete

Unresolved:

- whether supervisors are scoped by team, turf, geography, campaign, or organization
- whether supervisors can reopen or reassign globally or only inside their scope
- whether supervisors can export or only review operational progress

Why it matters:

- the missing scope model is the main reason supervisor support cannot be completed safely

### 3. MFA requirements are stronger in the spec than in the implementation plan

Unresolved:

- whether MFA is truly required for admin in v1
- what provider or method is used
- how activation and password reset messages are delivered in non-local environments

Why it matters:

- the spec promises a higher assurance level than the system currently enforces

### 4. The export profile is still too abstract

Unresolved:

- the exact first production VAN upload profile
- whether the current export columns are final or only provisional
- whether export should be latest-per-household, one-row-per-event, or profile-selectable in the first release

Why it matters:

- export logic is one of the highest-risk places for operational mismatches with real downstream workflows

## Recommended Next Sequence

### Phase 1

- resolve the supervisor product decision and either complete or constrain the role
- update the v1 Final Spec to match that decision

### Phase 2

- implement configurable outcome definitions
- wire those outcomes through backend, admin, and mobile

### Phase 3

- build GPS/conflict review and override workflows
- add correction/reopen/admin review flows for visits

### Phase 4

- add import/export batch tracking and production export profiles
- add duplicate review and import modes

### Phase 5

- add organization/campaign scaffolding and scoped authorization
- close the remaining MFA/rate-limit/fresh-session security gaps
