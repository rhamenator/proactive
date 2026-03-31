const FALLBACK_TIME_ZONE = 'UTC';
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeTimeZone(value: string | undefined, fallback: string) {
  const candidate = value?.trim();
  return candidate && candidate.length > 0 ? candidate : fallback;
}

export const CANONICAL_STORAGE_TIME_ZONE = FALLBACK_TIME_ZONE;
export const REPORT_BUCKET_TIME_ZONE = normalizeTimeZone(process.env.REPORT_BUCKET_TIME_ZONE, CANONICAL_STORAGE_TIME_ZONE);
export const EXPORT_TIME_ZONE = normalizeTimeZone(process.env.EXPORT_TIME_ZONE, CANONICAL_STORAGE_TIME_ZONE);

function getTimeZoneValue(value: string | undefined) {
  return normalizeTimeZone(value, CANONICAL_STORAGE_TIME_ZONE);
}

function formatParts(value: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  return Object.fromEntries(
    formatter
      .formatToParts(value)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  ) as Record<string, string>;
}

function getOffsetMinutes(value: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });
  const offset = formatter.formatToParts(value).find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';

  if (offset === 'GMT' || offset === 'UTC') {
    return 0;
  }

  const match = offset.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) {
    return 0;
  }

  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number.parseInt(match[2] ?? '0', 10);
  const minutes = Number.parseInt(match[3] ?? '0', 10);
  return sign * (hours * 60 + minutes);
}

function formatOffset(offsetMinutes: number) {
  if (offsetMinutes === 0) {
    return 'Z';
  }

  const sign = offsetMinutes < 0 ? '-' : '+';
  const absolute = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, '0');
  const minutes = String(absolute % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

function zonedDateTimeToUtc(
  input: { year: number; month: number; day: number; hour: number; minute: number; second: number; millisecond: number },
  timeZone: string
) {
  const naiveUtc = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour,
    input.minute,
    input.second,
    input.millisecond
  );

  let candidate = naiveUtc;
  for (let index = 0; index < 3; index += 1) {
    const offsetMinutes = getOffsetMinutes(new Date(candidate), timeZone);
    const nextCandidate = naiveUtc - offsetMinutes * 60 * 1000;
    if (nextCandidate === candidate) {
      break;
    }
    candidate = nextCandidate;
  }

  return new Date(candidate);
}

export function getReportBucketTimeZone() {
  return getTimeZoneValue(process.env.REPORT_BUCKET_TIME_ZONE);
}

export function getExportTimeZone() {
  return getTimeZoneValue(process.env.EXPORT_TIME_ZONE);
}

export function isDateOnlyInput(value: string) {
  return DATE_ONLY_PATTERN.test(value);
}

export function getReportBucketDate(value: Date) {
  if (getReportBucketTimeZone() === CANONICAL_STORAGE_TIME_ZONE) {
    return value.toISOString().slice(0, 10);
  }

  const parts = formatParts(value, getReportBucketTimeZone());
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getReportDateBoundary(value: string, boundary: 'start' | 'end') {
  if (!isDateOnlyInput(value)) {
    return new Date(value);
  }

  const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10));
  return zonedDateTimeToUtc(
    {
      year,
      month,
      day,
      hour: boundary === 'start' ? 0 : 23,
      minute: boundary === 'start' ? 0 : 59,
      second: boundary === 'start' ? 0 : 59,
      millisecond: boundary === 'start' ? 0 : 999
    },
    getReportBucketTimeZone()
  );
}

export function getExportTimeZoneLabel() {
  return getExportTimeZone();
}

export function formatExportTimestamp(value: Date) {
  const exportTimeZone = getExportTimeZone();
  if (exportTimeZone === CANONICAL_STORAGE_TIME_ZONE) {
    return value.toISOString();
  }

  const values = formatParts(value, exportTimeZone);
  const offset = formatOffset(getOffsetMinutes(value, exportTimeZone));

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}${offset}`;
}

export function getBucketHour(value: Date) {
  const reportBucketTimeZone = getReportBucketTimeZone();
  if (reportBucketTimeZone === CANONICAL_STORAGE_TIME_ZONE) {
    return value.getUTCHours();
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: reportBucketTimeZone,
    hour: '2-digit',
    hourCycle: 'h23'
  });
  const hourPart = formatter.formatToParts(value).find((part) => part.type === 'hour')?.value;
  const parsed = Number.parseInt(hourPart ?? '', 10);
  return Number.isNaN(parsed) ? value.getUTCHours() : parsed;
}

export function getBucketWeekday(value: Date) {
  return value.toLocaleDateString('en-US', { weekday: 'long', timeZone: getReportBucketTimeZone() });
}
