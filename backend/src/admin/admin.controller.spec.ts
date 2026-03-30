import { UserRole } from '@prisma/client';
import { AdminController } from './admin.controller';

describe('AdminController', () => {
  const scope = {
    organizationId: 'org-1',
    campaignId: null,
    teamId: null,
    regionCode: null,
    role: UserRole.admin,
    supervisorScopeMode: undefined
  };
  const supervisorScope = {
    organizationId: 'org-1',
    campaignId: null,
    teamId: null,
    regionCode: null,
    role: UserRole.supervisor,
    supervisorScopeMode: 'campaign'
  };
  const adminService = {
    dashboardSummary: jest.fn(),
    activeCanvassers: jest.fn(),
    listCanvassers: jest.fn(),
    listCampaigns: jest.fn(),
    listOutcomeDefinitions: jest.fn(),
    getOperationalPolicy: jest.fn(),
    getSystemSettings: jest.fn(),
    retentionSummary: jest.fn(),
    runRetentionCleanup: jest.fn(),
    archiveFieldUser: jest.fn(),
    deleteFieldUser: jest.fn(),
    gpsReviewQueue: jest.fn(),
    syncConflictQueue: jest.fn(),
    overrideGpsResult: jest.fn(),
    resolveSyncConflict: jest.fn(),
    upsertOutcomeDefinition: jest.fn(),
    upsertOperationalPolicy: jest.fn(),
    clearOperationalPolicy: jest.fn(),
    upsertSystemSettings: jest.fn(),
    clearSystemSettings: jest.fn()
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
    reopenTurf: jest.fn(),
    archiveTurf: jest.fn(),
    deleteTurf: jest.fn()
  };
  const policiesService = {
    getEffectivePolicy: jest.fn()
  };
  const controller = new AdminController(
    adminService as never,
    usersService as never,
    authService as never,
    turfsService as never,
    policiesService as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
    usersService.findById.mockImplementation(async (id: string) => ({
      id,
      organizationId: 'org-1',
      campaignId: null,
      teamId: null,
      team: null,
      role: id.startsWith('supervisor') ? UserRole.supervisor : UserRole.admin
    }));
    policiesService.getEffectivePolicy.mockResolvedValue({
      supervisorScopeMode: 'campaign'
    });
  });

  it('delegates dashboard and active canvasser requests with organization scope', async () => {
    const user = {
      sub: 'admin-1',
      email: 'admin@example.com',
      role: UserRole.admin,
      organizationId: 'org-1',
      campaignId: null
    };

    await controller.dashboardSummary(user);
    await controller.activeCanvassers(user);
    await controller.listCanvassers(user);
    await controller.listCampaigns(user);
    await controller.listOutcomeDefinitions(user);
    await controller.getOperationalPolicy(user);
    await controller.getSystemSettings();
    await controller.retentionSummary(user);
    await controller.gpsReviewQueue(user);
    await controller.syncConflictQueue(user);

    expect(adminService.dashboardSummary).toHaveBeenCalledWith(expect.objectContaining(scope));
    expect(adminService.activeCanvassers).toHaveBeenCalledWith(expect.objectContaining(scope));
    expect(adminService.listCanvassers).toHaveBeenCalledWith(expect.objectContaining(scope));
    expect(adminService.listCampaigns).toHaveBeenCalledWith(expect.objectContaining(scope));
    expect(adminService.listOutcomeDefinitions).toHaveBeenCalledWith(expect.objectContaining(scope));
    expect(adminService.getOperationalPolicy).toHaveBeenCalledWith(expect.objectContaining(scope), null);
    expect(adminService.getSystemSettings).toHaveBeenCalled();
    expect(adminService.retentionSummary).toHaveBeenCalledWith(expect.objectContaining(scope));
    expect(adminService.gpsReviewQueue).toHaveBeenCalledWith(expect.objectContaining(scope));
    expect(adminService.syncConflictQueue).toHaveBeenCalledWith(expect.objectContaining(scope));
  });

  it('delegates manual retention cleanup with scoped actor context', async () => {
    const user = {
      sub: 'admin-1',
      email: 'admin@example.com',
      role: UserRole.admin,
      organizationId: 'org-1',
      campaignId: null
    };

    await controller.runRetentionCleanup(user);

    expect(adminService.runRetentionCleanup).toHaveBeenCalledWith(expect.objectContaining(scope), 'admin-1');
  });

  it('delegates create, invite, and update field-user flows', async () => {
    const user = {
      sub: 'admin-1',
      email: 'admin@example.com',
      role: UserRole.admin,
      organizationId: 'org-1',
      campaignId: null
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
    expect(authService.inviteCanvasser).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: 'admin-1', organizationId: 'org-1', campaignId: null })
    );
    expect(usersService.updateCanvasser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        isActive: false,
        organizationId: 'org-1'
      })
    );
  });

  it('rejects field-user campaign assignments outside a campaign-scoped admin scope', async () => {
    const scopedAdmin = {
      sub: 'admin-1',
      email: 'admin@example.com',
      role: UserRole.admin,
      organizationId: 'org-1',
      campaignId: 'campaign-1'
    };

    await expect(
      controller.createCanvasser(
        {
          firstName: 'Pat',
          lastName: 'Field',
          email: 'pat@example.com',
          password: 'Password123!',
          role: UserRole.canvasser,
          campaignId: 'campaign-2'
        },
        scopedAdmin
      )
    ).rejects.toThrow('You cannot assign users outside your campaign scope');

    expect(usersService.createCanvasser).not.toHaveBeenCalled();
  });

  it('delegates turf reassignment and reopen actions', async () => {
    await controller.reassignTurf(
      'turf-1',
      { canvasserId: 'user-2', reason: 'Coverage' },
      { sub: 'admin-1', email: 'admin@example.com', role: UserRole.admin, organizationId: 'org-1', campaignId: null }
    );
    await controller.reopenTurf(
      'turf-1',
      { reason: 'Need more attempts' },
      { sub: 'admin-1', email: 'admin@example.com', role: UserRole.admin, organizationId: 'org-1', campaignId: null }
    );

    expect(turfsService.assignTurf).toHaveBeenCalledWith(
      'turf-1',
      'user-2',
      'admin-1',
      'Coverage',
      expect.objectContaining(scope)
    );
    expect(turfsService.reopenTurf).toHaveBeenCalledWith(
      'turf-1',
      'admin-1',
      'Need more attempts',
      expect.objectContaining(scope)
    );
  });

  it('delegates field-user archive/delete and turf archive/delete actions', async () => {
    await controller.archiveCanvasser(
      'user-1',
      { reason: 'No longer active' },
      { sub: 'admin-1', email: 'admin@example.com', role: UserRole.admin, organizationId: 'org-1', campaignId: null }
    );
    await controller.deleteCanvasser(
      'user-1',
      { reason: 'Created in error' },
      { sub: 'admin-1', email: 'admin@example.com', role: UserRole.admin, organizationId: 'org-1', campaignId: null }
    );
    await controller.archiveTurf(
      '8cb8fd34-5625-48f7-8a91-6657bdbf2c6d',
      { reason: 'Closed after review' },
      { sub: 'admin-1', email: 'admin@example.com', role: UserRole.admin, organizationId: 'org-1', campaignId: null }
    );
    await controller.deleteTurf(
      '8cb8fd34-5625-48f7-8a91-6657bdbf2c6d',
      { reason: 'Created in error' },
      { sub: 'admin-1', email: 'admin@example.com', role: UserRole.admin, organizationId: 'org-1', campaignId: null }
    );

    expect(adminService.archiveFieldUser).toHaveBeenCalledWith({
      userId: 'user-1',
      actorUserId: 'admin-1',
      scope: expect.objectContaining(scope),
      reasonText: 'No longer active'
    });
    expect(adminService.deleteFieldUser).toHaveBeenCalledWith({
      userId: 'user-1',
      actorUserId: 'admin-1',
      scope: expect.objectContaining(scope),
      reasonText: 'Created in error'
    });
    expect(turfsService.archiveTurf).toHaveBeenCalledWith(
      '8cb8fd34-5625-48f7-8a91-6657bdbf2c6d',
      'admin-1',
      'Closed after review',
      expect.objectContaining(scope)
    );
    expect(turfsService.deleteTurf).toHaveBeenCalledWith(
      '8cb8fd34-5625-48f7-8a91-6657bdbf2c6d',
      'admin-1',
      'Created in error',
      expect.objectContaining(scope)
    );
  });

  it('delegates outcome management, GPS override, and sync conflict resolution actions', async () => {
    await controller.createOutcomeDefinition({
      code: 'refused',
      label: 'Refused',
      requiresNote: true
    }, { sub: 'admin-1', email: 'admin@example.com', role: UserRole.admin, organizationId: 'org-1', campaignId: null });
    await controller.updateOutcomeDefinition('8cb8fd34-5625-48f7-8a91-6657bdbf2c6d', {
      code: 'refused',
      label: 'Refused at door',
      requiresNote: true
    }, { sub: 'admin-1', email: 'admin@example.com', role: UserRole.admin, organizationId: 'org-1', campaignId: null });
    await controller.overrideGpsResult(
      '8cb8fd34-5625-48f7-8a91-6657bdbf2c6d',
      { reason: 'Supervisor confirmed doorstep visit' },
      { sub: 'supervisor-1', email: 'sup@example.com', role: UserRole.supervisor, organizationId: 'org-1', campaignId: null }
    );
    await controller.resolveSyncConflict(
      '8cb8fd34-5625-48f7-8a91-6657bdbf2c6d',
      { reason: 'Reviewed duplicate local submission and cleared the queue item' },
      { sub: 'supervisor-1', email: 'sup@example.com', role: UserRole.supervisor, organizationId: 'org-1', campaignId: null }
    );

    expect(adminService.upsertOutcomeDefinition).toHaveBeenNthCalledWith(
      1,
      {
        code: 'refused',
        label: 'Refused',
        requiresNote: true
      },
      expect.objectContaining(scope)
    );
    expect(adminService.upsertOutcomeDefinition).toHaveBeenNthCalledWith(
      2,
      {
        id: '8cb8fd34-5625-48f7-8a91-6657bdbf2c6d',
        code: 'refused',
        label: 'Refused at door',
        requiresNote: true
      },
      expect.objectContaining(scope)
    );
    expect(adminService.overrideGpsResult).toHaveBeenCalledWith({
      visitLogId: '8cb8fd34-5625-48f7-8a91-6657bdbf2c6d',
      actorUserId: 'supervisor-1',
      scope: expect.objectContaining(supervisorScope),
      reason: 'Supervisor confirmed doorstep visit'
    });
    expect(adminService.resolveSyncConflict).toHaveBeenCalledWith({
      visitLogId: '8cb8fd34-5625-48f7-8a91-6657bdbf2c6d',
      actorUserId: 'supervisor-1',
      scope: expect.objectContaining(supervisorScope),
      reason: 'Reviewed duplicate local submission and cleared the queue item'
    });
  });

  it('delegates operational policy updates through the current scope', async () => {
    await controller.upsertOperationalPolicy(
      {
        defaultImportMode: 'upsert',
        defaultDuplicateStrategy: 'merge',
        sensitiveMfaWindowMinutes: 15
      },
      { sub: 'admin-1', email: 'admin@example.com', role: UserRole.admin, organizationId: 'org-1', campaignId: null }
    );

    expect(adminService.upsertOperationalPolicy).toHaveBeenCalledWith(expect.objectContaining(scope), {
      defaultImportMode: 'upsert',
      defaultDuplicateStrategy: 'merge',
      sensitiveMfaWindowMinutes: 15
    }, 'admin-1');
  });

  it('delegates operational policy clearing through the current scope', async () => {
    await controller.clearOperationalPolicy(
      { sub: 'admin-1', email: 'admin@example.com', role: UserRole.admin, organizationId: 'org-1', campaignId: null },
      'campaign-1'
    );

    expect(adminService.clearOperationalPolicy).toHaveBeenCalledWith(expect.objectContaining(scope), 'campaign-1', 'admin-1');
  });

  it('delegates global system settings updates and resets', async () => {
    const user = { sub: 'admin-1', email: 'admin@example.com', role: UserRole.admin, organizationId: 'org-1', campaignId: null };

    await controller.upsertSystemSettings(
      {
        authRateLimitWindowMinutes: 20,
        authRateLimitMaxAttempts: 12,
        retentionJobEnabled: true,
        retentionJobIntervalMinutes: 30
      },
      user
    );
    await controller.clearSystemSettings(user);

    expect(adminService.upsertSystemSettings).toHaveBeenCalledWith({
      authRateLimitWindowMinutes: 20,
      authRateLimitMaxAttempts: 12,
      retentionJobEnabled: true,
      retentionJobIntervalMinutes: 30
    }, 'admin-1');
    expect(adminService.clearSystemSettings).toHaveBeenCalledWith('admin-1');
  });
});
