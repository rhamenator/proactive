import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import type { AddressState, GpsStatus, QueuedVisit, SessionNote, User, VisitSyncStatus } from './types';

const databaseName = 'proactive-mobile.db';
const kvKeys = {
  token: 'session.token',
  user: 'session.user',
};

type DatabaseLike = Pick<
  SQLiteDatabase,
  'execAsync' | 'runAsync' | 'getFirstAsync' | 'getAllAsync' | 'withExclusiveTransactionAsync'
>;

type QueueRow = {
  local_record_uuid: string;
  created_at: string;
  sync_status: string;
  payload_json: string;
  address_meta_json: string;
};

type AddressStateRow = {
  address_id: string;
  state_json: string;
};

type SessionNoteRow = {
  id: string;
  turf_id: string;
  session_id: string | null;
  created_at: string;
  updated_at: string;
  address_text: string | null;
  note_text: string;
};

let databasePromise: Promise<DatabaseLike> | null = null;

function isVisitSyncStatus(value: unknown): value is VisitSyncStatus {
  return (
    value === 'pending' ||
    value === 'syncing' ||
    value === 'synced' ||
    value === 'failed' ||
    value === 'conflict'
  );
}

function normalizeVisitSyncStatus(value: unknown, syncedFallback: boolean): VisitSyncStatus {
  if (isVisitSyncStatus(value)) {
    return value;
  }
  return syncedFallback ? 'synced' : 'pending';
}

function isGpsStatus(value: unknown): value is GpsStatus {
  return value === 'verified' || value === 'flagged' || value === 'missing' || value === 'low_accuracy';
}

function normalizeGpsStatus(value: unknown): GpsStatus | null {
  return isGpsStatus(value) ? value : null;
}

function normalizeQueuedVisit(item: unknown): QueuedVisit | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const raw = item as Record<string, unknown>;
  const payload = raw.payload && typeof raw.payload === 'object' ? (raw.payload as Record<string, unknown>) : null;
  const localRecordUuid =
    typeof raw.localRecordUuid === 'string'
      ? raw.localRecordUuid
      : typeof raw.id === 'string'
        ? raw.id
        : typeof payload?.localRecordUuid === 'string'
          ? payload.localRecordUuid
          : null;

  if (!localRecordUuid || !payload) {
    return null;
  }

  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString();
  const payloadLocalRecordUuid =
    typeof payload.localRecordUuid === 'string' ? payload.localRecordUuid : localRecordUuid;
  const outcomeCode =
    typeof payload.outcomeCode === 'string'
      ? payload.outcomeCode
      : typeof payload.result === 'string'
        ? payload.result
        : 'knocked';
  const clientCreatedAt =
    typeof payload.clientCreatedAt === 'string'
      ? payload.clientCreatedAt
      : typeof payload.submittedAt === 'string'
        ? payload.submittedAt
        : createdAt;
  const latitude = typeof payload.latitude === 'number' ? payload.latitude : null;
  const longitude = typeof payload.longitude === 'number' ? payload.longitude : null;
  const gpsStatus = isGpsStatus(payload.gpsStatus)
    ? payload.gpsStatus
    : latitude !== null && longitude !== null
      ? 'verified'
      : 'missing';

  const addressMeta =
    raw.addressMeta && typeof raw.addressMeta === 'object'
      ? (raw.addressMeta as Record<string, unknown>)
      : {};

  return {
    id: localRecordUuid,
    localRecordUuid,
    createdAt,
    syncStatus: normalizeVisitSyncStatus(raw.syncStatus, false),
    syncConflictReason: typeof raw.syncConflictReason === 'string' ? raw.syncConflictReason : null,
    payload: {
      localRecordUuid: payloadLocalRecordUuid,
      idempotencyKey:
        typeof payload.idempotencyKey === 'string' ? payload.idempotencyKey : payloadLocalRecordUuid,
      clientCreatedAt,
      submittedAt: typeof payload.submittedAt === 'string' ? payload.submittedAt : clientCreatedAt,
      turfId: String(payload.turfId ?? ''),
      sessionId: typeof payload.sessionId === 'string' ? payload.sessionId : null,
      addressId: String(payload.addressId ?? ''),
      outcomeCode,
      contactMade: Boolean(payload.contactMade),
      notes: typeof payload.notes === 'string' ? payload.notes : undefined,
      latitude,
      longitude,
      accuracyMeters: typeof payload.accuracyMeters === 'number' ? payload.accuracyMeters : null,
      gpsStatus,
      gpsFailureReason: typeof payload.gpsFailureReason === 'string' ? payload.gpsFailureReason : null,
      capturedAt: typeof payload.capturedAt === 'string' ? payload.capturedAt : clientCreatedAt,
    },
    addressMeta: {
      addressLine1: String(addressMeta.addressLine1 ?? ''),
      city: String(addressMeta.city ?? ''),
      state: String(addressMeta.state ?? ''),
      zip:
        typeof addressMeta.zip === 'string' || addressMeta.zip === null
          ? (addressMeta.zip as string | null)
          : null,
      vanId:
        typeof addressMeta.vanId === 'string' || addressMeta.vanId === null
          ? (addressMeta.vanId as string | null)
          : null,
    },
  };
}

