import { ReportsController } from './reports.controller';

describe('ReportsController', () => {
  const reportsService = {
    getOverview: jest.fn(),
    getProductivity: jest.fn(),
    getGpsExceptions: jest.fn(),
    getAuditActivity: jest.fn(),
    getTrendSummary: jest.fn(),
    getResolvedConflicts: jest.fn(),
    getExportBatchAnalytics: jest.fn()
  };
  const usersService = {
    findById: jest.fn()
  };
  const policiesService = {
    getEffectivePolicy: jest.fn()
  };

  const controller = new ReportsController(reportsService as never, usersService as never, policiesService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    usersService.findById.mockResolvedValue({
      id: 'admin-1',
      organizationId: 'org-1',
      campaignId: null,
      role: 'admin'
    });
  });

  it('passes organization-scoped overview filters to the service', async () => {
    await controller.overview(
      { sub: 'admin-1', email: 'alex@example.com', role: 'admin' as never, organizationId: 'org-1' },
      { turfId: 'turf-1', canvasserId: 'user-1' }
    );

    expect(reportsService.getOverview).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1',
      turfId: 'turf-1',
      canvasserId: 'user-1'
    }));
  });

  it('falls back to the user service when organization scope is missing from the JWT', async () => {
    usersService.findById.mockResolvedValue({
      id: 'supervisor-1',
      organizationId: 'org-9',
      role: 'supervisor'
    });

    await controller.productivity(
      { sub: 'supervisor-1', email: 'casey@example.com', role: 'supervisor' as never },
      { dateFrom: '2026-03-01T00:00:00.000Z' }
    );

    expect(usersService.findById).toHaveBeenCalledWith('supervisor-1');
    expect(reportsService.getProductivity).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-9',
      dateFrom: '2026-03-01T00:00:00.000Z'
    }));
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

    expect(reportsService.getGpsExceptions).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1',
      gpsStatus: 'flagged',
      limit: 25
    }));
    expect(reportsService.getAuditActivity).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1',
      canvasserId: 'user-1',
      limit: 10
    }));
  });

  it('does not force campaign scope into reports unless it is explicitly requested', async () => {
    await controller.trends(
      { sub: 'admin-1', email: 'alex@example.com', role: 'admin' as never, organizationId: 'org-1', campaignId: 'campaign-1' },
      { outcomeCode: 'talked_to_voter' }
    );
    await controller.resolvedConflicts(
      { sub: 'admin-1', email: 'alex@example.com', role: 'admin' as never, organizationId: 'org-1', campaignId: 'campaign-1' },
      { limit: 15 }
    );
    await controller.exportBatches(
      { sub: 'admin-1', email: 'alex@example.com', role: 'admin' as never, organizationId: 'org-1', campaignId: 'campaign-1' },
      { turfId: 'turf-1' }
    );

    expect(reportsService.getTrendSummary).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1',
      outcomeCode: 'talked_to_voter'
    }));
    expect(reportsService.getResolvedConflicts).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1',
      limit: 15
    }));
    expect(reportsService.getExportBatchAnalytics).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1',
      turfId: 'turf-1'
    }));
  });

  it('defaults supervisors to team scope for reporting access', async () => {
    usersService.findById.mockResolvedValue({
      id: 'supervisor-1',
      organizationId: 'org-1',
      campaignId: 'campaign-1',
      teamId: 'team-1',
      role: 'supervisor'
    });

    await controller.overview(
      { sub: 'supervisor-1', email: 'sup@example.com', role: 'supervisor' as never, organizationId: 'org-1', campaignId: 'campaign-1', teamId: 'team-1' },
      {}
    );

    expect(reportsService.getOverview).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1',
      teamId: 'team-1',
      campaignId: undefined
    }));
  });

  it('provides a self-performance report for canvassers', async () => {
    usersService.findById.mockResolvedValue({
      id: 'canvasser-1',
      organizationId: 'org-1',
      teamId: 'team-1',
      role: 'canvasser'
    });
    reportsService.getOverview.mockResolvedValue({ kpis: { totalVisits: 3 } });
    reportsService.getProductivity.mockResolvedValue({ rows: [{ canvasserId: 'canvasser-1' }] });
    reportsService.getTrendSummary.mockResolvedValue({ summary: { totalVisits: 3 } });

    const result = await controller.myPerformance(
      { sub: 'canvasser-1', email: 'field@example.com', role: 'canvasser' as never, organizationId: 'org-1', teamId: 'team-1' },
      { gpsStatus: 'flagged' }
    );

    expect(reportsService.getOverview).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1',
      teamId: 'team-1',
      canvasserId: 'canvasser-1',
      gpsStatus: 'flagged'
    }));
    expect(reportsService.getProductivity).toHaveBeenCalledWith(expect.objectContaining({
      canvasserId: 'canvasser-1'
    }));
    expect(result).toEqual({
      overview: { kpis: { totalVisits: 3 } },
      productivity: { canvasserId: 'canvasser-1' },
      trends: { summary: { totalVisits: 3 } }
    });
  });
});
