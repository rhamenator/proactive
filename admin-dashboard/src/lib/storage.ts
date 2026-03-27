import type { SafeUser } from './types';

const keys = {
  token: 'proactive.admin.token',
  user: 'proactive.admin.user'
};

function isBrowser() {
  return typeof window !== 'undefined';
}

export function readStoredSession() {
  if (!isBrowser()) {
    return { token: null, user: null as SafeUser | null };
  }

  const token = window.localStorage.getItem(keys.token);
  const rawUser = window.localStorage.getItem(keys.user);
  const user = rawUser ? (JSON.parse(rawUser) as SafeUser) : null;
  return { token, user };
}

export function writeStoredSession(token: string, user: SafeUser) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(keys.token, token);
  window.localStorage.setItem(keys.user, JSON.stringify(user));
}

export function clearStoredSession() {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(keys.token);
  window.localStorage.removeItem(keys.user);
}
