import { GpsStatus, SyncStatus, VisitResult } from '@prisma/client';
import { ExportsService } from './exports.service';

describe('ExportsService', () => {
  const prisma = {
    visitLog: {
      findMany: jest.fn(),
      updateMany: jest.fn()
    }
  };
  const auditService = {
    log: jest.fn()
  };

  const service = new ExportsService(prisma as never, auditService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    auditService.log.mockResolvedValue(undefined);
  });

  it('generates VAN CSV output and marks visits exported when requested', async () => {
    prisma.visitLog.findMany.mockResolvedValue([
      {
        id: 'visit-1',
        visitTime: new Date('2026-03-28T10:00:00.000Z'),
        result: VisitResult.knocked,
        contactMade: true,
        notes: 'Met voter',
        gpsStatus: GpsStatus.verified,
        latitude: 42.9634,
        longitude: -85.6681,
        accuracyMeters: 5,
        syncStatus: SyncStatus.synced,
        address: {
          vanId: 'VAN-123',
          addressLine1: '100 Main St'
        },
        canvasser: {
          firstName: 'Pat',
          lastName: 'Field'
        },
        geofenceResult: {
          distanceFromTargetFeet: 12.3
        }
      }
    ]);
    prisma.visitLog.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.vanResultsCsv({
      turfId: 'turf-1',
      markExported: true,
      actorUserId: 'admin-1'
    });

    expect(prisma.visitLog.findMany).toHaveBeenCalledWith({
      where: {
        turfId: 'turf-1',
        vanExported: false
      },
      orderBy: { visitTime: 'asc' },
      include: {
        address: true,
        canvasser: true,
        geofenceResult: true
      }
    });
    expect(prisma.visitLog.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['visit-1'] } },
      data: { vanExported: true }
    });
    expect(result.count).toBe(1);
    expect(result.csv).toContain('VAN-123');
    expect(result.csv).toContain('Pat Field');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'csv_export_generated',
        entityId: 'turf-1'
      })
    );
  });

  it('skips export marking when markExported is false', async () => {
    prisma.visitLog.findMany.mockResolvedValue([]);

    const result = await service.vanResultsCsv({
      markExported: false
    });

    expect(prisma.visitLog.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { visitTime: 'asc' },
      include: {
        address: true,
        canvasser: true,
        geofenceResult: true
      }
    });
    expect(prisma.visitLog.updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({
      csv: '',
      count: 0
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'csv_export_generated',
        entityId: 'all'
      })
    );
  });
});
