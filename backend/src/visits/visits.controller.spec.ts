import { VisitsController } from './visits.controller';

describe('VisitsController', () => {
  const visitsService = {
    logVisit: jest.fn()
  };
  const controller = new VisitsController(visitsService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('injects the current user id into visit logging', () => {
    controller.logVisit(
      {
        addressId: 'address-1',
        result: 'knocked' as never
      },
      { sub: 'canvasser-1', email: 'field@example.com', role: 'canvasser' as never }
    );

    expect(visitsService.logVisit).toHaveBeenCalledWith({
      canvasserId: 'canvasser-1',
      addressId: 'address-1',
      result: 'knocked'
    });
  });
});
