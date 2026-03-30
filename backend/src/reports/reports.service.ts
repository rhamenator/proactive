import { Injectable } from '@nestjs/common';
import { Prisma, SyncStatus, GpsStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type ReportFilters = {
  organizationId: string | null;
  campaignId?: string;
  dateFrom?: string;
  dateTo?: string;
  turfId?: string;
  canvasserId?: string;
  outcomeCode?: string;
  overrideFlag?: boolean;
  syncStatus?: SyncStatus;
  gpsStatus?: GpsStatus;
  limit?: number;
};

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

type ReportUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
};

type ReportVisit = {
  id: string;
  addressId: string;
  canvasserId: string;
  sessionId: string | null;
  turfId: string;
  visitTime: Date;
  contactMade: boolean;
  gpsStatus: GpsStatus;
  syncStatus: SyncStatus;
  syncConflictFlag: boolean;
  outcomeCode: string;
  outcomeLabel: string;
  result: string;
  canvasser: ReportUser;
  turf: {
    id: string;
    name: string;
  };
  address: {
    id: string;
    addressLine1: string;
    city: string;
    state: string;
    zip: string | null;
  };
  geofenceResult: null | {
    gpsStatus: GpsStatus;
    failureReason: string | null;
    distanceFromTargetFeet: Prisma.Decimal | number | null;
    accuracyMeters: Prisma.Decimal | number | null;
    validationRadiusFeet: number;
    overrideFlag: boolean;
    overrideReason: string | null;
    overrideByUserId: string | null;
    overrideAt: Date | null;
  };
};

type ReportSession = {
  id: string;
  canvasserId: string;
  turfId: string;
  startTime: Date;
  endTime: Date | null;
  status: string;
};

function toNumber(value: Prisma.Decimal | number | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return value.toNumber();
}

