import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { stringify } from 'csv-stringify/sync';
import { AuditService } from '../audit/audit.service';
import { AccessScope } from '../common/interfaces/access-scope.interface';
import { PoliciesService } from '../policies/policies.service';
import { PrismaService } from '../prisma/prisma.service';

type ExportOptions = {
  turfId?: string;
  markExported?: boolean;
  actorUserId?: string;
  organizationId?: string | null;
  campaignId?: string | null;
};

@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly policiesService: PoliciesService
  ) {}

  private buildTimestampedFilename(prefix: string) {
    const timestamp = new Date().toISOString().replace(/[:]/g, '-').replace(/\.\d{3}Z$/, 'Z');
    return `${prefix}-${timestamp}.csv`;
  }

  private buildScope(scope: AccessScope | ExportOptions) {
    return {
      organizationId: scope.organizationId ?? null,
      ...(scope.campaignId ? { campaignId: scope.campaignId } : {})
    } as const;
  }

  private async fetchVisits(options?: ExportOptions) {
    return this.prisma.visitLog.findMany({
      where: {
        ...this.buildScope(options ?? { organizationId: null }),
        deletedAt: null,
        ...(options?.turfId ? { turfId: options.turfId } : {}),
        ...(options?.markExported === false ? {} : { vanExported: false })
      },
      orderBy: { visitTime: 'asc' },
      include: {
        address: true,
        canvasser: true,
        geofenceResult: true,
        turf: true
      }
    });
  }

  private checksum(csv: string) {
    return createHash('sha256').update(csv).digest('hex');
  }

  private buildPurgeAt(days?: number | null) {
    if (!days || days <= 0) {
      return null;
    }

    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private async recordExportBatch(input: {
    profileCode: string;
    filename: string;
    csv: string;
    rowCount: number;
    turfId?: string;
    actorUserId?: string;
    markExported: boolean;
    scope: AccessScope;
    visits: Array<{ id: string }>;
    rows: Array<Record<string, unknown>>;
  }) {
    const policy = await this.policiesService.getEffectivePolicy(input.scope);

    return this.prisma.exportBatch.create({
      data: {
        profileCode: input.profileCode,
        filename: input.filename,
        organizationId: input.scope.organizationId,
        campaignId: input.scope.campaignId ?? null,
        turfId: input.turfId,
        initiatedByUserId: input.actorUserId ?? null,
        markExported: input.markExported,
        rowCount: input.rowCount,
        filterScopeJson: {
          turfId: input.turfId ?? null,
          organizationId: input.scope.organizationId,
          campaignId: input.scope.campaignId ?? null
        },
        csvContent: input.csv,
        sha256Checksum: this.checksum(input.csv),
        purgeAt: this.buildPurgeAt(policy.retentionPurgeDays),
        exportedVisits: {
          create: input.visits.map((visit, index) => ({
            visitLog: {
              connect: { id: visit.id }
            },
            rowIndex: index + 1,
            rowSnapshotJson: (input.rows[index] ?? null) as Prisma.InputJsonValue
          }))
        }
      },
      include: {
        exportedVisits: true
      }
    });
  }

  async exportHistory(scope: AccessScope) {
    return this.prisma.exportBatch.findMany({
      where: this.buildScope(scope),
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        initiatedByUser: {
          select: {
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
          }
        },
        turf: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            exportedVisits: true
          }
        }
      }
    });
  }

  async downloadExportBatch(batchId: string, scope: AccessScope) {
    const batch = await this.prisma.exportBatch.findFirst({
      where: {
        id: batchId,
        ...this.buildScope(scope)
      }
    });

    if (!batch || !batch.csvContent) {
      throw new NotFoundException('Export batch not found');
    }

    return {
      csv: batch.csvContent,
      filename: batch.filename,
      checksum: batch.sha256Checksum
    };
  }

  async vanResultsCsv(options?: ExportOptions) {
    const visits = await this.fetchVisits(options);
    const filename = this.buildTimestampedFilename('van-results');
    const rows = visits.map((visit) => ({
      van_id: visit.address.vanId ?? '',
      address_line1: visit.address.addressLine1,
      visit_time: visit.visitTime.toISOString(),
      result: visit.result,
      contact_made: visit.contactMade ? 'true' : 'false',
      notes: visit.notes ?? '',
      time_zone: 'America/Detroit',
      gps_status: visit.gpsStatus,
      latitude: visit.latitude?.toString() ?? '',
      longitude: visit.longitude?.toString() ?? '',
      accuracy_meters: visit.accuracyMeters?.toString() ?? '',
      distance_from_target_feet: visit.geofenceResult?.distanceFromTargetFeet?.toString() ?? '',
      sync_status: visit.syncStatus,
      canvasser_name: `${visit.canvasser.firstName} ${visit.canvasser.lastName}`.trim()
    }));

    const csv = stringify(rows, {
      header: true,
      bom: true
    });

    if (options?.markExported && visits.length > 0) {
      await this.prisma.visitLog.updateMany({
        where: { id: { in: visits.map((visit) => visit.id) } },
        data: { vanExported: true }
      });
    }

    const scope = {
      organizationId: options?.organizationId ?? null,
      campaignId: options?.campaignId ?? null
    };
    await this.recordExportBatch({
      profileCode: 'van_compatible',
      filename,
      csv,
      rowCount: visits.length,
      turfId: options?.turfId,
      actorUserId: options?.actorUserId,
      markExported: options?.markExported ?? false,
      scope,
      visits,
      rows
    });

    await this.auditService.log({
      actorUserId: options?.actorUserId ?? null,
      actionType: 'csv_export_generated',
      entityType: 'visit_export',
      entityId: options?.turfId ?? 'all',
      newValuesJson: {
        turfId: options?.turfId ?? null,
        organizationId: scope.organizationId,
        campaignId: scope.campaignId,
        markExported: options?.markExported ?? false,
        count: visits.length,
        profileCode: 'van_compatible'
      }
    });

    return { csv, count: visits.length, filename };
  }

  async internalMasterCsv(options?: ExportOptions) {
    const visits = await this.fetchVisits({
      ...options,
      markExported: false
    });
    const filename = this.buildTimestampedFilename('internal-master');
    const rows = visits.map((visit) => ({
      visit_id: visit.id,
      turf_id: visit.turfId,
      turf_name: visit.turf.name,
      address_id: visit.addressId,
      van_id: visit.address.vanId ?? '',
      address_line1: visit.address.addressLine1,
      city: visit.address.city,
      state: visit.address.state,
      zip: visit.address.zip ?? '',
      visit_time: visit.visitTime.toISOString(),
      client_created_at: visit.clientCreatedAt?.toISOString() ?? '',
      server_received_at: visit.serverReceivedAt.toISOString(),
      outcome_code: visit.outcomeCode,
      outcome_label: visit.outcomeLabel,
      legacy_result: visit.result,
      contact_made: visit.contactMade ? 'true' : 'false',
      notes: visit.notes ?? '',
      sync_status: visit.syncStatus,
      sync_conflict_flag: visit.syncConflictFlag ? 'true' : 'false',
      sync_conflict_reason: visit.syncConflictReason ?? '',
      gps_status: visit.gpsStatus,
      geofence_validated: visit.geofenceValidated ? 'true' : 'false',
      geofence_distance_meters: visit.geofenceDistanceMeters?.toString() ?? '',
      distance_from_target_feet: visit.geofenceResult?.distanceFromTargetFeet?.toString() ?? '',
      override_flag: visit.geofenceResult?.overrideFlag ? 'true' : 'false',
      override_reason: visit.geofenceResult?.overrideReason ?? '',
      latitude: visit.latitude?.toString() ?? '',
      longitude: visit.longitude?.toString() ?? '',
      accuracy_meters: visit.accuracyMeters?.toString() ?? '',
      local_record_uuid: visit.localRecordUuid ?? '',
      idempotency_key: visit.idempotencyKey ?? '',
      source: visit.source,
      canvasser_id: visit.canvasserId,
      canvasser_name: `${visit.canvasser.firstName} ${visit.canvasser.lastName}`.trim(),
      time_zone: 'America/Detroit',
      van_exported: visit.vanExported ? 'true' : 'false'
    }));

    const csv = stringify(rows, {
      header: true,
      bom: true
    });

    const scope = {
      organizationId: options?.organizationId ?? null,
      campaignId: options?.campaignId ?? null
    };
    await this.recordExportBatch({
      profileCode: 'internal_master',
      filename,
      csv,
      rowCount: visits.length,
      turfId: options?.turfId,
      actorUserId: options?.actorUserId,
      markExported: false,
      scope,
      visits,
      rows
    });

    await this.auditService.log({
      actorUserId: options?.actorUserId ?? null,
      actionType: 'csv_export_generated',
      entityType: 'visit_export',
      entityId: options?.turfId ?? 'all',
      newValuesJson: {
        turfId: options?.turfId ?? null,
        organizationId: scope.organizationId,
        campaignId: scope.campaignId,
        markExported: false,
        count: visits.length,
        profileCode: 'internal_master'
      }
    });

    return { csv, count: visits.length, filename };
  }
}
