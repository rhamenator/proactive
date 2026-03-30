export type CsvMapping = Partial<Record<CsvField, string>>;

export type CsvField =
  | 'vanId'
  | 'vanPersonId'
  | 'vanHouseholdId'
  | 'addressLine1'
  | 'addressLine2'
  | 'unit'
  | 'city'
  | 'state'
  | 'zip'
  | 'latitude'
  | 'longitude'
  | 'turfName';

export const canonicalAliases: Record<CsvField, string[]> = {
  vanId: ['van_id', 'vanid', 'id', 'recordid'],
  vanPersonId: ['van_person_id', 'personid', 'person_id', 'voterid'],
  vanHouseholdId: ['van_household_id', 'householdid', 'household_id'],
  addressLine1: ['address_line1', 'address1', 'street', 'street_address', 'address'],
  addressLine2: ['address_line2', 'address2', 'street2', 'address_line_2'],
  unit: ['unit', 'apt', 'apartment', 'suite', 'unit_number'],
  city: ['city', 'town'],
  state: ['state', 'province'],
  zip: ['zip', 'zipcode', 'postal', 'postalcode'],
  latitude: ['latitude', 'lat'],
  longitude: ['longitude', 'lng', 'lon'],
  turfName: ['turf_name', 'turf', 'district']
};

export function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function toOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function resolveMappedValue(
  row: Record<string, unknown>,
  field: CsvField,
  mapping?: CsvMapping
): string | undefined {
  const mappedHeader = mapping?.[field];
  if (mappedHeader) {
    const direct = row[mappedHeader];
    if (direct !== undefined && direct !== null && String(direct).trim() !== '') {
      return String(direct).trim();
    }
  }

  for (const [header, value] of Object.entries(row)) {
    const normalizedHeader = normalizeHeader(header);
    if (canonicalAliases[field].some((alias) => normalizedHeader === normalizeHeader(alias))) {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
  }

  return undefined;
}

export function inferMappingFromHeaders(headers: string[]): CsvMapping {
  const normalizedHeaders = headers.map((header) => ({
    header,
    normalized: normalizeHeader(header)
  }));

  const mapping: CsvMapping = {};
  for (const field of Object.keys(canonicalAliases) as CsvField[]) {
    const match = normalizedHeaders.find((candidate) =>
      canonicalAliases[field].some((alias) => candidate.normalized === normalizeHeader(alias))
    );
    if (match) {
      mapping[field] = match.header;
    }
  }

  return mapping;
}