function normalizeAddressState(item: unknown): AddressState | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const raw = item as Record<string, unknown>;
  const synced = typeof raw.synced === 'boolean' ? raw.synced : false;
  const syncStatus = normalizeVisitSyncStatus(raw.syncStatus, synced);

  return {
    result: typeof raw.result === 'string' ? raw.result : null,
    outcomeCode: typeof raw.outcomeCode === 'string' ? raw.outcomeCode : null,
    submittedAt: typeof raw.submittedAt === 'string' ? raw.submittedAt : null,
    synced: syncStatus === 'synced',
    syncStatus,
    syncConflictReason: typeof raw.syncConflictReason === 'string' ? raw.syncConflictReason : null,
    localRecordUuid: typeof raw.localRecordUuid === 'string' ? raw.localRecordUuid : null,
    clientCreatedAt: typeof raw.clientCreatedAt === 'string' ? raw.clientCreatedAt : null,
    sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : null,
    gpsStatus: normalizeGpsStatus(raw.gpsStatus),
    accuracyMeters: typeof raw.accuracyMeters === 'number' ? raw.accuracyMeters : null,
  };
}

function normalizeSessionNote(item: unknown): SessionNote | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const raw = item as Record<string, unknown>;
  if (
    typeof raw.id !== 'string' ||
    typeof raw.turfId !== 'string' ||
    typeof raw.createdAt !== 'string' ||
    typeof raw.updatedAt !== 'string' ||
    typeof raw.noteText !== 'string'
  ) {
    return null;
  }

  return {
    id: raw.id,
    turfId: raw.turfId,
    sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    addressText: typeof raw.addressText === 'string' ? raw.addressText : null,
    noteText: raw.noteText
  };
}

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await openDatabaseAsync(databaseName);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS kv_store (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT
        );
        CREATE TABLE IF NOT EXISTS queued_visits (
          local_record_uuid TEXT PRIMARY KEY NOT NULL,
          created_at TEXT NOT NULL,
          sync_status TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          address_meta_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS address_state (
          address_id TEXT PRIMARY KEY NOT NULL,
          state_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS session_notes (
          id TEXT PRIMARY KEY NOT NULL,
          turf_id TEXT NOT NULL,
          session_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          address_text TEXT,
          note_text TEXT NOT NULL
        );
      `);
      return db;
    })();
  }

  return databasePromise;
}

async function getStoredValue(db: DatabaseLike, key: string) {
  const row = await db.getFirstAsync<{ value: string | null }>(
    'SELECT value FROM kv_store WHERE key = ?',
    key
  );
  return row?.value ?? null;
}

async function setStoredValue(db: DatabaseLike, key: string, value: string | null) {
  await db.runAsync(
    'INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)',
    key,
    value
  );
}

function parseUser(raw: string | null): User | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function rowToQueuedVisit(row: QueueRow): QueuedVisit | null {
  try {
    return normalizeQueuedVisit({
      localRecordUuid: row.local_record_uuid,
      id: row.local_record_uuid,
      createdAt: row.created_at,
      syncStatus: row.sync_status,
      payload: JSON.parse(row.payload_json),
      addressMeta: JSON.parse(row.address_meta_json)
    });
  } catch {
    return null;
  }
}

function rowToAddressState(row: AddressStateRow): AddressState | null {
  try {
    return normalizeAddressState(JSON.parse(row.state_json));
  } catch {
    return null;
  }
}

function rowToSessionNote(row: SessionNoteRow): SessionNote | null {
  return normalizeSessionNote({
    id: row.id,
    turfId: row.turf_id,
    sessionId: row.session_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    addressText: row.address_text,
    noteText: row.note_text
  });
}

export async function loadSession() {
  const db = await getDatabase();
  const [token, userRaw, queueRows, addressStateRows] = await Promise.all([
    getStoredValue(db, kvKeys.token),
    getStoredValue(db, kvKeys.user),
    db.getAllAsync<QueueRow>(
      'SELECT local_record_uuid, created_at, sync_status, payload_json, address_meta_json FROM queued_visits ORDER BY created_at ASC'
    ),
    db.getAllAsync<AddressStateRow>(
      'SELECT address_id, state_json FROM address_state ORDER BY address_id ASC'
    )
  ]);

  return {
    token,
    user: parseUser(userRaw),
    queue: queueRows.map(rowToQueuedVisit).filter((item): item is QueuedVisit => item !== null),
    addressState: Object.fromEntries(
      addressStateRows
        .map((row) => {
          const normalized = rowToAddressState(row);
          return normalized ? [row.address_id, normalized] : null;
        })
        .filter((item): item is [string, AddressState] => item !== null)
    ),
  };
}

export async function saveSession(token: string, user: User) {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await setStoredValue(txn, kvKeys.token, token);
    await setStoredValue(txn, kvKeys.user, JSON.stringify(user));
  });
}

export async function clearSession() {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM kv_store WHERE key IN (?, ?)', kvKeys.token, kvKeys.user);
  });
}

export async function loadQueue() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<QueueRow>(
    'SELECT local_record_uuid, created_at, sync_status, payload_json, address_meta_json FROM queued_visits ORDER BY created_at ASC'
  );
  return rows.map(rowToQueuedVisit).filter((item): item is QueuedVisit => item !== null);
}

export async function saveQueue(queue: QueuedVisit[]) {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM queued_visits');
    for (const item of queue) {
      await txn.runAsync(
        `INSERT INTO queued_visits (
          local_record_uuid,
          created_at,
          sync_status,
          payload_json,
          address_meta_json
        ) VALUES (?, ?, ?, ?, ?)`,
        item.localRecordUuid,
        item.createdAt,
        item.syncStatus,
        JSON.stringify(item.payload),
        JSON.stringify(item.addressMeta)
      );
    }
  });
}

export async function loadAddressState() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<AddressStateRow>(
    'SELECT address_id, state_json FROM address_state ORDER BY address_id ASC'
  );
  return Object.fromEntries(
    rows
      .map((row) => {
        const normalized = rowToAddressState(row);
        return normalized ? [row.address_id, normalized] : null;
      })
      .filter((item): item is [string, AddressState] => item !== null)
  );
}

export async function saveAddressState(addressState: Record<string, AddressState>) {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM address_state');
    for (const [addressId, state] of Object.entries(addressState)) {
      await txn.runAsync(
        'INSERT INTO address_state (address_id, state_json) VALUES (?, ?)',
        addressId,
        JSON.stringify(state)
      );
    }
  });
}

export async function loadSessionNotes(turfId?: string | null, sessionId?: string | null) {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SessionNoteRow>(
    'SELECT id, turf_id, session_id, created_at, updated_at, address_text, note_text FROM session_notes ORDER BY created_at DESC'
  );

  return rows
    .map(rowToSessionNote)
    .filter((item): item is SessionNote => item !== null)
    .filter((note) => (!turfId || note.turfId === turfId) && (!sessionId || note.sessionId === sessionId));
}

export async function saveSessionNote(note: SessionNote) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO session_notes (
      id,
      turf_id,
      session_id,
      created_at,
      updated_at,
      address_text,
      note_text
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    note.id,
    note.turfId,
    note.sessionId ?? null,
    note.createdAt,
    note.updatedAt,
    note.addressText ?? null,
    note.noteText
  );
}

export async function deleteSessionNote(noteId: string) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM session_notes WHERE id = ?', noteId);
}

export async function clearAppCache() {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM queued_visits');
    await txn.runAsync('DELETE FROM address_state');
    await txn.runAsync('DELETE FROM session_notes');
  });
}
