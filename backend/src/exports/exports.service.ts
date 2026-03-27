import { Injectable } from '@nestjs/common';
import { stringify } from 'csv-stringify/sync';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExportsService {
  constructor(private readonly prisma: PrismaService) {}

  async vanResultsCsv(options?: { turfId?: string; markExported?: boolean }) {
    const visits = await this.prisma.visitLog.findMany({
      where: {
        ...(options?.turfId ? { turfId: options.turfId } : {}),
        ...(options?.markExported === false ? {} : { vanExported: false })
      },
      orderBy: { visitTime: 'asc' },
      include: {
        address: true,
        canvasser: true
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
        latitude: visit.latitude?.toString() ?? '',
        longitude: visit.longitude?.toString() ?? '',
        canvasser_name: `${visit.canvasser.firstName} ${visit.canvasser.lastName}`.trim()
      })),
      {
        header: true
      }
    );

    return { csv, count: visits.length };
  }
}
