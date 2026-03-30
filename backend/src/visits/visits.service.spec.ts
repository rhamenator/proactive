import { AssignmentStatus, GpsStatus, SyncStatus, VisitResult } from '@prisma/client';
import { VisitsService } from './visits.service';

describe('VisitsService', () => {
  const scope = { organizationId: 'org-1', campaignId: null };
  const prisma = {
    $transaction: jest.fn(),
    visitLog: {
      findUnique: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn()
    },
    address: {
      findUnique: jest.fn()
    },
    outcomeDefinition: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    turfAssignment: {
      findFirst: jest.fn()
    },
    turfSession: {
      findFirst: jest.fn()
    },
    visitCorrection: {
      create: jest.fn()
    }
  };
  const auditService = {
    log: jest.fn()
  };
  const policiesService = {
    getEffectivePolicy: jest.fn().mockResolvedValue({
      allowOrgOutcomeFallback: true,
      canvasserCorrectionWindowMinutes: 10,
      maxAttemptsPerHousehold: 3,
      minMinutesBetweenAttempts: 5,
      geofenceRadiusFeet: 75,
      gpsLowAccuracyMeters: 30
    })
  };

  const service = new VisitsService(prisma as never, auditService as never, policiesService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.visitLog.findMany.mockResolvedValue([]);
    prisma.visitLog.update.mockResolvedValue({ id: 'visit-1', outcomeCode: 'talked_to_voter' });
    prisma.visitCorrection.create.mockResolvedValue({ id: 'correction-1' });
  });

  function mockAssignedAddress(overrides: Partial<Record<string, unknown>> = {}) {
    prisma.address.findUnique.mockResolvedValue({
      id: 'address-1',
      turfId: 'turf-1',
      organizationId: 'org-1',
      campaignId: 'campaign-1',
      latitude: 42.9634,
      longitude: -85.6681,
      turf: { id: 'turf-1', organizationId: 'org-1', campaignId: 'campaign-1' },
      ...overrides
    });
    prisma.outcomeDefinition.findFirst.mockResolvedValue({
      id: 'outcome-1',
      code: 'knocked',
      label: 'Knocked',
      requiresNote: false
    });
    prisma.turfAssignment.findFirst.mockResolvedValue({
      id: 'assignment-1',
      status: AssignmentStatus.active
    });
    prisma.turfSession.findFirst.mockResolvedValue(null);
    prisma.visitLog.count.mockResolvedValue(0);
    prisma.visitLog.findFirst.mockResolvedValue(null);
  }

  function mockSuccessfulTransaction() {
    const tx = {
      visitLog: {
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'visit-1',
          ...data
        }))
      },
      visitGeofenceResult: {
        create: jest.fn().mockResolvedValue({ id: 'geo-1' })
      },
      syncEvent: {
        create: jest.fn().mockResolvedValue({ id: 'sync-1' })
      }
    };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    auditService.log.mockResolvedValue(undefined);
    return tx;
  }

  function buildCorrectableVisit(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'visit-1',
      organizationId: 'org-1',
      campaignId: null,
      canvasserId: 'user-2',
      outcomeDefinitionId: 'outcome-1',
      outcomeCode: 'knocked',
      outcomeLabel: 'Knocked',
      result: 'knocked',
      notes: 'Original note',
      contactMade: false,
      vanExported: false,
      syncStatus: SyncStatus.synced,
      syncConflictFlag: false,
      geofenceResult: { overrideFlag: false },
      visitTime: new Date('2026-03-29T21:00:00.000Z'),
      ...overrides
    };
  }

  function mockCorrectionTransaction(
    updatedVisit: Record<string, unknown> = { id: 'visit-1', outcomeCode: 'talked_to_voter' }
  ) {
    const tx = {
      visitLog: {
        update: jest.fn().mockResolvedValue(updatedVisit)
      },
      visitCorrection: {
        create: jest.fn().mockResolvedValue({ id: 'correction-1' })
      }
    };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    auditService.log.mockResolvedValue(undefined);
    return tx;
  }

  it('returns an existing visit when the local record UUID was already ingested', async () => {
    const existingVisit = { id: 'visit-1', localRecordUuid: 'local-1' };
    prisma.visitLog.findUnique.mockResolvedValue(existingVisit);

    const result = await service.logVisit({
      canvasserId: 'canvasser-1',
      addressId: 'address-1',
      outcomeCode: VisitResult.knocked,
      localRecordUuid: 'local-1'
    });

    expect(prisma.visitLog.findUnique).toHaveBeenCalledWith({
      where: { localRecordUuid: 'local-1' }
    });
    expect(prisma.address.findUnique).not.toHaveBeenCalled();
    expect(result).toBe(existingVisit);
  });

  it('lists active outcomes in display order for the current organization', async () => {
    prisma.outcomeDefinition.findMany.mockResolvedValue([{ id: 'outcome-1', code: 'knocked' }]);

    const result = await service.listActiveOutcomes(scope);

    expect(prisma.outcomeDefinition.findMany).toHaveBeenCalledWith({
      where: { isActive: true, organizationId: 'org-1', campaignId: null },
      orderBy: [{ campaignId: 'desc' }, { displayOrder: 'asc' }, { label: 'asc' }]
    });
    expect(result).toEqual([{ id: 'outcome-1', code: 'knocked' }]);
  });

  it('prefers campaign-specific outcomes but falls back to organization defaults for active outcome lists', async () => {
    prisma.outcomeDefinition.findMany.mockResolvedValue([
      {
        id: 'outcome-campaign',
        code: 'knocked',
        label: 'Knocked Campaign',
        displayOrder: 2,
        campaignId: 'campaign-1'
      },
      {
        id: 'outcome-org',
        code: 'knocked',
        label: 'Knocked Org',
        displayOrder: 1,
        campaignId: null
      },
      {
        id: 'outcome-org-2',
        code: 'refused',
        label: 'Refused',
        displayOrder: 3,
        campaignId: null
      }
    ]);

    const result = await service.listActiveOutcomes({ organizationId: 'org-1', campaignId: 'campaign-1' });

    expect(result).toEqual([
      expect.objectContaining({ id: 'outcome-campaign', code: 'knocked' }),
      expect.objectContaining({ id: 'outcome-org-2', code: 'refused' })
    ]);
  });

  it('flags low-accuracy visits and records the sync/geofence side effects', async () => {
    mockAssignedAddress();
    const tx = mockSuccessfulTransaction();

    const result = await service.logVisit({
      canvasserId: 'canvasser-1',
      addressId: 'address-1',
      outcomeCode: VisitResult.knocked,
      latitude: 42.9634,
      longitude: -85.6681,
      accuracyMeters: 45
    });

    expect(tx.visitLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        outcomeDefinitionId: 'outcome-1',
        outcomeCode: 'knocked',
        outcomeLabel: 'Knocked',
        gpsStatus: GpsStatus.low_accuracy,
        geofenceValidated: false,
        syncStatus: SyncStatus.synced
      })
    });
    expect(tx.visitGeofenceResult.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gpsStatus: GpsStatus.low_accuracy,
        failureReason: 'low_accuracy'
      })
    });
    expect(tx.syncEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: 'visit_log',
        eventType: 'ingest',
        syncStatus: SyncStatus.synced
      })
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'visit_created',
        entityId: 'visit-1'
      }),
      tx
    );
    expect(result.gpsStatus).toBe(GpsStatus.low_accuracy);
  });

  it('returns an existing visit when the idempotency key was already ingested', async () => {
    const existingVisit = { id: 'visit-2', idempotencyKey: 'idem-1' };
    prisma.visitLog.findUnique.mockResolvedValue(existingVisit);

    const result = await service.logVisit({
      canvasserId: 'canvasser-1',
      addressId: 'address-1',
      outcomeCode: VisitResult.knocked,
      idempotencyKey: 'idem-1'
    });

    expect(prisma.visitLog.findUnique).toHaveBeenCalledWith({
      where: { idempotencyKey: 'idem-1' }
    });
    expect(prisma.address.findUnique).not.toHaveBeenCalled();
    expect(result).toBe(existingVisit);
  });

  it('rejects visits when the address cannot be found', async () => {
    prisma.address.findUnique.mockResolvedValue(null);

    await expect(
      service.logVisit({
        canvasserId: 'canvasser-1',
        addressId: 'address-1',
        outcomeCode: VisitResult.knocked
      })
    ).rejects.toThrow('Address not found');
  });

  it('rejects visits when the outcome code is unknown', async () => {
    mockAssignedAddress();
    prisma.outcomeDefinition.findFirst.mockResolvedValue(null);

    await expect(
      service.logVisit({
        canvasserId: 'canvasser-1',
        addressId: 'address-1',
        outcomeCode: 'unknown_code'
      })
    ).rejects.toThrow('Visit outcome is not recognized');
  });

  it('falls back to organization-level outcomes when the address is campaign-bound but no campaign override exists', async () => {
    mockAssignedAddress();
    prisma.outcomeDefinition.findFirst.mockResolvedValue({
      id: 'outcome-org',
      code: 'knocked',
      label: 'Knocked',
      requiresNote: false,
      campaignId: null
    });
    const tx = mockSuccessfulTransaction();

    await service.logVisit({
      canvasserId: 'canvasser-1',
      addressId: 'address-1',
      outcomeCode: VisitResult.knocked
    });

    expect(prisma.outcomeDefinition.findFirst).toHaveBeenCalledWith({
      where: {
        code: VisitResult.knocked,
        isActive: true,
        organizationId: 'org-1',
        OR: [{ campaignId: 'campaign-1' }, { campaignId: null }]
      },
      orderBy: [{ campaignId: 'desc' }, { displayOrder: 'asc' }, { label: 'asc' }]
    });
    expect(tx.visitLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          outcomeDefinitionId: 'outcome-org'
        })
      })
    );
  });

  it('rejects visits when the selected outcome requires notes', async () => {
    mockAssignedAddress();
    prisma.outcomeDefinition.findFirst.mockResolvedValue({
      id: 'outcome-2',
      code: 'refused',
      label: 'Refused',
      requiresNote: true
    });

    await expect(
      service.logVisit({
        canvasserId: 'canvasser-1',
        addressId: 'address-1',
        outcomeCode: 'refused',
        notes: '   '
      })
    ).rejects.toThrow('Notes are required for the selected visit outcome');
  });

  it('rejects visits when the canvasser is not assigned to the turf', async () => {
    prisma.address.findUnique.mockResolvedValue({
      id: 'address-1',
      turfId: 'turf-1',
      organizationId: 'org-1',
      campaignId: 'campaign-1',
      latitude: 42.9634,
      longitude: -85.6681,
      turf: { id: 'turf-1', organizationId: 'org-1', campaignId: 'campaign-1' }
    });
    prisma.outcomeDefinition.findFirst.mockResolvedValue({
      id: 'outcome-1',
      code: 'knocked',
      label: 'Knocked',
      requiresNote: false
    });
    prisma.turfAssignment.findFirst.mockResolvedValue(null);

    await expect(
      service.logVisit({
        canvasserId: 'canvasser-1',
        addressId: 'address-1',
        outcomeCode: VisitResult.knocked
      })
    ).rejects.toThrow('Canvasser is not assigned to this turf');
  });

  it('rejects visits when the provided session is invalid for the turf', async () => {
    mockAssignedAddress();
    prisma.turfSession.findFirst.mockResolvedValue(null);

    await expect(
      service.logVisit({
        canvasserId: 'canvasser-1',
        addressId: 'address-1',
        sessionId: 'session-1',
        outcomeCode: VisitResult.knocked
      })
    ).rejects.toThrow('Visit session is invalid for this turf');
  });

  it('rejects visits after the household reaches the maximum attempts', async () => {
    mockAssignedAddress();
    prisma.visitLog.count.mockResolvedValue(3);

    await expect(
      service.logVisit({
        canvasserId: 'canvasser-1',
        addressId: 'address-1',
        outcomeCode: VisitResult.knocked
      })
    ).rejects.toThrow('This household has reached the maximum attempts for this turf cycle');
  });

  it('rejects visits that happen too soon after the canvasser previous attempt', async () => {
    mockAssignedAddress();
    prisma.visitLog.findFirst.mockResolvedValue({
      visitTime: new Date('2026-03-28T10:00:00.000Z')
    });
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-03-28T10:02:00.000Z').getTime());

    await expect(
      service.logVisit({
        canvasserId: 'canvasser-1',
        addressId: 'address-1',
        outcomeCode: VisitResult.knocked
      })
    ).rejects.toThrow('Please wait 5 minutes before logging another attempt for this household');

    nowSpy.mockRestore();
  });

  it('records a target_missing GPS result when the address has no target coordinates', async () => {
    mockAssignedAddress({ latitude: null, longitude: null });
    const tx = mockSuccessfulTransaction();

    const result = await service.logVisit({
      canvasserId: 'canvasser-1',
      addressId: 'address-1',
      outcomeCode: VisitResult.knocked,
      latitude: 42.9634,
      longitude: -85.6681,
      accuracyMeters: 10
    });

    expect(tx.visitLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gpsStatus: GpsStatus.missing,
        geofenceValidated: false
      })
    });
    expect(tx.visitGeofenceResult.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gpsStatus: GpsStatus.missing,
        failureReason: 'target_missing'
      })
    });
    expect(result.gpsStatus).toBe(GpsStatus.missing);
  });

  it('records an outside_radius GPS result when the visit is outside the geofence', async () => {
    mockAssignedAddress({
      latitude: 42.0,
      longitude: -85.0
    });
    const tx = mockSuccessfulTransaction();

    const result = await service.logVisit({
      canvasserId: 'canvasser-1',
      addressId: 'address-1',
      outcomeCode: VisitResult.knocked,
      latitude: 43.0,
      longitude: -86.0,
      accuracyMeters: 10
    });

    expect(tx.visitLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gpsStatus: GpsStatus.flagged,
        geofenceValidated: false
      })
    });
    expect(tx.visitGeofenceResult.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gpsStatus: GpsStatus.flagged,
        failureReason: 'outside_radius'
      })
    });
    expect(result.gpsStatus).toBe(GpsStatus.flagged);
  });

  it('records a verified GPS result when the captured location matches the target', async () => {
    mockAssignedAddress({
      latitude: 42.9634,
      longitude: -85.6681
    });
    const tx = mockSuccessfulTransaction();

    const result = await service.logVisit({
      canvasserId: 'canvasser-1',
      addressId: 'address-1',
      outcomeCode: VisitResult.knocked,
      latitude: 42.9634,
      longitude: -85.6681,
      accuracyMeters: 10
    });

    expect(tx.visitLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gpsStatus: GpsStatus.verified,
        geofenceValidated: true
      })
    });
    expect(tx.visitGeofenceResult.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gpsStatus: GpsStatus.verified,
        failureReason: undefined
      })
    });
    expect(result.gpsStatus).toBe(GpsStatus.verified);
  });

  it('returns recent visits scoped to the current organization', async () => {
    prisma.visitLog.findMany.mockResolvedValue([{ id: 'visit-1' }]);

    const result = await service.listRecentVisits({
      requesterId: 'admin-1',
      requesterRole: 'admin' as never,
      scope,
      turfId: 'turf-1'
    });

    expect(prisma.visitLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          organizationId: 'org-1',
          turfId: 'turf-1'
        }
      })
    );
    expect(result).toEqual([{ id: 'visit-1' }]);
  });

  it('records a correction for an admin-reviewed visit', async () => {
    prisma.visitLog.findFirst.mockResolvedValue(buildCorrectableVisit({ notes: null }));
    prisma.outcomeDefinition.findFirst.mockResolvedValue({
      id: 'outcome-2',
      code: 'talked_to_voter',
      label: 'Talked To Voter',
      requiresNote: true
    });
    const tx = mockCorrectionTransaction();

    const result = await service.correctVisit({
      visitId: 'visit-1',
      actorUserId: 'admin-1',
      actorRole: 'admin' as never,
      scope,
      outcomeCode: 'talked_to_voter',
      notes: 'Corrected note',
      reason: 'Fix incorrect disposition'
    });

    expect(tx.visitLog.update).toHaveBeenCalledWith({
      where: { id: 'visit-1' },
      data: expect.objectContaining({
        outcomeCode: 'talked_to_voter',
        outcomeLabel: 'Talked To Voter',
        notes: 'Corrected note',
        contactMade: true
      })
    });
    expect(tx.visitCorrection.create).toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'visit_corrected',
        entityId: 'visit-1'
      }),
      tx
    );
    expect(result).toEqual({ id: 'visit-1', outcomeCode: 'talked_to_voter' });
  });

  it('falls back to organization-level outcomes when correcting a campaign-scoped visit', async () => {
    prisma.visitLog.findFirst.mockResolvedValue(buildCorrectableVisit({ campaignId: 'campaign-1', notes: null }));
    prisma.outcomeDefinition.findFirst.mockResolvedValue({
      id: 'outcome-org',
      code: 'talked_to_voter',
      label: 'Talked To Voter',
      requiresNote: true,
      campaignId: null
    });
    const tx = mockCorrectionTransaction();

    await service.correctVisit({
      visitId: 'visit-1',
      actorUserId: 'admin-1',
      actorRole: 'admin' as never,
      scope: { organizationId: 'org-1', campaignId: 'campaign-1' },
      outcomeCode: 'talked_to_voter',
      notes: 'Corrected note',
      reason: 'Fix incorrect disposition'
    });

    expect(prisma.outcomeDefinition.findFirst).toHaveBeenCalledWith({
      where: {
        code: 'talked_to_voter',
        isActive: true,
        organizationId: 'org-1',
        OR: [{ campaignId: 'campaign-1' }, { campaignId: null }]
      },
      orderBy: [{ campaignId: 'desc' }, { displayOrder: 'asc' }, { label: 'asc' }]
    });
    expect(tx.visitLog.update).toHaveBeenCalled();
  });

  it('allows supervisors to correct visits within organization scope', async () => {
    prisma.visitLog.findFirst.mockResolvedValue(buildCorrectableVisit());
    prisma.outcomeDefinition.findFirst.mockResolvedValue({
      id: 'outcome-3',
      code: 'other',
      label: 'Other',
      requiresNote: false
    });
    const tx = mockCorrectionTransaction({ id: 'visit-1', outcomeCode: 'other' });

    const result = await service.correctVisit({
      visitId: 'visit-1',
      actorUserId: 'supervisor-1',
      actorRole: 'supervisor' as never,
      scope,
      outcomeCode: 'other',
      notes: 'Supervisor correction',
      reason: 'Supervisor QA review'
    });

    expect(tx.visitCorrection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: 'supervisor-1',
        visitLogId: 'visit-1',
        reasonText: 'Supervisor QA review'
      })
    });
    expect(result).toEqual({ id: 'visit-1', outcomeCode: 'other' });
  });

  it('prevents canvassers from correcting another user visit', async () => {
    prisma.visitLog.findFirst.mockResolvedValue(buildCorrectableVisit({ canvasserId: 'user-2' }));

    await expect(
      service.correctVisit({
        visitId: 'visit-1',
        actorUserId: 'user-1',
        actorRole: 'canvasser' as never,
        scope,
        outcomeCode: 'knocked',
        reason: 'Not my visit'
      })
    ).rejects.toThrow('You can only correct your own recent submissions');
  });

  it('allows canvassers to correct their own recent submissions inside the correction window', async () => {
    prisma.visitLog.findFirst.mockResolvedValue(
      buildCorrectableVisit({
        canvasserId: 'user-1',
        visitTime: new Date(Date.now() - 5 * 60 * 1000)
      })
    );
    prisma.outcomeDefinition.findFirst.mockResolvedValue({
      id: 'outcome-3',
      code: 'other',
      label: 'Other',
      requiresNote: false
    });
    const tx = mockCorrectionTransaction({ id: 'visit-1', outcomeCode: 'other' });

    const result = await service.correctVisit({
      visitId: 'visit-1',
      actorUserId: 'user-1',
      actorRole: 'canvasser' as never,
      scope,
      outcomeCode: 'other',
      reason: 'Fix my last entry'
    });

    expect(tx.visitCorrection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: 'user-1',
        visitLogId: 'visit-1'
      })
    });
    expect(result).toEqual({ id: 'visit-1', outcomeCode: 'other' });
  });

  it('blocks canvasser corrections outside the correction window', async () => {
    prisma.visitLog.findFirst.mockResolvedValue(
      buildCorrectableVisit({
        canvasserId: 'user-1',
        visitTime: new Date(Date.now() - 31 * 60 * 1000)
      })
    );

    await expect(
      service.correctVisit({
        visitId: 'visit-1',
        actorUserId: 'user-1',
        actorRole: 'canvasser' as never,
        scope,
        outcomeCode: 'knocked',
        notes: undefined,
        reason: 'Too late'
      })
    ).rejects.toThrow('The correction window for this visit has expired');
  });

  it('blocks corrections for exported visits', async () => {
    prisma.visitLog.findFirst.mockResolvedValue(buildCorrectableVisit({ vanExported: true }));

    await expect(
      service.correctVisit({
        visitId: 'visit-1',
        actorUserId: 'admin-1',
        actorRole: 'admin' as never,
        scope,
        outcomeCode: 'other',
        reason: 'Blocked export'
      })
    ).rejects.toThrow('Exported visits are locked and cannot be corrected');
  });

  it('blocks corrections while sync conflict remains flagged', async () => {
    prisma.visitLog.findFirst.mockResolvedValue(buildCorrectableVisit({ syncConflictFlag: true }));

    await expect(
      service.correctVisit({
        visitId: 'visit-1',
        actorUserId: 'admin-1',
        actorRole: 'admin' as never,
        scope,
        outcomeCode: 'other',
        reason: 'Blocked conflict'
      })
    ).rejects.toThrow('Resolve the sync conflict before correcting this visit');
  });

  it('blocks corrections while visit sync status is conflict', async () => {
    prisma.visitLog.findFirst.mockResolvedValue(buildCorrectableVisit({ syncStatus: SyncStatus.conflict }));

    await expect(
      service.correctVisit({
        visitId: 'visit-1',
        actorUserId: 'admin-1',
        actorRole: 'admin' as never,
        scope,
        outcomeCode: 'other',
        reason: 'Blocked conflict status'
      })
    ).rejects.toThrow('Resolve the sync conflict before correcting this visit');
  });

  it('blocks corrections for visits with GPS overrides', async () => {
    prisma.visitLog.findFirst.mockResolvedValue(
      buildCorrectableVisit({ geofenceResult: { overrideFlag: true } })
    );

    await expect(
      service.correctVisit({
        visitId: 'visit-1',
        actorUserId: 'admin-1',
        actorRole: 'admin' as never,
        scope,
        outcomeCode: 'other',
        reason: 'Blocked gps override'
      })
    ).rejects.toThrow('Visits with GPS overrides are locked and cannot be corrected');
  });

  it('preserves existing notes when the correction omits notes', async () => {
    prisma.visitLog.findFirst.mockResolvedValue(buildCorrectableVisit({ notes: 'Keep me' }));
    prisma.outcomeDefinition.findFirst.mockResolvedValue({
      id: 'outcome-3',
      code: 'other',
      label: 'Other',
      requiresNote: false
    });
    const tx = mockCorrectionTransaction({ id: 'visit-1', outcomeCode: 'other', notes: 'Keep me' });

    await service.correctVisit({
      visitId: 'visit-1',
      actorUserId: 'admin-1',
      actorRole: 'admin' as never,
      scope,
      outcomeCode: 'other',
      reason: 'Keep existing note'
    });

    expect(tx.visitLog.update).toHaveBeenCalledWith({
      where: { id: 'visit-1' },
      data: expect.objectContaining({
        notes: 'Keep me'
      })
    });
  });

  it('rejects corrections when the selected outcome requires notes and no notes remain', async () => {
    prisma.visitLog.findFirst.mockResolvedValue(buildCorrectableVisit({ notes: null }));
    prisma.outcomeDefinition.findFirst.mockResolvedValue({
      id: 'outcome-4',
      code: 'refused',
      label: 'Refused',
      requiresNote: true
    });

    await expect(
      service.correctVisit({
        visitId: 'visit-1',
        actorUserId: 'admin-1',
        actorRole: 'admin' as never,
        scope,
        outcomeCode: 'refused',
        notes: '   ',
        reason: 'Need note'
      })
    ).rejects.toThrow('Notes are required for the selected visit outcome');
  });

  it('rejects corrections that do not change the visit state', async () => {
    prisma.visitLog.findFirst.mockResolvedValue(buildCorrectableVisit());
    prisma.outcomeDefinition.findFirst.mockResolvedValue({
      id: 'outcome-1',
      code: 'knocked',
      label: 'Knocked',
      requiresNote: false
    });

    await expect(
      service.correctVisit({
        visitId: 'visit-1',
        actorUserId: 'admin-1',
        actorRole: 'admin' as never,
        scope,
        outcomeCode: 'knocked',
        reason: 'No change'
      })
    ).rejects.toThrow('This correction does not change the visit');
  });
});
