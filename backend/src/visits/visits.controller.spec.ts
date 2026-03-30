import { VisitsController } from './visits.controller';

describe('VisitsController', () => {
  const scope = { organizationId: 'org-1', campaignId: null };
  const visitsService = {
    logVisit: jest.fn(),
    listActiveOutcomes: jest.fn(),
    listRecentVisits: jest.fn(),
    correctVisit: jest.fn()
  };
  const usersService = {
    findById: jest.fn()
  };
  const policiesService = {
    getEffectivePolicy: jest.fn()
  };
  const controller = new VisitsController(visitsService as never, usersService as never, policiesService as never);

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

    expect(visitsService.listActiveOutcomes).toHaveBeenCalledWith(expect.objectContaining(scope));
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

  it('delegates recent visit lookups and corrections with organization scope', async () => {
    usersService.findById.mockResolvedValue({ id: 'admin-1', organizationId: 'org-1' });

    await controller.listRecentVisits(
      { sub: 'admin-1', email: 'admin@example.com', role: 'admin' as never },
      'turf-1',
      'user-2',
      undefined
    );
    await controller.correctVisit(
      '9f870efe-98f7-4d34-9ef7-16b1965de5b6',
      { outcomeCode: 'talked_to_voter', notes: 'Corrected', reason: 'Fix typo' },
      { sub: 'admin-1', email: 'admin@example.com', role: 'admin' as never }
    );

    expect(visitsService.listRecentVisits).toHaveBeenCalledWith({
      requesterId: 'admin-1',
      requesterRole: 'admin',
      scope: expect.objectContaining(scope),
      turfId: 'turf-1',
      canvasserId: 'user-2',
      addressId: undefined
    });
    expect(visitsService.correctVisit).toHaveBeenCalledWith({
      visitId: '9f870efe-98f7-4d34-9ef7-16b1965de5b6',
      actorUserId: 'admin-1',
      actorRole: 'admin',
      scope: expect.objectContaining(scope),
      outcomeCode: 'talked_to_voter',
      notes: 'Corrected',
      reason: 'Fix typo'
    });
  });
});
