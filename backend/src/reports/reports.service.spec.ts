import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  const prisma = {
    visitLog: {
      findMany: jest.fn()
    },
    turfSession: {
      findMany: jest.fn()
    },
    auditLog: {
      findMany: jest.fn()
    },
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    exportBatch: {
      findMany: jest.fn()
    }
  };
  const policiesService = {
    getEffectivePolicy: jest.fn().mockResolvedValue({
      supervisorScopeMode: 'campaign'
    })
  };

  const service = new ReportsService(prisma as never, policiesService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds an overview report with KPI and freshness summaries', async () => {
    prisma.visitLog.findMany.mockResolvedValue([
      {
        id: 'visit-1',
        addressId: 'address-1',
        canvasserId: 'user-1',
        sessionId: 'session-1',
        turfId: 'turf-1',
        visitTime: new Date('2026-03-28T09:00:00.000Z'),
        contactMade: true,
        gpsStatus: 'flagged',
        syncStatus: 'conflict',
        syncConflictFlag: true,
        outcomeCode: 'contact',
        outcomeLabel: 'Contact Made',
        result: 'contacted',
        outcomeDefinition: { isFinalDisposition: true },
        canvasser: {
          id: 'user-1',
          firstName: 'Taylor',
          lastName: 'Field',
          email: 'taylor@example.com',
          role: 'canvasser'
        },
        turf: { id: 'turf-1', name: 'Ward 1' },
        address: {
          id: 'address-1',
          addressLine1: '100 Main St',
          addressLine2: null,
          unit: null,
          city: 'Detroit',
          state: 'MI',
          zip: '48201'
        },
        geofenceResult: {
          gpsStatus: 'flagged',
          failureReason: 'outside_radius',
          distanceFromTargetFeet: 140,
          accuracyMeters: 12,
          validationRadiusFeet: 75,
          overrideFlag: false,
          overrideReason: null,
          overrideByUserId: null,
          overrideAt: null
        }
      },
      {
        id: 'visit-2',
        addressId: 'address-2',
        canvasserId: 'user-1',
        sessionId: 'session-1',
        turfId: 'turf-1',
        visitTime: new Date('2026-03-28T10:00:00.000Z'),
        contactMade: false,
        gpsStatus: 'verified',
        syncStatus: 'synced',
        syncConflictFlag: false,
        outcomeCode: 'not_home',
        outcomeLabel: 'Not Home',
        result: 'not_home',
        outcomeDefinition: { isFinalDisposition: false },
        canvasser: {
          id: 'user-1',
          firstName: 'Taylor',
          lastName: 'Field',
          email: 'taylor@example.com',
          role: 'canvasser'
        },
        turf: { id: 'turf-1', name: 'Ward 1' },
        address: {
          id: 'address-2',
          addressLine1: '102 Main St',
          addressLine2: null,
          unit: null,
          city: 'Detroit',
          state: 'MI',
          zip: '48201'
        },
        geofenceResult: {
          gpsStatus: 'verified',
          failureReason: null,
          distanceFromTargetFeet: 20,
          accuracyMeters: 5,
          validationRadiusFeet: 75,
          overrideFlag: true,
          overrideReason: 'manual review',
          overrideByUserId: 'admin-1',
          overrideAt: new Date('2026-03-28T10:05:00.000Z')
        }
      }
    ]);
    prisma.turfSession.findMany.mockResolvedValue([
      { id: 'session-1', canvasserId: 'user-1' },
      { id: 'session-2', canvasserId: 'user-2' }
    ]);
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'audit-1',
        actionType: 'gps_override_applied',
        entityType: 'visit_log',
        entityId: 'visit-2',
        reasonCode: 'manual_review',
        reasonText: 'Approved after review',
        createdAt: new Date('2026-03-28T10:06:00.000Z'),
        actorUser: {
          id: 'admin-1',
          firstName: 'Alex',
          lastName: 'Admin',
          email: 'alex@example.com',
          role: 'admin'
        }
      }
    ]);

    const result = await service.getOverview({
      organizationId: 'org-1',
      turfId: 'turf-1',
      dateFrom: '2026-03-01T00:00:00.000Z',
      dateTo: '2026-03-31T23:59:59.999Z'
    });

    expect(prisma.visitLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          turfId: 'turf-1'
        })
      })
    );
    expect(result.kpis).toEqual({
      totalVisits: 2,
      uniqueAddressesVisited: 2,
      contactsMade: 1,
      activeCanvassers: 2,
      syncStatus: {
        pending: 0,
        syncing: 0,
        synced: 1,
        failed: 0,
        conflict: 1
      },
      gpsStatus: {
        verified: 1,
        flagged: 1,
        missing: 0,
        lowAccuracy: 0,
        overrides: 1
      },
      outcomes: {
        finalDisposition: 1,
        attemptsOnly: 1
      },
      revisitVisits: 0
    });
    expect(result.dataFreshness).toEqual({
      reflectsSyncedDataOnly: false,
      pendingSyncRecords: 0,
      failedSyncRecords: 0,
      conflictRecords: 1
    });
    expect(result.productivityPreview).toEqual([
      {
        canvasserId: 'user-1',
        canvasserName: 'Taylor Field',
        email: 'taylor@example.com',
        totalVisits: 2,
        uniqueAddressesVisited: 2,
        contactsMade: 1
      }
    ]);
    expect(result.supervisorSlice).toEqual({
      filterApplied: false,
      supervisorId: null
    });
    expect(result.recentAuditActivity).toHaveLength(1);
  });

  it('builds productivity rows with session-based rates', async () => {
    prisma.visitLog.findMany.mockResolvedValue([
      {
        id: 'visit-1',
        addressId: 'address-1',
        canvasserId: 'user-1',
        sessionId: 'session-1',
        turfId: 'turf-1',
        visitTime: new Date('2026-03-28T09:00:00.000Z'),
        contactMade: true,
        gpsStatus: 'verified',
        syncStatus: 'synced',
        syncConflictFlag: false,
        outcomeCode: 'contact',
        outcomeLabel: 'Contact Made',
        result: 'contacted',
        outcomeDefinition: { isFinalDisposition: true },
        canvasser: {
          id: 'user-1',
          firstName: 'Taylor',
          lastName: 'Field',
          email: 'taylor@example.com',
          role: 'canvasser'
        },
        turf: { id: 'turf-1', name: 'Ward 1' },
        address: {
          id: 'address-1',
          addressLine1: '100 Main St',
          addressLine2: null,
          unit: null,
          city: 'Detroit',
          state: 'MI',
          zip: '48201'
        },
        geofenceResult: null
      },
      {
        id: 'visit-2',
        addressId: 'address-2',
        canvasserId: 'user-1',
        sessionId: 'session-1',
        turfId: 'turf-1',
        visitTime: new Date('2026-03-28T09:30:00.000Z'),
        contactMade: false,
        gpsStatus: 'flagged',
        syncStatus: 'synced',
        syncConflictFlag: false,
        outcomeCode: 'not_home',
        outcomeLabel: 'Not Home',
        result: 'not_home',
        outcomeDefinition: { isFinalDisposition: false },
        canvasser: {
          id: 'user-1',
          firstName: 'Taylor',
          lastName: 'Field',
          email: 'taylor@example.com',
          role: 'canvasser'
        },
        turf: { id: 'turf-1', name: 'Ward 1' },
        address: {
          id: 'address-2',
          addressLine1: '102 Main St',
          addressLine2: null,
          unit: null,
          city: 'Detroit',
          state: 'MI',
          zip: '48201'
        },
        geofenceResult: null
      }
    ]);
    prisma.turfSession.findMany.mockResolvedValue([
      {
        id: 'session-1',
        canvasserId: 'user-1',
        turfId: 'turf-1',
        startTime: new Date('2026-03-28T09:00:00.000Z'),
        endTime: new Date('2026-03-28T10:00:00.000Z'),
        status: 'completed'
      }
    ]);

    const result = await service.getProductivity({
      organizationId: 'org-1',
      canvasserId: 'user-1'
    });

    expect(result.summary).toEqual({
      totalCanvassers: 1,
      totalVisits: 2,
      totalUniqueAddressesVisited: 2,
      averageHousesPerHour: 2
    });
    expect(result.rows[0]).toEqual({
      canvasserId: 'user-1',
      canvasserName: 'Taylor Field',
      email: 'taylor@example.com',
      totalVisits: 2,
      uniqueAddressesVisited: 2,
      contactsMade: 1,
      finalDispositionVisits: 1,
      revisitVisits: 0,
      sessionsCount: 1,
      totalSessionMinutes: 60,
      averageSessionMinutes: 60,
      housesPerHour: 2,
      gpsVerifiedRate: 0.5,
      gpsFlaggedRate: 0.5
    });
  });

  it('builds GPS exception rows and resolves override approvers', async () => {
    prisma.visitLog.findMany.mockResolvedValue([
      {
        id: 'visit-1',
        addressId: 'address-1',
        canvasserId: 'user-1',
        sessionId: 'session-1',
        turfId: 'turf-1',
        visitTime: new Date('2026-03-28T09:00:00.000Z'),
        contactMade: true,
        gpsStatus: 'flagged',
        syncStatus: 'synced',
        syncConflictFlag: false,
        outcomeCode: 'contact',
        outcomeLabel: 'Contact Made',
        result: 'contacted',
        outcomeDefinition: { isFinalDisposition: true },
        canvasser: {
          id: 'user-1',
          firstName: 'Taylor',
          lastName: 'Field',
          email: 'taylor@example.com',
          role: 'canvasser'
        },
        turf: { id: 'turf-1', name: 'Ward 1' },
        address: {
          id: 'address-1',
          addressLine1: '100 Main St',
          addressLine2: null,
          unit: null,
          city: 'Detroit',
          state: 'MI',
          zip: '48201'
        },
        geofenceResult: {
          gpsStatus: 'flagged',
          failureReason: 'outside_radius',
          distanceFromTargetFeet: 140,
          accuracyMeters: 12,
          validationRadiusFeet: 75,
          overrideFlag: true,
          overrideReason: 'Reviewed and accepted',
          overrideByUserId: 'admin-1',
          overrideAt: new Date('2026-03-28T09:05:00.000Z')
        }
      }
    ]);
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'admin-1',
        firstName: 'Alex',
        lastName: 'Admin',
        email: 'alex@example.com',
        role: 'admin'
      }
    ]);

    const result = await service.getGpsExceptions({
      organizationId: 'org-1'
    });

    expect(result.summary).toEqual({
      totalExceptions: 1,
      flagged: 1,
      missing: 0,
      lowAccuracy: 0,
      overrides: 1,
      byCanvasser: [{ canvasserId: 'user-1', canvasserName: 'Taylor Field', total: 1 }],
      byTurf: [{ turfId: 'turf-1', turfName: 'Ward 1', total: 1 }]
    });
    expect(result.rows[0].override).toEqual({
      flag: true,
      reason: 'Reviewed and accepted',
      approvedAt: new Date('2026-03-28T09:05:00.000Z'),
      approvedBy: {
        id: 'admin-1',
        name: 'Alex Admin',
        email: 'alex@example.com'
      }
    });
    expect(result.rows[0].attemptNumber).toBe(1);
    expect(result.rows[0].isRevisit).toBe(false);
    expect(result.rows[0].outcome.isFinalDisposition).toBe(true);
  });

  it('builds audit activity summaries with org-scoped filters', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'audit-1',
        actionType: 'login_succeeded',
        entityType: 'user',
        entityId: 'user-1',
        reasonCode: null,
        reasonText: null,
        oldValuesJson: null,
        newValuesJson: null,
        createdAt: new Date('2026-03-28T08:00:00.000Z'),
        actorUser: {
          id: 'user-1',
          firstName: 'Taylor',
          lastName: 'Field',
          email: 'taylor@example.com',
          role: 'canvasser'
        }
      },
      {
        id: 'audit-2',
        actionType: 'turf_reassigned',
        entityType: 'turf_assignment',
        entityId: 'assignment-1',
        reasonCode: 'coverage',
        reasonText: 'Coverage issue',
        oldValuesJson: { from: 'user-1' },
        newValuesJson: { to: 'user-2' },
        createdAt: new Date('2026-03-28T09:00:00.000Z'),
        actorUser: {
          id: 'admin-1',
          firstName: 'Alex',
          lastName: 'Admin',
          email: 'alex@example.com',
          role: 'admin'
        }
      }
    ]);

    const result = await service.getAuditActivity({
      organizationId: 'org-1',
      canvasserId: 'user-1',
      limit: 50
    });

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          actorUserId: 'user-1'
        }),
        take: 50
      })
    );
    expect(result.summary).toEqual({
      totalEntries: 2,
      byActionType: [
        { actionType: 'login_succeeded', count: 1 },
        { actionType: 'turf_reassigned', count: 1 }
      ],
      byEntityType: [
        { entityType: 'turf_assignment', count: 1 },
        { entityType: 'user', count: 1 }
      ]
    });
    expect(result.rows).toHaveLength(2);
  });

  it('derives revisit metrics from full visit history even when the report is date-filtered', async () => {
    prisma.visitLog.findMany
      .mockResolvedValueOnce([
        {
          id: 'visit-2',
          addressId: 'address-1',
          canvasserId: 'user-1',
          sessionId: 'session-1',
          turfId: 'turf-1',
          visitTime: new Date('2026-03-30T15:00:00.000Z'),
          contactMade: false,
          gpsStatus: 'verified',
          syncStatus: 'synced',
          syncConflictFlag: false,
          outcomeCode: 'not_home',
          outcomeLabel: 'Not Home',
          result: 'not_home',
          outcomeDefinition: { isFinalDisposition: false },
          canvasser: {
            id: 'user-1',
            firstName: 'Taylor',
            lastName: 'Field',
            email: 'taylor@example.com',
            role: 'canvasser'
          },
          turf: { id: 'turf-1', name: 'Ward 1' },
          address: {
            id: 'address-1',
            addressLine1: '100 Main St',
            addressLine2: null,
            unit: null,
            city: 'Detroit',
            state: 'MI',
            zip: '48201'
          },
          geofenceResult: null
        }
      ])
      .mockResolvedValueOnce([
        {
          id: 'visit-1',
          turfId: 'turf-1',
          addressId: 'address-1',
          visitTime: new Date('2026-03-29T15:00:00.000Z')
        },
        {
          id: 'visit-2',
          turfId: 'turf-1',
          addressId: 'address-1',
          visitTime: new Date('2026-03-30T15:00:00.000Z')
        }
      ]);

    const result = await service.getTrendSummary({
      organizationId: 'org-1',
      dateFrom: '2026-03-30T00:00:00.000Z',
      dateTo: '2026-03-30T23:59:59.999Z'
    });

    expect(result.bucketTimeZone).toBe('UTC');
    expect(result.summary.revisitVisits).toBe(1);
    expect(result.summary.attemptOnlyVisits).toBe(1);
  });

    it('includes visits throughout a UTC day when dateTo is a date-only string (YYYY-MM-DD)', async () => {
      // Regression for: date-only dateTo was parsed as UTC midnight (start of day),
      // so visitTime.lte ended up at 2026-03-30T00:00:00Z, excluding all day's visits.
      prisma.visitLog.findMany
        .mockResolvedValueOnce([
          {
            id: 'visit-eod',
            addressId: 'address-1',
            canvasserId: 'user-1',
            sessionId: 'session-1',
            turfId: 'turf-1',
            visitTime: new Date('2026-03-30T22:45:00.000Z'),
            contactMade: true,
            gpsStatus: 'verified',
            syncStatus: 'synced',
            syncConflictFlag: false,
            outcomeCode: 'contact',
            outcomeLabel: 'Contact Made',
            result: 'contacted',
            outcomeDefinition: { isFinalDisposition: true },
            canvasser: {
              id: 'user-1',
              firstName: 'Taylor',
              lastName: 'Field',
              email: 'taylor@example.com',
              role: 'canvasser'
            },
            turf: { id: 'turf-1', name: 'Ward 1' },
            address: {
              id: 'address-1',
              addressLine1: '100 Main St',
              addressLine2: null,
              unit: null,
              city: 'Detroit',
              state: 'MI',
              zip: '48201'
            },
            geofenceResult: null
          }
        ])
        .mockResolvedValueOnce([]);
      prisma.turfSession.findMany.mockResolvedValue([]);
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.getOverview({
        organizationId: 'org-1',
        // date-only strings from an HTML type="date" input
        dateFrom: '2026-03-30',
        dateTo: '2026-03-30'
      });

      const visitWhereArg = (prisma.visitLog.findMany as jest.Mock).mock.calls[0][0];
      expect(visitWhereArg.where.visitTime.gte).toEqual(new Date('2026-03-30T00:00:00.000Z'));
      expect(visitWhereArg.where.visitTime.lte).toEqual(new Date('2026-03-30T23:59:59.999Z'));
    });

    it('leaves datetime strings with explicit time component unchanged in getRange', async () => {
      prisma.visitLog.findMany.mockResolvedValue([]).mockResolvedValueOnce([]);
      prisma.turfSession.findMany.mockResolvedValue([]);
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.getOverview({
        organizationId: 'org-1',
        dateFrom: '2026-03-30T00:00:00.000Z',
        dateTo: '2026-03-30T23:59:59.999Z'
      });

      const visitWhereArg = (prisma.visitLog.findMany as jest.Mock).mock.calls[0][0];
      expect(visitWhereArg.where.visitTime.gte).toEqual(new Date('2026-03-30T00:00:00.000Z'));
      expect(visitWhereArg.where.visitTime.lte).toEqual(new Date('2026-03-30T23:59:59.999Z'));
    });
});
