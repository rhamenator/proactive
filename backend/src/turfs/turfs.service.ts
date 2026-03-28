import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AssignmentStatus,
  SessionStatus,
  TurfStatus,
  UserRole,
  type Prisma,
  type TurfSession
} from '@prisma/client';
import { parse } from 'csv-parse/sync';
import { AuditService } from '../audit/audit.service';
import { CsvField, CsvMapping, normalizeHeader, resolveMappedValue, toOptionalNumber } from '../common/utils/csv.util';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

type ImportRow = Record<string, unknown>;
type PrismaWriter = PrismaService | Prisma.TransactionClient;
type LifecycleStatus = 'open' | 'paused' | 'completed' | 'closed';

const csvFieldHeaders: Record<CsvField, string[]> = {
  vanId: ['van_id', 'van id', 'record id'],
  addressLine1: ['address_line1', 'address line 1', 'street', 'street address', 'address'],
  city: ['city'],
  state: ['state'],
  zip: ['zip', 'zipcode', 'postal'],
  latitude: ['latitude', 'lat'],
  longitude: ['longitude', 'lng', 'lon'],
  turfName: ['turf_name', 'turf', 'district']
};

@Injectable()
export class TurfsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService
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

  private async ensureAssignableCanvasser(canvasserId: string) {
    const canvasser = await this.usersService.findById(canvasserId);
    if (canvasser.role !== UserRole.canvasser) {
      throw new BadRequestException('Selected user is not a canvasser');
    }
    if (!canvasser.isActive || canvasser.status !== 'active') {
      throw new BadRequestException('Selected canvasser is not active');
    }
    return canvasser;
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

  async listTurfs() {
    const turfs = await this.prisma.turf.findMany({
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
      where: { endTime: null }
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

  async createTurf(input: { name: string; description?: string }, createdById: string) {
    return this.prisma.turf.create({
      data: {
        name: input.name,
        description: input.description,
        createdById,
        status: TurfStatus.unassigned
      }
    });
  }

  async assignTurf(turfId: string, canvasserId: string, actorUserId: string, reasonText?: string) {
    await this.ensureAssignableCanvasser(canvasserId);

    return this.prisma.$transaction(async (tx) => {
      const turf = await tx.turf.findUnique({ where: { id: turfId } });
      if (!turf) {
        throw new NotFoundException('Turf not found');
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

  async reopenTurf(turfId: string, actorUserId: string, reasonText?: string) {
    return this.prisma.$transaction(async (tx) => {
      const turf = await tx.turf.findUnique({ where: { id: turfId } });
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

  async importCsv(input: {
    csv: string;
    createdById: string;
    turfName?: string;
    mapping?: CsvMapping;
  }) {
    const records = parse(input.csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }) as ImportRow[];

    if (records.length === 0) {
      throw new BadRequestException('CSV file contains no rows');
    }

    const groupedRows = new Map<string, ImportRow[]>();
    for (const row of records) {
      const turfName =
        resolveMappedValue(row, 'turfName', input.mapping) ?? input.turfName ?? 'Imported Turf';
      if (!groupedRows.has(turfName)) {
        groupedRows.set(turfName, []);
      }
      groupedRows.get(turfName)!.push(row);
    }

    const createdTurfs: string[] = [];
    let addressCount = 0;
    const importedTurfs = [];

    for (const [turfName, rows] of groupedRows.entries()) {
      const turf = await this.prisma.turf.create({
        data: {
          name: turfName,
          description: `Imported from CSV on ${new Date().toISOString()}`,
          createdById: input.createdById,
          status: TurfStatus.unassigned
        }
      });
      createdTurfs.push(turf.id);
      importedTurfs.push(turf);

      for (const row of rows) {
        const addressLine1 = resolveMappedValue(row, 'addressLine1', input.mapping);
        const city = resolveMappedValue(row, 'city', input.mapping);
        const state = resolveMappedValue(row, 'state', input.mapping);
        if (!addressLine1 || !city || !state) {
          continue;
        }

        await this.prisma.address.create({
          data: {
            turfId: turf.id,
            addressLine1,
            city,
            state,
            zip: resolveMappedValue(row, 'zip', input.mapping),
            vanId: resolveMappedValue(row, 'vanId', input.mapping),
            latitude: toOptionalNumber(resolveMappedValue(row, 'latitude', input.mapping)),
            longitude: toOptionalNumber(resolveMappedValue(row, 'longitude', input.mapping))
          }
        });
        addressCount += 1;
      }
    }

    const result = {
      turfsCreated: createdTurfs.length,
      addressesImported: addressCount,
      turfs: importedTurfs
    };

    await this.auditService.log({
      actorUserId: input.createdById,
      actionType: 'csv_import_completed',
      entityType: 'turf_import',
      entityId: createdTurfs[0] ?? 'none',
      newValuesJson: result
    });

    return result;
  }

  async getTurfAddresses(turfId: string) {
    const turf = await this.prisma.turf.findUnique({
      where: { id: turfId },
      include: {
        addresses: {
          orderBy: { addressLine1: 'asc' },
          include: {
            visitLogs: {
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
        status: { in: [AssignmentStatus.assigned, AssignmentStatus.active] }
      },
      orderBy: { assignedAt: 'desc' },
      include: {
        turf: {
          include: {
            addresses: {
              orderBy: { addressLine1: 'asc' },
              include: {
                visitLogs: {
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
        lastResult: latestVisit?.result ?? null,
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
    const normalizedHeaders = headers.map((header) => ({
      header,
      normalized: normalizeHeader(header)
    }));

    const mapping: CsvMapping = {};
    for (const field of Object.keys(csvFieldHeaders) as CsvField[]) {
      const match = normalizedHeaders.find((candidate) =>
        csvFieldHeaders[field].some((alias) => candidate.normalized === normalizeHeader(alias))
      );
      if (match) {
        mapping[field] = match.header;
      }
    }
    return mapping;
  }
}
