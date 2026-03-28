import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';

import { api, getErrorMessage } from '../api/client';
import { clearAppCache, clearSession, loadSession, saveAddressState, saveQueue, saveSession } from '../storage';
import type {
  Address,
  AddressState,
  GpsStatus,
  QueuedVisit,
  Role,
  Turf,
  TurfSession,
  TurfSnapshot,
  User,
  VisitResult,
  VisitSyncStatus,
  VisitSubmission,
} from '../types';
import { createLocalRecordUuid } from '../utils/localIds';

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

type CapturedGps = {
  latitude?: number | null;
  longitude?: number | null;
  accuracyMeters?: number | null;
  gpsStatus: GpsStatus;
  gpsFailureReason?: string | null;
  capturedAt: string;
};

const GPS_ACCURACY_THRESHOLD_METERS = 30;

function createQueuedVisit(address: Address, payload: VisitSubmission): QueuedVisit {
  return {
    id: payload.localRecordUuid,
    localRecordUuid: payload.localRecordUuid,
    createdAt: new Date().toISOString(),
    syncStatus: 'pending',
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

async function captureLocation(): Promise<CapturedGps> {
  const capturedAt = new Date().toISOString();

  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED) {
      return {
        gpsStatus: 'missing',
        gpsFailureReason: 'permission_denied',
        capturedAt,
      };
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const accuracyMeters =
      typeof position.coords.accuracy === 'number' && Number.isFinite(position.coords.accuracy)
        ? position.coords.accuracy
        : null;

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyMeters,
      gpsStatus:
        accuracyMeters !== null && accuracyMeters > GPS_ACCURACY_THRESHOLD_METERS
          ? 'low_accuracy'
          : 'verified',
      capturedAt,
    };
  } catch (error) {
    return {
      gpsStatus: 'missing',
      gpsFailureReason: error instanceof Error ? error.message : 'device_error',
      capturedAt,
    };
  }
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
      lastVisitAt: local.clientCreatedAt ?? local.submittedAt ?? address.lastVisitAt ?? null,
      status: local.result ? 'completed' : address.status,
      pendingSync: local.syncStatus !== 'synced',
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
    const hasSyncableItems = queue.some(
      (item) => item.syncStatus === 'pending' || item.syncStatus === 'failed'
    );

    if (!isOnline || !token || !hasSyncableItems) {
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

    const localRecordUuid = createLocalRecordUuid();
    const location = await captureLocation();
    const clientCreatedAt = new Date().toISOString();
    const payload: VisitSubmission = {
      localRecordUuid,
      idempotencyKey: localRecordUuid,
      clientCreatedAt,
      submittedAt: clientCreatedAt,
      turfId: turf.id,
      sessionId: session?.id,
      addressId,
      result,
      contactMade: result === 'talked_to_voter',
      notes: notes?.trim() || undefined,
      latitude: location.latitude ?? undefined,
      longitude: location.longitude ?? undefined,
      accuracyMeters: location.accuracyMeters ?? undefined,
      gpsStatus: location.gpsStatus,
      gpsFailureReason: location.gpsFailureReason ?? undefined,
      capturedAt: location.capturedAt,
    };

    const localState: AddressState = {
      result,
      submittedAt: payload.clientCreatedAt,
      synced: false,
      syncStatus: 'pending',
      localRecordUuid,
      clientCreatedAt,
      sessionId: payload.sessionId,
      gpsStatus: payload.gpsStatus,
      accuracyMeters: payload.accuracyMeters,
    };

    setAddressState((current) => ({
      ...current,
      [addressId]: localState,
    }));

    const queuedItem = createQueuedVisit(address, payload);
    setQueue((current) => [...current, queuedItem]);

    if (!isOnline) {
      setStatusMessage(
        location.gpsStatus === 'verified'
          ? 'Saved offline. It will sync when the connection returns.'
          : 'Saved offline with a GPS warning. It will sync when the connection returns.'
      );
      return;
    }

    setQueue((current) =>
      current.map((item) =>
        item.localRecordUuid === localRecordUuid ? { ...item, syncStatus: 'syncing' } : item
      )
    );

    try {
      await api.logVisit(token, payload);
      setQueue((current) => current.filter((item) => item.localRecordUuid !== localRecordUuid));
      setAddressState((current) => ({
        ...current,
        [addressId]: { ...localState, synced: true, syncStatus: 'synced' },
      }));
      setStatusMessage(
        location.gpsStatus === 'verified'
          ? 'Visit submitted.'
          : 'Visit submitted with a GPS warning.'
      );
      await refreshTurf();
    } catch (error) {
      setQueue((current) =>
        current.map((item) =>
          item.localRecordUuid === localRecordUuid ? { ...item, syncStatus: 'failed' } : item
        )
      );
      setAddressState((current) => ({
        ...current,
        [addressId]: { ...localState, syncStatus: 'failed' },
      }));
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
      const items = [...queue];
      let didChange = false;
      let syncedCount = 0;
      let failedCount = 0;

      for (const item of items) {
        setQueue((current) =>
          current.map((queuedItem) =>
            queuedItem.localRecordUuid === item.localRecordUuid
              ? { ...queuedItem, syncStatus: 'syncing' }
              : queuedItem
          )
        );
        try {
          await api.logVisit(token, item.payload);
          didChange = true;
          syncedCount += 1;
          setQueue((current) =>
            current.filter((queuedItem) => queuedItem.localRecordUuid !== item.localRecordUuid)
          );
          setAddressState((current) => ({
            ...current,
            [item.payload.addressId]: {
              result: item.payload.result,
              submittedAt: item.payload.clientCreatedAt,
              synced: true,
              syncStatus: 'synced',
              localRecordUuid: item.localRecordUuid,
              clientCreatedAt: item.payload.clientCreatedAt,
              sessionId: item.payload.sessionId,
              gpsStatus: item.payload.gpsStatus,
              accuracyMeters: item.payload.accuracyMeters ?? null,
            },
          }));
        } catch (error) {
          failedCount += 1;
          setQueue((current) =>
            current.map((queuedItem) =>
              queuedItem.localRecordUuid === item.localRecordUuid
                ? { ...queuedItem, syncStatus: 'failed' }
                : queuedItem
            )
          );
          setAddressState((current) => ({
            ...current,
            [item.payload.addressId]: {
              result: item.payload.result,
              submittedAt: item.payload.clientCreatedAt,
              synced: false,
              syncStatus: 'failed',
              localRecordUuid: item.localRecordUuid,
              clientCreatedAt: item.payload.clientCreatedAt,
              sessionId: item.payload.sessionId,
              gpsStatus: item.payload.gpsStatus,
              accuracyMeters: item.payload.accuracyMeters ?? null,
            },
          }));
          setErrorMessage(getErrorMessage(error));
        }
      }

      if (didChange) {
        if (failedCount > 0) {
          setStatusMessage(
            syncedCount === 1
              ? '1 queued visit synced. Some records still need review.'
              : `${syncedCount} queued visits synced. Some records still need review.`
          );
        } else {
          setStatusMessage(
            syncedCount === 1 ? 'Queued visit synced.' : 'Queued visits synced.'
          );
        }
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
