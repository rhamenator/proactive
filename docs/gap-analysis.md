# PROACTIVE Current Gap Analysis

Date: 2026-03-30

Reference sources:

- [v1-final-spec.md](/home/rich/dev/proactive/docs/v1-final-spec.md)
- the full client document packet in `/home/rich/Documents`, including acceptance criteria, reporting, deployment, security, permissions, and interaction design addenda

## Summary

The system now covers the main operational v1 workflow:

- admin and supervisor dashboard access
- canvasser-only mobile workflow
- audited admin impersonation with token-backed session switching and visible dashboard banner
- configurable visit outcomes
- admin and supervisor MFA enrollment, verification, backup-code use, and disable workflow
- GPS review and override workflow
- sync-conflict review and resolution workflow
- audited visit correction workflow for admin, supervisor, and time-window-limited canvasser edits
- offline queueing and idempotent visit sync
- turf lifecycle management, including a completion warning when addresses remain unattempted
- organization-scoped admin, turf, export, and review queries
- requested-address submission from the field plus admin/supervisor review and approval
- filtered reporting endpoints and dashboard reporting pages for overview, productivity, GPS exceptions, and audit activity
- campaign-aware reporting endpoints and dashboard reporting pages for overview, productivity, GPS exceptions, audit activity, trends, resolved conflicts, and export-batch analytics
- VAN-compatible export, internal master export, export history, historical CSV re-download, stored export artifacts, and per-row export traceability
- CSV import batch history, downloadable source artifacts, and row-level import outcome tracing
- scoped operational policy records plus admin dashboard policy management for import defaults, sensitive MFA freshness, retention defaults, and outcome fallback behavior
- CI, build verification, regression tests, and GitHub release-build automation

The remaining gaps are now mostly in deeper import-policy breadth, fine-grained authorization policy, and release inputs rather than missing operational screens. Canonical household modeling, retention metadata, on-device SQLite persistence, and import/export audit history are now in place.

## What Is In Place

- backend auth with refresh tokens, activation, password reset, lockout, and request throttling
- admin/supervisor MFA challenge, setup, verification, backup-code, and disable flows
- token-backed admin impersonation start/stop, active impersonation banner context, and audited impersonation sessions
- configurable outcome definitions in the database
- campaign-scoped outcome definitions with scoped uniqueness
- GPS review queue and override actions
- sync-conflict queue and resolution actions
- visit correction endpoints and UI with role-aware edit restrictions
- organization and campaign scoping in backend admin/turf/export/reports flows
- org/campaign scaffolding in the schema and user/session JWT payloads
- requested-address persistence plus mobile submission and review workflow
- SQLite-backed on-device mobile persistence for auth state, queue state, and address state
- canonical `Household` records with turf-level address membership rows that preserve existing `addressId` contracts
- retention / lifecycle metadata on core operational tables, including users, turfs, address memberships, visits, and address requests
- export batch tracking, stored CSV artifacts, downloadable export history, per-row traceability, and two export profiles
- import batch tracking, stored source CSV artifacts, row-level import outcome tracing, and downloadable import history
- a dedicated `ImportsService` and `/imports/csv` path with import modes plus duplicate skip/error/merge handling
- operational policy records with organization/campaign fallback for import defaults, sensitive-action MFA freshness, retention defaults, and organization-level outcome fallback
- admin dashboard routes for outcomes, GPS review, sync conflicts, MFA account settings, turf operations, exports, reports, address requests, visit corrections, field preview, and field-user management
- mobile canvasser workflow driven by server-defined outcomes, with missing-address requests and recent-visit correction support
- repo-wide `verify` command and GitHub Actions CI
- GitHub release-build workflow for trusted build artifacts

## Remaining Material Gaps

### 1. Fine-grained scope enforcement still stops at campaign scope

Current state:

- admin and supervisor operational queries are now organization-and-campaign scoped
- `organization_id` and `campaign_id` are enforced through JWT-derived access scope in admin, turf, export, report, and visit review flows
- there is still no deeper team, geography, or turf-region permission matrix

Why it matters:

- the immediate multi-org and cross-campaign leakage risk is addressed
- future finer-grained scoping would still require policy decisions and additional enforcement work

What remains:

- decide whether team or turf-region scoping is required in v1.x
- if yes, model those assignments and enforce them in backend authorization

### 2. Mobile offline storage now uses a real on-device database

Current state:

- the mobile app now persists auth state, queue state, and address state in a local SQLite database
- offline queueing, retry, and idempotent sync are implemented on top of that store
- this closes the earlier architecture gap where persistence lived in `AsyncStorage`

