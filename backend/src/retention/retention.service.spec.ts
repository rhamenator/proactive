import { jest } from '@jest/globals';
import { RetentionService } from './retention.service.js';

describe('RetentionService', () => {
  const prisma = {
    user: { count: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
    visitLog: { count: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
    addressRequest: { count: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn() },
    importBatch: { count: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
    importBatchRow: { count: jest.fn(), updateMany: jest.fn() },
    exportBatch: { count: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
    exportBatchVisit: { count: jest.fn(), updateMany: jest.fn() },
    authRefreshToken: { count: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn() },
    activationToken: { count: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn() },
    passwordResetToken: { count: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn() },
    mfaChallengeToken: { count: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn() },
    mfaBackupCode: { count: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn() },
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
    delete process.env.RETENTION_EXCLUDED_ENTITY_TYPES;
    delete process.env.RETENTION_BATCH_SIZE;
    prisma.user.count.mockResolvedValue(2);
    prisma.visitLog.count.mockResolvedValue(3);
    prisma.addressRequest.count.mockResolvedValue(1);
    prisma.importBatch.count.mockResolvedValue(2);
    prisma.importBatchRow.count.mockResolvedValue(12);
    prisma.exportBatch.count.mockResolvedValue(3);
    prisma.exportBatchVisit.count.mockResolvedValue(9);
    prisma.authRefreshToken.count.mockResolvedValue(4);
    prisma.activationToken.count.mockResolvedValue(5);
    prisma.passwordResetToken.count.mockResolvedValue(6);
    prisma.mfaChallengeToken.count.mockResolvedValue(7);
    prisma.mfaBackupCode.count.mockResolvedValue(8);
    prisma.auditLog.findFirst.mockResolvedValue({ createdAt: new Date('2026-03-30T08:00:00.000Z') });
    prisma.user.findMany.mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }]);
    prisma.visitLog.findMany.mockResolvedValue([{ id: 'visit-1' }, { id: 'visit-2' }, { id: 'visit-3' }]);
    prisma.addressRequest.findMany.mockResolvedValue([{ id: 'request-1' }]);
    prisma.importBatch.findMany.mockResolvedValue([{ id: 'import-1' }, { id: 'import-2' }]);
    prisma.exportBatch.findMany.mockResolvedValue([{ id: 'export-1' }, { id: 'export-2' }, { id: 'export-3' }]);
    prisma.authRefreshToken.findMany.mockResolvedValue([{ id: 'refresh-1' }]);
    prisma.activationToken.findMany.mockResolvedValue([{ id: 'activation-1' }]);
    prisma.passwordResetToken.findMany.mockResolvedValue([{ id: 'reset-1' }]);
    prisma.mfaChallengeToken.findMany.mockResolvedValue([{ id: 'challenge-1' }]);
    prisma.mfaBackupCode.findMany.mockResolvedValue([{ id: 'backup-1' }]);
    prisma.user.updateMany.mockResolvedValue({ count: 2 });
    prisma.visitLog.updateMany.mockResolvedValue({ count: 3 });
    prisma.addressRequest.deleteMany.mockResolvedValue({ count: 1 });
    prisma.importBatchRow.updateMany.mockResolvedValue({ count: 12 });
    prisma.importBatch.updateMany.mockResolvedValue({ count: 2 });
    prisma.exportBatchVisit.updateMany.mockResolvedValue({ count: 9 });
    prisma.exportBatch.updateMany.mockResolvedValue({ count: 3 });
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
      usersToArchive: 2,
      visitLogsToRedact: 3,
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
    });
    expect(result.automation).toEqual({
      enabled: false,
      intervalMinutes: 60
    });
    expect(result.policy).toEqual({ batchSize: 500, excludedEntityTypes: [], stages: ['archive', 'redact', 'purge'] });
  });

  it('runs a scoped manual cleanup and audits the summary', async () => {
    const result = await service.runCleanup({
      scope: { organizationId: 'org-1', campaignId: null },
      actorUserId: 'admin-1',
      reason: 'Quarterly policy execution'
    });

    expect(result).toEqual({
      skipped: false,
      scheduled: false,
      planned: {
        usersToArchive: 2,
        visitLogsToRedact: 3,
        addressRequests: 1,
        importBatches: 2,
        exportBatches: 3,
        refreshTokens: 1,
        activationTokens: 1,
        passwordResetTokens: 1,
        mfaChallenges: 1,
        usedBackupCodes: 1
      },
      summary: {
        usersArchived: 2,
        visitLogsRedacted: 3,
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
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        actionType: 'retention_cleanup_completed'
      })
    );
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 'admin-1',
      actionType: 'retention_cleanup_planned',
      reasonText: 'Quarterly policy execution'
    }));
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: 'org-1' }),
      take: 500
    }));
  });

  it('honors explicit entity exclusions in both preview and execution', async () => {
    process.env.RETENTION_EXCLUDED_ENTITY_TYPES = 'visitLogs,addressRequests';

    const preview = await service.getSummary({ organizationId: 'org-1', campaignId: null });
    const result = await service.runCleanup({
      scope: { organizationId: 'org-1', campaignId: null },
      actorUserId: 'admin-1',
      reason: 'Legal review exclusion'
    });

    expect(preview.dueNow.visitLogsToRedact).toBe(0);
    expect(preview.dueNow.addressRequests).toBe(0);
    expect(result.planned.visitLogsToRedact).toBe(0);
    expect(result.planned.addressRequests).toBe(0);
    expect(prisma.visitLog.findMany).not.toHaveBeenCalled();
    expect(prisma.addressRequest.findMany).not.toHaveBeenCalled();
  });

  it('audits a partial failure and releases the retry guard', async () => {
    prisma.$transaction.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(service.runCleanup({
      scope: { organizationId: 'org-1', campaignId: null },
      actorUserId: 'admin-1',
      reason: 'Failure-path test'
    })).rejects.toThrow('database unavailable');

    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'retention_cleanup_failed',
      newValuesJson: { errorCategory: 'Error' }
    }));

    const retry = await service.runCleanup({
      scope: { organizationId: 'org-1', campaignId: null },
      actorUserId: 'admin-1',
      reason: 'Retry after failure'
    });
    expect(retry.skipped).toBe(false);
  });
});
