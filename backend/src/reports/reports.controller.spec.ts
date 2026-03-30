import { ReportsController } from './reports.controller';

describe('ReportsController', () => {
  const reportsService = {
    getOverview: jest.fn(),
    getProductivity: jest.fn(),
    getGpsExceptions: jest.fn(),
    getAuditActivity: jest.fn()
  };
  const usersService = {
    findById: jest.fn()
  };

  const controller = new ReportsController(reportsService as never, usersService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes organization-scoped overview filters to the service', async () => {
    await controller.overview(
      { sub: 'admin-1', email: 'alex@example.com', role: 'admin' as never, organizationId: 'org-1' },
      { turfId: 'turf-1', canvasserId: 'user-1' }
    );

    expect(reportsService.getOverview).toHaveBeenCalledWith({
      organizationId: 'org-1',
      turfId: 'turf-1',
      canvasserId: 'user-1'
    });
  });

  it('falls back to the user service when organization scope is missing from the JWT', async () => {
    usersService.findById.mockResolvedValue({
      id: 'supervisor-1',
      organizationId: 'org-9'
    });

    await controller.productivity(
      { sub: 'supervisor-1', email: 'casey@example.com', role: 'supervisor' as never },
      { dateFrom: '2026-03-01T00:00:00.000Z' }
    );

    expect(usersService.findById).toHaveBeenCalledWith('supervisor-1');
    expect(reportsService.getProductivity).toHaveBeenCalledWith({
      organizationId: 'org-9',
      dateFrom: '2026-03-01T00:00:00.000Z'
    });
  });

  it('delegates the GPS exceptions and audit activity reports', async () => {
    await controller.gpsExceptions(
      { sub: 'admin-1', email: 'alex@example.com', role: 'admin' as never, organizationId: 'org-1' },
      { gpsStatus: 'flagged', limit: 25 }
    );
    await controller.auditActivity(
      { sub: 'admin-1', email: 'alex@example.com', role: 'admin' as never, organizationId: 'org-1' },
      { canvasserId: 'user-1', limit: 10 }
    );

    expect(reportsService.getGpsExceptions).toHaveBeenCalledWith({
      organizationId: 'org-1',
      gpsStatus: 'flagged',
      limit: 25
    });
    expect(reportsService.getAuditActivity).toHaveBeenCalledWith({
      organizationId: 'org-1',
      canvasserId: 'user-1',
      limit: 10
    });
  });
});
