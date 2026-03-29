import { VisitsController } from './visits.controller';

describe('VisitsController', () => {
  const visitsService = {
    logVisit: jest.fn(),
    listActiveOutcomes: jest.fn()
  };
  const usersService = {
    findById: jest.fn()
  };
  const controller = new VisitsController(visitsService as never, usersService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists active outcomes for mobile clients within the current organization', async () => {
    await controller.listActiveOutcomes({
      sub: 'canvasser-1',
      email: 'field@example.com',
      role: 'canvasser' as never,
      organizationId: 'org-1'
    });

    expect(visitsService.listActiveOutcomes).toHaveBeenCalledWith('org-1');
  });

  it('injects the current user id into visit logging', () => {
    controller.logVisit(
      {
        addressId: 'address-1',
        outcomeCode: 'knocked'
      },
      { sub: 'canvasser-1', email: 'field@example.com', role: 'canvasser' as never }
    );

    expect(visitsService.logVisit).toHaveBeenCalledWith({
      canvasserId: 'canvasser-1',
      addressId: 'address-1',
      outcomeCode: 'knocked'
    });
  });
});
