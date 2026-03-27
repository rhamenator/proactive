import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';

import { api, getErrorMessage } from '../api/client';
import { clearAppCache, clearSession, loadSession, saveAddressState, saveQueue, saveSession } from '../storage';
import type {
  Address,
  AddressState,
  QueuedVisit,
  Role,
  Turf,
  TurfSession,
  TurfSnapshot,
  User,
  VisitResult,
  VisitSubmission,
} from '../types';

type AppContextValue = {
  isBootstrapping: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  user: User | null;
  token: string | null;
  role: Role | null;
  turf: Turf | null;
  session: TurfSession | null;
  addresses: Address[];
  progress: TurfSnapshot['progress'];
  queue: QueuedVisit[];
  statusMessage: string | null;
  errorMessage: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshTurf: () => Promise<void>;
  startTurf: () => Promise<void>;
  endTurf: () => Promise<void>;
  submitVisit: (addressId: string, result: VisitResult, notes?: string) => Promise<void>;
  syncQueue: () => Promise<void>;
  getAddressById: (addressId: string) => Address | undefined;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

function createQueuedVisit(address: Address, payload: VisitSubmission): QueuedVisit {
  return {
    id: `${payload.addressId}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    payload,
    addressMeta: {
      addressLine1: address.addressLine1,
      city: address.city,
      state: address.state,
      zip: address.zip,
      vanId: address.vanId,
    },
  };
}

async function captureLocation() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== Location.PermissionStatus.GRANTED) {
    throw new Error('Location permission is required to submit visits.');
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

function mergeAddressState(addresses: Address[], addressState: Record<string, AddressState>) {
  return addresses.map((address) => {
    const local = addressState[address.id];
    if (!local) {
      return address;
    }

    return {
      ...address,
      lastResult: local.result ?? address.lastResult ?? null,
      lastVisitAt: local.submittedAt ?? address.lastVisitAt ?? null,
      status: local.result ? 'completed' : address.status,
      pendingSync: !local.synced,
    };
  });
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [turf, setTurf] = useState<Turf | null>(null);
  const [session, setSession] = useState<TurfSession | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [progress, setProgress] = useState<TurfSnapshot['progress']>({ completed: 0, total: 0, pendingSync: 0 });
  const [queue, setQueue] = useState<QueuedVisit[]>([]);
  const [addressState, setAddressState] = useState<Record<string, AddressState>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const sessionData = await loadSession();
        if (!mounted) {
          return;
        }

        setToken(sessionData.token);
        setUser(sessionData.user);
        setQueue(sessionData.queue);
        setAddressState(sessionData.addressState);

        if (sessionData.token) {
          try {
            const [me, snapshot] = await Promise.all([api.me(sessionData.token), api.myTurf(sessionData.token)]);
            if (!mounted) {
              return;
            }

            setUser(me);
            applySnapshot(snapshot, sessionData.addressState);
          } catch (error) {
            setErrorMessage(getErrorMessage(error));
            await clearSession();
            setToken(null);
            setUser(null);
          }
        }
      } finally {
        if (mounted) {
          setIsBootstrapping(false);
        }
      }
    }

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isOnline || !token || queue.length === 0) {
      return;
    }

    void syncQueue();
  }, [isOnline, queue.length, token]);

  useEffect(() => {
    void saveQueue(queue);
  }, [queue]);

  useEffect(() => {
    void saveAddressState(addressState);
  }, [addressState]);

  function applySnapshot(snapshot: TurfSnapshot, state: Record<string, AddressState>) {
    setTurf(snapshot.turf);
    setSession(snapshot.session);
    setProgress(snapshot.progress);
    setAddresses(mergeAddressState(snapshot.addresses, state));
  }

  async function refreshTurf() {
    if (!token) {
      return;
    }
    const snapshot = await api.myTurf(token);
    applySnapshot(snapshot, addressState);
  }

  async function login(email: string, password: string) {
    setErrorMessage(null);
    const response = await api.login(email, password);
    const authToken = response.token || response.accessToken;
    if (!authToken) {
      throw new Error('Login response did not include a token.');
    }
    if (response.user.role !== 'canvasser') {
      throw new Error('This mobile app is for canvasser accounts only.');
    }

    setToken(authToken);
    setUser(response.user);
    await saveSession(authToken, response.user);
    const snapshot = await api.myTurf(authToken);
    applySnapshot(snapshot, addressState);
    setStatusMessage('Signed in. Turf snapshot loaded.');
  }

  async function logout() {
    setToken(null);
    setUser(null);
    setTurf(null);
    setSession(null);
    setAddresses([]);
    setProgress({ completed: 0, total: 0, pendingSync: 0 });
    setQueue([]);
    setAddressState({});
    setStatusMessage(null);
    setErrorMessage(null);
    await Promise.all([clearSession(), clearAppCache()]);
  }

  async function startTurf() {
    if (!token || !turf) {
      throw new Error('No turf is assigned.');
    }
    setErrorMessage(null);
    const location = await captureLocation();
    await api.startTurf(token, {
      turfId: turf.id,
      latitude: location.latitude,
      longitude: location.longitude,
    });
    await refreshTurf();
    setStatusMessage('Turf started and GPS captured.');
  }

  async function endTurf() {
    if (!token || !turf) {
      throw new Error('No turf is assigned.');
    }
    setErrorMessage(null);
    const location = await captureLocation();
    await api.endTurf(token, {
      turfId: turf.id,
      latitude: location.latitude,
      longitude: location.longitude,
    });
    await refreshTurf();
    setStatusMessage('Turf closed and GPS captured.');
  }

  async function submitVisit(addressId: string, result: VisitResult, notes?: string) {
    if (!token || !turf) {
      throw new Error('Sign in and load a turf before logging visits.');
    }

    const address = addresses.find((item) => item.id === addressId);
    if (!address) {
      throw new Error('Address not found on this turf.');
    }

    const location = await captureLocation();
    const payload: VisitSubmission = {
      turfId: turf.id,
      addressId,
      result,
      contactMade: result === 'talked_to_voter',
      notes: notes?.trim() || undefined,
      latitude: location.latitude,
      longitude: location.longitude,
      submittedAt: new Date().toISOString(),
    };

    const localState: AddressState = {
      result,
      submittedAt: payload.submittedAt,
      synced: false,
    };

    setAddressState((current) => ({
      ...current,
      [addressId]: localState,
    }));

    const queuedItem = createQueuedVisit(address, payload);

    if (!isOnline) {
      setQueue((current) => [...current, queuedItem]);
      setStatusMessage('Saved offline. It will sync when the connection returns.');
      return;
    }

    try {
      await api.logVisit(token, payload);
      setAddressState((current) => ({
        ...current,
        [addressId]: { ...localState, synced: true },
      }));
      setStatusMessage('Visit submitted.');
      await refreshTurf();
    } catch (error) {
      setQueue((current) => [...current, queuedItem]);
      setStatusMessage('Saved locally after a network error. It will retry automatically.');
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function syncQueue() {
    if (!token || syncingRef.current || queue.length === 0) {
      return;
    }

    syncingRef.current = true;
    setIsSyncing(true);
    setErrorMessage(null);

    try {
      let remaining = [...queue];
      let didChange = false;

      while (remaining.length > 0) {
        const item = remaining[0];
        try {
          await api.logVisit(token, item.payload);
          didChange = true;
          remaining = remaining.slice(1);
          setAddressState((current) => ({
            ...current,
            [item.payload.addressId]: {
              result: item.payload.result,
              submittedAt: item.payload.submittedAt,
              synced: true,
            },
          }));
        } catch (error) {
          setErrorMessage(getErrorMessage(error));
          break;
        }
      }

      setQueue(remaining);
      if (didChange) {
        setStatusMessage('Queued visits synced.');
        await refreshTurf();
      }
    } finally {
      setIsSyncing(false);
      syncingRef.current = false;
    }
  }

  function getAddressById(addressId: string) {
    return addresses.find((address) => address.id === addressId);
  }

  const value: AppContextValue = {
    isBootstrapping,
    isOnline,
    isSyncing,
    user,
    token,
    role: user?.role ?? null,
    turf,
    session,
    addresses,
    progress,
    queue,
    statusMessage,
    errorMessage,
    login,
    logout,
    refreshTurf,
    startTurf,
    endTurf,
    submitVisit,
    syncQueue,
    getAddressById,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return context;
}
