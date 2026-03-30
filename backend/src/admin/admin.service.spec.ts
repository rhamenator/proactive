import { SyncStatus, UserRole } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  const scope = { organizationId: 'org-1', campaignId: null };
  const prisma = {
    $transaction: jest.fn(),
    user: {
      count: jest.fn(),
      findMany: jest.fn()
    },
    turf: {
      count: jest.fn(),
      findMany: jest.fn()
    },
    address: {
      count: jest.fn()
    },
    turfAssignment: {
      count: jest.fn()
    },
    turfSession: {
      count: jest.fn(),
      findMany: jest.fn()
    },
    visitLog: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn()
    },
    outcomeDefinition: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    visitGeofenceResult: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    auditLog: {
      create: jest.fn()
    },
    syncEvent: {
      create: jest.fn()
    }
  };

  const service = new AdminService(prisma as never);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('builds a role-aware dashboard summary with per-turf progress', async () => {
    prisma.user.count
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);
    prisma.turf.count.mockResolvedValue(2);
    prisma.address.count.mockResolvedValue(5);
    prisma.turfAssignment.count.mockResolvedValue(3);
    prisma.turfSession.count.mockResolvedValue(1);
    prisma.visitLog.count.mockResolvedValue(4);
    prisma.visitLog.findMany
      .mockResolvedValueOnce([{ addressId: 'a1' }, { addressId: 'a2' }])
      .mockResolvedValueOnce([]);
    prisma.turfSession.findMany.mockResolvedValue([
      {
        id: 'session-1',
        startTime: new Date('2026-03-28T10:00:00.000Z'),
        canvasser: { id: 'user-3', firstName: 'Pat', lastName: 'Field', email: 'pat@example.com' },
        turf: { id: 'turf-1', name: 'North' }
      }
    ]);
    prisma.turf.findMany.mockResolvedValue([
      {
        id: 'turf-1',
        name: 'North',
        description: 'North block',
        addresses: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }, { id: 'a4' }],
        assignments: [{ id: 'assign-1' }],
        sessions: [{ id: 'session-1' }],
        visits: [{ addressId: 'a1' }, { addressId: 'a2' }, { addressId: 'a2' }]
      }
    ]);

    const result = await service.dashboardSummary(scope);

    expect(result.totals).toEqual(
      expect.objectContaining({
        users: 6,
        admins: 1,
        supervisors: 2,
        canvassers: 3,
        completedAddresses: 2
      })
    );
    expect(result.turfs[0]).toEqual(
      expect.objectContaining({
        id: 'turf-1',
        progressPercent: 50
      })
    );
  });

  it('lists only field users with supervisor and canvasser roles', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'user-1', role: UserRole.supervisor }]);

    const result = await service.listCanvassers(scope);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        role: {
          in: [UserRole.supervisor, UserRole.canvasser]
        }
      },
      select: expect.any(Object),
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    });
    expect(result).toHaveLength(1);
  });

  it('lists configurable outcomes in display order', async () => {
    prisma.outcomeDefinition.findMany.mockResolvedValue([{ id: 'outcome-1', code: 'knocked' }]);

    const result = await service.listOutcomeDefinitions(scope);

    expect(prisma.outcomeDefinition.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
      orderBy: [{ displayOrder: 'asc' }, { label: 'asc' }]
    });
    expect(result).toEqual([{ id: 'outcome-1', code: 'knocked' }]);
  });

  it('creates and updates outcome definitions with normalized values', async () => {
    prisma.outcomeDefinition.create.mockResolvedValue({ id: 'outcome-2', code: 'refused' });
    prisma.outcomeDefinition.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'outcome-2', organizationId: 'org-1' });
    prisma.outcomeDefinition.update.mockResolvedValue({ id: 'outcome-2', code: 'refused' });

    const created = await service.upsertOutcomeDefinition({
      code: ' refused ',
      label: ' Refused ',
      requiresNote: true,
      displayOrder: 40
    }, scope);
    const updated = await service.upsertOutcomeDefinition({
      id: 'outcome-2',
      code: 'refused',
      label: 'Refused At Door',
      isActive: false
    }, scope);

    expect(prisma.outcomeDefinition.create).toHaveBeenCalledWith({
      data: {
        code: 'refused',
        label: 'Refused',
        requiresNote: true,
        isFinalDisposition: true,
        displayOrder: 40,
        isActive: true,
        organizationId: 'org-1',
        campaignId: null
      }
    });
    expect(prisma.outcomeDefinition.findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        code: 'refused',
        organizationId: 'org-1',
        campaignId: null
      }
    });
    expect(prisma.outcomeDefinition.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        code: 'refused',
        organizationId: 'org-1',
        campaignId: null,
        id: { not: 'outcome-2' }
      }
    });
    expect(prisma.outcomeDefinition.findFirst).toHaveBeenNthCalledWith(3, {
      where: {
        id: 'outcome-2',
        organizationId: 'org-1'
      }
    });
    expect(prisma.outcomeDefinition.update).toHaveBeenCalledWith({
      where: { id: 'outcome-2' },
      data: {
        code: 'refused',
        label: 'Refused At Door',
        requiresNote: false,
        isFinalDisposition: true,
        displayOrder: 0,
        isActive: false,
        organizationId: 'org-1',
        campaignId: null
      }
    });
    expect(created).toEqual({ id: 'outcome-2', code: 'refused' });
    expect(updated).toEqual({ id: 'outcome-2', code: 'refused' });
  });

  it('returns the GPS review queue with canvasser and turf context', async () => {
    prisma.visitGeofenceResult.findMany.mockResolvedValue([{ id: 'geo-1' }]);

    const result = await service.gpsReviewQueue(scope);

    expect(prisma.visitGeofenceResult.findMany).toHaveBeenCalledWith({
      where: {
        visitLog: { organizationId: 'org-1' },
        OR: [{ gpsStatus: { not: 'verified' } }, { overrideFlag: true }]
      },
      orderBy: { createdAt: 'desc' },
      include: {
        address: true,
        visitLog: {
          include: {
            canvasser: { select: expect.any(Object) },
            turf: { select: { id: true, name: true } }
          }
        }
      }
    });
    expect(result).toEqual([{ id: 'geo-1' }]);
  });

  it('returns visit logs that are still in sync conflict review', async () => {
    prisma.visitLog.findMany.mockResolvedValue([{ id: 'visit-1', syncStatus: SyncStatus.conflict }]);

    const result = await service.syncConflictQueue(scope);

    expect(prisma.visitLog.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        OR: [
          { syncStatus: 'conflict' },
          { syncConflictFlag: true }
        ]
      },
      orderBy: { visitTime: 'desc' },
      include: {
        address: {
          select: {
            id: true,
            addressLine1: true,
            city: true,
            state: true,
            zip: true
          }
        },
        canvasser: { select: expect.any(Object) },
        turf: { select: { id: true, name: true } }
      }
    });
    expect(result).toEqual([{ id: 'visit-1', syncStatus: SyncStatus.conflict }]);
  });

  it('applies GPS overrides and writes an audit trail', async () => {
    prisma.visitGeofenceResult.findFirst.mockResolvedValue({
      visitLogId: 'visit-1',
      overrideFlag: false,
      failureReason: 'outside_radius',
      gpsStatus: 'flagged'
    });
    prisma.visitGeofenceResult.update.mockResolvedValue({ id: 'geo-1', overrideFlag: true });
    prisma.visitLog.update.mockResolvedValue({ id: 'visit-1', geofenceValidated: true });
    prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
    prisma.$transaction.mockImplementation(async (operations) => Promise.all(operations));

    const result = await service.overrideGpsResult({
      visitLogId: 'visit-1',
      actorUserId: 'admin-1',
      scope,
      reason: 'Manual verification'
    });

    expect(prisma.visitGeofenceResult.update).toHaveBeenCalledWith({
      where: { visitLogId: 'visit-1' },
      data: expect.objectContaining({
        overrideFlag: true,
        overrideReason: 'Manual verification',
        overrideByUserId: 'admin-1',
        overrideAt: expect.any(Date)
      })
    });
    expect(prisma.visitLog.update).toHaveBeenCalledWith({
      where: { id: 'visit-1' },
      data: { geofenceValidated: true }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: 'admin-1',
        actionType: 'gps_override_applied',
        entityId: 'visit-1'
      })
    });
    expect(result).toEqual({ id: 'geo-1', overrideFlag: true });
  });

  it('rejects blank GPS override reasons', async () => {
    await expect(service.overrideGpsResult({
      visitLogId: 'visit-1',
      actorUserId: 'admin-1',
      scope,
      reason: '   '
    })).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.visitGeofenceResult.findFirst).not.toHaveBeenCalled();
  });

  it('resolves sync conflicts and records an audit reason', async () => {
    prisma.visitLog.findFirst.mockResolvedValue({
      id: 'visit-1',
      syncStatus: SyncStatus.conflict,
      syncConflictFlag: true,
      syncConflictReason: 'duplicate_submission',
      localRecordUuid: 'local-1',
      idempotencyKey: 'idem-1'
    });
    prisma.visitLog.update.mockResolvedValue({ id: 'visit-1', syncStatus: SyncStatus.synced, syncConflictFlag: false });
    prisma.syncEvent.create.mockResolvedValue({ id: 'sync-2' });
    prisma.auditLog.create.mockResolvedValue({ id: 'audit-2' });
    prisma.$transaction.mockImplementation(async (operations) => Promise.all(operations));

    const result = await service.resolveSyncConflict({
      visitLogId: 'visit-1',
      actorUserId: 'supervisor-1',
      scope,
      reason: 'Confirmed the server record is the correct final submission.'
    });

    expect(prisma.visitLog.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'visit-1',
        organizationId: 'org-1',
        OR: [
          { syncStatus: SyncStatus.conflict },
          { syncConflictFlag: true }
        ]
      }
    });
    expect(prisma.visitLog.update).toHaveBeenCalledWith({
      where: { id: 'visit-1' },
      data: {
        syncStatus: SyncStatus.synced,
        syncConflictFlag: false,
        syncConflictReason: null
      },
      include: {
        address: {
          select: {
            id: true,
            addressLine1: true,
            city: true,
            state: true,
            zip: true
          }
        },
        canvasser: { select: expect.any(Object) },
        turf: { select: { id: true, name: true } }
      }
    });
    expect(prisma.syncEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: 'visit_log',
        entityId: 'visit-1',
        localRecordUuid: 'local-1',
        idempotencyKey: 'idem-1',
        eventType: 'conflict_resolved',
        syncStatus: SyncStatus.synced
      })
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: 'supervisor-1',
        organizationId: 'org-1',
        actionType: 'sync_conflict_resolved',
        entityId: 'visit-1',
        reasonText: 'Confirmed the server record is the correct final submission.'
      })
    });
    expect(result).toEqual({ id: 'visit-1', syncStatus: SyncStatus.synced, syncConflictFlag: false });
  });

  it('requires a non-empty reason before resolving a sync conflict', async () => {
    await expect(service.resolveSyncConflict({
      visitLogId: 'visit-1',
      actorUserId: 'supervisor-1',
      scope,
      reason: '   '
    })).rejects.toThrow('Resolution reason is required');

    expect(prisma.visitLog.findFirst).not.toHaveBeenCalled();
  });
});
