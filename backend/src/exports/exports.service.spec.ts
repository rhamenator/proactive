import { GpsStatus, SyncStatus, VisitResult } from '@prisma/client';
import { ExportsService } from './exports.service';

describe('ExportsService', () => {
  const scope = { organizationId: 'org-1', campaignId: null };
  const prisma = {
    visitLog: {
      findMany: jest.fn(),
      updateMany: jest.fn()
    },
    exportBatch: {
      create: jest.fn(),
      findMany: jest.fn()
    }
  };
  const auditService = {
    log: jest.fn()
  };
  const policiesService = {
    getEffectivePolicy: jest.fn().mockResolvedValue({
      retentionPurgeDays: 30
    })
  };

  const service = new ExportsService(prisma as never, auditService as never, policiesService as never);

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
      actorUserId: 'admin-1',
      organizationId: 'org-1'
    });

    expect(prisma.visitLog.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        organizationId: 'org-1',
        turfId: 'turf-1',
        vanExported: false
      },
      orderBy: { visitTime: 'asc' },
      include: {
        address: true,
        canvasser: true,
        geofenceResult: true,
        turf: true
      }
    });
    expect(prisma.visitLog.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['visit-1'] } },
      data: { vanExported: true }
    });
    expect(result.count).toBe(1);
    expect(result.csv).toContain('VAN-123');
    expect(result.csv).toContain('Pat Field');
    expect(result.filename).toContain('van-results-');
    expect(prisma.exportBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          profileCode: 'van_compatible',
          organizationId: 'org-1',
          campaignId: null,
          turfId: 'turf-1',
          initiatedByUserId: 'admin-1',
          markExported: true,
          rowCount: 1,
          csvContent: expect.any(String),
          sha256Checksum: expect.any(String),
          exportedVisits: {
            create: [
              expect.objectContaining({
                rowIndex: 1
              })
            ]
          }
        }),
        include: {
          exportedVisits: true
        }
      })
    );
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
      markExported: false,
      organizationId: 'org-1'
    });

    expect(prisma.visitLog.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null, organizationId: 'org-1' },
      orderBy: { visitTime: 'asc' },
      include: {
        address: true,
        canvasser: true,
        geofenceResult: true,
        turf: true
      }
    });
    expect(prisma.visitLog.updateMany).not.toHaveBeenCalled();
    expect(result.count).toBe(0);
    expect(result.filename).toEqual(expect.stringContaining('van-results-'));
    expect(result.csv).toBe('\uFEFF');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'csv_export_generated',
        entityId: 'all'
      })
    );
  });

  it('generates an internal master export and stores export history', async () => {
    prisma.visitLog.findMany.mockResolvedValue([
      {
        id: 'visit-1',
        turfId: 'turf-1',
        addressId: 'address-1',
        canvasserId: 'user-1',
        visitTime: new Date('2026-03-28T10:00:00.000Z'),
        clientCreatedAt: new Date('2026-03-28T09:59:00.000Z'),
        serverReceivedAt: new Date('2026-03-28T10:00:05.000Z'),
        result: VisitResult.knocked,
        outcomeCode: 'knocked',
        outcomeLabel: 'Knocked',
        contactMade: true,
        notes: 'Met voter',
        gpsStatus: GpsStatus.verified,
        geofenceValidated: true,
        geofenceDistanceMeters: 4,
        latitude: 42.9634,
        longitude: -85.6681,
        accuracyMeters: 5,
        localRecordUuid: 'local-1',
        idempotencyKey: 'idem-1',
        source: 'mobile_app',
        syncStatus: SyncStatus.synced,
        syncConflictFlag: false,
        syncConflictReason: null,
        vanExported: false,
        address: {
          vanId: 'VAN-123',
          addressLine1: '100 Main St',
          city: 'Grand Rapids',
          state: 'MI',
          zip: '49503'
        },
        turf: {
          id: 'turf-1',
          name: 'North'
        },
        canvasser: {
          firstName: 'Pat',
          lastName: 'Field'
        },
        geofenceResult: {
          distanceFromTargetFeet: 12.3,
          overrideFlag: false,
          overrideReason: null
        }
      }
    ]);
    prisma.exportBatch.findMany.mockResolvedValue([{ id: 'batch-1', profileCode: 'internal_master' }]);

    const result = await service.internalMasterCsv({
      turfId: 'turf-1',
      actorUserId: 'admin-1',
      organizationId: 'org-1'
    });
    const history = await service.exportHistory(scope);

    expect(prisma.visitLog.updateMany).not.toHaveBeenCalled();
    expect(result.csv).toContain('outcome_code');
    expect(result.csv).toContain('Knocked');
    expect(result.filename).toContain('internal-master-');
    expect(prisma.exportBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          profileCode: 'internal_master',
          organizationId: 'org-1',
          campaignId: null,
          turfId: 'turf-1',
          initiatedByUserId: 'admin-1',
          markExported: false,
          rowCount: 1,
          csvContent: expect.any(String),
          sha256Checksum: expect.any(String),
          exportedVisits: {
            create: [
              expect.objectContaining({
                rowIndex: 1
              })
            ]
          }
        }),
        include: {
          exportedVisits: true
        }
      })
    );
    expect(prisma.exportBatch.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1'
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        initiatedByUser: {
          select: expect.any(Object)
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
    expect(history).toEqual([{ id: 'batch-1', profileCode: 'internal_master' }]);
  });
});