function safeRatio(numerator: number, denominator: number) {
  if (!denominator) {
    return 0;
  }

  return Number((numerator / denominator).toFixed(4));
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private getRange(filters: ReportFilters) {
    const from = filters.dateFrom ? new Date(filters.dateFrom) : null;
    const to = filters.dateTo ? new Date(filters.dateTo) : null;
    return { from, to };
  }

  private normalizeFilters(filters: ReportFilters) {
    return {
      organizationId: filters.organizationId,
      campaignId: filters.campaignId ?? null,
      dateFrom: filters.dateFrom ?? null,
      dateTo: filters.dateTo ?? null,
      turfId: filters.turfId ?? null,
      canvasserId: filters.canvasserId ?? null,
      outcomeCode: filters.outcomeCode ?? null,
      overrideFlag: filters.overrideFlag ?? null,
      syncStatus: filters.syncStatus ?? null,
      gpsStatus: filters.gpsStatus ?? null,
      limit: filters.limit ?? null
    };
  }

  private buildVisitWhere(filters: ReportFilters): Prisma.VisitLogWhereInput {
    const where: Prisma.VisitLogWhereInput = {
      organizationId: filters.organizationId,
      deletedAt: null
    };
    if (filters.campaignId) {
      where.campaignId = filters.campaignId;
    }
    const { from, to } = this.getRange(filters);

    if (from || to) {
      where.visitTime = {};
      if (from) {
        where.visitTime.gte = from;
      }
      if (to) {
        where.visitTime.lte = to;
      }
    }

    if (filters.turfId) {
      where.turfId = filters.turfId;
    }
    if (filters.canvasserId) {
      where.canvasserId = filters.canvasserId;
    }
    if (filters.outcomeCode) {
      where.outcomeCode = filters.outcomeCode;
    }
    if (filters.syncStatus) {
      where.syncStatus = filters.syncStatus;
    }
    if (filters.gpsStatus) {
      where.gpsStatus = filters.gpsStatus;
    }
    if (filters.overrideFlag !== undefined) {
      where.geofenceResult = {
        is: {
          overrideFlag: filters.overrideFlag
        }
      };
    }

    return where;
  }

  private buildSessionWhere(filters: ReportFilters): Prisma.TurfSessionWhereInput {
    const where: Prisma.TurfSessionWhereInput = {
      organizationId: filters.organizationId
    };
    if (filters.campaignId) {
      where.campaignId = filters.campaignId;
    }
    const { from, to } = this.getRange(filters);
    const andConditions: Prisma.TurfSessionWhereInput[] = [];

    if (filters.turfId) {
      where.turfId = filters.turfId;
    }
    if (filters.canvasserId) {
      where.canvasserId = filters.canvasserId;
    }
    if (to) {
      andConditions.push({
        startTime: { lte: to }
      });
    }
    if (from) {
      andConditions.push({
        OR: [{ endTime: null }, { endTime: { gte: from } }]
      });
    }
    if (andConditions.length) {
      where.AND = andConditions;
    }

    return where;
  }

  private buildAuditWhere(filters: ReportFilters): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {
      organizationId: filters.organizationId
    };
    const { from, to } = this.getRange(filters);

    if (from || to) {
      where.createdAt = {};
      if (from) {
        where.createdAt.gte = from;
      }
      if (to) {
        where.createdAt.lte = to;
      }
    }

    if (filters.canvasserId) {
      where.actorUserId = filters.canvasserId;
    }

    return where;
  }

  private async loadVisits(filters: ReportFilters): Promise<ReportVisit[]> {
    return this.prisma.visitLog.findMany({
      where: this.buildVisitWhere(filters),
      orderBy: { visitTime: 'desc' },
      select: {
        id: true,
        addressId: true,
        canvasserId: true,
        sessionId: true,
        turfId: true,
        visitTime: true,
        contactMade: true,
        gpsStatus: true,
        syncStatus: true,
        syncConflictFlag: true,
        outcomeCode: true,
        outcomeLabel: true,
        result: true,
        canvasser: {
          select: safeUserSelect
        },
        turf: {
          select: {
            id: true,
            name: true
          }
        },
        address: {
          select: {
            id: true,
            addressLine1: true,
            city: true,
            state: true,
            zip: true
          }
        },
        geofenceResult: {
          select: {
            gpsStatus: true,
            failureReason: true,
            distanceFromTargetFeet: true,
            accuracyMeters: true,
            validationRadiusFeet: true,
            overrideFlag: true,
            overrideReason: true,
            overrideByUserId: true,
            overrideAt: true
          }
        }
      }
    }) as Promise<ReportVisit[]>;
  }

  private async loadSessions(filters: ReportFilters): Promise<ReportSession[]> {
    return this.prisma.turfSession.findMany({
      where: this.buildSessionWhere(filters),
      select: {
        id: true,
        canvasserId: true,
        turfId: true,
        startTime: true,
        endTime: true,
        status: true
      }
    }) as Promise<ReportSession[]>;
  }

  private getSessionMinutes(session: ReportSession, filters: ReportFilters) {
    const { from, to } = this.getRange(filters);
    const sessionStart = session.startTime.getTime();
    const sessionEnd = (session.endTime ?? new Date()).getTime();
    const clippedStart = from ? Math.max(sessionStart, from.getTime()) : sessionStart;
    const clippedEnd = to ? Math.min(sessionEnd, to.getTime()) : sessionEnd;

    if (clippedEnd <= clippedStart) {
      return 0;
    }

    return (clippedEnd - clippedStart) / 60000;
  }

  private async loadOverrideUsers(visits: ReportVisit[]) {
    const overrideIds = Array.from(
      new Set(
        visits
          .map((visit) => visit.geofenceResult?.overrideByUserId ?? null)
          .filter((value): value is string => Boolean(value))
      )
    );

    if (!overrideIds.length) {
      return new Map<string, ReportUser>();
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: overrideIds } },
      select: safeUserSelect
    });

    return new Map(users.map((user) => [user.id, user]));
  }

  async getOverview(filters: ReportFilters) {
    const [visits, sessions, recentAudit] = await Promise.all([
      this.loadVisits(filters),
      this.prisma.turfSession.findMany({
        where: {
          ...this.buildSessionWhere(filters),
          endTime: null
        },
        select: {
          id: true,
          canvasserId: true
        }
      }),
      this.prisma.auditLog.findMany({
        where: this.buildAuditWhere(filters),
        orderBy: { createdAt: 'desc' },
        take: Math.min(filters.limit ?? 10, 25),
        include: {
          actorUser: {
            select: safeUserSelect
          }
        }
      })
    ]);

    const productivitySummary = new Map<
      string,
      {
        canvasserId: string;
        canvasserName: string;
        email: string;
        totalVisits: number;
        uniqueAddresses: Set<string>;
        contactMade: number;
      }
    >();

    const uniqueAddressIds = new Set<string>();
    let contactMade = 0;
    let verifiedGps = 0;
    let flaggedGps = 0;
    let missingGps = 0;
    let lowAccuracyGps = 0;
    let overrideCount = 0;
    let pendingSync = 0;
    let syncing = 0;
    let synced = 0;
    let failed = 0;
    let conflicts = 0;

    for (const visit of visits) {
      uniqueAddressIds.add(visit.addressId);
      if (visit.contactMade) {
        contactMade += 1;
      }

      switch (visit.gpsStatus) {
        case 'verified':
          verifiedGps += 1;
          break;
        case 'flagged':
          flaggedGps += 1;
          break;
        case 'missing':
          missingGps += 1;
          break;
        case 'low_accuracy':
          lowAccuracyGps += 1;
          break;
      }

      switch (visit.syncStatus) {
        case 'pending':
          pendingSync += 1;
          break;
        case 'syncing':
          syncing += 1;
          break;
        case 'synced':
          synced += 1;
          break;
        case 'failed':
          failed += 1;
          break;
        case 'conflict':
          conflicts += 1;
          break;
      }

      if (visit.geofenceResult?.overrideFlag) {
        overrideCount += 1;
      }

      const current =
        productivitySummary.get(visit.canvasserId) ??
        {
          canvasserId: visit.canvasserId,
          canvasserName: `${visit.canvasser.firstName} ${visit.canvasser.lastName}`.trim(),
          email: visit.canvasser.email,
          totalVisits: 0,
          uniqueAddresses: new Set<string>(),
          contactMade: 0
        };

      current.totalVisits += 1;
      current.uniqueAddresses.add(visit.addressId);
      if (visit.contactMade) {
        current.contactMade += 1;
      }
      productivitySummary.set(visit.canvasserId, current);
    }

    return {
      filters: this.normalizeFilters(filters),
      dataFreshness: {
        reflectsSyncedDataOnly: pendingSync + syncing + failed + conflicts === 0,
        pendingSyncRecords: pendingSync + syncing,
        failedSyncRecords: failed,
        conflictRecords: conflicts
      },
      kpis: {
        totalVisits: visits.length,
        uniqueAddressesVisited: uniqueAddressIds.size,
        contactsMade: contactMade,
        activeCanvassers: new Set(sessions.map((session) => session.canvasserId)).size,
        syncStatus: {
          pending: pendingSync,
          syncing,
          synced,
          failed,
          conflict: conflicts
        },
        gpsStatus: {
          verified: verifiedGps,
          flagged: flaggedGps,
          missing: missingGps,
          lowAccuracy: lowAccuracyGps,
          overrides: overrideCount
        }
      },
      productivityPreview: Array.from(productivitySummary.values())
        .map((entry) => ({
          canvasserId: entry.canvasserId,
          canvasserName: entry.canvasserName,
          email: entry.email,
          totalVisits: entry.totalVisits,
          uniqueAddressesVisited: entry.uniqueAddresses.size,
          contactsMade: entry.contactMade
        }))
        .sort((left, right) => right.totalVisits - left.totalVisits || left.canvasserName.localeCompare(right.canvasserName))
        .slice(0, 5),
      recentAuditActivity: recentAudit.map((entry) => ({
        id: entry.id,
        actionType: entry.actionType,
        entityType: entry.entityType,
        entityId: entry.entityId,
        reasonCode: entry.reasonCode,
        reasonText: entry.reasonText,
        createdAt: entry.createdAt,
        actorUser: entry.actorUser
      }))
    };
  }

  async getProductivity(filters: ReportFilters) {
    const [visits, sessions] = await Promise.all([this.loadVisits(filters), this.loadSessions(filters)]);
    const rows = new Map<
      string,
      {
        canvasserId: string;
        canvasserName: string;
        email: string;
        totalVisits: number;
        uniqueAddresses: Set<string>;
        contactsMade: number;
        gpsVerifiedVisits: number;
        gpsFlaggedVisits: number;
        sessionIds: Set<string>;
        totalSessionMinutes: number;
      }
    >();

    for (const visit of visits) {
      const current =
        rows.get(visit.canvasserId) ??
        {
          canvasserId: visit.canvasserId,
          canvasserName: `${visit.canvasser.firstName} ${visit.canvasser.lastName}`.trim(),
          email: visit.canvasser.email,
          totalVisits: 0,
          uniqueAddresses: new Set<string>(),
          contactsMade: 0,
          gpsVerifiedVisits: 0,
          gpsFlaggedVisits: 0,
          sessionIds: new Set<string>(),
          totalSessionMinutes: 0
        };

      current.totalVisits += 1;
      current.uniqueAddresses.add(visit.addressId);
      if (visit.contactMade) {
        current.contactsMade += 1;
      }
      if (visit.gpsStatus === 'verified') {
        current.gpsVerifiedVisits += 1;
      }
      if (visit.gpsStatus === 'flagged') {
        current.gpsFlaggedVisits += 1;
      }
      if (visit.sessionId) {
        current.sessionIds.add(visit.sessionId);
      }
      rows.set(visit.canvasserId, current);
    }

    for (const session of sessions) {
      const current = rows.get(session.canvasserId);
      if (!current) {
        continue;
      }

      current.sessionIds.add(session.id);
      current.totalSessionMinutes += this.getSessionMinutes(session, filters);
    }

    const data = Array.from(rows.values())
      .map((entry) => {
        const averageSessionMinutes = entry.sessionIds.size
          ? entry.totalSessionMinutes / entry.sessionIds.size
          : 0;
        const housesPerHour = entry.totalSessionMinutes
          ? entry.totalVisits / (entry.totalSessionMinutes / 60)
          : 0;

        return {
          canvasserId: entry.canvasserId,
          canvasserName: entry.canvasserName,
          email: entry.email,
          totalVisits: entry.totalVisits,
          uniqueAddressesVisited: entry.uniqueAddresses.size,
          contactsMade: entry.contactsMade,
          sessionsCount: entry.sessionIds.size,
          totalSessionMinutes: Number(entry.totalSessionMinutes.toFixed(2)),
          averageSessionMinutes: Number(averageSessionMinutes.toFixed(2)),
          housesPerHour: Number(housesPerHour.toFixed(2)),
          gpsVerifiedRate: safeRatio(entry.gpsVerifiedVisits, entry.totalVisits),
          gpsFlaggedRate: safeRatio(entry.gpsFlaggedVisits, entry.totalVisits)
        };
      })
      .sort((left, right) => right.totalVisits - left.totalVisits || left.canvasserName.localeCompare(right.canvasserName));

    const totalHousesPerHour = data.reduce((sum, row) => sum + row.housesPerHour, 0);

    return {
      filters: this.normalizeFilters(filters),
      summary: {
        totalCanvassers: data.length,
        totalVisits: data.reduce((sum, row) => sum + row.totalVisits, 0),
        totalUniqueAddressesVisited: data.reduce((sum, row) => sum + row.uniqueAddressesVisited, 0),
        averageHousesPerHour: data.length ? Number((totalHousesPerHour / data.length).toFixed(2)) : 0
      },
      rows: data
    };
  }

  async getGpsExceptions(filters: ReportFilters) {
    const visits = await this.loadVisits(filters);
    const exceptionVisits = visits.filter(
      (visit) =>
        visit.gpsStatus === 'flagged' ||
        visit.gpsStatus === 'missing' ||
        visit.gpsStatus === 'low_accuracy' ||
        Boolean(visit.geofenceResult?.overrideFlag)
    );
    const overrideUsers = await this.loadOverrideUsers(exceptionVisits);

    const byCanvasser = new Map<string, { canvasserId: string; canvasserName: string; total: number }>();
    const byTurf = new Map<string, { turfId: string; turfName: string; total: number }>();
    let flagged = 0;
    let missing = 0;
    let lowAccuracy = 0;
    let overrides = 0;

    const rows = exceptionVisits.map((visit) => {
      const canvasserName = `${visit.canvasser.firstName} ${visit.canvasser.lastName}`.trim();
      const overrideUser = visit.geofenceResult?.overrideByUserId
        ? overrideUsers.get(visit.geofenceResult.overrideByUserId) ?? null
        : null;

      const canvasserEntry =
        byCanvasser.get(visit.canvasserId) ??
        {
          canvasserId: visit.canvasserId,
          canvasserName,
          total: 0
        };
      canvasserEntry.total += 1;
      byCanvasser.set(visit.canvasserId, canvasserEntry);

      const turfEntry =
        byTurf.get(visit.turfId) ??
        {
          turfId: visit.turfId,
          turfName: visit.turf.name,
          total: 0
        };
      turfEntry.total += 1;
      byTurf.set(visit.turfId, turfEntry);

      switch (visit.gpsStatus) {
        case 'flagged':
          flagged += 1;
          break;
        case 'missing':
          missing += 1;
          break;
        case 'low_accuracy':
          lowAccuracy += 1;
          break;
      }

      if (visit.geofenceResult?.overrideFlag) {
        overrides += 1;
      }

      return {
        visitId: visit.id,
        visitTime: visit.visitTime,
        canvasser: {
          id: visit.canvasser.id,
          name: canvasserName,
          email: visit.canvasser.email
        },
        turf: visit.turf,
        address: visit.address,
        outcome: {
          code: visit.outcomeCode,
          label: visit.outcomeLabel,
          result: visit.result
        },
        syncStatus: visit.syncStatus,
        gpsStatus: visit.gpsStatus,
        geofence: {
          distanceFromTargetFeet: toNumber(visit.geofenceResult?.distanceFromTargetFeet),
          accuracyMeters: toNumber(visit.geofenceResult?.accuracyMeters),
          validationRadiusFeet: visit.geofenceResult?.validationRadiusFeet ?? null,
          failureReason: visit.geofenceResult?.failureReason ?? null
        },
        override: {
          flag: Boolean(visit.geofenceResult?.overrideFlag),
          reason: visit.geofenceResult?.overrideReason ?? null,
          approvedAt: visit.geofenceResult?.overrideAt ?? null,
          approvedBy: overrideUser
            ? {
                id: overrideUser.id,
                name: `${overrideUser.firstName} ${overrideUser.lastName}`.trim(),
                email: overrideUser.email
              }
            : null
        }
      };
    });

    return {
      filters: this.normalizeFilters(filters),
      summary: {
        totalExceptions: rows.length,
        flagged,
        missing,
        lowAccuracy,
        overrides,
        byCanvasser: Array.from(byCanvasser.values()).sort((left, right) => right.total - left.total),
        byTurf: Array.from(byTurf.values()).sort((left, right) => right.total - left.total)
      },
      rows
    };
  }

  async getAuditActivity(filters: ReportFilters) {
    const audit = await this.prisma.auditLog.findMany({
      where: this.buildAuditWhere(filters),
      orderBy: { createdAt: 'desc' },
      take: Math.min(filters.limit ?? 100, 250),
      include: {
        actorUser: {
          select: safeUserSelect
        }
      }
    });

    const byActionType = new Map<string, number>();
    const byEntityType = new Map<string, number>();

    for (const entry of audit) {
      byActionType.set(entry.actionType, (byActionType.get(entry.actionType) ?? 0) + 1);
      byEntityType.set(entry.entityType, (byEntityType.get(entry.entityType) ?? 0) + 1);
    }

    return {
      filters: this.normalizeFilters(filters),
      summary: {
        totalEntries: audit.length,
        byActionType: Array.from(byActionType.entries())
          .map(([actionType, count]) => ({ actionType, count }))
          .sort((left, right) => right.count - left.count || left.actionType.localeCompare(right.actionType)),
        byEntityType: Array.from(byEntityType.entries())
          .map(([entityType, count]) => ({ entityType, count }))
          .sort((left, right) => right.count - left.count || left.entityType.localeCompare(right.entityType))
      },
      rows: audit.map((entry) => ({
        id: entry.id,
        actionType: entry.actionType,
        entityType: entry.entityType,
        entityId: entry.entityId,
        reasonCode: entry.reasonCode,
        reasonText: entry.reasonText,
        oldValuesJson: entry.oldValuesJson,
        newValuesJson: entry.newValuesJson,
        createdAt: entry.createdAt,
        actorUser: entry.actorUser
      }))
    };
  }

  async getTrendSummary(filters: ReportFilters) {
    const visits = await this.loadVisits(filters);
    const byDay = new Map<string, { visits: number; contactsMade: number; addresses: Set<string> }>();
    const byOutcome = new Map<string, { outcomeCode: string; outcomeLabel: string; total: number }>();

    for (const visit of visits) {
      const day = visit.visitTime.toISOString().slice(0, 10);
      const dayBucket = byDay.get(day) ?? { visits: 0, contactsMade: 0, addresses: new Set<string>() };
      dayBucket.visits += 1;
      dayBucket.addresses.add(visit.addressId);
      if (visit.contactMade) {
        dayBucket.contactsMade += 1;
      }
      byDay.set(day, dayBucket);

      const outcomeBucket = byOutcome.get(visit.outcomeCode) ?? {
        outcomeCode: visit.outcomeCode,
        outcomeLabel: visit.outcomeLabel,
        total: 0
      };
      outcomeBucket.total += 1;
      byOutcome.set(visit.outcomeCode, outcomeBucket);
    }

    return {
      filters: this.normalizeFilters(filters),
      summary: {
        days: byDay.size,
        totalVisits: visits.length,
        averageVisitsPerDay: byDay.size ? Number((visits.length / byDay.size).toFixed(2)) : 0
      },
      byDay: Array.from(byDay.entries())
        .map(([day, bucket]) => ({
          day,
          visits: bucket.visits,
          contactsMade: bucket.contactsMade,
          uniqueAddressesVisited: bucket.addresses.size
        }))
        .sort((left, right) => left.day.localeCompare(right.day)),
      byOutcome: Array.from(byOutcome.values()).sort((left, right) => right.total - left.total)
    };
  }

  async getResolvedConflicts(filters: ReportFilters) {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        ...this.buildAuditWhere(filters),
        actionType: 'sync_conflict_resolved'
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(filters.limit ?? 100, 250),
      include: {
        actorUser: {
          select: safeUserSelect
        }
      }
    });

    return {
      filters: this.normalizeFilters(filters),
      summary: {
        totalResolved: rows.length
      },
      rows: rows.map((row) => ({
        id: row.id,
        visitLogId: row.entityId,
        resolvedAt: row.createdAt,
        reasonText: row.reasonText,
        actorUser: row.actorUser,
        oldValuesJson: row.oldValuesJson,
        newValuesJson: row.newValuesJson
      }))
    };
  }

  async getExportBatchAnalytics(filters: ReportFilters) {
    const rows = await this.prisma.exportBatch.findMany({
      where: {
        organizationId: filters.organizationId,
        ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
        ...(filters.turfId ? { turfId: filters.turfId } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(filters.limit ?? 100, 250),
      include: {
        turf: {
          select: {
            id: true,
            name: true
          }
        },
        initiatedByUser: {
          select: safeUserSelect
        },
        _count: {
          select: {
            exportedVisits: true
          }
        }
      }
    });

    const byProfile = new Map<string, number>();
    let totalRows = 0;
    let artifactBackedBatches = 0;

    for (const row of rows) {
      totalRows += row.rowCount;
      if (row.csvContent) {
        artifactBackedBatches += 1;
      }
      byProfile.set(row.profileCode, (byProfile.get(row.profileCode) ?? 0) + 1);
    }

    return {
      filters: this.normalizeFilters(filters),
      summary: {
        totalBatches: rows.length,
        totalRows,
        artifactBackedBatches,
        byProfile: Array.from(byProfile.entries()).map(([profileCode, count]) => ({ profileCode, count }))
      },
      rows: rows.map((row) => ({
        id: row.id,
        profileCode: row.profileCode,
        filename: row.filename,
        createdAt: row.createdAt,
        rowCount: row.rowCount,
        markExported: row.markExported,
        hasStoredArtifact: Boolean(row.csvContent),
        checksum: row.sha256Checksum,
        turf: row.turf,
        initiatedByUser: row.initiatedByUser,
        traceableVisitCount: row._count.exportedVisits
      }))
    };
  }
}
