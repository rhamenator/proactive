import { AddressRequestStatus, UserRole } from '@prisma/client';
import { AddressRequestsController } from './address-requests.controller';

describe('AddressRequestsController', () => {
  const addressRequestsService = {
    submitRequest: jest.fn(),
    listOwnRequests: jest.fn(),
    reviewQueue: jest.fn(),
    approveRequest: jest.fn(),
    rejectRequest: jest.fn()
  };
  const usersService = {
    findById: jest.fn()
  };

  const controller = new AddressRequestsController(addressRequestsService as never, usersService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('submits and lists address requests with organization scope from the JWT payload', async () => {
    const user = {
      sub: 'user-1',
      email: 'field@example.com',
      role: UserRole.canvasser,
      organizationId: 'org-1'
    };

    await controller.submitRequest(user, {
      turfId: 'turf-1',
      addressLine1: '123 Main',
      city: 'Detroit',
      state: 'MI'
    });
    await controller.listOwnRequests(user, { take: 10 });

    expect(addressRequestsService.submitRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'user-1',
        actorRole: UserRole.canvasser,
        organizationId: 'org-1',
        turfId: 'turf-1'
      })
    );
    expect(addressRequestsService.listOwnRequests).toHaveBeenCalledWith({
      actorUserId: 'user-1',
      actorRole: UserRole.canvasser,
      organizationId: 'org-1',
      take: 10
    });
  });

  it('falls back to the user record when the JWT payload does not include organization id', async () => {
    usersService.findById.mockResolvedValue({ id: 'user-1', organizationId: 'org-2' });

    await controller.reviewQueue(
      {
        sub: 'user-1',
        email: 'sup@example.com',
        role: UserRole.supervisor
      },
      { status: AddressRequestStatus.pending, take: 25 }
    );

    expect(usersService.findById).toHaveBeenCalledWith('user-1');
    expect(addressRequestsService.reviewQueue).toHaveBeenCalledWith({
      actorRole: UserRole.supervisor,
      organizationId: 'org-2',
      status: AddressRequestStatus.pending,
      take: 25
    });
  });

  it('routes approve and reject review actions with request ids and reasons', async () => {
    const user = {
      sub: 'admin-1',
      email: 'admin@example.com',
      role: UserRole.admin,
      organizationId: 'org-1'
    };
    const requestId = '7cb75a50-e8a1-4efe-8137-fa6454fad6bc';

    await controller.approveRequest(requestId, user, { reason: 'Validated on review' });
    await controller.rejectRequest(requestId, user, { reason: 'Duplicate household' });

    expect(addressRequestsService.approveRequest).toHaveBeenCalledWith({
      requestId,
      actorUserId: 'admin-1',
      actorRole: UserRole.admin,
      organizationId: 'org-1',
      reason: 'Validated on review'
    });
    expect(addressRequestsService.rejectRequest).toHaveBeenCalledWith({
      requestId,
      actorUserId: 'admin-1',
      actorRole: UserRole.admin,
      organizationId: 'org-1',
      reason: 'Duplicate household'
    });
  });
});
