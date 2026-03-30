import { ForbiddenException } from '@nestjs/common';
import { PoliciesService } from './policies.service';

describe('PoliciesService', () => {
  const prisma = {
    operationalPolicy: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn()
    },
    campaign: {
      findFirst: jest.fn()
    }
  };

  const service = new PoliciesService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.campaign.findFirst.mockResolvedValue({ id: 'campaign-1', organizationId: 'org-1' });
  });

  it('returns environment defaults when no scoped policy record exists', async () => {
    prisma.operationalPolicy.findUnique.mockResolvedValue(null);

    const result = await service.getEffectivePolicy({ organizationId: 'org-1', campaignId: null });

    expect(result).toEqual(
      expect.objectContaining({
        organizationId: 'org-1',
        campaignId: null,
        sourceScope: 'default',
        explicitRecord: false,
        defaultImportProfileCode: 'van_standard',
        defaultImportMode: 'replace_turf_membership',
        defaultDuplicateStrategy: 'skip',
        defaultVanExportProfileCode: 'van_compatible',
        defaultInternalExportProfileCode: 'internal_master',
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
        allowOrgOutcomeFallback: true
      })
    );
  });

  it('inherits organization policy values for a campaign when no override exists', async () => {
    prisma.operationalPolicy.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'policy-org',
        defaultImportProfileCode: 'van_standard',
        defaultImportMode: 'upsert',
        defaultDuplicateStrategy: 'merge',
        defaultVanExportProfileCode: 'van_compatible',
        defaultInternalExportProfileCode: 'internal_master',
        sensitiveMfaWindowMinutes: 12,
        canvasserCorrectionWindowMinutes: 15,
        maxAttemptsPerHousehold: 4,
        minMinutesBetweenAttempts: 8,
        geofenceRadiusFeet: 100,
        gpsLowAccuracyMeters: 40,
        refreshTokenTtlDays: 21,
        activationTokenTtlHours: 72,
        passwordResetTtlMinutes: 45,
        loginLockoutThreshold: 6,
        loginLockoutMinutes: 20,
        mfaChallengeTtlMinutes: 12,
        mfaBackupCodeCount: 12,
        retentionArchiveDays: 30,
        retentionPurgeDays: 90,
        requireArchiveReason: true,
        allowOrgOutcomeFallback: false
      });

    const result = await service.getEffectivePolicy({ organizationId: 'org-1', campaignId: 'campaign-1' });

    expect(result).toEqual(
      expect.objectContaining({
        campaignId: 'campaign-1',
        sourceScope: 'organization',
        explicitRecord: false,
        inheritedFromOrganization: true,
        defaultImportProfileCode: 'van_standard',
        defaultImportMode: 'upsert',
        defaultDuplicateStrategy: 'merge',
        defaultVanExportProfileCode: 'van_compatible',
        defaultInternalExportProfileCode: 'internal_master',
        sensitiveMfaWindowMinutes: 12,
        canvasserCorrectionWindowMinutes: 15,
        maxAttemptsPerHousehold: 4,
        minMinutesBetweenAttempts: 8,
        geofenceRadiusFeet: 100,
        gpsLowAccuracyMeters: 40,
        refreshTokenTtlDays: 21,
        activationTokenTtlHours: 72,
        passwordResetTtlMinutes: 45,
        loginLockoutThreshold: 6,
        loginLockoutMinutes: 20,
        mfaChallengeTtlMinutes: 12,
        mfaBackupCodeCount: 12,
        allowOrgOutcomeFallback: false
      })
    );
  });

  it('blocks campaign-scoped admins from managing another campaign policy', async () => {
    await expect(
      service.resolveTargetScope({ organizationId: 'org-1', campaignId: 'campaign-1' }, 'campaign-2')
    ).rejects.toThrow(ForbiddenException);
  });

  it('upserts an organization policy with validated retention settings', async () => {
    prisma.operationalPolicy.findUnique.mockResolvedValue(null);
    prisma.operationalPolicy.upsert.mockResolvedValue({ id: 'policy-org' });

    const result = await service.upsertPolicy(
      { organizationId: 'org-1', campaignId: null },
      {
        defaultImportProfileCode: 'van_standard',
        defaultImportMode: 'upsert',
        canvasserCorrectionWindowMinutes: 20,
        refreshTokenTtlDays: 30,
        retentionArchiveDays: 30,
        retentionPurgeDays: 90
      }
    );

    expect(prisma.operationalPolicy.upsert).toHaveBeenCalledWith({
      where: {
        scopeKey: 'org-1:org'
      },
      create: expect.objectContaining({
        scopeKey: 'org-1:org',
        organizationId: 'org-1',
        campaignId: null,
        defaultImportProfileCode: 'van_standard',
        defaultImportMode: 'upsert',
        canvasserCorrectionWindowMinutes: 20,
        refreshTokenTtlDays: 30,
        retentionArchiveDays: 30,
        retentionPurgeDays: 90
      }),
      update: expect.objectContaining({
        defaultImportProfileCode: 'van_standard',
        defaultImportMode: 'upsert',
        canvasserCorrectionWindowMinutes: 20,
        refreshTokenTtlDays: 30,
        retentionArchiveDays: 30,
        retentionPurgeDays: 90
      })
    });
    expect(result.defaultImportMode).toBe('replace_turf_membership');
  });

  it('clears a campaign policy and falls back to inherited organization values', async () => {
    prisma.operationalPolicy.deleteMany.mockResolvedValue({ count: 1 });
    prisma.operationalPolicy.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'policy-org',
        defaultImportProfileCode: 'van_standard',
        defaultImportMode: 'upsert',
        defaultDuplicateStrategy: 'merge',
        defaultVanExportProfileCode: 'van_compatible',
        defaultInternalExportProfileCode: 'internal_master',
        sensitiveMfaWindowMinutes: 12,
        canvasserCorrectionWindowMinutes: 15,
        maxAttemptsPerHousehold: 4,
        minMinutesBetweenAttempts: 8,
        geofenceRadiusFeet: 100,
        gpsLowAccuracyMeters: 40,
        refreshTokenTtlDays: 21,
        activationTokenTtlHours: 72,
        passwordResetTtlMinutes: 45,
        loginLockoutThreshold: 6,
        loginLockoutMinutes: 20,
        mfaChallengeTtlMinutes: 12,
        mfaBackupCodeCount: 12,
        retentionArchiveDays: 30,
        retentionPurgeDays: 90,
        requireArchiveReason: true,
        allowOrgOutcomeFallback: false
      });

    const result = await service.clearPolicy({ organizationId: 'org-1', campaignId: null }, 'campaign-1');

    expect(prisma.operationalPolicy.deleteMany).toHaveBeenCalledWith({
      where: {
        scopeKey: 'org-1:campaign-1'
      }
    });
    expect(result.inheritedFromOrganization).toBe(true);
    expect(result.sourceScope).toBe('organization');
  });
});
