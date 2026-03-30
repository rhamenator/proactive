'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { createApiClient } from './api';
import {
  clearOriginalSession,
  clearStoredSession,
  readOriginalSession,
  readStoredSession,
  writeOriginalSession,
  writeStoredSession
} from './storage';
import type { LoginResponse, MfaChallengeResponse, MfaSetupInitResponse, SafeUser } from './types';

type AuthContextValue = {
  ready: boolean;
  token: string | null;
  user: SafeUser | null;
  impersonation: NonNullable<SafeUser['impersonation']> | null;
  login: (email: string, password: string) => Promise<MfaChallengeResponse | null>;
  initializeMfaSetup: (challengeToken: string) => Promise<MfaSetupInitResponse>;
  completeMfaSetup: (challengeToken: string, code: string) => Promise<string[]>;
  verifyMfa: (challengeToken: string, code: string) => Promise<void>;
  startImpersonation: (targetUserId: string, reason?: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<SafeUser | null>(null);
  const [impersonation, setImpersonation] = useState<NonNullable<SafeUser['impersonation']> | null>(null);
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
      setImpersonation(stored.user?.impersonation ?? null);

      if (stored.token) {
        try {
          const api = createApiClient(stored.token);
          const me = await api.me();
          if (!active) {
            return;
          }
          setUser(me);
          setImpersonation(me.impersonation ?? null);
          writeStoredSession(stored.token, me);
        } catch {
          clearStoredSession();
          clearOriginalSession();
          if (active) {
            setToken(null);
            setUser(null);
            setImpersonation(null);
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
    if (userValue.impersonation) {
      return;
    }

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
    setImpersonation(response.user.impersonation ?? null);
    writeStoredSession(accessToken, response.user);
    if (shouldRedirect) {
      router.push(response.user.role === 'canvasser' ? '/field-preview' : '/dashboard');
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
    clearOriginalSession();
    clearStoredSession();
    setToken(null);
    setUser(null);
    setImpersonation(null);
    router.push('/login');
  }

  async function refresh() {
    if (!token) {
      return;
    }
    const api = createApiClient(token);
    const me = await api.me();
    setUser(me);
    setImpersonation(me.impersonation ?? null);
    writeStoredSession(token, me);
  }

  async function startImpersonation(targetUserId: string, reason?: string) {
    if (!token || !user) {
      throw new Error('You must be signed in to start impersonation.');
    }
    if (user.role !== 'admin') {
      throw new Error('Only admin users can start impersonation sessions.');
    }

    const api = createApiClient(token);
    const response = await api.startImpersonation(targetUserId, reason);
    const accessToken = response.accessToken || response.token;
    if (!accessToken) {
      throw new Error('Impersonation response did not include a token.');
    }

    if (!user.impersonation) {
      writeOriginalSession(token, user);
    }

    setToken(accessToken);
    setUser(response.user);
    setImpersonation(response.user.impersonation ?? null);
    writeStoredSession(accessToken, response.user);
    router.push(response.user.role === 'canvasser' ? '/field-preview' : '/dashboard');
  }

  async function stopImpersonation() {
    if (!token || !impersonation) {
      return;
    }

    const api = createApiClient(token);
    await api.stopImpersonation(impersonation.sessionId);

    const original = readOriginalSession();
    clearOriginalSession();

    if (original.token && original.user) {
      setToken(original.token);
      setUser(original.user);
      setImpersonation(original.user.impersonation ?? null);
      writeStoredSession(original.token, original.user);
      router.push('/dashboard');
      return;
    }

    clearStoredSession();
    setToken(null);
    setUser(null);
    setImpersonation(null);
    router.push('/login');
  }

  return (
    <AuthContext.Provider
      value={{
        ready,
        token,
        user,
        impersonation,
        login,
        initializeMfaSetup,
        completeMfaSetup,
        verifyMfa,
        startImpersonation,
        stopImpersonation,
        logout,
        refresh
      }}
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
