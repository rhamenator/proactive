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
            user: { id: 'user-1', firstName: 'Alex', lastName: 'Admin', email: 'alex@example.com', role: 'admin' },
            backupCodes: ['ABCD-EF12', '3456-7890']
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ enabled: true, required: true, backupCodeCount: 10 }), {
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
    expect(verified.backupCodes).toEqual(['ABCD-EF12', '3456-7890']);
    expect(status).toEqual({ enabled: true, required: true, backupCodeCount: 10 });
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

  it('posts turf imports to the dedicated imports endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          importBatchId: 'batch-1',
          filename: 'import-batch-2026-03-30.csv',
          mode: 'replace_turf_membership',
          duplicateStrategy: 'merge',
          turfsCreated: 1,
          addressesImported: 2,
          replacedMembershipsRemoved: 3,
          turfs: [{ id: 'turf-1', name: 'North Turf' }]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const file = new File(['address,city,state\n100 Main,Detroit,MI\n'], 'import.csv', {
      type: 'text/csv'
    });

    const result = await createApiClient('token-123').importTurfs({
      file,
      turfName: 'North Turf',
      mapping: JSON.stringify({ addressLine1: 'address' }),
      mode: 'replace_turf_membership',
      duplicateStrategy: 'merge'
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/imports/csv',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer token-123'
        }
      })
    );
    expect(result).toEqual({
      importBatchId: 'batch-1',
      filename: 'import-batch-2026-03-30.csv',
      mode: 'replace_turf_membership',
      duplicateStrategy: 'merge',
      turfsCreated: 1,
      addressesImported: 2,
      replacedMembershipsRemoved: 3,
      turfs: [{ id: 'turf-1', name: 'North Turf' }]
    });
  });

  it('posts turf import preview requests to the preview endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          profileCode: 'van_standard',
          profileName: 'VAN Standard Import',
          mode: 'replace_turf_membership',
          duplicateStrategy: 'merge',
          rowCount: 2,
          headerCount: 3,
          headers: ['address', 'city', 'state'],
          missingHeaders: [],
          missingRequiredMappings: [],
          turfNames: ['North Turf'],
          rowsReady: 2,
          rowsMissingRequired: 0,
          rowsUsingFallbackTurf: 2,
          scope: {
            campaignId: 'campaign-1',
            teamId: null,
            regionCode: null
          },
          sampleRows: [
            {
              rowIndex: 1,
              turfName: 'North Turf',
              addressLine1: '100 Main',
              city: 'Detroit',
              state: 'MI',
              status: 'ready'
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const file = new File(['address,city,state\n100 Main,Detroit,MI\n'], 'import.csv', {
      type: 'text/csv'
    });

    const result = await createApiClient('token-123').previewImportTurfs({
      file,
      turfName: 'North Turf',
      mapping: JSON.stringify({ addressLine1: 'address' }),
      mode: 'replace_turf_membership',
      duplicateStrategy: 'merge'
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/imports/preview',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer token-123'
        }
      })
    );
    expect(result.profileCode).toBe('van_standard');
    expect(result.rowsReady).toBe(2);
  });

  it('downloads CSV profile templates', async () => {
    fetchMock.mockResolvedValue(
      new Response(new Blob(['address_line1,city,state\n']), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="van_standard-template.csv"'
        }
      })
    );

    const result = await createApiClient('token-123').downloadCsvProfileTemplate('import', 'van_standard');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/admin/csv-profiles/template?direction=import&code=van_standard',
      {
        headers: {
          Authorization: 'Bearer token-123'
        }
      }
    );
    expect(result.filename).toBe('van_standard-template.csv');
  });

  it('lists and downloads import history', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: 'batch-1',
              filename: 'import-batch-2026-03-30.csv',
              mode: 'upsert',
              duplicateStrategy: 'merge',
              rowCount: 10,
              importedCount: 8,
              mergedCount: 1,
              removedCount: 2,
              invalidCount: 1,
              duplicateSkippedCount: 0,
              createdAt: '2026-03-30T04:00:00.000Z'
            }
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(new Blob(['address,city,state\n100 Main,Detroit,MI\n']), {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="import-batch-2026-03-30.csv"'
          }
        })
      );

    const client = createApiClient('token-123');
    const history = await client.listImportHistory();
    const download = await client.downloadImportBatch('batch-1');

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://localhost:3001/imports/history', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123'
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://localhost:3001/imports/history/batch-1/download', {
      headers: {
        Authorization: 'Bearer token-123'
      }
    });
    expect(history[0].id).toBe('batch-1');
    expect(download.filename).toBe('import-batch-2026-03-30.csv');
  });

  it('lists and resolves import duplicate reviews', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: 'row-1',
              rowIndex: 4,
              turfName: 'North Turf',
              status: 'pending_review',
              createdAt: '2026-03-30T04:00:00.000Z',
              rawRow: { address_line1: '10 Main St' },
              importBatch: {
                id: 'batch-1',
                filename: 'import-batch-2026-03-30.csv',
                createdAt: '2026-03-30T04:00:00.000Z',
                mode: 'upsert',
                duplicateStrategy: 'review'
              },
              candidateAddress: {
                id: 'address-1',
                addressLine1: '10 Main St',
                city: 'Grand Rapids',
                state: 'MI',
                zip: '49503'
              }
            }
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'row-1',
            status: 'merged',
            resolutionAction: 'merge'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    const client = createApiClient('token-123');
    const queue = await client.listImportReviewQueue({ take: 25 });
    const resolved = await client.resolveImportReview('row-1', 'merge', 'Reviewed duplicate import row');

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://localhost:3001/imports/review-queue?take=25', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123'
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://localhost:3001/imports/review-queue/row-1/resolve', {
      method: 'POST',
      body: JSON.stringify({ action: 'merge', reason: 'Reviewed duplicate import row' }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123'
      }
    });
    expect(queue[0].id).toBe('row-1');
    expect(resolved.status).toBe('merged');
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

  it('supports scoped operational policy requests', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            organizationId: 'org-1',
            campaignId: 'camp-1',
            sourceScope: 'organization',
            explicitRecord: false,
            inheritedFromOrganization: true,
            defaultImportMode: 'create_only',
            defaultDuplicateStrategy: 'skip',
            sensitiveMfaWindowMinutes: 5,
            canvasserCorrectionWindowMinutes: 10,
            maxAttemptsPerHousehold: 3,
            minMinutesBetweenAttempts: 5,
            geofenceRadiusFeet: 75,
            gpsLowAccuracyMeters: 30,
            refreshTokenTtlDays: 14,
            activationTokenTtlHours: 48,
            passwordResetTtlMinutes: 30,
            loginLockoutThreshold: 5,
            loginLockoutMinutes: 15,
            mfaChallengeTtlMinutes: 10,
            mfaBackupCodeCount: 10,
            retentionArchiveDays: 30,
            retentionPurgeDays: 90,
            requireArchiveReason: false,
            allowOrgOutcomeFallback: true
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            organizationId: 'org-1',
            campaignId: 'camp-1',
            sourceScope: 'campaign',
            explicitRecord: true,
            inheritedFromOrganization: false,
            defaultImportMode: 'upsert',
            defaultDuplicateStrategy: 'merge',
            sensitiveMfaWindowMinutes: 15,
            canvasserCorrectionWindowMinutes: 20,
            maxAttemptsPerHousehold: 4,
            minMinutesBetweenAttempts: 10,
            geofenceRadiusFeet: 100,
            gpsLowAccuracyMeters: 40,
            refreshTokenTtlDays: 21,
            activationTokenTtlHours: 72,
            passwordResetTtlMinutes: 45,
            loginLockoutThreshold: 6,
            loginLockoutMinutes: 20,
            mfaChallengeTtlMinutes: 12,
            mfaBackupCodeCount: 12,
            retentionArchiveDays: 45,
            retentionPurgeDays: 120,
            requireArchiveReason: true,
            allowOrgOutcomeFallback: false
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            organizationId: 'org-1',
            campaignId: 'camp-1',
            sourceScope: 'organization',
            explicitRecord: false,
            inheritedFromOrganization: true,
            defaultImportMode: 'create_only',
            defaultDuplicateStrategy: 'skip',
            sensitiveMfaWindowMinutes: 5,
            canvasserCorrectionWindowMinutes: 10,
            maxAttemptsPerHousehold: 3,
            minMinutesBetweenAttempts: 5,
            geofenceRadiusFeet: 75,
            gpsLowAccuracyMeters: 30,
            refreshTokenTtlDays: 14,
            activationTokenTtlHours: 48,
            passwordResetTtlMinutes: 30,
            loginLockoutThreshold: 5,
            loginLockoutMinutes: 15,
            mfaChallengeTtlMinutes: 10,
            mfaBackupCodeCount: 10,
            retentionArchiveDays: 30,
            retentionPurgeDays: 90,
            requireArchiveReason: false,
            allowOrgOutcomeFallback: true
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    const client = createApiClient('token-123');
    const policy = await client.getOperationalPolicy('camp-1');
    const updated = await client.updateOperationalPolicy({
      campaignId: 'camp-1',
      defaultImportMode: 'upsert',
      defaultDuplicateStrategy: 'merge',
      sensitiveMfaWindowMinutes: 15,
      canvasserCorrectionWindowMinutes: 20,
      maxAttemptsPerHousehold: 4,
      minMinutesBetweenAttempts: 10,
      geofenceRadiusFeet: 100,
      gpsLowAccuracyMeters: 40,
      refreshTokenTtlDays: 21,
      activationTokenTtlHours: 72,
      passwordResetTtlMinutes: 45,
      loginLockoutThreshold: 6,
      loginLockoutMinutes: 20,
      mfaChallengeTtlMinutes: 12,
      mfaBackupCodeCount: 12,
      retentionArchiveDays: 45,
      retentionPurgeDays: 120,
      requireArchiveReason: true,
      allowOrgOutcomeFallback: false
    });
    const cleared = await client.clearOperationalPolicy('camp-1');

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://localhost:3001/admin/policies?campaignId=camp-1', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123'
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://localhost:3001/admin/policies', {
      method: 'PUT',
      body: JSON.stringify({
        campaignId: 'camp-1',
        defaultImportMode: 'upsert',
        defaultDuplicateStrategy: 'merge',
        sensitiveMfaWindowMinutes: 15,
        canvasserCorrectionWindowMinutes: 20,
        maxAttemptsPerHousehold: 4,
        minMinutesBetweenAttempts: 10,
        geofenceRadiusFeet: 100,
        gpsLowAccuracyMeters: 40,
        refreshTokenTtlDays: 21,
        activationTokenTtlHours: 72,
        passwordResetTtlMinutes: 45,
        loginLockoutThreshold: 6,
        loginLockoutMinutes: 20,
        mfaChallengeTtlMinutes: 12,
        mfaBackupCodeCount: 12,
        retentionArchiveDays: 45,
        retentionPurgeDays: 120,
        requireArchiveReason: true,
        allowOrgOutcomeFallback: false
      }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123'
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'http://localhost:3001/admin/policies?campaignId=camp-1', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123'
      }
    });
    expect(policy.sourceScope).toBe('organization');
    expect(updated.sourceScope).toBe('campaign');
    expect(cleared.inheritedFromOrganization).toBe(true);
  });

  it('supports retention summary and manual cleanup requests', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            automation: { enabled: false, intervalMinutes: 60 },
            dueNow: {
              addressRequests: 1,
              importBatches: 2,
              importBatchRows: 12,
              exportBatches: 3,
              exportBatchVisits: 9,
              refreshTokens: 4,
              activationTokens: 5,
              passwordResetTokens: 6,
              mfaChallenges: 7,
              usedBackupCodes: 8
            },
            lastRunAt: '2026-03-30T08:00:00.000Z'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            skipped: false,
            scheduled: false,
            summary: {
              addressRequests: 1,
              importBatches: 2,
              importBatchRows: 12,
              exportBatches: 3,
              exportBatchVisits: 9,
              refreshTokens: 4,
              activationTokens: 5,
              passwordResetTokens: 6,
              mfaChallenges: 7,
              usedBackupCodes: 8
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    const client = createApiClient('token-123');
    const summary = await client.retentionSummary();
    const cleanup = await client.runRetentionCleanup();

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://localhost:3001/admin/retention-summary', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123'
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://localhost:3001/admin/retention-run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123'
      }
    });
    expect(summary.dueNow.importBatches).toBe(2);
    expect(cleanup.skipped).toBe(false);
  });

  it('fetches, updates, and clears global system settings', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            explicitRecord: false,
            authRateLimitWindowMinutes: 15,
            authRateLimitMaxAttempts: 10,
            retentionJobEnabled: false,
            retentionJobIntervalMinutes: 60
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'global',
            explicitRecord: true,
            authRateLimitWindowMinutes: 20,
            authRateLimitMaxAttempts: 12,
            retentionJobEnabled: true,
            retentionJobIntervalMinutes: 30
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            explicitRecord: false,
            authRateLimitWindowMinutes: 15,
            authRateLimitMaxAttempts: 10,
            retentionJobEnabled: false,
            retentionJobIntervalMinutes: 60
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    const client = createApiClient('token-123');
    const initial = await client.getSystemSettings();
    const updated = await client.updateSystemSettings({
      authRateLimitWindowMinutes: 20,
      authRateLimitMaxAttempts: 12,
      retentionJobEnabled: true,
      retentionJobIntervalMinutes: 30
    });
    const cleared = await client.clearSystemSettings();

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://localhost:3001/admin/system-settings', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123'
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://localhost:3001/admin/system-settings', {
      method: 'PUT',
      body: JSON.stringify({
        authRateLimitWindowMinutes: 20,
        authRateLimitMaxAttempts: 12,
        retentionJobEnabled: true,
        retentionJobIntervalMinutes: 30
      }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123'
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'http://localhost:3001/admin/system-settings', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123'
      }
    });
    expect(initial.explicitRecord).toBe(false);
    expect(updated.retentionJobEnabled).toBe(true);
    expect(cleared.authRateLimitMaxAttempts).toBe(10);
  });

  it('supports field-user and turf archive/delete admin requests', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'user-1', status: 'archived' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'user-1', status: 'deleted' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'turf-1', status: 'archived' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'turf-1', status: 'archived', deletedAt: '2026-03-30T00:00:00.000Z' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );

    const client = createApiClient('token-123');
    await client.archiveCanvasser('user-1', 'No longer active');
    await client.deleteCanvasser('user-1', 'Created in error');
    await client.archiveTurf('turf-1', 'Closed after review');
    await client.deleteTurf('turf-1', 'Superseded');

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://localhost:3001/admin/canvassers/user-1/archive', {
      method: 'PATCH',
      body: JSON.stringify({ reason: 'No longer active' }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123'
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://localhost:3001/admin/canvassers/user-1/delete', {
      method: 'PATCH',
      body: JSON.stringify({ reason: 'Created in error' }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123'
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'http://localhost:3001/admin/turfs/turf-1/archive', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Closed after review' }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123'
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, 'http://localhost:3001/admin/turfs/turf-1/delete', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Superseded' }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123'
      }
    });
  });

  it('supports campaign-aware reports and export downloads', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 'camp-1', code: 'spring', name: 'Spring Campaign' }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ summary: { days: 1, totalVisits: 2, averageVisitsPerDay: 2 }, byDay: [], byOutcome: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ summary: { totalResolved: 1 }, rows: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ summary: { totalBatches: 1, totalRows: 3, artifactBackedBatches: 1, byProfile: [] }, rows: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
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
      )
      .mockResolvedValueOnce(
        new Response('historical-csv', {
          status: 200,
          headers: {
            'content-disposition': 'attachment; filename="export-batch-1.csv"',
            'X-Export-Checksum': 'abc123'
          }
        })
      );

    const client = createApiClient('token-123');
    const campaigns = await client.listCampaigns();
    const trends = await client.reportsTrends({ campaignId: 'camp-1', outcomeCode: 'knocked', overrideFlag: true });
    const resolvedConflicts = await client.reportsResolvedConflicts({ campaignId: 'camp-1' });
    const exportAnalytics = await client.reportsExportBatches({ campaignId: 'camp-1' });
    const exportResult = await client.exportInternalMaster({ turfId: 'turf-1' });
    const history = await client.listExportHistory();
    const historicalDownload = await client.downloadExportBatch('batch-1');

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://localhost:3001/admin/campaigns', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123'
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3001/reports/trends?campaignId=camp-1&outcomeCode=knocked&overrideFlag=true',
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-123'
        }
      }
    );
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'http://localhost:3001/reports/resolved-conflicts?campaignId=camp-1', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123'
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, 'http://localhost:3001/reports/export-batches?campaignId=camp-1', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123'
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(5, 'http://localhost:3001/exports/internal-master?turfId=turf-1', {
      headers: {
        Authorization: 'Bearer token-123'
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(6, 'http://localhost:3001/exports/history', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123'
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(7, 'http://localhost:3001/exports/history/batch-1/download', {
      headers: {
        Authorization: 'Bearer token-123'
      }
    });
    expect(campaigns).toEqual([{ id: 'camp-1', code: 'spring', name: 'Spring Campaign' }]);
    expect(trends.summary.totalVisits).toBe(2);
    expect(resolvedConflicts.summary.totalResolved).toBe(1);
    expect(exportAnalytics.summary.totalBatches).toBe(1);
    expect(exportResult.filename).toBe('internal-master-2026-03-28.csv');
    expect(history).toEqual([{ id: 'batch-1', profileCode: 'internal_master' }]);
    expect(historicalDownload.filename).toBe('export-batch-1.csv');
    expect(historicalDownload.blob.size).toBe(14);
  });

  it('exposes a stable fallback for unknown thrown values', () => {
    expect(getErrorMessage(new ApiError('Boom', 500))).toBe('Boom');
    expect(getErrorMessage('bad')).toBe('Something went wrong');
  });
});
