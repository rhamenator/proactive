# Review Notes

Date: 2026-03-30 (updated 2026-03-30 — product-alignment pass; anti-drift pass)

## What I Found

- **date-only `dateTo` filter silently drops a full day of data** — the admin reporting UI sends `YYYY-MM-DD` strings from HTML `type="date"` inputs; JavaScript's `new Date('2026-03-30')` follows the ECMA-262 spec and parses date-only ISO strings as UTC midnight (start-of-day), so `visitTime <= 2026-03-30T00:00:00Z` as the upper bound means any same-day range (e.g. "March 30 to March 30") returns zero results. This affected all report endpoints that use `getRange()`: overview, productivity, GPS exceptions, trends, resolved conflicts, and export-batch analytics.
- **export timezone semantics were drifting across export types** — VAN export rows were labeling `time_zone` as `UTC` while internal master rows still labeled `America/Detroit`, even though both emitted UTC ISO timestamps. That mixed labeling created avoidable ambiguity for downstream consumers.
- Import preview was not consistently using the same effective header mapping that the real import flow used.
- Import scope resolution had a real risk of using the creator's raw campaign instead of the resolved campaign/team scope when looking up an existing turf.
- Non-VAN duplicate household detection was too literal and could split the same household because of trivial address formatting differences.
- Structured apartment/unit data from CSV imports was being flattened into `addressLine1`, which was lossy.
- Sync conflict handling had scaffolding and some real cases, but duplicate local-record/idempotency payload mismatches were not being classified as true conflicts.
- Reporting and exports were functional, but a few clearly-supported slices and columns were still missing from the current schema-backed implementation.
- **Supervisor scope campaign fallback (anti-drift)** — Four service `scopeWhere`/constraint methods (`admin.service.ts`, `visits.service.ts`, `turfs.service.ts`, `reports.service.ts`) all had an `else if (scope.campaignId)` / `return { campaignId }` fallback inside the supervisor branch. This directly contradicts the product model: campaign is a tag/filter layer and supervisors are team-scoped. The policy layer (`normalizeSupervisorScopeMode`) already rejects `'campaign'` and `resolveAccessScope` correctly assigns team mode — but the service layer was silently undoing that by falling back to campaignId when no teamId/regionCode was set.
- **Test fixture drift** — `admin.controller.spec.ts` and `reports.service.spec.ts` both had mock policies returning `supervisorScopeMode: 'campaign'`. Since the real policy service rejects `'campaign'` and defaults it to `'team'`, these fixtures were testing behavior that can never occur in production.
- **AddressRequest missing `addressLine2`/`unit`** — The `AddressRequest` DB model, DTO, service types, and all code paths (`submitRequest`, `approveRequest`, `ensureHousehold`) were missing the structured secondary address fields that already exist on `Household` and `Address`. Field canvassers submitting apt/unit corrections were losing that data silently.

## What I Fixed

