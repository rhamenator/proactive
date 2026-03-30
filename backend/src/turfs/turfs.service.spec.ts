import { BadRequestException } from '@nestjs/common';
import { AssignmentStatus, SessionStatus, TurfStatus, UserRole, VisitResult } from '@prisma/client';
import { TurfsService } from './turfs.service';

describe('TurfsService', () => {
  const scope = { organizationId: 'org-1', campaignId: null };
  const prisma = {
    $transaction: jest.fn(),
    turf: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn()
    },
    turfSession: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    turfAssignment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn()
    },
    address: {
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

    await expect(service.assignTurf('turf-1', 'supervisor-1', 'admin-1', undefined)).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('prevents reopening a turf while an open session exists', async () => {
    const tx = {
      turf: {
        findFirst: jest.fn().mockResolvedValue({
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

    await expect(service.reopenTurf('turf-1', 'admin-1', 'Resume work')).rejects.toBeInstanceOf(
      BadRequestException
    );

    expect(tx.turf.findFirst).toHaveBeenCalledWith({ where: { id: 'turf-1', organizationId: null } });
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

  it('returns an existing open session when startSession is called twice', async () => {
    const tx = {
      turfAssignment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'assignment-1',
          status: AssignmentStatus.assigned
        }),
        update: jest.fn()
      },
      turf: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'turf-1',
          isShared: false
        }),
        update: jest.fn()
      },
      turfSession: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: 'session-1',
            turfId: 'turf-1',
            canvasserId: 'canvasser-1',
            startTime: new Date('2026-03-28T10:00:00.000Z'),
            endTime: null,
            status: SessionStatus.active,
            startLat: 42.9,
            startLng: -85.6,
            endLat: null,
            endLng: null
          }),
        create: jest.fn()
      }
    };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    const result = await service.startSession({
      canvasserId: 'canvasser-1',
      turfId: 'turf-1'
    });

    expect(tx.turfAssignment.update).not.toHaveBeenCalled();
    expect(tx.turfSession.create).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        id: 'session-1',
        status: SessionStatus.active
      })
    );
  });

  it('returns an empty turf snapshot when the canvasser has no assignment', async () => {
    prisma.turfAssignment.findFirst.mockResolvedValue(null);

    const result = await service.getMyTurf('canvasser-1');

    expect(result).toEqual({
      assignment: null,
      turf: null,
      session: null,
      progress: {
        completed: 0,
        total: 0,
        pendingSync: 0
      },
      addresses: []
    });
  });

  it('lists turfs with lifecycle status and active session counts', async () => {
    prisma.turf.findMany.mockResolvedValue([
      {
        id: 'turf-1',
        name: 'Open Turf',
        status: TurfStatus.in_progress,
        createdAt: new Date('2026-03-28T00:00:00.000Z'),
        _count: {
          addresses: 4,
          assignments: 1,
          sessions: 2,
          visits: 3
        }
      },
      {
        id: 'turf-2',
        name: 'Paused Turf',
        status: TurfStatus.paused,
        createdAt: new Date('2026-03-28T01:00:00.000Z'),
        _count: {
          addresses: 2,
          assignments: 1,
          sessions: 1,
          visits: 1
        }
      }
    ]);
    prisma.turfSession.findMany.mockResolvedValue([
      { id: 'session-1', turfId: 'turf-1' },
      { id: 'session-2', turfId: 'turf-1' }
    ]);

    const result = await service.listTurfs(scope);

    expect(prisma.turf.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            addresses: true,
            assignments: true,
            sessions: true,
            visits: true
          }
        }
      }
    });
    expect(result).toEqual([
      expect.objectContaining({
        id: 'turf-1',
        lifecycleStatus: 'open',
        activeSessionCount: 2
      }),
      expect.objectContaining({
        id: 'turf-2',
        lifecycleStatus: 'paused',
        activeSessionCount: 0
      })
    ]);
  });

  it('creates a new turf in the unassigned state', async () => {
    const createdTurf = {
      id: 'turf-1',
      name: 'Ward 1',
      description: 'Main route',
      createdById: 'admin-1',
      organizationId: 'org-1',
      status: TurfStatus.unassigned
    };
    usersService.findById.mockResolvedValue({
      id: 'admin-1',
      role: UserRole.admin,
      isActive: true,
      status: 'active',
      organizationId: 'org-1'
    });
    prisma.turf.create.mockResolvedValue(createdTurf);

    const result = await service.createTurf(
      {
        name: 'Ward 1',
        description: 'Main route'
      },
      'admin-1'
    );

    expect(prisma.turf.create).toHaveBeenCalledWith({
      data: {
        name: 'Ward 1',
        description: 'Main route',
        createdById: 'admin-1',
        organizationId: 'org-1',
        status: TurfStatus.unassigned
      }
    });
    expect(result).toBe(createdTurf);
  });

  it('rejects assigning a turf to an inactive canvasser', async () => {
    usersService.findById.mockResolvedValue({
      id: 'canvasser-2',
      role: UserRole.canvasser,
      isActive: false,
      status: 'inactive'
    });

    await expect(service.assignTurf('turf-1', 'canvasser-2', 'admin-1', undefined)).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('assigns a turf and audits the assignment action', async () => {
    usersService.findById.mockResolvedValue({
      id: 'canvasser-1',
      role: UserRole.canvasser,
      isActive: true,
      status: 'active',
      organizationId: 'org-1'
    });
    const tx = {
      turf: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'turf-1',
          isShared: false,
          organizationId: 'org-1',
          campaignId: null
        }),
        update: jest.fn().mockResolvedValue({ id: 'turf-1', status: TurfStatus.assigned })
      },
      turfSession: {
        findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null)
      },
      turfAssignment: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({
          id: 'assignment-1',
          turfId: 'turf-1',
          canvasserId: 'canvasser-1',
          status: AssignmentStatus.assigned
        })
      }
    };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    auditService.log.mockResolvedValue(undefined);

    const result = await service.assignTurf('turf-1', 'canvasser-1', 'admin-1', 'balanced workload', scope);

    expect(tx.turfAssignment.create).toHaveBeenCalledWith({
      data: {
        turfId: 'turf-1',
        canvasserId: 'canvasser-1',
        organizationId: 'org-1',
        campaignId: null,
        assignedByUserId: 'admin-1',
        reassignmentReason: 'balanced workload',
        status: AssignmentStatus.assigned
      }
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        actionType: 'turf_assigned',
        entityId: 'turf-1',
        reasonText: 'balanced workload'
      }),
      tx
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'assignment-1',
        canvasserId: 'canvasser-1'
      })
    );
  });

  it('returns address completion status from the latest visit on a turf', async () => {
    prisma.turf.findFirst.mockResolvedValue({
      id: 'turf-1',
      name: 'Ward 1',
      status: TurfStatus.assigned,
      addresses: [
        {
          id: 'address-1',
          addressLine1: '10 Main St',
          city: 'Grand Rapids',
          state: 'MI',
          visitLogs: [
            {
              result: VisitResult.knocked,
              visitTime: new Date('2026-03-28T12:00:00.000Z')
            }
          ]
        },
        {
          id: 'address-2',
          addressLine1: '22 Oak Ave',
          city: 'Grand Rapids',
          state: 'MI',
          visitLogs: []
        }
      ]
    });

    const result = await service.getTurfAddresses('turf-1', scope);

    expect(prisma.turf.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'turf-1',
        organizationId: 'org-1'
      },
      include: {
        addresses: {
          orderBy: { addressLine1: 'asc' },
          include: {
            visitLogs: {
              orderBy: { visitTime: 'desc' },
              take: 1
            }
          }
        }
      }
    });

    expect(result.lifecycleStatus).toBe('open');
    expect(result.addresses).toEqual([
      expect.objectContaining({
        id: 'address-1',
        status: 'completed',
        lastResult: VisitResult.knocked
      }),
      expect.objectContaining({
        id: 'address-2',
        status: 'pending',
        lastResult: null
      })
    ]);
  });

  it('returns a populated canvasser turf snapshot with progress and session state', async () => {
    prisma.turfAssignment.findFirst.mockResolvedValue({
      id: 'assignment-1',
      turfId: 'turf-1',
      canvasserId: 'canvasser-1',
      status: AssignmentStatus.active,
      turf: {
        id: 'turf-1',
        name: 'Ward 1',
        description: 'Downtown',
        status: TurfStatus.completed,
        createdAt: new Date('2026-03-28T00:00:00.000Z'),
        addresses: [
          {
            id: 'address-1',
            turfId: 'turf-1',
            addressLine1: '10 Main St',
            city: 'Grand Rapids',
            state: 'MI',
            zip: '49503',
            latitude: 42.96,
            longitude: -85.67,
            vanId: 'VAN-1',
            visitLogs: [
              {
                result: VisitResult.talked_to_voter,
                visitTime: new Date('2026-03-28T12:00:00.000Z')
              }
            ]
          },
          {
            id: 'address-2',
            turfId: 'turf-1',
            addressLine1: '22 Oak Ave',
            city: 'Grand Rapids',
            state: 'MI',
            zip: '49504',
            latitude: null,
            longitude: null,
            vanId: null,
            visitLogs: []
          }
        ]
      }
    });
    prisma.turfSession.findFirst.mockResolvedValue({
      id: 'session-1',
      turfId: 'turf-1',
      canvasserId: 'canvasser-1',
      startTime: new Date('2026-03-28T10:00:00.000Z'),
      endTime: new Date('2026-03-28T11:00:00.000Z'),
      status: SessionStatus.ended,
      startLat: 42.96,
      startLng: -85.67,
      endLat: 42.97,
      endLng: -85.68
    });

    const result = await service.getMyTurf('canvasser-1');

    expect(result.progress).toEqual({
      completed: 1,
      total: 2,
      pendingSync: 0
    });
    expect(result.turf).toEqual(
      expect.objectContaining({
        id: 'turf-1',
        lifecycleStatus: 'completed'
      })
    );
    expect(result.session).toEqual(
      expect.objectContaining({
        id: 'session-1',
        status: 'completed'
      })
    );
    expect(result.addresses[0]).toEqual(
      expect.objectContaining({
        id: 'address-1',
        status: 'completed',
        lastResult: VisitResult.talked_to_voter
      })
    );
  });

  it('pauses the active session and marks the turf paused', async () => {
    const tx = {
      turfSession: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'session-1',
          turfId: 'turf-1',
          canvasserId: 'canvasser-1',
          startTime: new Date('2026-03-28T10:00:00.000Z'),
          endTime: null,
          status: SessionStatus.active,
          startLat: 42.96,
          startLng: -85.67,
          endLat: null,
          endLng: null
        }),
        update: jest.fn().mockResolvedValue({
          id: 'session-1',
          turfId: 'turf-1',
          canvasserId: 'canvasser-1',
          startTime: new Date('2026-03-28T10:00:00.000Z'),
          endTime: null,
          status: SessionStatus.paused,
          startLat: 42.96,
          startLng: -85.67,
          endLat: null,
          endLng: null
        })
      },
      turf: {
        update: jest.fn().mockResolvedValue({ id: 'turf-1', status: TurfStatus.paused })
      }
    };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    auditService.log.mockResolvedValue(undefined);

    const result = await service.pauseSession({
      canvasserId: 'canvasser-1',
      turfId: 'turf-1',
      latitude: 42.961,
      longitude: -85.671
    });

    expect(tx.turf.update).toHaveBeenCalledWith({
      where: { id: 'turf-1' },
      data: { status: TurfStatus.paused }
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'turf_paused',
        entityId: 'turf-1'
      }),
      tx
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'session-1',
        status: SessionStatus.paused
      })
    );
  });

  it('resumes a paused session and restores the turf to in-progress', async () => {
    const tx = {
      turfAssignment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'assignment-1',
          status: AssignmentStatus.assigned
        }),
        update: jest.fn().mockResolvedValue({ id: 'assignment-1', status: AssignmentStatus.active })
      },
      turf: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'turf-1',
          isShared: false
        }),
        update: jest.fn().mockResolvedValue({ id: 'turf-1', status: TurfStatus.in_progress })
      },
      turfSession: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: 'session-1',
            turfId: 'turf-1',
            canvasserId: 'canvasser-1',
            startTime: new Date('2026-03-28T10:00:00.000Z'),
            endTime: null,
            status: SessionStatus.paused,
            startLat: 42.96,
            startLng: -85.67,
            endLat: null,
            endLng: null
          }),
        update: jest.fn().mockResolvedValue({
          id: 'session-1',
          turfId: 'turf-1',
          canvasserId: 'canvasser-1',
          startTime: new Date('2026-03-28T10:00:00.000Z'),
          endTime: null,
          status: SessionStatus.active,
          startLat: 42.96,
          startLng: -85.67,
          endLat: null,
          endLng: null
        })
      }
    };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    auditService.log.mockResolvedValue(undefined);

    const result = await service.resumeSession({
      canvasserId: 'canvasser-1',
      turfId: 'turf-1'
    });

    expect(tx.turfAssignment.update).toHaveBeenCalledWith({
      where: { id: 'assignment-1' },
      data: { status: AssignmentStatus.active }
    });
    expect(tx.turf.update).toHaveBeenCalledWith({
      where: { id: 'turf-1' },
      data: { status: TurfStatus.in_progress }
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'turf_resumed',
        entityId: 'turf-1'
      }),
      tx
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'session-1',
        status: SessionStatus.active
      })
    );
  });

  it('infers CSV mappings from common header aliases', () => {
    const mapping = service.inferMappingFromHeaders(['VAN ID', 'Street Address', 'City', 'District']);

    expect(mapping).toEqual({
      vanId: 'VAN ID',
      addressLine1: 'Street Address',
      city: 'City',
      turfName: 'District'
    });
  });
});
