import type { SafeUser } from './types';

const keys = {
  token: 'proactive.admin.token',
  user: 'proactive.admin.user',
  originalToken: 'proactive.admin.original.token',
  originalUser: 'proactive.admin.original.user'
};

function isBrowser() {
  return typeof window !== 'undefined';
}

export function readStoredSession() {
  if (!isBrowser()) {
    return {
      token: null,
      user: null as SafeUser | null,
      original: { token: null as string | null, user: null as SafeUser | null }
    };
  }

  const token = window.localStorage.getItem(keys.token);
  const rawUser = window.localStorage.getItem(keys.user);
  const originalToken = window.localStorage.getItem(keys.originalToken);
  const rawOriginalUser = window.localStorage.getItem(keys.originalUser);
  const user = rawUser ? (JSON.parse(rawUser) as SafeUser) : null;
  const originalUser = rawOriginalUser ? (JSON.parse(rawOriginalUser) as SafeUser) : null;
  return { token, user, original: { token: originalToken, user: originalUser } };
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

export function writeOriginalSession(token: string, user: SafeUser) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(keys.originalToken, token);
  window.localStorage.setItem(keys.originalUser, JSON.stringify(user));
}

export function readOriginalSession() {
  if (!isBrowser()) {
    return { token: null as string | null, user: null as SafeUser | null };
  }

  const token = window.localStorage.getItem(keys.originalToken);
  const rawUser = window.localStorage.getItem(keys.originalUser);
  return {
    token,
    user: rawUser ? (JSON.parse(rawUser) as SafeUser) : null
  };
}

export function clearOriginalSession() {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(keys.originalToken);
  window.localStorage.removeItem(keys.originalUser);
}
