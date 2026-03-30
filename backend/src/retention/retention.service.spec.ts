import { RetentionService } from './retention.service';

describe('RetentionService', () => {
  const prisma = {
    addressRequest: { count: jest.fn(), deleteMany: jest.fn() },
    importBatch: { count: jest.fn(), deleteMany: jest.fn() },
    exportBatch: { count: jest.fn(), deleteMany: jest.fn() },
    authRefreshToken: { count: jest.fn(), deleteMany: jest.fn() },
    activationToken: { count: jest.fn(), deleteMany: jest.fn() },
    passwordResetToken: { count: jest.fn(), deleteMany: jest.fn() },
    mfaChallengeToken: { count: jest.fn(), deleteMany: jest.fn() },
    mfaBackupCode: { count: jest.fn(), deleteMany: jest.fn() },
    auditLog: { findFirst: jest.fn() },
    $transaction: jest.fn()
  };
  const auditService = { log: jest.fn() };
  const systemSettingsService = {
    getEffectiveSettings: jest.fn().mockResolvedValue({
      authRateLimitWindowMinutes: 15,
      authRateLimitMaxAttempts: 10,
      retentionJobEnabled: false,
      retentionJobIntervalMinutes: 60
    })
  };

  const service = new RetentionService(prisma as never, auditService as never, systemSettingsService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.addressRequest.count.mockResolvedValue(1);
    prisma.importBatch.count.mockResolvedValue(2);
    prisma.exportBatch.count.mockResolvedValue(3);
    prisma.authRefreshToken.count.mockResolvedValue(4);
    prisma.activationToken.count.mockResolvedValue(5);
    prisma.passwordResetToken.count.mockResolvedValue(6);
    prisma.mfaChallengeToken.count.mockResolvedValue(7);
    prisma.mfaBackupCode.count.mockResolvedValue(8);
    prisma.auditLog.findFirst.mockResolvedValue({ createdAt: new Date('2026-03-30T08:00:00.000Z') });
    prisma.addressRequest.deleteMany.mockResolvedValue({ count: 1 });
    prisma.importBatch.deleteMany.mockResolvedValue({ count: 2 });
    prisma.exportBatch.deleteMany.mockResolvedValue({ count: 3 });
    prisma.authRefreshToken.deleteMany.mockResolvedValue({ count: 4 });
    prisma.activationToken.deleteMany.mockResolvedValue({ count: 5 });
    prisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 6 });
    prisma.mfaChallengeToken.deleteMany.mockResolvedValue({ count: 7 });
    prisma.mfaBackupCode.deleteMany.mockResolvedValue({ count: 8 });
    prisma.$transaction.mockImplementation(async (operations: Array<Promise<unknown>>) => Promise.all(operations));
    auditService.log.mockResolvedValue(undefined);
  });

  it('summarizes purgeable records in scope', async () => {
    const result = await service.getSummary({ organizationId: 'org-1', campaignId: null });

    expect(prisma.addressRequest.count).toHaveBeenCalled();
    expect(result.dueNow).toEqual({
      addressRequests: 1,
      importBatches: 2,
      exportBatches: 3,
      refreshTokens: 4,
      activationTokens: 5,
      passwordResetTokens: 6,
      mfaChallenges: 7,
      usedBackupCodes: 8
    });
    expect(result.automation).toEqual({
      enabled: false,
      intervalMinutes: 60
    });
  });

  it('runs a scoped manual cleanup and audits the summary', async () => {
    const result = await service.runCleanup({
      scope: { organizationId: 'org-1', campaignId: null },
      actorUserId: 'admin-1'
    });

    expect(result).toEqual({
      skipped: false,
      scheduled: false,
      summary: {
        addressRequests: 1,
        importBatches: 2,
        exportBatches: 3,
        refreshTokens: 4,
        activationTokens: 5,
        passwordResetTokens: 6,
        mfaChallenges: 7,
        usedBackupCodes: 8
      }
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        actionType: 'retention_cleanup_completed'
      })
    );
  });
});
