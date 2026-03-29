import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SyncStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const safeUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
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
  constructor(private readonly prisma: PrismaService) {}

  private organizationScope(organizationId: string | null) {
    return {
      organizationId
    } as const;
  }

  private syncConflictWhere(organizationId: string | null): Prisma.VisitLogWhereInput {
    return {
      ...this.organizationScope(organizationId),
      OR: [
        { syncStatus: SyncStatus.conflict },
        { syncConflictFlag: true }
      ]
    };
  }

  async dashboardSummary(organizationId: string | null) {
    const organizationScope = this.organizationScope(organizationId);
    const [users, turfs, addresses, assignments, activeSessions, visits] = await Promise.all([
      this.prisma.user.count({ where: organizationScope }),
      this.prisma.turf.count({ where: organizationScope }),
      this.prisma.address.count({ where: organizationScope }),
      this.prisma.turfAssignment.count({ where: organizationScope }),
      this.prisma.turfSession.count({ where: { ...organizationScope, endTime: null } }),
      this.prisma.visitLog.count({ where: organizationScope })
    ]);

    const completedAddresses = await this.prisma.visitLog.findMany({
      where: organizationScope,
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
        addresses: true,
        assignments: true,
        sessions: {
          where: { endTime: null }
        },
        visits: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return {
      totals: {
        users,
        admins: await this.prisma.user.count({ where: { ...organizationScope, role: UserRole.admin } }),
        supervisors: await this.prisma.user.count({ where: { ...organizationScope, role: UserRole.supervisor } }),
        canvassers: await this.prisma.user.count({ where: { ...organizationScope, role: UserRole.canvasser } }),
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

  async activeCanvassers(organizationId: string | null) {
    return this.prisma.turfSession.findMany({
      where: { ...this.organizationScope(organizationId), endTime: null },
      orderBy: { startTime: 'desc' },
      include: {
        canvasser: {
          select: safeUserSelect
        },
        turf: {
          include: {
            addresses: true,
            visits: true
          }
        }
      }
    });
  }

  async listCanvassers(organizationId: string | null) {
    return this.prisma.user.findMany({
      where: {
        ...this.organizationScope(organizationId),
        role: {
          in: [UserRole.supervisor, UserRole.canvasser]
        }
      },
      select: safeUserSelect,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    });
  }

  async listOutcomeDefinitions(organizationId: string | null) {
    return this.prisma.outcomeDefinition.findMany({
      where: this.organizationScope(organizationId),
      orderBy: [{ displayOrder: 'asc' }, { label: 'asc' }]
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
  }, organizationId: string | null) {
    const normalizedCode = input.code.trim();
    const data = {
      code: normalizedCode,
      label: input.label.trim(),
      requiresNote: input.requiresNote ?? false,
      isFinalDisposition: input.isFinalDisposition ?? true,
      displayOrder: input.displayOrder ?? 0,
      isActive: input.isActive ?? true,
      organizationId
    };

    if (input.id) {
      const existing = await this.prisma.outcomeDefinition.findFirst({
        where: {
          id: input.id,
          ...this.organizationScope(organizationId)
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

  async gpsReviewQueue(organizationId: string | null) {
    return this.prisma.visitGeofenceResult.findMany({
      where: {
        visitLog: this.organizationScope(organizationId),
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

  async syncConflictQueue(organizationId: string | null) {
    return this.prisma.visitLog.findMany({
      where: this.syncConflictWhere(organizationId),
      orderBy: { visitTime: 'desc' },
      include: syncConflictReviewInclude
    });
  }

  async overrideGpsResult(input: {
    visitLogId: string;
    actorUserId: string;
    organizationId: string | null;
    reason: string;
  }) {
    const reason = input.reason.trim();
    const existing = await this.prisma.visitGeofenceResult.findFirst({
      where: {
        visitLogId: input.visitLogId,
        visitLog: this.organizationScope(input.organizationId)
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
    organizationId: string | null;
    reason: string;
  }) {
    const reason = input.reason.trim();
    if (!reason) {
      throw new BadRequestException('Resolution reason is required');
    }
    const existing = await this.prisma.visitLog.findFirst({
      where: {
        id: input.visitLogId,
        ...this.syncConflictWhere(input.organizationId)
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
          organizationId: input.organizationId,
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
