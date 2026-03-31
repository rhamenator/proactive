export type Role = 'admin' | 'supervisor' | 'canvasser';

export type FactoryDefaults = {
  seed: string;
  organizationCode: string;
};

export type OrganizationFixture = {
  code: string;
  name: string;
};

export type CampaignFixture = {
  code: string;
  name: string;
  isActive: boolean;
};

export type TeamFixture = {
  code: string;
  name: string;
  regionCode: string;
};

export type UserFixture = {
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  status: 'active';
  mfaEnabled: boolean;
  teamCode?: string;
  campaignCode?: string;
};

export type TurfFixture = {
  code: string;
  name: string;
  description: string;
  teamCode: string;
  regionCode: string;
  campaignCode: string;
};

export type HouseholdFixture = {
  addressLine1: string;
  addressLine2: string | null;
  unit: string | null;
  city: string;
  state: string;
  zip: string;
  vanHouseholdId: string;
  vanPersonId: string;
  latitude: number;
  longitude: number;
};

export type AddressFixture = HouseholdFixture & {
  turfCode: string;
  vanId: string;
};

export type SessionFixture = {
  turfCode: string;
  canvasserEmail: string;
  startTimeIso: string;
  endTimeIso: string | null;
  status: 'active' | 'paused' | 'ended';
};

export type VisitFixture = {
  localRecordUuid: string;
  idempotencyKey: string;
  turfCode: string;
  canvasserEmail: string;
  addressLine1: string;
  visitTimeIso: string;
  result: 'knocked' | 'talked_to_voter' | 'not_home' | 'refused' | 'lit_drop' | 'other';
  outcomeCode: string;
  outcomeLabel: string;
  contactMade: boolean;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';
  syncConflictFlag: boolean;
  syncConflictReason: string | null;
  gpsStatus: 'verified' | 'flagged' | 'missing' | 'low_accuracy';
  geofenceValidated: boolean;
  notes: string | null;
};

export type GeofenceFixture = {
  visitLocalRecordUuid: string;
  gpsStatus: 'verified' | 'flagged' | 'missing' | 'low_accuracy';
  failureReason: string | null;
  overrideFlag: boolean;
};

export type ImportFixture = {
  filename: string;
  mode: 'create_only' | 'upsert' | 'replace_turf_membership';
  duplicateStrategy: 'skip' | 'error' | 'merge' | 'review';
  rowCount: number;
  importedCount: number;
  pendingReviewCount: number;
};

export type ExportFixture = {
  filename: string;
  profileCode: string;
  profileName: string;
  markExported: boolean;
};

export type AddressRequestFixture = {
  turfCode: string;
  requestedByEmail: string;
  status: 'pending' | 'approved' | 'rejected';
  addressLine1: string;
  addressLine2: string | null;
  unit: string | null;
  city: string;
  state: string;
  zip: string | null;
  notes: string | null;
  reviewReason: string | null;
};

function hash(input: string) {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(16).padStart(8, '0');
}

function fromSeed(seed: string, key: string) {
  return `${seed}-${hash(`${seed}:${key}`)}`;
}

function toEmail(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
}

