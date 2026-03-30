import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api, getApiBaseUrl, getConflictReason, getErrorMessage, getSyncStatusForError, isApiError } from './client';

describe('mobile api client', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('uses the default API base URL', () => {
    expect(getApiBaseUrl()).toBe('http://localhost:3001');
  });

  it('sends authenticated turf requests with JSON headers', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ turf: null, session: null, progress: { completed: 0, total: 0, pendingSync: 0 }, addresses: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    await api.myTurf('token-123');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/my-turf', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123'
      }
    });
  });

  it('loads active visit outcomes for the mobile workflow', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: 'outcome-1', code: 'knocked', label: 'Knocked' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const result = await api.listOutcomes('token-123');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/visits/outcomes', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123'
      }
    });
    expect(result).toEqual([{ id: 'outcome-1', code: 'knocked', label: 'Knocked' }]);
  });

  it('posts visit submissions as JSON payloads', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 'visit-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    await api.logVisit('token-123', {
      localRecordUuid: 'local-1',
      idempotencyKey: 'local-1',
      clientCreatedAt: '2026-03-28T10:00:00.000Z',
      submittedAt: '2026-03-28T10:00:00.000Z',
      turfId: 'turf-1',
      sessionId: 'session-1',
      addressId: 'address-1',
      outcomeCode: 'knocked',
      contactMade: true,
      notes: 'Reached voter',
      latitude: 42.96,
      longitude: -85.67,
      accuracyMeters: 8,
      gpsStatus: 'verified',
      capturedAt: '2026-03-28T10:00:00.000Z'
    });

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/visits/log', {
      method: 'POST',
      body: JSON.stringify({
        localRecordUuid: 'local-1',
        idempotencyKey: 'local-1',
        clientCreatedAt: '2026-03-28T10:00:00.000Z',
        submittedAt: '2026-03-28T10:00:00.000Z',
        turfId: 'turf-1',
        sessionId: 'session-1',
        addressId: 'address-1',
        outcomeCode: 'knocked',
        contactMade: true,
        notes: 'Reached voter',
        latitude: 42.96,
        longitude: -85.67,
        accuracyMeters: 8,
        gpsStatus: 'verified',
        capturedAt: '2026-03-28T10:00:00.000Z'
      }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123'
      }
    });
  });

  it('surfaces API errors with status metadata', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const error = await api.me('token-123').catch((value) => value);

    expect(isApiError(error)).toBe(true);
    expect(getErrorMessage(error)).toBe('Unauthorized');
  });

  it('classifies conflict responses and exposes sync conflict reasons', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          message: 'Conflict',
          syncConflictReason: 'assignment_changed'
        }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    );

    const error = await api.me('token-123').catch((value) => value);

    expect(isApiError(error)).toBe(true);
    expect(getSyncStatusForError(error)).toBe('conflict');
    expect(getConflictReason(error)).toBe('assignment_changed');
  });
});
