import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AddressRequestStatus, SessionStatus, UserRole } from '@prisma/client';
import { AddressRequestsService } from './address-requests.service';

describe('AddressRequestsService', () => {
  const prisma = {
    turf: {
      findFirst: jest.fn()
    },
    turfAssignment: {
      findFirst: jest.fn()
    },
    turfSession: {
      findFirst: jest.fn()
    },
    addressRequest: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn()
    },
    address: {
      findFirst: jest.fn()
    },
    household: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    $transaction: jest.fn()
  };
  const auditService = {
    log: jest.fn()
  };

  const service = new AddressRequestsService(prisma as never, auditService as never);

  const requestRecord = {
    id: 'request-1',
    status: AddressRequestStatus.pending,
    addressLine1: '123 Main',
    addressLine2: null,
    unit: null,
    city: 'Detroit',
    state: 'MI',
    zip: null,
    latitude: null,
    longitude: null,
    notes: 'Near the corner lot',
    submittedAt: new Date('2026-03-29T12:00:00.000Z'),
    reviewedAt: null,
    reviewReason: null,
    organizationId: 'org-1',
    campaignId: null,
    requestedByUserId: 'user-1',
    reviewedByUserId: null,
    approvedAddressId: null,
    turf: {
      id: 'turf-1',
      name: 'Northside'
    },
    requestedByUser: {
      id: 'user-1',
      firstName: 'Casey',
      lastName: 'Field',
      email: 'casey@example.com',
      role: UserRole.canvasser
    },
    reviewedByUser: null,
    approvedAddress: null
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.turf.findFirst.mockResolvedValue({
      id: 'turf-1',
      name: 'Northside',
      campaignId: null
    });
    prisma.turfAssignment.findFirst.mockResolvedValue({ id: 'assignment-1' });
    prisma.turfSession.findFirst.mockResolvedValue(null);
    prisma.address.findFirst.mockResolvedValue(null);
    prisma.household.findFirst.mockResolvedValue(null);
    prisma.household.create.mockResolvedValue({ id: 'household-1' });
    prisma.household.update.mockResolvedValue({ id: 'household-1' });
    prisma.addressRequest.findFirst.mockResolvedValue(null);
    prisma.addressRequest.findMany.mockResolvedValue([requestRecord]);
    prisma.addressRequest.create.mockResolvedValue(requestRecord);
    prisma.addressRequest.update.mockResolvedValue({
      ...requestRecord,
      status: AddressRequestStatus.approved,
      reviewedByUserId: 'admin-1',
      approvedAddressId: 'address-1',
      approvedAddress: {
        id: 'address-1',
        addressLine1: '123 Main',
        addressLine2: null,
        unit: null,
        city: 'Detroit',
        state: 'MI',
        zip: null,
        latitude: null,
        longitude: null
      },
      reviewedByUser: {
        id: 'admin-1',
        firstName: 'Jordan',
        lastName: 'Admin',
        email: 'admin@example.com',
        role: UserRole.admin
      }
    });
    prisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) => {
      const tx = {
        household: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'household-1' }),
          update: jest.fn().mockResolvedValue({ id: 'household-1' })
        },
        address: {
          create: jest.fn().mockResolvedValue({ id: 'address-1' })
        },
        addressRequest: {
          update: jest.fn().mockResolvedValue({
            ...requestRecord,
            status: AddressRequestStatus.approved,
            reviewedByUserId: 'admin-1',
            approvedAddressId: 'address-1',
            approvedAddress: {
              id: 'address-1',
              addressLine1: '123 Main',
              addressLine2: null,
              unit: null,
              city: 'Detroit',
              state: 'MI',
              zip: null,
              latitude: null,
              longitude: null
            },
            reviewedByUser: {
              id: 'admin-1',
              firstName: 'Jordan',
              lastName: 'Admin',
              email: 'admin@example.com',
              role: UserRole.admin
            }
          })
        }
      };

      return callback(tx);
    });
    auditService.log.mockResolvedValue(undefined);
  });

  it('allows a field user assigned to a turf to submit a request', async () => {
    const result = await service.submitRequest({
      actorUserId: 'user-1',
      actorRole: UserRole.canvasser,
      organizationId: 'org-1',
      turfId: 'turf-1',
      addressLine1: ' 123 Main ',
      city: ' Detroit ',
      state: 'mi',
      notes: '  Near the corner lot '
    });

    expect(prisma.addressRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requestedByUserId: 'user-1',
          addressLine1: '123 Main',
          city: 'Detroit',
          state: 'MI',
          notes: 'Near the corner lot'
        })
      })
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'address_request_submitted',
        entityId: 'request-1'
      })
    );
    expect(result.requestedAddress.addressLine1).toBe('123 Main');
  });

  it('allows submission when the field user has an active turf session but no active assignment', async () => {
    prisma.turfAssignment.findFirst.mockResolvedValue(null);
    prisma.turfSession.findFirst.mockResolvedValue({
      id: 'session-1',
      status: SessionStatus.active
    });

    await service.submitRequest({
      actorUserId: 'user-1',
      actorRole: UserRole.supervisor,
      organizationId: 'org-1',
      turfId: 'turf-1',
      addressLine1: '123 Main',
      city: 'Detroit',
      state: 'MI'
    });

    expect(prisma.addressRequest.create).toHaveBeenCalled();
  });

  it('rejects submission when the actor is not assigned and not actively working the turf', async () => {
    prisma.turfAssignment.findFirst.mockResolvedValue(null);
    prisma.turfSession.findFirst.mockResolvedValue(null);

    await expect(
      service.submitRequest({
        actorUserId: 'user-1',
        actorRole: UserRole.canvasser,
        organizationId: 'org-1',
        turfId: 'turf-1',
        addressLine1: '123 Main',
        city: 'Detroit',
        state: 'MI'
      })
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects submission when a real address already exists on the turf', async () => {
    prisma.address.findFirst.mockResolvedValue({ id: 'address-1' });

    await expect(
      service.submitRequest({
        actorUserId: 'user-1',
        actorRole: UserRole.canvasser,
        organizationId: 'org-1',
        turfId: 'turf-1',
        addressLine1: '123 Main',
        city: 'Detroit',
        state: 'MI'
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('reuses an existing household record when approving a request', async () => {
    prisma.addressRequest.findFirst.mockResolvedValue(requestRecord);
    prisma.household.findFirst.mockResolvedValue({
      id: 'household-1',
      latitude: null,
      longitude: null
    });

    await service.approveRequest({
      requestId: 'request-1',
      actorUserId: 'admin-1',
      actorRole: UserRole.admin,
      organizationId: 'org-1',
      reason: 'Looks valid'
    });

    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('rejects submission when a matching pending request already exists', async () => {
    prisma.addressRequest.findFirst.mockResolvedValue({
      id: 'request-2'
    });

    await expect(
      service.submitRequest({
        actorUserId: 'user-1',
        actorRole: UserRole.canvasser,
        organizationId: 'org-1',
        turfId: 'turf-1',
        addressLine1: '123 Main',
        city: 'Detroit',
        state: 'MI'
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('lists the requesting field user’s own recent address requests', async () => {
    const results = await service.listOwnRequests({
      actorUserId: 'user-1',
      actorRole: UserRole.canvasser,
      organizationId: 'org-1',
      take: 10
    });

    expect(prisma.addressRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          requestedByUserId: 'user-1',
          organizationId: 'org-1'
        },
        take: 10
      })
    );
    expect(results).toHaveLength(1);
  });

  it('lists the review queue for admins and supervisors', async () => {
    await service.reviewQueue({
      actorRole: UserRole.admin,
      organizationId: 'org-1',
      status: AddressRequestStatus.pending,
      take: 20
    });

    expect(prisma.addressRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          status: AddressRequestStatus.pending
        },
        take: 20
      })
    );
  });

  it('approves a request by creating a real address and linking it back', async () => {
    prisma.addressRequest.findFirst.mockResolvedValue({
      ...requestRecord
    });

    const approved = await service.approveRequest({
      requestId: 'request-1',
      actorUserId: 'admin-1',
      actorRole: UserRole.admin,
      organizationId: 'org-1',
      reason: 'Validated on review'
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'address_request_approved',
        entityId: 'request-1'
      })
    );
    expect(approved.status).toBe(AddressRequestStatus.approved);
    expect(approved.approvedAddress?.id).toBe('address-1');
  });

  it('rejects approval when a duplicate real address already exists', async () => {
    prisma.addressRequest.findFirst.mockResolvedValue({
      ...requestRecord
    });
    prisma.address.findFirst.mockResolvedValue({ id: 'address-1' });

    await expect(
      service.approveRequest({
        requestId: 'request-1',
        actorUserId: 'admin-1',
        actorRole: UserRole.admin,
        organizationId: 'org-1'
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('preserves addressLine2 and unit through submission and serialization', async () => {
    const recordWithUnit = {
      ...requestRecord,
      addressLine2: 'Apt 4B',
      unit: '4B'
    };
    prisma.addressRequest.create.mockResolvedValue(recordWithUnit);

    const result = await service.submitRequest({
      actorUserId: 'user-1',
      actorRole: UserRole.canvasser,
      organizationId: 'org-1',
      turfId: 'turf-1',
      addressLine1: '123 Main',
      addressLine2: 'Apt 4B',
      unit: '4B',
      city: 'Detroit',
      state: 'MI'
    });

    expect(prisma.addressRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          addressLine2: 'Apt 4B',
          unit: '4B'
        })
      })
    );
    expect(result.requestedAddress.addressLine2).toBe('Apt 4B');
    expect(result.requestedAddress.unit).toBe('4B');
  });

  it('passes addressLine2 and unit through into the created address on approval', async () => {
    const recordWithUnit = {
      ...requestRecord,
      addressLine2: 'Suite 200',
      unit: '200',
      turf: { id: 'turf-1', name: 'Northside' }
    };
    prisma.addressRequest.findFirst.mockResolvedValue(recordWithUnit);

    let capturedTx: {
      address: { create: jest.Mock };
      addressRequest: { update: jest.Mock };
      household: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
    };

    prisma.$transaction.mockImplementationOnce(async (callback: (tx: typeof capturedTx) => Promise<unknown>) => {
      const tx = {
        household: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'household-1' }),
          update: jest.fn().mockResolvedValue({ id: 'household-1' })
        },
        address: {
          create: jest.fn().mockResolvedValue({ id: 'address-1' })
        },
        addressRequest: {
          update: jest.fn().mockResolvedValue({
            ...recordWithUnit,
            status: AddressRequestStatus.approved,
            reviewedByUserId: 'admin-1',
            approvedAddressId: 'address-1',
            approvedAddress: {
              id: 'address-1',
              addressLine1: '123 Main',
              addressLine2: 'Suite 200',
              unit: '200',
              city: 'Detroit',
              state: 'MI',
              zip: null,
              latitude: null,
              longitude: null
            },
            reviewedByUser: {
              id: 'admin-1',
              firstName: 'Jordan',
              lastName: 'Admin',
              email: 'admin@example.com',
              role: UserRole.admin
            }
          })
        }
      };
      capturedTx = tx;
      return callback(tx);
    });

    await service.approveRequest({
      requestId: 'request-1',
      actorUserId: 'admin-1',
      actorRole: UserRole.admin,
      organizationId: 'org-1',
      reason: 'Validated'
    });

    // ensureHousehold uses this.prisma (outer mock), not the tx
    expect(prisma.household.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          addressLine2: 'Suite 200',
          unit: '200'
        })
      })
    );

    // address.create runs inside the tx
    expect(capturedTx!.address.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          addressLine2: 'Suite 200',
          unit: '200'
        })
      })
    );
  });

  it('requires a reason when rejecting a request', async () => {
    await expect(
      service.rejectRequest({
        requestId: 'request-1',
        actorUserId: 'admin-1',
        actorRole: UserRole.admin,
        organizationId: 'org-1',
        reason: '   '
      })
    ).rejects.toThrow('Rejection reason is required');
  });

  it('records a rejection with reviewer metadata and audit log', async () => {
    prisma.addressRequest.findFirst.mockResolvedValue({
      ...requestRecord
    });
    prisma.addressRequest.update.mockResolvedValue({
      ...requestRecord,
      status: AddressRequestStatus.rejected,
      reviewedAt: new Date('2026-03-29T13:00:00.000Z'),
      reviewedByUserId: 'sup-1',
      reviewReason: 'Duplicate household',
      reviewedByUser: {
        id: 'sup-1',
        firstName: 'Jamie',
        lastName: 'Supervisor',
        email: 'jamie@example.com',
        role: UserRole.supervisor
      }
    });

    const rejected = await service.rejectRequest({
      requestId: 'request-1',
      actorUserId: 'sup-1',
      actorRole: UserRole.supervisor,
      organizationId: 'org-1',
      reason: 'Duplicate household'
    });

    expect(prisma.addressRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'request-1' },
        data: expect.objectContaining({
          status: AddressRequestStatus.rejected,
          reviewedByUserId: 'sup-1',
          reviewReason: 'Duplicate household'
        })
      })
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'address_request_rejected',
        entityId: 'request-1',
        reasonText: 'Duplicate household'
      })
    );
    expect(rejected.status).toBe(AddressRequestStatus.rejected);
  });
});