export function createFixtureFactory(defaults: FactoryDefaults) {
  const seed = defaults.seed;

  function organization(overrides?: Partial<OrganizationFixture>): OrganizationFixture {
    return {
      code: defaults.organizationCode,
      name: `PROACTIVE ${seed.toUpperCase()} Org`,
      ...overrides
    };
  }

  function campaign(label: string, overrides?: Partial<CampaignFixture>): CampaignFixture {
    return {
      code: toEmail(`${label}-${fromSeed(seed, `campaign:${label}`)}`).slice(0, 24),
      name: label,
      isActive: true,
      ...overrides
    };
  }

  function team(label: string, overrides?: Partial<TeamFixture>): TeamFixture {
    const codeBase = toEmail(`${label}-${fromSeed(seed, `team:${label}`)}`).replace(/\./g, '_').toUpperCase();
    return {
      code: codeBase.slice(0, 18),
      name: `${label} Team`,
      regionCode: `REG-${hash(`${seed}:${label}`).slice(0, 4).toUpperCase()}`,
      ...overrides
    };
  }

  function user(label: string, role: Role, overrides?: Partial<UserFixture>): UserFixture {
    const safe = toEmail(label);
    return {
      firstName: label,
      lastName: role === 'admin' ? 'Admin' : role === 'supervisor' ? 'Supervisor' : 'Canvasser',
      email: `${safe}.${role}.${hash(`${seed}:${label}:${role}`).slice(0, 6)}@example.test`,
      role,
      status: 'active',
      mfaEnabled: role !== 'canvasser',
      ...overrides
    };
  }

  function turf(label: string, teamCode: string, campaignCode: string, overrides?: Partial<TurfFixture>): TurfFixture {
    return {
      code: toEmail(`${label}-${seed}`).slice(0, 20),
      name: `${label} Turf`,
      description: `${label} seeded turf`,
      teamCode,
      regionCode: `REG-${hash(`${seed}:${label}:turf`).slice(0, 4).toUpperCase()}`,
      campaignCode,
      ...overrides
    };
  }

  function household(index: number, overrides?: Partial<HouseholdFixture>): HouseholdFixture {
    const baseStreet = 100 + index;
    return {
      addressLine1: `${baseStreet} Main St`,
      addressLine2: index % 2 === 0 ? `Apt ${index}` : null,
      unit: index % 2 === 0 ? String(index) : null,
      city: 'Grand Rapids',
      state: 'MI',
      zip: '49503',
      vanHouseholdId: `HH-${seed.toUpperCase()}-${index}`,
      vanPersonId: `P-${seed.toUpperCase()}-${index}`,
      latitude: 42.96 + index * 0.001,
      longitude: -85.67 - index * 0.001,
      ...overrides
    };
  }

  function address(index: number, turfCode: string, overrides?: Partial<AddressFixture>): AddressFixture {
    const base = household(index);
    return {
      ...base,
      turfCode,
      vanId: `VAN-${seed.toUpperCase()}-${index}`,
      ...overrides
    };
  }

  function session(index: number, turfCode: string, canvasserEmail: string, overrides?: Partial<SessionFixture>): SessionFixture {
    const start = new Date(Date.UTC(2026, 2, 30, 12 + index, 0, 0));
    return {
      turfCode,
      canvasserEmail,
      startTimeIso: start.toISOString(),
      endTimeIso: new Date(start.getTime() + 45 * 60 * 1000).toISOString(),
      status: 'ended',
      ...overrides
    };
  }

  function visit(index: number, turfCode: string, canvasserEmail: string, addressLine1: string, overrides?: Partial<VisitFixture>): VisitFixture {
    const visitTime = new Date(Date.UTC(2026, 2, 30, 10 + index, 30, 0));
    return {
      localRecordUuid: `${seed}-local-${index}`,
      idempotencyKey: `${seed}-idem-${index}`,
      turfCode,
      canvasserEmail,
      addressLine1,
      visitTimeIso: visitTime.toISOString(),
      result: index % 3 === 0 ? 'talked_to_voter' : 'knocked',
      outcomeCode: index % 3 === 0 ? 'talked_to_voter' : 'knocked',
      outcomeLabel: index % 3 === 0 ? 'Talked To Voter' : 'Knocked',
      contactMade: index % 3 === 0,
      syncStatus: 'synced',
      syncConflictFlag: false,
      syncConflictReason: null,
      gpsStatus: index % 4 === 0 ? 'flagged' : 'verified',
      geofenceValidated: index % 4 !== 0,
      notes: index % 3 === 0 ? 'Spoke with voter' : null,
      ...overrides
    };
  }

  function geofence(visitLocalRecordUuid: string, overrides?: Partial<GeofenceFixture>): GeofenceFixture {
    return {
      visitLocalRecordUuid,
      gpsStatus: 'verified',
      failureReason: null,
      overrideFlag: false,
      ...overrides
    };
  }

  function importBatch(overrides?: Partial<ImportFixture>): ImportFixture {
    return {
      filename: `import-${seed}.csv`,
      mode: 'replace_turf_membership',
      duplicateStrategy: 'review',
      rowCount: 12,
      importedCount: 10,
      pendingReviewCount: 2,
      ...overrides
    };
  }

  function exportBatch(overrides?: Partial<ExportFixture>): ExportFixture {
    return {
      filename: `van-results-${seed}.csv`,
      profileCode: 'van_compatible',
      profileName: 'VAN Compatible',
      markExported: true,
      ...overrides
    };
  }

  function addressRequest(overrides?: Partial<AddressRequestFixture>): AddressRequestFixture {
    return {
      turfCode: `turf-${seed}`,
      requestedByEmail: `${seed}.canvasser@example.test`,
      status: 'pending',
      addressLine1: '999 Added St',
      addressLine2: 'Unit A',
      unit: 'A',
      city: 'Grand Rapids',
      state: 'MI',
      zip: '49503',
      notes: 'Added during field walk',
      reviewReason: null,
      ...overrides
    };
  }

  return {
    organization,
    campaign,
    team,
    user,
    turf,
    household,
    address,
    session,
    visit,
    geofence,
    importBatch,
    exportBatch,
    addressRequest
  };
}