- Fixed `getRange()` in `reports.service.ts` to detect date-only strings (`YYYY-MM-DD`) for `dateTo` and snap them to `T23:59:59.999Z` (end of UTC day) before building the Prisma upper-bound filter. `dateFrom` date-only strings are left unchanged because `new Date('YYYY-MM-DD')` = UTC midnight is already the correct start-of-day lower bound.
- Added regression tests to `reports.service.spec.ts` covering: (a) date-only `dateTo` includes visits throughout the full UTC day, (b) full ISO datetime strings with explicit time components are passed through unchanged.
- Added UTC bucket-stability tests to `visit-analytics.util.spec.ts` covering: (a) morning-bucket stability at 06:30 UTC regardless of runtime server timezone, (b) late-evening bucket and correct UTC weekday at 23:45 UTC, (c) attempt-number ordering by chronological `visitTime` for out-of-order visit input.
- Added a centralized timezone policy helper (`timezone-policy.util.ts`) and wired reports/exports/visit-bucketing to that shared source of truth instead of scattered hardcoded timezone strings.
- Standardized export timestamp semantics across all CSV paths: both VAN and internal master now format timestamps from the same policy and emit the same explicit `time_zone` label (`UTC` by default), with regression assertions verifying output content and labeling.
- Added an effective import-mapping builder and made preview/sample-row readiness use it consistently.
- Aligned import policy resolution, existing-turf lookup, turf creation, and import-batch scope metadata around the same resolved campaign/team/region context.
- Added deterministic normalized address-key support and used it for non-VAN duplicate household matching.
- Added `addressLine2`, `unit`, and `normalizedAddressKey` to `Household` and `Address`, with migration/backfill support.
- Preserved structured address fidelity through import, duplicate-review merge/update, seed data, and export generation.
- Strengthened visit ingest so duplicate local-record/idempotency payload mismatches are classified as `conflict`, recorded in sync events, and surfaced back to the mobile queue state.
- Expanded reports to support supervisor filtering, final-disposition filtering, revisit/attempt semantics, and time-of-day/day-of-week trend buckets using the current data model.
- Expanded export row generation to include additional operational and audit columns already supported by the schema.
- Added and updated regression tests across backend and mobile for the fixes above.
- **Removed supervisor `campaignId` scope fallback** — Deleted the `else if (scope.campaignId)` branch from the supervisor section of `scopeWhere` / `resolveSupervisorConstraints` in all four service files, plus the now-dead `constraints.campaignId` block in `applySupervisorConstraints` (reports). Supervisor scope is now strictly `teamId → regionCode → org-level` with no possible campaign leak. Added two new regression tests in `admin.service.spec.ts` verifying: (a) a supervisor with teamId scopes by teamId only (campaignId is never injected into the where), (b) a misconfigured supervisor with neither teamId nor regionCode falls back to org-level (not campaign-wide).
- **Corrected test fixture drift** — Changed `supervisorScopeMode: 'campaign'` to `'team'` in mock policy objects in `admin.controller.spec.ts` (fixture + mock) and `reports.service.spec.ts` (mock). Tests now exercise the real product invariant.
- **AddressRequest address fidelity** — Added `addressLine2` and `unit` columns to `AddressRequest` (Prisma schema + migration `20260330160000_address_request_fidelity`). Updated `CreateAddressRequestDto`, all internal `RequestRecord`/`RequestAddress`/`SerializedAddressRequest` types, `normalizeAddress`, `serializeRequest`, `submitRequest`, `approveRequest`, `ensureHousehold`, and `buildPendingDuplicateWhere`. Field-submitted address requests now preserve unit/apt data end-to-end: from submission → pending-duplicate check → approval → `Address` record → serialized response. Added regression tests in `address-requests.service.spec.ts` covering both paths.

## Remaining Limitations

- Session notes are currently device-local only (SQLite on the field device). They are intentionally not synced to backend/admin surfaces in this phase.
- The mobile app is operationally offline-capable and conflict-aware, but future work could still deepen device-side sync forensics beyond the current model if needed.
- CSV/VAN support is substantially stronger, but source-specific import rules can still be extended further if the client wants deeper parity than the current configurable-profile baseline.
- The current reusable-household model is materially better than turf-owned addresses alone, but future schema evolution may still add broader lifecycle/archive automation if the client wants it.
- Final signed mobile release binaries still require external Expo/Apple/Google credentials that are intentionally not stored in the repo.

## First Deployment Readiness Review

### Findings

- **Policy enum drift remained possible at write-time**: `UpsertOperationalPolicyDto` accepted all Prisma enum values, and the DB enum still exposed `campaign`, even though runtime behavior is team-first.
- **Schema default drift on import mode**: `OperationalPolicy.defaultImportMode` DB default was still `create_only` while runtime effective defaults use `replace_turf_membership`.

### Targeted Fixes Applied

- Restricted policy update validation to `team|region` in `upsert-operational-policy.dto.ts`.
- Added service-level normalization in `PoliciesService.upsertPolicy()` so direct callers cannot persist legacy campaign scope mode.
- Added Prisma migration `20260331120000_first_deploy_policy_hardening` to:
  - backfill any lingering `campaign` values to `team`
  - remove `campaign` from `SupervisorScopeMode`
  - align `default_import_mode` DB default with runtime (`replace_turf_membership`)
- Updated Prisma schema to match the migration and prevent future drift.
- Added policy regression coverage ensuring unsupported supervisor mode input normalizes to `team` at persistence time.

### Readiness Status

- **Ready for first deployment** on this scope: supervisor policy invariants and default policy persistence now match product direction and runtime behavior.

### Deferred (Intentionally)

- Broader cleanup of historical migration defaults was not expanded beyond the two confirmed drift points above.
- No additional feature work was introduced outside deployment-readiness hardening.

### Hotspots To Watch Post-Deploy

- Any direct SQL writes to `operational_policies` should remain constrained to valid enum values and default-compatible import modes.
- Policy admin UI/API clients should continue sending `supervisorScopeMode` values only from the team/region set.
