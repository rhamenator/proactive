import { getDistanceInMeters } from './distance.util';

describe('getDistanceInMeters', () => {
  it('returns near-zero distance for identical coordinates', () => {
    expect(getDistanceInMeters(42, -85, 42, -85)).toBeCloseTo(0, 5);
  });

  it('returns approximately one degree of latitude in meters', () => {
    expect(getDistanceInMeters(0, 0, 1, 0)).toBeGreaterThan(110000);
    expect(getDistanceInMeters(0, 0, 1, 0)).toBeLessThan(112500);
  });
});
