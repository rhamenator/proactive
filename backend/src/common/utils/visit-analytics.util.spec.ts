import { attachVisitAttemptMetrics, getDayOfWeekBucket, getTimeOfDayBucket } from './visit-analytics.util';

describe('visit analytics utilities', () => {
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

  it('uses UTC-based bucket calculations so results are stable across runtime timezones', () => {
    const value = new Date('2026-03-30T23:30:00-07:00');

    expect(getTimeOfDayBucket(value)).toBe('morning');
    expect(getDayOfWeekBucket(value)).toBe('Tuesday');
  });

    it('buckets a visit at 06:30 UTC as morning regardless of server locale', () => {
      // 06:30 UTC could be 01:30 local in EST-5 or 02:30 in EDT-4.
      // If getHours() were used instead of getUTCHours(), the bucket would be
      // 'overnight' on a server running in Eastern time.
      const value = new Date('2026-03-30T06:30:00.000Z');

      expect(getTimeOfDayBucket(value)).toBe('morning');
      expect(getDayOfWeekBucket(value)).toBe('Monday');
    });

    it('buckets a visit at 23:45 UTC as late_evening and assigns the correct UTC weekday', () => {
      // A visit at 23:45 UTC on a Monday is still Monday in UTC.
      // In UTC-5 it would already be 18:45 the same local day, still 'evening'.
      // The important thing is that UTC is used consistently.
      const value = new Date('2026-03-30T23:45:00.000Z');

      expect(getTimeOfDayBucket(value)).toBe('late_evening');
      expect(getDayOfWeekBucket(value)).toBe('Monday');
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
