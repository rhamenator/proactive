# PROACTIVE Current Gap Analysis

Date: 2026-03-29

Reference sources:

- [v1-final-spec.md](/home/rich/dev/proactive/docs/v1-final-spec.md)
- the full client document packet in `/home/rich/Documents`, including acceptance criteria, reporting, deployment, security, permissions, and interaction design addenda

## Summary

The system now covers the main operational v1 workflow:

- admin and supervisor dashboard access
- canvasser-only mobile workflow
- configurable visit outcomes
- admin and supervisor MFA enrollment, verification, backup-code use, and disable workflow
- GPS review and override workflow
- sync-conflict review and resolution workflow
- offline queueing and idempotent visit sync
- turf lifecycle management, including a completion warning when addresses remain unattempted
- organization-scoped admin, turf, export, and review queries
- VAN-compatible export, internal master export, and export history
- CI, build verification, regression tests, and GitHub release-build automation

The remaining gaps are no longer centered on auth/sync basics. They are now concentrated in support workflows, richer reporting, finer-grained permissions, and a few acceptance-level product features that the expanded client packet makes explicit.

## What Is In Place

- backend auth with refresh tokens, activation, password reset, lockout, and request throttling
- admin/supervisor MFA challenge, setup, verification, backup-code, and disable flows
- configurable outcome definitions in the database
- GPS review queue and override actions
- sync-conflict queue and resolution actions
- organization scoping in backend admin/turf/export review flows
- org/campaign scaffolding in the schema
- export batch tracking and two export profiles
- admin dashboard routes for outcomes, GPS review, sync conflicts, MFA account settings, turf operations, exports, and field-user management
- mobile canvasser workflow driven by server-defined outcomes
- repo-wide `verify` command and GitHub Actions CI
- GitHub release-build workflow for trusted build artifacts

## Remaining Material Gaps

### 1. Impersonation is still missing

Current state:

- the permissions and acceptance documents explicitly require audited admin impersonation with a visible banner
- there is no impersonation endpoint, token/session flow, or UI banner in the current system

Why it matters:

- the client’s support model now explicitly includes impersonation
- this is a clear product-spec gap, not just a “future enhancement”

What remains:

- add admin-only impersonation start/stop flows
- tag impersonation context in JWT/session state
- show a persistent impersonation banner in the UI
- audit impersonation start, stop, and impersonated actions

### 2. Visit editing and correction flows are still incomplete

Current state:

- visit records are append-only
- GPS overrides and sync-conflict resolutions exist
- there is still no general correction workflow matching the permissions and acceptance docs:
  - admin edit logs
  - supervisor edit within scope
  - canvasser edit own recent submissions only

Why it matters:

- this is now a documented client requirement rather than an inferred future feature
- operations staff cannot yet correct ordinary outcome/note mistakes through a formal audited workflow

What remains:

- define the correction window and allowed fields by role
- implement audited correction actions and UI
- prevent correction after record lock/review where policy requires it

### 3. Reporting and analytics are still only partially implemented

Current state:

- the dashboard exposes basic totals and turf progress
- GPS review and export history exist
- the reporting packet requires more than that:
  - productivity KPIs
  - standard filters across reports
  - GPS exception reports
  - audit-oriented reporting
  - exportable report views matching active filters

Why it matters:

- the client now has an explicit reporting/analytics requirements document
- the current dashboard is operational, but not yet a full reporting surface

What remains:

- define the first concrete report set to build
- add report filters and report endpoints
- expose productivity and GPS exception reporting in the admin UI
- support report export that honors active filters

### 4. Address-add review workflow is still missing

Current state:

- the canvassing addendum requests a field-visible way to submit addresses that were not on the assigned list
- the system does not currently support canvasser or supervisor submission of proposed new addresses for admin review

Why it matters:

- this affects real field operations when households are missing from the imported turf
- the addendum requires admin confirmation before those submitted addresses become active

What remains:

- add a mobile submission flow for requested new addresses
- persist those requests separately from approved turf addresses
- add an admin review/approve/reject workflow

### 5. Scope enforcement stops at the organization boundary

Current state:

- admin and supervisor operational queries are now organization-scoped
- `organization_id` and `campaign_id` are present in the schema
- there is still no deeper team, geography, or campaign-specific permission matrix

Why it matters:

- the immediate multi-org leakage risk is addressed
- future finer-grained scoping would still require policy decisions and additional enforcement work

What remains:

- decide whether campaign, team, or turf-region scoping is required in v1.x
- if yes, model those assignments and enforce them in backend authorization

### 6. Signed mobile binaries still depend on external release credentials

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
- configurable outcomes exist
- GPS review/override exists
- sync-conflict review exists
- admin/supervisor MFA exists, is enforced, and supports backup codes
- organization-scoped operational access exists
- org/campaign scaffolding exists
- export profiles and export history now exist
- the root build/test/Prisma verification path is automated
- trusted GitHub release-build automation exists

## Release Readiness Assessment

The product is still stronger than before, but the full client packet raises the bar beyond the earlier consolidated spec. With that fuller source set, the repo is not yet cleanly “feature-complete.”

Safe for:

- internal testing
- pilot deployment
- controlled operational use with informed admins
- formal backend/admin artifact release through GitHub builds

Still blocked for full source-packet alignment:

- impersonation
- visit correction/edit workflows
- fuller reporting/analytics surface
- requested-address review workflow
- signed mobile app distribution without real external signing credentials

Remaining non-blocking enhancements:

- deeper team/campaign/geography scope rules
- richer break-glass or help-desk recovery options beyond backup codes

## Recommended Next Sequence

1. Implement admin impersonation with full audit tagging and UI bannering.
2. Implement audited visit correction/edit flows by role and time window.
3. Build the first reporting/analytics slice from the reporting packet.
4. Add requested-address submission and admin review.
5. Provide production release secrets and app identifiers for EAS/App Store/Play.
