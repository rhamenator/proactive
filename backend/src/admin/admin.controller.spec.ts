import { UserRole } from '@prisma/client';
import { AdminController } from './admin.controller';

describe('AdminController', () => {
  const adminService = {
    dashboardSummary: jest.fn(),
    activeCanvassers: jest.fn(),
    listCanvassers: jest.fn(),
    listOutcomeDefinitions: jest.fn(),
    gpsReviewQueue: jest.fn(),
    overrideGpsResult: jest.fn(),
    upsertOutcomeDefinition: jest.fn()
  };
  const usersService = {
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

  it('delegates dashboard and active canvasser requests', () => {
    controller.dashboardSummary();
    controller.activeCanvassers();
    controller.listCanvassers();
    controller.listOutcomeDefinitions();
    controller.gpsReviewQueue();

    expect(adminService.dashboardSummary).toHaveBeenCalled();
    expect(adminService.activeCanvassers).toHaveBeenCalled();
    expect(adminService.listCanvassers).toHaveBeenCalled();
    expect(adminService.listOutcomeDefinitions).toHaveBeenCalled();
    expect(adminService.gpsReviewQueue).toHaveBeenCalled();
  });

  it('delegates create, invite, and update field-user flows', () => {
    controller.createCanvasser({
      firstName: 'Pat',
      lastName: 'Field',
      email: 'pat@example.com',
      password: 'Password123!',
      role: UserRole.supervisor
    });
    controller.inviteCanvasser({
      firstName: 'Pat',
      lastName: 'Field',
      email: 'pat@example.com',
      role: UserRole.canvasser
    });
    controller.updateCanvasser('user-1', { isActive: false });

    expect(usersService.createCanvasser).toHaveBeenCalled();
    expect(authService.inviteCanvasser).toHaveBeenCalled();
    expect(usersService.updateCanvasser).toHaveBeenCalledWith('user-1', { isActive: false });
  });

  it('delegates turf reassignment and reopen actions', () => {
    controller.reassignTurf(
      'turf-1',
      { canvasserId: 'user-2', reason: 'Coverage' },
      { sub: 'admin-1', email: 'admin@example.com', role: UserRole.admin }
    );
    controller.reopenTurf(
      'turf-1',
      { reason: 'Need more attempts' },
      { sub: 'admin-1', email: 'admin@example.com', role: UserRole.admin }
    );

    expect(turfsService.assignTurf).toHaveBeenCalledWith('turf-1', 'user-2', 'admin-1', 'Coverage');
    expect(turfsService.reopenTurf).toHaveBeenCalledWith('turf-1', 'admin-1', 'Need more attempts');
  });

  it('delegates outcome management and GPS override actions', () => {
    controller.createOutcomeDefinition({
      code: 'refused',
      label: 'Refused',
      requiresNote: true
    });
    controller.updateOutcomeDefinition('8cb8fd34-5625-48f7-8a91-6657bdbf2c6d', {
      code: 'refused',
      label: 'Refused at door',
      requiresNote: true
    });
    controller.overrideGpsResult(
      '8cb8fd34-5625-48f7-8a91-6657bdbf2c6d',
      { reason: 'Supervisor confirmed doorstep visit' },
      { sub: 'supervisor-1', email: 'sup@example.com', role: UserRole.supervisor }
    );

    expect(adminService.upsertOutcomeDefinition).toHaveBeenCalledTimes(2);
    expect(adminService.overrideGpsResult).toHaveBeenCalledWith({
      visitLogId: '8cb8fd34-5625-48f7-8a91-6657bdbf2c6d',
      actorUserId: 'supervisor-1',
      reason: 'Supervisor confirmed doorstep visit'
    });
  });
});
