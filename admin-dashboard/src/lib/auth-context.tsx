'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { createApiClient } from './api';
import { clearStoredSession, readStoredSession, writeStoredSession } from './storage';
import type { SafeUser } from './types';

type AuthContextValue = {
  ready: boolean;
  token: string | null;
  user: SafeUser | null;
  login: (email: string, password: string) => Promise<void>;
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

  async function login(email: string, password: string) {
    const api = createApiClient();
    const response = await api.login(email, password);
    const accessToken = response.accessToken || response.token;
    if (!accessToken) {
      throw new Error('Login response did not include a token.');
    }
    if (response.user.role !== 'admin' && response.user.role !== 'supervisor') {
      throw new Error('This dashboard is restricted to admin and supervisor accounts.');
    }

    setToken(accessToken);
    setUser(response.user);
    writeStoredSession(accessToken, response.user);
    router.push('/dashboard');
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
    <AuthContext.Provider value={{ ready, token, user, login, logout, refresh }}>
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
  return createApiClient(token);
}
