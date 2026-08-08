import { BadRequestException, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import type { AccessScope } from '../common/interfaces/access-scope.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SystemSettingsService } from '../system-settings/system-settings.service.js';

@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  private static readonly DEFAULT_BATCH_SIZE = 500;
  private static readonly MAX_BATCH_SIZE = 1000;
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

    if (process.env.DISABLE_RETENTION_AUTOMATION === 'true') {
      return;
    }

    const settings = await this.systemSettingsService.getEffectiveSettings();
    if (!settings.retentionJobEnabled) {
      return;
    }

    this.timer = setInterval(() => {
      void this.runCleanup({ scheduled: true, reason: 'Scheduled retention policy execution' });
    }, settings.retentionJobIntervalMinutes * 60 * 1000);
  }

  private policy() {
    const configuredBatchSize = Number(process.env.RETENTION_BATCH_SIZE ?? RetentionService.DEFAULT_BATCH_SIZE);
    const batchSize = Number.isSafeInteger(configuredBatchSize)
      ? Math.min(Math.max(configuredBatchSize, 1), RetentionService.MAX_BATCH_SIZE)
      : RetentionService.DEFAULT_BATCH_SIZE;
    const excludedEntityTypes = new Set(
      (process.env.RETENTION_EXCLUDED_ENTITY_TYPES ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    );
    return { batchSize, excludedEntityTypes };
  }

  private enabled(entityType: string, excludedEntityTypes: Set<string>) {
    return !excludedEntityTypes.has(entityType);
  }

  private buildScope(scope?: AccessScope) {
    if (!scope?.organizationId) {
      return {};
    }

    return {
      organizationId: scope.organizationId,
      ...(scope.campaignId ? { campaignId: scope.campaignId } : {}),
      ...(scope.teamId ? { teamId: scope.teamId } : {}),
      ...(scope.regionCode ? { regionCode: scope.regionCode } : {})
    } as const;
  }

  private buildUserScope(scope?: AccessScope) {
    if (!scope?.organizationId) {
      return {};
    }

    return {
      user: {
        organizationId: scope.organizationId,
        ...(scope.campaignId ? { campaignId: scope.campaignId } : {}),
        ...(scope.teamId ? { teamId: scope.teamId } : {}),
        ...(scope.regionCode ? { regionCode: scope.regionCode } : {})
      }
    };
  }

  async getSummary(scope?: AccessScope) {
    const settings = await this.systemSettingsService.getEffectiveSettings();
    const now = new Date();
    const policy = this.policy();
    const countWhenEnabled = (entityType: string, operation: Promise<number>) =>
      this.enabled(entityType, policy.excludedEntityTypes) ? operation : Promise.resolve(0);
    const [usersToArchive, visitLogsToRedact, addressRequests, importBatches, importBatchRows, exportBatches, exportBatchVisits, refreshTokens, activationTokens, passwordResetTokens, mfaChallenges, usedBackupCodes, lastRun] = await Promise.all([
      countWhenEnabled('users', this.prisma.user.count({
        where: { ...this.buildScope(scope), deletedAt: { not: null }, archivedAt: null, purgeAt: { lte: now } }
      })),
      countWhenEnabled('visitLogs', this.prisma.visitLog.count({
        where: { ...this.buildScope(scope), deletedAt: { not: null }, purgeAt: { lte: now } }
      })),
      countWhenEnabled('addressRequests', this.prisma.addressRequest.count({
        where: {
          ...this.buildScope(scope),
          purgeAt: { lte: now }
        }
      })),
      countWhenEnabled('importBatches', this.prisma.importBatch.count({
        where: {
          ...this.buildScope(scope),
          artifactPurgedAt: null,
          purgeAt: { lte: now }
        }
      })),
      countWhenEnabled('importBatches', this.prisma.importBatchRow.count({
        where: { importBatch: { ...this.buildScope(scope), artifactPurgedAt: null, purgeAt: { lte: now } } }
      })),
      countWhenEnabled('exportBatches', this.prisma.exportBatch.count({
        where: {
          ...this.buildScope(scope),
          artifactPurgedAt: null,
          purgeAt: { lte: now }
        }
      })),
      countWhenEnabled('exportBatches', this.prisma.exportBatchVisit.count({
        where: { exportBatch: { ...this.buildScope(scope), artifactPurgedAt: null, purgeAt: { lte: now } } }
      })),
      countWhenEnabled('refreshTokens', this.prisma.authRefreshToken.count({
        where: {
          ...this.buildUserScope(scope),
          OR: [{ expiresAt: { lte: now } }, { revokedAt: { not: null } }]
        }
      })),
      countWhenEnabled('activationTokens', this.prisma.activationToken.count({
        where: {
          ...this.buildUserScope(scope),
          OR: [{ expiresAt: { lte: now } }, { usedAt: { not: null } }]
        }
      })),
      countWhenEnabled('passwordResetTokens', this.prisma.passwordResetToken.count({
        where: {
          ...this.buildUserScope(scope),
          OR: [{ expiresAt: { lte: now } }, { usedAt: { not: null } }]
        }
      })),
      countWhenEnabled('mfaChallenges', this.prisma.mfaChallengeToken.count({
        where: {
          ...this.buildUserScope(scope),
          OR: [{ expiresAt: { lte: now } }, { usedAt: { not: null } }]
        }
      })),
      countWhenEnabled('usedBackupCodes', this.prisma.mfaBackupCode.count({
        where: {
          ...this.buildUserScope(scope),
          usedAt: { not: null }
        }
      })),
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
      policy: {
        batchSize: policy.batchSize,
        excludedEntityTypes: [...policy.excludedEntityTypes],
        stages: ['archive', 'redact', 'purge']
      },
      dueNow: {
        usersToArchive,
        visitLogsToRedact,
        addressRequests,
        importBatches,
        importBatchRows,
        exportBatches,
        exportBatchVisits,
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
    reason?: string;
  }) {
    if (this.running) {
      return {
        skipped: true,
        reason: 'already_running'
      };
    }

    this.running = true;
    const now = new Date();
    const reason = input?.reason?.trim() ?? '';
    if (!input?.scheduled && !reason) {
      this.running = false;
      throw new BadRequestException('A retention cleanup reason is required');
    }

    try {
      const policy = this.policy();
      const scope = this.buildScope(input?.scope);
      const ids = async (
        entityType: string,
        delegate: { findMany(args: unknown): Promise<Array<{ id: string }>> },
        where: Record<string, unknown>
      ) => this.enabled(entityType, policy.excludedEntityTypes)
        ? (await delegate.findMany({ where, select: { id: true }, orderBy: { id: 'asc' }, take: policy.batchSize })).map((item) => item.id)
        : [];

      const [userIds, visitIds, addressRequestIds, importBatchIds, exportBatchIds, refreshTokenIds, activationTokenIds, passwordResetTokenIds, mfaChallengeIds, backupCodeIds] = await Promise.all([
        ids('users', this.prisma.user, { ...scope, deletedAt: { not: null }, archivedAt: null, purgeAt: { lte: now } }),
        ids('visitLogs', this.prisma.visitLog, { ...scope, deletedAt: { not: null }, purgeAt: { lte: now } }),
        ids('addressRequests', this.prisma.addressRequest, { ...scope, purgeAt: { lte: now } }),
        ids('importBatches', this.prisma.importBatch, { ...scope, artifactPurgedAt: null, purgeAt: { lte: now } }),
        ids('exportBatches', this.prisma.exportBatch, { ...scope, artifactPurgedAt: null, purgeAt: { lte: now } }),
        ids('refreshTokens', this.prisma.authRefreshToken, { ...this.buildUserScope(input?.scope), OR: [{ expiresAt: { lte: now } }, { revokedAt: { not: null } }] }),
        ids('activationTokens', this.prisma.activationToken, { ...this.buildUserScope(input?.scope), OR: [{ expiresAt: { lte: now } }, { usedAt: { not: null } }] }),
        ids('passwordResetTokens', this.prisma.passwordResetToken, { ...this.buildUserScope(input?.scope), OR: [{ expiresAt: { lte: now } }, { usedAt: { not: null } }] }),
        ids('mfaChallenges', this.prisma.mfaChallengeToken, { ...this.buildUserScope(input?.scope), OR: [{ expiresAt: { lte: now } }, { usedAt: { not: null } }] }),
        ids('usedBackupCodes', this.prisma.mfaBackupCode, { ...this.buildUserScope(input?.scope), usedAt: { not: null } })
      ]);
      const planned = {
        usersToArchive: userIds.length,
        visitLogsToRedact: visitIds.length,
        addressRequests: addressRequestIds.length,
        importBatches: importBatchIds.length,
        exportBatches: exportBatchIds.length,
        refreshTokens: refreshTokenIds.length,
        activationTokens: activationTokenIds.length,
        passwordResetTokens: passwordResetTokenIds.length,
        mfaChallenges: mfaChallengeIds.length,
        usedBackupCodes: backupCodeIds.length
      };
      await this.auditService.log({
        actorUserId: input?.actorUserId ?? null,
        actionType: 'retention_cleanup_planned',
        entityType: 'retention_cleanup',
        entityId: input?.scope?.campaignId ?? input?.scope?.organizationId ?? 'global',
        reasonCode: input?.scheduled ? 'scheduled' : 'manual',
        reasonText: reason || 'Scheduled retention policy execution',
        newValuesJson: { ...planned, batchSize: policy.batchSize, excludedEntityTypes: [...policy.excludedEntityTypes] }
      });

      const [
        users,
        visitLogs,
        addressRequests,
        importBatchRows,
        importBatches,
        exportBatchVisits,
        exportBatches,
        refreshTokens,
        activationTokens,
        passwordResetTokens,
        mfaChallenges,
        usedBackupCodes
      ] = await this.prisma.$transaction([
        this.prisma.user.updateMany({
          where: { id: { in: userIds }, archivedAt: null },
          data: { archivedAt: now, isActive: false, status: 'archived' }
        }),
        this.prisma.visitLog.updateMany({
          where: { id: { in: visitIds }, deletedAt: { not: null } },
          data: {
            archivedAt: now,
            notes: null,
            latitude: null,
            longitude: null,
            accuracyMeters: null,
            syncConflictReason: null,
            purgeAt: null
          }
        }),
        this.prisma.addressRequest.deleteMany({
          where: { id: { in: addressRequestIds }, ...scope, purgeAt: { lte: now } }
        }),
        this.prisma.importBatchRow.updateMany({
          where: {
            importBatch: {
              id: { in: importBatchIds }
            }
          },
          data: {
            rawRowJson: Prisma.JsonNull
          }
        }),
        this.prisma.importBatch.updateMany({
          where: {
            id: { in: importBatchIds },
            ...scope,
            artifactPurgedAt: null,
            purgeAt: { lte: now }
          },
          data: {
            csvContent: null,
            artifactPurgedAt: now
          }
        }),
        this.prisma.exportBatchVisit.updateMany({
          where: {
            exportBatch: {
              id: { in: exportBatchIds }
            }
          },
          data: {
            rowSnapshotJson: Prisma.JsonNull
          }
        }),
        this.prisma.exportBatch.updateMany({
          where: {
            id: { in: exportBatchIds },
            ...scope,
            artifactPurgedAt: null,
            purgeAt: { lte: now }
          },
          data: {
            csvContent: null,
            artifactPurgedAt: now
          }
        }),
        this.prisma.authRefreshToken.deleteMany({
          where: {
            id: { in: refreshTokenIds }
          }
        }),
        this.prisma.activationToken.deleteMany({
          where: {
            id: { in: activationTokenIds }
          }
        }),
        this.prisma.passwordResetToken.deleteMany({
          where: {
            id: { in: passwordResetTokenIds }
          }
        }),
        this.prisma.mfaChallengeToken.deleteMany({
          where: {
            id: { in: mfaChallengeIds }
          }
        }),
        this.prisma.mfaBackupCode.deleteMany({
          where: {
            id: { in: backupCodeIds }
          }
        })
      ]);

      const summary = {
        usersArchived: users.count,
        visitLogsRedacted: visitLogs.count,
        addressRequests: addressRequests.count,
        importBatches: importBatches.count,
        importBatchRows: importBatchRows.count,
        exportBatches: exportBatches.count,
        exportBatchVisits: exportBatchVisits.count,
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
        reasonText: reason || 'Scheduled retention policy execution',
        newValuesJson: summary
      });

      return {
        skipped: false,
        scheduled: Boolean(input?.scheduled),
        planned,
        summary
      };
    } catch (error) {
      await this.auditService.log({
        actorUserId: input?.actorUserId ?? null,
        actionType: 'retention_cleanup_failed',
        entityType: 'retention_cleanup',
        entityId: input?.scope?.campaignId ?? input?.scope?.organizationId ?? 'global',
        reasonCode: input?.scheduled ? 'scheduled' : 'manual',
        reasonText: reason || 'Scheduled retention policy execution',
        newValuesJson: { errorCategory: error instanceof Error ? error.name : 'unknown' }
      });
      throw error;
    } finally {
      this.running = false;
    }
  }
}
