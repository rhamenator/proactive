import iconv from 'iconv-lite';
import { decodeCsvBuffer, normalizeHeader, resolveMappedValue, toOptionalNumber } from './csv.util';

describe('csv.util', () => {
  it('normalizes headers to lowercase alphanumeric tokens', () => {
    expect(normalizeHeader('Address Line 1')).toBe('addressline1');
  });

  it('decodes plain UTF-8 CSV content unchanged', () => {
    const buffer = Buffer.from('addressLine1,city\n100 Main St,Detroit\n', 'utf8');
    expect(decodeCsvBuffer(buffer)).toBe('addressLine1,city\n100 Main St,Detroit\n');
  });

  it('strips a leading UTF-8 BOM', () => {
    const buffer = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('addressLine1,city\n', 'utf8')]);
    expect(decodeCsvBuffer(buffer)).toBe('addressLine1,city\n');
  });

  it('falls back to Windows-1252 when the bytes are not valid UTF-8', () => {
    const original = 'José Muñoz,café Street';
    const buffer = iconv.encode(original, 'windows-1252');
    expect(decodeCsvBuffer(buffer)).toBe(original);
  });

  it('preserves a literal replacement character in otherwise-valid UTF-8', () => {
    const original = 'José � Muñoz,café Street';
    expect(decodeCsvBuffer(Buffer.from(original, 'utf8'))).toBe(original);
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
