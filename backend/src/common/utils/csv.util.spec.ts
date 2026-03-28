import { normalizeHeader, resolveMappedValue, toOptionalNumber } from './csv.util';

describe('csv.util', () => {
  it('normalizes headers to lowercase alphanumeric tokens', () => {
    expect(normalizeHeader('Address Line 1')).toBe('addressline1');
  });

  it('parses optional numbers and ignores blanks or non-numbers', () => {
    expect(toOptionalNumber('42.5')).toBe(42.5);
    expect(toOptionalNumber('')).toBeUndefined();
    expect(toOptionalNumber('nope')).toBeUndefined();
  });

  it('resolves mapped values before falling back to canonical aliases', () => {
    const row = {
      Address: '100 Main St',
      City: 'Detroit',
      CustomZip: '48201'
    };

    expect(
      resolveMappedValue(row, 'zip', {
        zip: 'CustomZip'
      })
    ).toBe('48201');
    expect(resolveMappedValue(row, 'addressLine1')).toBe('100 Main St');
    expect(resolveMappedValue(row, 'state')).toBeUndefined();
  });
});
