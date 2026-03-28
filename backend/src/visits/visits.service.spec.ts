import { AssignmentStatus, GpsStatus, SyncStatus, VisitResult } from '@prisma/client';
import { VisitsService } from './visits.service';

describe('VisitsService', () => {
  const prisma = {
    $transaction: jest.fn(),
    visitLog: {
      findUnique: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn()
    },
    address: {
      findUnique: jest.fn()
    },
    turfAssignment: {
      findFirst: jest.fn()
    },
    turfSession: {
      findFirst: jest.fn()
    }
  };
  const auditService = {
    log: jest.fn()
  };

  const service = new VisitsService(prisma as never, auditService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an existing visit when the local record UUID was already ingested', async () => {
    const existingVisit = { id: 'visit-1', localRecordUuid: 'local-1' };
    prisma.visitLog.findUnique.mockResolvedValue(existingVisit);

    const result = await service.logVisit({
      canvasserId: 'canvasser-1',
      addressId: 'address-1',
      result: VisitResult.knocked,
      localRecordUuid: 'local-1'
    });

    expect(prisma.visitLog.findUnique).toHaveBeenCalledWith({
      where: { localRecordUuid: 'local-1' }
    });
    expect(prisma.address.findUnique).not.toHaveBeenCalled();
    expect(result).toBe(existingVisit);
  });

  it('flags low-accuracy visits and records the sync/geofence side effects', async () => {
    prisma.address.findUnique.mockResolvedValue({
      id: 'address-1',
      turfId: 'turf-1',
      latitude: 42.9634,
      longitude: -85.6681,
      turf: { id: 'turf-1' }
    });
    prisma.turfAssignment.findFirst.mockResolvedValue({
      id: 'assignment-1',
      status: AssignmentStatus.active
    });
    prisma.turfSession.findFirst.mockResolvedValue(null);
    prisma.visitLog.count.mockResolvedValue(0);
    prisma.visitLog.findFirst.mockResolvedValue(null);
    const tx = {
      visitLog: {
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'visit-1',
          ...data
        }))
      },
      visitGeofenceResult: {
        create: jest.fn().mockResolvedValue({ id: 'geo-1' })
      },
      syncEvent: {
        create: jest.fn().mockResolvedValue({ id: 'sync-1' })
      }
    };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    auditService.log.mockResolvedValue(undefined);

    const result = await service.logVisit({
      canvasserId: 'canvasser-1',
      addressId: 'address-1',
      result: VisitResult.knocked,
      latitude: 42.9634,
      longitude: -85.6681,
      accuracyMeters: 45
    });

    expect(tx.visitLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gpsStatus: GpsStatus.low_accuracy,
        geofenceValidated: false,
        syncStatus: SyncStatus.synced
      })
    });
    expect(tx.visitGeofenceResult.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gpsStatus: GpsStatus.low_accuracy,
        failureReason: 'low_accuracy'
      })
    });
    expect(tx.syncEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: 'visit_log',
        eventType: 'ingest',
        syncStatus: SyncStatus.synced
      })
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'visit_created',
        entityId: 'visit-1'
      }),
      tx
    );
    expect(result.gpsStatus).toBe(GpsStatus.low_accuracy);
  });
});
