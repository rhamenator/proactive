# Privacy-Safe Operational Scenario Packs

PROACTIVE provides deterministic scenario packs for acceptance testing, demonstrations, regression checks, and bounded load checks when production data cannot be shared.

## Generate the packs

```bash
npm run mock:scenarios -- --seed 20260807 --output .local/mock-scenarios
```

Each scenario directory contains the versioned turf import, canvass results, internal export, Windows-1252 import, and a machine-readable manifest. The aggregate manifest records the seed, catalog version, expected row counts, and prohibited uses.

The catalog is [`testing/fake-data/operational-scenarios.json`](../testing/fake-data/operational-scenarios.json). Available scenarios are:

- `clean-lifecycle`: multi-turf import, visits, and exports.
- `duplicate-strategies`: one normalized duplicate for skip, merge, review, and error behavior.
- `encoding-edge-cases`: UTF-8 BOM, Windows-1252, quoted commas, multiline text, units, and leading-zero ZIP values.
- `sync-recovery`: pending, failed, conflicting, correction, GPS-exception, and revisit records.
- `bounded-high-volume`: 2,500 rows by default, with the normal 25,000-row contract limit.

Generate one scenario or override its bounded row count:

```bash
npm run mock:csv -- --scenario sync-recovery --seed 20260807 --output .local/sync-recovery
npm run mock:csv -- --scenario bounded-high-volume --rows 10000 --output .local/load-check
```

## Seed the local E2E database

The database seed accepts the same scenario names:

```bash
E2E_SCENARIO=sync-recovery npm run seed:e2e
E2E_SCENARIO=bounded-high-volume E2E_SCENARIO_ROWS=5000 npm run seed:e2e
```

Database seeding remains protected by the existing `E2E_ALLOW_DATABASE_SEED=true` guard inside the workspace command. Scenario selection changes deterministic fixture states and batch expectations; it never imports an external dataset.

## Privacy and use limits

Every identifier starts with an obvious mock/fixture marker, all addresses and people are fictional, and no external faker or personal-data service is called. These packs must not be used for production outreach, identity matching, or represented as real people or locations.

Expected counts and edge conditions are asserted in automated tests. Change the catalog version whenever a scenario's meaning or expected outcomes change.
