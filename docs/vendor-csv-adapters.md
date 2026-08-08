# Vendor CSV Adapters

Vendor adapters are separately versioned from the stable [`proactive-csv/v1`](csv-contract.md) interchange. They translate fields already held by PROACTIVE; they do not change the database schema.

## NGP VAN CRM Bulk Canvass Results v1

Profile code: `ngpvan_vancrm_bulk_canvass_results_v1`

Product contexts: EveryAction 8, VoteBuilder, SmartVAN, and other products backed by VAN CRM.

Operation: the delimited file used by `POST /v4/bulkImportJobs` with resource type `Contacts` and mapping type `CanvassResults`.

Validated: 2026-08-07 against the public NGP VAN API documentation:

- [Bulk Import Jobs](https://docs.ngpvan.com/reference/bulkimportjobs)
- [Bulk Import Mapping Type metadata](https://docs.ngpvan.com/reference/bulkimportmappingtypesmappingtypename)
- [NGP VAN product-context FAQ](https://docs.ngpvan.com/docs/faqs)

The exact ordered file columns are:

| Position | Header | PROACTIVE source | Rule |
| --- | --- | --- | --- |
| 1 | `VanId` | `van_id` | Required positive integer. NGP VAN requires this as the first contact column; matching is case-insensitive. |
| 2 | `ResultID` | `outcome_code` | Required positive integer. A scoped profile must map every exported outcome code to a ResultID valid in the target VAN context. |
| 3 | `DateCanvassed` | `visit_time` | Required ISO 8601 timestamp with an explicit offset. |

The vendor documentation says the header row is a debugging aid: the `file.columns` array in the Bulk Import Job request, in left-to-right order, controls the mapping. Configure that request with the same three names and order. The request must also provide tenant-valid `ContactTypeID` and `CanvassedBy` values, normally as static mappings. Discover current fields and allowed values using the Bulk Import Mapping Type endpoints; do not copy IDs from another VAN tenant.

The machine-readable [job request template](../contracts/csv/adapters/ngpvan-vancrm-bulk-canvass-results-v1.job-template.json) fixes the operation, resource, mapping type, column order, and mapped fields. Replace its URL and `TENANT_*` placeholders only after validating them in the target context. The CSV must be placed in the ZIP named by `sourceUrl`; PROACTIVE does not upload or submit the job.

### Scoped profile configuration

The built-in adapter intentionally has no ResultID guesses. Create an organization or campaign override with the built-in settings plus a mapping such as:

```json
{
  "valueMappings": {
    "ResultID": {
      "knocked": "14",
      "talked_to_voter": "15"
    }
  }
}
```

Keep the built-in `columns`, `columnSources`, `requiredColumns`, and `requiredMappedColumns` settings in the override. An export fails before an artifact is recorded if `VanId`, `DateCanvassed`, or a ResultID mapping is missing. This prevents a plausible-looking but unusable vendor file.

The adapter excludes addresses, notes, GPS/geofence data, sync state, and internal identifiers. Those fields remain available only through PROACTIVE-owned profiles unless a separately reviewed vendor operation explicitly requires them.

Synthetic fixtures live under `testing/fake-data/vendor-adapters`. The success fixture demonstrates exact headers and values; the failure fixture contains missing/invalid values and must be rejected by adapter validation. They contain no real personal data.
