function normalizeFilenameSegment(value: string) {
  return value
    .replace(/[\r\n"]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '');
}

export function sanitizeFilenamePrefix(value: unknown, fallback: string) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = normalizeFilenameSegment(value.trim());
  return normalized || fallback;
}

export function buildTimestampedCsvFilename(prefix: unknown, fallback: string) {
  const timestamp = new Date().toISOString().replace(/[:]/g, '-').replace(/\.\d{3}Z$/, 'Z');
  return `${sanitizeFilenamePrefix(prefix, fallback)}-${timestamp}.csv`;
}
