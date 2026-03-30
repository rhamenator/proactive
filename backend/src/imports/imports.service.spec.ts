import { BadRequestException } from '@nestjs/common';
import { ImportsService } from './imports.service';

describe('ImportsService', () => {
  const prisma = {
    turf: {
      findFirst: jest.fn(),
      create: jest.fn()
    },
    importBatch: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn()
    },
    importBatchRow: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn()
    },
    household: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    address: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    }
  };
  const usersService = {
    findById: jest.fn()
  };
  const auditService = {
    log: jest.fn()
  };
  const policiesService = {
    getEffectivePolicy: jest.fn().mockResolvedValue({
      defaultImportMode: 'create_only',
      defaultDuplicateStrategy: 'skip'
    })
  };

  const service = new ImportsService(prisma as never, usersService as never, auditService as never, policiesService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    usersService.findById.mockResolvedValue({
      id: 'admin-1',
      organizationId: 'org-1',
      campaignId: 'campaign-1'
    });
    prisma.turf.findFirst.mockResolvedValue(null);
    prisma.turf.create
      .mockResolvedValueOnce({
        id: 'turf-1',
        name: 'North Turf',
        organizationId: 'org-1',
        campaignId: 'campaign-1'
      })
      .mockResolvedValueOnce({
        id: 'turf-2',
        name: 'South Turf',
        organizationId: 'org-1',
        campaignId: 'campaign-1'
      });
    prisma.household.findFirst.mockResolvedValue(null);
    prisma.household.create
      .mockResolvedValueOnce({ id: 'household-1' })
      .mockResolvedValueOnce({ id: 'household-2' });
    prisma.household.update.mockResolvedValue({ id: 'household-1' });
    prisma.address.findFirst.mockResolvedValue(null);
    prisma.address.create.mockResolvedValue({});
    prisma.address.update.mockResolvedValue({});
    prisma.address.updateMany.mockResolvedValue({ count: 0 });
    prisma.importBatch.create.mockResolvedValue({ id: 'batch-1' });
    prisma.importBatch.update.mockResolvedValue({});
    prisma.importBatch.findMany.mockResolvedValue([{ id: 'batch-1' }]);
    prisma.importBatch.findFirst.mockResolvedValue({
      id: 'batch-1',
      csvContent: 'address,city,state\n100 Main,Detroit,MI\n',
      filename: 'import-batch.csv',
      sha256Checksum: 'checksum-1'
    });
    prisma.importBatchRow.findMany.mockResolvedValue([]);
    prisma.importBatchRow.findFirst.mockResolvedValue(null);
    prisma.importBatchRow.update.mockResolvedValue({
      id: 'row-1',
      status: 'merged',
      resolutionAction: 'merge',
      resolvedAt: new Date('2026-03-30T07:30:00.000Z')
    });
    auditService.log.mockResolvedValue(undefined);
  });

  it('imports grouped CSV rows, combines extra address fields, and skips incomplete rows', async () => {
    const result = await service.importCsv({
      createdById: 'admin-1',
      csv: [
        'turf_name,address_line1,address_line2,unit,city,state,zip,van_household_id,latitude,longitude',
        'North Turf,10 Main St,Floor 2,Suite A,Grand Rapids,MI,49503,HH-1,42.96,-85.67',
        'North Turf,,Floor 2,Suite A,Grand Rapids,MI,49503,HH-2,42.96,-85.67',
        'South Turf,22 Oak Ave,,,Grand Rapids,MI,49504,HH-3,42.97,-85.68'
      ].join('\n')
    });

    expect(prisma.turf.create).toHaveBeenCalledTimes(2);
    expect(prisma.address.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          turfId: 'turf-1',
          householdId: 'household-1',
          addressLine1: '10 Main St, Floor 2, Suite A',
          vanId: 'HH-1'
        })
      })
    );
    expect(result).toEqual({
      importBatchId: 'batch-1',
      filename: expect.stringContaining('import-batch-'),
      mode: 'create_only',
      duplicateStrategy: 'skip',
      turfsCreated: 2,
      addressesImported: 2,
      pendingDuplicateReviews: 0,
      replacedMembershipsRemoved: 0,
      invalidRowsSkipped: 1,
      duplicateRowsSkipped: 0,
      duplicateRowsMerged: 0,
      turfs: [
        { id: 'turf-1', name: 'North Turf' },
        { id: 'turf-2', name: 'South Turf' }
      ]
    });
  });

  it('upserts into an existing turf and merges duplicate addresses when configured', async () => {
    prisma.turf.findFirst.mockResolvedValue({
      id: 'turf-9',
      name: 'North Turf',
      organizationId: 'org-1',
      campaignId: 'campaign-1'
    });
    prisma.household.findFirst.mockResolvedValue({
      id: 'household-1',
      latitude: 42.9,
      longitude: -85.6,
      vanHouseholdId: 'HH-1',
      vanPersonId: null
    });
    prisma.address.findFirst.mockResolvedValue({
      id: 'address-1',
      zip: '49503',
      vanId: 'HH-1',
      latitude: 42.9,
      longitude: -85.6
    });

    const result = await service.importCsv({
      createdById: 'admin-1',
      mode: 'upsert',
      duplicateStrategy: 'merge',
      csv: [
        'turf_name,address_line1,city,state,zip,van_household_id,latitude,longitude',
        'North Turf,10 Main St,Grand Rapids,MI,49503,HH-1,42.96,-85.67'
      ].join('\n')
    });

    expect(prisma.turf.create).not.toHaveBeenCalled();
    expect(prisma.address.update).toHaveBeenCalledWith({
      where: { id: 'address-1' },
      data: expect.objectContaining({
        addressLine1: '10 Main St',
        city: 'Grand Rapids',
        state: 'MI',
        zip: '49503',
        vanId: 'HH-1'
      })
    });
    expect(result).toEqual({
      importBatchId: 'batch-1',
      filename: expect.stringContaining('import-batch-'),
      mode: 'upsert',
      duplicateStrategy: 'merge',
      turfsCreated: 0,
      addressesImported: 0,
      pendingDuplicateReviews: 0,
      replacedMembershipsRemoved: 0,
      invalidRowsSkipped: 0,
      duplicateRowsSkipped: 0,
      duplicateRowsMerged: 1,
      turfs: [{ id: 'turf-9', name: 'North Turf' }]
    });
  });

  it('replaces turf memberships not present in the latest batch when configured', async () => {
    prisma.turf.findFirst.mockResolvedValue({
      id: 'turf-9',
      name: 'North Turf',
      organizationId: 'org-1',
      campaignId: 'campaign-1'
    });
    prisma.household.findFirst.mockResolvedValue({
      id: 'household-1',
      latitude: null,
      longitude: null,
      vanHouseholdId: 'HH-1',
      vanPersonId: null
    });
    prisma.address.findFirst.mockResolvedValue({
      id: 'address-1',
      turfId: 'turf-9',
      householdId: 'household-1'
    });
    prisma.address.updateMany.mockResolvedValue({ count: 3 });

    const result = await service.importCsv({
      createdById: 'admin-1',
      mode: 'replace_turf_membership',
      csv: [
        'turf_name,address_line1,city,state,van_household_id',
        'North Turf,10 Main St,Grand Rapids,MI,HH-1'
      ].join('\n')
    });

    expect(prisma.address.updateMany).toHaveBeenCalledWith({
      where: {
        turfId: 'turf-9',
        deletedAt: null,
        householdId: {
          notIn: ['household-1']
        }
      },
      data: expect.objectContaining({
        deleteReason: 'replace_turf_membership_import'
      })
    });
    expect(result.replacedMembershipsRemoved).toBe(3);
  });

  it('rejects duplicate rows when duplicateStrategy is error', async () => {
    prisma.household.findFirst.mockResolvedValue({
      id: 'household-1',
      latitude: null,
      longitude: null,
      vanHouseholdId: null,
      vanPersonId: null
    });
    prisma.address.findFirst.mockResolvedValue({
      id: 'address-1'
    });

    await expect(
      service.importCsv({
        createdById: 'admin-1',
        duplicateStrategy: 'error',
        csv: [
          'turf_name,address_line1,city,state',
          'North Turf,10 Main St,Grand Rapids,MI'
        ].join('\n')
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('queues duplicate rows for review when configured', async () => {
    prisma.household.findFirst.mockResolvedValue({
      id: 'household-1',
      latitude: null,
      longitude: null,
      vanHouseholdId: 'HH-1',
      vanPersonId: null
    });
    prisma.address.findFirst.mockResolvedValue({
      id: 'address-1',
      turfId: 'turf-1',
      householdId: 'household-1'
    });

    const result = await service.importCsv({
      createdById: 'admin-1',
      duplicateStrategy: 'review',
      csv: [
        'turf_name,address_line1,city,state,van_household_id',
        'North Turf,10 Main St,Grand Rapids,MI,HH-1'
      ].join('\n')
    });

    expect(prisma.importBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pendingReviewCount: 1
        })
      })
    );
    expect(result.pendingDuplicateReviews).toBe(1);
  });

  it('lists pending import review rows within scope', async () => {
    prisma.importBatchRow.findMany.mockResolvedValue([
      {
        id: 'row-1',
        rowIndex: 4,
        turfName: 'North Turf',
        status: 'pending_review',
        reasonCode: 'duplicate_household_pending_review',
        createdAt: new Date('2026-03-30T07:00:00.000Z'),
        rawRowJson: { address_line1: '10 Main St' },
        importBatch: {
          id: 'batch-1',
          filename: 'import-batch.csv',
          createdAt: new Date('2026-03-30T07:00:00.000Z'),
          mode: 'upsert',
          duplicateStrategy: 'review'
        },
        candidateAddress: {
          id: 'address-1',
          addressLine1: '10 Main St',
          city: 'Grand Rapids',
          state: 'MI',
          zip: '49503',
          vanId: 'HH-1',
          turf: {
            id: 'turf-1',
            name: 'North Turf'
          }
        },
        household: {
          id: 'household-1',
          addressLine1: '10 Main St',
          city: 'Grand Rapids',
          state: 'MI',
          zip: '49503',
          vanHouseholdId: 'HH-1',
          vanPersonId: null
        }
      }
    ]);

    const result = await service.importReviewQueue({
      scope: { organizationId: 'org-1', campaignId: null },
      take: 25
    });

    expect(prisma.importBatchRow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'pending_review'
        }),
        take: 25
      })
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('row-1');
  });

  it('resolves a pending import review by merging into the existing candidate address', async () => {
    prisma.importBatchRow.findFirst.mockResolvedValue({
      id: 'row-1',
      importBatchId: 'batch-1',
      rowIndex: 1,
      rawRowJson: {
        address_line1: '10 Main St',
        city: 'Grand Rapids',
        state: 'MI',
        zip: '49503',
        van_household_id: 'HH-1'
      },
      importBatch: {
        id: 'batch-1',
        filename: 'import-batch.csv',
        createdAt: new Date('2026-03-30T07:00:00.000Z'),
        mode: 'upsert',
        duplicateStrategy: 'review',
        mappingJson: {
          addressLine1: 'address_line1',
          city: 'city',
          state: 'state',
          zip: 'zip',
          vanHouseholdId: 'van_household_id'
        }
      },
      candidateAddress: {
        id: 'address-1',
        addressLine1: '10 Main St',
        city: 'Grand Rapids',
        state: 'MI',
        zip: '49503',
        vanId: 'HH-1',
        latitude: null,
        longitude: null
      }
    });
    prisma.address.update.mockResolvedValue({
      id: 'address-1'
    });
    prisma.importBatchRow.update.mockResolvedValue({
      id: 'row-1',
      status: 'merged',
      resolutionAction: 'merge',
      resolvedAt: new Date('2026-03-30T07:30:00.000Z')
    });

    const result = await service.resolveImportReview({
      rowId: 'row-1',
      scope: { organizationId: 'org-1', campaignId: null },
      actorUserId: 'admin-1',
      action: 'merge',
      reason: 'Reviewed imported duplicate row'
    });

    expect(prisma.importBatch.update).toHaveBeenCalledWith({
      where: { id: 'batch-1' },
      data: {
        pendingReviewCount: {
          decrement: 1
        },
        mergedCount: {
          increment: 1
        }
      }
    });
    expect(result.status).toBe('merged');
  });

  it('resolves a pending import review by skipping the duplicate row', async () => {
    prisma.importBatchRow.findFirst.mockResolvedValue({
      id: 'row-1',
      importBatchId: 'batch-1',
      rawRowJson: { address_line1: '10 Main St' },
      importBatch: {
        id: 'batch-1',
        filename: 'import-batch.csv',
        createdAt: new Date('2026-03-30T07:00:00.000Z'),
        mode: 'upsert',
        duplicateStrategy: 'review',
        mappingJson: null
      },
      candidateAddress: {
        id: 'address-1',
        addressLine1: '10 Main St',
        city: 'Grand Rapids',
        state: 'MI',
        zip: '49503',
        vanId: 'HH-1',
        latitude: null,
        longitude: null
      }
    });
    prisma.importBatchRow.update.mockResolvedValue({
      id: 'row-1',
      status: 'skipped_duplicate',
      resolutionAction: 'skip',
      resolvedAt: new Date('2026-03-30T07:30:00.000Z')
    });

    const result = await service.resolveImportReview({
      rowId: 'row-1',
      scope: { organizationId: 'org-1', campaignId: null },
      actorUserId: 'admin-1',
      action: 'skip',
      reason: 'Confirmed duplicate household already exists'
    });

    expect(prisma.importBatch.update).toHaveBeenCalledWith({
      where: { id: 'batch-1' },
      data: {
        pendingReviewCount: {
          decrement: 1
        },
        duplicateSkippedCount: {
          increment: 1
        }
      }
    });
    expect(result.status).toBe('skipped_duplicate');
  });

  it('lists and downloads import history within scope', async () => {
    const history = await service.importHistory({ organizationId: 'org-1', campaignId: null });
    const batch = await service.downloadImportBatch('batch-1', { organizationId: 'org-1', campaignId: null });

    expect(prisma.importBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1' }
      })
    );
    expect(prisma.importBatch.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'batch-1',
        organizationId: 'org-1'
      }
    });
    expect(history).toEqual([{ id: 'batch-1' }]);
    expect(batch.filename).toBe('import-batch.csv');
  });
});
