export function formatLocalDateTime(value: string | Date | null | undefined) {
  if (!value) {
    return 'Unavailable';
  }

  const date = value instanceof Date ? value : new Date(value);
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZoneName: 'short'
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  }
}

export function getLocalTimeZoneLabel() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time';
}
