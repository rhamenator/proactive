import { BadRequestException } from '@nestjs/common';
import { AssignmentStatus, SessionStatus, TurfStatus, UserRole } from '@prisma/client';
import { TurfsService } from './turfs.service';

describe('TurfsService', () => {
  const prisma = {
    $transaction: jest.fn(),
    turf: {
      findUnique: jest.fn()
    },
    turfSession: {
      findFirst: jest.fn()
    },
    turfAssignment: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn()
    }
  };
  const usersService = {
    findById: jest.fn()
  };
  const auditService = {
    log: jest.fn()
  };

  const service = new TurfsService(prisma as never, usersService as never, auditService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects assigning a turf to a non-canvasser role', async () => {
    usersService.findById.mockResolvedValue({
      id: 'supervisor-1',
      role: UserRole.supervisor,
      isActive: true,
      status: 'active'
    });

    await expect(service.assignTurf('turf-1', 'supervisor-1', 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('prevents reopening a turf while an open session exists', async () => {
    const tx = {
      turf: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'turf-1',
          status: TurfStatus.completed
        }),
        update: jest.fn()
      },
      turfSession: {
        count: jest.fn().mockResolvedValue(1)
      }
    };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    await expect(service.reopenTurf('turf-1', 'admin-1', 'Resume work')).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.turf.findUnique).toHaveBeenCalledWith({ where: { id: 'turf-1' } });
    expect(tx.turfSession.count).toHaveBeenCalledWith({
      where: {
        turfId: 'turf-1',
        endTime: null
      }
    });
    expect(tx.turf.update).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('completes a turf when the last open session and assignment close', async () => {
    const completedSession = {
      id: 'session-1',
      turfId: 'turf-1',
      canvasserId: 'canvasser-1',
      startTime: new Date('2026-03-28T10:00:00.000Z'),
      endTime: new Date('2026-03-28T11:00:00.000Z'),
      status: SessionStatus.ended,
      startLat: null,
      startLng: null,
      endLat: null,
      endLng: null
    };
    const tx = {
      turfSession: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'session-1',
          turfId: 'turf-1',
          canvasserId: 'canvasser-1',
          startTime: new Date('2026-03-28T10:00:00.000Z'),
          endTime: null,
          status: SessionStatus.active
        }),
        update: jest.fn().mockResolvedValue(completedSession),
        count: jest.fn().mockResolvedValue(0)
      },
      turfAssignment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(0)
      },
      turf: {
        update: jest.fn().mockResolvedValue({
          id: 'turf-1',
          status: TurfStatus.completed
        })
      }
    };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    auditService.log.mockResolvedValue(undefined);

    const result = await service.completeSession({
      canvasserId: 'canvasser-1',
      turfId: 'turf-1'
    });

    expect(tx.turf.update).toHaveBeenCalledWith({
      where: { id: 'turf-1' },
      data: expect.objectContaining({
        status: TurfStatus.completed,
        completedById: 'canvasser-1'
      })
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'turf_completed',
        entityId: 'turf-1'
      }),
      tx
    );
    expect(result).not.toBeNull();
    if (!result) {
      throw new Error('Expected a completed session snapshot');
    }
    expect(result.status).toBe('completed');
  });
});
