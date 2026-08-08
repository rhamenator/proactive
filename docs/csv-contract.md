# PROACTIVE CSV Contract

Status: stable

Contract identifier: `proactive-csv/v1`
Machine-readable manifest: [`contracts/csv/proactive-v1.json`](../contracts/csv/proactive-v1.json)

## Purpose And Authority

This contract defines the versioned CSV shapes that PROACTIVE itself owns. It is deliberately separate from any single vendor upload format.

The sources of truth, in order, are:

1. A campaign or organization CSV profile override selected at runtime.
2. The built-in versioned profile identified by this contract.
3. A legacy built-in alias retained for backward compatibility.

Runtime overrides remain supported. An override may rename, omit, or reorder columns for a particular client workflow without changing the stable internal data model.

`proactive-csv/v1` is not certified as a universal NGP VAN, EveryAction, VoteBuilder, or SmartVAN import format. Those systems use workflow-specific mappings. A vendor-specific profile must be named for the actual workflow it implements and verified against that workflow before operational use.

## Profile Codes

| Versioned profile | Direction | Purpose | Legacy alias |
| --- | --- | --- | --- |
| `proactive_turf_import_v1` | Import | Turf, household, address, and optional VAN identifiers | `van_standard` |
| `proactive_canvass_results_v1` | Export | Compact visit-results interchange | `van_compatible` |
| `internal_master_v1` | Export | Full operational and audit extract | `internal_master` |

The legacy names continue to work, but new integrations should use the versioned names. In particular, `van_compatible` means only that the historical profile was designed as a VAN-oriented starting point; it does not guarantee compatibility with an unspecified VAN upload screen.

## Physical CSV Format

Imports:

- comma delimiter;
- header row required;
- standard RFC-style CSV quoting handled by `csv-parse`;
- LF and CRLF line endings accepted;
- empty lines skipped;
- surrounding field whitespace trimmed;
- UTF-8, UTF-8 with BOM, and Windows-1252 accepted;
- maximum upload size 50 MiB.

Exports:

- comma delimiter;
- header row always emitted, including zero-row exports;
- UTF-8 with BOM for spreadsheet compatibility;
- standard quoting handled by `csv-stringify`;
- one exported row per visit event;
- maximum 25,000 rows per export;
- formula-shaped text cells are neutralized before download.

## Turf Import v1

Canonical header order:

```csv
turf_name,address_line1,address_line2,unit,city,state,zip,van_household_id,van_person_id,van_id,latitude,longitude
```

| Header | Required | Meaning |
| --- | --- | --- |
| `turf_name` | No | Turf grouping; the UI fallback is used when absent |
| `address_line1` | Yes | Primary street address |
| `address_line2` | No | Secondary address information kept separate from line 1 |
| `unit` | No | Apartment, suite, or unit |
| `city` | Yes | City or locality |
| `state` | Yes | State/province; stored uppercase |
| `zip` | No | Postal code preserved as text, including leading zeroes |
| `van_household_id` | No | Household-level external identifier |
| `van_person_id` | No | Person-level external identifier |
| `van_id` | No | Legacy generic identifier fallback |
| `latitude` | No | Finite numeric latitude when supplied |
| `longitude` | No | Finite numeric longitude when supplied |

Header matching is case-insensitive and ignores punctuation, spaces, and underscores. Common aliases such as `street`, `address`, `town`, `province`, `zipcode`, `apt`, `VANID`, and `personid` are inferred automatically. Preview reports missing mappings before a batch is committed.

Import behavior is part of the selected profile:

- `create_only`: create a new turf rather than matching an existing one;
- `upsert`: reuse a matching turf and add/update membership;
- `replace_turf_membership`: make the imported household set authoritative for an existing turf.

Duplicate strategy is also configurable:

- `skip`;
- `error`;
- `merge`;
- `review` (the versioned default).

Duplicate identity is evaluated by VAN person ID, VAN household ID, then normalized address. Ambiguous duplicates must go to review rather than being silently merged.

## Canvass Results Export v1

Canonical columns:

```text
van_id
address_line1
address_line2
unit
city
state
zip
visit_time
result
contact_made
notes
time_zone
gps_status
latitude
longitude
accuracy_meters
distance_from_target_feet
sync_status
canvasser_name
```

`visit_time` is ISO 8601 with an offset. Boolean values are rendered as `true` or `false`. Empty optional values are empty CSV fields.

This base interchange contains GPS-related columns because it describes the current PROACTIVE result record. A scoped external-upload profile must explicitly remove GPS columns unless the approved downstream workflow requires them.

## Internal Master Export v1

The internal master profile contains the complete 53-column operational extract: organization and campaign scope, turf and household identity, outcome and attempt information, sync state, GPS/geofence review, overrides, device identifiers, source, canvasser, timezone, and export state.

Its exact ordered column list is maintained in the machine-readable manifest. It is intended for controlled internal analysis and audit, not direct third-party upload.

## Import And Export Are Not Round-Trip Mirrors

Turf imports describe households and turf membership. Results exports describe visit events. Importing a results export may produce duplicate household rows and does not reconstruct the original operational history. A round trip must use a purpose-built profile and workflow, not the two default profiles back-to-back.

## Adapting A Real VAN Workflow

The first repository-maintained adapter is documented in [Vendor CSV Adapters](vendor-csv-adapters.md). Keep using this checklist for new vendor operations.

For each real downstream workflow:

1. Record the exact VAN product/context and upload operation.
2. Obtain the workflow's current required identifiers, column order, accepted values, and date rules.
3. Create a scoped profile with a descriptive versioned code, for example `van_canvass_results_<workflow>_v1`.
4. Remove fields the workflow does not permit, especially GPS and internal audit identifiers.
5. Generate a template from the profile.
6. Test with synthetic data in a non-production VAN context when available.
7. Record the validation date and responsible reviewer in the profile description or repository documentation.

Do not modify the internal database schema merely to match external column names.

## Privacy-Safe Synthetic Data

Generate deterministic mock datasets locally:

```bash
npm run mock:csv -- --rows 100 --seed 20260807 --output .local/mock-csv
```

The generator creates:

- UTF-8-with-BOM turf imports;
- Windows-1252 turf imports for encoding regression testing;
- compact canvass-results exports;
- internal-master exports;
- a manifest marking the records as synthetic.

All names, IDs, addresses, notes, and organizational values are generated locally and visibly prefixed or worded as mock data. The generator does not call an external faker service or derive records from real people. Committed examples are available under [`examples/csv/proactive-v1`](../examples/csv/proactive-v1/).

## Change Control

A change is backward-compatible when it improves parsing, adds aliases, or introduces a new profile code without changing an existing versioned profile's meaning.

A change requires `proactive-csv/v2` when it removes or renames canonical columns, changes required fields, changes row identity, or changes the meaning/type of an existing field. Legacy profile aliases may remain supported independently of the current version.
