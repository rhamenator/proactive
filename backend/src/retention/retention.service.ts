import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AccessScope } from '../common/interfaces/access-scope.interface';
import { PrismaService } from '../prisma/prisma.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';

@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly systemSettingsService: SystemSettingsService
  ) {}

  async onModuleInit() {
    await this.refreshSchedule();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async refreshSchedule() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    const settings = await this.systemSettingsService.getEffectiveSettings();
    if (!settings.retentionJobEnabled) {
      return;
    }

    this.timer = setInterval(() => {
      void this.runCleanup({ scheduled: true });
    }, settings.retentionJobIntervalMinutes * 60 * 1000);
  }

  private buildScope(scope?: AccessScope) {
    if (!scope?.organizationId) {
      return {};
    }

    return {
      organizationId: scope.organizationId,
      ...(scope.campaignId ? { campaignId: scope.campaignId } : {})
    } as const;
  }

  private buildUserScope(scope?: AccessScope) {
    if (!scope?.organizationId) {
      return {};
    }

    return {
      user: {
        organizationId: scope.organizationId,
        ...(scope.campaignId ? { campaignId: scope.campaignId } : {})
      }
    };
  }

  async getSummary(scope?: AccessScope) {
    const settings = await this.systemSettingsService.getEffectiveSettings();
    const now = new Date();
    const [addressRequests, importBatches, exportBatches, refreshTokens, activationTokens, passwordResetTokens, mfaChallenges, usedBackupCodes, lastRun] = await Promise.all([
      this.prisma.addressRequest.count({
        where: {
          ...this.buildScope(scope),
          purgeAt: { lte: now }
        }
      }),
      this.prisma.importBatch.count({
        where: {
          ...this.buildScope(scope),
          purgeAt: { lte: now }
        }
      }),
      this.prisma.exportBatch.count({
        where: {
          ...this.buildScope(scope),
          purgeAt: { lte: now }
        }
      }),
      this.prisma.authRefreshToken.count({
        where: {
          ...this.buildUserScope(scope),
          OR: [{ expiresAt: { lte: now } }, { revokedAt: { not: null } }]
        }
      }),
      this.prisma.activationToken.count({
        where: {
          ...this.buildUserScope(scope),
          OR: [{ expiresAt: { lte: now } }, { usedAt: { not: null } }]
        }
      }),
      this.prisma.passwordResetToken.count({
        where: {
          ...this.buildUserScope(scope),
          OR: [{ expiresAt: { lte: now } }, { usedAt: { not: null } }]
        }
      }),
      this.prisma.mfaChallengeToken.count({
        where: {
          ...this.buildUserScope(scope),
          OR: [{ expiresAt: { lte: now } }, { usedAt: { not: null } }]
        }
      }),
      this.prisma.mfaBackupCode.count({
        where: {
          ...this.buildUserScope(scope),
          usedAt: { not: null }
        }
      }),
      this.prisma.auditLog.findFirst({
        where: {
          actionType: 'retention_cleanup_completed',
          ...(scope?.organizationId ? { organizationId: scope.organizationId } : {})
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    return {
      automation: {
        enabled: settings.retentionJobEnabled,
        intervalMinutes: settings.retentionJobIntervalMinutes
      },
      dueNow: {
        addressRequests,
        importBatches,
        exportBatches,
        refreshTokens,
        activationTokens,
        passwordResetTokens,
        mfaChallenges,
        usedBackupCodes
      },
      lastRunAt: lastRun?.createdAt ?? null
    };
  }

  async runCleanup(input?: {
    scope?: AccessScope;
    actorUserId?: string | null;
    scheduled?: boolean;
  }) {
    if (this.running) {
      return {
        skipped: true,
        reason: 'already_running'
      };
    }

    this.running = true;
    const now = new Date();

    try {
      const [
        addressRequests,
        importBatches,
        exportBatches,
        refreshTokens,
        activationTokens,
        passwordResetTokens,
        mfaChallenges,
        usedBackupCodes
      ] = await this.prisma.$transaction([
        this.prisma.addressRequest.deleteMany({
          where: {
            ...this.buildScope(input?.scope),
            purgeAt: { lte: now }
          }
        }),
        this.prisma.importBatch.deleteMany({
          where: {
            ...this.buildScope(input?.scope),
            purgeAt: { lte: now }
          }
        }),
        this.prisma.exportBatch.deleteMany({
          where: {
            ...this.buildScope(input?.scope),
            purgeAt: { lte: now }
          }
        }),
        this.prisma.authRefreshToken.deleteMany({
          where: {
            ...this.buildUserScope(input?.scope),
            OR: [{ expiresAt: { lte: now } }, { revokedAt: { not: null } }]
          }
        }),
        this.prisma.activationToken.deleteMany({
          where: {
            ...this.buildUserScope(input?.scope),
            OR: [{ expiresAt: { lte: now } }, { usedAt: { not: null } }]
          }
        }),
        this.prisma.passwordResetToken.deleteMany({
          where: {
            ...this.buildUserScope(input?.scope),
            OR: [{ expiresAt: { lte: now } }, { usedAt: { not: null } }]
          }
        }),
        this.prisma.mfaChallengeToken.deleteMany({
          where: {
            ...this.buildUserScope(input?.scope),
            OR: [{ expiresAt: { lte: now } }, { usedAt: { not: null } }]
          }
        }),
        this.prisma.mfaBackupCode.deleteMany({
          where: {
            ...this.buildUserScope(input?.scope),
            usedAt: { not: null }
          }
        })
      ]);

      const summary = {
        addressRequests: addressRequests.count,
        importBatches: importBatches.count,
        exportBatches: exportBatches.count,
        refreshTokens: refreshTokens.count,
        activationTokens: activationTokens.count,
        passwordResetTokens: passwordResetTokens.count,
        mfaChallenges: mfaChallenges.count,
        usedBackupCodes: usedBackupCodes.count
      };

      await this.auditService.log({
        actorUserId: input?.actorUserId ?? null,
        actionType: 'retention_cleanup_completed',
        entityType: 'retention_cleanup',
        entityId: input?.scope?.campaignId ?? input?.scope?.organizationId ?? 'global',
        reasonCode: input?.scheduled ? 'scheduled' : 'manual',
        newValuesJson: summary
      });

      return {
        skipped: false,
        scheduled: Boolean(input?.scheduled),
        summary
      };
    } finally {
      this.running = false;
    }
  }
}
