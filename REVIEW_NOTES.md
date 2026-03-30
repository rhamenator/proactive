# Review Notes

Date: 2026-03-30 (updated 2026-03-30 — product-alignment pass)

## What I Found

- **date-only `dateTo` filter silently drops a full day of data** — the admin reporting UI sends `YYYY-MM-DD` strings from HTML `type="date"` inputs; JavaScript's `new Date('2026-03-30')` follows the ECMA-262 spec and parses date-only ISO strings as UTC midnight (start-of-day), so `visitTime <= 2026-03-30T00:00:00Z` as the upper bound means any same-day range (e.g. "March 30 to March 30") returns zero results. This affected all report endpoints that use `getRange()`: overview, productivity, GPS exceptions, trends, resolved conflicts, and export-batch analytics.
- **export timezone semantics were drifting across export types** — VAN export rows were labeling `time_zone` as `UTC` while internal master rows still labeled `America/Detroit`, even though both emitted UTC ISO timestamps. That mixed labeling created avoidable ambiguity for downstream consumers.
- Import preview was not consistently using the same effective header mapping that the real import flow used.
- Import scope resolution had a real risk of using the creator's raw campaign instead of the resolved campaign/team scope when looking up an existing turf.
- Non-VAN duplicate household detection was too literal and could split the same household because of trivial address formatting differences.
- Structured apartment/unit data from CSV imports was being flattened into `addressLine1`, which was lossy.
- Sync conflict handling had scaffolding and some real cases, but duplicate local-record/idempotency payload mismatches were not being classified as true conflicts.
- Reporting and exports were functional, but a few clearly-supported slices and columns were still missing from the current schema-backed implementation.

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

## Remaining Limitations

- Session notes are currently device-local only (SQLite on the field device). They are intentionally not synced to backend/admin surfaces in this phase.
- The mobile app is operationally offline-capable and conflict-aware, but future work could still deepen device-side sync forensics beyond the current model if needed.
- CSV/VAN support is substantially stronger, but source-specific import rules can still be extended further if the client wants deeper parity than the current configurable-profile baseline.
- The current reusable-household model is materially better than turf-owned addresses alone, but future schema evolution may still add broader lifecycle/archive automation if the client wants it.
- Final signed mobile release binaries still require external Expo/Apple/Google credentials that are intentionally not stored in the repo.
