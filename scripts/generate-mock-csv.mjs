import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import iconv from 'iconv-lite';
import { stringify } from 'csv-stringify/sync';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contractPath = resolve(repositoryRoot, 'contracts/csv/proactive-v1.json');
const contract = JSON.parse(readFileSync(contractPath, 'utf8'));

function printHelp() {
  process.stdout.write(`Generate deterministic, privacy-safe PROACTIVE CSV datasets.

Usage:
  npm run mock:csv -- [--rows 100] [--seed 20260807] [--output .local/mock-csv]

The generated identities, addresses, IDs, coordinates, and notes are fictional.
No external data source or random personal-data service is used.
`);
}

function parseArguments(values) {
  const options = {
    rows: 100,
    seed: 20260807,
    output: resolve(repositoryRoot, '.local/mock-csv')
  };

  for (let index = 0; index < values.length; index += 1) {
    const argument = values[index];
    if (argument === '--help' || argument === '-h') {
      printHelp();
      process.exit(0);
    }

    const value = values[index + 1];
    if (argument === '--rows') {
      options.rows = Number(value);
      index += 1;
    } else if (argument === '--seed') {
      options.seed = Number(value);
      index += 1;
    } else if (argument === '--output') {
      options.output = resolve(process.cwd(), value);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!Number.isSafeInteger(options.rows) || options.rows < 1 || options.rows > contract.physicalFormat.maxExportRows) {
    throw new Error(`--rows must be an integer from 1 through ${contract.physicalFormat.maxExportRows}`);
  }
  if (!Number.isSafeInteger(options.seed) || options.seed < 0) {
    throw new Error('--seed must be a non-negative integer');
  }

  return options;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(values, random) {
  return values[Math.floor(random() * values.length)];
}

function padded(value, length = 6) {
  return String(value).padStart(length, '0');
}

function buildImportRows(count, random) {
  const streetNames = ['Fixture Avenue', 'Sample Street', 'Privacy Place', 'Synthetic Boulevard', 'Café Fixture Way'];
  const turfNames = ['Mock North', 'Mock Central', 'Mock South'];

  return Array.from({ length: count }, (_, index) => {
    const ordinal = index + 1;
    return {
      turf_name: turfNames[index % turfNames.length],
      address_line1: `${100 + ordinal} ${pick(streetNames, random)}`,
      address_line2: index % 9 === 0 ? `Fixture Building ${1 + (index % 4)}` : '',
      unit: index % 4 === 0 ? `Mock Unit ${1 + (index % 20)}` : '',
      city: index % 2 === 0 ? 'Exampleville' : 'Sampletown',
      state: 'MI',
      zip: `00${String(index % 1000).padStart(3, '0')}`,
      van_household_id: `MOCK-H-${padded(ordinal)}`,
      van_person_id: `MOCK-P-${padded(ordinal)}`,
      van_id: `MOCK-V-${padded(ordinal)}`,
      latitude: '',
      longitude: ''
    };
  });
}

function buildResultRows(importRows, random) {
  const results = ['not_home', 'support', 'undecided', 'refused', 'moved'];
  const notes = [
    '',
    'Synthetic follow-up requested',
    'Mock record; contains no personal data',
    'Quoted fixture, with comma',
    'Multiline fixture\nsecond synthetic line'
  ];
  const baseLocalTime = Date.UTC(2026, 0, 15, 14, 0, 0);

  return importRows.map((row, index) => ({
    van_id: row.van_id,
    address_line1: row.address_line1,
    address_line2: row.address_line2,
    unit: row.unit,
    city: row.city,
    state: row.state,
    zip: row.zip,
    visit_time: new Date(baseLocalTime + index * 15 * 60 * 1000).toISOString().replace('Z', '-05:00'),
    result: pick(results, random),
    contact_made: index % 3 === 0 ? 'true' : 'false',
    notes: pick(notes, random),
    time_zone: 'America/Detroit',
    gps_status: index % 5 === 0 ? 'missing' : 'captured',
    latitude: '',
    longitude: '',
    accuracy_meters: '',
    distance_from_target_feet: '',
    sync_status: 'synced',
    canvasser_name: `Mock Canvasser ${String(1 + (index % 4)).padStart(2, '0')}`
  }));
}

function buildInternalRows(importRows, resultRows) {
  return resultRows.map((result, index) => {
    const ordinal = index + 1;
    const source = importRows[index];
    return {
      visit_id: `mock-visit-${padded(ordinal)}`,
      organization_id: 'mock-organization',
      campaign_id: 'mock-campaign',
      team_id: `mock-team-${1 + (index % 2)}`,
      region_code: `MOCK-R${1 + (index % 3)}`,
      turf_id: `mock-turf-${1 + (index % 3)}`,
      turf_name: source.turf_name,
      address_id: `mock-address-${padded(ordinal)}`,
      household_id: `mock-household-${padded(ordinal)}`,
      household_van_household_id: source.van_household_id,
      household_van_person_id: source.van_person_id,
      van_id: source.van_id,
      address_line1: source.address_line1,
      address_line2: source.address_line2,
      unit: source.unit,
      city: source.city,
      state: source.state,
      zip: source.zip,
      session_id: `mock-session-${1 + (index % 5)}`,
      visit_time: result.visit_time,
      client_created_at: result.visit_time,
      server_received_at: result.visit_time,
      outcome_definition_id: `mock-outcome-${result.result}`,
      outcome_code: result.result,
      outcome_label: result.result.replaceAll('_', ' '),
      is_final_disposition: result.result === 'moved' ? 'true' : 'false',
      legacy_result: result.result,
      attempt_number: String(1 + (index % 3)),
      is_revisit: index % 3 === 0 ? 'false' : 'true',
      contact_made: result.contact_made,
      notes: result.notes,
      sync_status: result.sync_status,
      sync_conflict_flag: 'false',
      sync_conflict_reason: '',
      gps_status: result.gps_status,
      geofence_validated: 'false',
      geofence_distance_meters: '',
      distance_from_target_feet: '',
      geofence_failure_reason: '',
      override_flag: 'false',
      override_reason: '',
      override_by_user_id: '',
      override_at: '',
      latitude: '',
      longitude: '',
      accuracy_meters: '',
      local_record_uuid: `mock-local-${padded(ordinal)}`,
      idempotency_key: `mock-idempotency-${padded(ordinal)}`,
      source: 'mobile_app',
      canvasser_id: `mock-canvasser-${1 + (index % 4)}`,
      canvasser_name: result.canvasser_name,
      time_zone: result.time_zone,
      van_exported: 'false'
    };
  });
}

function renderCsv(rows, columns, bom = true) {
  return stringify(rows, { header: true, columns, bom, record_delimiter: 'windows' });
}

const options = parseArguments(process.argv.slice(2));
const random = seededRandom(options.seed);
const importProfile = contract.profiles.proactive_turf_import_v1;
const resultProfile = contract.profiles.proactive_canvass_results_v1;
const internalProfile = contract.profiles.internal_master_v1;
const importRows = buildImportRows(options.rows, random);
const resultRows = buildResultRows(importRows, random);
const internalRows = buildInternalRows(importRows, resultRows);

mkdirSync(options.output, { recursive: true });

const importCsvWithBom = renderCsv(importRows, importProfile.columns, true);
const resultCsv = renderCsv(resultRows, resultProfile.columns, true);
const internalCsv = renderCsv(internalRows, internalProfile.columns, true);
const windows1252Import = iconv.encode(renderCsv(importRows, importProfile.columns, false), 'windows-1252');

writeFileSync(resolve(options.output, 'proactive-turf-import-v1.utf8-bom.csv'), importCsvWithBom);
writeFileSync(resolve(options.output, 'proactive-turf-import-v1.windows-1252.csv'), windows1252Import);
writeFileSync(resolve(options.output, 'proactive-canvass-results-v1.utf8-bom.csv'), resultCsv);
writeFileSync(resolve(options.output, 'internal-master-v1.utf8-bom.csv'), internalCsv);
writeFileSync(
  resolve(options.output, 'manifest.json'),
  `${JSON.stringify({
    synthetic: true,
    contract: `${contract.contract}/v${contract.version}`,
    seed: options.seed,
    rows: options.rows,
    generatedAt: 'deterministic-fixture',
    privacyNotice: 'All records are fictional and generated locally without external personal data.'
  }, null, 2)}\n`
);

process.stdout.write(`Generated ${options.rows} synthetic rows per profile in ${options.output}\n`);
