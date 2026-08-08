import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { RecoveryCaseStatus, RecoveryCaseType, RecoveryNotificationStatus, UserRole, type Prisma } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { PoliciesService } from '../policies/policies.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Attempt = { count: number; resetAt: number };

@Injectable()
export class RecoveryService {
  private readonly attempts = new Map<string, Attempt>();
  private readonly maxAttempts = this.integerEnv('RECOVERY_RATE_LIMIT_MAX_ATTEMPTS', 5, 1, 20);
  private readonly windowMinutes = this.integerEnv('RECOVERY_RATE_LIMIT_WINDOW_MINUTES', 60, 1, 1440);
  private readonly caseTtlMinutes = this.integerEnv('RECOVERY_CASE_TTL_MINUTES', 30, 5, 240);
  private readonly notificationWebhook = process.env.RECOVERY_NOTIFICATION_WEBHOOK_URL?.trim() || null;
  private readonly notificationToken = process.env.RECOVERY_NOTIFICATION_WEBHOOK_TOKEN?.trim() || null;
  private readonly breakGlassEnabled = process.env.BREAK_GLASS_RECOVERY_ENABLED === 'true';

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly policies: PoliciesService
  ) {}

  private integerEnv(name: string, fallback: number, min: number, max: number) {
    const parsed = Number(process.env[name]);
    return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  }

  private async rateLimit(key: string) {
    const now = Date.now();
    const current = this.attempts.get(key);
    if (!current || current.resetAt <= now) {
      this.attempts.set(key, { count: 1, resetAt: now + this.windowMinutes * 60_000 });
      return;
    }
    if (current.count >= this.maxAttempts) throw new HttpException('Recovery attempt limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    current.count += 1;
  }

  private reason(value: string | undefined, label: string) {
    const normalized = value?.trim() ?? '';
    if (normalized.length < 10 || normalized.length > 1000) {
      throw new BadRequestException(`${label} must be between 10 and 1000 characters`);
    }
    return normalized;
  }

  private async actor(actorUserId: string) {
    const actor = await this.prisma.user.findFirst({
      where: { id: actorUserId, role: UserRole.admin, isActive: true, status: 'active', deletedAt: null }
    });
    if (!actor?.organizationId) throw new ForbiddenException('Recovery requires an active organization admin');
    return { ...actor, organizationId: actor.organizationId };
  }

  private safeInclude = {
    targetUser: { select: { id: true, firstName: true, lastName: true, email: true, role: true, status: true, mfaEnabled: true } },
    requestedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
    reviewedByUser: { select: { id: true, firstName: true, lastName: true, email: true } }
  } satisfies Prisma.RecoveryCaseInclude;

  async list(actorUserId: string) {
    const actor = await this.actor(actorUserId);
    await this.expireStale(actor.organizationId);
    return this.prisma.recoveryCase.findMany({
      where: { organizationId: actor.organizationId },
      include: this.safeInclude,
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async listTargets(actorUserId: string) {
    const actor = await this.actor(actorUserId);
    return this.prisma.user.findMany({
      where: { organizationId: actor.organizationId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, status: true, mfaEnabled: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    });
  }

  private async expireStale(organizationId: string) {
    const stale = await this.prisma.recoveryCase.findMany({
      where: { organizationId, status: RecoveryCaseStatus.pending, expiresAt: { lte: new Date() } },
      select: { id: true, targetUserId: true }
    });
    for (const recovery of stale) {
      await this.prisma.$transaction(async (tx) => {
        await tx.recoveryCase.update({ where: { id: recovery.id }, data: { status: RecoveryCaseStatus.expired } });
        await this.audit.log({
          organizationId, actionType: 'recovery_case_expired', entityType: 'recovery_case', entityId: recovery.id,
          newValuesJson: { targetUserId: recovery.targetUserId, status: RecoveryCaseStatus.expired }
        }, tx);
      });
    }
  }

  async request(input: { actorUserId: string; targetUserId: string; type: RecoveryCaseType; reason: string }) {
    const actor = await this.actor(input.actorUserId);
    await this.rateLimit(`request:${actor.id}:${input.targetUserId}`);
    if (actor.id === input.targetUserId) throw new ForbiddenException('Support actors cannot recover their own account');
    const target = await this.prisma.user.findFirst({
      where: { id: input.targetUserId, organizationId: actor.organizationId, deletedAt: null }
    });
    if (!target) throw new NotFoundException('Recovery target not found in your organization');
    if (input.type === RecoveryCaseType.break_glass_account_recovery) {
      if (!this.breakGlassEnabled) throw new ForbiddenException('Break-glass recovery is disabled');
    } else if (target.role === UserRole.admin) {
      throw new ForbiddenException('Admin accounts require the break-glass recovery path');
    }
    if (!Object.values(RecoveryCaseType).includes(input.type)) throw new BadRequestException('Unsupported recovery type');
    const reasonText = this.reason(input.reason, 'Recovery reason');
    const existing = await this.prisma.recoveryCase.findFirst({
      where: { targetUserId: target.id, status: RecoveryCaseStatus.pending, expiresAt: { gt: new Date() } }
    });
    if (existing) throw new ConflictException('A pending recovery case already exists for this account');
    const recovery = await this.prisma.recoveryCase.create({
      data: {
        organizationId: actor.organizationId,
        targetUserId: target.id,
        requestedByUserId: actor.id,
        type: input.type,
        reasonText,
        notificationStatus: this.notificationWebhook ? RecoveryNotificationStatus.pending : RecoveryNotificationStatus.not_configured,
        expiresAt: new Date(Date.now() + this.caseTtlMinutes * 60_000)
      },
      include: this.safeInclude
    });
    await this.audit.log({
      actorUserId: actor.id, organizationId: actor.organizationId, actionType: 'recovery_case_requested', entityType: 'recovery_case', entityId: recovery.id,
      reasonText, newValuesJson: { targetUserId: target.id, type: input.type, expiresAt: recovery.expiresAt.toISOString() }
    });
    return recovery;
  }

  async reject(input: { actorUserId: string; caseId: string; reason: string }) {
    const actor = await this.actor(input.actorUserId);
    const reviewReason = this.reason(input.reason, 'Review reason');
    const existing = await this.prisma.recoveryCase.findFirst({
      where: { id: input.caseId, organizationId: actor.organizationId, status: RecoveryCaseStatus.pending }
    });
    if (!existing) throw new NotFoundException('Pending recovery case not found');
    const updated = await this.prisma.recoveryCase.update({
      where: { id: existing.id },
      data: { status: RecoveryCaseStatus.rejected, reviewedByUserId: actor.id, reviewedAt: new Date(), reviewReason },
      include: this.safeInclude
    });
    await this.audit.log({
      actorUserId: actor.id, organizationId: actor.organizationId, actionType: 'recovery_case_rejected', entityType: 'recovery_case', entityId: existing.id,
      reasonText: reviewReason, oldValuesJson: { status: existing.status }, newValuesJson: { status: RecoveryCaseStatus.rejected }
    });
    return updated;
  }

  async approve(input: { actorUserId: string; caseId: string; reason: string }) {
    const actor = await this.actor(input.actorUserId);
    const reviewReason = this.reason(input.reason, 'Approval reason');
    const recovery = await this.prisma.recoveryCase.findFirst({
      where: { id: input.caseId, organizationId: actor.organizationId, status: RecoveryCaseStatus.pending }
    });
    if (!recovery || recovery.expiresAt <= new Date()) throw new NotFoundException('Pending recovery case not found or expired');
    await this.rateLimit(`approve:${actor.id}:${recovery.targetUserId}`);
    if (recovery.requestedByUserId === actor.id) throw new ForbiddenException('A distinct admin must approve this recovery case');
    if (recovery.targetUserId === actor.id) throw new ForbiddenException('Support actors cannot recover their own account');
    const targetUser = await this.prisma.user.findUnique({ where: { id: recovery.targetUserId } });
    if (!targetUser) throw new NotFoundException('Recovery target not found');

    const needsPasswordReset = recovery.type !== RecoveryCaseType.help_desk_mfa_reset;
    if (needsPasswordReset && !this.notificationWebhook) {
      throw new ServiceUnavailableException('Account recovery requires an independent notification webhook');
    }
    const policy = await this.policies.getEffectivePolicy({ organizationId: recovery.organizationId, campaignId: targetUser.campaignId });
    const rawResetToken = needsPasswordReset ? randomBytes(32).toString('base64url') : null;
    const executedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: recovery.targetUserId },
        data: { mfaEnabled: false, mfaSecret: null, mfaTempSecret: null, failedLoginAttempts: 0, lockedUntil: null }
      });
      await tx.authRefreshToken.updateMany({
        where: { userId: recovery.targetUserId, revokedAt: null },
        data: { revokedAt: executedAt, revocationReason: 'privileged_recovery' }
      });
      await tx.passwordResetToken.updateMany({ where: { userId: recovery.targetUserId, usedAt: null }, data: { usedAt: executedAt } });
      await tx.activationToken.updateMany({ where: { userId: recovery.targetUserId, usedAt: null }, data: { usedAt: executedAt } });
      await tx.mfaChallengeToken.updateMany({ where: { userId: recovery.targetUserId, usedAt: null }, data: { usedAt: executedAt } });
      await tx.mfaBackupCode.deleteMany({ where: { userId: recovery.targetUserId } });
      await tx.impersonationSession.updateMany({
        where: { OR: [{ actorUserId: recovery.targetUserId }, { targetUserId: recovery.targetUserId }], endedAt: null },
        data: { endedAt: executedAt }
      });
      if (rawResetToken) {
        await tx.passwordResetToken.create({
          data: {
            userId: recovery.targetUserId,
            tokenHash: createHash('sha256').update(rawResetToken).digest('hex'),
            expiresAt: new Date(executedAt.getTime() + policy.passwordResetTtlMinutes * 60_000)
          }
        });
      }
      await tx.recoveryCase.update({
        where: { id: recovery.id },
        data: {
          status: RecoveryCaseStatus.executed,
          reviewedByUserId: actor.id,
          reviewedAt: executedAt,
          executedAt,
          reviewReason,
          notificationStatus: this.notificationWebhook ? RecoveryNotificationStatus.pending : RecoveryNotificationStatus.not_configured
        }
      });
      await this.audit.log({
        actorUserId: actor.id, organizationId: recovery.organizationId, actionType: 'recovery_case_approved', entityType: 'recovery_case', entityId: recovery.id,
        reasonText: reviewReason, newValuesJson: { targetUserId: recovery.targetUserId, type: recovery.type }
      }, tx);
      await this.audit.log({
        actorUserId: actor.id, organizationId: recovery.organizationId, actionType: 'privileged_recovery_executed', entityType: 'user_auth', entityId: recovery.targetUserId,
        reasonText: reviewReason, newValuesJson: { recoveryCaseId: recovery.id, sessionsRevoked: true, recoveryArtifactsRevoked: true, mfaReset: true, passwordResetIssued: Boolean(rawResetToken) }
      }, tx);
    });

    if (this.notificationWebhook) {
      await this.deliverNotification({ ...recovery, targetUser }, rawResetToken, executedAt);
    }
    return this.prisma.recoveryCase.findUnique({ where: { id: recovery.id }, include: this.safeInclude });
  }

  private async deliverNotification(
    recovery: { id: string; organizationId: string; type: RecoveryCaseType; targetUserId: string; targetUser: { email: string; firstName: string; lastName: string } },
    resetToken: string | null,
    executedAt: Date
  ) {
    let status: RecoveryNotificationStatus = RecoveryNotificationStatus.delivered;
    let notificationError: string | null = null;
    try {
      const response = await fetch(this.notificationWebhook!, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.notificationToken ? { authorization: `Bearer ${this.notificationToken}` } : {})
        },
        body: JSON.stringify({
          event: 'privileged_account_recovery', recoveryCaseId: recovery.id, recoveryType: recovery.type,
          occurredAt: executedAt.toISOString(), target: { email: recovery.targetUser.email, firstName: recovery.targetUser.firstName, lastName: recovery.targetUser.lastName },
          ...(resetToken ? { passwordResetToken: resetToken } : {})
        }),
        signal: AbortSignal.timeout(10_000)
      });
      if (!response.ok) throw new Error('delivery failed');
    } catch {
      status = RecoveryNotificationStatus.failed;
      notificationError = 'delivery_failed';
    }
    await this.prisma.recoveryCase.update({
      where: { id: recovery.id }, data: { notificationStatus: status, notificationError }
    });
    await this.audit.log({
      organizationId: recovery.organizationId,
      actionType: status === RecoveryNotificationStatus.delivered ? 'recovery_notification_delivered' : 'recovery_notification_failed',
      entityType: 'recovery_case', entityId: recovery.id,
      newValuesJson: { targetUserId: recovery.targetUserId, notificationStatus: status }
    });
  }
}
