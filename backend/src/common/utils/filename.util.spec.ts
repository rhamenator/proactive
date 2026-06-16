import { buildTimestampedCsvFilename, sanitizeFilenamePrefix } from './filename.util';

describe('filename utils', () => {
  it('sanitizes dangerous filename prefix characters', () => {
    expect(sanitizeFilenamePrefix(' report"\r\nx-test: injected ', 'fallback')).toBe('reportx-test-injected');
  });

  it('falls back when sanitization removes the entire prefix', () => {
    expect(sanitizeFilenamePrefix('\r\n""', 'fallback')).toBe('fallback');
  });

  it('builds timestamped csv filenames from sanitized prefixes', () => {
    const result = buildTimestampedCsvFilename('van results', 'fallback');

    expect(result).toMatch(/^van-results-\d{4}-\d{2}-\d{2}T.*\.csv$/);
  });
});
