import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AssignmentStatus, UserRole } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CsvField, CsvMapping, normalizeHeader, resolveMappedValue, toOptionalNumber } from '../common/utils/csv.util';

type ImportRow = Record<string, unknown>;

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
      activeSessionCount: activeSessionCounts.get(turf.id) ?? 0
    }));
  }

  async createTurf(input: { name: string; description?: string }, createdById: string) {
    return this.prisma.turf.create({
      data: {
        name: input.name,
        description: input.description,
        createdById
      }
    });
  }

  async assignTurf(turfId: string, canvasserId: string) {
    const turf = await this.prisma.turf.findUnique({ where: { id: turfId } });
    if (!turf) {
      throw new NotFoundException('Turf not found');
    }

    const canvasser = await this.usersService.findById(canvasserId);
    if (canvasser.role !== UserRole.canvasser) {
      throw new BadRequestException('Selected user is not a canvasser');
    }

    const assignment = await this.prisma.turfAssignment.create({
      data: {
        turfId,
        canvasserId,
        status: AssignmentStatus.assigned
      }
    });

    await this.auditService.log({
      actorUserId: null,
      actionType: 'turf_assigned',
      entityType: 'turf',
      entityId: turfId,
      newValuesJson: {
        canvasserId,
        assignmentId: assignment.id
      }
    });

    return assignment;
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
          createdById: input.createdById
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
            },
            _count: {
              select: {
                addresses: true,
                visits: true
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
        createdAt: assignment.turf.createdAt
      },
      session,
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
    const assignment = await this.prisma.turfAssignment.findFirst({
      where: {
        canvasserId: input.canvasserId,
        turfId: input.turfId,
        status: { in: [AssignmentStatus.assigned, AssignmentStatus.active] }
      }
    });
    if (!assignment) {
      throw new BadRequestException('No active assignment for this turf');
    }

    await this.prisma.turfAssignment.update({
      where: { id: assignment.id },
      data: { status: AssignmentStatus.active }
    });

    const existing = await this.prisma.turfSession.findFirst({
      where: {
        canvasserId: input.canvasserId,
        turfId: input.turfId,
        endTime: null
      }
    });

    if (existing) {
      return existing;
    }

    const session = await this.prisma.turfSession.create({
      data: {
        turfId: input.turfId,
        canvasserId: input.canvasserId,
        startTime: new Date(),
        status: 'active',
        startLat: input.latitude,
        startLng: input.longitude
      }
    });

    await this.auditService.log({
      actorUserId: input.canvasserId,
      actionType: 'turf_started',
      entityType: 'turf',
      entityId: input.turfId,
      newValuesJson: {
        sessionId: session.id,
        latitude: input.latitude,
        longitude: input.longitude
      }
    });

    return session;
  }

  async endSession(input: {
    canvasserId: string;
    turfId: string;
    latitude?: number;
    longitude?: number;
  }) {
    const session = await this.prisma.turfSession.findFirst({
      where: {
        canvasserId: input.canvasserId,
        turfId: input.turfId,
        endTime: null
      },
      orderBy: { startTime: 'desc' }
    });

    if (!session) {
      throw new BadRequestException('No active session found for this turf');
    }

    await this.prisma.turfAssignment.updateMany({
      where: {
        canvasserId: input.canvasserId,
        turfId: input.turfId,
        status: AssignmentStatus.active
      },
      data: { status: AssignmentStatus.completed }
    });

    const updated = await this.prisma.turfSession.update({
      where: { id: session.id },
      data: {
        endTime: new Date(),
        status: 'ended',
        endLat: input.latitude,
        endLng: input.longitude
      }
    });

    await this.auditService.log({
      actorUserId: input.canvasserId,
      actionType: 'turf_completed',
      entityType: 'turf',
      entityId: input.turfId,
      newValuesJson: {
        sessionId: session.id,
        latitude: input.latitude,
        longitude: input.longitude
      }
    });

    return updated;
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
