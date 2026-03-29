import { UserRole } from '@prisma/client';
import { AdminController } from './admin.controller';

describe('AdminController', () => {
  const adminService = {
    dashboardSummary: jest.fn(),
    activeCanvassers: jest.fn(),
    listCanvassers: jest.fn(),
    listOutcomeDefinitions: jest.fn(),
    gpsReviewQueue: jest.fn(),
    syncConflictQueue: jest.fn(),
    overrideGpsResult: jest.fn(),
    resolveSyncConflict: jest.fn(),
    upsertOutcomeDefinition: jest.fn()
  };
  const usersService = {
    findById: jest.fn(),
    createCanvasser: jest.fn(),
    updateCanvasser: jest.fn()
  };
  const authService = {
    inviteCanvasser: jest.fn()
  };
  const turfsService = {
    assignTurf: jest.fn(),
    reopenTurf: jest.fn()
  };
  const controller = new AdminController(
    adminService as never,
    usersService as never,
    authService as never,
    turfsService as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates dashboard and active canvasser requests with organization scope', async () => {
    const user = {
      sub: 'admin-1',
      email: 'admin@example.com',
      role: UserRole.admin,
      organizationId: 'org-1'
    };

    await controller.dashboardSummary(user);
    await controller.activeCanvassers(user);
    await controller.listCanvassers(user);
    await controller.listOutcomeDefinitions(user);
    await controller.gpsReviewQueue(user);
    await controller.syncConflictQueue(user);

    expect(adminService.dashboardSummary).toHaveBeenCalledWith('org-1');
    expect(adminService.activeCanvassers).toHaveBeenCalledWith('org-1');
    expect(adminService.listCanvassers).toHaveBeenCalledWith('org-1');
    expect(adminService.listOutcomeDefinitions).toHaveBeenCalledWith('org-1');
    expect(adminService.gpsReviewQueue).toHaveBeenCalledWith('org-1');
    expect(adminService.syncConflictQueue).toHaveBeenCalledWith('org-1');
  });

  it('delegates create, invite, and update field-user flows', async () => {
    const user = {
      sub: 'admin-1',
      email: 'admin@example.com',
      role: UserRole.admin,
      organizationId: 'org-1'
    };

    await controller.createCanvasser({
      firstName: 'Pat',
      lastName: 'Field',
      email: 'pat@example.com',
      password: 'Password123!',
      role: UserRole.supervisor
    }, user);
    await controller.inviteCanvasser({
      firstName: 'Pat',
      lastName: 'Field',
      email: 'pat@example.com',
      role: UserRole.canvasser
    }, user);
    await controller.updateCanvasser('user-1', { isActive: false }, user);

    expect(usersService.createCanvasser).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1' }));
    expect(authService.inviteCanvasser).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1' }));
    expect(usersService.updateCanvasser).toHaveBeenCalledWith('user-1', {
      isActive: false,
      organizationId: 'org-1'
    });
  });

  it('delegates turf reassignment and reopen actions', async () => {
    await controller.reassignTurf(
      'turf-1',
      { canvasserId: 'user-2', reason: 'Coverage' },
      { sub: 'admin-1', email: 'admin@example.com', role: UserRole.admin, organizationId: 'org-1' }
    );
    await controller.reopenTurf(
      'turf-1',
      { reason: 'Need more attempts' },
      { sub: 'admin-1', email: 'admin@example.com', role: UserRole.admin, organizationId: 'org-1' }
    );

    expect(turfsService.assignTurf).toHaveBeenCalledWith('turf-1', 'user-2', 'admin-1', 'Coverage', 'org-1');
    expect(turfsService.reopenTurf).toHaveBeenCalledWith('turf-1', 'admin-1', 'Need more attempts', 'org-1');
  });

  it('delegates outcome management, GPS override, and sync conflict resolution actions', async () => {
    await controller.createOutcomeDefinition({
      code: 'refused',
      label: 'Refused',
      requiresNote: true
    }, { sub: 'admin-1', email: 'admin@example.com', role: UserRole.admin, organizationId: 'org-1' });
    await controller.updateOutcomeDefinition('8cb8fd34-5625-48f7-8a91-6657bdbf2c6d', {
      code: 'refused',
      label: 'Refused at door',
      requiresNote: true
    }, { sub: 'admin-1', email: 'admin@example.com', role: UserRole.admin, organizationId: 'org-1' });
    await controller.overrideGpsResult(
      '8cb8fd34-5625-48f7-8a91-6657bdbf2c6d',
      { reason: 'Supervisor confirmed doorstep visit' },
      { sub: 'supervisor-1', email: 'sup@example.com', role: UserRole.supervisor, organizationId: 'org-1' }
    );
    await controller.resolveSyncConflict(
      '8cb8fd34-5625-48f7-8a91-6657bdbf2c6d',
      { reason: 'Reviewed duplicate local submission and cleared the queue item' },
      { sub: 'supervisor-1', email: 'sup@example.com', role: UserRole.supervisor, organizationId: 'org-1' }
    );

    expect(adminService.upsertOutcomeDefinition).toHaveBeenNthCalledWith(
      1,
      {
        code: 'refused',
        label: 'Refused',
        requiresNote: true
      },
      'org-1'
    );
    expect(adminService.overrideGpsResult).toHaveBeenCalledWith({
      visitLogId: '8cb8fd34-5625-48f7-8a91-6657bdbf2c6d',
      actorUserId: 'supervisor-1',
      organizationId: 'org-1',
      reason: 'Supervisor confirmed doorstep visit'
    });
    expect(adminService.resolveSyncConflict).toHaveBeenCalledWith({
      visitLogId: '8cb8fd34-5625-48f7-8a91-6657bdbf2c6d',
      actorUserId: 'supervisor-1',
      organizationId: 'org-1',
      reason: 'Reviewed duplicate local submission and cleared the queue item'
    });
  });
});
