import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AssignmentStatus,
  SessionStatus,
  TurfStatus,
  UserRole,
  type Prisma,
  type TurfSession
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AccessScope } from '../common/interfaces/access-scope.interface';
import { inferMappingFromHeaders } from '../common/utils/csv.util';
import { PoliciesService } from '../policies/policies.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

type PrismaWriter = PrismaService | Prisma.TransactionClient;
type LifecycleStatus = 'open' | 'paused' | 'completed' | 'closed';

@Injectable()
export class TurfsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
    private readonly policiesService: PoliciesService
  ) {}

  private toLifecycleStatus(status: TurfStatus): LifecycleStatus {
    switch (status) {
      case TurfStatus.paused:
        return 'paused';
      case TurfStatus.completed:
        return 'completed';
      case TurfStatus.archived:
        return 'closed';
      default:
        return 'open';
    }
  }

  private serializeSession(session: TurfSession | null) {
    if (!session) {
      return null;
    }

    return {
      id: session.id,
      turfId: session.turfId,
      canvasserId: session.canvasserId,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status === SessionStatus.ended ? 'completed' : session.status,
      startLat: session.startLat ? Number(session.startLat) : null,
      startLng: session.startLng ? Number(session.startLng) : null,
      endLat: session.endLat ? Number(session.endLat) : null,
      endLng: session.endLng ? Number(session.endLng) : null
    };
  }

  private scopeWhere(scope: AccessScope) {
    const where = {
      organizationId: scope.organizationId
    } as Record<string, unknown>;

    if (scope.role === UserRole.supervisor) {
      // Supervisor scope is team-primary per product direction. Campaign is a
      // reporting/filter layer only, not a structural scope for supervisors.
      if (scope.teamId) {
        where.teamId = scope.teamId;
      } else if (scope.regionCode) {
        where.regionCode = scope.regionCode;
      }
    } else if (scope.campaignId) {
      where.campaignId = scope.campaignId;
    }

    return where;
  }

  private buildPurgeAt(days?: number | null) {
    if (!days || days <= 0) {
      return null;
    }

    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private async findScopedTurf(db: PrismaWriter, turfId: string, scope: AccessScope) {
    return db.turf.findFirst({
      where: {
        id: turfId,
        ...this.scopeWhere(scope),
        deletedAt: null
      }
    });
  }

  private async ensureAssignableCanvasser(canvasserId: string, organizationId: string | null) {
    const canvasser = await this.usersService.findById(canvasserId);
    if (canvasser.role !== UserRole.canvasser) {
      throw new BadRequestException('Selected user is not a canvasser');
    }
    if (!canvasser.isActive || canvasser.status !== 'active') {
      throw new BadRequestException('Selected canvasser is not active');
    }
    if (canvasser.organizationId !== organizationId) {
      throw new NotFoundException('User not found');
    }
    return canvasser;
  }

  private async validateTeamScope(organizationId: string | null, campaignId: string | null | undefined, teamId?: string | null) {
    if (!teamId) {
      return null;
    }

    const team = await this.prisma.team.findFirst({
      where: {
        id: teamId,
        organizationId: organizationId ?? undefined,
        isActive: true
      }
    });

    if (!team) {
      throw new BadRequestException('Team not found');
    }

    return team;
  }

  private async ensureNoCrossTurfOpenSession(
    db: PrismaWriter,
    canvasserId: string,
    turfId: string
  ) {
    const conflictingSession = await db.turfSession.findFirst({
      where: {
        canvasserId,
        endTime: null,
        turfId: { not: turfId }
      }
    });

    if (conflictingSession) {
      throw new BadRequestException('Canvasser already has an open session on another turf');
    }
  }

  private async ensureTurfSessionAvailability(
    db: PrismaWriter,
    turfId: string,
    canvasserId: string
  ) {
    const turf = await db.turf.findUnique({ where: { id: turfId } });
    if (!turf) {
      throw new NotFoundException('Turf not found');
    }

    if (!turf.isShared) {
      const conflictingSession = await db.turfSession.findFirst({
        where: {
          turfId,
          endTime: null,
          canvasserId: { not: canvasserId }
        }
      });

      if (conflictingSession) {
        throw new BadRequestException('This turf already has an open session');
      }
    }

    return turf;
  }

  async listTurfs(scope: AccessScope) {
    const turfs = await this.prisma.turf.findMany({
      where: {
        ...this.scopeWhere(scope),
        deletedAt: null
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            addresses: true,
            assignments: true,
            sessions: true,
            visits: true
          }
        }
      }
    });

    const sessions = await this.prisma.turfSession.findMany({
      where: { ...this.scopeWhere(scope), endTime: null }
    });
    const activeSessionCounts = new Map<string, number>();
    for (const session of sessions) {
      activeSessionCounts.set(session.turfId, (activeSessionCounts.get(session.turfId) ?? 0) + 1);
    }

    return turfs.map((turf) => ({
      ...turf,
      lifecycleStatus: this.toLifecycleStatus(turf.status),
      activeSessionCount: activeSessionCounts.get(turf.id) ?? 0
    }));
  }

  async createTurf(input: { name: string; description?: string; teamId?: string | null; regionCode?: string | null }, createdById: string) {
    const creator = await this.usersService.findById(createdById);
    const team = await this.validateTeamScope(creator.organizationId ?? null, creator.campaignId ?? null, input.teamId);
    return this.prisma.turf.create({
      data: {
        name: input.name,
        description: input.description,
        createdById,
        organizationId: creator.organizationId ?? null,
        campaignId: creator.campaignId ?? team?.campaignId ?? null,
        teamId: input.teamId ?? null,
        regionCode: input.regionCode?.trim() || team?.regionCode || null,
        status: TurfStatus.unassigned
      }
    });
  }

  async updateTurfScope(
    turfId: string,
    input: { teamId?: string | null; regionCode?: string | null },
    actorUserId: string,
    scope: AccessScope = { organizationId: null, campaignId: null }
  ) {
    return this.prisma.$transaction(async (tx) => {
      const turf = await this.findScopedTurf(tx, turfId, scope);
      if (!turf) {
        throw new NotFoundException('Turf not found');
      }

      const team = await this.validateTeamScope(turf.organizationId ?? null, turf.campaignId ?? null, input.teamId);
      const nextRegionCode = input.regionCode === undefined ? turf.regionCode : input.regionCode?.trim() || team?.regionCode || null;
      const nextTeamId = input.teamId === undefined ? turf.teamId : input.teamId;

      const updated = await tx.turf.update({
        where: { id: turfId },
        data: {
          ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
          regionCode: nextRegionCode
        }
      });

      const propagatedScope = {
        ...(input.teamId !== undefined ? { teamId: nextTeamId } : {}),
        regionCode: nextRegionCode
      };

      await tx.address.updateMany({
        where: { turfId },
        data: propagatedScope
      });

      await tx.turfAssignment.updateMany({
        where: { turfId },
        data: propagatedScope
      });

      await tx.turfSession.updateMany({
        where: { turfId },
        data: propagatedScope
      });

      await tx.visitLog.updateMany({
        where: { turfId },
        data: propagatedScope
      });

      await tx.addressRequest.updateMany({
        where: { turfId },
        data: propagatedScope
      });

      await this.auditService.log({
        actorUserId,
        actionType: 'turf_scope_updated',
        entityType: 'turf',
        entityId: updated.id,
        newValuesJson: {
          teamId: updated.teamId,
          regionCode: updated.regionCode
        }
      }, tx);

      return updated;
    });
  }

  async assignTurf(
    turfId: string,
    canvasserId: string,
    actorUserId: string,
    reasonText?: string,
    scope: AccessScope = { organizationId: null, campaignId: null }
  ) {
    await this.ensureAssignableCanvasser(canvasserId, scope.organizationId);

    return this.prisma.$transaction(async (tx) => {
      const turf = await this.findScopedTurf(tx, turfId, scope);
      if (!turf) {
        throw new NotFoundException('Turf not found');
      }

      const canvasser = await this.ensureAssignableCanvasser(canvasserId, scope.organizationId);
      if (turf.teamId && canvasser.teamId && turf.teamId !== canvasser.teamId) {
        throw new BadRequestException('Selected canvasser is assigned to a different team');
      }
      if (turf.regionCode && canvasser.regionCode && turf.regionCode !== canvasser.regionCode) {
        throw new BadRequestException('Selected canvasser is assigned to a different region');
      }

      await this.ensureNoCrossTurfOpenSession(tx, canvasserId, turfId);

      const openSession = await tx.turfSession.findFirst({
        where: {
          turfId,
          endTime: null
        }
      });
      if (openSession && openSession.canvasserId !== canvasserId) {
        throw new BadRequestException('Close the current turf session before reassigning');
      }

      const now = new Date();
      const currentAssignments = await tx.turfAssignment.findMany({
        where: {
          turfId,
          status: { in: [AssignmentStatus.assigned, AssignmentStatus.active] }
        }
      });

      await tx.turfAssignment.updateMany({
        where: {
          turfId,
          status: { in: [AssignmentStatus.assigned, AssignmentStatus.active] }
        },
        data: {
          status: AssignmentStatus.removed,
          unassignedAt: now,
          reassignmentReason: reasonText ?? 'reassigned'
        }
      });

      await tx.turfAssignment.updateMany({
        where: {
          canvasserId,
          turfId: { not: turfId },
          status: { in: [AssignmentStatus.assigned, AssignmentStatus.active] }
        },
        data: {
          status: AssignmentStatus.removed,
          unassignedAt: now,
          reassignmentReason: reasonText ?? 'assigned_to_other_turf'
        }
      });

      const assignment = await tx.turfAssignment.create({
        data: {
          turfId,
          canvasserId,
          organizationId: turf.organizationId,
          campaignId: turf.campaignId,
          teamId: turf.teamId,
          regionCode: turf.regionCode,
          assignedByUserId: actorUserId,
          reassignmentReason: reasonText,
          status: AssignmentStatus.assigned
        }
      });

      await tx.turf.update({
        where: { id: turfId },
        data: {
          status: TurfStatus.assigned
        }
      });

      await this.auditService.log(
        {
          actorUserId,
          actionType: currentAssignments.length ? 'turf_reassigned' : 'turf_assigned',
          entityType: 'turf',
          entityId: turfId,
          reasonText,
          newValuesJson: {
            canvasserId,
            assignmentId: assignment.id
          }
        },
        tx
      );

      return assignment;
    });
  }

  async reopenTurf(
    turfId: string,
    actorUserId: string,
    reasonText?: string,
    scope: AccessScope = { organizationId: null, campaignId: null }
  ) {
    return this.prisma.$transaction(async (tx) => {
      const turf = await this.findScopedTurf(tx, turfId, scope);
      if (!turf) {
        throw new NotFoundException('Turf not found');
      }

      const openSessionCount = await tx.turfSession.count({
        where: {
          turfId,
          endTime: null
        }
      });

      if (openSessionCount > 0) {
        throw new BadRequestException('Cannot reopen a turf with an open session');
      }

      const updated = await tx.turf.update({
        where: { id: turfId },
        data: {
          status: TurfStatus.reopened,
          completedAt: null,
          completedById: null,
          reopenedAt: new Date(),
          reopenedById: actorUserId,
          reopenedReason: reasonText
        }
      });

      await this.auditService.log(
        {
          actorUserId,
          actionType: 'turf_reopened',
          entityType: 'turf',
          entityId: turfId,
          reasonText,
          oldValuesJson: {
            status: turf.status
          },
          newValuesJson: {
            status: updated.status
          }
        },
        tx
      );

      return updated;
    });
  }

  async archiveTurf(
    turfId: string,
    actorUserId: string,
    reasonText?: string,
    scope: AccessScope = { organizationId: null, campaignId: null }
  ) {
    const policy = await this.policiesService.getEffectivePolicy(scope);
    const normalizedReason = reasonText?.trim() || undefined;
    if (policy.requireArchiveReason && !normalizedReason) {
      throw new BadRequestException('An archive reason is required by the current policy');
    }

    return this.prisma.$transaction(async (tx) => {
      const turf = await this.findScopedTurf(tx, turfId, scope);
      if (!turf) {
        throw new NotFoundException('Turf not found');
      }

      const openSessionCount = await tx.turfSession.count({
        where: {
          turfId,
          endTime: null
        }
      });
      if (openSessionCount > 0) {
        throw new BadRequestException('Cannot archive a turf with an open session');
      }

      const now = new Date();
      await tx.turfAssignment.updateMany({
        where: {
          turfId,
          status: { in: [AssignmentStatus.assigned, AssignmentStatus.active] }
        },
        data: {
          status: AssignmentStatus.removed,
          unassignedAt: now,
          reassignmentReason: normalizedReason ?? 'archived'
        }
      });

      const updated = await tx.turf.update({
        where: { id: turfId },
        data: {
          status: TurfStatus.archived,
          archivedAt: now,
          purgeAt: this.buildPurgeAt(policy.retentionPurgeDays)
        }
      });

      await this.auditService.log(
        {
          actorUserId,
          actionType: 'turf_archived',
          entityType: 'turf',
          entityId: turfId,
          reasonText: normalizedReason,
          oldValuesJson: {
            status: turf.status
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

  async deleteTurf(
    turfId: string,
    actorUserId: string,
    reasonText: string,
    scope: AccessScope = { organizationId: null, campaignId: null }
  ) {
    const normalizedReason = reasonText.trim();
    if (!normalizedReason) {
      throw new BadRequestException('A delete reason is required');
    }

    const policy = await this.policiesService.getEffectivePolicy(scope);

    return this.prisma.$transaction(async (tx) => {
      const turf = await this.findScopedTurf(tx, turfId, scope);
      if (!turf) {
        throw new NotFoundException('Turf not found');
      }

      const openSessionCount = await tx.turfSession.count({
        where: {
          turfId,
          endTime: null
        }
      });
      if (openSessionCount > 0) {
        throw new BadRequestException('Cannot delete a turf with an open session');
      }

      const now = new Date();
      await tx.turfAssignment.updateMany({
        where: {
          turfId,
          status: { in: [AssignmentStatus.assigned, AssignmentStatus.active] }
        },
        data: {
          status: AssignmentStatus.removed,
          unassignedAt: now,
          reassignmentReason: normalizedReason
        }
      });

      await tx.address.updateMany({
        where: {
          turfId,
          deletedAt: null
        },
        data: {
          deletedAt: now,
          deleteReason: normalizedReason,
          purgeAt: this.buildPurgeAt(policy.retentionPurgeDays)
        }
      });

      const updated = await tx.turf.update({
        where: { id: turfId },
        data: {
          status: TurfStatus.archived,
          archivedAt: turf.archivedAt ?? now,
          deletedAt: now,
          deleteReason: normalizedReason,
          purgeAt: this.buildPurgeAt(policy.retentionPurgeDays)
        }
      });

      await this.auditService.log(
        {
          actorUserId,
          actionType: 'turf_deleted',
          entityType: 'turf',
          entityId: turfId,
          reasonText: normalizedReason,
          oldValuesJson: {
            status: turf.status
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

  async getTurfAddresses(turfId: string, scope: AccessScope) {
    const turf = await this.prisma.turf.findFirst({
      where: {
        id: turfId,
        ...this.scopeWhere(scope),
        deletedAt: null
      },
      include: {
        addresses: {
          where: { deletedAt: null },
          orderBy: { addressLine1: 'asc' },
          include: {
            visitLogs: {
              where: { deletedAt: null },
              orderBy: { visitTime: 'desc' },
              take: 1
            }
          }
        }
      }
    });

    if (!turf) {
      throw new NotFoundException('Turf not found');
    }

    return {
      ...turf,
      lifecycleStatus: this.toLifecycleStatus(turf.status),
      addresses: turf.addresses.map((address) => {
        const latestVisit = address.visitLogs[0];
        return {
          ...address,
          status: latestVisit ? 'completed' : 'pending',
          lastResult: latestVisit?.result ?? null,
          lastOutcomeCode: latestVisit?.outcomeCode ?? null,
          lastOutcomeLabel: latestVisit?.outcomeLabel ?? latestVisit?.result ?? null,
          lastVisitAt: latestVisit?.visitTime ?? null,
          pendingSync: false
        };
      })
    };
  }

  async getMyTurf(canvasserId: string) {
    const assignment = await this.prisma.turfAssignment.findFirst({
      where: {
        canvasserId,
        status: { in: [AssignmentStatus.assigned, AssignmentStatus.active] },
        turf: {
          deletedAt: null
        }
      },
      orderBy: { assignedAt: 'desc' },
      include: {
        turf: {
          include: {
            addresses: {
              where: { deletedAt: null },
              orderBy: { addressLine1: 'asc' },
              include: {
                visitLogs: {
                  where: { deletedAt: null },
                  orderBy: { visitTime: 'desc' },
                  take: 1
                }
              }
            }
          }
        }
      }
    });

    if (!assignment) {
      return {
        assignment: null,
        turf: null,
        session: null,
        progress: {
          completed: 0,
          total: 0,
          pendingSync: 0
        },
        addresses: []
      };
    }

    const session = await this.prisma.turfSession.findFirst({
      where: {
        canvasserId,
        turfId: assignment.turfId,
        endTime: null
      },
      orderBy: { startTime: 'desc' }
    });

    const addresses = assignment.turf.addresses.map((address) => {
      const latestVisit = address.visitLogs[0];
      return {
        id: address.id,
        turfId: address.turfId,
        addressLine1: address.addressLine1,
        city: address.city,
        state: address.state,
        zip: address.zip,
        latitude: address.latitude ? Number(address.latitude) : null,
        longitude: address.longitude ? Number(address.longitude) : null,
        vanId: address.vanId,
        status: latestVisit ? 'completed' : 'pending',
        lastResult: latestVisit?.outcomeLabel ?? latestVisit?.result ?? null,
        lastOutcomeCode: latestVisit?.outcomeCode ?? null,
        lastVisitAt: latestVisit?.visitTime ?? null,
        pendingSync: false
      };
    });

    return {
      assignment,
      turf: {
        id: assignment.turf.id,
        name: assignment.turf.name,
        description: assignment.turf.description,
        status: assignment.turf.status,
        lifecycleStatus: this.toLifecycleStatus(assignment.turf.status),
        createdAt: assignment.turf.createdAt
      },
      session: this.serializeSession(session),
      progress: {
        completed: addresses.filter((address) => address.status === 'completed').length,
        total: addresses.length,
        pendingSync: 0
      },
      addresses
    };
  }

  async startSession(input: {
    canvasserId: string;
    turfId: string;
    latitude?: number;
    longitude?: number;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.turfAssignment.findFirst({
        where: {
          canvasserId: input.canvasserId,
          turfId: input.turfId,
          status: { in: [AssignmentStatus.assigned, AssignmentStatus.active] }
        }
      });
      if (!assignment) {
        throw new BadRequestException('No active assignment for this turf');
      }

      await this.ensureNoCrossTurfOpenSession(tx, input.canvasserId, input.turfId);
      await this.ensureTurfSessionAvailability(tx, input.turfId, input.canvasserId);

      const existing = await tx.turfSession.findFirst({
        where: {
          canvasserId: input.canvasserId,
          turfId: input.turfId,
          endTime: null
        }
      });

      if (existing) {
        return this.serializeSession(existing);
      }

      await tx.turfAssignment.update({
        where: { id: assignment.id },
        data: { status: AssignmentStatus.active }
      });

      await tx.turf.update({
        where: { id: input.turfId },
        data: { status: TurfStatus.in_progress }
      });

      const session = await tx.turfSession.create({
        data: {
          turfId: input.turfId,
          canvasserId: input.canvasserId,
          organizationId: assignment.organizationId,
          campaignId: assignment.campaignId,
          teamId: assignment.teamId,
          regionCode: assignment.regionCode,
          startTime: new Date(),
          status: SessionStatus.active,
          lastActivityAt: new Date(),
          startLat: input.latitude,
          startLng: input.longitude
        }
      });

      await this.auditService.log(
        {
          actorUserId: input.canvasserId,
          actionType: 'turf_started',
          entityType: 'turf',
          entityId: input.turfId,
          newValuesJson: {
            sessionId: session.id,
            latitude: input.latitude,
            longitude: input.longitude
          }
        },
        tx
      );

      return this.serializeSession(session);
    });
  }

  async pauseSession(input: {
    canvasserId: string;
    turfId: string;
    latitude?: number;
    longitude?: number;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.turfSession.findFirst({
        where: {
          canvasserId: input.canvasserId,
          turfId: input.turfId,
          endTime: null,
          status: SessionStatus.active
        },
        orderBy: { startTime: 'desc' }
      });

      if (!session) {
        throw new BadRequestException('No active session found for this turf');
      }

      const updated = await tx.turfSession.update({
        where: { id: session.id },
        data: {
          status: SessionStatus.paused,
          lastActivityAt: new Date(),
          pauseReason: 'manual_pause'
        }
      });

      await tx.turf.update({
        where: { id: input.turfId },
        data: { status: TurfStatus.paused }
      });

      await this.auditService.log(
        {
          actorUserId: input.canvasserId,
          actionType: 'turf_paused',
          entityType: 'turf',
          entityId: input.turfId,
          newValuesJson: {
            sessionId: session.id,
            latitude: input.latitude,
            longitude: input.longitude
          }
        },
        tx
      );

      return this.serializeSession(updated);
    });
  }

  async resumeSession(input: {
    canvasserId: string;
    turfId: string;
    latitude?: number;
    longitude?: number;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.turfAssignment.findFirst({
        where: {
          canvasserId: input.canvasserId,
          turfId: input.turfId,
          status: { in: [AssignmentStatus.assigned, AssignmentStatus.active] }
        }
      });
      if (!assignment) {
        throw new BadRequestException('No active assignment for this turf');
      }

      await this.ensureNoCrossTurfOpenSession(tx, input.canvasserId, input.turfId);
      await this.ensureTurfSessionAvailability(tx, input.turfId, input.canvasserId);

      const session = await tx.turfSession.findFirst({
        where: {
          canvasserId: input.canvasserId,
          turfId: input.turfId,
          endTime: null,
          status: SessionStatus.paused
        },
        orderBy: { startTime: 'desc' }
      });

      if (!session) {
        throw new BadRequestException('No paused session found for this turf');
      }

      await tx.turfAssignment.update({
        where: { id: assignment.id },
        data: { status: AssignmentStatus.active }
      });

      await tx.turf.update({
        where: { id: input.turfId },
        data: { status: TurfStatus.in_progress }
      });

      const updated = await tx.turfSession.update({
        where: { id: session.id },
        data: {
          status: SessionStatus.active,
          lastActivityAt: new Date(),
          pauseReason: null
        }
      });

      await this.auditService.log(
        {
          actorUserId: input.canvasserId,
          actionType: 'turf_resumed',
          entityType: 'turf',
          entityId: input.turfId,
          newValuesJson: {
            sessionId: session.id,
            latitude: input.latitude,
            longitude: input.longitude
          }
        },
        tx
      );

      return this.serializeSession(updated);
    });
  }

  async completeSession(input: {
    canvasserId: string;
    turfId: string;
    latitude?: number;
    longitude?: number;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.turfSession.findFirst({
        where: {
          canvasserId: input.canvasserId,
          turfId: input.turfId,
          endTime: null,
          status: { in: [SessionStatus.active, SessionStatus.paused] }
        },
        orderBy: { startTime: 'desc' }
      });

      if (!session) {
        throw new BadRequestException('No open session found for this turf');
      }

      await tx.turfAssignment.updateMany({
        where: {
          canvasserId: input.canvasserId,
          turfId: input.turfId,
          status: { in: [AssignmentStatus.assigned, AssignmentStatus.active] }
        },
        data: {
          status: AssignmentStatus.completed
        }
      });

      const updated = await tx.turfSession.update({
        where: { id: session.id },
        data: {
          endTime: new Date(),
          status: SessionStatus.ended,
          lastActivityAt: new Date(),
          endReason: 'completed',
          endLat: input.latitude,
          endLng: input.longitude
        }
      });

      const remainingOpenSessions = await tx.turfSession.count({
        where: {
          turfId: input.turfId,
          endTime: null
        }
      });

      const remainingActiveAssignments = await tx.turfAssignment.count({
        where: {
          turfId: input.turfId,
          status: { in: [AssignmentStatus.assigned, AssignmentStatus.active] }
        }
      });

      await tx.turf.update({
        where: { id: input.turfId },
        data:
          remainingOpenSessions === 0 && remainingActiveAssignments === 0
            ? {
                status: TurfStatus.completed,
                completedAt: new Date(),
                completedById: input.canvasserId
              }
            : {
                status: TurfStatus.in_progress
              }
      });

      await this.auditService.log(
        {
          actorUserId: input.canvasserId,
          actionType: 'turf_completed',
          entityType: 'turf',
          entityId: input.turfId,
          newValuesJson: {
            sessionId: session.id,
            latitude: input.latitude,
            longitude: input.longitude
          }
        },
        tx
      );

      return this.serializeSession(updated);
    });
  }

  async endSession(input: {
    canvasserId: string;
    turfId: string;
    latitude?: number;
    longitude?: number;
  }) {
    return this.completeSession(input);
  }

  inferMappingFromHeaders(headers: string[]) {
    return inferMappingFromHeaders(headers);
  }
}
