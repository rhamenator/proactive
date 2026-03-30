'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { createApiClient } from './api';
import { clearStoredSession, readStoredSession, writeStoredSession } from './storage';
import type { LoginResponse, MfaChallengeResponse, MfaSetupInitResponse, SafeUser } from './types';

type AuthContextValue = {
  ready: boolean;
  token: string | null;
  user: SafeUser | null;
  login: (email: string, password: string) => Promise<MfaChallengeResponse | null>;
  initializeMfaSetup: (challengeToken: string) => Promise<MfaSetupInitResponse>;
  completeMfaSetup: (challengeToken: string, code: string) => Promise<string[]>;
  verifyMfa: (challengeToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<SafeUser | null>(null);
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const stored = readStoredSession();
      if (!active) {
        return;
      }

      setToken(stored.token);
      setUser(stored.user);

      if (stored.token) {
        try {
          const api = createApiClient(stored.token);
          const me = await api.me();
          if (!active) {
            return;
          }
          setUser(me);
          writeStoredSession(stored.token, me);
        } catch {
          clearStoredSession();
          if (active) {
            setToken(null);
            setUser(null);
          }
        }
      }

      if (active) {
        setReady(true);
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  function ensureDashboardRole(userValue: SafeUser) {
    if (userValue.role !== 'admin' && userValue.role !== 'supervisor') {
      throw new Error('This dashboard is restricted to admin and supervisor accounts.');
    }
  }

  function finalizeLogin(response: LoginResponse, shouldRedirect = true) {
    const accessToken = response.accessToken || response.token;
    if (!accessToken) {
      throw new Error('Login response did not include a token.');
    }
    ensureDashboardRole(response.user);

    setToken(accessToken);
    setUser(response.user);
    writeStoredSession(accessToken, response.user);
    if (shouldRedirect) {
      router.push('/dashboard');
    }
  }

  async function login(email: string, password: string) {
    const api = createApiClient();
    const response = await api.login(email, password);
    ensureDashboardRole(response.user);

    if ('mfaRequired' in response && response.mfaRequired) {
      return response;
    }

    finalizeLogin(response as LoginResponse);
    return null;
  }

  async function initializeMfaSetup(challengeToken: string) {
    const api = createApiClient();
    return api.mfaSetupInit(challengeToken);
  }

  async function completeMfaSetup(challengeToken: string, code: string) {
    const api = createApiClient();
    const response = await api.mfaSetupComplete(challengeToken, code);
    finalizeLogin(response, false);
    return response.backupCodes ?? [];
  }

  async function verifyMfa(challengeToken: string, code: string) {
    const api = createApiClient();
    const response = await api.mfaVerify(challengeToken, code);
    finalizeLogin(response);
  }

  async function logout() {
    clearStoredSession();
    setToken(null);
    setUser(null);
    router.push('/login');
  }

  async function refresh() {
    if (!token) {
      return;
    }
    const api = createApiClient(token);
    const me = await api.me();
    setUser(me);
    writeStoredSession(token, me);
  }

  return (
    <AuthContext.Provider
      value={{ ready, token, user, login, initializeMfaSetup, completeMfaSetup, verifyMfa, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}

export function useAuthedApi() {
  const { token } = useAuth();
  return useMemo(() => createApiClient(token), [token]);
}
