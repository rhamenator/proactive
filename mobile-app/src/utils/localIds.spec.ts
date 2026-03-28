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

  it('falls back to an RFC4122-like id when crypto.randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {});
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    expect(createLocalRecordUuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
