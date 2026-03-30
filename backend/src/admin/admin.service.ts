import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AssignmentStatus, Prisma, SyncStatus, UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AccessScope } from '../common/interfaces/access-scope.interface';
import { PoliciesService } from '../policies/policies.service';
import { PrismaService } from '../prisma/prisma.service';
import { RetentionService } from '../retention/retention.service';

const safeUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  organizationId: true,
  campaignId: true,
  isActive: true,
  status: true,
  mfaEnabled: true,
  invitedAt: true,
  activatedAt: true,
  lastLoginAt: true,
  createdAt: true
} as const;

const reviewAddressSelect = {
  id: true,
  addressLine1: true,
  city: true,
  state: true,
  zip: true
} as const;

const reviewTurfSelect = {
  id: true,
  name: true
} as const;

const syncConflictReviewInclude = {
  address: {
    select: reviewAddressSelect
  },
  canvasser: {
    select: safeUserSelect
  },
  turf: {
    select: reviewTurfSelect
  }
} as const;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policiesService: PoliciesService,
    private readonly auditService: AuditService,
    private readonly retentionService: RetentionService
  ) {}

  private scopeWhere(scope: AccessScope) {
    return {
      organizationId: scope.organizationId,
      ...(scope.campaignId ? { campaignId: scope.campaignId } : {})
    } as const;
  }

  private buildPurgeAt(days?: number | null) {
    if (!days || days <= 0) {
      return null;
    }

    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private syncConflictWhere(scope: AccessScope): Prisma.VisitLogWhereInput {
    return {
      ...this.scopeWhere(scope),
      OR: [
        { syncStatus: SyncStatus.conflict },
        { syncConflictFlag: true }
      ]
    };
  }

  async dashboardSummary(scope: AccessScope) {
    const organizationScope = this.scopeWhere(scope);
    const [users, turfs, addresses, assignments, activeSessions, visits] = await Promise.all([
      this.prisma.user.count({ where: { ...organizationScope, deletedAt: null } }),
      this.prisma.turf.count({ where: { ...organizationScope, deletedAt: null } }),
      this.prisma.address.count({ where: { ...organizationScope, deletedAt: null } }),
      this.prisma.turfAssignment.count({ where: organizationScope }),
      this.prisma.turfSession.count({ where: { ...organizationScope, endTime: null } }),
      this.prisma.visitLog.count({ where: { ...organizationScope, deletedAt: null } })
    ]);

    const completedAddresses = await this.prisma.visitLog.findMany({
      where: { ...organizationScope, deletedAt: null },
      distinct: ['addressId'],
      select: { addressId: true }
    });

    const activeCanvassers = await this.prisma.turfSession.findMany({
      where: { ...organizationScope, endTime: null },
      include: {
        canvasser: {
          select: safeUserSelect
        },
        turf: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { startTime: 'desc' }
    });

    const perTurf = await this.prisma.turf.findMany({
      where: organizationScope,
      include: {
        addresses: {
          where: { deletedAt: null }
        },
        assignments: true,
        sessions: {
          where: { endTime: null }
        },
        visits: {
          where: { deletedAt: null }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return {
      totals: {
        users,
        admins: await this.prisma.user.count({ where: { ...organizationScope, role: UserRole.admin, deletedAt: null } }),
        supervisors: await this.prisma.user.count({ where: { ...organizationScope, role: UserRole.supervisor, deletedAt: null } }),
        canvassers: await this.prisma.user.count({ where: { ...organizationScope, role: UserRole.canvasser, deletedAt: null } }),
        turfs,
        addresses,
        assignments,
        activeSessions,
        visits,
        completedAddresses: completedAddresses.length
      },
      activeCanvassers,
      turfs: perTurf.map((turf) => ({
        id: turf.id,
        name: turf.name,
        description: turf.description,
        addressCount: turf.addresses.length,
        assignmentCount: turf.assignments.length,
        activeSessionCount: turf.sessions.length,
        visitCount: turf.visits.length,
        progressPercent: turf.addresses.length
          ? Math.round((new Set(turf.visits.map((visit) => visit.addressId)).size / turf.addresses.length) * 100)
          : 0
      }))
    };
  }

  async activeCanvassers(scope: AccessScope) {
    return this.prisma.turfSession.findMany({
      where: { ...this.scopeWhere(scope), endTime: null },
      orderBy: { startTime: 'desc' },
      include: {
        canvasser: {
          select: safeUserSelect
        },
        turf: {
          include: {
            addresses: {
              where: { deletedAt: null }
            },
            visits: {
              where: { deletedAt: null }
            }
          }
        }
      }
    });
  }

  async listCanvassers(scope: AccessScope) {
    return this.prisma.user.findMany({
      where: {
        ...this.scopeWhere(scope),
        deletedAt: null,
        role: {
          in: [UserRole.supervisor, UserRole.canvasser]
        }
      },
      select: safeUserSelect,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    });
  }

  async listCampaigns(scope: AccessScope) {
    return this.prisma.campaign.findMany({
      where: {
        ...(scope.organizationId ? { organizationId: scope.organizationId } : {}),
        ...(scope.campaignId ? { id: scope.campaignId } : {})
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }]
    });
  }

  async listOutcomeDefinitions(scope: AccessScope) {
    const policy = await this.policiesService.getEffectivePolicy(scope);
    const outcomes = await this.prisma.outcomeDefinition.findMany({
      where: this.scopeWhere(scope),
      orderBy: [{ displayOrder: 'asc' }, { label: 'asc' }]
    });

    if (!scope.campaignId || !policy.allowOrgOutcomeFallback) {
      return outcomes;
    }

    const orgDefaults = await this.prisma.outcomeDefinition.findMany({
      where: {
        organizationId: scope.organizationId,
        campaignId: null
      },
      orderBy: [{ displayOrder: 'asc' }, { label: 'asc' }]
    });

    const merged = new Map<string, (typeof outcomes)[number]>();
    for (const outcome of [...outcomes, ...orgDefaults]) {
      if (!merged.has(outcome.code)) {
        merged.set(outcome.code, outcome);
      }
    }

    return Array.from(merged.values()).sort(
      (left, right) => left.displayOrder - right.displayOrder || left.label.localeCompare(right.label)
    );
  }

  async getOperationalPolicy(scope: AccessScope, requestedCampaignId?: string | null) {
    return this.policiesService.getManageablePolicy(scope, requestedCampaignId);
  }

  async retentionSummary(scope: AccessScope) {
    return this.retentionService.getSummary(scope);
  }

  async runRetentionCleanup(scope: AccessScope, actorUserId: string) {
    return this.retentionService.runCleanup({
      scope,
      actorUserId
    });
  }

  async upsertOperationalPolicy(
    scope: AccessScope,
    input: {
      campaignId?: string | null;
      defaultImportMode?: 'create_only' | 'upsert' | 'replace_turf_membership';
      defaultDuplicateStrategy?: 'skip' | 'error' | 'merge' | 'review';
      sensitiveMfaWindowMinutes?: number;
      retentionArchiveDays?: number | null;
      retentionPurgeDays?: number | null;
      requireArchiveReason?: boolean;
      allowOrgOutcomeFallback?: boolean;
    }
  ) {
    return this.policiesService.upsertPolicy(scope, input);
  }

  async archiveFieldUser(input: {
    userId: string;
    actorUserId: string;
    scope: AccessScope;
    reasonText?: string;
  }) {
    const policy = await this.policiesService.getEffectivePolicy(input.scope);
    const reasonText = input.reasonText?.trim() || undefined;
    if (policy.requireArchiveReason && !reasonText) {
      throw new BadRequestException('An archive reason is required by the current policy');
    }

    return this.prisma.$transaction(async (tx) => {
      const fieldUser = await tx.user.findFirst({
        where: {
          id: input.userId,
          ...this.scopeWhere(input.scope),
          role: { in: [UserRole.supervisor, UserRole.canvasser] },
          deletedAt: null
        }
      });

      if (!fieldUser) {
        throw new NotFoundException('Field user not found');
      }
      if (fieldUser.id === input.actorUserId) {
        throw new BadRequestException('You cannot archive your own account');
      }

      const [openSessions, openAssignments] = await Promise.all([
        tx.turfSession.count({
          where: {
            canvasserId: fieldUser.id,
            endTime: null
          }
        }),
        tx.turfAssignment.count({
          where: {
            canvasserId: fieldUser.id,
            status: { in: [AssignmentStatus.assigned, AssignmentStatus.active] }
          }
        })
      ]);

      if (openSessions > 0 || openAssignments > 0) {
        throw new BadRequestException('Close active sessions and assignments before archiving this field user');
      }

      const updated = await tx.user.update({
        where: { id: fieldUser.id },
        data: {
          isActive: false,
          status: 'archived',
          archivedAt: new Date(),
          purgeAt: this.buildPurgeAt(policy.retentionPurgeDays)
        }
      });

      await this.auditService.log(
        {
          actorUserId: input.actorUserId,
          actionType: 'field_user_archived',
          entityType: 'user',
          entityId: fieldUser.id,
          reasonText,
          oldValuesJson: {
            status: fieldUser.status,
            isActive: fieldUser.isActive
          },
          newValuesJson: {
            status: updated.status,
            archivedAt: updated.archivedAt,
            purgeAt: updated.purgeAt
          }
        },
        tx
      );

      return updated;
    });
  }

  async deleteFieldUser(input: {
    userId: string;
    actorUserId: string;
    scope: AccessScope;
    reasonText: string;
  }) {
    const reasonText = input.reasonText.trim();
    if (!reasonText) {
      throw new BadRequestException('A delete reason is required');
    }

    const policy = await this.policiesService.getEffectivePolicy(input.scope);

    return this.prisma.$transaction(async (tx) => {
      const fieldUser = await tx.user.findFirst({
        where: {
          id: input.userId,
          ...this.scopeWhere(input.scope),
          role: { in: [UserRole.supervisor, UserRole.canvasser] },
          deletedAt: null
        }
      });

      if (!fieldUser) {
        throw new NotFoundException('Field user not found');
      }
      if (fieldUser.id === input.actorUserId) {
        throw new BadRequestException('You cannot delete your own account');
      }

      const [openSessions, openAssignments] = await Promise.all([
        tx.turfSession.count({
          where: {
            canvasserId: fieldUser.id,
            endTime: null
          }
        }),
        tx.turfAssignment.count({
          where: {
            canvasserId: fieldUser.id,
            status: { in: [AssignmentStatus.assigned, AssignmentStatus.active] }
          }
        })
      ]);

      if (openSessions > 0 || openAssignments > 0) {
        throw new BadRequestException('Close active sessions and assignments before deleting this field user');
      }

      const updated = await tx.user.update({
        where: { id: fieldUser.id },
        data: {
          isActive: false,
          status: 'deleted',
          deletedAt: new Date(),
          deleteReason: reasonText,
          purgeAt: this.buildPurgeAt(policy.retentionPurgeDays)
        }
      });

      await this.auditService.log(
        {
          actorUserId: input.actorUserId,
          actionType: 'field_user_deleted',
          entityType: 'user',
          entityId: fieldUser.id,
          reasonText,
          oldValuesJson: {
            status: fieldUser.status,
            isActive: fieldUser.isActive
          },
          newValuesJson: {
            status: updated.status,
            deletedAt: updated.deletedAt,
            purgeAt: updated.purgeAt
          }
        },
        tx
      );

      return updated;
    });
  }

  async upsertOutcomeDefinition(input: {
    id?: string;
    code: string;
    label: string;
    requiresNote?: boolean;
    isFinalDisposition?: boolean;
    displayOrder?: number;
    isActive?: boolean;
  }, scope: AccessScope) {
    const normalizedCode = input.code.trim();
    const existingByCode = await this.prisma.outcomeDefinition.findFirst({
      where: {
        code: normalizedCode,
        organizationId: scope.organizationId,
        campaignId: scope.campaignId ?? null,
        ...(input.id ? { id: { not: input.id } } : {})
      }
    });

    if (existingByCode) {
      throw new BadRequestException('An outcome with this code already exists in the current scope');
    }

    const data = {
      code: normalizedCode,
      label: input.label.trim(),
      requiresNote: input.requiresNote ?? false,
      isFinalDisposition: input.isFinalDisposition ?? true,
      displayOrder: input.displayOrder ?? 0,
      isActive: input.isActive ?? true,
      organizationId: scope.organizationId,
      campaignId: scope.campaignId ?? null
    };

    if (input.id) {
      const existing = await this.prisma.outcomeDefinition.findFirst({
        where: {
          id: input.id,
          ...this.scopeWhere(scope)
        }
      });

      if (!existing) {
        throw new NotFoundException('Outcome definition not found');
      }

      return this.prisma.outcomeDefinition.update({
        where: { id: input.id },
        data
      });
    }

    return this.prisma.outcomeDefinition.create({
      data
    });
  }

  async gpsReviewQueue(scope: AccessScope) {
    return this.prisma.visitGeofenceResult.findMany({
      where: {
        visitLog: this.scopeWhere(scope),
        OR: [
          { gpsStatus: { not: 'verified' } },
          { overrideFlag: true }
        ]
      },
      orderBy: { createdAt: 'desc' },
      include: {
        address: true,
        visitLog: {
          include: {
            canvasser: {
              select: safeUserSelect
            },
            turf: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });
  }

  async syncConflictQueue(scope: AccessScope) {
    return this.prisma.visitLog.findMany({
      where: this.syncConflictWhere(scope),
      orderBy: { visitTime: 'desc' },
      include: syncConflictReviewInclude
    });
  }

  async overrideGpsResult(input: {
    visitLogId: string;
    actorUserId: string;
    scope: AccessScope;
    reason: string;
  }) {
    const reason = input.reason.trim();
    if (!reason) {
      throw new BadRequestException('Override reason is required');
    }
    const existing = await this.prisma.visitGeofenceResult.findFirst({
      where: {
        visitLogId: input.visitLogId,
        visitLog: this.scopeWhere(input.scope)
      }
    });

    if (!existing) {
      throw new NotFoundException('GPS review item not found');
    }

    const [geofenceResult] = await this.prisma.$transaction([
      this.prisma.visitGeofenceResult.update({
        where: { visitLogId: input.visitLogId },
        data: {
          overrideFlag: true,
          overrideReason: reason,
          overrideByUserId: input.actorUserId,
          overrideAt: new Date()
        }
      }),
      this.prisma.visitLog.update({
        where: { id: input.visitLogId },
        data: {
          geofenceValidated: true
        }
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          actionType: 'gps_override_applied',
          entityType: 'visit_log',
          entityId: input.visitLogId,
          reasonText: reason,
          oldValuesJson: {
            overrideFlag: existing.overrideFlag,
            failureReason: existing.failureReason,
            gpsStatus: existing.gpsStatus
          },
          newValuesJson: {
            overrideFlag: true,
            geofenceValidated: true
          }
        }
      })
    ]);

    return geofenceResult;
  }

  async resolveSyncConflict(input: {
    visitLogId: string;
    actorUserId: string;
    scope: AccessScope;
    reason: string;
  }) {
    const reason = input.reason.trim();
    if (!reason) {
      throw new BadRequestException('Resolution reason is required');
    }
    const existing = await this.prisma.visitLog.findFirst({
      where: {
        id: input.visitLogId,
        ...this.syncConflictWhere(input.scope)
      }
    });

    if (!existing) {
      throw new NotFoundException('Sync conflict item not found');
    }

    const [visitLog] = await this.prisma.$transaction([
      this.prisma.visitLog.update({
        where: { id: input.visitLogId },
        data: {
          syncStatus: SyncStatus.synced,
          syncConflictFlag: false,
          syncConflictReason: null
        },
        include: syncConflictReviewInclude
      }),
      this.prisma.syncEvent.create({
        data: {
          entityType: 'visit_log',
          entityId: input.visitLogId,
          localRecordUuid: existing.localRecordUuid,
          idempotencyKey: existing.idempotencyKey,
          eventType: 'conflict_resolved',
          syncStatus: SyncStatus.synced,
          attemptCount: 1,
          attemptedAt: new Date(),
          completedAt: new Date()
        }
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          organizationId: input.scope.organizationId,
          actionType: 'sync_conflict_resolved',
          entityType: 'visit_log',
          entityId: input.visitLogId,
          reasonText: reason,
          oldValuesJson: {
            syncStatus: existing.syncStatus,
            syncConflictFlag: existing.syncConflictFlag,
            syncConflictReason: existing.syncConflictReason
          },
          newValuesJson: {
            syncStatus: SyncStatus.synced,
            syncConflictFlag: false,
            syncConflictReason: null
          }
        }
      })
    ]);

    return visitLog;
  }
}
