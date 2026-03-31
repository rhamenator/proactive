import { attachVisitAttemptMetrics, getDayOfWeekBucket, getTimeOfDayBucket } from './visit-analytics.util';

describe('visit analytics utilities', () => {
  const originalReportBucketTimeZone = process.env.REPORT_BUCKET_TIME_ZONE;

  afterEach(() => {
    if (originalReportBucketTimeZone === undefined) {
      delete process.env.REPORT_BUCKET_TIME_ZONE;
    } else {
      process.env.REPORT_BUCKET_TIME_ZONE = originalReportBucketTimeZone;
    }
  });

  it('computes attempt numbers from full history rather than only the filtered subset', () => {
    const filteredVisits = [
      {
        id: 'visit-2',
        turfId: 'turf-1',
        addressId: 'address-1',
        visitTime: new Date('2026-03-30T15:00:00.000Z')
      }
    ];
    const history = [
      {
        id: 'visit-1',
        turfId: 'turf-1',
        addressId: 'address-1',
        visitTime: new Date('2026-03-29T15:00:00.000Z')
      },
      ...filteredVisits
    ];

    const [result] = attachVisitAttemptMetrics(filteredVisits, history);

    expect(result.attemptNumber).toBe(2);
    expect(result.isRevisit).toBe(true);
  });

  it('uses UTC bucketing by default so results are stable across runtime timezones', () => {
    const value = new Date('2026-03-30T23:30:00-07:00');

    expect(getTimeOfDayBucket(value)).toBe('morning');
    expect(getDayOfWeekBucket(value)).toBe('Tuesday');
  });

  it('uses configured report timezone for time-of-day and weekday buckets', () => {
    process.env.REPORT_BUCKET_TIME_ZONE = 'America/Detroit';

    const value = new Date('2026-03-30T02:30:00.000Z');

    expect(getTimeOfDayBucket(value)).toBe('late_evening');
    expect(getDayOfWeekBucket(value)).toBe('Sunday');
  });

  it('assigns attempt numbers to multiple visits at the same address in chronological order', () => {
    const visits = [
      {
        id: 'visit-3',
        turfId: 'turf-1',
        addressId: 'address-1',
        visitTime: new Date('2026-03-30T17:00:00.000Z')
      },
      {
        id: 'visit-1',
        turfId: 'turf-1',
        addressId: 'address-1',
        visitTime: new Date('2026-03-28T09:00:00.000Z')
      },
      {
        id: 'visit-2',
        turfId: 'turf-1',
        addressId: 'address-1',
        visitTime: new Date('2026-03-29T14:00:00.000Z')
      }
    ];

    const result = attachVisitAttemptMetrics(visits, visits);

    const byId = Object.fromEntries(result.map((v) => [v.id, v]));
    expect(byId['visit-1'].attemptNumber).toBe(1);
    expect(byId['visit-1'].isRevisit).toBe(false);
    expect(byId['visit-2'].attemptNumber).toBe(2);
    expect(byId['visit-2'].isRevisit).toBe(true);
    expect(byId['visit-3'].attemptNumber).toBe(3);
    expect(byId['visit-3'].isRevisit).toBe(true);
  });
});
