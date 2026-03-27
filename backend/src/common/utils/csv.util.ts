export type CsvMapping = Partial<Record<CsvField, string>>;

export type CsvField =
  | 'vanId'
  | 'addressLine1'
  | 'city'
  | 'state'
  | 'zip'
  | 'latitude'
  | 'longitude'
  | 'turfName';

const canonicalAliases: Record<CsvField, string[]> = {
  vanId: ['van_id', 'vanid', 'id', 'recordid'],
  addressLine1: ['address_line1', 'address1', 'street', 'street_address', 'address'],
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
