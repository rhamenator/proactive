import iconv from 'iconv-lite';

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
  | 'turfName'
  | 'geographyExternalId';

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
  turfName: ['turf_name', 'turf', 'district'],
  geographyExternalId: ['geography_external_id', 'geography_id', 'geography_code', 'scope_code']
};

/**
 * Decodes an uploaded CSV file to a string, falling back to Windows-1252 when
 * the bytes aren't valid UTF-8 (common for "CSV (Comma delimited)" exports
 * from Excel on Windows, which use the system codepage rather than UTF-8 and
 * would otherwise corrupt accented names/addresses into replacement chars).
 * Also strips a leading UTF-8 BOM (common in "CSV UTF-8" exports).
 */
export function decodeCsvBuffer(buffer: Buffer): string {
  let decoded: string;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    decoded = iconv.decode(buffer, 'windows-1252');
  }
  return decoded.charCodeAt(0) === 0xfeff ? decoded.slice(1) : decoded;
}

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
