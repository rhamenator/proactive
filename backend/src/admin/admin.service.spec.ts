import { UserRole } from '@prisma/client';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  const prisma = {
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
      findMany: jest.fn()
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
});
