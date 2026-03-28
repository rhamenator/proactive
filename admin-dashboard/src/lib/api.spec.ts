import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, createApiClient, getBaseUrl, getErrorMessage } from './api';

describe('admin api client', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('uses the default base URL when no env override is provided', () => {
    expect(getBaseUrl()).toBe('http://localhost:3001');
  });

  it('sends JSON requests and returns parsed login responses', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          accessToken: 'token-1',
          role: 'admin',
          user: { id: 'user-1', firstName: 'Alex', lastName: 'Admin', email: 'alex@example.com', role: 'admin' }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const result = await createApiClient().login('alex@example.com', 'Password123!');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'alex@example.com', password: 'Password123!' }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
    expect(result.accessToken).toBe('token-1');
  });

  it('adds the bearer token to authenticated requests', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'user-1',
          firstName: 'Alex',
          lastName: 'Admin',
          email: 'alex@example.com',
          role: 'admin',
          isActive: true,
          status: 'active',
          mfaEnabled: false,
          invitedAt: null,
          activatedAt: null,
          lastLoginAt: null,
          createdAt: '2026-03-28T00:00:00.000Z'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await createApiClient('token-123').me();

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/me', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123'
      }
    });
  });

  it('normalizes API errors from structured JSON payloads', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: ['Email is required', 'Password is required'] }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    await expect(createApiClient().login('', '')).rejects.toEqual(
      expect.objectContaining({
        name: 'ApiError',
        message: 'Email is required, Password is required',
        status: 400
      })
    );
  });

  it('parses export filenames from the content disposition header', async () => {
    fetchMock.mockResolvedValue(
      new Response('csv-body', {
        status: 200,
        headers: {
          'content-disposition': 'attachment; filename="van-results-2026-03-28.csv"'
        }
      })
    );

    const result = await createApiClient('token-123').exportVanResults({
      turfId: 'turf-1',
      markExported: true
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/exports/van-results?turfId=turf-1&markExported=true',
      {
        headers: {
          Authorization: 'Bearer token-123'
        }
      }
    );
    expect(result.filename).toBe('van-results-2026-03-28.csv');
    expect(result.blob.size).toBe(8);
  });

  it('supports outcome and GPS review admin requests', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 'outcome-1', code: 'knocked', label: 'Knocked' }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'geo-1', visitLogId: 'visit-1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );

    const client = createApiClient('token-123');
    const outcomes = await client.listOutcomeDefinitions();
    const override = await client.overrideGpsResult('visit-1', 'Supervisor confirmed the doorstep');

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://localhost:3001/admin/outcomes', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123'
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://localhost:3001/admin/gps-review/visit-1/override', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Supervisor confirmed the doorstep' }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123'
      }
    });
    expect(outcomes[0].code).toBe('knocked');
    expect(override).toEqual({ id: 'geo-1', visitLogId: 'visit-1' });
  });

  it('exposes a stable fallback for unknown thrown values', () => {
    expect(getErrorMessage(new ApiError('Boom', 500))).toBe('Boom');
    expect(getErrorMessage('bad')).toBe('Something went wrong');
  });
});
