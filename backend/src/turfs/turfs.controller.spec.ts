import { TurfsController } from './turfs.controller';

describe('TurfsController', () => {
  const scope = { organizationId: 'org-1', campaignId: null };
  const turfsService = {
    listTurfs: jest.fn(),
    createTurf: jest.fn(),
    assignTurf: jest.fn(),
    getTurfAddresses: jest.fn(),
    getMyTurf: jest.fn(),
    startSession: jest.fn(),
    pauseSession: jest.fn(),
    resumeSession: jest.fn(),
    completeSession: jest.fn()
  };
  const usersService = {
    findById: jest.fn()
  };
  const controller = new TurfsController(turfsService as never, usersService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates list, create, assign, and address lookup actions', async () => {
    const adminUser = {
      sub: 'admin-1',
      email: 'admin@example.com',
      role: 'admin' as never,
      organizationId: 'org-1'
    };

    await controller.listTurfs(adminUser);
    controller.createTurf({ name: 'North' }, adminUser);
    await controller.assignTurf(
      'turf-1',
      { canvasserId: 'canvasser-1' },
      adminUser
    );
    await controller.getAddresses('turf-1', adminUser);

    expect(turfsService.listTurfs).toHaveBeenCalledWith(scope);
    expect(turfsService.createTurf).toHaveBeenCalledWith({ name: 'North' }, 'admin-1');
    expect(turfsService.assignTurf).toHaveBeenCalledWith('turf-1', 'canvasser-1', 'admin-1', undefined, scope);
    expect(turfsService.getTurfAddresses).toHaveBeenCalledWith('turf-1', scope);
  });

  it('delegates canvasser turf and session actions', () => {
    const user = { sub: 'canvasser-1', email: 'field@example.com', role: 'canvasser' as never };

    controller.getMyTurf(user);
    controller.startTurf({ turfId: 'turf-1', latitude: 42.9, longitude: -85.6 }, user);
    controller.pauseTurf({ turfId: 'turf-1', latitude: 42.9, longitude: -85.6 }, user);
    controller.resumeTurf({ turfId: 'turf-1', latitude: 42.9, longitude: -85.6 }, user);
    controller.completeTurf({ turfId: 'turf-1', latitude: 42.9, longitude: -85.6 }, user);
    controller.endTurf({ turfId: 'turf-1', latitude: 42.9, longitude: -85.6 }, user);

    expect(turfsService.getMyTurf).toHaveBeenCalledWith('canvasser-1');
    expect(turfsService.startSession).toHaveBeenCalled();
    expect(turfsService.pauseSession).toHaveBeenCalled();
    expect(turfsService.resumeSession).toHaveBeenCalled();
    expect(turfsService.completeSession).toHaveBeenCalledTimes(2);
  });
});
