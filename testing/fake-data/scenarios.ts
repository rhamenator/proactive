import { createFixtureFactory, type AddressFixture, type VisitFixture } from './factories';

export function createAdminUiScenario(seed = 'admin-ui') {
  const f = createFixtureFactory({ seed, organizationCode: `org_${seed}` });

  const org = f.organization({ name: 'PROACTIVE QA Organization' });
  const campaign = f.campaign('Spring GOTV', { code: 'spring_gotv' });
  const team = f.team('North', { code: 'NORTH', regionCode: 'REG-NORTH' });
  const admin = f.user('Alex', 'admin', {
    email: 'admin.e2e@example.test',
    campaignCode: campaign.code,
    teamCode: team.code,
    mfaEnabled: true
  });
  const supervisor = f.user('Morgan', 'supervisor', {
    email: 'supervisor.e2e@example.test',
    campaignCode: campaign.code,
    teamCode: team.code,
    mfaEnabled: true
  });
  const canvasser = f.user('Casey', 'canvasser', {
    email: 'canvasser.e2e@example.test',
    campaignCode: campaign.code,
    teamCode: team.code,
    mfaEnabled: false
  });

  const turf = f.turf('North Side', team.code, campaign.code, {
    code: 'north-side',
    name: 'North Side Turf',
    regionCode: team.regionCode
  });

  const addresses = [
    f.address(1, turf.code, { addressLine1: '101 Main St', city: 'Detroit', state: 'MI', zip: '48201' }),
    f.address(2, turf.code, { addressLine1: '102 Main St', city: 'Detroit', state: 'MI', zip: '48201' })
  ];

  const visits = [
    f.visit(1, turf.code, canvasser.email, addresses[0].addressLine1, {
      visitTimeIso: '2026-03-30T06:30:00.000Z',
      result: 'talked_to_voter',
      outcomeCode: 'talked_to_voter',
      outcomeLabel: 'Talked to Voter',
      contactMade: true,
      gpsStatus: 'verified'
    }),
    f.visit(2, turf.code, canvasser.email, addresses[1].addressLine1, {
      visitTimeIso: '2026-03-30T23:45:00.000Z',
      result: 'knocked',
      outcomeCode: 'knocked',
      outcomeLabel: 'Knocked',
      contactMade: false,
      gpsStatus: 'flagged',
      geofenceValidated: false,
      syncStatus: 'conflict',
      syncConflictFlag: true,
      syncConflictReason: 'payload_mismatch'
    })
  ];

  const importBatch = f.importBatch({
    filename: 'detroit-import.csv',
    rowCount: 8,
    importedCount: 6,
    pendingReviewCount: 1
  });

  const exportBatch = f.exportBatch({
    filename: 'van-results-2026-03-30.csv'
  });

  const pendingAddressRequest = f.addressRequest({
    turfCode: turf.code,
    requestedByEmail: canvasser.email,
    status: 'pending',
    addressLine1: '555 Added Ave',
    addressLine2: 'Apt 9',
    unit: '9'
  });

  return {
    org,
    campaign,
    team,
    admin,
    supervisor,
    canvasser,
    turf,
    addresses,
    visits,
    importBatch,
    exportBatch,
    pendingAddressRequest,
    mfaSecret: 'JBSWY3DPEHPK3PXP'
  };
}

export const operationalScenarioNames = [
  'clean-lifecycle',
  'duplicate-strategies',
  'encoding-edge-cases',
  'sync-recovery',
  'bounded-high-volume'
] as const;

export type OperationalScenarioName = (typeof operationalScenarioNames)[number];
type AdminUiScenario = ReturnType<typeof createAdminUiScenario>;

function expandScenario(base: AdminUiScenario, rows: number) {
  const addresses: AddressFixture[] = Array.from({ length: rows }, (_, index) => {
    const source = base.addresses[index % base.addresses.length];
    const ordinal = index + 1;
    return {
      ...source,
      addressLine1: `${1000 + ordinal} Synthetic Scenario Way`,
      addressLine2: index % 9 === 0 ? `Fixture Building ${1 + (index % 4)}` : null,
      unit: index % 4 === 0 ? `Mock Unit ${1 + (index % 20)}` : null,
      zip: `00${String(index % 1000).padStart(3, '0')}`,
      vanHouseholdId: `MOCK-H-SCENARIO-${String(ordinal).padStart(6, '0')}`,
      vanPersonId: `MOCK-P-SCENARIO-${String(ordinal).padStart(6, '0')}`,
      vanId: `MOCK-V-SCENARIO-${String(ordinal).padStart(6, '0')}`,
      latitude: 42.9 + (index % 100) * 0.0001,
      longitude: -85.6 - (index % 100) * 0.0001
    };
  });

  const visits: VisitFixture[] = addresses.map((address, index) => {
    const source = base.visits[index % base.visits.length];
    const ordinal = index + 1;
    return {
      ...source,
      localRecordUuid: `mock-scenario-local-${String(ordinal).padStart(6, '0')}`,
      idempotencyKey: `mock-scenario-idem-${String(ordinal).padStart(6, '0')}`,
      addressLine1: address.addressLine1,
      visitTimeIso: new Date(Date.UTC(2026, 0, 15, 14, index % 60, 0)).toISOString(),
      syncStatus: 'synced',
      syncConflictFlag: false,
      syncConflictReason: null,
      notes: index % 7 === 0 ? 'Synthetic revisit sequence' : source.notes
    };
  });

  return { addresses, visits };
}

