export function formatLocalDateTime(value: string | Date | null | undefined) {
  if (!value) {
    return 'Unavailable';
  }

  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZoneName: 'short'
  }).format(date);
}

export function getLocalTimeZoneLabel() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time';
}
