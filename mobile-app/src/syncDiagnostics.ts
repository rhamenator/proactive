import type {
  QueueDiagnostics,
  QueuedVisit,
  SyncDependencyState,
  SyncErrorCategory,
  SyncTransition,
  VisitSyncStatus
} from './types';

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

export const syncDiagnosticPolicy = {
  maxTransitions: boundedInteger(process.env.EXPO_PUBLIC_SYNC_DIAGNOSTIC_MAX_TRANSITIONS, 12, 3, 50),
  retentionDays: boundedInteger(process.env.EXPO_PUBLIC_SYNC_DIAGNOSTIC_RETENTION_DAYS, 14, 1, 90)
};

export function createQueueDiagnostics(at: string, isOnline: boolean): QueueDiagnostics {
  const dependencyState: SyncDependencyState = isOnline ? 'reachable' : 'offline';
  return {
    retryCount: 0,
    lastAttemptAt: null,
    lastErrorCategory: null,
    dependencyState,
    serverAcknowledged: false,
    transitions: [{ at, status: 'pending', dependencyState, serverAcknowledged: false }]
  };
}

function validIso(value: unknown) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

export function normalizeQueueDiagnostics(value: unknown, createdAt: string): QueueDiagnostics {
  if (!value || typeof value !== 'object') return createQueueDiagnostics(createdAt, false);
  const raw = value as Record<string, unknown>;
  const dependencyState = normalizeDependencyState(raw.dependencyState);
  const transitions = Array.isArray(raw.transitions)
    ? raw.transitions
        .map((transition): SyncTransition | null => {
          if (!transition || typeof transition !== 'object') return null;
          const item = transition as Record<string, unknown>;
          const at = validIso(item.at);
          const status = normalizeStatus(item.status);
          if (!at || !status) return null;
          return {
            at,
            status,
            dependencyState: normalizeDependencyState(item.dependencyState),
            serverAcknowledged: item.serverAcknowledged === true,
            errorCategory: normalizeErrorCategory(item.errorCategory)
          };
        })
        .filter((item): item is SyncTransition => item !== null)
    : [];
  return {
    retryCount: Math.max(0, Number.isInteger(raw.retryCount) ? Number(raw.retryCount) : 0),
    lastAttemptAt: validIso(raw.lastAttemptAt),
    lastErrorCategory: normalizeErrorCategory(raw.lastErrorCategory),
    dependencyState,
    serverAcknowledged: raw.serverAcknowledged === true,
    transitions: pruneTransitions(
      transitions.length ? transitions : createQueueDiagnostics(createdAt, dependencyState !== 'offline').transitions,
      new Date().toISOString()
    )
  };
}

function normalizeStatus(value: unknown): VisitSyncStatus | null {
  return value === 'pending' || value === 'syncing' || value === 'synced' || value === 'failed' || value === 'conflict'
    ? value
    : null;
}

function normalizeDependencyState(value: unknown): SyncDependencyState {
  return value === 'offline' || value === 'reachable' || value === 'auth_required' || value === 'server_rejected' || value === 'conflict_review'
    ? value
    : 'offline';
}

function normalizeErrorCategory(value: unknown): SyncErrorCategory | null {
  return value === 'network' || value === 'authentication' || value === 'authorization' || value === 'validation' || value === 'rate_limited' || value === 'server' || value === 'conflict' || value === 'unknown'
    ? value
    : null;
}

export function classifySyncError(error: unknown): SyncErrorCategory {
  const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: unknown }).status) : 0;
  if (status === 0) return 'network';
  if (status === 401) return 'authentication';
  if (status === 403) return 'authorization';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rate_limited';
  if (status >= 400 && status < 500) return 'validation';
  if (status >= 500) return 'server';
  return 'unknown';
}

export function serverAcknowledgedError(error: unknown) {
  return typeof error === 'object' && error !== null && 'status' in error && Number((error as { status?: unknown }).status) > 0;
}

function dependencyFor(category: SyncErrorCategory): SyncDependencyState {
  if (category === 'network') return 'offline';
  if (category === 'authentication') return 'auth_required';
  if (category === 'conflict') return 'conflict_review';
  return 'server_rejected';
}

function pruneTransitions(transitions: SyncTransition[], now: string) {
  const cutoff = Date.parse(now) - syncDiagnosticPolicy.retentionDays * 86_400_000;
  const retained = transitions.filter((transition) => Date.parse(transition.at) >= cutoff);
  return retained.slice(-syncDiagnosticPolicy.maxTransitions);
}

export function transitionQueuedVisit(
  item: QueuedVisit,
  status: VisitSyncStatus,
  input: { at?: string; isOnline?: boolean; error?: unknown; serverAcknowledged?: boolean } = {}
): QueuedVisit {
  const at = input.at ?? new Date().toISOString();
  const errorCategory = input.error === undefined ? null : classifySyncError(input.error);
  const dependencyState = errorCategory
    ? dependencyFor(errorCategory)
    : input.isOnline === false
      ? 'offline'
      : 'reachable';
  const serverAcknowledged = input.serverAcknowledged ?? (input.error === undefined ? false : serverAcknowledgedError(input.error));
  const transition: SyncTransition = { at, status, errorCategory, dependencyState, serverAcknowledged };
  return {
    ...item,
    syncStatus: status,
    diagnostics: {
      ...item.diagnostics,
      retryCount: item.diagnostics.retryCount + (status === 'syncing' ? 1 : 0),
      lastAttemptAt: status === 'syncing' ? at : item.diagnostics.lastAttemptAt,
      lastErrorCategory: errorCategory ?? (status === 'syncing' ? null : item.diagnostics.lastErrorCategory),
      dependencyState,
      serverAcknowledged,
      transitions: pruneTransitions([...item.diagnostics.transitions, transition], at)
    }
  };
}

export function queueAgeMinutes(item: QueuedVisit, now = new Date().toISOString()) {
  return Math.max(0, Math.floor((Date.parse(now) - Date.parse(item.createdAt)) / 60_000));
}

export function buildRedactedSyncDiagnosticExport(queue: QueuedVisit[], now = new Date().toISOString()) {
  return JSON.stringify({
    schema: 'proactive-sync-diagnostics/v1',
    generatedAt: now,
    policy: syncDiagnosticPolicy,
    queue: queue.map((item, index) => ({
      item: index + 1,
      status: item.syncStatus,
      queueAgeMinutes: queueAgeMinutes(item, now),
      retryCount: item.diagnostics.retryCount,
      lastAttemptAt: item.diagnostics.lastAttemptAt,
      lastErrorCategory: item.diagnostics.lastErrorCategory,
      dependencyState: item.diagnostics.dependencyState,
      serverAcknowledged: item.diagnostics.serverAcknowledged,
      clockSkewDetected: Date.parse(item.createdAt) > Date.parse(now) + 5 * 60_000,
      transitions: item.diagnostics.transitions
    }))
  }, null, 2);
}
