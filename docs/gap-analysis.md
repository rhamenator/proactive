# PROACTIVE Current Gap Analysis

Date: 2026-03-29

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
- VAN-compatible export, internal master export, and export history
- CI, build verification, regression tests, and GitHub release-build automation

The remaining gaps are now mostly outside the core application logic. They are concentrated in finer-grained authorization policy, deeper analytics/report-history polish, and external mobile signing inputs.

## What Is In Place

- backend auth with refresh tokens, activation, password reset, lockout, and request throttling
- admin/supervisor MFA challenge, setup, verification, backup-code, and disable flows
- token-backed admin impersonation start/stop, active impersonation banner context, and audited impersonation sessions
- configurable outcome definitions in the database
- GPS review queue and override actions
- sync-conflict queue and resolution actions
- visit correction endpoints and UI with role-aware edit restrictions
- organization scoping in backend admin/turf/export review flows
- org/campaign scaffolding in the schema
- requested-address persistence plus mobile submission and review workflow
- export batch tracking and two export profiles
- admin dashboard routes for outcomes, GPS review, sync conflicts, MFA account settings, turf operations, exports, reports, address requests, visit corrections, field preview, and field-user management
- mobile canvasser workflow driven by server-defined outcomes, with missing-address requests and recent-visit correction support
- repo-wide `verify` command and GitHub Actions CI
- GitHub release-build workflow for trusted build artifacts

## Remaining Material Gaps

### 1. Fine-grained scope enforcement still stops at the organization boundary

Current state:

- admin and supervisor operational queries are organization-scoped
- `organization_id` and `campaign_id` are present in the schema
- there is still no deeper team, geography, or campaign-specific permission matrix

Why it matters:

- the immediate multi-org leakage risk is addressed
- future finer-grained scoping would still require policy decisions and additional enforcement work

What remains:

- decide whether campaign, team, or turf-region scoping is required in v1.x
- if yes, model those assignments and enforce them in backend authorization

### 2. Reporting history and analytics depth can still be extended

Current state:

- the dashboard now exposes filtered reporting for overview, productivity, GPS exceptions, and audit activity
- exportable views now match active filters at the page layer
- the reporting packet still leaves room for deeper slices such as long-range trend reporting, resolved-conflict history, and richer export-batch analytics

Why it matters:

- the client reporting packet is broader than any sensible first release surface
- additional analytics would improve operations, but they are no longer core product blockers

What remains:

- decide whether resolved-conflict history, export-batch rollups, or longitudinal trend views belong in the next release
- add those pages/endpoints if the client wants them in v1.x rather than a later enhancement

### 3. Signed mobile binaries still depend on external release credentials

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
- visit correction flows exist across backend and UI
- requested-address submission/review exists across mobile and admin
- organization-scoped operational access exists
- org/campaign scaffolding exists
- export profiles and export history now exist
- reporting endpoints and dashboard reporting pages now exist
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

- deeper team/campaign/geography scope policy and enforcement if the client wants that in v1.x
- final signed mobile app distribution without real external signing credentials

Remaining non-blocking enhancements:

- deeper analytics/report-history breadth beyond the first reporting slice
- richer break-glass or help-desk recovery options beyond backup codes

## Recommended Next Sequence

1. Decide whether deeper campaign/team/geography scope belongs in the next release and implement it if required.
2. Provide production release secrets and final app identifiers for EAS/App Store/Play.
3. If desired, extend reporting with resolved-conflict history and longer-range analytics.
