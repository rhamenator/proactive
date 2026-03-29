import { Injectable } from '@nestjs/common';
import { stringify } from 'csv-stringify/sync';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

type ExportOptions = {
  turfId?: string;
  markExported?: boolean;
  actorUserId?: string;
  organizationId?: string | null;
};

@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  private buildTimestampedFilename(prefix: string) {
    const timestamp = new Date().toISOString().replace(/[:]/g, '-').replace(/\.\d{3}Z$/, 'Z');
    return `${prefix}-${timestamp}.csv`;
  }

  private organizationScope(organizationId: string | null | undefined) {
    return {
      organizationId: organizationId ?? null
    } as const;
  }

  private async fetchVisits(options?: ExportOptions) {
    return this.prisma.visitLog.findMany({
      where: {
        ...this.organizationScope(options?.organizationId),
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

  async exportHistory(organizationId: string | null) {
    return this.prisma.exportBatch.findMany({
      where: {
        OR: [
          { turf: this.organizationScope(organizationId) },
          {
            turfId: null,
            initiatedByUser: this.organizationScope(organizationId)
          }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
      include: {
        initiatedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true
          }
        },
        turf: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
  }

  async vanResultsCsv(options?: ExportOptions) {
    const visits = await this.fetchVisits(options);
    const filename = this.buildTimestampedFilename('van-results');

    if (options?.markExported && visits.length > 0) {
      await this.prisma.visitLog.updateMany({
        where: { id: { in: visits.map((visit) => visit.id) } },
        data: { vanExported: true }
      });
    }

    const csv = stringify(
      visits.map((visit) => ({
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
      })),
      {
        header: true,
        bom: true
      }
    );

    await this.prisma.exportBatch.create({
      data: {
        profileCode: 'van_compatible',
        filename,
        turfId: options?.turfId,
        initiatedByUserId: options?.actorUserId ?? null,
        markExported: options?.markExported ?? false,
        rowCount: visits.length,
        filterScopeJson: {
          turfId: options?.turfId ?? null,
          organizationId: options?.organizationId ?? null
        }
      }
    });

    await this.auditService.log({
      actorUserId: options?.actorUserId ?? null,
      actionType: 'csv_export_generated',
      entityType: 'visit_export',
      entityId: options?.turfId ?? 'all',
      newValuesJson: {
        turfId: options?.turfId ?? null,
        organizationId: options?.organizationId ?? null,
        markExported: options?.markExported ?? false,
        count: visits.length
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

    const csv = stringify(
      visits.map((visit) => ({
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
      })),
      {
        header: true,
        bom: true
      }
    );

    await this.prisma.exportBatch.create({
      data: {
        profileCode: 'internal_master',
        filename,
        turfId: options?.turfId,
        initiatedByUserId: options?.actorUserId ?? null,
        markExported: false,
        rowCount: visits.length,
        filterScopeJson: {
          turfId: options?.turfId ?? null,
          organizationId: options?.organizationId ?? null
        }
      }
    });

    await this.auditService.log({
      actorUserId: options?.actorUserId ?? null,
      actionType: 'csv_export_generated',
      entityType: 'visit_export',
      entityId: options?.turfId ?? 'all',
      newValuesJson: {
        turfId: options?.turfId ?? null,
        organizationId: options?.organizationId ?? null,
        markExported: false,
        count: visits.length,
        profileCode: 'internal_master'
      }
    });

    return { csv, count: visits.length, filename };
  }
}
