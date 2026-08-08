import { describe, expect, it } from 'vitest';

import {
  buildRedactedSyncDiagnosticExport,
  createQueueDiagnostics,
  queueAgeMinutes,
  syncDiagnosticPolicy,
  transitionQueuedVisit
} from './syncDiagnostics';
import type { QueuedVisit } from './types';

function queued(overrides: Partial<QueuedVisit> = {}): QueuedVisit {
  const createdAt = '2026-08-07T12:00:00.000Z';
  return {
    id: 'local-secret-1',
    localRecordUuid: 'local-secret-1',
    createdAt,
    syncStatus: 'pending',
    diagnostics: createQueueDiagnostics(createdAt, false),
    payload: {
      localRecordUuid: 'local-secret-1',
      idempotencyKey: 'idempotency-secret-1',
      clientCreatedAt: createdAt,
      submittedAt: createdAt,
      turfId: 'turf-secret',
      sessionId: 'session-secret',
      addressId: 'address-secret',
      outcomeCode: 'knocked',
      contactMade: false,
      notes: 'Private doorstep note',
      gpsStatus: 'missing',
      capturedAt: createdAt
    },
    addressMeta: {
      addressLine1: '10 Private Street',
      city: 'Detroit',
      state: 'MI',
      zip: '48201',
      vanId: 'VAN-SECRET'
    },
    ...overrides
  };
}

describe('sync diagnostics scenarios', () => {
  it('records an offline dependency without inventing a server acknowledgement', () => {
    const item = queued();
    expect(item.diagnostics.dependencyState).toBe('offline');
    expect(item.diagnostics.serverAcknowledged).toBe(false);
  });

  it('records reconnect attempts and a categorized network failure', () => {
    const syncing = transitionQueuedVisit(queued(), 'syncing', {
      at: '2026-08-07T12:05:00.000Z', isOnline: true
    });
    const failed = transitionQueuedVisit(syncing, 'failed', {
      at: '2026-08-07T12:05:01.000Z', error: new Error('network details must not persist')
    });
    expect(failed.diagnostics.retryCount).toBe(1);
    expect(failed.diagnostics.lastErrorCategory).toBe('network');
    expect(failed.diagnostics.transitions.map(({ status }) => status)).toEqual(['pending', 'syncing', 'failed']);
  });

  it('preserves idempotency during replay while bounding transition history', () => {
    let item = queued();
    for (let index = 0; index < syncDiagnosticPolicy.maxTransitions + 5; index += 1) {
      item = transitionQueuedVisit(item, 'syncing', { at: `2026-08-07T12:${String(index).padStart(2, '0')}:00.000Z`, isOnline: true });
    }
    expect(item.payload.idempotencyKey).toBe('idempotency-secret-1');
    expect(item.diagnostics.transitions).toHaveLength(syncDiagnosticPolicy.maxTransitions);
  });

  it('clamps negative queue age and flags material client clock skew in exports', () => {
    const item = queued({ createdAt: '2026-08-07T13:00:00.000Z' });
    expect(queueAgeMinutes(item, '2026-08-07T12:00:00.000Z')).toBe(0);
    expect(JSON.parse(buildRedactedSyncDiagnosticExport([item], '2026-08-07T12:00:00.000Z')).queue[0].clockSkewDetected).toBe(true);
  });

  it('keeps failed records after a partial batch while successful records can be removed', () => {
    const first = transitionQueuedVisit(queued(), 'syncing', { isOnline: true });
    const second = transitionQueuedVisit(queued({ id: 'local-2', localRecordUuid: 'local-2' }), 'syncing', { isOnline: true });
    const remaining = [first, transitionQueuedVisit(second, 'failed', { error: { status: 503 } })]
      .filter((item) => item.id !== first.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].diagnostics.lastErrorCategory).toBe('server');
    expect(remaining[0].diagnostics.serverAcknowledged).toBe(true);
  });

  it('exports only redacted operational evidence', () => {
    const output = buildRedactedSyncDiagnosticExport([queued()], '2026-08-07T12:10:00.000Z');
    expect(output).toContain('proactive-sync-diagnostics/v1');
    for (const secret of ['Private Street', 'Private doorstep note', 'VAN-SECRET', 'idempotency-secret', 'local-secret', 'address-secret', 'turf-secret']) {
      expect(output).not.toContain(secret);
    }
  });
});