Why it matters:

- the app now has a real on-device data store for offline workflows
- future work in this area is now about richer sync metadata or more advanced local querying, not replacing the storage foundation

What remains:

- extend the local schema further only if the client wants richer device-side analytics, filtering, or sync forensics

### 3. Policy tuning is now configurable instead of hard-coded

Current state:

- login MFA is enforced for admins and supervisors
- backup codes exist and account-level MFA management exists
- sensitive actions such as export generation, GPS overrides, turf reassignment/reopen, and conflict resolution now require a fresh MFA step-up challenge
- the freshness window, import defaults, retention defaults, and org-outcome fallback behavior are now editable through scoped operational policy records and the dashboard policy page

Why it matters:

- this closes the main “hard-coded policy” gap for the ambiguous operational rules most likely to change after client review
- the remaining question is policy choice rather than implementation capability

What remains:

- decide which policy defaults the client wants to ship with at organization level versus campaign-specific override
- extend the policy surface further only if the client wants more ambiguous rules exposed for runtime administration

### 4. Household normalization and retention metadata are now modeled, but delete/archive workflows are still policy-light

Current state:

- canonical households now exist as reusable records, while the existing `addresses` table acts as the turf-membership layer and preserves current API contracts
- soft-delete / retention metadata are now modeled on the primary operational tables
- exports now store the generated CSV and per-row membership, which closes the most important auditability gap

Why it matters:

- the schema is now much closer to the stricter client packet without forcing a breaking client rewrite
- remaining work in this area is operational policy: whether admins need explicit archive/delete tools and retention jobs in v1.x

What remains:

- decide whether v1.x needs explicit admin archive/delete workflows and automated purge jobs
- if yes, add those actions on top of the new metadata rather than changing the schema again

### 5. Signed mobile binaries still depend on external release credentials

Current state:

- the repo can produce trusted backend/admin artifacts through GitHub Actions
- the mobile release workflow is prepared in-repo
- signed mobile binaries still require real Expo, Apple, and Google credentials plus final app identifiers

Why it matters:

- this is still the main external release blocker
- without the external secrets, GitHub can only produce release-prep mobile artifacts rather than final signed distributables

What remains:

- final `EXPO_OWNER`
- final `EAS_PROJECT_ID`
- final iOS bundle identifier
- final Android application ID
- Apple signing and App Store Connect credentials
- Google Play credentials if Play distribution is used

## What No Longer Counts As A Gap

- supervisor dashboard access exists
- impersonation exists, is audited, and has a persistent UI banner
- configurable outcomes exist
- GPS review/override exists
- sync-conflict review exists
- admin/supervisor MFA exists, is enforced, and supports backup codes
- mobile persistence now uses a local SQLite store instead of `AsyncStorage`
- visit correction flows exist across backend and UI
- requested-address submission/review exists across mobile and admin
- organization/campaign-scoped operational access exists
- org/campaign scaffolding exists in schema, JWT payloads, and major operational services
- export profiles, stored artifacts, downloadable history, and row-traceability now exist
- reporting endpoints and dashboard reporting pages now exist across overview, productivity, GPS exceptions, audit activity, trends, resolved conflicts, and export-batch analytics
- the root build/test/Prisma verification path is automated
- trusted GitHub release-build automation exists

## Release Readiness Assessment

The product is now stronger than before and is closer to full packet alignment, but the client packet still sets a higher bar in a few architectural and security areas. The repo is operationally review-ready and pilot-ready, but not yet literal “everything in every addendum is maximally implemented.”

Safe for:

- internal testing
- pilot deployment
- controlled operational use with informed admins
- formal backend/admin artifact release through GitHub builds

Still blocked for full source-packet alignment:

- deeper team/geography scope policy and enforcement if the client wants that in v1.x
- fuller CSV/VAN import parity if the client insists on every import-side rule from the packet in v1
- final signed mobile app distribution without real external signing credentials

Remaining non-blocking enhancements:

- richer break-glass or help-desk recovery options beyond backup codes

## Recommended Next Sequence

1. Decide whether v1.x needs richer CSV/VAN parity such as ambiguous-duplicate review queues, more source-specific mappings, or import lineage beyond the current batch/row audit trail.
2. Decide whether explicit admin archive/delete workflows should ship now or after pilot review.
3. Set the initial organization/campaign policy defaults in the new Policies screen before broader review.
4. Provide production release secrets and final app identifiers for EAS/App Store/Play.
