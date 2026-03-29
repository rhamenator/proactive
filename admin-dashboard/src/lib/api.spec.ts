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
    expect('mfaRequired' in result && result.mfaRequired).toBe(false);
    if ('mfaRequired' in result && result.mfaRequired) {
      throw new Error('Expected a direct session response');
    }
    expect(result.accessToken).toBe('token-1');
  });

  it('supports MFA challenge, setup, verification, and status requests', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            mfaRequired: true,
            setupRequired: true,
            challengeToken: 'challenge-1',
            role: 'admin',
            user: { id: 'user-1', firstName: 'Alex', lastName: 'Admin', email: 'alex@example.com', role: 'admin' }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ secret: 'SECRET123', otpauthUri: 'otpauth://totp/test' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessToken: 'token-2',
            role: 'admin',
            user: { id: 'user-1', firstName: 'Alex', lastName: 'Admin', email: 'alex@example.com', role: 'admin' }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ enabled: true, required: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, setupRequiredOnNextLogin: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );

    const publicClient = createApiClient();
    const authedClient = createApiClient('token-2');
    const challenge = await publicClient.login('alex@example.com', 'Password123!');
    const setup = await publicClient.mfaSetupInit('challenge-1');
    const verified = await publicClient.mfaSetupComplete('challenge-1', '123456');
    const status = await authedClient.mfaStatus();
    const disabled = await authedClient.disableMfa('Password123!', '654321');

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://localhost:3001/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'alex@example.com', password: 'Password123!' }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://localhost:3001/auth/mfa/setup/init', {
      method: 'POST',
      body: JSON.stringify({ challengeToken: 'challenge-1' }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'http://localhost:3001/auth/mfa/setup/complete', {
      method: 'POST',
      body: JSON.stringify({ challengeToken: 'challenge-1', code: '123456' }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, 'http://localhost:3001/auth/mfa/status', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-2'
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(5, 'http://localhost:3001/auth/mfa/disable', {
      method: 'POST',
      body: JSON.stringify({ password: 'Password123!', code: '654321' }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-2'
      }
    });
    expect(challenge).toEqual(
      expect.objectContaining({
        mfaRequired: true,
        challengeToken: 'challenge-1'
      })
    );
    expect(setup.secret).toBe('SECRET123');
    expect(verified.accessToken).toBe('token-2');
    expect(status).toEqual({ enabled: true, required: true });
    expect(disabled).toEqual({ success: true, setupRequiredOnNextLogin: true });
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

  it('supports outcome, GPS review, and sync conflict admin requests', async () => {
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
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 'visit-1', syncStatus: 'conflict', syncConflictFlag: true }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'visit-1', syncStatus: 'synced', syncConflictFlag: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );

    const client = createApiClient('token-123');
    const outcomes = await client.listOutcomeDefinitions();
    const override = await client.overrideGpsResult('visit-1', 'Supervisor confirmed the doorstep');
    const conflicts = await client.syncConflictQueue();
    const resolved = await client.resolveSyncConflict('visit-1', 'Reviewed duplicate submission');

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
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'http://localhost:3001/admin/sync-conflicts', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123'
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, 'http://localhost:3001/admin/sync-conflicts/visit-1/resolve', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Reviewed duplicate submission' }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123'
      }
    });
    expect(outcomes[0].code).toBe('knocked');
    expect(override).toEqual({ id: 'geo-1', visitLogId: 'visit-1' });
    expect(conflicts[0].syncStatus).toBe('conflict');
    expect(resolved.syncStatus).toBe('synced');
  });

  it('supports internal export downloads and export history lookups', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response('csv-body', {
          status: 200,
          headers: {
            'content-disposition': 'attachment; filename="internal-master-2026-03-28.csv"'
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 'batch-1', profileCode: 'internal_master' }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );

    const client = createApiClient('token-123');
    const exportResult = await client.exportInternalMaster({ turfId: 'turf-1' });
    const history = await client.listExportHistory();

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://localhost:3001/exports/internal-master?turfId=turf-1', {
      headers: {
        Authorization: 'Bearer token-123'
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://localhost:3001/exports/history', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123'
      }
    });
    expect(exportResult.filename).toBe('internal-master-2026-03-28.csv');
    expect(history).toEqual([{ id: 'batch-1', profileCode: 'internal_master' }]);
  });

  it('exposes a stable fallback for unknown thrown values', () => {
    expect(getErrorMessage(new ApiError('Boom', 500))).toBe('Boom');
    expect(getErrorMessage('bad')).toBe('Something went wrong');
  });
});
