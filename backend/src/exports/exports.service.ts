import { Injectable } from '@nestjs/common';
import { stringify } from 'csv-stringify/sync';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async vanResultsCsv(options?: { turfId?: string; markExported?: boolean; actorUserId?: string }) {
    const visits = await this.prisma.visitLog.findMany({
      where: {
        ...(options?.turfId ? { turfId: options.turfId } : {}),
        ...(options?.markExported === false ? {} : { vanExported: false })
      },
      orderBy: { visitTime: 'asc' },
      include: {
        address: true,
        canvasser: true,
        geofenceResult: true
      }
    });

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
        header: true
      }
    );

    await this.auditService.log({
      actorUserId: options?.actorUserId ?? null,
      actionType: 'csv_export_generated',
      entityType: 'visit_export',
      entityId: options?.turfId ?? 'all',
      newValuesJson: {
        turfId: options?.turfId ?? null,
        markExported: options?.markExported ?? false,
        count: visits.length
      }
    });

    return { csv, count: visits.length };
  }
}
