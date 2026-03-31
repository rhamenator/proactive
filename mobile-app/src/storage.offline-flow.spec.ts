import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAdminUiScenario } from '../../testing/fake-data/scenarios';

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
    if (source.includes('DELETE FROM session_notes')) {
      dbState.sessionNotes.clear();
      return;
    }
    if (source.includes('INSERT OR REPLACE INTO queued_visits') || source.includes('INSERT INTO queued_visits')) {
      dbState.queue.set(String(params[0]), {
        createdAt: String(params[1]),
        syncStatus: String(params[2]),
        payloadJson: String(params[3]),
        addressMetaJson: String(params[4])
      });
      return;
    }
    if (source.includes('INSERT OR REPLACE INTO address_state') || source.includes('INSERT INTO address_state')) {
      dbState.addressState.set(String(params[0]), String(params[1]));
      return;
    }
    if (source.includes('INSERT OR REPLACE INTO session_notes') || source.includes('INSERT INTO session_notes')) {
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
      return Array.from(dbState.addressState.entries()).map(([addressId, stateJson]) => ({
        address_id: addressId,
        state_json: stateJson
      }));
    }
    if (source.includes('FROM session_notes')) {
      return Array.from(dbState.sessionNotes.entries()).map(([id, value]) => ({
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
  loadAddressState,
  loadQueue,
  loadSession,
  loadSessionNotes,
  saveAddressState,
  saveQueue,
  saveSession,
  saveSessionNote
} from './storage';
import type { AddressState, QueuedVisit } from './types';

describe('mobile offline flow persistence', () => {
  beforeEach(() => {
    dbState.kv.clear();
    dbState.queue.clear();
    dbState.addressState.clear();
    dbState.sessionNotes.clear();
    vi.clearAllMocks();
  });

  it('persists local-first queue states and keeps conflicts distinct from generic failures', async () => {
    const scenario = createAdminUiScenario('mobile-offline');

    const queued: QueuedVisit[] = scenario.visits.map((visit, index) => ({
      id: visit.localRecordUuid,
      localRecordUuid: visit.localRecordUuid,
      createdAt: visit.visitTimeIso,
      syncStatus: index === 0 ? 'failed' : 'conflict',
      syncConflictReason: index === 0 ? null : 'payload_mismatch',
      payload: {
        localRecordUuid: visit.localRecordUuid,
        idempotencyKey: visit.idempotencyKey,
        clientCreatedAt: visit.visitTimeIso,
        submittedAt: visit.visitTimeIso,
        turfId: 'turf-1',
        sessionId: 'session-1',
        addressId: `address-${index + 1}`,
        outcomeCode: visit.outcomeCode,
        contactMade: visit.contactMade,
        notes: visit.notes ?? undefined,
        gpsStatus: visit.gpsStatus,
        capturedAt: visit.visitTimeIso
      },
      addressMeta: {
        addressLine1: scenario.addresses[index].addressLine1,
        city: scenario.addresses[index].city,
        state: scenario.addresses[index].state,
        zip: scenario.addresses[index].zip,
        vanId: scenario.addresses[index].vanId
      }
    }));

    await saveQueue(queued);
    const loadedQueue = await loadQueue();

    expect(loadedQueue).toHaveLength(2);
    expect(loadedQueue[0].syncStatus).toBe('failed');
    expect(loadedQueue[0].syncConflictReason).toBeNull();
    expect(loadedQueue[1].syncStatus).toBe('conflict');
    // Queue persistence stores conflict status; reason remains on address-state records.
    expect(loadedQueue[1].syncConflictReason).toBeNull();
  });

  it('preserves address state + session notes through local SQLite-backed cache', async () => {
    const state: Record<string, AddressState> = {
      'address-1': {
        result: 'talked_to_voter',
        outcomeCode: 'talked_to_voter',
        submittedAt: '2026-03-30T06:30:00.000Z',
        synced: false,
        syncStatus: 'conflict',
        syncConflictReason: 'payload_mismatch',
        localRecordUuid: 'local-1',
        clientCreatedAt: '2026-03-30T06:30:00.000Z',
        sessionId: 'session-1',
        gpsStatus: 'flagged',
        accuracyMeters: 32
      }
    };

    await saveAddressState(state);
    await saveSessionNote({
      id: 'note-1',
      turfId: 'turf-1',
      sessionId: 'session-1',
      createdAt: '2026-03-30T07:00:00.000Z',
      updatedAt: '2026-03-30T07:00:00.000Z',
      addressText: '101 Main St',
      noteText: 'Leave packet at side door'
    });

    const [loadedState, notes] = await Promise.all([
      loadAddressState(),
      loadSessionNotes('turf-1', 'session-1')
    ]);

    expect(loadedState['address-1']?.syncStatus).toBe('conflict');
    expect(loadedState['address-1']?.syncConflictReason).toBe('payload_mismatch');
    expect(notes).toEqual([
      expect.objectContaining({ noteText: 'Leave packet at side door', addressText: '101 Main St' })
    ]);

    await clearAppCache();
    expect(await loadAddressState()).toEqual({});
    expect(await loadSessionNotes('turf-1', 'session-1')).toEqual([]);
  });

  it('restores session token + user while retaining local queue and address state', async () => {
    await saveSession('token-offline-1', {
      id: 'canvasser-1',
      firstName: 'Casey',
      lastName: 'Canvasser',
      email: 'casey@example.test',
      role: 'canvasser'
    });

    await saveQueue([
      {
        id: 'local-10',
        localRecordUuid: 'local-10',
        createdAt: '2026-03-30T08:00:00.000Z',
        syncStatus: 'pending',
        payload: {
          localRecordUuid: 'local-10',
          idempotencyKey: 'local-10',
          clientCreatedAt: '2026-03-30T08:00:00.000Z',
          submittedAt: '2026-03-30T08:00:00.000Z',
          turfId: 'turf-1',
          sessionId: 'session-1',
          addressId: 'address-10',
          outcomeCode: 'knocked',
          contactMade: false,
          gpsStatus: 'verified',
          capturedAt: '2026-03-30T08:00:00.000Z'
        },
        addressMeta: {
          addressLine1: '10 Main St',
          city: 'Detroit',
          state: 'MI',
          zip: '48201',
          vanId: null
        }
      }
    ]);

    const session = await loadSession();
    expect(session.token).toBe('token-offline-1');
    expect(session.user?.role).toBe('canvasser');
    expect(session.queue).toHaveLength(1);
  });
});
