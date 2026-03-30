type VisitAttemptSeed = {
  id: string;
  turfId: string;
  addressId: string;
  visitTime: Date;
};

export function attachVisitAttemptMetrics<T extends VisitAttemptSeed>(visits: T[]) {
  const sorted = [...visits].sort((left, right) => {
    if (left.turfId !== right.turfId) {
      return left.turfId.localeCompare(right.turfId);
    }
    if (left.addressId !== right.addressId) {
      return left.addressId.localeCompare(right.addressId);
    }
    const timeDelta = left.visitTime.getTime() - right.visitTime.getTime();
    if (timeDelta !== 0) {
      return timeDelta;
    }
    return left.id.localeCompare(right.id);
  });

  const attemptMap = new Map<string, { attemptNumber: number; isRevisit: boolean }>();
  const addressCounts = new Map<string, number>();

  for (const visit of sorted) {
    const key = `${visit.turfId}:${visit.addressId}`;
    const nextAttemptNumber = (addressCounts.get(key) ?? 0) + 1;
    addressCounts.set(key, nextAttemptNumber);
    attemptMap.set(visit.id, {
      attemptNumber: nextAttemptNumber,
      isRevisit: nextAttemptNumber > 1
    });
  }

  return visits.map((visit) => ({
    ...visit,
    ...(attemptMap.get(visit.id) ?? { attemptNumber: 1, isRevisit: false })
  }));
}

export function getTimeOfDayBucket(value: Date) {
  const hour = value.getHours();
  if (hour < 6) {
    return 'overnight';
  }
  if (hour < 12) {
    return 'morning';
  }
  if (hour < 17) {
    return 'afternoon';
  }
  if (hour < 21) {
    return 'evening';
  }
  return 'late_evening';
}

export function getDayOfWeekBucket(value: Date) {
  return value.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Detroit' });
}
