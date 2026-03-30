# PROACTIVE Field Canvassing System: Review Handoff

## What Has Been Completed

The application suite has been built and brought to a review-ready state across all major surfaces:

- **Backend API**
  - Authentication, refresh/logout, password reset, activation, lockout, and MFA
  - Step-up MFA enforcement on sensitive admin/supervisor actions
  - Admin/supervisor impersonation support with audit tracking
  - Policy-driven organization, campaign, team, and region scope enforcement for supervisor-facing operational queries
  - Turf creation, assignment, lifecycle management, and field session tracking
  - Visit logging with offline-safe sync metadata, idempotency, GPS validation, and audit history
  - Canonical household records plus turf-level address membership for cross-turf/cross-campaign reuse without breaking current address workflows
  - GPS review and override workflow
  - Sync-conflict review and resolution workflow
  - Configurable visit outcomes
  - Requested-address submission and review workflow
  - Dedicated CSV import service with create-only, upsert, and replace-membership modes; duplicate skip/error/merge/review handling; expanded VAN/person/household/unit mapping; batch history; downloadable source artifacts; row-level import tracing; reviewer resolution for deferred duplicate rows; and configurable import profiles with organization/campaign overrides
  - Reporting endpoints for overview, productivity, GPS exceptions, audit activity, trends, resolved conflicts, and export-batch analytics
  - VAN export, internal master export, export batch history, historical CSV re-download, row-traceable export artifacts, and configurable export profiles with policy-driven default profile selection

- **Admin Dashboard**
  - Dashboard and operational summary views
  - Turf management and assignment
  - Team management with campaign and region binding
  - Field-user management for supervisors and canvassers
  - MFA-protected archive/delete workflows for field users and turfs
  - MFA account management
  - Sensitive-action MFA confirmation flow for exports, overrides, conflict resolution, and turf control changes
  - Policy management for configurable operational defaults such as field visit/GPS thresholds, auth/recovery timing, import behavior, MFA freshness, retention planning, and organization outcome fallback, with step-up MFA required for policy edits and explicit overrides that can be cleared back to inherited defaults
  - CSV profile management for import/export mappings and settings, including organization/campaign overrides and policy-selected default profile codes
  - Supervisor scope configuration across campaign, team, and region modes
  - System-wide settings management for deployment-level auth throttling and retention automation timing, with step-up MFA required for save/reset actions
  - Retention summary and manual cleanup workflow for purgeable artifacts and expired credential records
  - Outcomes management
  - GPS review
  - Sync-conflict review
  - Reports pages
  - Campaign-aware report filtering
  - Requested-address review
  - Visit correction workflow
  - Import-history visibility and source CSV download for recent batches, including removed-membership counts for replace-membership imports and a dedicated duplicate-review queue for deferred import decisions
  - Impersonation-aware admin experience with visible banner
  - Field-preview mode for impersonated canvasser support sessions

- **Mobile App**
  - Canvasser login and turf workflow
  - Address list and visit submission
  - Offline queueing and retry behavior
  - GPS capture and warning handling
  - Missing-address request submission
  - Recent-visit correction support within policy limits

- **Quality and Release Guardrails**
  - Automated test coverage across backend, admin dashboard, and mobile utility layers
  - CI/build verification paths
  - Dependency vulnerability cleanup
  - Retention metadata on core operational records plus a reviewable/manual cleanup path for safe purge targets
  - Documentation, wiki, help docs, and updated gap analysis
  - Trusted GitHub-based build/release workflow scaffolding

## Verification Completed

The current codebase passed the main validation checks:

- `npm run verify`
- Prisma client generation and migration deployment
- Backend build
- Admin dashboard build
- Mobile typecheck
- Backend Jest suite
- Admin dashboard Vitest suite
- Mobile Vitest suite
- `npm audit --omit=dev`
- `git diff --check`

## What You Need To Do Now

To review and move toward deployment, the remaining steps are primarily client-side decisions and credentials, not core development.

### 1. Review The Application Behavior

Please review:

- Admin dashboard workflows
- Field/mobile workflow
- Policy-management defaults and whether they should be set at organization level or campaign level
- Team and region structure, including whether supervisors should default to campaign, team, or region scope
- Deployment-wide auth throttling and retention automation settings in the `System-Wide` policy card
- Field visit/GPS thresholds and whether the initial defaults match your expected operations
- Reporting views
- GPS review flow
- Sync-conflict flow
- Visit correction behavior
- Requested-address review behavior
- Impersonation behavior and banner wording

### 2. Confirm Remaining Business Decisions

Please confirm whether you want any of the following added before release:

- Any additional CSV/VAN rules beyond the current review-ready baseline with configurable profiles, replace-membership imports, expanded VAN field mapping, deferred duplicate review, and duplicate handling
- Any geography model deeper than the current campaign/team/region scope design
- Whether you want lifecycle automation expanded beyond the current safe cleanup targets of address requests, import/export artifacts, and expired credential records
- Any changes to impersonation policy, correction windows, or review permissions

### 3. Provide Production Release Inputs

For final signed mobile release builds, we still need:

- `EXPO_OWNER`
- `EAS_PROJECT_ID`
- Final iOS bundle identifier
- Final Android application ID
- Apple signing / App Store Connect credentials
- Google Play credentials, if Play distribution will be used
- Final production API base URLs

### 4. Perform Acceptance Review

Please review the system against your expected operational flow and provide:

- Any functional defects
- Any policy mismatches
- Any wording/UI changes
- Any missing reports or exports
- Any deployment/environment requirements not yet supplied

## Current Status

The system is now ready for client review and ready for controlled internal/pilot use.

The only major items still outside the repository are:

- Final release credentials for signed mobile binaries
- Additional CSV/VAN workflow depth if you want richer source-specific policy beyond the current configurable-profile baseline, expanded mapping, and duplicate-review workflow
- Any additional geography/scope decisions you want included beyond the current campaign/team/region model
