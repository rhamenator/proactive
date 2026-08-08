import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { RecoveryCaseStatus, RecoveryCaseType, UserRole } from '../../generated/prisma/client.js';
import { RecoveryService } from './recovery.service.js';

describe('RecoveryService', () => {
  const admin = { id: 'admin-1', organizationId: 'org-1', role: UserRole.admin, isActive: true, status: 'active' };
  const reviewer = { ...admin, id: 'admin-2' };
  const target = {
    id: 'user-1', organizationId: 'org-1', role: UserRole.supervisor, campaignId: null,
    email: 'affected@example.test', firstName: 'Affected', lastName: 'User', deletedAt: null
  };
  const prisma = {
    $transaction: jest.fn(),
    user: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    recoveryCase: { findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    authRefreshToken: { updateMany: jest.fn() },
    passwordResetToken: { updateMany: jest.fn(), create: jest.fn() },
    activationToken: { updateMany: jest.fn() },
    mfaChallengeToken: { updateMany: jest.fn() },
    mfaBackupCode: { deleteMany: jest.fn() },
    impersonationSession: { updateMany: jest.fn() }
  };
  const audit = { log: jest.fn() };
  const policies = { getEffectivePolicy: jest.fn().mockResolvedValue({ passwordResetTtlMinutes: 30 }) };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.RECOVERY_NOTIFICATION_WEBHOOK_URL;
    delete process.env.RECOVERY_NOTIFICATION_WEBHOOK_TOKEN;
    delete process.env.BREAK_GLASS_RECOVERY_ENABLED;
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma));
    prisma.recoveryCase.findMany.mockResolvedValue([]);
    prisma.recoveryCase.findUnique.mockResolvedValue({ id: 'case-1', status: RecoveryCaseStatus.executed });
    prisma.user.update.mockResolvedValue(target);
    prisma.authRefreshToken.updateMany.mockResolvedValue({ count: 2 });
    prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.activationToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.mfaChallengeToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.mfaBackupCode.deleteMany.mockResolvedValue({ count: 8 });
    prisma.impersonationSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.recoveryCase.update.mockResolvedValue({ id: 'case-1', status: RecoveryCaseStatus.executed });
  });

  it('prevents a support actor from requesting recovery for their own account', async () => {
    prisma.user.findFirst.mockResolvedValue(admin);
    const service = new RecoveryService(prisma as never, audit as never, policies as never);
    await expect(service.request({
      actorUserId: admin.id,
      targetUserId: admin.id,
      type: RecoveryCaseType.help_desk_mfa_reset,
      reason: 'User reported loss of the enrolled authenticator.'
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires the break-glass path for admin targets and keeps it disabled by default', async () => {
    prisma.user.findFirst
      .mockResolvedValueOnce(admin)
      .mockResolvedValueOnce({ ...target, id: 'admin-target', role: UserRole.admin });
    const service = new RecoveryService(prisma as never, audit as never, policies as never);
    await expect(service.request({
      actorUserId: admin.id,
      targetUserId: 'admin-target',
      type: RecoveryCaseType.break_glass_account_recovery,
      reason: 'Emergency administrator recovery requested by operations.'
    })).rejects.toThrow('Break-glass recovery is disabled');
  });

  it('creates a pending, expiring, audited help-desk case without changing the target account', async () => {
    prisma.user.findFirst.mockResolvedValueOnce(admin).mockResolvedValueOnce(target);
    prisma.recoveryCase.findFirst.mockResolvedValue(null);
    prisma.recoveryCase.create.mockResolvedValue({
      id: 'case-1', status: RecoveryCaseStatus.pending, type: RecoveryCaseType.help_desk_mfa_reset,
      expiresAt: new Date(Date.now() + 30 * 60_000)
    });
    const service = new RecoveryService(prisma as never, audit as never, policies as never);
    const result = await service.request({
      actorUserId: admin.id, targetUserId: target.id, type: RecoveryCaseType.help_desk_mfa_reset,
      reason: 'User reported loss of the enrolled authenticator.'
    });
    expect(result.status).toBe(RecoveryCaseStatus.pending);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'recovery_case_requested' }));
  });

  it('requires a distinct admin to approve a pending case', async () => {
    prisma.user.findFirst.mockResolvedValue(admin);
    prisma.recoveryCase.findFirst.mockResolvedValue({
      id: 'case-1', organizationId: 'org-1', targetUserId: target.id, requestedByUserId: admin.id,
      type: RecoveryCaseType.help_desk_mfa_reset, status: RecoveryCaseStatus.pending,
      expiresAt: new Date(Date.now() + 60_000)
    });
    const service = new RecoveryService(prisma as never, audit as never, policies as never);
    await expect(service.approve({
      actorUserId: admin.id, caseId: 'case-1', reason: 'Identity evidence was independently reviewed and approved.'
    })).rejects.toThrow('A distinct admin must approve');
  });

  it('revokes sessions and recovery artifacts when a distinct admin approves MFA recovery', async () => {
    prisma.user.findFirst.mockResolvedValue(reviewer);
    prisma.user.findUnique.mockResolvedValue(target);
    prisma.recoveryCase.findFirst.mockResolvedValue({
      id: 'case-1', organizationId: 'org-1', targetUserId: target.id, requestedByUserId: admin.id,
      type: RecoveryCaseType.help_desk_mfa_reset, status: RecoveryCaseStatus.pending,
      expiresAt: new Date(Date.now() + 60_000)
    });
    const service = new RecoveryService(prisma as never, audit as never, policies as never);
    await service.approve({
      actorUserId: reviewer.id, caseId: 'case-1', reason: 'Identity evidence was independently reviewed and approved.'
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: target.id },
      data: expect.objectContaining({ mfaEnabled: false, mfaSecret: null, failedLoginAttempts: 0 })
    });
    expect(prisma.authRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: target.id, revokedAt: null },
      data: expect.objectContaining({ revocationReason: 'privileged_recovery' })
    });
    expect(prisma.passwordResetToken.updateMany).toHaveBeenCalled();
    expect(prisma.activationToken.updateMany).toHaveBeenCalled();
    expect(prisma.mfaChallengeToken.updateMany).toHaveBeenCalled();
    expect(prisma.mfaBackupCode.deleteMany).toHaveBeenCalledWith({ where: { userId: target.id } });
    expect(prisma.impersonationSession.updateMany).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'privileged_recovery_executed' }), prisma);
  });

  it('refuses account recovery when no independent notification channel is configured', async () => {
    prisma.user.findFirst.mockResolvedValue(reviewer);
    prisma.user.findUnique.mockResolvedValue(target);
    prisma.recoveryCase.findFirst.mockResolvedValue({
      id: 'case-1', organizationId: 'org-1', targetUserId: target.id, requestedByUserId: admin.id,
      type: RecoveryCaseType.help_desk_account_recovery, status: RecoveryCaseStatus.pending,
      expiresAt: new Date(Date.now() + 60_000)
    });
    const service = new RecoveryService(prisma as never, audit as never, policies as never);
    await expect(service.approve({
      actorUserId: reviewer.id, caseId: 'case-1', reason: 'Identity evidence was independently reviewed and approved.'
    })).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rate-limits repeated recovery requests per actor and target', async () => {
    process.env.RECOVERY_RATE_LIMIT_MAX_ATTEMPTS = '1';
    prisma.user.findFirst.mockResolvedValue(admin);
    const service = new RecoveryService(prisma as never, audit as never, policies as never);
    await expect(service.request({
      actorUserId: admin.id, targetUserId: admin.id, type: RecoveryCaseType.help_desk_mfa_reset,
      reason: 'First suspicious self-recovery request should be denied.'
    })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.request({
      actorUserId: admin.id, targetUserId: admin.id, type: RecoveryCaseType.help_desk_mfa_reset,
      reason: 'Second suspicious self-recovery request should be throttled.'
    })).rejects.toMatchObject({ status: 429 });
    delete process.env.RECOVERY_RATE_LIMIT_MAX_ATTEMPTS;
  });
});
