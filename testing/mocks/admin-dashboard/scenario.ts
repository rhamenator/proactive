import { http, HttpResponse } from 'msw';
import { createAdminUiScenario } from '../../fake-data/scenarios';

export type AdminMockScenario = ReturnType<typeof createAdminMockScenario>;

export function createAdminMockScenario() {
  const seed = createAdminUiScenario('mocked-ui');

  return {
    me: {
      id: 'admin-mock-1',
      firstName: seed.admin.firstName,
      lastName: seed.admin.lastName,
      email: seed.admin.email,
      role: 'admin',
      organizationId: 'org-mock-1',
      campaignId: 'campaign-mock-1',
      teamId: 'team-mock-1',
      regionCode: seed.team.regionCode,
      isActive: true,
      status: 'active',
      mfaEnabled: true,
      invitedAt: null,
      activatedAt: '2026-03-29T12:00:00.000Z',
      lastLoginAt: '2026-03-30T09:00:00.000Z',
      createdAt: '2026-03-01T12:00:00.000Z'
    },
    login: {
      accessToken: 'mock-token',
      refreshToken: 'mock-refresh',
      token: 'mock-token',
      role: 'admin',
      user: {
        id: 'admin-mock-1',
        firstName: seed.admin.firstName,
        lastName: seed.admin.lastName,
        email: seed.admin.email,
        role: 'admin',
        isActive: true,
        status: 'active',
        mfaEnabled: true,
        invitedAt: null,
        activatedAt: '2026-03-29T12:00:00.000Z',
        lastLoginAt: '2026-03-30T09:00:00.000Z',
        createdAt: '2026-03-01T12:00:00.000Z'
      }
    },
    reports: {
      overview: {
        filters: {
          dateFrom: '2026-03-30',
          dateTo: '2026-03-30',
          teamId: null,
          turfId: null,
          canvasserId: null,
          outcomeCode: null,
          syncStatus: null,
          gpsStatus: null,
          campaignId: null,
          overrideFlag: null
        },
        kpis: {
          totalVisits: 2,
          uniqueAddressesVisited: 2,
          contactsMade: 1,
          conversionRate: 50,
          avgVisitsPerCanvasser: 2,
          avgSessionMinutes: 47,
          housesPerHour: 2.4,
          activeCanvassers: 1,
          syncStatus: { pending: 0, syncing: 0, synced: 1, failed: 0, conflict: 1 },
          gpsStatus: { verified: 1, flagged: 1, missing: 0, lowAccuracy: 0, overrides: 0 }
        },
        generatedAt: '2026-03-30T23:59:59.000Z',
        generatedAtTimezone: 'UTC'
      },
      productivity: {
        rows: [
          {
            canvasserId: 'canvasser-mock-1',
            canvasserName: `${seed.canvasser.firstName} ${seed.canvasser.lastName}`,
            email: seed.canvasser.email,
            totalVisits: 2,
            uniqueAddressesVisited: 2,
            contactsMade: 1,
            sessionsCount: 1,
            averageSessionMinutes: 47,
            housesPerHour: 2.4,
            gpsVerifiedRate: 50,
            gpsFlaggedRate: 50
          }
        ]
      },
      gpsExceptions: {
        rows: [
          {
            visitId: 'visit-mock-2',
            visitTime: '2026-03-30T23:45:00.000Z',
            turf: {
              id: 'turf-mock-1',
              name: seed.turf.name
            },
            canvasser: {
              id: 'canvasser-mock-1',
              name: `${seed.canvasser.firstName} ${seed.canvasser.lastName}`
            },
            address: {
              id: 'address-mock-2',
              addressLine1: seed.addresses[1].addressLine1,
              city: seed.addresses[1].city,
              state: seed.addresses[1].state,
              zip: seed.addresses[1].zip
            },
            gpsStatus: 'flagged',
            override: {
              flag: false,
              reason: null
            }
          }
        ]
      },
      auditActivity: {
        rows: []
      },
      trends: {
        bucketTimeZone: 'UTC',
        summary: { days: 1, totalVisits: 2, averageVisitsPerDay: 2 },
        byDay: [{ day: '2026-03-30', visits: 2, contactsMade: 1, uniqueAddressesVisited: 2 }],
        byOutcome: [
          { outcomeCode: 'talked_to_voter', outcomeLabel: 'Talked to Voter', total: 1 },
          { outcomeCode: 'knocked', outcomeLabel: 'Knocked', total: 1 }
        ]
      },
      resolvedConflicts: {
        summary: {
          totalResolved: 1
        },
        rows: [
          {
            id: 'audit-conflict-1',
            visitLogId: 'visit-mock-2',
            resolvedAt: '2026-03-30T23:50:00.000Z',
            reasonText: 'Reviewed payload mismatch and accepted server record',
            actorUser: {
              id: 'admin-mock-1',
              firstName: seed.admin.firstName,
              lastName: seed.admin.lastName,
              email: seed.admin.email,
              role: 'admin'
            }
          }
        ]
      },
      exportBatches: {
        summary: {
          totalBatches: 1,
          totalRows: 2,
          artifactBackedBatches: 1,
          byProfile: [{ profileCode: 'van_compatible', count: 1, rowCount: 2 }]
        },
        rows: [
          {
            id: 'batch-mock-1',
            filename: 'van-results-2026-03-30.csv',
            profileCode: 'van_compatible',
            rowCount: 2,
            createdAt: '2026-03-30T23:50:00.000Z',
            hasStoredArtifact: true,
            checksum: 'mock-checksum',
            traceableVisitCount: 2,
            turf: { id: 'turf-mock-1', name: seed.turf.name },
            initiatedByUser: {
              id: 'admin-mock-1',
              firstName: seed.admin.firstName,
              lastName: seed.admin.lastName,
              email: seed.admin.email,
              role: 'admin'
            }
          }
        ]
      }
    },
    campaigns: [{ id: 'campaign-mock-1', code: 'spring_gotv', name: seed.campaign.name, isActive: true, createdAt: '2026-03-01T00:00:00.000Z' }],
    turfs: [{ id: 'turf-mock-1', name: seed.turf.name, description: seed.turf.description, status: 'in_progress', campaignId: 'campaign-mock-1', teamId: 'team-mock-1', regionCode: seed.team.regionCode }],
    canvassers: [{ id: 'canvasser-mock-1', firstName: seed.canvasser.firstName, lastName: seed.canvasser.lastName, email: seed.canvasser.email, role: 'canvasser', status: 'active', isActive: true, teamId: 'team-mock-1', regionCode: seed.team.regionCode }],
    outcomes: [
      { id: 'outcome-1', code: 'knocked', label: 'Knocked', requiresNote: false, isFinalDisposition: true, displayOrder: 10, isActive: true, organizationId: 'org-mock-1', campaignId: 'campaign-mock-1', createdAt: '2026-03-01T00:00:00.000Z' }
    ],
    exports: {
      history: [
        {
          id: 'export-batch-1',
          profileCode: 'van_compatible',
          profileName: 'VAN Compatible',
          filename: 'van-results-2026-03-30.csv',
          organizationId: 'org-mock-1',
          campaignId: 'campaign-mock-1',
          teamId: 'team-mock-1',
          regionCode: seed.team.regionCode,
          rowCount: 2,
          markExported: true,
          createdAt: '2026-03-30T23:50:00.000Z',
          initiatedByUser: {
            id: 'admin-mock-1',
            firstName: seed.admin.firstName,
            lastName: seed.admin.lastName,
            email: seed.admin.email,
            role: 'admin'
          },
          turf: { id: 'turf-mock-1', name: seed.turf.name },
          _count: { exportedVisits: 2 }
        }
      ]
    },
    importReviewQueue: [
      {
        id: 'import-row-1',
        rowIndex: 3,
        status: 'pending_review',
        turfName: seed.turf.name,
        reasonCode: 'duplicate_address',
        rawRow: { address: seed.addresses[0].addressLine1, city: seed.addresses[0].city, state: seed.addresses[0].state },
        importBatch: { id: 'import-batch-1', filename: 'detroit-import.csv' },
        candidateAddress: {
          id: 'address-mock-1',
          addressLine1: seed.addresses[0].addressLine1,
          city: seed.addresses[0].city,
          state: seed.addresses[0].state,
          zip: seed.addresses[0].zip,
          vanId: seed.addresses[0].vanId,
          turf: { id: 'turf-mock-1', name: seed.turf.name }
        }
      }
    ],
    syncConflicts: [
      {
        id: 'visit-mock-2',
        address: {
          id: 'address-mock-2',
          addressLine1: seed.addresses[1].addressLine1,
          city: seed.addresses[1].city,
          state: seed.addresses[1].state,
          zip: seed.addresses[1].zip
        },
        turf: { id: 'turf-mock-1', name: seed.turf.name, teamId: 'team-mock-1', regionCode: seed.team.regionCode },
        canvasser: {
          id: 'canvasser-mock-1',
          firstName: seed.canvasser.firstName,
          lastName: seed.canvasser.lastName,
          email: seed.canvasser.email,
          role: 'canvasser'
        },
        visitTime: '2026-03-30T23:45:00.000Z',
        syncStatus: 'conflict',
        syncConflictFlag: true,
        syncConflictReason: 'payload_mismatch',
        source: 'mobile_app',
        outcomeCode: 'knocked',
        outcomeLabel: 'Knocked',
        result: 'knocked',
        notes: null,
        localRecordUuid: 'mock-local-2',
        idempotencyKey: 'mock-idem-2'
      }
    ],
    addressRequests: [
      {
        id: 'address-request-1',
        status: 'pending',
        organizationId: 'org-mock-1',
        campaignId: 'campaign-mock-1',
        submittedAt: '2026-03-30T12:00:00.000Z',
        reviewedAt: null,
        reviewReason: null,
        notes: 'Added from field',
        requestedAddress: {
          addressLine1: '555 Added Ave',
          addressLine2: 'Apt 9',
          unit: '9',
          city: 'Detroit',
          state: 'MI',
          zip: '48201',
          latitude: 42.98,
          longitude: -85.69
        },
        turf: { id: 'turf-mock-1', name: seed.turf.name },
        requestedBy: {
          id: 'canvasser-mock-1',
          firstName: seed.canvasser.firstName,
          lastName: seed.canvasser.lastName,
          email: seed.canvasser.email,
          role: 'canvasser'
        },
        reviewedBy: null,
        approvedAddress: null
      }
    ]
  };
}

