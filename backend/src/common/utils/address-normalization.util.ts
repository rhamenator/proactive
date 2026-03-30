type AddressKeyInput = {
  addressLine1: string;
  addressLine2?: string | null;
  unit?: string | null;
  city: string;
  state: string;
  zip?: string | null;
};

function normalizeSegment(value: string | null | undefined) {
  if (!value) {
    return '';
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeZip(value: string | null | undefined) {
  if (!value) {
    return '';
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function buildNormalizedAddressKey(input: AddressKeyInput) {
  return [
    normalizeSegment(input.addressLine1),
    normalizeSegment(input.addressLine2),
    normalizeSegment(input.unit),
    normalizeSegment(input.city),
    normalizeSegment(input.state),
    normalizeZip(input.zip)
  ].join('|');
}

export function composeDisplayAddressLine1(input: {
  addressLine1: string;
  addressLine2?: string | null;
  unit?: string | null;
}) {
  return [input.addressLine1.trim(), input.addressLine2?.trim(), input.unit?.trim()].filter(Boolean).join(', ');
}
