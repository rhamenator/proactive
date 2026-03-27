import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AddressState, QueuedVisit, User } from './types';

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
    queue,
    addressState,
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
