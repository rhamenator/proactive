# PROACTIVE Current Gap Analysis

Date: 2026-03-28

Reference spec: [v1-final-spec.md](/home/rich/dev/proactive/docs/v1-final-spec.md)

## Summary

The system now covers the main operational v1 workflow:

- admin and supervisor dashboard access
- canvasser-only mobile workflow
- configurable visit outcomes
- admin MFA enrollment, verification, and disable workflow
- GPS review and override workflow
- sync-conflict review and resolution workflow
- offline queueing and idempotent visit sync
- turf lifecycle management
- organization-scoped admin, turf, export, and review queries
- VAN-compatible export, internal master export, and export history
- CI, build verification, regression tests, and GitHub release-build automation

The remaining gaps are no longer core missing workflows. They are concentrated in release credentials, deeper-than-org access scoping, and a few operational enhancement paths.

## What Is In Place

- backend auth with refresh tokens, activation, password reset, lockout, and request throttling
- admin MFA challenge, setup, verification, and disable endpoints
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

### 1. Signed mobile binaries still depend on external release credentials

Current state:

- the repo can produce trusted backend/admin artifacts through GitHub Actions
- the mobile release workflow is prepared in-repo
- signed mobile binaries still require real Expo, Apple, and Google credentials plus final app identifiers

Why it matters:

- this is the main remaining release blocker
- without the external secrets, GitHub can only produce release-prep mobile artifacts rather than final signed distributables

What remains:

- final `EXPO_OWNER`
- final `EAS_PROJECT_ID`
- final iOS bundle identifier
- final Android application ID
- Apple signing and App Store Connect credentials
- Google Play credentials if Play distribution is used

### 2. Scope enforcement stops at the organization boundary

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

### 3. Visit correction workflow is still limited

Current state:

- visit records remain append-only, which is correct for auditability
- GPS overrides and sync-conflict resolutions exist
- there is still no general audited correction flow for outcome/note mistakes after submission

Why it matters:

- field operations teams eventually need a safe way to correct obvious data-entry mistakes
- right now the system supports review/override workflows, but not broad post-submit correction

What remains:

- define the correction policy
- implement audited corrective actions or a correction layer if the client wants that in production

### 4. MFA recovery and emergency-access policy is still basic

Current state:

- admin MFA is implemented and enforced during login
- there is no recovery-code flow, break-glass admin path, or self-service device reset process beyond admin-mediated credential reset and MFA disable

Why it matters:

- the primary security requirement is now satisfied
- operational support around lost devices or authenticator resets is still thinner than a mature enterprise rollout

What remains:

- decide whether recovery codes or a documented help-desk reset flow are sufficient for the first production release
- implement recovery codes only if the client requires them before go-live

## What No Longer Counts As A Gap

- supervisor dashboard access exists
- configurable outcomes exist
- GPS review/override exists
- sync-conflict review exists
- admin MFA exists and is enforced
- organization-scoped operational access exists
- org/campaign scaffolding exists
- export profiles and export history now exist
- the root build/test/Prisma verification path is automated
- trusted GitHub release-build automation exists

## Release Readiness Assessment

The product is at a much stronger release point than before. The main application workflows and the previously identified release-blocking product gaps are addressed.

Safe for:

- internal testing
- pilot deployment
- controlled operational use with informed admins
- formal backend/admin artifact release through GitHub builds

Still blocked for:

- signed mobile app distribution without real external signing credentials

Remaining non-blocking enhancements:

- deeper team/campaign/geography scope rules
- audited visit correction workflow
- richer MFA recovery options

## Recommended Next Sequence

1. Provide production release secrets and app identifiers for EAS/App Store/Play.
2. Run the GitHub release-build workflow to generate trusted artifacts.
3. Decide whether deeper-than-org scope rules belong in the next release.
4. Decide whether audited visit correction is a required post-pilot enhancement.
