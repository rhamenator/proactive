import { ImportsController } from './imports.controller';

describe('ImportsController', () => {
  const importsService = {
    previewCsv: jest.fn(),
    importCsv: jest.fn(),
    importHistory: jest.fn(),
    downloadImportBatch: jest.fn(),
    importReviewQueue: jest.fn(),
    resolveImportReview: jest.fn()
  };
  const usersService = {
    findById: jest.fn()
  };
  const policiesService = {
    getEffectivePolicy: jest.fn()
  };

  const controller = new ImportsController(importsService as never, usersService as never, policiesService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    usersService.findById.mockResolvedValue({
      id: 'admin-1',
      organizationId: 'org-1',
      campaignId: null
    });
  });

  it('delegates CSV imports after parsing mapping JSON and policy options', async () => {
    const file = {
      buffer: Buffer.from('address,city,state\n100 Main,Detroit,MI\n')
    } as Express.Multer.File;

    await controller.importCsv(
      file,
      {
        turfName: 'North',
        mapping: JSON.stringify({ addressLine1: 'address' }),
        mode: 'upsert',
        duplicateStrategy: 'merge'
      },
      { sub: 'admin-1', email: 'admin@example.com', role: 'admin' as never }
    );

    expect(importsService.importCsv).toHaveBeenCalledWith({
      csv: 'address,city,state\n100 Main,Detroit,MI\n',
      createdById: 'admin-1',
      turfName: 'North',
      mapping: { addressLine1: 'address' },
      mode: 'upsert',
      duplicateStrategy: 'merge'
    });
  });

  it('delegates CSV preview requests with the parsed mapping payload', async () => {
    const file = {
      buffer: Buffer.from('address,city,state\n100 Main,Detroit,MI\n')
    } as Express.Multer.File;

    await controller.previewCsv(
      file,
      {
        turfName: 'North',
        mapping: JSON.stringify({ addressLine1: 'address' }),
        mode: 'upsert',
        duplicateStrategy: 'merge'
      },
      { sub: 'admin-1', email: 'admin@example.com', role: 'admin' as never }
    );

    expect(importsService.previewCsv).toHaveBeenCalledWith({
      csv: 'address,city,state\n100 Main,Detroit,MI\n',
      createdById: 'admin-1',
      turfName: 'North',
      mapping: { addressLine1: 'address' },
      mode: 'upsert',
      duplicateStrategy: 'merge'
    });
  });

  it('lists and downloads import history within the caller scope', async () => {
    importsService.importHistory.mockResolvedValue([{ id: 'batch-1' }]);
    importsService.downloadImportBatch.mockResolvedValue({
      csv: 'address,city,state\n100 Main,Detroit,MI\n',
      filename: 'import-batch.csv'
    });
    const response = {
      setHeader: jest.fn(),
      send: jest.fn()
    };
    const user = { sub: 'admin-1', email: 'admin@example.com', role: 'admin' as never };

    const history = await controller.importHistory(user);
    await controller.downloadImportBatch('batch-1', user, response as never);

    expect(importsService.importHistory).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1',
      campaignId: null
    }));
    expect(importsService.downloadImportBatch).toHaveBeenCalledWith('batch-1', expect.objectContaining({
      organizationId: 'org-1',
      campaignId: null
    }));
    expect(history).toEqual([{ id: 'batch-1' }]);
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(response.send).toHaveBeenCalledWith('address,city,state\n100 Main,Detroit,MI\n');
  });

  it('lists and resolves pending import duplicate reviews within caller scope', async () => {
    importsService.importReviewQueue.mockResolvedValue([{ id: 'row-1' }]);
    importsService.resolveImportReview.mockResolvedValue({
      id: 'row-1',
      status: 'merged',
      resolutionAction: 'merge'
    });
    const user = { sub: 'admin-1', email: 'admin@example.com', role: 'admin' as never };

    const queue = await controller.importReviewQueue(user, { take: 25 });
    const resolution = await controller.resolveImportReview(
      'row-1',
      { action: 'merge', reason: 'Reviewed imported duplicate row' },
      user
    );

    expect(importsService.importReviewQueue).toHaveBeenCalledWith({
      scope: expect.objectContaining({
        organizationId: 'org-1',
        campaignId: null
      }),
      take: 25
    });
    expect(importsService.resolveImportReview).toHaveBeenCalledWith({
      rowId: 'row-1',
      scope: expect.objectContaining({
        organizationId: 'org-1',
        campaignId: null
      }),
      actorUserId: 'admin-1',
      action: 'merge',
      reason: 'Reviewed imported duplicate row'
    });
    expect(queue).toEqual([{ id: 'row-1' }]);
    expect(resolution).toEqual({
      id: 'row-1',
      status: 'merged',
      resolutionAction: 'merge'
    });
  });
});
