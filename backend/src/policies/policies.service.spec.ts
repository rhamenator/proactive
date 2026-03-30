import { ForbiddenException } from '@nestjs/common';
import { PoliciesService } from './policies.service';

describe('PoliciesService', () => {
  const prisma = {
    operationalPolicy: {
      findUnique: jest.fn(),
      upsert: jest.fn()
    },
    campaign: {
      findFirst: jest.fn()
    }
  };

  const service = new PoliciesService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
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
        defaultImportMode: 'create_only',
        defaultDuplicateStrategy: 'skip',
        allowOrgOutcomeFallback: true
      })
    );
  });

  it('inherits organization policy values for a campaign when no override exists', async () => {
    prisma.operationalPolicy.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'policy-org',
        defaultImportMode: 'upsert',
        defaultDuplicateStrategy: 'merge',
        sensitiveMfaWindowMinutes: 12,
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
        defaultImportMode: 'upsert',
        defaultDuplicateStrategy: 'merge',
        sensitiveMfaWindowMinutes: 12,
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
        defaultImportMode: 'upsert',
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
        defaultImportMode: 'upsert',
        retentionArchiveDays: 30,
        retentionPurgeDays: 90
      }),
      update: expect.objectContaining({
        defaultImportMode: 'upsert',
        retentionArchiveDays: 30,
        retentionPurgeDays: 90
      })
    });
    expect(result.defaultImportMode).toBe('create_only');
  });
});
