import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';

import { api, getErrorMessage } from '../api/client';
import { clearAppCache, clearSession, loadSession, saveAddressState, saveQueue, saveSession } from '../storage';
import type {
  Address,
  AddressState,
  GpsStatus,
  OutcomeDefinition,
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
  outcomes: OutcomeDefinition[];
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
  pauseTurf: () => Promise<void>;
  resumeTurf: () => Promise<void>;
  completeTurf: () => Promise<void>;
  endTurf: () => Promise<void>;
  submitVisit: (addressId: string, outcomeCode: VisitResult, notes?: string) => Promise<void>;
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
const FIELD_ROLE: Role = 'canvasser';
const UNSUPPORTED_ROLE_MESSAGE = 'This mobile app is for canvasser accounts only.';

function isFieldRole(role: Role) {
  return role === FIELD_ROLE;
}

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
  const [outcomes, setOutcomes] = useState<OutcomeDefinition[]>([]);
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
        setQueue(sessionData.queue);
        setAddressState(sessionData.addressState);

        if (sessionData.token) {
          try {
            const [me, snapshot, nextOutcomes] = await Promise.all([
              api.me(sessionData.token),
              api.myTurf(sessionData.token),
              api.listOutcomes(sessionData.token)
            ]);
            if (!mounted) {
              return;
            }

            if (!isFieldRole(me.role)) {
              setErrorMessage(UNSUPPORTED_ROLE_MESSAGE);
              await clearSession();
              setToken(null);
              setUser(null);
              setOutcomes([]);
              setQueue([]);
              setAddressState({});
              return;
            }

            setUser(me);
            setOutcomes(nextOutcomes);
            applySnapshot(snapshot, sessionData.addressState);
          } catch (error) {
            setErrorMessage(getErrorMessage(error));
            await clearSession();
            setToken(null);
            setUser(null);
            setOutcomes([]);
          }
        } else {
          setUser(null);
          setOutcomes([]);
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

  async function performTurfAction(
    request: (authToken: string, payload: { turfId: string; latitude?: number | null; longitude?: number | null }) => Promise<unknown>,
    successMessage: string,
    warningMessage: string
  ) {
    if (!token || !turf) {
      throw new Error('No turf is assigned.');
    }

    setErrorMessage(null);
    const location = await captureLocation();
    await request(token, {
      turfId: turf.id,
      latitude: location.latitude,
      longitude: location.longitude,
    });
    await refreshTurf();
    setStatusMessage(
      location.gpsStatus === 'verified' ? successMessage : warningMessage
    );
  }

  async function login(email: string, password: string) {
    setErrorMessage(null);
    const response = await api.login(email, password);
    const authToken = response.token || response.accessToken;
    if (!authToken) {
      throw new Error('Login response did not include a token.');
    }
    if (!isFieldRole(response.user.role)) {
      throw new Error(UNSUPPORTED_ROLE_MESSAGE);
    }

    setToken(authToken);
    setUser(response.user);
    await saveSession(authToken, response.user);
    const [snapshot, nextOutcomes] = await Promise.all([
      api.myTurf(authToken),
      api.listOutcomes(authToken)
    ]);
    setOutcomes(nextOutcomes);
    applySnapshot(snapshot, addressState);
    setStatusMessage('Signed in. Turf snapshot loaded.');
  }

  async function logout() {
    setToken(null);
    setUser(null);
    setOutcomes([]);
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
    await performTurfAction(
      api.startTurf,
      'Turf started and GPS captured.',
      'Turf started with a GPS warning.'
    );
  }

  async function pauseTurf() {
    await performTurfAction(
      api.pauseTurf,
      'Turf paused and GPS captured.',
      'Turf paused with a GPS warning.'
    );
  }

  async function resumeTurf() {
    await performTurfAction(
      api.resumeTurf,
      'Turf resumed and GPS captured.',
      'Turf resumed with a GPS warning.'
    );
  }

  async function completeTurf() {
    await performTurfAction(
      api.completeTurf,
      'Turf completed and GPS captured.',
      'Turf completed with a GPS warning.'
    );
  }

  async function endTurf() {
    await completeTurf();
  }

  async function submitVisit(addressId: string, outcomeCode: VisitResult, notes?: string) {
    if (!token || !turf) {
      throw new Error('Sign in and load a turf before logging visits.');
    }

    const address = addresses.find((item) => item.id === addressId);
    if (!address) {
      throw new Error('Address not found on this turf.');
    }

    const outcome = outcomes.find((item) => item.code === outcomeCode && item.isActive);
    if (!outcome) {
      throw new Error('The selected visit outcome is not available.');
    }
    if (outcome.requiresNote && !notes?.trim()) {
      throw new Error('Notes are required for the selected visit outcome.');
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
      outcomeCode,
      contactMade: outcomeCode === 'talked_to_voter',
      notes: notes?.trim() || undefined,
      latitude: location.latitude ?? undefined,
      longitude: location.longitude ?? undefined,
      accuracyMeters: location.accuracyMeters ?? undefined,
      gpsStatus: location.gpsStatus,
      gpsFailureReason: location.gpsFailureReason ?? undefined,
      capturedAt: location.capturedAt,
    };

    const localState: AddressState = {
      result: outcome.label,
      outcomeCode,
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
              result: outcomes.find((outcome) => outcome.code === item.payload.outcomeCode)?.label ?? item.payload.outcomeCode,
              outcomeCode: item.payload.outcomeCode,
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
              result: outcomes.find((outcome) => outcome.code === item.payload.outcomeCode)?.label ?? item.payload.outcomeCode,
              outcomeCode: item.payload.outcomeCode,
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
    outcomes,
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
    pauseTurf,
    resumeTurf,
    completeTurf,
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
