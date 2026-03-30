import { SyncStatus, UserRole } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  const scope = { organizationId: 'org-1', campaignId: null };
  const prisma = {
    $transaction: jest.fn(),
    user: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn()
    },
    turf: {
      count: jest.fn(),
      findMany: jest.fn()
    },
    address: {
      count: jest.fn()
    },
    turfAssignment: {
      count: jest.fn()
    },
    turfSession: {
      count: jest.fn(),
      findMany: jest.fn()
    },
    visitLog: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn()
    },
    outcomeDefinition: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    visitGeofenceResult: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    auditLog: {
      create: jest.fn()
    },
    syncEvent: {
      create: jest.fn()
    },
    operationalPolicy: {
      findUnique: jest.fn(),
      upsert: jest.fn()
    },
    campaign: {
      findFirst: jest.fn()
    }
  };
  const policiesService = {
    getEffectivePolicy: jest.fn(),
    getManageablePolicy: jest.fn(),
    upsertPolicy: jest.fn(),
    clearPolicy: jest.fn()
  };
  const auditService = {
    log: jest.fn()
  };
  const retentionService = {
    getSummary: jest.fn(),
    runCleanup: jest.fn()
  };

  const service = new AdminService(prisma as never, policiesService as never, auditService as never, retentionService as never);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('builds a role-aware dashboard summary with per-turf progress', async () => {
    prisma.user.count
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);
    prisma.turf.count.mockResolvedValue(2);
    prisma.address.count.mockResolvedValue(5);
    prisma.turfAssignment.count.mockResolvedValue(3);
    prisma.turfSession.count.mockResolvedValue(1);
    prisma.visitLog.count.mockResolvedValue(4);
    prisma.visitLog.findMany
      .mockResolvedValueOnce([{ addressId: 'a1' }, { addressId: 'a2' }])
      .mockResolvedValueOnce([]);
    prisma.turfSession.findMany.mockResolvedValue([
      {
        id: 'session-1',
        startTime: new Date('2026-03-28T10:00:00.000Z'),
        canvasser: { id: 'user-3', firstName: 'Pat', lastName: 'Field', email: 'pat@example.com' },
        turf: { id: 'turf-1', name: 'North' }
      }
    ]);
    prisma.turf.findMany.mockResolvedValue([
      {
        id: 'turf-1',
        name: 'North',
        description: 'North block',
        addresses: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }, { id: 'a4' }],
        assignments: [{ id: 'assign-1' }],
        sessions: [{ id: 'session-1' }],
        visits: [{ addressId: 'a1' }, { addressId: 'a2' }, { addressId: 'a2' }]
      }
    ]);

    const result = await service.dashboardSummary(scope);

    expect(result.totals).toEqual(
      expect.objectContaining({
        users: 6,
        admins: 1,
        supervisors: 2,
        canvassers: 3,
        completedAddresses: 2
      })
    );
    expect(result.turfs[0]).toEqual(
      expect.objectContaining({
        id: 'turf-1',
        progressPercent: 50
      })
    );
  });

  it('delegates retention summary and cleanup to the retention service', async () => {
    retentionService.getSummary.mockResolvedValue({ dueNow: { importBatches: 2 } });
    retentionService.runCleanup.mockResolvedValue({ skipped: false, summary: { importBatches: 2 } });

    const summary = await service.retentionSummary(scope);
    const cleanup = await service.runRetentionCleanup(scope, 'admin-1');

    expect(retentionService.getSummary).toHaveBeenCalledWith(scope);
    expect(retentionService.runCleanup).toHaveBeenCalledWith({
      scope,
      actorUserId: 'admin-1'
    });
    expect(summary.dueNow.importBatches).toBe(2);
    expect(cleanup.skipped).toBe(false);
  });

  it('audits operational policy updates with before/after values', async () => {
    const currentPolicy = {
      organizationId: 'org-1',
      campaignId: null,
      sourceScope: 'organization',
      explicitRecord: true,
      inheritedFromOrganization: false,
      defaultImportMode: 'replace_turf_membership',
      defaultDuplicateStrategy: 'skip',
      sensitiveMfaWindowMinutes: 5
    };
    const updatedPolicy = {
      ...currentPolicy,
      defaultImportMode: 'upsert',
      sensitiveMfaWindowMinutes: 15
    };
    policiesService.getManageablePolicy.mockResolvedValue(currentPolicy);
    policiesService.upsertPolicy.mockResolvedValue(updatedPolicy);

    const result = await service.upsertOperationalPolicy(
      scope,
      {
        defaultImportMode: 'upsert',
        sensitiveMfaWindowMinutes: 15
      },
      'admin-1'
    );

    expect(policiesService.getManageablePolicy).toHaveBeenCalledWith(scope, null);
    expect(policiesService.upsertPolicy).toHaveBeenCalledWith(scope, {
      defaultImportMode: 'upsert',
      sensitiveMfaWindowMinutes: 15
    });
    expect(auditService.log).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      actionType: 'operational_policy_updated',
      entityType: 'operational_policy',
      entityId: 'org-1:org',
      oldValuesJson: currentPolicy,
      newValuesJson: updatedPolicy
    });
    expect(result).toBe(updatedPolicy);
  });

  it('clears a scoped operational policy and audits the rollback', async () => {
    const currentPolicy = {
      organizationId: 'org-1',
      campaignId: 'campaign-1',
      sourceScope: 'campaign',
      explicitRecord: true,
      inheritedFromOrganization: false,
      defaultImportMode: 'upsert',
      sensitiveMfaWindowMinutes: 15
    };
    const inheritedPolicy = {
      organizationId: 'org-1',
      campaignId: 'campaign-1',
      sourceScope: 'organization',
      explicitRecord: false,
      inheritedFromOrganization: true,
      defaultImportMode: 'replace_turf_membership',
      sensitiveMfaWindowMinutes: 5
    };
    policiesService.getManageablePolicy.mockResolvedValue(currentPolicy);
    policiesService.clearPolicy.mockResolvedValue(inheritedPolicy);

    const result = await service.clearOperationalPolicy(scope, 'campaign-1', 'admin-1');

    expect(policiesService.getManageablePolicy).toHaveBeenCalledWith(scope, 'campaign-1');
    expect(policiesService.clearPolicy).toHaveBeenCalledWith(scope, 'campaign-1');
    expect(auditService.log).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      actionType: 'operational_policy_cleared',
      entityType: 'operational_policy',
      entityId: 'org-1:campaign-1',
      oldValuesJson: currentPolicy,
      newValuesJson: inheritedPolicy
    });
    expect(result).toBe(inheritedPolicy);
  });

  it('lists only field users with supervisor and canvasser roles', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'user-1', role: UserRole.supervisor }]);

    const result = await service.listCanvassers(scope);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        deletedAt: null,
        role: {
          in: [UserRole.supervisor, UserRole.canvasser]
        }
      },
      select: expect.objectContaining({
        id: true,
        email: true,
        status: true
      }),
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    });
    expect(result).toHaveLength(1);
  });

  it('lists configurable outcomes in display order', async () => {
    policiesService.getEffectivePolicy.mockResolvedValue({ allowOrgOutcomeFallback: false });
    prisma.outcomeDefinition.findMany.mockResolvedValue([{ id: 'outcome-1', code: 'knocked' }]);

    const result = await service.listOutcomeDefinitions(scope);

    expect(prisma.outcomeDefinition.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
      orderBy: [{ displayOrder: 'asc' }, { label: 'asc' }]
    });
    expect(result).toEqual([{ id: 'outcome-1', code: 'knocked' }]);
  });

  it('merges organization defaults into campaign-scoped outcome listings when fallback is enabled', async () => {
    const campaignScope = { organizationId: 'org-1', campaignId: 'campaign-1' };
    policiesService.getEffectivePolicy.mockResolvedValue({ allowOrgOutcomeFallback: true });
    prisma.outcomeDefinition.findMany
      .mockResolvedValueOnce([{ id: 'campaign-outcome', code: 'knocked', label: 'Campaign Knocked', displayOrder: 1 }])
      .mockResolvedValueOnce([{ id: 'org-outcome', code: 'refused', label: 'Refused', displayOrder: 2 }]);

    const result = await service.listOutcomeDefinitions(campaignScope);

    expect(result).toEqual([
      { id: 'campaign-outcome', code: 'knocked', label: 'Campaign Knocked', displayOrder: 1 },
      { id: 'org-outcome', code: 'refused', label: 'Refused', displayOrder: 2 }
    ]);
  });

  it('archives a field user when the policy and scope allow it', async () => {
    policiesService.getEffectivePolicy.mockResolvedValue({ requireArchiveReason: true, retentionPurgeDays: 30 });
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-2',
      organizationId: 'org-1',
      status: 'active',
      isActive: true
    });
    prisma.turfSession.count.mockResolvedValue(0);
    prisma.turfAssignment.count.mockResolvedValue(0);
    prisma.user.update.mockResolvedValue({
      id: 'user-2',
      status: 'archived',
      archivedAt: new Date(),
      purgeAt: new Date()
    });
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma));

    const result = await service.archiveFieldUser({
      userId: 'user-2',
      actorUserId: 'admin-1',
      scope,
      reasonText: 'No longer active'
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: expect.objectContaining({
        status: 'archived',
        isActive: false
      })
    });
    expect(auditService.log).toHaveBeenCalled();
    expect(result.status).toBe('archived');
  });

  it('requires a delete reason when deleting a field user', async () => {
    await expect(
      service.deleteFieldUser({
        userId: 'user-2',
        actorUserId: 'admin-1',
        scope,
        reasonText: '   '
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates and updates outcome definitions with normalized values', async () => {
    prisma.outcomeDefinition.create.mockResolvedValue({ id: 'outcome-2', code: 'refused' });
    prisma.outcomeDefinition.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'outcome-2', organizationId: 'org-1' });
    prisma.outcomeDefinition.update.mockResolvedValue({ id: 'outcome-2', code: 'refused' });

    const created = await service.upsertOutcomeDefinition({
      code: ' refused ',
      label: ' Refused ',
      requiresNote: true,
      displayOrder: 40
    }, scope);
    const updated = await service.upsertOutcomeDefinition({
      id: 'outcome-2',
      code: 'refused',
      label: 'Refused At Door',
      isActive: false
    }, scope);

    expect(prisma.outcomeDefinition.create).toHaveBeenCalledWith({
      data: {
        code: 'refused',
        label: 'Refused',
        requiresNote: true,
        isFinalDisposition: true,
        displayOrder: 40,
        isActive: true,
        organizationId: 'org-1',
        campaignId: null
      }
    });
    expect(prisma.outcomeDefinition.findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        code: 'refused',
        organizationId: 'org-1',
        campaignId: null
      }
    });
    expect(prisma.outcomeDefinition.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        code: 'refused',
        organizationId: 'org-1',
        campaignId: null,
        id: { not: 'outcome-2' }
      }
    });
    expect(prisma.outcomeDefinition.findFirst).toHaveBeenNthCalledWith(3, {
      where: {
        id: 'outcome-2',
        organizationId: 'org-1'
      }
    });
    expect(prisma.outcomeDefinition.update).toHaveBeenCalledWith({
      where: { id: 'outcome-2' },
      data: {
        code: 'refused',
        label: 'Refused At Door',
        requiresNote: false,
        isFinalDisposition: true,
        displayOrder: 0,
        isActive: false,
        organizationId: 'org-1',
        campaignId: null
      }
    });
    expect(created).toEqual({ id: 'outcome-2', code: 'refused' });
    expect(updated).toEqual({ id: 'outcome-2', code: 'refused' });
  });

  it('returns the GPS review queue with canvasser and turf context', async () => {
    prisma.visitGeofenceResult.findMany.mockResolvedValue([{ id: 'geo-1' }]);

    const result = await service.gpsReviewQueue(scope);

    expect(prisma.visitGeofenceResult.findMany).toHaveBeenCalledWith({
      where: {
        visitLog: { organizationId: 'org-1' },
        OR: [{ gpsStatus: { not: 'verified' } }, { overrideFlag: true }]
      },
      orderBy: { createdAt: 'desc' },
      include: {
        address: true,
        visitLog: {
          include: {
            canvasser: { select: expect.any(Object) },
            turf: { select: { id: true, name: true } }
          }
        }
      }
    });
    expect(result).toEqual([{ id: 'geo-1' }]);
  });

  it('returns visit logs that are still in sync conflict review', async () => {
    prisma.visitLog.findMany.mockResolvedValue([{ id: 'visit-1', syncStatus: SyncStatus.conflict }]);

    const result = await service.syncConflictQueue(scope);

    expect(prisma.visitLog.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        OR: [
          { syncStatus: 'conflict' },
          { syncConflictFlag: true }
        ]
      },
      orderBy: { visitTime: 'desc' },
      include: {
        address: {
          select: {
            id: true,
            addressLine1: true,
            city: true,
            state: true,
            zip: true
          }
        },
        canvasser: { select: expect.any(Object) },
        turf: { select: { id: true, name: true } }
      }
    });
    expect(result).toEqual([{ id: 'visit-1', syncStatus: SyncStatus.conflict }]);
  });

  it('applies GPS overrides and writes an audit trail', async () => {
    prisma.visitGeofenceResult.findFirst.mockResolvedValue({
      visitLogId: 'visit-1',
      overrideFlag: false,
      failureReason: 'outside_radius',
      gpsStatus: 'flagged'
    });
    prisma.visitGeofenceResult.update.mockResolvedValue({ id: 'geo-1', overrideFlag: true });
    prisma.visitLog.update.mockResolvedValue({ id: 'visit-1', geofenceValidated: true });
    prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
    prisma.$transaction.mockImplementation(async (operations) => Promise.all(operations));

    const result = await service.overrideGpsResult({
      visitLogId: 'visit-1',
      actorUserId: 'admin-1',
      scope,
      reason: 'Manual verification'
    });

    expect(prisma.visitGeofenceResult.update).toHaveBeenCalledWith({
      where: { visitLogId: 'visit-1' },
      data: expect.objectContaining({
        overrideFlag: true,
        overrideReason: 'Manual verification',
        overrideByUserId: 'admin-1',
        overrideAt: expect.any(Date)
      })
    });
    expect(prisma.visitLog.update).toHaveBeenCalledWith({
      where: { id: 'visit-1' },
      data: { geofenceValidated: true }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: 'admin-1',
        actionType: 'gps_override_applied',
        entityId: 'visit-1'
      })
    });
    expect(result).toEqual({ id: 'geo-1', overrideFlag: true });
  });

  it('rejects blank GPS override reasons', async () => {
    await expect(service.overrideGpsResult({
      visitLogId: 'visit-1',
      actorUserId: 'admin-1',
      scope,
      reason: '   '
    })).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.visitGeofenceResult.findFirst).not.toHaveBeenCalled();
  });

  it('resolves sync conflicts and records an audit reason', async () => {
    prisma.visitLog.findFirst.mockResolvedValue({
      id: 'visit-1',
      syncStatus: SyncStatus.conflict,
      syncConflictFlag: true,
      syncConflictReason: 'duplicate_submission',
      localRecordUuid: 'local-1',
      idempotencyKey: 'idem-1'
    });
    prisma.visitLog.update.mockResolvedValue({ id: 'visit-1', syncStatus: SyncStatus.synced, syncConflictFlag: false });
    prisma.syncEvent.create.mockResolvedValue({ id: 'sync-2' });
    prisma.auditLog.create.mockResolvedValue({ id: 'audit-2' });
    prisma.$transaction.mockImplementation(async (operations) => Promise.all(operations));

    const result = await service.resolveSyncConflict({
      visitLogId: 'visit-1',
      actorUserId: 'supervisor-1',
      scope,
      reason: 'Confirmed the server record is the correct final submission.'
    });

    expect(prisma.visitLog.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'visit-1',
        organizationId: 'org-1',
        OR: [
          { syncStatus: SyncStatus.conflict },
          { syncConflictFlag: true }
        ]
      }
    });
    expect(prisma.visitLog.update).toHaveBeenCalledWith({
      where: { id: 'visit-1' },
      data: {
        syncStatus: SyncStatus.synced,
        syncConflictFlag: false,
        syncConflictReason: null
      },
      include: {
        address: {
          select: {
            id: true,
            addressLine1: true,
            city: true,
            state: true,
            zip: true
          }
        },
        canvasser: { select: expect.any(Object) },
        turf: { select: { id: true, name: true } }
      }
    });
    expect(prisma.syncEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: 'visit_log',
        entityId: 'visit-1',
        localRecordUuid: 'local-1',
        idempotencyKey: 'idem-1',
        eventType: 'conflict_resolved',
        syncStatus: SyncStatus.synced
      })
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: 'supervisor-1',
        organizationId: 'org-1',
        actionType: 'sync_conflict_resolved',
        entityId: 'visit-1',
        reasonText: 'Confirmed the server record is the correct final submission.'
      })
    });
    expect(result).toEqual({ id: 'visit-1', syncStatus: SyncStatus.synced, syncConflictFlag: false });
  });

  it('requires a non-empty reason before resolving a sync conflict', async () => {
    await expect(service.resolveSyncConflict({
      visitLogId: 'visit-1',
      actorUserId: 'supervisor-1',
      scope,
      reason: '   '
    })).rejects.toThrow('Resolution reason is required');

    expect(prisma.visitLog.findFirst).not.toHaveBeenCalled();
  });
});
