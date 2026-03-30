import { BadRequestException } from '@nestjs/common';
import { ImportsService } from './imports.service';

describe('ImportsService', () => {
  const prisma = {
    turf: {
      findFirst: jest.fn(),
      create: jest.fn()
    },
    address: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    }
  };
  const usersService = {
    findById: jest.fn()
  };
  const auditService = {
    log: jest.fn()
  };

  const service = new ImportsService(prisma as never, usersService as never, auditService as never);

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
    prisma.address.findFirst.mockResolvedValue(null);
    prisma.address.create.mockResolvedValue({});
    prisma.address.update.mockResolvedValue({});
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
          addressLine1: '10 Main St, Floor 2, Suite A',
          vanId: 'HH-1'
        })
      })
    );
    expect(result).toEqual({
      mode: 'create_only',
      duplicateStrategy: 'skip',
      turfsCreated: 2,
      addressesImported: 2,
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
      mode: 'upsert',
      duplicateStrategy: 'merge',
      turfsCreated: 0,
      addressesImported: 0,
      invalidRowsSkipped: 0,
      duplicateRowsSkipped: 0,
      duplicateRowsMerged: 1,
      turfs: [{ id: 'turf-9', name: 'North Turf' }]
    });
  });

  it('rejects duplicate rows when duplicateStrategy is error', async () => {
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
});
