import { UserRole } from '@prisma/client';
import { AdminService } from './admin.service';

describe('AdminService', () => {
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
      update: jest.fn()
    },
    outcomeDefinition: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    visitGeofenceResult: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    auditLog: {
      create: jest.fn()
    }
  };

  const service = new AdminService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
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

    const result = await service.dashboardSummary();

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

    const result = await service.listCanvassers();

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
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

    const result = await service.listOutcomeDefinitions();

    expect(prisma.outcomeDefinition.findMany).toHaveBeenCalledWith({
      orderBy: [{ displayOrder: 'asc' }, { label: 'asc' }]
    });
    expect(result).toEqual([{ id: 'outcome-1', code: 'knocked' }]);
  });

  it('creates and updates outcome definitions with normalized values', async () => {
    prisma.outcomeDefinition.create.mockResolvedValue({ id: 'outcome-2', code: 'refused' });
    prisma.outcomeDefinition.update.mockResolvedValue({ id: 'outcome-2', code: 'refused' });

    const created = await service.upsertOutcomeDefinition({
      code: ' refused ',
      label: ' Refused ',
      requiresNote: true,
      displayOrder: 40
    });
    const updated = await service.upsertOutcomeDefinition({
      id: 'outcome-2',
      code: 'refused',
      label: 'Refused At Door',
      isActive: false
    });

    expect(prisma.outcomeDefinition.create).toHaveBeenCalledWith({
      data: {
        code: 'refused',
        label: 'Refused',
        requiresNote: true,
        isFinalDisposition: true,
        displayOrder: 40,
        isActive: true
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
        isActive: false
      }
    });
    expect(created).toEqual({ id: 'outcome-2', code: 'refused' });
    expect(updated).toEqual({ id: 'outcome-2', code: 'refused' });
  });

  it('returns the GPS review queue with canvasser and turf context', async () => {
    prisma.visitGeofenceResult.findMany.mockResolvedValue([{ id: 'geo-1' }]);

    const result = await service.gpsReviewQueue();

    expect(prisma.visitGeofenceResult.findMany).toHaveBeenCalledWith({
      where: {
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

  it('applies GPS overrides and writes an audit trail', async () => {
    prisma.visitGeofenceResult.findUnique.mockResolvedValue({
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
});
