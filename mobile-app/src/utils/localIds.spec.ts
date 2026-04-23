import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLocalRecordUuid } from './localIds';

describe('createLocalRecordUuid', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses crypto.randomUUID when available', () => {
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => 'uuid-from-crypto')
    });

    expect(createLocalRecordUuid()).toBe('uuid-from-crypto');
  });

  it('falls back to crypto.getRandomValues when crypto.randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: vi.fn((bytes: Uint8Array) => {
        bytes.fill(0xaa);
        return bytes;
      })
    });

    expect(createLocalRecordUuid()).toBe('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
  });

  it('throws when secure random UUID generation is unavailable', () => {
    vi.stubGlobal('crypto', {});

    expect(() => createLocalRecordUuid()).toThrow('Secure UUID generation is unavailable');
  });
});