export function createOperationalScenario(
  name: OperationalScenarioName,
  seed = `operational-${name}`,
  requestedRows?: number
) {
  if (!operationalScenarioNames.includes(name)) {
    throw new Error(`Unknown operational scenario: ${name}`);
  }

  const base = createAdminUiScenario(seed);
  const defaultRows = name === 'bounded-high-volume' ? 2500 : name === 'sync-recovery' ? 15 : name === 'clean-lifecycle' ? 25 : 12;
  const rows = requestedRows ?? defaultRows;
  if (!Number.isSafeInteger(rows) || rows < 1 || rows > 25000) {
    throw new Error('Operational scenario rows must be an integer from 1 through 25000');
  }
  const minimumRows = name === 'sync-recovery' ? 6 : name === 'duplicate-strategies' || name === 'encoding-edge-cases' ? 2 : 1;
  if (rows < minimumRows) {
    throw new Error(`${name} requires at least ${minimumRows} rows`);
  }

  const expanded = expandScenario(base, rows);
  const scenarioManifest: {
    name: OperationalScenarioName;
    synthetic: true;
    seed: string;
    expected: Record<string, number>;
  } = {
    name,
    synthetic: true,
    seed,
    expected: { rows, visits: rows, addresses: rows }
  };

  const scenario = {
    ...base,
    addresses: expanded.addresses,
    visits: expanded.visits,
    importBatch: { ...base.importBatch, rowCount: rows, importedCount: rows, pendingReviewCount: 0 },
    scenarioManifest
  };

  if (name === 'duplicate-strategies') {
    scenario.addresses[1] = {
      ...scenario.addresses[1],
      addressLine1: scenario.addresses[0].addressLine1,
      addressLine2: scenario.addresses[0].addressLine2,
      unit: scenario.addresses[0].unit,
      city: scenario.addresses[0].city,
      state: scenario.addresses[0].state,
      zip: scenario.addresses[0].zip,
      vanHouseholdId: scenario.addresses[0].vanHouseholdId,
      vanPersonId: scenario.addresses[0].vanPersonId,
      vanId: scenario.addresses[0].vanId
    };
    scenario.visits[1] = {
      ...scenario.visits[1],
      addressLine1: scenario.addresses[0].addressLine1
    };
    scenario.importBatch = { ...scenario.importBatch, importedCount: rows - 1, pendingReviewCount: 1 };
    scenario.scenarioManifest.expected = { ...scenario.scenarioManifest.expected, duplicateRows: 1 };
  }

  if (name === 'encoding-edge-cases') {
    scenario.addresses[0] = {
      ...scenario.addresses[0],
      addressLine1: '001 Café Fixture Way',
      addressLine2: 'Quoted, Fixture Building',
      unit: 'Mock Unit 01',
      zip: '00123'
    };
    scenario.visits[0] = { ...scenario.visits[0], addressLine1: scenario.addresses[0].addressLine1, notes: 'Quoted fixture, with comma' };
    scenario.visits[1] = { ...scenario.visits[1], notes: 'Multiline fixture\nsecond synthetic line' };
  }

  if (name === 'sync-recovery') {
    scenario.visits[0] = { ...scenario.visits[0], syncStatus: 'pending' };
    scenario.visits[1] = { ...scenario.visits[1], syncStatus: 'failed' };
    scenario.visits[2] = {
      ...scenario.visits[2],
      syncStatus: 'conflict',
      syncConflictFlag: true,
      syncConflictReason: 'payload_mismatch',
      gpsStatus: 'flagged',
      geofenceValidated: false
    };
    scenario.visits[3] = { ...scenario.visits[3], gpsStatus: 'low_accuracy', geofenceValidated: false };
    scenario.visits[4] = { ...scenario.visits[4], gpsStatus: 'missing', geofenceValidated: false };
    scenario.visits[5] = { ...scenario.visits[5], notes: 'Synthetic correction after reconnect' };
    scenario.scenarioManifest.expected = {
      ...scenario.scenarioManifest.expected,
      pendingSyncs: 1,
      failedSyncs: 1,
      syncConflicts: 1
    };
  }

  return scenario;
}
