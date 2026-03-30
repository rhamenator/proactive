# Review Notes

Date: 2026-03-30

## What I Found

- Import preview was not consistently using the same effective header mapping that the real import flow used.
- Import scope resolution had a real risk of using the creator's raw campaign instead of the resolved campaign/team scope when looking up an existing turf.
- Non-VAN duplicate household detection was too literal and could split the same household because of trivial address formatting differences.
- Structured apartment/unit data from CSV imports was being flattened into `addressLine1`, which was lossy.
- Sync conflict handling had scaffolding and some real cases, but duplicate local-record/idempotency payload mismatches were not being classified as true conflicts.
- Reporting and exports were functional, but a few clearly-supported slices and columns were still missing from the current schema-backed implementation.

## What I Fixed

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

- The mobile app is operationally offline-capable and conflict-aware, but future work could still deepen device-side sync forensics beyond the current model if needed.
- CSV/VAN support is substantially stronger, but source-specific import rules can still be extended further if the client wants deeper parity than the current configurable-profile baseline.
- The current reusable-household model is materially better than turf-owned addresses alone, but future schema evolution may still add broader lifecycle/archive automation if the client wants it.
- Final signed mobile release binaries still require external Expo/Apple/Google credentials that are intentionally not stored in the repo.
