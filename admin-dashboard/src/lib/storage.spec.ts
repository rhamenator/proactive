import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { clearStoredSession, readStoredSession, writeStoredSession } from './storage';
import type { SafeUser } from './types';

describe('admin storage helpers', () => {
  const user: SafeUser = {
    id: 'user-1',
    firstName: 'Alex',
    lastName: 'Admin',
    email: 'alex@example.com',
    role: 'admin',
    status: 'active',
    isActive: true,
    createdAt: '2026-03-28T00:00:00.000Z'
  };

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('writes and reads the stored admin session', () => {
    writeStoredSession('token-123', user);

    expect(readStoredSession()).toEqual({
      token: 'token-123',
      user,
      original: {
        token: null,
        user: null
      }
    });
  });

  it('clears the stored session', () => {
    writeStoredSession('token-123', user);

    clearStoredSession();

    expect(readStoredSession()).toEqual({
      token: null,
      user: null,
      original: {
        token: null,
        user: null
      }
    });
  });
});
