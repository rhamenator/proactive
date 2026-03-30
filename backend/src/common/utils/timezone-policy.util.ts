const FALLBACK_TIME_ZONE = 'UTC';

function normalizeTimeZone(value: string | undefined, fallback: string) {
  const candidate = value?.trim();
  return candidate && candidate.length > 0 ? candidate : fallback;
}

export const CANONICAL_STORAGE_TIME_ZONE = FALLBACK_TIME_ZONE;
export const REPORT_BUCKET_TIME_ZONE = normalizeTimeZone(process.env.REPORT_BUCKET_TIME_ZONE, CANONICAL_STORAGE_TIME_ZONE);
export const EXPORT_TIME_ZONE = normalizeTimeZone(process.env.EXPORT_TIME_ZONE, CANONICAL_STORAGE_TIME_ZONE);

export function getExportTimeZoneLabel() {
  return EXPORT_TIME_ZONE;
}

export function formatExportTimestamp(value: Date) {
  if (EXPORT_TIME_ZONE === CANONICAL_STORAGE_TIME_ZONE) {
    return value.toISOString();
  }

  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: EXPORT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });
  const parts = formatter.formatToParts(value);
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`;
}

export function getBucketHour(value: Date) {
  if (REPORT_BUCKET_TIME_ZONE === CANONICAL_STORAGE_TIME_ZONE) {
    return value.getUTCHours();
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: REPORT_BUCKET_TIME_ZONE,
    hour: '2-digit',
    hourCycle: 'h23'
  });
  const hourPart = formatter.formatToParts(value).find((part) => part.type === 'hour')?.value;
  const parsed = Number.parseInt(hourPart ?? '', 10);
  return Number.isNaN(parsed) ? value.getUTCHours() : parsed;
}

export function getBucketWeekday(value: Date) {
  return value.toLocaleDateString('en-US', { weekday: 'long', timeZone: REPORT_BUCKET_TIME_ZONE });
}