export function createAdminMswHandlers(scenario = createAdminMockScenario()) {
  return [
    http.post('http://localhost:3001/auth/login', async () => HttpResponse.json(scenario.login)),
    http.get('http://localhost:3001/me', async () => HttpResponse.json(scenario.me)),
    http.post('http://localhost:3001/auth/mfa/step-up', async () => HttpResponse.json(scenario.login)),

    http.get('http://localhost:3001/reports/overview', async () => HttpResponse.json(scenario.reports.overview)),
    http.get('http://localhost:3001/reports/productivity', async () => HttpResponse.json(scenario.reports.productivity)),
    http.get('http://localhost:3001/reports/gps-exceptions', async () => HttpResponse.json(scenario.reports.gpsExceptions)),
    http.get('http://localhost:3001/reports/audit-activity', async () => HttpResponse.json(scenario.reports.auditActivity)),
    http.get('http://localhost:3001/reports/trends', async () => HttpResponse.json(scenario.reports.trends)),
    http.get('http://localhost:3001/reports/resolved-conflicts', async () => HttpResponse.json(scenario.reports.resolvedConflicts)),
    http.get('http://localhost:3001/reports/export-batches', async () => HttpResponse.json(scenario.reports.exportBatches)),

    http.get('http://localhost:3001/admin/campaigns', async () => HttpResponse.json(scenario.campaigns)),
    http.get('http://localhost:3001/turfs', async () => HttpResponse.json(scenario.turfs)),
    http.get('http://localhost:3001/admin/canvassers', async () => HttpResponse.json(scenario.canvassers)),
    http.get('http://localhost:3001/admin/outcomes', async () => HttpResponse.json(scenario.outcomes)),

    http.get('http://localhost:3001/exports/history', async () => HttpResponse.json(scenario.exports.history)),
    http.get('http://localhost:3001/imports/review-queue', async () => HttpResponse.json(scenario.importReviewQueue)),
    http.get('http://localhost:3001/admin/sync-conflicts', async () => HttpResponse.json(scenario.syncConflicts)),
    http.get('http://localhost:3001/address-requests/review', async () => HttpResponse.json(scenario.addressRequests))
  ];
}
