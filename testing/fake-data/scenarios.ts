import { createFixtureFactory } from './factories';

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
