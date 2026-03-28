import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    })
  }
}));

import { clearAppCache, clearSession, loadAddressState, loadQueue, loadSession, saveAddressState, saveQueue, saveSession } from './storage';
import type { AddressState, QueuedVisit, User } from './types';

describe('mobile storage helpers', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('persists and clears the mobile session', async () => {
    const user: User = {
      id: 'user-1',
      firstName: 'Casey',
      lastName: 'Canvas',
      email: 'casey@example.com',
      role: 'canvasser'
    };

    await saveSession('token-123', user);

    expect(await loadSession()).toEqual({
      token: 'token-123',
      user,
      queue: [],
      addressState: {}
    });

    await clearSession();

    expect(await loadSession()).toEqual({
      token: null,
      user: null,
      queue: [],
      addressState: {}
    });
  });

  it('normalizes queued visits from persisted legacy payloads', async () => {
    const queue: unknown[] = [
      {
        id: 'legacy-1',
        createdAt: '2026-03-28T10:00:00.000Z',
        syncStatus: 'mystery',
        payload: {
          turfId: 'turf-1',
          addressId: 'address-1',
          result: 'knocked',
          contactMade: true,
          latitude: 42.96,
          longitude: -85.67,
          submittedAt: '2026-03-28T10:01:00.000Z'
        },
        addressMeta: {
          addressLine1: '10 Main St',
          city: 'Grand Rapids',
          state: 'MI',
          zip: '49503',
          vanId: 'VAN-1'
        }
      }
    ];
    storage.set('proactive.mobile.visitQueue', JSON.stringify(queue));

    const result = await loadSession();

    expect(result.queue).toEqual([
      expect.objectContaining({
        id: 'legacy-1',
        localRecordUuid: 'legacy-1',
        syncStatus: 'pending',
        payload: expect.objectContaining({
          localRecordUuid: 'legacy-1',
          idempotencyKey: 'legacy-1',
          gpsStatus: 'verified'
        })
      })
    ]);
  });

  it('persists normalized address state and clears app cache', async () => {
    const addressState: Record<string, AddressState> = {
      'address-1': {
        result: 'talked_to_voter',
        submittedAt: '2026-03-28T10:00:00.000Z',
        synced: false,
        syncStatus: 'failed',
        localRecordUuid: 'local-1',
        clientCreatedAt: '2026-03-28T10:00:00.000Z',
        sessionId: 'session-1',
        gpsStatus: 'flagged',
        accuracyMeters: 12
      }
    };
    const queue: QueuedVisit[] = [
      {
        id: 'local-1',
        localRecordUuid: 'local-1',
        createdAt: '2026-03-28T10:00:00.000Z',
        syncStatus: 'failed',
        payload: {
          localRecordUuid: 'local-1',
          idempotencyKey: 'local-1',
          clientCreatedAt: '2026-03-28T10:00:00.000Z',
          submittedAt: '2026-03-28T10:00:00.000Z',
          turfId: 'turf-1',
          sessionId: 'session-1',
          addressId: 'address-1',
          outcomeCode: 'talked_to_voter',
          contactMade: true,
          gpsStatus: 'flagged',
          capturedAt: '2026-03-28T10:00:00.000Z'
        },
        addressMeta: {
          addressLine1: '10 Main St',
          city: 'Grand Rapids',
          state: 'MI',
          zip: '49503',
          vanId: 'VAN-1'
        }
      }
    ];

    await saveQueue(queue);
    await saveAddressState(addressState);

    expect(await loadAddressState()).toEqual(addressState);

    await clearAppCache();

    expect(await loadQueue()).toEqual([]);
    expect(await loadAddressState()).toEqual({});
  });
});
