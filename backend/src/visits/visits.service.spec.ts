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

  function mockAssignedAddress(overrides: Partial<Record<string, unknown>> = {}) {
    prisma.address.findUnique.mockResolvedValue({
      id: 'address-1',
      turfId: 'turf-1',
      latitude: 42.9634,
      longitude: -85.6681,
      turf: { id: 'turf-1' },
      ...overrides
    });
    prisma.turfAssignment.findFirst.mockResolvedValue({
      id: 'assignment-1',
      status: AssignmentStatus.active
    });
    prisma.turfSession.findFirst.mockResolvedValue(null);
    prisma.visitLog.count.mockResolvedValue(0);
    prisma.visitLog.findFirst.mockResolvedValue(null);
  }

  function mockSuccessfulTransaction() {
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
    return tx;
  }

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
    mockAssignedAddress();
    const tx = mockSuccessfulTransaction();

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

  it('returns an existing visit when the idempotency key was already ingested', async () => {
    const existingVisit = { id: 'visit-2', idempotencyKey: 'idem-1' };
    prisma.visitLog.findUnique.mockResolvedValue(existingVisit);

    const result = await service.logVisit({
      canvasserId: 'canvasser-1',
      addressId: 'address-1',
      result: VisitResult.knocked,
      idempotencyKey: 'idem-1'
    });

    expect(prisma.visitLog.findUnique).toHaveBeenCalledWith({
      where: { idempotencyKey: 'idem-1' }
    });
    expect(prisma.address.findUnique).not.toHaveBeenCalled();
    expect(result).toBe(existingVisit);
  });

  it('rejects visits when the address cannot be found', async () => {
    prisma.address.findUnique.mockResolvedValue(null);

    await expect(
      service.logVisit({
        canvasserId: 'canvasser-1',
        addressId: 'address-1',
        result: VisitResult.knocked
      })
    ).rejects.toThrow('Address not found');
  });

  it('rejects visits when the canvasser is not assigned to the turf', async () => {
    prisma.address.findUnique.mockResolvedValue({
      id: 'address-1',
      turfId: 'turf-1',
      latitude: 42.9634,
      longitude: -85.6681,
      turf: { id: 'turf-1' }
    });
    prisma.turfAssignment.findFirst.mockResolvedValue(null);

    await expect(
      service.logVisit({
        canvasserId: 'canvasser-1',
        addressId: 'address-1',
        result: VisitResult.knocked
      })
    ).rejects.toThrow('Canvasser is not assigned to this turf');
  });

  it('rejects visits when the provided session is invalid for the turf', async () => {
    mockAssignedAddress();
    prisma.turfSession.findFirst.mockResolvedValue(null);

    await expect(
      service.logVisit({
        canvasserId: 'canvasser-1',
        addressId: 'address-1',
        sessionId: 'session-1',
        result: VisitResult.knocked
      })
    ).rejects.toThrow('Visit session is invalid for this turf');
  });

  it('rejects visits after the household reaches the maximum attempts', async () => {
    mockAssignedAddress();
    prisma.visitLog.count.mockResolvedValue(3);

    await expect(
      service.logVisit({
        canvasserId: 'canvasser-1',
        addressId: 'address-1',
        result: VisitResult.knocked
      })
    ).rejects.toThrow('This household has reached the maximum attempts for this turf cycle');
  });

  it('rejects visits that happen too soon after the canvasser previous attempt', async () => {
    mockAssignedAddress();
    prisma.visitLog.findFirst.mockResolvedValue({
      visitTime: new Date('2026-03-28T10:00:00.000Z')
    });
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-03-28T10:02:00.000Z').getTime());

    await expect(
      service.logVisit({
        canvasserId: 'canvasser-1',
        addressId: 'address-1',
        result: VisitResult.knocked
      })
    ).rejects.toThrow('Please wait 5 minutes before logging another attempt for this household');

    nowSpy.mockRestore();
  });

  it('records a target_missing GPS result when the address has no target coordinates', async () => {
    mockAssignedAddress({ latitude: null, longitude: null });
    const tx = mockSuccessfulTransaction();

    const result = await service.logVisit({
      canvasserId: 'canvasser-1',
      addressId: 'address-1',
      result: VisitResult.knocked,
      latitude: 42.9634,
      longitude: -85.6681,
      accuracyMeters: 10
    });

    expect(tx.visitLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gpsStatus: GpsStatus.missing,
        geofenceValidated: false
      })
    });
    expect(tx.visitGeofenceResult.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gpsStatus: GpsStatus.missing,
        failureReason: 'target_missing'
      })
    });
    expect(result.gpsStatus).toBe(GpsStatus.missing);
  });

  it('records an outside_radius GPS result when the visit is outside the geofence', async () => {
    mockAssignedAddress({
      latitude: 42.0,
      longitude: -85.0
    });
    const tx = mockSuccessfulTransaction();

    const result = await service.logVisit({
      canvasserId: 'canvasser-1',
      addressId: 'address-1',
      result: VisitResult.knocked,
      latitude: 43.0,
      longitude: -86.0,
      accuracyMeters: 10
    });

    expect(tx.visitLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gpsStatus: GpsStatus.flagged,
        geofenceValidated: false
      })
    });
    expect(tx.visitGeofenceResult.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gpsStatus: GpsStatus.flagged,
        failureReason: 'outside_radius'
      })
    });
    expect(result.gpsStatus).toBe(GpsStatus.flagged);
  });

  it('records a verified GPS result when the captured location matches the target', async () => {
    mockAssignedAddress({
      latitude: 42.9634,
      longitude: -85.6681
    });
    const tx = mockSuccessfulTransaction();

    const result = await service.logVisit({
      canvasserId: 'canvasser-1',
      addressId: 'address-1',
      result: VisitResult.knocked,
      latitude: 42.9634,
      longitude: -85.6681,
      accuracyMeters: 10
    });

    expect(tx.visitLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gpsStatus: GpsStatus.verified,
        geofenceValidated: true
      })
    });
    expect(tx.visitGeofenceResult.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gpsStatus: GpsStatus.verified,
        failureReason: undefined
      })
    });
    expect(result.gpsStatus).toBe(GpsStatus.verified);
  });
});
