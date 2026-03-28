import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AddressState, GpsStatus, QueuedVisit, User, VisitSyncStatus } from './types';

const keys = {
  token: 'proactive.mobile.token',
  user: 'proactive.mobile.user',
  queue: 'proactive.mobile.visitQueue',
  addressState: 'proactive.mobile.addressState',
};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

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

  const createdAt =
    typeof raw.createdAt === 'string'
      ? raw.createdAt
        : new Date().toISOString();
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
      accuracyMeters:
        typeof payload.accuracyMeters === 'number' ? payload.accuracyMeters : null,
      gpsStatus,
      gpsFailureReason:
        typeof payload.gpsFailureReason === 'string' ? payload.gpsFailureReason : null,
      capturedAt:
        typeof payload.capturedAt === 'string' ? payload.capturedAt : clientCreatedAt,
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
    localRecordUuid: typeof raw.localRecordUuid === 'string' ? raw.localRecordUuid : null,
    clientCreatedAt: typeof raw.clientCreatedAt === 'string' ? raw.clientCreatedAt : null,
    sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : null,
    gpsStatus: normalizeGpsStatus(raw.gpsStatus),
    accuracyMeters: typeof raw.accuracyMeters === 'number' ? raw.accuracyMeters : null,
  };
}

export async function loadSession() {
  const [token, user, queue, addressState] = await Promise.all([
    AsyncStorage.getItem(keys.token),
    readJson<User | null>(keys.user, null),
    readJson<QueuedVisit[]>(keys.queue, []),
    readJson<Record<string, AddressState>>(keys.addressState, {}),
  ]);

  return {
    token,
    user,
    queue: queue.map(normalizeQueuedVisit).filter((item): item is QueuedVisit => item !== null),
    addressState: Object.fromEntries(
      Object.entries(addressState)
        .map(([key, value]) => {
          const normalized = normalizeAddressState(value);
          return normalized ? [key, normalized] : null;
        })
        .filter((item): item is [string, AddressState] => item !== null)
    ),
  };
}

export async function saveSession(token: string, user: User) {
  await Promise.all([
    AsyncStorage.setItem(keys.token, token),
    AsyncStorage.setItem(keys.user, JSON.stringify(user)),
  ]);
}

export async function clearSession() {
  await Promise.all([AsyncStorage.removeItem(keys.token), AsyncStorage.removeItem(keys.user)]);
}

export async function loadQueue() {
  return readJson<QueuedVisit[]>(keys.queue, []);
}

export async function saveQueue(queue: QueuedVisit[]) {
  await AsyncStorage.setItem(keys.queue, JSON.stringify(queue));
}

export async function loadAddressState() {
  return readJson<Record<string, AddressState>>(keys.addressState, {});
}

export async function saveAddressState(addressState: Record<string, AddressState>) {
  await AsyncStorage.setItem(keys.addressState, JSON.stringify(addressState));
}

export async function clearAppCache() {
  await Promise.all([
    AsyncStorage.removeItem(keys.queue),
    AsyncStorage.removeItem(keys.addressState),
  ]);
}
