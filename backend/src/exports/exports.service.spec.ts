import { jest } from '@jest/globals';
import { GoneException } from '@nestjs/common';
import { GpsStatus, SyncStatus, VisitResult } from '../../generated/prisma/client.js';
import { ExportsService } from './exports.service.js';

describe('ExportsService', () => {
  const originalExportTimeZone = process.env.EXPORT_TIME_ZONE;
  const scope = { organizationId: 'org-1', campaignId: null };
  const prisma = {
    visitLog: {
      findMany: jest.fn(),
      updateMany: jest.fn()
    },
    exportBatch: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn()
    }
  };
  const auditService = {
    log: jest.fn()
  };
  const policiesService = {
    getEffectivePolicy: jest.fn().mockResolvedValue({
      retentionPurgeDays: 30,
      defaultVanExportProfileCode: 'van_compatible',
      defaultInternalExportProfileCode: 'internal_master'
    })
  };
  const csvProfilesService = {
    resolveProfile: jest.fn().mockImplementation(async ({ code }: { code: string }) => ({
      code,
      name: code === 'internal_master' ? 'Internal Master Export' : 'VAN Compatible Export',
      settingsJson: null
    }))
  };

  const service = new ExportsService(prisma as never, auditService as never, policiesService as never, csvProfilesService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    auditService.log.mockResolvedValue(undefined);
    prisma.exportBatch.findFirst.mockResolvedValue({
      id: 'batch-1',
      csvContent: 'van_id,address_line1\nVAN-123,100 Main St\n',
      filename: 'export-batch.csv',
      sha256Checksum: 'checksum-1'
    });
  });

  afterEach(() => {
    if (originalExportTimeZone === undefined) {
      delete process.env.EXPORT_TIME_ZONE;
    } else {
      process.env.EXPORT_TIME_ZONE = originalExportTimeZone;
    }
  });

  it('generates VAN CSV output and marks visits exported when requested', async () => {
    prisma.visitLog.findMany.mockResolvedValue([
      {
        id: 'visit-1',
        visitTime: new Date('2026-03-28T10:00:00.000Z'),
        result: VisitResult.knocked,
        contactMade: true,
        notes: 'Met voter',
        gpsStatus: GpsStatus.verified,
        latitude: 42.9634,
        longitude: -85.6681,
        accuracyMeters: 5,
        syncStatus: SyncStatus.synced,
        address: {
          household: null,
          vanId: 'VAN-123',
          addressLine1: '100 Main St',
          addressLine2: 'Apt 2',
          unit: '2',
          city: 'Grand Rapids',
          state: 'MI',
          zip: '49503'
        },
        canvasser: {
          firstName: 'Pat',
          lastName: 'Field'
        },
        outcomeDefinition: {
          id: 'outcome-1',
          isFinalDisposition: true
        },
        turf: {
          id: 'turf-1',
          name: 'North'
        },
        geofenceResult: {
          distanceFromTargetFeet: 12.3
        }
      }
    ]);
    prisma.visitLog.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.vanResultsCsv({
      turfId: 'turf-1',
      markExported: true,
      actorUserId: 'admin-1',
      organizationId: 'org-1'
    });

    expect(prisma.visitLog.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        organizationId: 'org-1',
        syncStatus: { not: 'conflict' },
        syncConflictFlag: false,
        turfId: 'turf-1',
        vanExported: false
      },
      orderBy: { visitTime: 'asc' },
      take: 25_001,
      include: {
        address: {
          include: {
            household: true
          }
        },
        canvasser: true,
        geofenceResult: true,
        outcomeDefinition: true,
        turf: true
      }
    });
    expect(prisma.visitLog.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['visit-1'] } },
      data: { vanExported: true }
    });
    expect(result.count).toBe(1);
    expect(result.csv).toContain('VAN-123');
    expect(result.csv).toContain('Pat Field');
    expect(result.csv).toContain('address_line2');
    expect(result.csv).toContain('unit');
    expect(result.csv).toContain('time_zone');
    expect(result.csv).toContain('UTC');
    expect(result.csv).toContain('2026-03-28T10:00:00.000Z');
    expect(result.filename).toContain('van-results-');
    expect(prisma.exportBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          profileCode: 'van_compatible',
          organizationId: 'org-1',
          campaignId: null,
          turfId: 'turf-1',
          initiatedByUserId: 'admin-1',
          markExported: true,
          rowCount: 1,
          csvContent: expect.any(String),
          sha256Checksum: expect.any(String),
          exportedVisits: {
            create: [
              expect.objectContaining({
                rowIndex: 1
              })
            ]
          }
        }),
        include: {
          exportedVisits: true
        }
      })
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'csv_export_generated',
        entityId: 'turf-1'
      })
    );
  });

  it('neutralizes formula-injection prefixes while leaving legitimate negative numbers untouched', async () => {
    prisma.visitLog.findMany.mockResolvedValue([
      {
        id: 'visit-1',
        visitTime: new Date('2026-03-28T10:00:00.000Z'),
        result: VisitResult.knocked,
        contactMade: true,
        notes: '\t=cmd|\' /c calc\'!A1',
        gpsStatus: GpsStatus.verified,
        latitude: 42.9634,
        longitude: -85.6681,
        accuracyMeters: 5,
        syncStatus: SyncStatus.synced,
        address: {
          household: null,
          vanId: 'VAN-123',
          addressLine1: '100 Main St',
          addressLine2: null,
          unit: null,
          city: 'Grand Rapids',
          state: 'MI',
          zip: '49503'
        },
        canvasser: {
          firstName: '+1',
          lastName: 'Field'
        },
        outcomeDefinition: {
          id: 'outcome-1',
          isFinalDisposition: true
        },
        turf: {
          id: 'turf-1',
          name: 'North'
        },
        geofenceResult: {
          distanceFromTargetFeet: 12.3
        }
      }
    ]);

    const result = await service.vanResultsCsv({
      organizationId: 'org-1'
    });

    expect(result.csv).toContain("'\t=cmd|' /c calc'!A1");
    expect(result.csv).toContain("'+1 Field");
    expect(result.csv).toContain('-85.6681');
    expect(result.csv).not.toContain("'-85.6681");
  });

  it('renders exact NGP VAN CRM bulk-canvass headers and tenant-mapped values without internal fields', async () => {
    csvProfilesService.resolveProfile.mockResolvedValueOnce({
      code: 'ngpvan_vancrm_bulk_canvass_results_v1',
      name: 'NGP VAN CRM Bulk Canvass Results v1',
      settingsJson: {
        filenamePrefix: 'ngpvan-vancrm-bulk-canvass-results-v1',
        columns: ['VanId', 'ResultID', 'DateCanvassed'],
        columnSources: { VanId: 'van_id', ResultID: 'outcome_code', DateCanvassed: 'visit_time' },
        requiredColumns: ['VanId', 'ResultID', 'DateCanvassed'],
        requiredMappedColumns: ['ResultID'],
        columnFormats: { VanId: 'positive-integer', ResultID: 'positive-integer', DateCanvassed: 'iso8601-offset' },
        valueMappings: { ResultID: { knocked: '14' } }
      }
    });
    prisma.visitLog.findMany.mockResolvedValue([
      {
        id: 'visit-vendor-1',
        visitTime: new Date('2026-03-28T10:00:00.000Z'),
        result: VisitResult.knocked,
        outcomeCode: 'knocked',
        contactMade: false,
        notes: 'Must not leave PROACTIVE',
        gpsStatus: GpsStatus.verified,
        latitude: 42.9634,
        longitude: -85.6681,
        accuracyMeters: 5,
        syncStatus: SyncStatus.synced,
        syncConflictFlag: false,
        address: {
          household: null,
          vanId: '123456',
          addressLine1: '100 Main St',
          addressLine2: null,
          unit: null,
          city: 'Grand Rapids',
          state: 'MI',
          zip: '49503'
        },
        canvasser: { firstName: 'Pat', lastName: 'Field' },
        outcomeDefinition: { id: 'outcome-1', isFinalDisposition: true },
        turf: { id: 'turf-1', name: 'North' },
        geofenceResult: { distanceFromTargetFeet: 12.3 }
      }
    ]);

    const result = await service.vanResultsCsv({
      organizationId: 'org-1',
      profileCode: 'ngpvan_vancrm_bulk_canvass_results_v1'
    });

    expect(result.csv).toBe('\uFEFFVanId,ResultID,DateCanvassed\n123456,14,2026-03-28T10:00:00.000Z\n');
    expect(result.csv).not.toContain('gps');
    expect(result.csv).not.toContain('Main St');
    expect(result.csv).not.toContain('Must not leave');
  });

  it('rejects NGP VAN CRM exports with an unmapped outcome before recording an artifact', async () => {
    csvProfilesService.resolveProfile.mockResolvedValueOnce({
      code: 'ngpvan_vancrm_bulk_canvass_results_v1',
      name: 'NGP VAN CRM Bulk Canvass Results v1',
      settingsJson: {
        columns: ['VanId', 'ResultID', 'DateCanvassed'],
        columnSources: { VanId: 'van_id', ResultID: 'outcome_code', DateCanvassed: 'visit_time' },
        requiredColumns: ['VanId', 'ResultID', 'DateCanvassed'],
        requiredMappedColumns: ['ResultID'],
        columnFormats: { VanId: 'positive-integer', ResultID: 'positive-integer', DateCanvassed: 'iso8601-offset' },
        valueMappings: { ResultID: {} }
      }
    });
    prisma.visitLog.findMany.mockResolvedValue([
      {
        id: 'visit-vendor-failure',
        visitTime: new Date('2026-03-28T10:00:00.000Z'),
        result: VisitResult.knocked,
        outcomeCode: 'knocked',
        contactMade: false,
        notes: null,
        gpsStatus: GpsStatus.missing,
        latitude: null,
        longitude: null,
        accuracyMeters: null,
        syncStatus: SyncStatus.synced,
        syncConflictFlag: false,
        address: { household: null, vanId: '123456', addressLine1: '100 Main St', addressLine2: null, unit: null, city: 'Grand Rapids', state: 'MI', zip: '49503' },
        canvasser: { firstName: 'Pat', lastName: 'Field' },
        outcomeDefinition: { id: 'outcome-1', isFinalDisposition: true },
        turf: { id: 'turf-1', name: 'North' },
        geofenceResult: null
      }
    ]);

    await expect(service.vanResultsCsv({
      organizationId: 'org-1',
      profileCode: 'ngpvan_vancrm_bulk_canvass_results_v1'
    })).rejects.toThrow('CSV profile is missing ResultID value mapping for "knocked" at row 1');
    expect(prisma.exportBatch.create).not.toHaveBeenCalled();
  });

  it('rejects an export that would exceed the row cap instead of silently truncating it', async () => {
    prisma.visitLog.findMany.mockResolvedValue(
      Array.from({ length: 25_001 }, (_, index) => ({ id: `visit-${index}` }))
    );

    await expect(service.vanResultsCsv({ organizationId: 'org-1' })).rejects.toThrow(
      'This export would include more than 25000 rows. Narrow it by turf and try again.'
    );
  });

  it('skips export marking when markExported is false', async () => {
    prisma.visitLog.findMany.mockResolvedValue([]);

    const result = await service.vanResultsCsv({
      markExported: false,
      organizationId: 'org-1'
    });

    expect(prisma.visitLog.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        organizationId: 'org-1',
        syncStatus: { not: 'conflict' },
        syncConflictFlag: false
      },
      orderBy: { visitTime: 'asc' },
      take: 25_001,
      include: {
        address: {
          include: {
            household: true
          }
        },
        canvasser: true,
        geofenceResult: true,
        outcomeDefinition: true,
        turf: true
      }
    });
    expect(prisma.visitLog.updateMany).not.toHaveBeenCalled();
    expect(result.count).toBe(0);
    expect(result.filename).toEqual(expect.stringContaining('van-results-'));
    expect(result.csv).toBe(
      '\uFEFFvan_id,address_line1,address_line2,unit,city,state,zip,visit_time,result,contact_made,notes,time_zone,gps_status,latitude,longitude,accuracy_meters,distance_from_target_feet,sync_status,canvasser_name\n'
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'csv_export_generated',
        entityId: 'all'
      })
    );
  });

  it('generates an internal master export and stores export history', async () => {
    prisma.visitLog.findMany.mockResolvedValue([
      {
        id: 'visit-1',
        turfId: 'turf-1',
        addressId: 'address-1',
        canvasserId: 'user-1',
        visitTime: new Date('2026-03-28T10:00:00.000Z'),
        clientCreatedAt: new Date('2026-03-28T09:59:00.000Z'),
        serverReceivedAt: new Date('2026-03-28T10:00:05.000Z'),
        result: VisitResult.knocked,
        outcomeCode: 'knocked',
        outcomeLabel: 'Knocked',
        contactMade: true,
        notes: 'Met voter',
        gpsStatus: GpsStatus.verified,
        geofenceValidated: true,
        geofenceDistanceMeters: 4,
        latitude: 42.9634,
        longitude: -85.6681,
        accuracyMeters: 5,
        localRecordUuid: 'local-1',
        idempotencyKey: 'idem-1',
        source: 'mobile_app',
        syncStatus: SyncStatus.synced,
        syncConflictFlag: false,
        syncConflictReason: null,
        vanExported: false,
        address: {
          household: {
            id: 'household-1',
            vanHouseholdId: 'VHH-123',
            vanPersonId: 'VP-9'
          },
          vanId: 'VAN-123',
          addressLine1: '100 Main St',
          addressLine2: 'Floor 2',
          unit: 'Suite A',
          city: 'Grand Rapids',
          state: 'MI',
          zip: '49503'
        },
        turf: {
          id: 'turf-1',
          name: 'North'
        },
        canvasser: {
          firstName: 'Pat',
          lastName: 'Field'
        },
        outcomeDefinition: {
          id: 'outcome-1',
          isFinalDisposition: true
        },
        geofenceResult: {
          distanceFromTargetFeet: 12.3,
          overrideFlag: false,
          overrideReason: null
        }
      }
    ]);
    prisma.exportBatch.findMany.mockResolvedValue([{ id: 'batch-1', profileCode: 'internal_master' }]);

    const result = await service.internalMasterCsv({
      turfId: 'turf-1',
      actorUserId: 'admin-1',
      organizationId: 'org-1'
    });
    const history = await service.exportHistory(scope);

    expect(prisma.visitLog.updateMany).not.toHaveBeenCalled();
    expect(result.csv).toContain('outcome_code');
    expect(result.csv).toContain('organization_id');
    expect(result.csv).toContain('household_id');
    expect(result.csv).toContain('attempt_number');
    expect(result.csv).toContain('is_final_disposition');
    expect(result.csv).toContain('Knocked');
    expect(result.csv).toContain('time_zone');
    expect(result.csv).toContain('UTC');
    expect(result.csv).toContain('2026-03-28T10:00:00.000Z');
    expect(result.csv).not.toContain('America/Detroit');
    expect(result.filename).toContain('internal-master-');
    expect(prisma.exportBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          profileCode: 'internal_master',
          organizationId: 'org-1',
          campaignId: null,
          turfId: 'turf-1',
          initiatedByUserId: 'admin-1',
          markExported: false,
          rowCount: 1,
          csvContent: expect.any(String),
          sha256Checksum: expect.any(String),
          exportedVisits: {
            create: [
              expect.objectContaining({
                rowIndex: 1
              })
            ]
          }
        }),
        include: {
          exportedVisits: true
        }
      })
    );
    expect(prisma.exportBatch.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1'
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        initiatedByUser: {
          select: expect.any(Object)
        },
        turf: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            exportedVisits: true
          }
        }
      }
    });
    expect(history).toEqual([{ id: 'batch-1', profileCode: 'internal_master' }]);
  });

  it('still emits the full internal-master header row when zero visits match', async () => {
    prisma.visitLog.findMany.mockResolvedValue([]);

    const result = await service.internalMasterCsv({
      organizationId: 'org-1'
    });

    expect(result.count).toBe(0);
    expect(result.csv).toContain('organization_id');
    expect(result.csv).toContain('household_van_household_id');
    expect(result.csv).toContain('geofence_failure_reason');
    expect(result.csv).toContain('van_exported');
  });

  it('keeps localized timestamps unambiguous even when the configured profile omits the time_zone column', async () => {
    process.env.EXPORT_TIME_ZONE = 'America/Detroit';
    csvProfilesService.resolveProfile.mockResolvedValueOnce({
      code: 'van_compatible',
      name: 'VAN Compatible Export',
      settingsJson: {
        columns: ['van_id', 'visit_time']
      }
    });
    prisma.visitLog.findMany.mockResolvedValue([
      {
        id: 'visit-1',
        visitTime: new Date('2026-03-28T10:00:00.000Z'),
        result: VisitResult.knocked,
        contactMade: true,
        notes: 'Met voter',
        gpsStatus: GpsStatus.verified,
        latitude: 42.9634,
        longitude: -85.6681,
        accuracyMeters: 5,
        syncStatus: SyncStatus.synced,
        syncConflictFlag: false,
        address: {
          household: null,
          vanId: 'VAN-123',
          addressLine1: '100 Main St',
          addressLine2: null,
          unit: null,
          city: 'Grand Rapids',
          state: 'MI',
          zip: '49503'
        },
        canvasser: {
          firstName: 'Pat',
          lastName: 'Field'
        },
        outcomeDefinition: {
          id: 'outcome-1',
          isFinalDisposition: true
        },
        turf: {
          id: 'turf-1',
          name: 'North'
        },
        geofenceResult: {
          distanceFromTargetFeet: 12.3
        }
      }
    ]);

    const result = await service.vanResultsCsv({
      organizationId: 'org-1'
    });

    expect(result.csv).toContain('visit_time');
    expect(result.csv).not.toContain('time_zone');
    expect(result.csv).toContain('2026-03-28T06:00:00.000-04:00');
  });

  it('fails historical download when the stored artifact has been purged', async () => {
    prisma.exportBatch.findFirst.mockResolvedValue({
      id: 'batch-1',
      csvContent: null,
      filename: 'export-batch.csv',
      sha256Checksum: 'checksum-1'
    });

    await expect(service.downloadExportBatch('batch-1', scope)).rejects.toBeInstanceOf(GoneException);
  });
});
