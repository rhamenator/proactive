# Synthetic PROACTIVE CSV Examples

These files contain deterministic fictional records generated from `proactive-csv/v1`:

```bash
npm run mock:csv -- --rows 25 --seed 20260807 --output examples/csv/proactive-v1
```

- `proactive-turf-import-v1.utf8-bom.csv`: normal spreadsheet-friendly import.
- `proactive-turf-import-v1.windows-1252.csv`: encoding regression fixture.
- `proactive-canvass-results-v1.utf8-bom.csv`: compact results shape.
- `internal-master-v1.utf8-bom.csv`: complete operational export shape.
- `manifest.json`: generation parameters and privacy notice.

No record represents a real person, household, organization, campaign, or location. See [the formal contract](../../../docs/csv-contract.md) before adapting these examples to a real vendor workflow.
