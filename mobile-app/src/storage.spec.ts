import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbState = {
  kv: new Map<string, string | null>(),
  queue: new Map<
    string,
    {
      createdAt: string;
      syncStatus: string;
      payloadJson: string;
      addressMetaJson: string;
    }
  >(),
  addressState: new Map<string, string>(),
  sessionNotes: new Map<
    string,
    {
      turfId: string;
      sessionId: string | null;
      createdAt: string;
      updatedAt: string;
      addressText: string | null;
      noteText: string;
    }
  >()
};

const databaseMock = {
  execAsync: vi.fn(async () => {}),
  withExclusiveTransactionAsync: vi.fn(async (task: (txn: typeof databaseMock) => Promise<void>) => {
    await task(databaseMock);
  }),
  runAsync: vi.fn(async (source: string, ...params: Array<string | null>) => {
    if (source.includes('INSERT OR REPLACE INTO kv_store')) {
      dbState.kv.set(String(params[0]), params[1] ?? null);
      return;
    }
    if (source.includes('DELETE FROM kv_store WHERE key IN')) {
      dbState.kv.delete(String(params[0]));
      dbState.kv.delete(String(params[1]));
      return;
    }
    if (source.includes('DELETE FROM queued_visits')) {
      dbState.queue.clear();
      return;
    }
    if (source.includes('DELETE FROM address_state')) {
      dbState.addressState.clear();
      return;
    }
    if (source.includes('DELETE FROM session_notes WHERE id = ?')) {
      dbState.sessionNotes.delete(String(params[0]));
      return;
    }
    if (source.includes('DELETE FROM session_notes')) {
      dbState.sessionNotes.clear();
      return;
    }
    if (source.includes('INSERT INTO queued_visits') || source.includes('INSERT OR REPLACE INTO queued_visits')) {
      dbState.queue.set(String(params[0]), {
        createdAt: String(params[1]),
        syncStatus: String(params[2]),
        payloadJson: String(params[3]),
        addressMetaJson: String(params[4])
      });
      return;
    }
    if (source.includes('INSERT INTO address_state') || source.includes('INSERT OR REPLACE INTO address_state')) {
      dbState.addressState.set(String(params[0]), String(params[1]));
      return;
    }
    if (source.includes('INSERT INTO session_notes') || source.includes('INSERT OR REPLACE INTO session_notes')) {
      dbState.sessionNotes.set(String(params[0]), {
        turfId: String(params[1]),
        sessionId: typeof params[2] === 'string' ? params[2] : null,
        createdAt: String(params[3]),
        updatedAt: String(params[4]),
        addressText: typeof params[5] === 'string' ? params[5] : null,
        noteText: String(params[6])
      });
      return;
    }
    throw new Error(`Unexpected SQL in runAsync: ${source}`);
  }),
  getFirstAsync: vi.fn(async (source: string, ...params: Array<string>) => {
    if (source.includes('SELECT value FROM kv_store')) {
      const value = dbState.kv.get(String(params[0]));
      return value === undefined ? null : { value };
    }
    throw new Error(`Unexpected SQL in getFirstAsync: ${source}`);
  }),
  getAllAsync: vi.fn(async (source: string) => {
    if (source.includes('FROM queued_visits')) {
      return Array.from(dbState.queue.entries())
        .sort((a, b) => a[1].createdAt.localeCompare(b[1].createdAt))
        .map(([localRecordUuid, value]) => ({
          local_record_uuid: localRecordUuid,
          created_at: value.createdAt,
          sync_status: value.syncStatus,
          payload_json: value.payloadJson,
          address_meta_json: value.addressMetaJson
        }));
    }
    if (source.includes('FROM address_state')) {
      return Array.from(dbState.addressState.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([addressId, stateJson]) => ({
          address_id: addressId,
          state_json: stateJson
        }));
    }
    if (source.includes('FROM session_notes')) {
      return Array.from(dbState.sessionNotes.entries())
        .sort((a, b) => b[1].createdAt.localeCompare(a[1].createdAt))
        .map(([id, value]) => ({
          id,
          turf_id: value.turfId,
          session_id: value.sessionId,
          created_at: value.createdAt,
          updated_at: value.updatedAt,
          address_text: value.addressText,
          note_text: value.noteText
        }));
    }
    throw new Error(`Unexpected SQL in getAllAsync: ${source}`);
  })
};

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(async () => databaseMock)
}));

import {
  clearAppCache,
  clearSession,
  deleteSessionNote,
  loadAddressState,
  loadQueue,
  loadSessionNotes,
  loadSession,
  saveSessionNote,
  saveAddressState,
  saveQueue,
  saveSession
} from './storage';
import type { AddressState, QueuedVisit, SessionNote, User } from './types';

describe('mobile storage helpers', () => {
  beforeEach(() => {
    dbState.kv.clear();
    dbState.queue.clear();
    dbState.addressState.clear();
    dbState.sessionNotes.clear();
    vi.clearAllMocks();
  });

  it('persists and clears the mobile session in the SQLite store', async () => {
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

  it('persists queue and address-state rows in SQLite and clears the app cache', async () => {
    const addressState: Record<string, AddressState> = {
      'address-1': {
        result: 'talked_to_voter',
        outcomeCode: null,
        submittedAt: '2026-03-28T10:00:00.000Z',
        synced: false,
        syncStatus: 'failed',
        syncConflictReason: null,
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

    expect(await loadQueue()).toEqual([
      expect.objectContaining({
        id: 'local-1',
        localRecordUuid: 'local-1',
        syncStatus: 'failed',
        payload: expect.objectContaining({
          localRecordUuid: 'local-1',
          idempotencyKey: 'local-1',
          turfId: 'turf-1',
          sessionId: 'session-1',
          addressId: 'address-1',
          outcomeCode: 'talked_to_voter',
          contactMade: true,
          gpsStatus: 'flagged'
        }),
        addressMeta: expect.objectContaining({
          addressLine1: '10 Main St',
          city: 'Grand Rapids',
          state: 'MI'
        })
      })
    ]);
    expect(await loadAddressState()).toEqual(addressState);

    await clearAppCache();

    expect(await loadQueue()).toEqual([]);
    expect(await loadAddressState()).toEqual({});
  });

  it('persists and deletes in-session notes in SQLite', async () => {
    const note: SessionNote = {
      id: 'note-1',
      turfId: 'turf-1',
      sessionId: 'session-1',
      createdAt: '2026-03-30T19:30:00.000Z',
      updatedAt: '2026-03-30T19:30:00.000Z',
      addressText: '123 Main St',
      noteText: 'Back porch light was on'
    };

    await saveSessionNote(note);

    expect(await loadSessionNotes('turf-1', 'session-1')).toEqual([note]);

    await deleteSessionNote('note-1');

    expect(await loadSessionNotes('turf-1', 'session-1')).toEqual([]);
  });
});
